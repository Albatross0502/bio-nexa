/**
 * Netlify Function: admin-jobs
 * Routes:
 * - POST   /api/admin/jobs
 * - PUT    /api/admin/jobs/:id
 * - DELETE /api/admin/jobs/:id
 * - PATCH  /api/admin/jobs/:id/status
 * - PUT    /api/admin/jobs/:id/status
 * - POST   /api/admin/jobs/:id/verify
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  isValidHttpUrl,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuth } from './_shared/serverlessAuth';
import { SERVERLESS_JOBS } from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-jobs', '/api/admin/jobs'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = requireServerlessAdminAuth(event, ALLOWED_METHODS);
  if (auth.authorized === false) return auth.response;

  const subPath = extractSubPath(event, BASE_PREFIXES);

  // POST /api/admin/jobs
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
    const title = sanitizeString(body.title);
    const employer = sanitizeString(body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);

    if (!title || !employer || !applicationUrl) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Title, company/employer, and applicationUrl are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['POST'] }
      );
    }

    if (!isValidHttpUrl(applicationUrl)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Application URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['POST'] }
      );
    }

    return serviceUnavailableResponse(
      event,
      'Persistent job database writes are not yet connected in serverless production. Configure cloud database persistence (Phase 04) to save new job openings.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['POST']
    );
  }

  const segments = subPath.split('/').filter(Boolean);
  const jobId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (segments.length > 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin job route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (action === 'status') {
    if (method !== 'PATCH' && method !== 'PUT') {
      return methodNotAllowedResponse(event, ['PATCH', 'PUT']);
    }
    const existing = SERVERLESS_JOBS.find((j) => j.id === jobId);
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Job opening not found.', {
        code: 'JOB_NOT_FOUND',
        allowedMethods: ['PATCH', 'PUT'],
      });
    }
    return serviceUnavailableResponse(
      event,
      'Persistent job status updates require cloud database configuration (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PATCH', 'PUT']
    );
  }

  if (action === 'verify') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    const existing = SERVERLESS_JOBS.find((j) => j.id === jobId);
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Job not found.', {
        code: 'JOB_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    return serviceUnavailableResponse(
      event,
      'Job verification audit logging requires cloud database configuration (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['POST']
    );
  }

  if (action) {
    return errorResponse(event, 404, 'Not Found', 'Admin job route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  // PUT or DELETE /api/admin/jobs/:id
  if (method !== 'PUT' && method !== 'DELETE') {
    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  const existing = SERVERLESS_JOBS.find((j) => j.id === jobId);
  if (!existing) {
    return errorResponse(event, 404, 'Not Found', 'Job opening not found.', {
      code: 'JOB_NOT_FOUND',
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
    if (parsed.data.applicationUrl && !isValidHttpUrl(sanitizeString(parsed.data.applicationUrl))) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Application URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['PUT', 'DELETE'] }
      );
    }
  }

  return serviceUnavailableResponse(
    event,
    'Persistent job modifications require cloud database configuration (Phase 04).',
    'PERSISTENT_DB_NOT_CONFIGURED',
    ['PUT', 'DELETE']
  );
};
