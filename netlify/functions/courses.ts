/**
 * Netlify Function: courses
 * Routes:
 * - GET  /api/courses
 * - GET  /api/courses/categories
 * - POST /api/courses/submit
 * - GET  /api/courses/:id
 */

import {
  COURSE_CATEGORIES,
  classifyCoursePricing,
  isCourseExpired,
  normalizeCourseCategory,
  normalizeCourseProviderType,
  normalizeCourseStatus,
  validateCourseSubmissionPayload,
} from '../../src/services/courses/courseHelpers';
import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  serviceUnavailableResponse,
} from './_shared/http';
import { SERVERLESS_COURSES } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/courses', '/api/courses'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  if (subPath === 'categories') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    const categories = repo ? await repo.getCourseCategories() : [...COURSE_CATEGORIES];
    return jsonResponse(event, 200, { success: true, categories }, ['GET']);
  }

  if (subPath === 'submit') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['POST'],
      });
    }

    const validation = validateCourseSubmissionPayload(parsed.data);
    if (!validation.valid || !validation.sanitized) {
      return errorResponse(event, 400, 'Validation Error', validation.errors.join(' '), {
        code: 'INVALID_COURSE_SUBMISSION',
        allowedMethods: ['POST'],
      });
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course submissions require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const created = await repo.createCourse({
      ...validation.sanitized,
      providerType: 'third_party',
      approvalStatus: 'pending',
      isApproved: false,
      featured: false,
    });

    return jsonResponse(
      event,
      201,
      {
        success: true,
        status: 'pending',
        message: 'Course submitted for editorial review. It will appear publicly only after administrator approval.',
        course: created,
      },
      ['POST']
    );
  }

  if (method !== 'GET') {
    return methodNotAllowedResponse(event, ['GET']);
  }

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const onlyAvailable = params.onlyAvailable === 'true';
    const category = params.category ? params.category.trim() : '';
    const status = params.status ? params.status.trim() : '';
    const pricingType = params.pricingType ? params.pricingType.trim().toLowerCase() : '';
    const providerType = params.providerType ? params.providerType.trim().toLowerCase() : '';
    const includeExpired = params.includeExpired === 'false' ? false : true;
    const featuredParam = params.featured;
    const search = (params.search || '').trim();

    if (repo) {
      await repo.expirePastCourses().catch(() => {});
    }

    const filtered: any[] = repo
      ? await repo.getCourses({
          onlyApproved: true,
          onlyAvailable,
          category: category || undefined,
          status: status || undefined,
          pricingType: pricingType && pricingType !== 'all' ? pricingType : undefined,
          providerType: providerType && providerType !== 'all' ? providerType : undefined,
          includeExpired,
          featured: featuredParam === 'true' ? true : featuredParam === 'false' ? false : undefined,
          search: search || undefined,
        })
      : SERVERLESS_COURSES.filter((c) => {
          if (!c.isApproved || c.approvalStatus !== 'approved') return false;
          const expired = isCourseExpired({ registrationDeadline: c.registrationDeadline, isExpired: c.isExpired });
          const normalizedStatus = expired ? 'closed' : normalizeCourseStatus(c.status, c.availability);
          if (!includeExpired && expired) return false;
          if (onlyAvailable && normalizedStatus !== 'available') return false;
          if (status && status !== 'all' && normalizedStatus !== status.toLowerCase()) return false;
          if (pricingType && pricingType !== 'all') {
            if (classifyCoursePricing(c.fees, c.pricingType) !== pricingType) return false;
          }
          if (providerType && providerType !== 'all') {
            if (normalizeCourseProviderType(c.providerType) !== normalizeCourseProviderType(providerType)) return false;
          }
          if (category && category !== 'all') {
            if (
              c.category.toLowerCase() !== category.toLowerCase() &&
              normalizeCourseCategory(c.category) !== normalizeCourseCategory(category)
            ) {
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

    const categories = repo ? await repo.getCourseCategories() : [...COURSE_CATEGORIES];
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
        categories,
        persistentDbConfigured: Boolean(repo),
        courses: paginatedCourses,
      },
      ['GET']
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const course = repo
      ? await repo.getCourseById(id)
      : SERVERLESS_COURSES.find((c) => c.id === id) || null;
    if (!course || !course.isApproved || course.approvalStatus !== 'approved') {
      return errorResponse(event, 404, 'Not Found', 'Course not found.', {
        code: 'COURSE_NOT_FOUND',
        allowedMethods: ['GET'],
      });
    }
    return jsonResponse(
      event,
      200,
      {
        success: true,
        course,
      },
      ['GET']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Course endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
