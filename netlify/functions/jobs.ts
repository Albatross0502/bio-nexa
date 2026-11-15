/**
 * Netlify Function: jobs
 * Routes:
 * - GET  /api/jobs
 * - GET  /api/jobs/:id
 * - POST /api/jobs/submit
 * - POST /api/jobs/:id/report
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
import { SERVERLESS_JOBS } from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/jobs', '/api/jobs'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (method === 'GET') {
    if (!subPath) {
      const params = event.queryStringParameters || {};
      const search = (params.search || '').trim().toLowerCase();
      const sector = (params.sector || '').trim().toLowerCase();
      const location = (params.location || '').trim().toLowerCase();

      const filtered = SERVERLESS_JOBS.filter((job) => {
        if (!job.isActive || !job.isApproved) return false;
        if (sector && sector !== 'all' && !job.sector.toLowerCase().includes(sector)) {
          return false;
        }
        if (location && location !== 'all' && !job.location.toLowerCase().includes(location)) {
          return false;
        }
        if (search) {
          const hay = [
            job.title,
            job.employer,
            job.description,
            job.location,
            job.sector,
            ...job.skills,
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
          jobs: filtered,
        },
        ALLOWED_METHODS
      );
    }

    if (!subPath.includes('/')) {
      const id = decodeURIComponent(subPath);
      const job = SERVERLESS_JOBS.find((j) => j.id === id);
      if (!job) {
        return errorResponse(event, 404, 'Not Found', 'Job opening not found.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      const verifications = job.lastVerificationDate
        ? [
            {
              id: `ver-${job.id}`,
              jobId: job.id,
              verifiedBy: 'BIO-INEXA Operations Audit',
              verifiedAt: job.lastVerificationDate,
              sourceStatus: job.verificationStatus,
              notes: job.verificationNotes || 'Verified against official source portal.',
            },
          ]
        : [];

      return jsonResponse(
        event,
        200,
        {
          success: true,
          job,
          verifications,
        },
        ALLOWED_METHODS
      );
    }

    return errorResponse(event, 404, 'Not Found', 'Job endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method === 'POST') {
    if (subPath === 'submit') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      const body = parsed.data;
      const title = sanitizeString(body.title);
      const employer = sanitizeString(body.employer || body.company);
      const applicationUrl = sanitizeString(body.applicationUrl);
      const description = sanitizeString(body.description);
      const location = sanitizeString(body.location);

      if (!title || !employer || !applicationUrl || !description || !location) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Required fields missing: title, employer/company, applicationUrl, description, location.',
          { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ALLOWED_METHODS }
        );
      }

      if (!isValidHttpUrl(applicationUrl)) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Invalid applicationUrl: Must be a valid URL starting with http:// or https://',
          { code: 'INVALID_URL', allowedMethods: ALLOWED_METHODS }
        );
      }

      return serviceUnavailableResponse(
        event,
        'Public job submission persistence is not yet connected in serverless production. Persistent cloud database integration is required before accepting live submissions.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ALLOWED_METHODS
      );
    }

    if (subPath.endsWith('/report') && subPath.length > '/report'.length) {
      const jobId = decodeURIComponent(subPath.slice(0, -'/report'.length));
      const job = SERVERLESS_JOBS.find((j) => j.id === jobId);
      if (!job) {
        return errorResponse(event, 404, 'Not Found', 'Job listing not found.', {
          code: 'JOB_NOT_FOUND',
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

      return serviceUnavailableResponse(
        event,
        'Listing report persistence is not yet connected in serverless production. Please check Grievance & Contact details or retry once cloud storage is active.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ALLOWED_METHODS
      );
    }

    return errorResponse(event, 404, 'Not Found', 'Job POST endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  return methodNotAllowedResponse(event, ALLOWED_METHODS);
};
