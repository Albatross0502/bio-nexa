/**
 * Netlify Function: admin-internships
 * Routes:
 * - GET    /api/admin/internships
 * - POST   /api/admin/internships
 * - PUT    /api/admin/internships/:id
 * - DELETE /api/admin/internships/:id
 * - PATCH  /api/admin/internships/:id/status
 * - PUT    /api/admin/internships/:id/status
 * - POST   /api/admin/internships/:id/verify
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
import {
  formatServerlessInternshipForAdmin,
  SERVERLESS_INTERNSHIPS,
} from './_shared/serverlessCatalog';
import { formatAdminInternship, getSupabaseRepository } from './_shared/supabaseDb';
import { validateInternshipApplicationUrl } from '../../src/services/internships/internshipHelpers';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-internships', '/api/admin/internships'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const requiredPermission =
    method === 'GET'
      ? 'dashboard:read'
      : subPath.endsWith('/verify')
      ? 'jobs:verify'
      : method === 'DELETE'
      ? 'jobs:delete'
      : 'jobs:write';

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission,
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();

  if (!subPath) {
    if (method === 'GET') {
      const internships = repo
        ? (await repo.getAllInternshipsAdmin()).map(formatAdminInternship)
        : SERVERLESS_INTERNSHIPS.map(formatServerlessInternshipForAdmin);
      return jsonResponse(
        event,
        200,
        { success: true, count: internships.length, internships },
        ['GET', 'POST']
      );
    }

    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['GET', 'POST']);
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['GET', 'POST'],
      });
    }

    const body = parsed.data;
    const title = sanitizeString(body.title);
    const organization = sanitizeString(body.organization || body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);

    if (!title || !organization || !applicationUrl) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Title, organization, and applicationUrl are required.',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ['GET', 'POST'] }
      );
    }

    const urlCheck = validateInternshipApplicationUrl(applicationUrl);
    if (!urlCheck.valid) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        urlCheck.reason || 'Application URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['GET', 'POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent internship database writes require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET', 'POST']
      );
    }

    const verificationStatus = sanitizeString(body.verificationStatus) || 'Pending Verification';
    const isApproved =
      verificationStatus === 'Verified' || verificationStatus === 'Link Unavailable'
        ? true
        : Boolean(body.isApproved);
    const isActive = verificationStatus !== 'Expired' && verificationStatus !== 'Rejected';

    const created = await repo.createInternship({
      title,
      organization,
      location: sanitizeString(body.location) || 'India',
      workMode: sanitizeString(body.mode || body.workMode) || 'On-site',
      stipend: sanitizeString(body.stipend) || 'Competitive Stipend',
      duration: sanitizeString(body.duration) || '3 Months',
      deadline: sanitizeString(body.deadline),
      category: sanitizeString(body.category) || 'Industrial R&D',
      eligibility: sanitizeString(body.eligibility) || 'B.Sc / M.Sc / B.Tech in Life Sciences',
      description: sanitizeString(body.description) || `${title} internship at ${organization}.`,
      skillsRequired: Array.isArray(body.skillsRequired) ? body.skillsRequired : [],
      sourceName: sanitizeString(body.sourceName) || 'BIO-INEXA Admin Portal',
      sourceUrl: sanitizeString(body.sourceUrl) || applicationUrl,
      applicationUrl,
      verificationStatus,
      verificationNotes: sanitizeString(body.verificationNotes) || 'Added via BIO-INEXA Admin Portal.',
      lastVerificationDate:
        sanitizeString(body.lastVerificationDate) ||
        (verificationStatus === 'Verified' ? new Date().toISOString().split('T')[0] : ''),
      isApproved,
      isActive,
      featured: Boolean(body.featured),
    });

    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_INTERNSHIP_CREATED',
        entityType: 'internship',
        entityId: created.id,
        details: { title: created.title, organization: created.organization },
      })
      .catch(() => {});

    return jsonResponse(
      event,
      201,
      { success: true, internship: formatAdminInternship(created) },
      ['GET', 'POST']
    );
  }

  if (subPath === 'expire-scan') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Expired internship scans require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const result = await repo.expirePastDeadlineInternships();
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_INTERNSHIP_EXPIRE_SCAN',
        entityType: 'internship',
        details: result,
      })
      .catch(() => {});
    return jsonResponse(
      event,
      200,
      {
        success: true,
        ...result,
        message:
          result.expiredCount > 0
            ? `Marked ${result.expiredCount} past-deadline internship(s) as Expired.`
            : 'All active internships have valid upcoming or rolling deadlines.',
      },
      ['POST']
    );
  }

  const segments = subPath.split('/').filter(Boolean);
  const internshipId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (segments.length > 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin internship route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (action === 'status') {
    if (method !== 'PATCH' && method !== 'PUT') {
      return methodNotAllowedResponse(event, ['PATCH', 'PUT']);
    }
    const existing = repo
      ? await repo.getInternshipById(internshipId)
      : SERVERLESS_INTERNSHIPS.find((i) => i.id === internshipId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Internship not found.', {
        code: 'INTERNSHIP_NOT_FOUND',
        allowedMethods: ['PATCH', 'PUT'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent internship status updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH', 'PUT']
      );
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const updates: Record<string, any> = {};
    if (parsed.data.isApproved !== undefined) updates.isApproved = Boolean(parsed.data.isApproved);
    if (parsed.data.isActive !== undefined) updates.isActive = Boolean(parsed.data.isActive);
    if (parsed.data.verificationStatus !== undefined) {
      updates.verificationStatus = sanitizeString(parsed.data.verificationStatus);
    }
    if (parsed.data.verificationNotes !== undefined) {
      updates.verificationNotes = sanitizeString(parsed.data.verificationNotes);
    }

    const norm =
      typeof parsed.data.status === 'string' ? parsed.data.status.trim().toLowerCase() : '';
    if (norm === 'rejected') {
      updates.isApproved = false;
      updates.isActive = false;
      updates.verificationStatus = 'Rejected';
    } else if (norm === 'expired') {
      updates.isActive = false;
      updates.verificationStatus = 'Expired';
    } else if (norm === 'active' || norm === 'approved') {
      updates.isActive = true;
      if (parsed.data.isApproved === true || norm === 'approved') {
        updates.isApproved = true;
        if (!parsed.data.verificationStatus) {
          updates.verificationStatus = 'Verified';
          updates.lastVerificationDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    const updated = await repo.updateInternship(internshipId, updates);
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_INTERNSHIP_STATUS_UPDATED',
        entityType: 'internship',
        entityId: internshipId,
        details: { status: parsed.data.status, isApproved: updated?.isApproved },
      })
      .catch(() => {});

    return jsonResponse(
      event,
      200,
      { success: true, internship: formatAdminInternship(updated!) },
      ['PATCH', 'PUT']
    );
  }

  if (action === 'verify') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    const existing = repo
      ? await repo.getInternshipById(internshipId)
      : SERVERLESS_INTERNSHIPS.find((i) => i.id === internshipId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Internship not found.', {
        code: 'INTERNSHIP_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Internship verification audit logging requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const verified = await repo.verifyInternship(
      internshipId,
      auth.user.username,
      sanitizeString(parsed.data.status) || 'Verified',
      sanitizeString(parsed.data.notes) || 'Verified via official institutional portal check',
      sanitizeString(parsed.data.lastVerificationDate) || undefined
    );
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_INTERNSHIP_VERIFIED',
        entityType: 'internship',
        entityId: internshipId,
        details: { verificationStatus: verified?.verificationStatus },
      })
      .catch(() => {});

    return jsonResponse(
      event,
      200,
      { success: true, internship: formatAdminInternship(verified!) },
      ['POST']
    );
  }

  if (action) {
    return errorResponse(event, 404, 'Not Found', 'Admin internship route not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method !== 'PUT' && method !== 'DELETE') {
    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  const existing = repo
    ? await repo.getInternshipById(internshipId)
    : SERVERLESS_INTERNSHIPS.find((i) => i.id === internshipId) || null;
  if (!existing) {
    return errorResponse(event, 404, 'Not Found', 'Internship not found.', {
      code: 'INTERNSHIP_NOT_FOUND',
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
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent internship edits require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PUT', 'DELETE']
      );
    }
    const updated = await repo.updateInternship(internshipId, parsed.data);
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_INTERNSHIP_UPDATED',
        entityType: 'internship',
        entityId: internshipId,
      })
      .catch(() => {});
    return jsonResponse(
      event,
      200,
      { success: true, internship: formatAdminInternship(updated!) },
      ['PUT', 'DELETE']
    );
  }

  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Persistent internship deletions require Supabase PostgreSQL configuration.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PUT', 'DELETE']
    );
  }

  await repo.deleteInternship(internshipId);
  await repo
    .recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_INTERNSHIP_DELETED',
      entityType: 'internship',
      entityId: internshipId,
      details: { title: existing.title },
    })
    .catch(() => {});

  return jsonResponse(event, 200, { success: true, message: 'Internship deleted.' }, ['PUT', 'DELETE']);
};
