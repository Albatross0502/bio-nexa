/**
 * Netlify Function: workshops
 * Routes:
 * - GET  /api/workshops
 * - POST /api/workshops/submit
 * - GET  /api/workshops/:id
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
  serviceUnavailableResponse,
} from './_shared/http';
import { SERVERLESS_WORKSHOPS } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';
import {
  isWorkshopExpired,
  validateWorkshopSubmissionPayload,
} from '../../src/services/workshops/workshopHelpers';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/workshops', '/api/workshops'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

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

    const validation = validateWorkshopSubmissionPayload(parsed.data);
    if (!validation.valid || !validation.sanitized) {
      return errorResponse(event, 400, 'Validation Error', validation.errors.join(' '), {
        code: 'INVALID_WORKSHOP_SUBMISSION',
        allowedMethods: ['POST'],
      });
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent workshop submissions require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const s = validation.sanitized;
    const created = await repo.createWorkshop({
      title: s.title,
      description: s.description,
      organizer: s.organizer,
      instructor: s.instructor,
      category: s.category,
      date: s.date,
      time: s.time,
      duration: s.duration,
      format: s.format,
      venue: s.venue,
      registrationDeadline: s.registrationDeadline,
      registrationUrl: s.registrationUrl,
      availability: 'Open',
      status: 'upcoming',
      fees: s.fees,
      capacity: s.capacity ?? 0,
      imageUrl: s.imageUrl,
      featured: false,
      skillsCovered: s.skillsCovered,
      approvalStatus: 'pending',
      isApproved: false,
    });

    return jsonResponse(
      event,
      201,
      {
        success: true,
        status: 'pending',
        message: 'Workshop submitted for editorial review. It will appear publicly only after administrator approval.',
        workshop: created,
      },
      ['POST']
    );
  }

  if (method !== 'GET') {
    return methodNotAllowedResponse(event, ['GET']);
  }

  if (!subPath) {
    const params = event.queryStringParameters || {};
    const status = (params.status || '').trim();
    const format = (params.format || '').trim();
    const category = (params.category || '').trim();
    const featuredParam = params.featured;
    const includeExpired = params.includeExpired === 'false' ? false : true;
    const search = (params.search || '').trim();

    if (repo) {
      await repo.expirePastWorkshops().catch(() => {});
    }

    const filtered: any[] = repo
      ? await repo.getWorkshops({
          onlyApproved: true,
          status: status || undefined,
          format: format || undefined,
          category: category || undefined,
          featured: featuredParam === 'true' ? true : featuredParam === 'false' ? false : undefined,
          includeExpired,
          search: search || undefined,
        })
      : SERVERLESS_WORKSHOPS.map((ws) => {
          const expired = isWorkshopExpired({
            status: ws.status,
            availability: ws.availability,
            date: ws.date,
            registrationDeadline: ws.registrationDeadline,
          });
          return {
            ...ws,
            isExpired: expired,
            status: expired ? ('completed' as const) : ws.status,
          };
        }).filter((ws) => {
          if (!ws.isApproved) return false;
          if (!includeExpired && ws.isExpired) return false;
          if (status && status.toLowerCase() !== 'all' && ws.status.toLowerCase() !== status.toLowerCase()) {
            return false;
          }
          if (format && format.toLowerCase() !== 'all' && ws.format.toLowerCase() !== format.toLowerCase()) {
            return false;
          }
          if (category && category.toLowerCase() !== 'all' && (ws.category || '').toLowerCase() !== category.toLowerCase()) {
            return false;
          }
          if (featuredParam === 'true' && !ws.featured) return false;
          if (featuredParam === 'false' && ws.featured) return false;
          if (search) {
            const hay = [
              ws.name,
              ws.description,
              ws.organizer,
              ws.instructor,
              ws.category,
              ws.venue,
              ...ws.skillsCovered,
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(search.toLowerCase())) return false;
          }
          return true;
        });

    const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
    const { items: paginatedWorkshops, pagination } = paginateArray(filtered, page, limit);

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
        workshops: paginatedWorkshops,
      },
      ALLOWED_METHODS
    );
  }

  if (!subPath.includes('/')) {
    const id = decodeURIComponent(subPath);
    const workshop = repo
      ? await repo.getWorkshopById(id)
      : SERVERLESS_WORKSHOPS.find((w) => w.id === id) || null;
    if (!workshop || !workshop.isApproved) {
      return errorResponse(event, 404, 'Not Found', 'Workshop not found.', {
        code: 'WORKSHOP_NOT_FOUND',
        allowedMethods: ALLOWED_METHODS,
      });
    }
    return jsonResponse(
      event,
      200,
      {
        success: true,
        workshop,
      },
      ALLOWED_METHODS
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Workshop endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
