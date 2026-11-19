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
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import { SERVERLESS_JOBS } from './_shared/serverlessCatalog';
import { formatAdminJob, getSupabaseRepository } from './_shared/supabaseDb';
import {
  VALID_JOB_VERIFICATION_STATUSES,
  normalizeJobVerificationStatus,
  validateApplicationUrl,
} from '../../src/services/jobs/jobVerification';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/admin-jobs', '/api/admin/jobs'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const requiredPermission = subPath.endsWith('/verify')
    ? 'jobs:verify'
    : method === 'GET'
    ? 'dashboard:read'
    : method === 'DELETE'
    ? 'jobs:delete'
    : 'jobs:write';

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission,
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();

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

    const urlCheck = validateApplicationUrl(applicationUrl);
    if (!urlCheck.valid) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        urlCheck.reason || 'Application URL must start with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent job database writes are not yet connected in serverless production. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save new job openings.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const verStatus = normalizeJobVerificationStatus(sanitizeString(body.verificationStatus) || 'Pending Verification');
    const isApproved = verStatus === 'Verified' || verStatus === 'Link Unavailable';
    const isActive = verStatus !== 'Expired' && verStatus !== 'Rejected';

    const created = await repo.createJob({
      title,
      employer,
      applicationUrl,
      description: sanitizeString(body.description) || `${title} at ${employer}`,
      location: sanitizeString(body.location) || 'India',
      qualification: sanitizeString(body.qualification) || 'Life Sciences Graduate',
      skills: Array.isArray(body.skills) ? body.skills : [],
      employmentType: sanitizeString(body.type || body.employmentType) || 'Full-time',
      salary: sanitizeString(body.salary) || 'Competitive',
      source: sanitizeString(body.sourceName || body.originalSource) || 'BIO-INEXA Admin Portal',
      originalJobUrl: sanitizeString(body.originalJobUrl || body.sourceUrl) || applicationUrl,
      expiryDate: sanitizeString(body.deadline || body.expiryDate),
      verificationStatus: verStatus,
      verificationNotes: sanitizeString(body.verificationNotes),
      isActive,
      isApproved,
      featured: Boolean(body.featured),
      responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      sector: sanitizeString(body.sector) || 'Biotechnology',
    });

    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_JOB_CREATED',
      entityType: 'job',
      entityId: created.id,
      details: { title: created.title, employer: created.employer },
    }).catch(() => {});

    return jsonResponse(event, 201, { success: true, job: formatAdminJob(created) }, ['POST']);
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
    const existing = repo
      ? await repo.getJobById(jobId)
      : SERVERLESS_JOBS.find((j) => j.id === jobId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Job opening not found.', {
        code: 'JOB_NOT_FOUND',
        allowedMethods: ['PATCH', 'PUT'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent job status updates require Supabase PostgreSQL configuration.',
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
    if (parsed.data.verificationStatus !== undefined) {
      updates.verificationStatus = sanitizeString(parsed.data.verificationStatus);
    }
    if (parsed.data.verificationNotes !== undefined) {
      updates.verificationNotes = sanitizeString(parsed.data.verificationNotes);
    }

    const normStatus =
      typeof parsed.data.status === 'string' ? parsed.data.status.trim().toLowerCase() : '';
    if (normStatus === 'rejected') {
      updates.isActive = false;
      updates.isApproved = false;
      updates.verificationStatus = 'Rejected';
    } else if (parsed.data.isExpired === true || normStatus === 'expired') {
      updates.isActive = false;
      updates.verificationStatus = 'Expired';
    } else if (normStatus === 'inactive') {
      updates.isActive = false;
    } else if (normStatus === 'active' || normStatus === 'approved') {
      updates.isActive = true;
      if (parsed.data.isApproved === true || normStatus === 'approved') {
        updates.isApproved = true;
        if (!parsed.data.verificationStatus) {
          updates.verificationStatus = 'Verified';
          updates.lastVerificationDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    const updated = await repo.updateJob(jobId, updates);
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_JOB_STATUS_UPDATED',
      entityType: 'job',
      entityId: jobId,
      details: { status: parsed.data.status, isApproved: updated?.isApproved },
    }).catch(() => {});
    return jsonResponse(event, 200, { success: true, job: formatAdminJob(updated!) }, ['PATCH', 'PUT']);
  }

  if (action === 'verifications') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }
    const existing = repo
      ? await repo.getJobById(jobId)
      : SERVERLESS_JOBS.find((j) => j.id === jobId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Job not found.', {
        code: 'JOB_NOT_FOUND',
        allowedMethods: ['GET'],
      });
    }
    const verifications = repo
      ? await repo.getJobVerificationRecords(jobId)
      : existing.lastVerificationDate
      ? [
          {
            id: `ver-${existing.id}`,
            jobId: existing.id,
            verifiedBy: 'BIO-INEXA Operations Audit',
            verifiedAt: existing.lastVerificationDate,
            sourceStatus: existing.verificationStatus,
            notes: existing.verificationNotes || '',
          },
        ]
      : [];
    return jsonResponse(event, 200, { success: true, jobId, verifications }, ['GET']);
  }

  if (action === 'verify') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    const existing = repo
      ? await repo.getJobById(jobId)
      : SERVERLESS_JOBS.find((j) => j.id === jobId) || null;
    if (!existing) {
      return errorResponse(event, 404, 'Not Found', 'Job not found.', {
        code: 'JOB_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const requestedStatus = sanitizeString(parsed.data.status) || 'Verified';
    if (!VALID_JOB_VERIFICATION_STATUSES.includes(requestedStatus as any)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        `Invalid verification status. Must be one of: ${VALID_JOB_VERIFICATION_STATUSES.join(', ')}.`,
        { code: 'INVALID_VERIFICATION_STATUS', allowedMethods: ['POST'] }
      );
    }
    if (requestedStatus === 'Verified') {
      const urlCheck = validateApplicationUrl(existing.applicationUrl);
      if (!urlCheck.valid) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          `Cannot mark job as Verified: ${urlCheck.reason}`,
          { code: 'INVALID_URL', allowedMethods: ['POST'] }
        );
      }
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Job verification audit logging requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const verified = await repo.verifyJob(
      jobId,
      auth.user.username,
      requestedStatus,
      sanitizeString(parsed.data.notes),
      requestedStatus === 'Pending Verification'
        ? ''
        : sanitizeString(parsed.data.lastVerificationDate) || undefined
    );
    const verifications = await repo.getJobVerificationRecords(jobId);
    return jsonResponse(event, 200, { success: true, job: formatAdminJob(verified!), verifications }, ['POST']);
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

  const existing = repo
    ? await repo.getJobById(jobId)
    : SERVERLESS_JOBS.find((j) => j.id === jobId) || null;
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
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Persistent job modifications require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PUT', 'DELETE']
      );
    }
    const updated = await repo.updateJob(jobId, parsed.data);
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_JOB_UPDATED',
      entityType: 'job',
      entityId: jobId,
    }).catch(() => {});
    return jsonResponse(event, 200, { success: true, job: formatAdminJob(updated!) }, ['PUT', 'DELETE']);
  }

  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Persistent job deletions require Supabase PostgreSQL configuration.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['PUT', 'DELETE']
    );
  }
  await repo.deleteJob(jobId);
  await repo.recordAdminAuditLog({
    adminUserId: auth.user.id,
    actorUsername: auth.user.username,
    action: 'ADMIN_JOB_DELETED',
    entityType: 'job',
    entityId: jobId,
    details: { title: existing.title },
  }).catch(() => {});
  return jsonResponse(event, 200, { success: true, message: 'Job opening deleted.' }, ['PUT', 'DELETE']);
};
