/**
 * Netlify Function: compliance
 * Route:
 * - POST /api/compliance/request
 */

import {
  normalizeComplianceRequestType,
  validateComplianceRequest,
} from '../../src/services/legal/legalCompliance';
import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';

const ALLOWED_METHODS = ['POST'];
const BASE_PREFIXES = ['/.netlify/functions/compliance', '/api/compliance'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'POST') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  if (subPath && subPath !== 'request') {
    return errorResponse(event, 404, 'Not Found', 'Compliance endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  const parsed = parseJsonBody(event);
  if (!parsed.ok) {
    return errorResponse(event, 400, 'Validation Error', parsed.message, {
      code: 'INVALID_JSON',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  const body = parsed.data;
  const requestType = normalizeComplianceRequestType(body.requestType);
  const input = {
    requestType,
    subCategory: sanitizeString(body.subCategory),
    requesterName: sanitizeString(body.requesterName),
    requesterEmail: sanitizeString(body.requesterEmail),
    organization: sanitizeString(body.organization),
    targetTitleOrUrl: sanitizeString(body.targetTitleOrUrl),
    details: sanitizeString(body.details),
    consentAccepted: Boolean(body.consentAccepted),
  };

  const validation = validateComplianceRequest(input);
  if (!validation.valid) {
    return errorResponse(
      event,
      400,
      'Validation Error',
      validation.error || 'Invalid compliance request submission.',
      { code: 'VALIDATION_ERROR', allowedMethods: ALLOWED_METHODS }
    );
  }

  return serviceUnavailableResponse(
    event,
    'Compliance and grievance request storage is not yet provisioned in serverless production. Persistent database storage (Phase 04) is required to record submissions reliably.',
    'PERSISTENT_DB_NOT_CONFIGURED',
    ALLOWED_METHODS
  );
};
