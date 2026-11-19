/**
 * Netlify Function: internships
 * Routes:
 * - GET /api/internships
 * - GET /api/internships/:id
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
import { SERVERLESS_INTERNSHIPS } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/internships', '/api/internships'];

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
    const search = (params.search || '').trim();
    const category = (params.category || '').trim();
    const mode = (params.mode || '').trim();

    const filtered = repo
      ? await repo.getInternships({
          search: search || undefined,
          category: category && category !== 'all' ? category : undefined,
          mode: mode && mode !== 'all' ? mode : undefined,
          onlyActive: true,
          onlyApproved: true,
        })
      : SERVERLESS_INTERNSHIPS.filter((intern) => {
          if (!intern.isActive || !intern.isApproved) return false;
          if (category && category.toLowerCase() !== 'all' && intern.category.toLowerCase() !== category.toLowerCase()) {
            return false;
          }
          if (mode && mode.toLowerCase() !== 'all' && !intern.mode.toLowerCase().includes(mode.toLowerCase())) {
            return false;
          }
          if (search) {
            const hay = [
              intern.title,
              intern.organization,
              intern.description,
              intern.location,
              ...intern.skillsRequired,
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(search.toLowerCase())) return false;
          }
          return true;
        });

    const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
    const { items: paginatedInternships, pagination } = paginateArray(filtered, page, limit);

    return jsonResponse(
      event,
      200,
      {
        success: true,
        count: paginatedInternships.length,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages,
        pagination,
        persistentDbConfigured: Boolean(repo),
        internships: paginatedInternships,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const internship = repo
      ? await repo.getInternshipById(id)
      : SERVERLESS_INTERNSHIPS.find((i) => i.id === id) || null;
    if (!internship || !internship.isActive || !internship.isApproved) {
      return errorResponse(event, 404, 'Not Found', 'Internship listing not found.', {
        code: 'INTERNSHIP_NOT_FOUND',
        allowedMethods: ALLOWED_METHODS,
      });
    }
    return jsonResponse(event, 200, { success: true, internship }, ALLOWED_METHODS);
  }

  return errorResponse(event, 404, 'Not Found', 'Internship endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
