/**
 * Netlify Function: courses
 * Routes:
 * - GET /api/courses
 * - GET /api/courses/:id
 */

import {
  normalizeCourseCategory,
  normalizeCourseStatus,
} from '../../src/services/courses/courseHelpers';
import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import { SERVERLESS_COURSES } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/courses', '/api/courses'];

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
    const onlyAvailable = params.onlyAvailable === 'true';
    const category = params.category ? params.category.trim() : '';
    const status = params.status ? params.status.trim() : '';
    const featuredParam = params.featured;
    const search = (params.search || '').trim();

    const filtered = repo
      ? await repo.getCourses({
          onlyAvailable,
          category: category || undefined,
          status: status || undefined,
          featured: featuredParam === 'true' ? true : featuredParam === 'false' ? false : undefined,
          search: search || undefined,
        })
      : SERVERLESS_COURSES.filter((c) => {
          const normalizedStatus = normalizeCourseStatus(c.status, c.availability);
          if (onlyAvailable && normalizedStatus !== 'available') return false;
          if (status && status !== 'all' && normalizedStatus !== status.toLowerCase()) return false;
          if (category && category !== 'all') {
            if (normalizeCourseCategory(c.category) !== normalizeCourseCategory(category)) {
              return false;
            }
          }
          if (featuredParam === 'true' && !c.featured) return false;
          if (featuredParam === 'false' && c.featured) return false;
          if (search) {
            const hay = [
              c.name,
              c.provider,
              c.instructor,
              c.category,
              c.description,
              ...c.curriculum,
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(search.toLowerCase())) return false;
          }
          return true;
        });

    const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
    const { items: paginatedCourses, pagination } = paginateArray(filtered, page, limit);

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
        courses: paginatedCourses,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const course = repo
      ? await repo.getCourseById(id)
      : SERVERLESS_COURSES.find((c) => c.id === id) || null;
    if (!course) {
      return errorResponse(event, 404, 'Not Found', 'Course not found.', {
        code: 'COURSE_NOT_FOUND',
        allowedMethods: ALLOWED_METHODS,
      });
    }
    return jsonResponse(
      event,
      200,
      {
        success: true,
        course,
      },
      ALLOWED_METHODS
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Course endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
