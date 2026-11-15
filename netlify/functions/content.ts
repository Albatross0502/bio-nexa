/**
 * Netlify Function: content
 * Routes:
 * - GET /api/announcements
 * - GET /api/content/homepage
 */

import {
  errorResponse,
  extractSubPath,
  getHeader,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import {
  SERVERLESS_ANNOUNCEMENTS,
  SERVERLESS_HOMEPAGE_HIGHLIGHTS,
} from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/content', '/api/content', '/api'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const originalPath = (getHeader(event.headers, 'x-nf-original-path') || event.path || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (originalPath === '/api/announcements' || subPath === 'announcements') {
    const activeAnnouncements = SERVERLESS_ANNOUNCEMENTS.filter((a) => a.isActive);
    return jsonResponse(
      event,
      200,
      {
        success: true,
        count: activeAnnouncements.length,
        announcements: activeAnnouncements,
      },
      ALLOWED_METHODS
    );
  }

  if (
    originalPath === '/api/content/homepage' ||
    subPath === 'homepage' ||
    subPath === 'content/homepage'
  ) {
    return jsonResponse(
      event,
      200,
      {
        success: true,
        highlights: SERVERLESS_HOMEPAGE_HIGHLIGHTS,
      },
      ALLOWED_METHODS
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Content endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
