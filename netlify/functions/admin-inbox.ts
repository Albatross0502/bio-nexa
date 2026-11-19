/**
 * Netlify Function: admin-inbox
 * Routes:
 * - GET    /api/admin/opportunities
 * - PATCH  /api/admin/opportunities/:id
 * - DELETE /api/admin/opportunities/:id
 * - GET    /api/admin/contact-messages
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
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-inbox', '/api/admin'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const requiredPermission =
    subPath === 'contact-messages' ? 'inbox:read' : 'opportunities:moderate';
  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission,
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();

  if (subPath === 'contact-messages') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Contact inbox requires Supabase PostgreSQL configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET']
      );
    }
    const messages = await repo.getContactMessages();
    return jsonResponse(event, 200, { success: true, count: messages.length, messages }, ['GET']);
  }

  if (subPath === 'opportunities') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    if (!repo) {
      return jsonResponse(event, 200, { success: true, count: 0, opportunities: [], persistentDbConfigured: false }, ['GET']);
    }
    const opportunities = await repo.getSubmittedOpportunities({
      onlyApproved: false,
      type: event.queryStringParameters?.type,
      search: event.queryStringParameters?.search,
    });
    return jsonResponse(event, 200, { success: true, count: opportunities.length, opportunities }, ['GET']);
  }

  if (subPath.startsWith('opportunities/')) {
    const id = decodeURIComponent(subPath.slice('opportunities/'.length));
    if (method !== 'PATCH' && method !== 'DELETE') {
      return methodNotAllowedResponse(event, ['PATCH', 'DELETE']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Submitted opportunity moderation requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH', 'DELETE']
      );
    }
    if (method === 'PATCH') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
      }
      const body = parsed.data;
      const updates: Record<string, any> = {};
      if (body.title !== undefined && sanitizeString(body.title)) updates.title = sanitizeString(body.title);
      if (body.organization !== undefined && sanitizeString(body.organization)) updates.organization = sanitizeString(body.organization);
      if (body.type !== undefined && sanitizeString(body.type)) updates.type = sanitizeString(body.type);
      if (body.subCategory !== undefined) updates.subCategory = sanitizeString(body.subCategory);
      if (body.description !== undefined) updates.description = sanitizeString(body.description);
      if (body.location !== undefined) updates.location = sanitizeString(body.location);
      if (body.workMode !== undefined) updates.workMode = sanitizeString(body.workMode);
      if (body.experience !== undefined) updates.experience = sanitizeString(body.experience);
      if (body.qualification !== undefined) updates.qualification = sanitizeString(body.qualification);
      if (Array.isArray(body.branches)) updates.branches = body.branches;
      if (Array.isArray(body.skills)) updates.skills = body.skills;
      if (body.salaryOrStipend !== undefined) updates.salaryOrStipend = sanitizeString(body.salaryOrStipend);
      if (body.deadline !== undefined) updates.deadline = sanitizeString(body.deadline);
      if (body.sourceName !== undefined) updates.sourceName = sanitizeString(body.sourceName);
      if (body.sourceUrl !== undefined) updates.sourceUrl = sanitizeString(body.sourceUrl);
      if (body.contactEmail !== undefined) updates.contactEmail = sanitizeString(body.contactEmail);
      if (body.applicationUrl !== undefined) {
        const url = sanitizeString(body.applicationUrl);
        if (!isValidHttpUrl(url)) {
          return errorResponse(event, 400, 'Validation Error', 'Application URL must start with http:// or https://', {
            code: 'INVALID_URL',
            allowedMethods: ['PATCH', 'DELETE'],
          });
        }
        updates.applicationUrl = url;
      }
      if (body.isApproved !== undefined) updates.isApproved = Boolean(body.isApproved);
      if (body.status !== undefined && sanitizeString(body.status)) {
        updates.status = sanitizeString(body.status);
        if (updates.status === 'Rejected') updates.isApproved = false;
        else if (updates.status === 'Active' || updates.status === 'Approved') updates.isApproved = true;
      }

      const updated = await repo.updateSubmittedOpportunity(id, updates);
      if (!updated) {
        return errorResponse(event, 404, 'Not Found', 'Submitted opportunity not found.', {
          code: 'OPPORTUNITY_NOT_FOUND',
          allowedMethods: ['PATCH', 'DELETE'],
        });
      }
      await repo.recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_OPPORTUNITY_MODERATED',
        entityType: 'submitted_opportunity',
        entityId: id,
        details: { isApproved: updated.isApproved, status: updated.status },
      }).catch(() => {});
      return jsonResponse(event, 200, { success: true, opportunity: updated }, ['PATCH', 'DELETE']);
    }
    const deleted = await repo.deleteSubmittedOpportunity(id);
    if (!deleted) {
      return errorResponse(event, 404, 'Not Found', 'Submitted opportunity not found.', {
        code: 'OPPORTUNITY_NOT_FOUND',
        allowedMethods: ['PATCH', 'DELETE'],
      });
    }
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_OPPORTUNITY_DELETED',
      entityType: 'submitted_opportunity',
      entityId: id,
    }).catch(() => {});
    return jsonResponse(event, 200, { success: true, message: 'Submitted opportunity deleted.' }, ['PATCH', 'DELETE']);
  }

  return errorResponse(event, 404, 'Not Found', 'Admin inbox route not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
