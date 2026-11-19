/**
 * Netlify Function: company-auth
 * Phase 15: Company / Employer Authentication, Organization Profile, Verification Workflow,
 * Authorized Job Submissions, Application Destination Management, Sessions & Audit Logs.
 *
 * Routes:
 * - POST   /api/company/register
 * - POST   /api/company/login
 * - POST   /api/company/logout
 * - GET    /api/company/me
 * - POST   /api/company/verify-email
 * - POST   /api/company/resend-verification
 * - POST   /api/company/password-reset/request
 * - POST   /api/company/password-reset/confirm
 * - PATCH  /api/company/profile
 * - POST   /api/company/change-password
 * - POST   /api/company/verification/submit
 * - GET    /api/company/jobs
 * - POST   /api/company/jobs
 * - PUT    /api/company/jobs/:id
 * - PATCH  /api/company/jobs/:id/status
 * - DELETE /api/company/jobs/:id
 * - GET    /api/company/sessions
 * - DELETE /api/company/sessions/:jti
 * - POST   /api/company/sessions/revoke-others
 * - GET    /api/company/audit-logs
 */

import crypto from 'node:crypto';
import { getRuntimeEnvironmentConfig, resolveCorsOrigin } from '../../src/config/environment';
import {
  COMPANY_RESET_TOKEN_TTL_MS,
  COMPANY_SESSION_COOKIE,
  COMPANY_SESSION_TTL_MS,
  COMPANY_VERIFY_TOKEN_TTL_MS,
  CompanyAuthRateLimiter,
  CompanyPermission,
  evaluatePasswordStrength,
  generateOpaqueToken,
  hashCompanyPassword,
  hashOpaqueToken,
  hasCompanyPermission,
  maskIpAddress,
  normalizeCompanyEmail,
  resolveEmployerJobSubmissionPolicy,
  toSafeCompanyProfile,
  validateCompanyJobInput,
  validateCompanyProfileUpdateInput,
  validateCompanyRegistrationInput,
  validateEmployerVerificationSubmission,
  verifyCompanyPassword,
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
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { parseCookies } from './_shared/serverlessAuth';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/company-auth', '/api/company'];

const companyLoginRateLimiter = new CompanyAuthRateLimiter(8, 15 * 60 * 1000, 15 * 60 * 1000);
const companyRegisterRateLimiter = new CompanyAuthRateLimiter(10, 60 * 60 * 1000, 30 * 60 * 1000);
const companyResetRateLimiter = new CompanyAuthRateLimiter(6, 30 * 60 * 1000, 30 * 60 * 1000);

export function resetServerlessCompanyRateLimitersForTest(): void {
  companyLoginRateLimiter.clear();
  companyRegisterRateLimiter.clear();
  companyResetRateLimiter.clear();
}

function getClientIp(event: NetlifyEvent): string {
  return (
    getHeader(event.headers, 'x-nf-client-connection-ip') ||
    getHeader(event.headers, 'x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

function extractCompanySessionToken(event: NetlifyEvent): string | null {
  const cookies = parseCookies(getHeader(event.headers, 'cookie'));
  return cookies[COMPANY_SESSION_COOKIE] || null;
}

function buildCompanySessionCookieHeader(
  token: string,
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const maxAgeSec = Math.floor(COMPANY_SESSION_TTL_MS / 1000);
  const parts = [
    `${COMPANY_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (config.cookieSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildClearCompanySessionCookieHeader(
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const parts = [
    `${COMPANY_SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (config.cookieSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function isCompanyRequestOriginAllowed(
  event: NetlifyEvent,
  env: Record<string, string | undefined> = process.env
): boolean {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  const cookies = parseCookies(getHeader(event.headers, 'cookie'));
  if (!cookies[COMPANY_SESSION_COOKIE]) {
    return true;
  }
  const rawOrigin = getHeader(event.headers, 'origin') || getHeader(event.headers, 'referer');
  if (!rawOrigin) return true;
  try {
    const parsedOrigin = new URL(rawOrigin).origin;
    const config = getRuntimeEnvironmentConfig(env);
    const hostHeader = getHeader(event.headers, 'host');
    if (hostHeader && parsedOrigin.endsWith(`://${hostHeader}`)) {
      return true;
    }
    return resolveCorsOrigin(parsedOrigin, config) === parsedOrigin;
  } catch {
    return false;
  }
}

function formatCompanyJob(job: any) {
  const today = new Date().toISOString().split('T')[0];
  const isExpired =
    job.verificationStatus === 'Expired' ||
    (Boolean(job.expiryDate) && job.expiryDate < today);
  let status = 'Pending Review';
  if (job.verificationStatus === 'Rejected') {
    status = 'Rejected';
  } else if (isExpired) {
    status = 'Expired';
  } else if (!job.isActive) {
    status = 'Closed';
  } else if (job.isApproved) {
    status = 'Published';
  }

  return {
    id: job.id,
    slug: job.id,
    title: job.title,
    company: job.employer,
    companyAccountId: job.companyAccountId || '',
    sector: job.sector || 'Private Biopharma',
    location: job.location,
    type: job.employmentType || 'Full-time',
    salary: job.salary || 'Competitive',
    qualification: job.qualification || '',
    experienceLevel: 'All Experience Levels',
    description: job.description,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    deadline: job.expiryDate || '',
    postedDate: job.publicationDate || '',
    applicationDestinationType: job.applicationDestinationType || 'external_url',
    applicationUrl: job.applicationUrl || '',
    applicationEmail: job.applicationEmail || '',
    applicationInstructions: job.applicationInstructions || '',
    status,
    isApproved: Boolean(job.isApproved),
    isExpired,
    featured: Boolean(job.featured),
    verificationStatus: job.verificationStatus || 'Pending Verification',
    verificationNotes: job.verificationNotes || '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();
  const ip = getClientIp(event);
  const maskedIp = maskIpAddress(ip);

  if (!isCompanyRequestOriginAllowed(event)) {
    return errorResponse(
      event,
      403,
      'Forbidden',
      'Cross-origin state-changing request rejected by CSRF protection.',
      { code: 'CSRF_ORIGIN_DENIED', allowedMethods: ALLOWED_METHODS }
    );
  }

  // POST /api/company/register
  if (subPath === 'register') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }

    const rate = companyRegisterRateLimiter.consume(`reg:${ip}`);
    if (!rate.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many registration attempts. Please try again in ${rate.retryAfterSec || 1800} seconds.`,
        { code: 'RATE_LIMITED', details: { retryAfterSec: rate.retryAfterSec }, allowedMethods: ['POST'] }
      );
    }

    const validated = validateCompanyRegistrationInput(parsed.data || {});
    if (!validated.valid || !validated.value) {
      return errorResponse(event, 400, 'Validation Error', validated.error || 'Invalid registration details.', {
        code: 'VALIDATION_ERROR',
        details: validated.field ? { field: validated.field } : undefined,
        allowedMethods: ['POST'],
      });
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Company account persistence requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const input = validated.value;
    const existing = await repo.getCompanyByEmail(input.email);
    if (existing) {
      return errorResponse(
        event,
        409,
        'Account Exists',
        'An employer account with this work email already exists. Please sign in instead.',
        { code: 'EMAIL_ALREADY_REGISTERED', allowedMethods: ['POST'] }
      );
    }

    const passwordHash = hashCompanyPassword(input.password);
    const rawVerifyToken = generateOpaqueToken(32);
    const verifyTokenHash = hashOpaqueToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + COMPANY_VERIFY_TOKEN_TTL_MS).toISOString();

    const company = await repo.createCompanyAccount({
      email: input.email,
      passwordHash,
      contactName: input.contactName,
      contactTitle: input.contactTitle,
      contactPhone: input.contactPhone,
      organizationName: input.organizationName,
      organizationType: input.organizationType,
      officialWebsite: input.officialWebsite,
      headquartersLocation: input.headquartersLocation,
      organizationSize: input.organizationSize,
      foundedYear: input.foundedYear,
      industryFocus: input.industryFocus,
      description: input.description,
      registrationIdentifier: input.registrationIdentifier,
      verificationTokenHash: verifyTokenHash,
      verificationTokenExpiresAt: verifyExpiresAt,
    });

    const rawSessionToken = generateOpaqueToken(32);
    const jti = `csess-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString();
    await repo.createCompanySession({
      jti,
      companyId: company.id,
      rawToken: rawSessionToken,
      userAgent: String(getHeader(event.headers, 'user-agent') || 'Browser').slice(0, 240),
      ipMasked: maskedIp,
      expiresAt,
    });
    await repo.updateCompanyLastLogin(company.id);

    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_REGISTERED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Registered organization '${company.organizationName}' (unverified pending email & employer review).`,
    }).catch(() => {});

    return jsonResponse(
      event,
      201,
      {
        success: true,
        company: toSafeCompanyProfile(company),
        verificationRequired: true,
        message: 'Company account registered. Verify your work email and complete employer verification before publishing verified openings.',
      },
      ['POST'],
      { 'Set-Cookie': buildCompanySessionCookieHeader(rawSessionToken) }
    );
  }

  // POST /api/company/login
  if (subPath === 'login') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }

    const email = normalizeCompanyEmail(parsed.data?.email || '');
    const password = typeof parsed.data?.password === 'string' ? parsed.data.password : '';
    if (!email || !password) {
      return errorResponse(event, 400, 'Validation Error', 'Work email and password are required.', {
        code: 'MISSING_CREDENTIALS',
        allowedMethods: ['POST'],
      });
    }

    const rateKey = `login:${ip}:${email}`;
    const rateCheck = companyLoginRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many login attempts. Try again in ${rateCheck.retryAfterSec || 900} seconds.`,
        { code: 'RATE_LIMITED', details: { retryAfterSec: rateCheck.retryAfterSec }, allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Company authentication requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const company = await repo.getCompanyByEmail(email);
    if (!company || !verifyCompanyPassword(password, company.passwordHash)) {
      const fail = companyLoginRateLimiter.consume(rateKey);
      if (company) {
        await repo.createCompanyAuditLog({
          companyId: company.id,
          actorType: 'company',
          actorId: company.id,
          actorEmail: company.email,
          action: 'COMPANY_LOGIN_FAILED',
          targetType: 'session',
          targetId: company.id,
          status: 'failure',
          ipMasked: maskedIp,
          details: 'Invalid password attempt.',
        }).catch(() => {});
      }
      return errorResponse(event, 401, 'Unauthorized', 'Invalid work email or password.', {
        code: 'INVALID_CREDENTIALS',
        details: { remainingAttempts: fail.remainingAttempts, retryAfterSec: fail.retryAfterSec },
        allowedMethods: ['POST'],
      });
    }

    if (company.accountStatus === 'suspended') {
      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'COMPANY_LOGIN_BLOCKED_SUSPENDED',
        targetType: 'session',
        targetId: company.id,
        status: 'denied',
        ipMasked: maskedIp,
        details: company.suspensionReason || 'Account suspended by administrator.',
      }).catch(() => {});
      return errorResponse(
        event,
        403,
        'Account Suspended',
        company.suspensionReason
          ? `This employer account is suspended: ${company.suspensionReason}`
          : 'This employer account has been suspended by an administrator.',
        { code: 'ACCOUNT_SUSPENDED', allowedMethods: ['POST'] }
      );
    }

    companyLoginRateLimiter.reset(rateKey);
    const rawSessionToken = generateOpaqueToken(32);
    const jti = `csess-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString();
    await repo.createCompanySession({
      jti,
      companyId: company.id,
      rawToken: rawSessionToken,
      userAgent: String(getHeader(event.headers, 'user-agent') || 'Browser').slice(0, 240),
      ipMasked: maskedIp,
      expiresAt,
    });
    await repo.updateCompanyLastLogin(company.id);

    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_LOGIN_SUCCESS',
      targetType: 'session',
      targetId: jti,
      status: 'success',
      ipMasked: maskedIp,
      details: 'Employer signed in.',
    }).catch(() => {});

    const refreshed = (await repo.getCompanyById(company.id)) || company;
    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(refreshed),
        message: `Signed in to ${refreshed.organizationName}.`,
      },
      ['POST'],
      { 'Set-Cookie': buildCompanySessionCookieHeader(rawSessionToken) }
    );
  }

  // POST /api/company/logout
  if (subPath === 'logout') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const rawToken = extractCompanySessionToken(event);
    if (rawToken && repo) {
      const verified = await repo.validateCompanySessionToken(rawToken).catch(() => null);
      if (verified) {
        await repo.revokeCompanySessionByJti(verified.session.jti, verified.company.id).catch(() => false);
        await repo.createCompanyAuditLog({
          companyId: verified.company.id,
          actorType: 'company',
          actorId: verified.company.id,
          actorEmail: verified.company.email,
          action: 'COMPANY_LOGOUT',
          targetType: 'session',
          targetId: verified.session.jti,
          status: 'success',
          ipMasked: maskedIp,
          details: 'Signed out current session.',
        }).catch(() => {});
      }
    }

    return jsonResponse(
      event,
      200,
      { success: true, message: 'Signed out successfully.' },
      ['POST'],
      { 'Set-Cookie': buildClearCompanySessionCookieHeader() }
    );
  }

  // GET /api/company/me
  if (subPath === 'me') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);

    const rawToken = extractCompanySessionToken(event);
    if (!rawToken || !repo) {
      return jsonResponse(event, 200, { authenticated: false, company: null }, ['GET']);
    }

    const verified = await repo.validateCompanySessionToken(rawToken).catch(() => null);
    if (!verified || verified.company.accountStatus === 'suspended') {
      return jsonResponse(
        event,
        200,
        { authenticated: false, company: null },
        ['GET'],
        { 'Set-Cookie': buildClearCompanySessionCookieHeader() }
      );
    }

    return jsonResponse(
      event,
      200,
      {
        authenticated: true,
        company: toSafeCompanyProfile(verified.company),
      },
      ['GET']
    );
  }

  // POST /api/company/verify-email
  if (subPath === 'verify-email') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const rawToken = sanitizeString(parsed.data?.token);
    if (!rawToken || rawToken.length < 16) {
      return errorResponse(event, 400, 'Validation Error', 'A valid verification token is required.', {
        code: 'INVALID_TOKEN',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Email verification requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const verified = await repo.verifyCompanyEmailByToken(rawToken);
    if (!verified) {
      return errorResponse(event, 400, 'Verification Failed', 'This verification token is invalid or has expired.', {
        code: 'EXPIRED_OR_INVALID_TOKEN',
        allowedMethods: ['POST'],
      });
    }

    await repo.createCompanyAuditLog({
      companyId: verified.id,
      actorType: 'company',
      actorId: verified.id,
      actorEmail: verified.email,
      action: 'COMPANY_EMAIL_VERIFIED',
      targetType: 'company',
      targetId: verified.id,
      status: 'success',
      ipMasked: maskedIp,
      details: 'Company work email verified.',
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(verified),
        message: 'Company work email verified. You can now submit openings and request employer verification.',
      },
      ['POST']
    );
  }

  // POST /api/company/password-reset/request
  if (subPath === 'password-reset/request') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const email = normalizeCompanyEmail(parsed.data?.email || '');
    if (!email || !email.includes('@')) {
      return errorResponse(event, 400, 'Validation Error', 'Please enter a valid work email address.', {
        code: 'INVALID_EMAIL',
        allowedMethods: ['POST'],
      });
    }

    const rate = companyResetRateLimiter.consume(`reset:${ip}`);
    if (!rate.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many password reset requests. Try again in ${rate.retryAfterSec || 1800} seconds.`,
        { code: 'RATE_LIMITED', details: { retryAfterSec: rate.retryAfterSec }, allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Password reset requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const company = await repo.getCompanyByEmail(email);
    if (company && company.accountStatus !== 'suspended') {
      const rawResetToken = generateOpaqueToken(32);
      const resetTokenHash = hashOpaqueToken(rawResetToken);
      const expiresAt = new Date(Date.now() + COMPANY_RESET_TOKEN_TTL_MS).toISOString();
      await repo.setCompanyPasswordResetToken(company.id, resetTokenHash, expiresAt);
      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'COMPANY_PASSWORD_RESET_REQUESTED',
        targetType: 'company',
        targetId: company.id,
        status: 'success',
        ipMasked: maskedIp,
        details: 'Password reset token generated.',
      }).catch(() => {});
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'If an employer account exists for that email, a password reset token has been issued.',
      },
      ['POST']
    );
  }

  // POST /api/company/password-reset/confirm
  if (subPath === 'password-reset/confirm') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const rawToken = sanitizeString(parsed.data?.token);
    const newPassword = typeof parsed.data?.newPassword === 'string' ? parsed.data.newPassword : '';
    if (!rawToken || rawToken.length < 16) {
      return errorResponse(event, 400, 'Validation Error', 'A valid password reset token is required.', {
        code: 'INVALID_TOKEN',
        allowedMethods: ['POST'],
      });
    }
    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.valid) {
      return errorResponse(event, 400, 'Validation Error', strength.errors[0] || 'Weak password.', {
        code: 'WEAK_PASSWORD',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Password reset confirmation requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const updated = await repo.consumeCompanyPasswordResetToken(rawToken, hashCompanyPassword(newPassword));
    if (!updated) {
      return errorResponse(event, 400, 'Reset Failed', 'Reset token is invalid or has expired.', {
        code: 'EXPIRED_OR_INVALID_TOKEN',
        allowedMethods: ['POST'],
      });
    }

    await repo.createCompanyAuditLog({
      companyId: updated.id,
      actorType: 'company',
      actorId: updated.id,
      actorEmail: updated.email,
      action: 'COMPANY_PASSWORD_RESET_COMPLETED',
      targetType: 'company',
      targetId: updated.id,
      status: 'success',
      ipMasked: maskedIp,
      details: 'Password reset completed and all existing sessions revoked.',
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Your employer password has been updated. All prior sessions were signed out.',
      },
      ['POST'],
      { 'Set-Cookie': buildClearCompanySessionCookieHeader() }
    );
  }

  // All remaining routes require an authenticated active company session
  const rawToken = extractCompanySessionToken(event);
  if (!rawToken) {
    return errorResponse(event, 401, 'Unauthorized', 'Please sign in with your company account.', {
      code: 'COMPANY_AUTH_REQUIRED',
      allowedMethods: ALLOWED_METHODS,
    });
  }
  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Company portal operations require Supabase PostgreSQL configuration on Netlify.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ALLOWED_METHODS
    );
  }

  const verified = await repo.validateCompanySessionToken(rawToken).catch(() => null);
  if (!verified) {
    return errorResponse(
      event,
      401,
      'Session Expired',
      'Your company session has expired or been revoked. Please sign in again.',
      { code: 'INVALID_COMPANY_SESSION', allowedMethods: ALLOWED_METHODS }
    );
  }

  const { company, session } = verified;
  if (company.accountStatus === 'suspended') {
    return errorResponse(
      event,
      403,
      'Account Suspended',
      company.suspensionReason
        ? `Your employer account has been suspended: ${company.suspensionReason}`
        : 'Your employer account has been suspended by an administrator.',
      { code: 'ACCOUNT_SUSPENDED', allowedMethods: ALLOWED_METHODS }
    );
  }

  const checkPerm = (perm: CompanyPermission): NetlifyResponse | null => {
    if (!hasCompanyPermission(company, perm)) {
      const msg =
        !company.emailVerified && perm.startsWith('company:jobs:')
          ? 'Please verify your work email address before submitting or editing job openings.'
          : `Permission '${perm}' is not granted for this company account.`;
      return errorResponse(event, 403, 'Forbidden', msg, {
        code: 'INSUFFICIENT_PERMISSIONS',
        allowedMethods: ALLOWED_METHODS,
      });
    }
    return null;
  };

  // POST /api/company/resend-verification
  if (subPath === 'resend-verification') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    if (company.emailVerified) {
      return jsonResponse(event, 200, { success: true, message: 'Your company work email is already verified.' }, ['POST']);
    }
    const rate = companyResetRateLimiter.consume(`verify-resend:${company.id}`);
    if (!rate.allowed) {
      return errorResponse(event, 429, 'Too Many Requests', 'Please wait before requesting another verification email.', {
        code: 'RATE_LIMITED',
        details: { retryAfterSec: rate.retryAfterSec },
        allowedMethods: ['POST'],
      });
    }
    const rawVerifyToken = generateOpaqueToken(32);
    const verifyTokenHash = hashOpaqueToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + COMPANY_VERIFY_TOKEN_TTL_MS).toISOString();
    await repo.setCompanyVerificationToken(company.id, verifyTokenHash, expiresAt);
    return jsonResponse(
      event,
      200,
      { success: true, message: 'A new company email verification token has been generated.' },
      ['POST']
    );
  }

  // PATCH /api/company/profile
  if (subPath === 'profile') {
    if (method !== 'PATCH') return methodNotAllowedResponse(event, ['PATCH']);
    const denied = checkPerm('company:profile:write');
    if (denied) return denied;
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['PATCH'] });
    }
    const validated = validateCompanyProfileUpdateInput(parsed.data || {});
    if (!validated.valid || !validated.value) {
      return errorResponse(event, 400, 'Validation Error', validated.error || 'Invalid profile update.', {
        code: 'VALIDATION_ERROR',
        details: validated.field ? { field: validated.field } : undefined,
        allowedMethods: ['PATCH'],
      });
    }
    const updated = await repo.updateCompanyProfile(company.id, validated.value);
    if (!updated) {
      return errorResponse(event, 404, 'Not Found', 'Company account not found.', {
        code: 'COMPANY_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_PROFILE_UPDATED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Updated organization profile fields: ${Object.keys(validated.value).join(', ') || 'none'}.`,
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(updated),
        message: 'Organization profile and default application settings updated.',
      },
      ['PATCH']
    );
  }

  // POST /api/company/change-password
  if (subPath === 'change-password') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const denied = checkPerm('company:profile:write');
    if (denied) return denied;
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const currentPassword = typeof parsed.data?.currentPassword === 'string' ? parsed.data.currentPassword : '';
    const newPassword = typeof parsed.data?.newPassword === 'string' ? parsed.data.newPassword : '';
    if (!verifyCompanyPassword(currentPassword, company.passwordHash)) {
      return errorResponse(event, 401, 'Unauthorized', 'Current password is incorrect.', {
        code: 'INVALID_CURRENT_PASSWORD',
        allowedMethods: ['POST'],
      });
    }
    const strength = evaluatePasswordStrength(newPassword, company.email);
    if (!strength.valid) {
      return errorResponse(event, 400, 'Validation Error', strength.errors[0] || 'New password is too weak.', {
        code: 'WEAK_PASSWORD',
        allowedMethods: ['POST'],
      });
    }
    await repo.updateCompanyPassword(company.id, hashCompanyPassword(newPassword));
    const revokedOtherSessions = await repo.revokeAllCompanySessions(company.id, session.jti);
    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_PASSWORD_CHANGED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Password rotated; revoked ${revokedOtherSessions} other active session(s).`,
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      { success: true, revokedOtherSessions, message: 'Password updated successfully.' },
      ['POST']
    );
  }

  // POST /api/company/verification/submit
  if (subPath === 'verification/submit') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const denied = checkPerm('company:verification:submit');
    if (denied) return denied;
    if (!company.emailVerified) {
      return errorResponse(
        event,
        403,
        'Email Verification Required',
        'Please verify your company work email before submitting an employer verification request.',
        { code: 'EMAIL_NOT_VERIFIED', allowedMethods: ['POST'] }
      );
    }
    if (company.verificationStatus === 'verified') {
      return jsonResponse(
        event,
        200,
        {
          success: true,
          company: toSafeCompanyProfile(company),
          message: 'Your organization is already a verified BIO-INEXA employer.',
        },
        ['POST']
      );
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const validated = validateEmployerVerificationSubmission(parsed.data || {}, company.officialWebsite);
    if (!validated.valid || !validated.value) {
      return errorResponse(event, 400, 'Validation Error', validated.error || 'Invalid verification dossier.', {
        code: 'VALIDATION_ERROR',
        details: validated.field ? { field: validated.field } : undefined,
        allowedMethods: ['POST'],
      });
    }
    const updated = await repo.submitCompanyEmployerVerification(company.id, validated.value);
    if (!updated) {
      return errorResponse(event, 404, 'Not Found', 'Company account not found.', {
        code: 'COMPANY_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'EMPLOYER_VERIFICATION_SUBMITTED',
      targetType: 'verification',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Submitted employer verification for '${updated.organizationName}' (${validated.value.officialWebsite}).`,
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        company: toSafeCompanyProfile(updated),
        message: 'Employer verification dossier submitted for administrator review.',
      },
      ['POST']
    );
  }

  // GET & POST /api/company/jobs
  if (subPath === 'jobs') {
    if (method === 'GET') {
      const denied = checkPerm('company:jobs:read');
      if (denied) return denied;
      const rows = await repo.getJobsByCompanyAccountId(company.id);
      const jobs = rows.map(formatCompanyJob);
      const summary = {
        total: jobs.length,
        published: jobs.filter((j) => j.status === 'Published').length,
        pendingReview: jobs.filter((j) => j.status === 'Pending Review').length,
        rejected: jobs.filter((j) => j.status === 'Rejected').length,
        expired: jobs.filter((j) => j.status === 'Expired').length,
        closed: jobs.filter((j) => j.status === 'Closed').length,
      };
      return jsonResponse(event, 200, { success: true, jobs, summary }, ['GET', 'POST']);
    }

    if (method === 'POST') {
      const denied = checkPerm('company:jobs:submit');
      if (denied) return denied;
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['GET', 'POST'] });
      }
      const validated = validateCompanyJobInput(parsed.data || {});
      if (!validated.valid || !validated.value) {
        return errorResponse(event, 400, 'Validation Error', validated.error || 'Invalid job submission.', {
          code: 'VALIDATION_ERROR',
          details: validated.field ? { field: validated.field } : undefined,
          allowedMethods: ['GET', 'POST'],
        });
      }
      const input = validated.value;
      const policy = resolveEmployerJobSubmissionPolicy(company);
      const nowDate = new Date().toISOString().split('T')[0];

      const created = await repo.createJob({
        title: input.title,
        employer: company.organizationName,
        description: input.description,
        location: input.location,
        qualification: input.qualification,
        skills: input.skills,
        employmentType: input.type,
        salary: input.salary,
        applicationUrl: input.applicationUrl || company.officialWebsite,
        source: policy.publishedAsVerified
          ? `${company.organizationName} (Verified Employer Portal)`
          : `${company.organizationName} (Employer Submission — Pending Verification)`,
        originalJobUrl: input.applicationUrl || company.officialWebsite,
        publicationDate: nowDate,
        expiryDate: input.deadline,
        lastVerificationDate: policy.publishedAsVerified ? nowDate : '',
        verificationStatus: policy.publishedAsVerified ? 'Verified' : 'Pending Verification',
        verificationNotes: policy.verificationNotes,
        isActive: true,
        isApproved: policy.isApproved,
        featured: false,
        responsibilities: input.responsibilities,
        requirements: input.requirements,
        sector: input.sector,
        companyAccountId: company.id,
        applicationDestinationType: input.applicationDestinationType,
        applicationEmail: input.applicationEmail,
        applicationInstructions: input.applicationInstructions,
      });

      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: policy.publishedAsVerified ? 'JOB_PUBLISHED_VERIFIED' : 'JOB_SUBMITTED_PENDING_REVIEW',
        targetType: 'job',
        targetId: created.id,
        status: 'success',
        ipMasked: maskedIp,
        details: `Submitted '${created.title}' (${input.applicationDestinationType}) — ${policy.status}.`,
      }).catch(() => {});

      return jsonResponse(
        event,
        201,
        {
          success: true,
          job: formatCompanyJob(created),
          publishedAsVerified: policy.publishedAsVerified,
          message: policy.publishedAsVerified
            ? 'Opening published as a verified employer listing.'
            : 'Opening submitted for administrator review. Unverified employers cannot publish verified listings until employer verification is approved.',
        },
        ['GET', 'POST']
      );
    }

    return methodNotAllowedResponse(event, ['GET', 'POST']);
  }

  // /api/company/jobs/:id and /api/company/jobs/:id/status
  if (subPath.startsWith('jobs/')) {
    const parts = subPath.slice('jobs/'.length).split('/').filter(Boolean);
    const jobId = decodeURIComponent(parts[0] || '');
    const action = parts[1] || '';

    if (!jobId || parts.length > 2) {
      return errorResponse(event, 404, 'Not Found', 'Company job endpoint not found.', {
        code: 'API_ROUTE_NOT_FOUND',
        allowedMethods: ['PUT', 'PATCH', 'DELETE'],
      });
    }

    if (action === 'status') {
      if (method !== 'PATCH') return methodNotAllowedResponse(event, ['PATCH']);
      const denied = checkPerm('company:jobs:edit');
      if (denied) return denied;
      const existing = await repo.getJobById(jobId);
      if (!existing || existing.companyAccountId !== company.id) {
        return errorResponse(event, 404, 'Not Found', 'Job opening not found under your organization account.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ['PATCH'],
        });
      }
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['PATCH'] });
      }
      const statusAction = String(parsed.data?.action || '').trim().toLowerCase();
      if (statusAction !== 'close' && statusAction !== 'reopen') {
        return errorResponse(event, 400, 'Validation Error', 'Action must be either "close" or "reopen".', {
          code: 'INVALID_ACTION',
          allowedMethods: ['PATCH'],
        });
      }
      const isActive = statusAction === 'reopen';
      const updated = await repo.updateJob(existing.id, { isActive });
      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: isActive ? 'JOB_REOPENED' : 'JOB_CLOSED',
        targetType: 'job',
        targetId: existing.id,
        status: 'success',
        ipMasked: maskedIp,
        details: `${isActive ? 'Reopened' : 'Closed'} '${existing.title}'.`,
      }).catch(() => {});

      return jsonResponse(
        event,
        200,
        {
          success: true,
          job: formatCompanyJob(updated),
          message: isActive ? 'Job opening reopened.' : 'Job opening closed.',
        },
        ['PATCH']
      );
    }

    if (action) {
      return errorResponse(event, 404, 'Not Found', 'Company job endpoint not found.', {
        code: 'API_ROUTE_NOT_FOUND',
        allowedMethods: ['PUT', 'DELETE'],
      });
    }

    if (method === 'PUT') {
      const denied = checkPerm('company:jobs:edit');
      if (denied) return denied;
      const existing = await repo.getJobById(jobId);
      if (!existing || existing.companyAccountId !== company.id) {
        return errorResponse(event, 404, 'Not Found', 'Job opening not found under your organization account.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ['PUT', 'DELETE'],
        });
      }
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['PUT', 'DELETE'] });
      }
      const validated = validateCompanyJobInput(parsed.data || {});
      if (!validated.valid || !validated.value) {
        return errorResponse(event, 400, 'Validation Error', validated.error || 'Invalid job update.', {
          code: 'VALIDATION_ERROR',
          details: validated.field ? { field: validated.field } : undefined,
          allowedMethods: ['PUT', 'DELETE'],
        });
      }
      const input = validated.value;
      const policy = resolveEmployerJobSubmissionPolicy(company);
      const nowDate = new Date().toISOString().split('T')[0];

      const updated = await repo.updateJob(existing.id, {
        title: input.title,
        employer: company.organizationName,
        description: input.description,
        location: input.location,
        qualification: input.qualification,
        skills: input.skills,
        employmentType: input.type,
        salary: input.salary,
        applicationUrl: input.applicationUrl || company.officialWebsite,
        originalJobUrl: input.applicationUrl || company.officialWebsite,
        expiryDate: input.deadline,
        responsibilities: input.responsibilities,
        requirements: input.requirements,
        sector: input.sector,
        applicationDestinationType: input.applicationDestinationType,
        applicationEmail: input.applicationEmail,
        applicationInstructions: input.applicationInstructions,
        isApproved: policy.publishedAsVerified ? existing.isApproved : false,
        verificationStatus: policy.publishedAsVerified ? existing.verificationStatus : 'Pending Verification',
        lastVerificationDate: policy.publishedAsVerified ? (existing.lastVerificationDate || nowDate) : '',
        verificationNotes: policy.publishedAsVerified ? existing.verificationNotes : policy.verificationNotes,
      });

      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'JOB_EDITED',
        targetType: 'job',
        targetId: existing.id,
        status: 'success',
        ipMasked: maskedIp,
        details: `Updated opening '${input.title}' (destination: ${input.applicationDestinationType}).`,
      }).catch(() => {});

      return jsonResponse(
        event,
        200,
        { success: true, job: formatCompanyJob(updated), message: 'Job opening updated successfully.' },
        ['PUT', 'DELETE']
      );
    }

    if (method === 'DELETE') {
      const denied = checkPerm('company:jobs:delete');
      if (denied) return denied;
      const existing = await repo.getJobById(jobId);
      if (!existing || existing.companyAccountId !== company.id) {
        return errorResponse(event, 404, 'Not Found', 'Job opening not found under your organization account.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ['PUT', 'DELETE'],
        });
      }
      await repo.deleteJob(existing.id);
      await repo.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'JOB_DELETED',
        targetType: 'job',
        targetId: existing.id,
        status: 'success',
        ipMasked: maskedIp,
        details: `Deleted opening '${existing.title}'.`,
      }).catch(() => {});

      return jsonResponse(event, 200, { success: true, message: 'Job opening deleted.' }, ['PUT', 'DELETE']);
    }

    return methodNotAllowedResponse(event, ['PUT', 'DELETE']);
  }

  // GET /api/company/sessions
  if (subPath === 'sessions') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    const denied = checkPerm('company:sessions:manage');
    if (denied) return denied;
    const sessions = await repo.listActiveCompanySessions(company.id, session.jti);
    return jsonResponse(event, 200, { success: true, sessions }, ['GET']);
  }

  // POST /api/company/sessions/revoke-others
  if (subPath === 'sessions/revoke-others') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const denied = checkPerm('company:sessions:manage');
    if (denied) return denied;
    const revokedCount = await repo.revokeAllCompanySessions(company.id, session.jti);
    await repo.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_SESSIONS_REVOKED_OTHERS',
      targetType: 'session',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Signed out ${revokedCount} other active device session(s).`,
    }).catch(() => {});

    return jsonResponse(
      event,
      200,
      { success: true, revokedCount, message: `Signed out ${revokedCount} other active device(s).` },
      ['POST']
    );
  }

  // DELETE /api/company/sessions/:jti
  if (subPath.startsWith('sessions/')) {
    if (method !== 'DELETE') return methodNotAllowedResponse(event, ['DELETE']);
    const denied = checkPerm('company:sessions:manage');
    if (denied) return denied;
    const targetJti = decodeURIComponent(subPath.slice('sessions/'.length)).trim();
    if (!targetJti) {
      return errorResponse(event, 400, 'Bad Request', 'Session identifier is required.', {
        code: 'INVALID_SESSION_ID',
        allowedMethods: ['DELETE'],
      });
    }
    const revoked = await repo.revokeCompanySessionByJti(targetJti, company.id);
    if (!revoked) {
      return errorResponse(event, 404, 'Not Found', 'Session not found.', {
        code: 'SESSION_NOT_FOUND',
        allowedMethods: ['DELETE'],
      });
    }
    const isCurrent = targetJti === session.jti;
    return jsonResponse(
      event,
      200,
      { success: true, message: 'Session revoked successfully.' },
      ['DELETE'],
      isCurrent ? { 'Set-Cookie': buildClearCompanySessionCookieHeader() } : {}
    );
  }

  // GET /api/company/audit-logs
  if (subPath === 'audit-logs') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    const denied = checkPerm('company:audit:read');
    if (denied) return denied;
    const logs = await repo.getCompanyAuditLogs(company.id, 100);
    return jsonResponse(event, 200, { success: true, logs }, ['GET']);
  }

  return errorResponse(event, 404, 'Not Found', 'Company portal endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
