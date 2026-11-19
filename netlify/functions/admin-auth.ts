/**
 * Netlify Function: admin-auth
 * Routes:
 * - POST /api/admin/login
 * - POST /api/admin/logout
 * - GET  /api/admin/me
 * - GET  /api/admin/audit-logs
 * - GET  /api/admin/sessions
 * - POST /api/admin/sessions/revoke-all
 * - POST /api/admin/auth/change-password
 * - POST /api/admin/password-reset/request
 * - POST /api/admin/password-reset/confirm
 */

import { getServerlessAdminCredentials } from '../../src/config/environment';
import {
  AdminUser,
  createPasswordResetToken,
  getPermissionsForRole,
  hashPassword,
  hashResetToken,
  LoginRateLimiter,
  normalizeAdminRole,
  validateAdminPasswordStrength,
  verifyPassword,
  verifyTotpCode,
} from '../../src/services/admin/adminAuthService';
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
import {
  buildAdminSessionCookieHeader,
  buildClearAdminSessionCookieHeader,
  createSignedAdminToken,
  extractAdminToken,
  isRequestOriginAllowed,
  requireServerlessAdminAuthAsync,
  revokeServerlessSessionJti,
  timingSafeStringCompare,
  verifySignedAdminToken,
} from './_shared/serverlessAuth';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/admin-auth', '/api/admin'];

const rateLimiter = new LoginRateLimiter();

export function resetServerlessAdminRateLimiterForTest(): void {
  rateLimiter.clear();
}

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
  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  if (subPath === 'login') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }

    const creds = getServerlessAdminCredentials();
    const sessionSecret = creds?.sessionSecret || (process.env.ADMIN_SESSION_SECRET || '').trim();
    if (!creds && (!repo || !sessionSecret || sessionSecret.length < 16)) {
      return serviceUnavailableResponse(
        event,
        'Administrator authentication is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD or ADMIN_PASSWORD_HASH, and ADMIN_SESSION_SECRET in Netlify.',
        'ADMIN_AUTH_NOT_CONFIGURED',
        ['POST']
      );
    }

    const ip = getClientIp(event);
    const rateCheck = rateLimiter.check(ip);
    if (!rateCheck.allowed) {
      const retryAfterSec = rateCheck.retryAfterSec || 900;
      return errorResponse(
        event,
        429,
        'Too Many Requests',
        `Account locked due to consecutive failed attempts. Retry in ${retryAfterSec} seconds.`,
        {
          code: 'RATE_LIMITED',
          details: { retryAfterSec },
          allowedMethods: ['POST'],
        }
      );
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['POST'],
      });
    }

    const username = sanitizeString(parsed.data.username);
    const password = typeof parsed.data.password === 'string' ? parsed.data.password : '';
    const totpCode = sanitizeString(parsed.data.totpCode);

    if (!username || !password) {
      return errorResponse(event, 400, 'Bad Request', 'Username and password required.', {
        code: 'MISSING_CREDENTIALS',
        allowedMethods: ['POST'],
      });
    }

    const normalizedInput = username.toLowerCase();
    const dbUser = repo ? await repo.getAdminUserByUsername(username).catch(() => null) : null;

    let matched = false;
    let resolvedUser: AdminUser | null = null;
    let activeTotpSecret: string | undefined;

    if (dbUser && dbUser.passwordHash) {
      const userMatches =
        timingSafeStringCompare(normalizedInput, dbUser.username.toLowerCase()) ||
        timingSafeStringCompare(normalizedInput, dbUser.email.toLowerCase());
      if (userMatches && verifyPassword(password, dbUser.passwordHash)) {
        matched = true;
        const role = normalizeAdminRole(dbUser.role);
        resolvedUser = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          name: dbUser.displayName,
          role,
          permissions: getPermissionsForRole(role),
        };
        if (dbUser.totpEnabled && dbUser.totpSecret) {
          activeTotpSecret = dbUser.totpSecret;
        }
      }
    }

    if (!matched && creds) {
      const expectedUsername = creds.username.toLowerCase();
      const validUser = timingSafeStringCompare(normalizedInput, expectedUsername);
      const validPass = creds.passwordHash
        ? verifyPassword(password, creds.passwordHash)
        : creds.password
        ? timingSafeStringCompare(password, creds.password)
        : false;

      if (validUser && validPass) {
        matched = true;
        const role = normalizeAdminRole(creds.role);
        resolvedUser = {
          id: dbUser?.id || 'admin-master-001',
          username: creds.username,
          email: creds.username.includes('@') ? creds.username : `${creds.username}@bionexa.org`,
          name: dbUser?.displayName || 'BIO-INEXA Operations Admin',
          role,
          permissions: getPermissionsForRole(role),
        };
        activeTotpSecret = creds.totpSecret;
      }
    }

    if (!matched || !resolvedUser) {
      const failure = rateLimiter.recordFailure(ip, Date.now(), {
        usernameAttempted: username,
        reason: 'INVALID_CREDENTIALS',
      });
      const postCheck = rateLimiter.check(ip);
      if (repo) {
        await repo
          .recordLoginAttempt({
            identifier: ip,
            ipAddress: ip,
            attemptedUsername: username,
            success: false,
            failureReason: 'INVALID_CREDENTIALS',
            lockedUntilIso: failure.isLocked && failure.retryAfterSec
              ? new Date(Date.now() + failure.retryAfterSec * 1000).toISOString()
              : null,
          })
          .catch(() => {});
        await repo
          .recordAdminAuditLog({
            actorUsername: username,
            action: failure.isLocked ? 'ADMIN_LOGIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
            entityType: 'admin_auth',
            ipAddress: ip,
            details: { isLocked: failure.isLocked, remainingAttempts: postCheck.remainingAttempts },
          })
          .catch(() => {});
      }
      return errorResponse(event, 401, 'Unauthorized', 'Invalid administrator credentials.', {
        code: 'INVALID_CREDENTIALS',
        details: {
          remainingAttempts: postCheck.remainingAttempts,
          isLocked: failure.isLocked,
        },
        allowedMethods: ['POST'],
      });
    }

    // Optional Two-Factor Authentication verification
    if (activeTotpSecret) {
      if (!totpCode) {
        return errorResponse(
          event,
          401,
          'MFA Required',
          'Enter the 6-digit authenticator verification code to finish signing in.',
          {
            code: 'MFA_REQUIRED',
            details: { requires2fa: true },
            allowedMethods: ['POST'],
          }
        );
      }

      if (!verifyTotpCode(activeTotpSecret, totpCode)) {
        const failure = rateLimiter.recordFailure(ip, Date.now(), {
          usernameAttempted: username,
          reason: 'INVALID_2FA_CODE',
        });
        const postCheck = rateLimiter.check(ip);
        if (repo) {
          await repo
            .recordLoginAttempt({
              identifier: ip,
              ipAddress: ip,
              attemptedUsername: username,
              success: false,
              failureReason: 'INVALID_2FA_CODE',
            })
            .catch(() => {});
        }
        return errorResponse(event, 401, 'Unauthorized', 'Invalid two-factor authentication code.', {
          code: 'INVALID_2FA_CODE',
          details: {
            requires2fa: true,
            remainingAttempts: postCheck.remainingAttempts,
            isLocked: failure.isLocked,
          },
          allowedMethods: ['POST'],
        });
      }
    }

    rateLimiter.reset(ip);

    const { token, jti, expiresAt } = createSignedAdminToken(resolvedUser, sessionSecret);
    const cookieHeader = buildAdminSessionCookieHeader(token);

    if (repo) {
      await repo
        .upsertAdminUser({
          id: resolvedUser.id,
          username: resolvedUser.username,
          email: resolvedUser.email,
          displayName: resolvedUser.name,
          role: resolvedUser.role,
        })
        .catch(() => {});
      await repo
        .createAdminSession({
          jti,
          adminUserId: resolvedUser.id,
          actorUsername: resolvedUser.username,
          role: resolvedUser.role,
          ipAddress: ip,
          userAgent: getHeader(event.headers, 'user-agent') || '',
          expiresAtMs: expiresAt,
        })
        .catch(() => {});
      await repo
        .recordLoginAttempt({
          identifier: ip,
          ipAddress: ip,
          attemptedUsername: resolvedUser.username,
          success: true,
        })
        .catch(() => {});
      await repo
        .recordAdminAuditLog({
          adminUserId: resolvedUser.id,
          actorUsername: resolvedUser.username,
          action: 'ADMIN_LOGIN_SUCCESS',
          entityType: 'admin_session',
          entityId: jti,
          ipAddress: ip,
          details: { role: resolvedUser.role },
        })
        .catch(() => {});
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Administrative session authenticated successfully.',
        user: resolvedUser,
        permissions: resolvedUser.permissions,
        expiresAt,
      },
      ['POST'],
      { 'Set-Cookie': cookieHeader }
    );
  }

  if (subPath === 'logout') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!isRequestOriginAllowed(event)) {
      return errorResponse(event, 403, 'Forbidden', 'Cross-origin logout rejected.', {
        code: 'CSRF_ORIGIN_DENIED',
        allowedMethods: ['POST'],
      });
    }

    const token = extractAdminToken(event);
    const creds = getServerlessAdminCredentials();
    const sessionSecret = creds?.sessionSecret || (process.env.ADMIN_SESSION_SECRET || '').trim();
    if (token && sessionSecret) {
      const verified = verifySignedAdminToken(token, sessionSecret);
      if (verified) {
        if (verified.jti) {
          revokeServerlessSessionJti(verified.jti);
        }
        if (repo) {
          await repo.revokeAdminSession(verified.jti).catch(() => false);
          await repo
            .recordAdminAuditLog({
              adminUserId: verified.user.id,
              actorUsername: verified.user.username,
              action: 'ADMIN_LOGOUT',
              entityType: 'admin_session',
              entityId: verified.jti,
              ipAddress: getClientIp(event),
            })
            .catch(() => {});
        }
      }
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Administrative session terminated.',
      },
      ['POST'],
      { 'Set-Cookie': buildClearAdminSessionCookieHeader() }
    );
  }

  if (subPath === 'me') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }

    const auth = await requireServerlessAdminAuthAsync(event, ['GET']);
    if (auth.authorized === false) {
      return jsonResponse(
        event,
        401,
        {
          success: false,
          authenticated: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        },
        ['GET']
      );
    }

    return jsonResponse(
      event,
      200,
      {
        authenticated: true,
        user: auth.user,
        permissions: auth.user.permissions || getPermissionsForRole(auth.user.role),
        expiresAt: auth.expiresAt,
      },
      ['GET']
    );
  }

  if (subPath === 'audit-logs') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }
    const auth = await requireServerlessAdminAuthAsync(event, ['GET'], {
      requiredPermission: 'audit:read',
    });
    if (auth.authorized === false) return auth.response;

    if (!repo) {
      return jsonResponse(
        event,
        200,
        {
          success: true,
          logs: [],
          loginAttempts: rateLimiter.getFailureEvents(50),
          persistentDbConfigured: false,
        },
        ['GET']
      );
    }

    const [logs, loginAttempts] = await Promise.all([
      repo.getAdminAuditLogs(100),
      repo.getRecentLoginAttempts(50),
    ]);
    return jsonResponse(
      event,
      200,
      {
        success: true,
        logs,
        loginAttempts,
        persistentDbConfigured: true,
      },
      ['GET']
    );
  }

  if (subPath === 'sessions') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }
    const auth = await requireServerlessAdminAuthAsync(event, ['GET'], {
      requiredPermission: 'dashboard:read',
    });
    if (auth.authorized === false) return auth.response;

    if (!repo) {
      return jsonResponse(
        event,
        200,
        {
          success: true,
          sessions: [
            {
              jti: auth.jti,
              actorUsername: auth.user.username,
              role: auth.user.role,
              expiresAt: new Date(auth.expiresAt).toISOString(),
              current: true,
            },
          ],
          persistentDbConfigured: false,
        },
        ['GET']
      );
    }

    const sessions = await repo.listActiveAdminSessions();
    return jsonResponse(
      event,
      200,
      {
        success: true,
        sessions: sessions.map((s) => ({ ...s, current: s.jti === auth.jti })),
        persistentDbConfigured: true,
      },
      ['GET']
    );
  }

  if (subPath === 'sessions/revoke-all') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    const auth = await requireServerlessAdminAuthAsync(event, ['POST']);
    if (auth.authorized === false) return auth.response;

    let revokedCount = 0;
    if (repo) {
      revokedCount = await repo.revokeAllAdminSessions(auth.user.username, auth.jti);
      await repo
        .recordAdminAuditLog({
          adminUserId: auth.user.id,
          actorUsername: auth.user.username,
          action: 'ADMIN_SESSIONS_REVOKED_OTHERS',
          entityType: 'admin_session',
          entityId: auth.jti,
          ipAddress: getClientIp(event),
          details: { revokedCount },
        })
        .catch(() => {});
    }

    return jsonResponse(
      event,
      200,
      {
        success: true,
        revokedCount,
        message: 'All other administrative sessions for this account have been revoked.',
      },
      ['POST']
    );
  }

  if (subPath === 'auth/change-password') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    const auth = await requireServerlessAdminAuthAsync(event, ['POST']);
    if (auth.authorized === false) return auth.response;

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ['POST'],
      });
    }

    const currentPassword = typeof parsed.data.currentPassword === 'string' ? parsed.data.currentPassword : '';
    const newPassword = typeof parsed.data.newPassword === 'string' ? parsed.data.newPassword : '';
    const strength = validateAdminPasswordStrength(newPassword);
    if (!strength.valid) {
      return errorResponse(event, 400, 'Validation Error', strength.error || 'Weak password.', {
        code: 'WEAK_PASSWORD',
        allowedMethods: ['POST'],
      });
    }

    const dbUser = repo ? await repo.getAdminUserByUsername(auth.user.username).catch(() => null) : null;
    if (!repo || !dbUser || !dbUser.passwordHash) {
      return errorResponse(
        event,
        400,
        'Environment Managed Password',
        'Environment-configured administrator passwords must be rotated by updating ADMIN_PASSWORD_HASH in your deployment settings (use scripts/admin-password-reset.ts).',
        { code: 'ENV_MANAGED_PASSWORD', allowedMethods: ['POST'] }
      );
    }

    if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
      return errorResponse(event, 401, 'Unauthorized', 'Current administrator password is incorrect.', {
        code: 'INVALID_CURRENT_PASSWORD',
        allowedMethods: ['POST'],
      });
    }

    const newHash = hashPassword(newPassword);
    await repo.updateAdminPasswordHash(dbUser.id, newHash);
    const revokedCount = await repo.revokeAllAdminSessions(auth.user.username, auth.jti);
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_PASSWORD_CHANGED',
        entityType: 'admin_user',
        entityId: auth.user.id,
        ipAddress: getClientIp(event),
        details: { revokedOtherSessions: revokedCount },
      })
      .catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        revokedOtherSessions: revokedCount,
        message: 'Administrator password rotated and all other sessions revoked.',
      },
      ['POST']
    );
  }

  if (subPath === 'password-reset/request') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Password reset tokens require Supabase PostgreSQL configuration. Rotate ADMIN_PASSWORD_HASH in Netlify environment variables instead.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const ip = getClientIp(event);
    const rateCheck = rateLimiter.check(`reset:${ip}`);
    if (!rateCheck.allowed) {
      return errorResponse(event, 429, 'Too Many Requests', 'Too many password reset requests. Try again later.', {
        code: 'RATE_LIMITED',
        allowedMethods: ['POST'],
      });
    }
    rateLimiter.recordFailure(`reset:${ip}`, Date.now(), { reason: 'PASSWORD_RESET_REQUEST' });

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON' });
    }
    const username = sanitizeString(parsed.data.username);
    if (!username) {
      return errorResponse(event, 400, 'Bad Request', 'Administrator username or email is required.', {
        code: 'MISSING_USERNAME',
      });
    }

    const dbUser = await repo.getAdminUserByUsername(username).catch(() => null);
    if (dbUser) {
      const reset = createPasswordResetToken();
      await repo.createPasswordResetRecord({
        adminUserId: dbUser.id,
        actorUsername: dbUser.username,
        tokenHash: reset.tokenHash,
        expiresAtIso: reset.expiresAtIso,
      });
      await repo
        .recordAdminAuditLog({
          adminUserId: dbUser.id,
          actorUsername: dbUser.username,
          action: 'ADMIN_PASSWORD_RESET_REQUESTED',
          entityType: 'admin_password_reset',
          ipAddress: ip,
          details: { expiresAt: reset.expiresAtIso },
        })
        .catch(() => {});
    }

    // Never return raw token over HTTP or reveal account existence
    return jsonResponse(
      event,
      200,
      {
        success: true,
        message:
          'If an eligible administrator account exists, a time-limited password reset request has been logged for operator verification.',
      },
      ['POST']
    );
  }

  if (subPath === 'password-reset/confirm') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Password reset confirmation requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Bad Request', parsed.message, { code: 'INVALID_JSON' });
    }

    const rawToken = sanitizeString(parsed.data.token);
    const newPassword = typeof parsed.data.newPassword === 'string' ? parsed.data.newPassword : '';
    if (!rawToken) {
      return errorResponse(event, 400, 'Bad Request', 'Reset token is required.', { code: 'MISSING_TOKEN' });
    }

    const strength = validateAdminPasswordStrength(newPassword);
    if (!strength.valid) {
      return errorResponse(event, 400, 'Validation Error', strength.error || 'Weak password.', {
        code: 'WEAK_PASSWORD',
      });
    }

    const newHash = hashPassword(newPassword);
    const consumed = await repo.consumePasswordResetToken(hashResetToken(rawToken), newHash);
    if (!consumed.ok) {
      return errorResponse(event, 400, 'Invalid Token', consumed.error || 'Invalid or expired reset token.', {
        code: 'INVALID_RESET_TOKEN',
      });
    }

    await repo
      .recordAdminAuditLog({
        adminUserId: consumed.adminUserId,
        actorUsername: consumed.actorUsername || 'admin',
        action: 'ADMIN_PASSWORD_RESET_COMPLETED',
        entityType: 'admin_user',
        entityId: consumed.adminUserId,
        ipAddress: getClientIp(event),
      })
      .catch(() => {});

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Administrator password reset successfully. All active sessions have been revoked.',
      },
      ['POST']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Admin auth endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
