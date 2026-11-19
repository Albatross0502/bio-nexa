/**
 * Netlify Function: student-auth
 * Phase 14: Student Authentication, Profile Management, Session Management & DPDP Deletion API
 *
 * Routes:
 * - POST   /api/student/register
 * - POST   /api/student/login
 * - POST   /api/student/logout
 * - GET    /api/student/me
 * - POST   /api/student/verify-email
 * - POST   /api/student/resend-verification
 * - POST   /api/student/password-reset/request
 * - POST   /api/student/password-reset/confirm
 * - PATCH  /api/student/profile
 * - POST   /api/student/change-password
 * - GET    /api/student/sessions
 * - DELETE /api/student/sessions/:jti
 * - POST   /api/student/sessions/revoke-others
 * - POST   /api/student/deletion-request
 * - DELETE /api/student/deletion-request
 */

import { getRuntimeEnvironmentConfig, resolveCorsOrigin } from '../../src/config/environment';
import {
  createEmailVerificationToken,
  createStudentPasswordResetToken,
  createStudentSessionToken,
  hashStudentPassword,
  hasStudentPermission,
  isValidStudentEmail,
  maskIpAddress,
  normalizeStudentEmail,
  STUDENT_SESSION_COOKIE,
  STUDENT_SESSION_DURATION_MS,
  StudentAuthRateLimiter,
  toSafeStudentProfile,
  validateDeletionRequestInput,
  validateStudentPasswordStrength,
  validateStudentProfileUpdateInput,
  validateStudentRegistrationInput,
  verifyStudentPassword,
} from '../../src/services/student/studentAuthService';
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

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];
const BASE_PREFIXES = ['/.netlify/functions/student-auth', '/api/student'];

const studentLoginRateLimiter = new StudentAuthRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
const studentRegisterRateLimiter = new StudentAuthRateLimiter(6, 60 * 60 * 1000, 30 * 60 * 1000);
const studentResetRateLimiter = new StudentAuthRateLimiter(5, 30 * 60 * 1000, 30 * 60 * 1000);

export function resetServerlessStudentRateLimitersForTest(): void {
  studentLoginRateLimiter.clear();
  studentRegisterRateLimiter.clear();
  studentResetRateLimiter.clear();
}

function getClientIp(event: NetlifyEvent): string {
  return (
    getHeader(event.headers, 'x-nf-client-connection-ip') ||
    getHeader(event.headers, 'x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

function extractStudentSessionToken(event: NetlifyEvent): string | null {
  const cookies = parseCookies(getHeader(event.headers, 'cookie'));
  return cookies[STUDENT_SESSION_COOKIE] || null;
}

function buildStudentSessionCookieHeader(
  token: string,
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const maxAgeSec = Math.floor(STUDENT_SESSION_DURATION_MS / 1000);
  const parts = [
    `${STUDENT_SESSION_COOKIE}=${encodeURIComponent(token)}`,
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

function buildClearStudentSessionCookieHeader(
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const parts = [
    `${STUDENT_SESSION_COOKIE}=`,
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

function isStudentRequestOriginAllowed(
  event: NetlifyEvent,
  env: Record<string, string | undefined> = process.env
): boolean {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  const cookies = parseCookies(getHeader(event.headers, 'cookie'));
  if (!cookies[STUDENT_SESSION_COOKIE]) {
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

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();
  const ip = getClientIp(event);

  if (!isStudentRequestOriginAllowed(event)) {
    return errorResponse(
      event,
      403,
      'Forbidden',
      'Cross-origin state-changing request rejected by CSRF protection.',
      { code: 'CSRF_ORIGIN_DENIED', allowedMethods: ALLOWED_METHODS }
    );
  }

  // POST /api/student/register
  if (subPath === 'register') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }

    const validation = validateStudentRegistrationInput(parsed.data);
    if (!validation.valid || !validation.data) {
      return errorResponse(event, 400, 'Validation Error', validation.error || 'Invalid registration details.', {
        code: 'INVALID_REGISTRATION',
        allowedMethods: ['POST'],
      });
    }

    const rate = studentRegisterRateLimiter.consume(`reg:${ip}`);
    if (!rate.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many registration attempts. Please try again in ${rate.retryAfterSec || 1800} seconds.`,
        { code: 'RATE_LIMITED', details: { retryAfterSec: rate.retryAfterSec }, allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Student account persistence requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const existing = await repo.getStudentByEmail(validation.data.email);
    if (existing) {
      return errorResponse(
        event,
        409,
        'Account Exists',
        'An account with this email address is already registered. Please sign in or reset your password.',
        { code: 'EMAIL_ALREADY_REGISTERED', allowedMethods: ['POST'] }
      );
    }

    const passwordHash = hashStudentPassword(validation.data.password);
    const verification = createEmailVerificationToken();
    const account = await repo.createStudentAccount({
      email: validation.data.email,
      passwordHash,
      fullName: validation.data.fullName,
      degreeTitle: validation.data.degreeTitle,
      institution: validation.data.institution,
      specialization: validation.data.specialization,
      graduationYear: validation.data.graduationYear,
      verificationTokenHash: verification.tokenHash,
      verificationExpiresAt: verification.expiresAtIso,
      privacyConsentAt: new Date().toISOString(),
    });

    const sessionToken = createStudentSessionToken();
    await repo.createStudentSession({
      jti: sessionToken.jti,
      studentId: account.id,
      tokenHash: sessionToken.tokenHash,
      userAgent: String(getHeader(event.headers, 'user-agent') || 'Unknown Browser').slice(0, 240),
      ipAddressMasked: maskIpAddress(ip),
      expiresAt: sessionToken.expiresAtIso,
    });

    return jsonResponse(
      event,
      201,
      {
        success: true,
        student: toSafeStudentProfile(account),
        verificationRequired: true,
        message: 'Student account created successfully. Please check your email to verify your address.',
      },
      ['POST'],
      { 'Set-Cookie': buildStudentSessionCookieHeader(sessionToken.rawToken) }
    );
  }

  // POST /api/student/login
  if (subPath === 'login') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }

    const email = normalizeStudentEmail(parsed.data.email);
    const password = typeof parsed.data.password === 'string' ? parsed.data.password : '';
    if (!isValidStudentEmail(email) || !password) {
      return errorResponse(event, 400, 'Validation Error', 'Please enter a valid email address and password.', {
        code: 'MISSING_CREDENTIALS',
        allowedMethods: ['POST'],
      });
    }

    const rateKey = `login:${ip}:${email}`;
    const rateCheck = studentLoginRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many failed sign-in attempts. Retry in ${rateCheck.retryAfterSec || 900} seconds.`,
        { code: 'RATE_LIMITED', details: { retryAfterSec: rateCheck.retryAfterSec }, allowedMethods: ['POST'] }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Student authentication requires Supabase PostgreSQL configuration on Netlify.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const account = await repo.getStudentByEmail(email);
    const valid = Boolean(account && verifyStudentPassword(password, account.passwordHash));
    if (!valid || !account) {
      const fail = studentLoginRateLimiter.consume(rateKey);
      return errorResponse(event, 401, 'Unauthorized', 'Invalid email address or password.', {
        code: 'INVALID_CREDENTIALS',
        details: { remainingAttempts: fail.remainingAttempts, retryAfterSec: fail.retryAfterSec },
        allowedMethods: ['POST'],
      });
    }

    if (account.accountStatus === 'suspended') {
      return errorResponse(event, 403, 'Account Suspended', 'This student account is currently suspended.', {
        code: 'ACCOUNT_SUSPENDED',
        allowedMethods: ['POST'],
      });
    }

    studentLoginRateLimiter.reset(rateKey);
    const sessionToken = createStudentSessionToken();
    await repo.createStudentSession({
      jti: sessionToken.jti,
      studentId: account.id,
      tokenHash: sessionToken.tokenHash,
      userAgent: String(getHeader(event.headers, 'user-agent') || 'Unknown Browser').slice(0, 240),
      ipAddressMasked: maskIpAddress(ip),
      expiresAt: sessionToken.expiresAtIso,
    });
    await repo.updateStudentLastLogin(account.id);
    const refreshed = (await repo.getStudentById(account.id)) || account;

    return jsonResponse(
      event,
      200,
      {
        success: true,
        student: toSafeStudentProfile(refreshed),
        message: 'Signed in successfully.',
      },
      ['POST'],
      { 'Set-Cookie': buildStudentSessionCookieHeader(sessionToken.rawToken) }
    );
  }

  // POST /api/student/logout
  if (subPath === 'logout') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const rawToken = extractStudentSessionToken(event);
    if (rawToken && repo) {
      const verified = await repo.validateStudentSessionToken(rawToken).catch(() => null);
      if (verified) {
        await repo.revokeStudentSessionByJti(verified.session.jti, verified.student.id).catch(() => false);
      }
    }

    return jsonResponse(
      event,
      200,
      { success: true, message: 'Signed out successfully.' },
      ['POST'],
      { 'Set-Cookie': buildClearStudentSessionCookieHeader() }
    );
  }

  // GET /api/student/me
  if (subPath === 'me') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);

    const rawToken = extractStudentSessionToken(event);
    if (!rawToken || !repo) {
      return jsonResponse(event, 200, { authenticated: false, student: null, session: null }, ['GET']);
    }

    const verified = await repo.validateStudentSessionToken(rawToken).catch(() => null);
    if (!verified) {
      return jsonResponse(
        event,
        200,
        { authenticated: false, student: null, session: null },
        ['GET'],
        { 'Set-Cookie': buildClearStudentSessionCookieHeader() }
      );
    }

    return jsonResponse(
      event,
      200,
      {
        authenticated: true,
        student: toSafeStudentProfile(verified.student),
        session: {
          jti: verified.session.jti,
          expiresAt: verified.session.expiresAt,
        },
      },
      ['GET']
    );
  }

  // POST /api/student/verify-email
  if (subPath === 'verify-email') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const rawToken = sanitizeString(parsed.data.token);
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

    const verifiedAccount = await repo.verifyStudentEmailByToken(rawToken);
    if (!verifiedAccount) {
      return errorResponse(event, 400, 'Verification Failed', 'Verification token is invalid or expired.', {
        code: 'VERIFICATION_FAILED',
        allowedMethods: ['POST'],
      });
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        student: toSafeStudentProfile(verifiedAccount),
        message: 'Email address verified successfully.',
      },
      ['POST']
    );
  }

  // POST /api/student/password-reset/request
  if (subPath === 'password-reset/request') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const email = normalizeStudentEmail(parsed.data.email);
    if (!isValidStudentEmail(email)) {
      return errorResponse(event, 400, 'Validation Error', 'Please enter a valid email address.', {
        code: 'INVALID_EMAIL',
        allowedMethods: ['POST'],
      });
    }

    const rate = studentResetRateLimiter.consume(`reset-req:${ip}`);
    if (!rate.allowed) {
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Too many password reset requests. Retry in ${rate.retryAfterSec || 1800} seconds.`,
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

    const account = await repo.getStudentByEmail(email);
    if (account && account.accountStatus !== 'suspended') {
      const reset = createStudentPasswordResetToken();
      await repo.setStudentPasswordResetToken(account.id, reset.tokenHash, reset.expiresAtIso);
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'If an account matches that email address, a time-limited password reset link has been generated.',
      },
      ['POST']
    );
  }

  // POST /api/student/password-reset/confirm
  if (subPath === 'password-reset/confirm') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const rawToken = sanitizeString(parsed.data.token);
    const newPassword = typeof parsed.data.newPassword === 'string' ? parsed.data.newPassword : '';
    if (!rawToken || rawToken.length < 16) {
      return errorResponse(event, 400, 'Validation Error', 'Reset token is required.', {
        code: 'INVALID_TOKEN',
        allowedMethods: ['POST'],
      });
    }

    const pwCheck = validateStudentPasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return errorResponse(event, 400, 'Validation Error', pwCheck.error || 'Weak password.', {
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

    const updatedAccount = await repo.consumeStudentPasswordResetToken(
      rawToken,
      hashStudentPassword(newPassword)
    );
    if (!updatedAccount) {
      return errorResponse(event, 400, 'Invalid Token', 'Reset token is invalid or expired.', {
        code: 'INVALID_RESET_TOKEN',
        allowedMethods: ['POST'],
      });
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Password updated successfully and all existing sessions have been signed out. Please sign in with your new password.',
      },
      ['POST'],
      { 'Set-Cookie': buildClearStudentSessionCookieHeader() }
    );
  }

  // All remaining routes require an authenticated student session
  const rawToken = extractStudentSessionToken(event);
  if (!rawToken) {
    return errorResponse(event, 401, 'Unauthorized', 'Please sign in to your student account to continue.', {
      code: 'STUDENT_AUTH_REQUIRED',
      allowedMethods: ALLOWED_METHODS,
    });
  }
  if (!repo) {
    return serviceUnavailableResponse(
      event,
      'Student account operations require Supabase PostgreSQL configuration on Netlify.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ALLOWED_METHODS
    );
  }

  const verified = await repo.validateStudentSessionToken(rawToken).catch(() => null);
  if (!verified) {
    return errorResponse(event, 401, 'Unauthorized', 'Your student session has expired or been revoked. Please sign in again.', {
      code: 'STUDENT_SESSION_INVALID',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  const safeProfile = toSafeStudentProfile(verified.student);

  // POST /api/student/resend-verification
  if (subPath === 'resend-verification') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    if (verified.student.emailVerified) {
      return jsonResponse(event, 200, { success: true, message: 'Your email address is already verified.' }, ['POST']);
    }
    const rate = studentResetRateLimiter.consume(`verify-resend:${verified.student.id}`);
    if (!rate.allowed) {
      return errorResponse(event, 429, 'Too Many Requests', 'Please wait before requesting another verification email.', {
        code: 'RATE_LIMITED',
        details: { retryAfterSec: rate.retryAfterSec },
        allowedMethods: ['POST'],
      });
    }
    const verification = createEmailVerificationToken();
    await repo.setStudentVerificationToken(verified.student.id, verification.tokenHash, verification.expiresAtIso);
    return jsonResponse(
      event,
      200,
      { success: true, message: 'A fresh verification email link has been issued.' },
      ['POST']
    );
  }

  // PATCH /api/student/profile
  if (subPath === 'profile') {
    if (method !== 'PATCH') return methodNotAllowedResponse(event, ['PATCH']);
    if (!hasStudentPermission(safeProfile, 'student:profile:write')) {
      return errorResponse(event, 403, 'Forbidden', 'You do not have permission to edit this profile.', {
        code: 'FORBIDDEN',
        allowedMethods: ['PATCH'],
      });
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['PATCH'] });
    }
    const validation = validateStudentProfileUpdateInput(parsed.data);
    if (!validation.valid || !validation.data) {
      return errorResponse(event, 400, 'Validation Error', validation.error || 'Invalid profile update payload.', {
        code: 'INVALID_PROFILE_UPDATE',
        allowedMethods: ['PATCH'],
      });
    }
    const updated = await repo.updateStudentProfile(verified.student.id, validation.data);
    if (!updated) {
      return errorResponse(event, 404, 'Not Found', 'Student account not found.', {
        code: 'STUDENT_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    return jsonResponse(
      event,
      200,
      { success: true, student: toSafeStudentProfile(updated), message: 'Student profile updated successfully.' },
      ['PATCH']
    );
  }

  // POST /api/student/change-password
  if (subPath === 'change-password') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST'] });
    }
    const currentPassword = typeof parsed.data.currentPassword === 'string' ? parsed.data.currentPassword : '';
    const newPassword = typeof parsed.data.newPassword === 'string' ? parsed.data.newPassword : '';
    if (!verifyStudentPassword(currentPassword, verified.student.passwordHash)) {
      return errorResponse(event, 401, 'Unauthorized', 'Current password is incorrect.', {
        code: 'INVALID_CURRENT_PASSWORD',
        allowedMethods: ['POST'],
      });
    }
    const pwCheck = validateStudentPasswordStrength(newPassword, verified.student.email);
    if (!pwCheck.valid) {
      return errorResponse(event, 400, 'Validation Error', pwCheck.error || 'Weak password.', {
        code: 'WEAK_PASSWORD',
        allowedMethods: ['POST'],
      });
    }
    await repo.updateStudentPasswordHash(verified.student.id, hashStudentPassword(newPassword));
    const revokedCount = await repo.revokeAllStudentSessions(verified.student.id, verified.session.jti);
    return jsonResponse(
      event,
      200,
      {
        success: true,
        revokedOtherSessions: revokedCount,
        message: 'Password updated successfully. All other active sessions were signed out.',
      },
      ['POST']
    );
  }

  // GET /api/student/sessions
  if (subPath === 'sessions') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    const sessions = await repo.listStudentSessions(verified.student.id, verified.session.jti);
    return jsonResponse(event, 200, { success: true, sessions }, ['GET']);
  }

  // POST /api/student/sessions/revoke-others
  if (subPath === 'sessions/revoke-others') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const revokedCount = await repo.revokeAllStudentSessions(verified.student.id, verified.session.jti);
    return jsonResponse(
      event,
      200,
      {
        success: true,
        revokedCount,
        message: revokedCount > 0 ? `Signed out ${revokedCount} other active session(s).` : 'No other active sessions found.',
      },
      ['POST']
    );
  }

  // DELETE /api/student/sessions/:jti
  if (subPath.startsWith('sessions/')) {
    if (method !== 'DELETE') return methodNotAllowedResponse(event, ['DELETE']);
    const jti = decodeURIComponent(subPath.slice('sessions/'.length)).trim();
    if (!jti) {
      return errorResponse(event, 400, 'Bad Request', 'Session identifier is required.', {
        code: 'INVALID_SESSION_ID',
        allowedMethods: ['DELETE'],
      });
    }
    const revoked = await repo.revokeStudentSessionByJti(jti, verified.student.id);
    if (!revoked) {
      return errorResponse(event, 404, 'Not Found', 'Active session not found for your account.', {
        code: 'SESSION_NOT_FOUND',
        allowedMethods: ['DELETE'],
      });
    }
    const isCurrent = jti === verified.session.jti;
    return jsonResponse(
      event,
      200,
      { success: true, revokedCurrent: isCurrent, message: 'Session revoked successfully.' },
      ['DELETE'],
      isCurrent ? { 'Set-Cookie': buildClearStudentSessionCookieHeader() } : {}
    );
  }

  // POST & DELETE /api/student/deletion-request
  if (subPath === 'deletion-request') {
    if (method === 'POST') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON', allowedMethods: ['POST', 'DELETE'] });
      }
      const validation = validateDeletionRequestInput(parsed.data);
      if (!validation.valid || !validation.data) {
        return errorResponse(event, 400, 'Validation Error', validation.error || 'Invalid deletion request.', {
          code: 'INVALID_DELETION_REQUEST',
          allowedMethods: ['POST', 'DELETE'],
        });
      }
      if (!verifyStudentPassword(validation.data.password, verified.student.passwordHash)) {
        return errorResponse(event, 401, 'Unauthorized', 'Current password is incorrect.', {
          code: 'INVALID_CURRENT_PASSWORD',
          allowedMethods: ['POST', 'DELETE'],
        });
      }
      const result = await repo.createStudentDeletionRequest(
        verified.student.id,
        validation.data.reason,
        validation.data.mode
      );
      if (result.deletedImmediately) {
        return jsonResponse(
          event,
          200,
          {
            success: true,
            deletedImmediately: true,
            requestId: result.request.id,
            student: null,
            message: 'Your student account and active sessions have been permanently erased.',
          },
          ['POST', 'DELETE'],
          { 'Set-Cookie': buildClearStudentSessionCookieHeader() }
        );
      }
      const updated = await repo.getStudentById(verified.student.id);
      return jsonResponse(
        event,
        200,
        {
          success: true,
          deletedImmediately: false,
          requestId: result.request.id,
          student: updated ? toSafeStudentProfile(updated) : null,
          message: 'Account deletion request recorded under DPDP privacy controls. You may cancel it prior to processing.',
        },
        ['POST', 'DELETE']
      );
    }

    if (method === 'DELETE') {
      const updated = await repo.cancelStudentDeletionRequest(verified.student.id);
      if (!updated) {
        return errorResponse(event, 404, 'Not Found', 'Student account not found.', {
          code: 'STUDENT_NOT_FOUND',
          allowedMethods: ['POST', 'DELETE'],
        });
      }
      return jsonResponse(
        event,
        200,
        {
          success: true,
          student: toSafeStudentProfile(updated),
          message: 'Pending account deletion request has been cancelled.',
        },
        ['POST', 'DELETE']
      );
    }

    return methodNotAllowedResponse(event, ['POST', 'DELETE']);
  }

  return errorResponse(event, 404, 'Not Found', 'Student auth endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
