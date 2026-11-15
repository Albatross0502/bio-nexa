/**
 * Netlify Function: admin-workshops
 * Routes:
 * - POST   /api/admin/workshops/upload-image
 * - POST   /api/admin/workshops
 * - PUT    /api/admin/workshops/:id
 * - PATCH  /api/admin/workshops/:id/quick
 * - DELETE /api/admin/workshops/:id
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
import { SERVERLESS_WORKSHOPS } from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-workshops', '/api/admin/workshops'];

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
      'Local disk uploads are unavailable in Netlify serverless functions. Configure cloud object storage or provide a verified HTTPS image URL.',
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
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !registrationLink) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Workshop title and registrationUrl are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['POST'] }
      );
    }

    if (!isValidHttpUrl(registrationLink)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Registration URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['POST'] }
      );
    }

    return serviceUnavailableResponse(
      event,
      'Persistent workshop creation requires cloud database configuration (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['POST']
    );
  }

  const segments = subPath.split('/').filter(Boolean);
  const workshopId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (segments.length > 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin workshop route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (action === 'quick') {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(event, ['PATCH']);
    }
    const existing = SERVERLESS_WORKSHOPS.find((w) => w.id === workshopId);
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
        code: 'WORKSHOP_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    return serviceUnavailableResponse(
      event,
      'Persistent workshop quick updates require cloud database configuration (Phase 04).',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PATCH']
    );
  }

  if (action) {
    return errorResponse(event, 404, 'Not Found', 'Admin workshop route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method !== 'PUT' && method !== 'DELETE') {
    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  const existing = SERVERLESS_WORKSHOPS.find((w) => w.id === workshopId);
  if (!existing) {
    return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
      code: 'WORKSHOP_NOT_FOUND',
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
        'Registration URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['PUT', 'DELETE'] }
      );
    }
  }

  return serviceUnavailableResponse(
    event,
    'Persistent workshop modifications require cloud database configuration (Phase 04).',
    'PERSISTENT_DB_NOT_CONFIGURED',
    ['PUT', 'DELETE']
  );
};
