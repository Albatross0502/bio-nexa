/**
 * Netlify Function: internships
 * Routes:
 * - GET  /api/internships (supports search, category, location, mode, compensation/paid, includeExpired, page, limit)
 * - POST /api/internships/submit (public submission -> strictly Pending Verification in Supabase DB)
 * - GET  /api/internships/:id
 */

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
import { SERVERLESS_INTERNSHIPS } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';
import {
  classifyInternshipCompensation,
  isInternshipDeadlineExpired,
  matchesInternshipModeFilter,
  validateInternshipSubmissionPayload,
} from '../../src/services/internships/internshipHelpers';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/internships', '/api/internships'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  // POST /api/internships/submit -> strictly Pending Verification
  if (subPath === 'submit') {
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
    const validation = validateInternshipSubmissionPayload(parsed.data);
    if (!validation.valid || !validation.sanitized) {
      return errorResponse(event, 400, 'Validation Error', validation.errors.join(' '), {
        code: 'INVALID_INTERNSHIP_SUBMISSION',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Internship submissions require shared cloud database configuration (Supabase PostgreSQL).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const s = validation.sanitized;
    const created = await repo.createInternship({
      title: sanitizeString(s.title),
      organization: sanitizeString(s.organization),
      location: sanitizeString(s.location),
      workMode: s.workMode,
      stipend: sanitizeString(s.stipend),
      duration: sanitizeString(s.duration),
      deadline: sanitizeString(s.deadline),
      category: s.category,
      eligibility: sanitizeString(s.eligibility),
      description: sanitizeString(s.description),
      skillsRequired: s.skillsRequired.map((k) => sanitizeString(k)),
      sourceName: sanitizeString(s.sourceName),
      sourceUrl: s.sourceUrl,
      applicationUrl: s.applicationUrl,
      verificationStatus: 'Pending Verification',
      verificationNotes: 'Submitted via public Internship Portal — awaiting administrator URL & institution audit.',
      lastVerificationDate: '',
      isApproved: false,
      isActive: true,
      featured: false,
    });

    return jsonResponse(
      event,
      201,
      {
        success: true,
        message: 'Internship submitted for administrator verification. It will appear publicly only after official URL and eligibility review.',
        internship: created,
      },
      ['POST']
    );
  }

  if (method !== 'GET') {
    return methodNotAllowedResponse(event, ['GET']);
  }

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const search = (params.search || '').trim();
    const category = (params.category || '').trim();
    const location = (params.location || '').trim();
    const mode = (params.mode || '').trim();
    const compensation = (params.compensation || '').trim().toLowerCase();
    const paid = (params.paid || '').trim().toLowerCase();
    const compFilter =
      compensation && compensation !== 'all'
        ? compensation
        : paid === 'true'
        ? 'paid'
        : paid === 'false'
        ? 'unpaid'
        : undefined;
    const includeExpired = params.includeExpired === 'true' || params.includeExpired === '1';

    const filtered = repo
      ? await repo.getInternships({
          search: search || undefined,
          category: category && category !== 'all' ? category : undefined,
          location: location && location !== 'all' ? location : undefined,
          mode: mode && mode !== 'all' ? mode : undefined,
          compensation: compFilter,
          includeExpired,
          onlyActive: !includeExpired,
          onlyApproved: true,
        })
      : SERVERLESS_INTERNSHIPS.map((intern) => {
          const comp = classifyInternshipCompensation(intern.stipend);
          const expired = !intern.isActive || isInternshipDeadlineExpired(intern.deadline);
          return {
            ...intern,
            compensationType: comp,
            isPaid: comp === 'paid',
            isExpired: expired,
          };
        }).filter((intern) => {
          if (!intern.isApproved) return false;
          if (!includeExpired && intern.isExpired) return false;
          if (category && category.toLowerCase() !== 'all' && intern.category.toLowerCase() !== category.toLowerCase()) {
            return false;
          }
          if (location && location.toLowerCase() !== 'all' && !intern.location.toLowerCase().includes(location.toLowerCase())) {
            return false;
          }
          if (mode && !matchesInternshipModeFilter(intern.mode, mode)) {
            return false;
          }
          if (compFilter === 'paid' || compFilter === 'unpaid') {
            if (intern.compensationType !== compFilter) return false;
          }
          if (search) {
            const hay = [
              intern.title,
              intern.organization,
              intern.description,
              intern.location,
              intern.eligibility,
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
      ['GET']
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const internship = repo
      ? await repo.getInternshipById(id)
      : SERVERLESS_INTERNSHIPS.find((i) => i.id === id) || null;
    if (!internship || !internship.isApproved) {
      return errorResponse(event, 404, 'Not Found', 'Internship listing not found.', {
        code: 'INTERNSHIP_NOT_FOUND',
        allowedMethods: ['GET'],
      });
    }
    return jsonResponse(event, 200, { success: true, internship }, ['GET']);
  }

  return errorResponse(event, 404, 'Not Found', 'Internship endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
