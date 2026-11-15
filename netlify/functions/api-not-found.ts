/**
 * Netlify Function: api-not-found
 * Catch-all JSON 404 handler for unknown /api/* routes so SPA HTML rewrite
 * never silently masks missing API endpoints with HTTP 200 HTML.
 */

import {
  errorResponse,
  getHeader,
  handleCorsPreflight,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const requestedPath =
    getHeader(event.headers, 'x-nf-original-path') || event.path || '/api/unknown';

  return errorResponse(
    event,
    404,
    'Not Found',
    `API endpoint '${requestedPath}' does not exist.`,
    {
      code: 'API_ROUTE_NOT_FOUND',
      details: { path: requestedPath },
      allowedMethods: ALLOWED_METHODS,
    }
  );
};
