/**
 * Netlify Function: admin-courses
 * Routes:
 * - POST   /api/admin/courses/upload-image
 * - POST   /api/admin/courses
 * - PUT    /api/admin/courses/:id
 * - PATCH  /api/admin/courses/:id/quick
 * - DELETE /api/admin/courses/:id
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  isValidHttpUrl,
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

const ALLOWED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-courses', '/api/admin/courses'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission: method === 'DELETE' ? 'courses:delete' : 'courses:write',
  });
  if (auth.authorized === false) return auth.response;

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

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
    const provider = sanitizeString(body.provider || body.instructor);
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !provider || !registrationLink) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Course title, provider/institution, and official registration URL are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['POST'] }
      );
    }

    if (!isValidHttpUrl(registrationLink)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Official registration URL must start with http:// or https://',
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

    const course = await repo.createCourse(body);
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_COURSE_CREATED',
      entityType: 'course',
      entityId: course.id,
      details: { name: course.name },
    }).catch(() => {});
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
    if (regUrl && !isValidHttpUrl(regUrl)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Registration URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['PATCH'] }
      );
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
    const regUrl = sanitizeString(parsed.data.registrationUrl || parsed.data.registrationLink);
    if (regUrl && !isValidHttpUrl(regUrl)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Official registration URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['PUT', 'DELETE'] }
      );
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
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_COURSE_UPDATED',
      entityType: 'course',
      entityId: courseId,
    }).catch(() => {});
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
  await repo.recordAdminAuditLog({
    adminUserId: auth.user.id,
    actorUsername: auth.user.username,
    action: 'ADMIN_COURSE_DELETED',
    entityType: 'course',
    entityId: courseId,
  }).catch(() => {});
  return jsonResponse(event, 200, { success: true, message: 'Course deleted.' }, ['PUT', 'DELETE']);
};
