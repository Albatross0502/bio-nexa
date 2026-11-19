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
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/workshops', '/api/workshops'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const status = (params.status || '').trim();
    const format = (params.format || '').trim();
    const featuredParam = params.featured;
    const search = (params.search || '').trim();

    const filtered = repo
      ? await repo.getWorkshops({
          status: status || undefined,
          format: format || undefined,
          featured: featuredParam === 'true' ? true : featuredParam === 'false' ? false : undefined,
          search: search || undefined,
        })
      : SERVERLESS_WORKSHOPS.filter((ws) => {
          if (status && status.toLowerCase() !== 'all' && ws.status.toLowerCase() !== status.toLowerCase()) {
            return false;
          }
          if (format && format.toLowerCase() !== 'all' && ws.format.toLowerCase() !== format.toLowerCase()) {
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
            if (!hay.includes(search.toLowerCase())) return false;
          }
          return true;
        });

    const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
    const { items: paginatedWorkshops, pagination } = paginateArray(filtered, page, limit);

    return jsonResponse(
      event,
      200,
      {
        success: true,
        count: filtered.length,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages,
        pagination,
        persistentDbConfigured: Boolean(repo),
        workshops: paginatedWorkshops,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const workshop = repo
      ? await repo.getWorkshopById(id)
      : SERVERLESS_WORKSHOPS.find((w) => w.id === id) || null;
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
