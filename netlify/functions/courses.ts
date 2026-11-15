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

const ALLOWED_METHODS = ['GET'];
const BASE_PREFIXES = ['/.netlify/functions/courses', '/api/courses'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const onlyAvailable = params.onlyAvailable === 'true';
    const category = params.category ? params.category.trim() : '';
    const status = params.status ? params.status.trim() : '';
    const featuredParam = params.featured;
    const search = (params.search || '').trim().toLowerCase();

    const filtered = SERVERLESS_COURSES.filter((c) => {
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
        courses: filtered,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const course = SERVERLESS_COURSES.find((c) => c.id === id);
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
