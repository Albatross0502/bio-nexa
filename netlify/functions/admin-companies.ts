/**
 * Netlify Function: admin-companies
 * Phase 15: Administrator Employer Verification Approval, Account Suspension & Audit Logs.
 *
 * Routes:
 * - GET  /api/admin/companies
 * - GET  /api/admin/companies/audit-logs
 * - POST /api/admin/companies/:id/verify
 * - POST /api/admin/companies/:id/suspend
 * - POST /api/admin/companies/:id/reinstate
 */

import {
  maskIpAddress,
  toSafeCompanyProfile,
} from '../../src/services/company/companyAuthService';
import {
  errorResponse,
  extractSubPath,
  getHeader,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/admin-companies', '/api/admin/companies'];

function getClientIp(event: NetlifyEvent): string {
  return (
    getHeader(event.headers, 'x-nf-client-connection-ip') ||
    getHeader(event.headers, 'x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const requiredPermission =
    subPath === 'audit-logs'
      ? 'audit:read'
      : method === 'GET'
      ? 'dashboard:read'
      : 'jobs:verify';

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission,
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();
  const maskedIp = maskIpAddress(getClientIp(event));

  // GET /api/admin/companies
  if (!subPath) {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    if (!repo) {
      return jsonResponse(
        event,
        200,
        {
          success: true,
          companies: [],
          summary: {
            total: 0,
            verified: 0,
            pendingReview: 0,
            unverified: 0,
            rejected: 0,
            suspended: 0,
          },
          persistentDbConfigured: false,
        },
        ['GET']
      );
    }

    const rows = await repo.listAllCompaniesAdmin();
    const companies = rows.map((row) => ({
      ...toSafeCompanyProfile(row),
      jobCount: row.jobCount,
    }));
    const summary = {
      total: companies.length,
      verified: companies.filter((c) => c.verificationStatus === 'verified').length,
      pendingReview: companies.filter((c) => c.verificationStatus === 'pending_review').length,
      unverified: companies.filter((c) => c.verificationStatus === 'unverified').length,
      rejected: companies.filter((c) => c.verificationStatus === 'rejected').length,
      suspended: companies.filter((c) => c.accountStatus === 'suspended').length,
    };
    return jsonResponse(event, 200, { success: true, companies, summary }, ['GET']);
  }

  // GET /api/admin/companies/audit-logs
  if (subPath === 'audit-logs') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    if (!repo) {
      return jsonResponse(event, 200, { success: true, logs: [], persistentDbConfigured: false }, ['GET']);
    }
    const companyId = event.queryStringParameters?.companyId?.trim() || undefined;
    const logs = await repo.getCompanyAuditLogs(companyId, 150);
    return jsonResponse(event, 200, { success: true, logs }, ['GET']);
  }

  const segments = subPath.split('/').filter(Boolean);
  const companyId = decodeURIComponent(segments[0] || '');
  const action = segments[1] || '';

  if (!companyId || segments.length !== 2) {
    return errorResponse(event, 404, 'Not Found', 'Admin company endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method !== 'POST') {
    return methodNotAllowedResponse(event, ['POST']);
  }

  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Employer management actions require Supabase PostgreSQL configuration on Netlify.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['POST']
    );
  }

  const parsed = parseJsonBody(event);
  if (!parsed.ok) {
    return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
  }

  // POST /api/admin/companies/:id/verify
  if (action === 'verify') {
    const decisionRaw = String(parsed.data?.decision || '').trim().toLowerCase();
    const notesOrReason = String(parsed.data?.notes || parsed.data?.reason || '').trim().slice(0, 500);
    if (decisionRaw !== 'verified' && decisionRaw !== 'rejected' && decisionRaw !== 'unverified') {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Decision must be "verified", "rejected", or "unverified".',
        { code: 'INVALID_DECISION', allowedMethods: ['POST'] }
      );
    }

    const updated = await repo.setCompanyVerificationDecisionAdmin(
      companyId,
      decisionRaw,
      auth.user.username || auth.user.email || 'admin',
      notesOrReason
    );
    if (!updated) {
      return errorResponse(event, 404, 'Not Found', 'Company account not found.', {
        code: 'COMPANY_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }

    const actionName =
      decisionRaw === 'verified'
        ? 'ADMIN_EMPLOYER_APPROVED'
        : decisionRaw === 'rejected'
        ? 'ADMIN_EMPLOYER_REJECTED'
        : 'ADMIN_EMPLOYER_VERIFICATION_REVOKED';

    await repo.createCompanyAuditLog({
      companyId: updated.id,
      actorType: 'admin',
      actorId: auth.user.id,
      actorEmail: auth.user.email || auth.user.username,
      action: actionName,
      targetType: 'verification',
      targetId: updated.id,
      status: 'success',
      ipMasked: maskedIp,
      details: notesOrReason || `Verification status set to '${decisionRaw}' for ${updated.organizationName}.`,
    }).catch(() => {});

    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: actionName,
      entityType: 'company_accounts',
      entityId: updated.id,
      ipAddress: maskedIp,
      details: { organizationName: updated.organizationName, decision: decisionRaw, notes: notesOrReason },
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(updated),
        message:
          decisionRaw === 'verified'
            ? `${updated.organizationName} is now a Verified Employer.`
            : decisionRaw === 'rejected'
            ? `Employer verification rejected for ${updated.organizationName}.`
            : `Employer verification status reset to Unverified for ${updated.organizationName}.`,
      },
      ['POST']
    );
  }

  // POST /api/admin/companies/:id/suspend
  if (action === 'suspend') {
    const reason = String(parsed.data?.reason || '').trim().slice(0, 500);
    if (reason.length < 5) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Please provide a suspension reason (at least 5 characters).',
        { code: 'REASON_REQUIRED', allowedMethods: ['POST'] }
      );
    }

    const result = await repo.setCompanyAccountStatusAdmin(
      companyId,
      'suspended',
      auth.user.username || auth.user.email || 'admin',
      reason
    );
    if (!result.company) {
      return errorResponse(event, 404, 'Not Found', 'Company account not found.', {
        code: 'COMPANY_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }

    await repo.createCompanyAuditLog({
      companyId: result.company.id,
      actorType: 'admin',
      actorId: auth.user.id,
      actorEmail: auth.user.email || auth.user.username,
      action: 'ADMIN_COMPANY_SUSPENDED',
      targetType: 'company',
      targetId: result.company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Suspended account (${result.revokedSessions} session(s) revoked). Reason: ${reason}`,
    }).catch(() => {});

    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_COMPANY_SUSPENDED',
      entityType: 'company_accounts',
      entityId: result.company.id,
      ipAddress: maskedIp,
      details: { organizationName: result.company.organizationName, reason, revokedSessions: result.revokedSessions },
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(result.company),
        revokedSessions: result.revokedSessions,
        message: `${result.company.organizationName} has been suspended and ${result.revokedSessions} active session(s) were revoked.`,
      },
      ['POST']
    );
  }

  // POST /api/admin/companies/:id/reinstate
  if (action === 'reinstate') {
    const notes = String(parsed.data?.notes || '').trim().slice(0, 500);
    const result = await repo.setCompanyAccountStatusAdmin(
      companyId,
      'active',
      auth.user.username || auth.user.email || 'admin',
      ''
    );
    if (!result.company) {
      return errorResponse(event, 404, 'Not Found', 'Company account not found.', {
        code: 'COMPANY_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }

    await repo.createCompanyAuditLog({
      companyId: result.company.id,
      actorType: 'admin',
      actorId: auth.user.id,
      actorEmail: auth.user.email || auth.user.username,
      action: 'ADMIN_COMPANY_REINSTATED',
      targetType: 'company',
      targetId: result.company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: notes || `Reinstated employer account for ${result.company.organizationName}.`,
    }).catch(() => {});

    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_COMPANY_REINSTATED',
      entityType: 'company_accounts',
      entityId: result.company.id,
      ipAddress: maskedIp,
      details: { organizationName: result.company.organizationName, notes },
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(result.company),
        message: `${result.company.organizationName} account has been reinstated.`,
      },
      ['POST']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Admin company endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
