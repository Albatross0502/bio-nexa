/**
 * Netlify Function: admin-courses
 * Routes:
 * - GET    /api/admin/courses/categories
 * - POST   /api/admin/courses/categories
 * - DELETE /api/admin/courses/categories/:name
 * - POST   /api/admin/courses/expire-scan
 * - POST   /api/admin/courses/upload-image
 * - POST   /api/admin/courses
 * - PUT    /api/admin/courses/:id
 * - PATCH  /api/admin/courses/:id/status
 * - PATCH  /api/admin/courses/:id/quick
 * - DELETE /api/admin/courses/:id
 */

import {
  COURSE_CATEGORIES,
  classifyCoursePricing,
  normalizeCourseApprovalStatus,
  normalizeCourseProviderType,
  validateCourseRegistrationUrl,
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
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import { SERVERLESS_COURSES } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-courses', '/api/admin/courses'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission:
      method === 'GET'
        ? 'dashboard:read'
        : method === 'DELETE' && !subPath.startsWith('categories/')
        ? 'courses:delete'
        : 'courses:write',
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();

  if (subPath === 'categories') {
    const coreSet = new Set(COURSE_CATEGORIES.map((c) => c.toLowerCase()));
    const formatCats = (cats: string[]) => ({
      categories: cats,
      coreCategories: [...COURSE_CATEGORIES],
      customCategories: cats.filter((c) => !coreSet.has(c.toLowerCase())),
    });

    if (method === 'GET') {
      const categories = repo ? await repo.getCourseCategories() : [...COURSE_CATEGORIES];
      return jsonResponse(event, 200, { success: true, ...formatCats(categories) }, ['GET', 'POST']);
    }
    if (method === 'POST') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ['GET', 'POST'],
        });
      }
      const name = sanitizeString(parsed.data.name || parsed.data.category);
      if (name.length < 2 || name.length > 64) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Category name must be between 2 and 64 characters.',
          { code: 'INVALID_CATEGORY_NAME', allowedMethods: ['GET', 'POST'] }
        );
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Persistent course category updates require Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['GET', 'POST']
        );
      }
      const categories = await repo.addCourseCategory(name, auth.user.username);
      return jsonResponse(
        event,
        201,
        { success: true, ...formatCats(categories), message: `Added course category "${name}".` },
        ['GET', 'POST']
      );
    }
    return methodNotAllowedResponse(event, ['GET', 'POST']);
  }

  if (subPath.startsWith('categories/')) {
    if (method !== 'DELETE') {
      return methodNotAllowedResponse(event, ['DELETE']);
    }
    const name = decodeURIComponent(subPath.slice('categories/'.length));
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course category updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['DELETE']
      );
    }
    const result = await repo.removeCourseCategory(name, auth.user.username);
    if (!result.removed) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Core default course categories cannot be removed, or the category was not found.',
        { code: 'CATEGORY_DELETE_FAILED', allowedMethods: ['DELETE'] }
      );
    }
    const coreSet = new Set(COURSE_CATEGORIES.map((c) => c.toLowerCase()));
    return jsonResponse(
      event,
      200,
      {
        success: true,
        categories: result.categories,
        coreCategories: [...COURSE_CATEGORIES],
        customCategories: result.categories.filter((c) => !coreSet.has(c.toLowerCase())),
        message: `Removed course category "${name}".`,
      },
      ['DELETE']
    );
  }

  if (subPath === 'expire-scan') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course expiry scans require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const result = await repo.expirePastCourses();
    return jsonResponse(
      event,
      200,
      {
        success: true,
        expiredCount: result.expiredCount,
        expiredIds: result.expiredIds,
        message:
          result.expiredCount > 0
            ? `Marked ${result.expiredCount} expired course${result.expiredCount === 1 ? '' : 's'} as closed.`
            : 'All open courses have valid or rolling deadlines.',
      },
      ['POST']
    );
  }

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
    const provider = sanitizeString(body.provider);
    const description = sanitizeString(body.description);
    const duration = sanitizeString(body.duration);
    const fees = sanitizeString(body.fees ?? body.price);
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !provider || !description || !duration || !fees || !registrationLink) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Course title, provider/institution, description, duration, fees, and official enrollment URL are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['POST'] }
      );
    }

    const urlCheck = validateCourseRegistrationUrl(registrationLink);
    if (!urlCheck.valid) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        urlCheck.reason || 'Official registration URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course creation requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const course = await repo.createCourse({
      ...body,
      title: name,
      name,
      provider,
      providerType: normalizeCourseProviderType(body.providerType),
      description,
      duration,
      fees,
      pricingType: classifyCoursePricing(fees, body.pricingType),
      registrationUrl: urlCheck.normalizedUrl,
      registrationLink: urlCheck.normalizedUrl,
      approvalStatus: normalizeCourseApprovalStatus(body.approvalStatus || 'approved', body.isApproved),
    });
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_COURSE_CREATED',
        entityType: 'course',
        entityId: course.id,
        details: { name: course.name, providerType: course.providerType, pricingType: course.pricingType },
      })
      .catch(() => {});
    return jsonResponse(event, 201, { success: true, course }, ['POST']);
  }

  const segments = subPath.split('/').filter(Boolean);
  const courseId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (segments.length > 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin course route not found.', {
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
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['PATCH'],
      });
    }
    const rawStatus = sanitizeString(parsed.data.approvalStatus || parsed.data.status).toLowerCase();
    if (!['approved', 'rejected', 'pending'].includes(rawStatus)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'approvalStatus must be one of: approved, rejected, pending.',
        { code: 'INVALID_APPROVAL_STATUS', allowedMethods: ['PATCH'] }
      );
    }
    const existing = repo
      ? await repo.getCourseById(courseId)
      : SERVERLESS_COURSES.find((c) => c.id === courseId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Course not found.', {
        code: 'COURSE_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course approval updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH']
      );
    }
    const nextApproval = normalizeCourseApprovalStatus(rawStatus);
    const course = await repo.updateCourse(courseId, {
      approvalStatus: nextApproval,
      isApproved: nextApproval === 'approved',
      ...(nextApproval !== 'approved' ? { featured: false } : {}),
    });
    return jsonResponse(event, 200, { success: true, course }, ['PATCH']);
  }

  if (action === 'quick') {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(event, ['PATCH']);
    }
    const existing = repo
      ? await repo.getCourseById(courseId)
      : SERVERLESS_COURSES.find((c) => c.id === courseId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Course not found.', {
        code: 'COURSE_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['PATCH'],
      });
    }
    const regUrl = sanitizeString(parsed.data.registrationUrl || parsed.data.registrationLink);
    if (regUrl) {
      const urlCheck = validateCourseRegistrationUrl(regUrl);
      if (!urlCheck.valid) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          urlCheck.reason || 'Registration URL must start with http:// or https://',
          { code: 'INVALID_URL', allowedMethods: ['PATCH'] }
        );
      }
      parsed.data.registrationUrl = urlCheck.normalizedUrl;
      parsed.data.registrationLink = urlCheck.normalizedUrl;
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course quick updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH']
      );
    }
    const course = await repo.updateCourse(courseId, parsed.data);
    return jsonResponse(event, 200, { success: true, course }, ['PATCH']);
  }

  if (action) {
    return errorResponse(event, 404, 'Not Found', 'Admin course route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method !== 'PUT' && method !== 'DELETE') {
    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  const existing = repo
    ? await repo.getCourseById(courseId)
    : SERVERLESS_COURSES.find((c) => c.id === courseId) || null;
  if (!existing) {
    return errorResponse(event, 404, 'Not Found', 'Course not found.', {
      code: 'COURSE_NOT_FOUND',
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
    const regUrl = sanitizeString(parsed.data.registrationUrl ?? parsed.data.registrationLink);
    if (parsed.data.registrationUrl !== undefined || parsed.data.registrationLink !== undefined) {
      const urlCheck = validateCourseRegistrationUrl(regUrl);
      if (!urlCheck.valid) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          urlCheck.reason || 'Official registration URL must start with http:// or https://',
          { code: 'INVALID_URL', allowedMethods: ['PUT', 'DELETE'] }
        );
      }
      parsed.data.registrationUrl = urlCheck.normalizedUrl;
      parsed.data.registrationLink = urlCheck.normalizedUrl;
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent course modifications require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PUT', 'DELETE']
      );
    }
    const course = await repo.updateCourse(courseId, parsed.data);
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_COURSE_UPDATED',
        entityType: 'course',
        entityId: courseId,
      })
      .catch(() => {});
    return jsonResponse(event, 200, { success: true, course }, ['PUT', 'DELETE']);
  }

  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Persistent course deletions require Supabase PostgreSQL configuration.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PUT', 'DELETE']
    );
  }
  await repo.deleteCourse(courseId);
  await repo
    .recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_COURSE_DELETED',
      entityType: 'course',
      entityId: courseId,
    })
    .catch(() => {});
  return jsonResponse(event, 200, { success: true, message: 'Course deleted.' }, ['PUT', 'DELETE']);
};
