/**
 * Netlify Function: admin-content
 * Routes:
 * - GET|PUT            /api/admin/content
 * - GET|POST           /api/admin/backups
 * - GET|PATCH|DELETE   /api/admin/compliance-requests*
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import {
  SERVERLESS_ANNOUNCEMENTS,
  SERVERLESS_HOMEPAGE_HIGHLIGHTS,
} from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-content', '/api/admin'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const requiredPermission =
    subPath === 'backups'
      ? 'backups:manage'
      : subPath === 'compliance-requests' || subPath.startsWith('compliance-requests/')
      ? 'compliance:manage'
      : method === 'GET'
      ? 'dashboard:read'
      : 'content:write';

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission,
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();

  if (subPath === 'content' || subPath === '') {
    if (method === 'GET') {
      const announcements = repo
        ? await repo.getAnnouncements(false)
        : SERVERLESS_ANNOUNCEMENTS.map((a) => ({
            id: a.id,
            title: a.title,
            tag: a.tag,
            date: a.date,
            link: a.link,
            active: a.isActive,
          }));
      const homepageHighlights = repo
        ? await repo.getHomepageHighlights()
        : SERVERLESS_HOMEPAGE_HIGHLIGHTS;
      return jsonResponse(
        event,
        200,
        {
          announcements,
          homepageHighlights,
        },
        ['GET', 'PUT']
      );
    }

    if (method === 'PUT') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ['GET', 'PUT'],
        });
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Persistent website content updates require Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['GET', 'PUT']
        );
      }
      const nextAnnouncements = Array.isArray(parsed.data.announcements)
        ? await repo.replaceAnnouncements(parsed.data.announcements)
        : await repo.getAnnouncements(false);
      const nextHighlights = parsed.data.homepageHighlights
        ? await repo.setHomepageHighlights(parsed.data.homepageHighlights, auth.user.username)
        : await repo.getHomepageHighlights();
      await repo.recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_CONTENT_UPDATED',
        entityType: 'website_content',
      }).catch(() => {});
      return jsonResponse(
        event,
        200,
        {
          success: true,
          content: {
            announcements: nextAnnouncements,
            homepageHighlights: nextHighlights,
            featuredOpportunityIds: parsed.data.featuredOpportunityIds || [],
          },
        },
        ['GET', 'PUT']
      );
    }

    return methodNotAllowedResponse(event, ['GET', 'PUT']);
  }

  if (subPath === 'backups') {
    if (method !== 'GET' && method !== 'POST') {
      return methodNotAllowedResponse(event, ['GET', 'POST']);
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Cloud database snapshot backups require Supabase PostgreSQL configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET', 'POST']
      );
    }

    if (method === 'GET') {
      const backups = await repo.listBackups();
      return jsonResponse(event, 200, { success: true, count: backups.length, backups }, ['GET', 'POST']);
    }

    const backup = await repo.createLogicalBackupSnapshot();
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_BACKUP_CREATED',
      entityType: 'database_backup',
      entityId: backup.id,
      details: { filename: backup.filename, sizeBytes: backup.sizeBytes },
    }).catch(() => {});
    return jsonResponse(
      event,
      201,
      {
        success: true,
        message: 'Supabase logical snapshot backup created successfully.',
        backup,
      },
      ['GET', 'POST']
    );
  }

  if (subPath === 'compliance-requests' || subPath.startsWith('compliance-requests/')) {
    const requestId = subPath.startsWith('compliance-requests/')
      ? decodeURIComponent(subPath.slice('compliance-requests/'.length))
      : '';

    if (!requestId) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(event, ['GET']);
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Compliance request inbox requires Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['GET']
        );
      }
      const requests = await repo.getComplianceRequests({
        requestType: event.queryStringParameters?.requestType,
        status: event.queryStringParameters?.status,
      });
      return jsonResponse(event, 200, { success: true, count: requests.length, requests }, ['GET']);
    }

    if (method !== 'PATCH' && method !== 'DELETE') {
      return methodNotAllowedResponse(event, ['PATCH', 'DELETE']);
    }

    if (method === 'PATCH') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ['PATCH', 'DELETE'],
        });
      }
      const status = sanitizeString(parsed.data.status);
      const allowedStatuses = ['Pending', 'In Review', 'Resolved', 'Action Taken'];
      if (!allowedStatuses.includes(status)) {
        return errorResponse(event, 400, 'Validation Error', 'Invalid status value.', {
          code: 'VALIDATION_ERROR',
          allowedMethods: ['PATCH', 'DELETE'],
        });
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Compliance request updates require Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['PATCH', 'DELETE']
        );
      }
      const updated = await repo.updateComplianceRequest(
        requestId,
        status,
        parsed.data.resolutionNotes !== undefined ? sanitizeString(parsed.data.resolutionNotes) : undefined
      );
      if (!updated) {
        return errorResponse(event, 404, 'Not Found', 'Compliance request not found.', {
          code: 'REQUEST_NOT_FOUND',
          allowedMethods: ['PATCH', 'DELETE'],
        });
      }
      return jsonResponse(event, 200, { success: true, request: updated }, ['PATCH', 'DELETE']);
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Compliance request deletion requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH', 'DELETE']
      );
    }
    const deleted = await repo.deleteComplianceRequest(requestId);
    if (!deleted) {
      return errorResponse(event, 404, 'Not Found', 'Compliance request not found.', {
        code: 'REQUEST_NOT_FOUND',
        allowedMethods: ['PATCH', 'DELETE'],
      });
    }
    return jsonResponse(event, 200, { success: true, message: 'Compliance request deleted.' }, ['PATCH', 'DELETE']);
  }

  return errorResponse(event, 404, 'Not Found', 'Admin content route not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
