/**
 * Netlify Function: workshops
 * Routes:
 * - GET /api/workshops
 * - GET /api/workshops/:id
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import { SERVERLESS_WORKSHOPS } from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/workshops', '/api/workshops'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const status = (params.status || '').trim().toLowerCase();
    const format = (params.format || '').trim().toLowerCase();
    const featuredParam = params.featured;
    const search = (params.search || '').trim().toLowerCase();

    const filtered = SERVERLESS_WORKSHOPS.filter((ws) => {
      if (status && status !== 'all' && ws.status.toLowerCase() !== status) {
        return false;
      }
      if (format && format !== 'all' && ws.format.toLowerCase() !== format) {
        return false;
      }
      if (featuredParam === 'true' && !ws.featured) return false;
      if (featuredParam === 'false' && ws.featured) return false;
      if (search) {
        const hay = [
          ws.name,
          ws.description,
          ws.instructor,
          ws.venue,
          ...ws.skillsCovered,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return jsonResponse(
      event,
      200,
      {
        success: true,
        count: filtered.length,
        workshops: filtered,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const workshop = SERVERLESS_WORKSHOPS.find((w) => w.id === id);
    if (!workshop) {
      return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
        code: 'WORKSHOP_NOT_FOUND',
        allowedMethods: ALLOWED_METHODS,
      });
    }
    return jsonResponse(
      event,
      200,
      {
        success: true,
        workshop,
      },
      ALLOWED_METHODS
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Workshop endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
