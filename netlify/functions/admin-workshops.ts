/**
 * Netlify Function: admin-workshops
 * Routes:
 * - POST   /api/admin/workshops/upload-image
 * - POST   /api/admin/workshops/expire-scan
 * - POST   /api/admin/workshops
 * - PUT    /api/admin/workshops/:id
 * - PATCH  /api/admin/workshops/:id/status
 * - PATCH  /api/admin/workshops/:id/quick
 * - DELETE /api/admin/workshops/:id
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
import { SERVERLESS_WORKSHOPS } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { validateWorkshopRegistrationUrl } from '../../src/services/workshops/workshopHelpers';

const ALLOWED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-workshops', '/api/admin/workshops'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission: method === 'DELETE' ? 'workshops:delete' : 'workshops:write',
  });
  if (auth.authorized === false) return auth.response;

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  if (subPath === 'upload-image') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['POST'],
      });
    }

    const { dataUrl } = parsed.data;
    if (typeof dataUrl !== 'string') {
      return errorResponse(event, 400, 'Validation Error', 'Image data is required.', {
        code: 'MISSING_IMAGE_DATA',
        allowedMethods: ['POST'],
      });
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Unsupported image format. Please upload PNG, JPG, WEBP, or GIF.',
        { code: 'UNSUPPORTED_IMAGE_FORMAT', allowedMethods: ['POST'] }
      );
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return errorResponse(event, 400, 'Validation Error', 'Image must be 5 MB or smaller.', {
        code: 'IMAGE_TOO_LARGE',
        allowedMethods: ['POST'],
      });
    }

    return serviceUnavailableResponse(
      event,
      'Local disk uploads are unavailable in Netlify serverless functions. Provide a verified HTTPS image URL.',
      'PERSISTENT_STORAGE_NOT_CONFIGURED',
      ['POST']
    );
  }

  if (subPath === 'expire-scan') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop expiry scans require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const result = await repo.expirePastWorkshops();
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_WORKSHOPS_EXPIRE_SCAN',
      entityType: 'workshop',
      entityId: 'batch',
      details: result,
    }).catch(() => {});
    return jsonResponse(
      event,
      200,
      {
        success: true,
        expiredCount: result.expiredCount,
        expiredIds: result.expiredIds,
        message:
          result.expiredCount > 0
            ? `Marked ${result.expiredCount} past-date or past-deadline workshop(s) as expired/completed.`
            : 'All workshops are up to date.',
      },
      ['POST']
    );
  }

  if (!subPath) {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['POST'],
      });
    }

    const body = parsed.data;
    const name = sanitizeString(body.title || body.name);
    const organizer = sanitizeString(body.organizer || '');
    const instructor = sanitizeString(body.instructor || '');
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !registrationLink) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Workshop title and registrationUrl are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['POST'] }
      );
    }

    if (!organizer && !instructor) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Organizer or instructor information is required.',
        { code: 'MISSING_ORGANIZER', allowedMethods: ['POST'] }
      );
    }

    const urlCheck = validateWorkshopRegistrationUrl(registrationLink);
    if (!urlCheck.valid) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        urlCheck.reason || 'Invalid registration URL.',
        { code: 'INVALID_URL', allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop creation requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const workshop = await repo.createWorkshop({
      ...body,
      organizer,
      instructor,
      registrationUrl: urlCheck.normalizedUrl || registrationLink,
    });
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_WORKSHOP_CREATED',
      entityType: 'workshop',
      entityId: workshop.id,
      details: { name: workshop.name },
    }).catch(() => {});
    return jsonResponse(event, 201, { success: true, workshop }, ['POST']);
  }

  const segments = subPath.split('/').filter(Boolean);
  const workshopId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (segments.length > 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin workshop route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (action === 'status') {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(event, ['PATCH']);
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const rawStatus = sanitizeString(parsed.data.approvalStatus || parsed.data.status).toLowerCase();
    if (rawStatus !== 'approved' && rawStatus !== 'rejected' && rawStatus !== 'pending') {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'approvalStatus must be one of: approved, rejected, pending.',
        { code: 'INVALID_APPROVAL_STATUS', allowedMethods: ['PATCH'] }
      );
    }
    const existing = repo
      ? await repo.getWorkshopById(workshopId)
      : SERVERLESS_WORKSHOPS.find((w) => w.id === workshopId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
        code: 'WORKSHOP_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop approval updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH']
      );
    }
    const workshop = await repo.updateWorkshop(workshopId, { approvalStatus: rawStatus });
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_WORKSHOP_APPROVAL_UPDATED',
      entityType: 'workshop',
      entityId: workshopId,
      details: { approvalStatus: rawStatus },
    }).catch(() => {});
    return jsonResponse(event, 200, { success: true, workshop }, ['PATCH']);
  }

  if (action === 'quick') {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(event, ['PATCH']);
    }
    const existing = repo
      ? await repo.getWorkshopById(workshopId)
      : SERVERLESS_WORKSHOPS.find((w) => w.id === workshopId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
        code: 'WORKSHOP_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop quick updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH']
      );
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const workshop = await repo.updateWorkshop(workshopId, parsed.data);
    return jsonResponse(event, 200, { success: true, workshop }, ['PATCH']);
  }

  if (action) {
    return errorResponse(event, 404, 'Not Found', 'Admin workshop route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method !== 'PUT' && method !== 'DELETE') {
    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  const existing = repo
    ? await repo.getWorkshopById(workshopId)
    : SERVERLESS_WORKSHOPS.find((w) => w.id === workshopId) || null;
  if (!existing) {
    return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
      code: 'WORKSHOP_NOT_FOUND',
      allowedMethods: ['PUT', 'DELETE'],
    });
  }

  if (method === 'PUT') {
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['PUT', 'DELETE'],
      });
    }
    const regUrl = sanitizeString(parsed.data.registrationUrl || parsed.data.registrationLink);
    if (regUrl) {
      const urlCheck = validateWorkshopRegistrationUrl(regUrl);
      if (!urlCheck.valid) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          urlCheck.reason || 'Invalid registration URL.',
          { code: 'INVALID_URL', allowedMethods: ['PUT', 'DELETE'] }
        );
      }
      parsed.data.registrationUrl = urlCheck.normalizedUrl || regUrl;
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop modifications require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PUT', 'DELETE']
      );
    }
    const workshop = await repo.updateWorkshop(workshopId, parsed.data);
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_WORKSHOP_UPDATED',
      entityType: 'workshop',
      entityId: workshopId,
    }).catch(() => {});
    return jsonResponse(event, 200, { success: true, workshop }, ['PUT', 'DELETE']);
  }

  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Persistent workshop deletions require Supabase PostgreSQL configuration.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PUT', 'DELETE']
    );
  }
  await repo.deleteWorkshop(workshopId);
  await repo.recordAdminAuditLog({
    adminUserId: auth.user.id,
    actorUsername: auth.user.username,
    action: 'ADMIN_WORKSHOP_DELETED',
    entityType: 'workshop',
    entityId: workshopId,
  }).catch(() => {});
  return jsonResponse(event, 200, { success: true, message: 'Workshop deleted.' }, ['PUT', 'DELETE']);
};
