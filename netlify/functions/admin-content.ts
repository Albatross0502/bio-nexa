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
import { requireServerlessAdminAuth } from './_shared/serverlessAuth';
import {
  SERVERLESS_ANNOUNCEMENTS,
  SERVERLESS_HOMEPAGE_HIGHLIGHTS,
} from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-content', '/api/admin'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = requireServerlessAdminAuth(event, ALLOWED_METHODS);
  if (auth.authorized === false) return auth.response;

  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (subPath === 'content' || subPath === '') {
    if (method === 'GET') {
      return jsonResponse(
        event,
        200,
        {
          announcements: SERVERLESS_ANNOUNCEMENTS.map((a) => ({
            id: a.id,
            title: a.title,
            tag: a.tag,
            date: a.date,
            link: a.link,
            active: a.isActive,
          })),
          homepageHighlights: SERVERLESS_HOMEPAGE_HIGHLIGHTS,
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
      return serviceUnavailableResponse(
        event,
        'Persistent website content updates require cloud database configuration (Phase 04).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET', 'PUT']
      );
    }

    return methodNotAllowedResponse(event, ['GET', 'PUT']);
  }

  if (subPath === 'backups') {
    if (method !== 'GET' && method !== 'POST') {
      return methodNotAllowedResponse(event, ['GET', 'POST']);
    }

    return serviceUnavailableResponse(
      event,
      'Local SQLite file backups are not available in Netlify serverless production. Configure cloud database backups/snapshots (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
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
      return serviceUnavailableResponse(
        event,
        'Compliance request inbox requires cloud database configuration (Phase 04).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET']
      );
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
    }

    return serviceUnavailableResponse(
      event,
      'Compliance request updates require cloud database configuration (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PATCH', 'DELETE']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Admin content route not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
