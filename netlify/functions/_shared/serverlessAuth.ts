/**
 * Cryptographically Signed Admin Authentication Helpers
 * for Netlify Serverless Functions with jti tracking, session revocation,
 * RBAC permission checks, and Origin-based CSRF protection.
 */

import crypto from 'node:crypto';
import {
  getRuntimeEnvironmentConfig,
  getServerlessAdminCredentials,
  resolveCorsOrigin,
} from '../../../src/config/environment';
import {
  AdminPermission,
  AdminUser,
  getPermissionsForRole,
  hasAdminPermission,
  normalizeAdminRole,
  SESSION_DURATION_MS,
} from '../../../src/services/admin/adminAuthService';
import {
  errorResponse,
  getHeader,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './http';
import { getSupabaseRepository } from './supabaseDb';

export const ADMIN_SESSION_COOKIE = 'bionexa_admin_session';

interface SignedTokenPayload {
  jti: string;
  user: AdminUser;
  iat: number;
  exp: number;
}

const revokedSessionJtis = new Set<string>();

export function revokeServerlessSessionJti(jti?: string): void {
  if (jti) {
    revokedSessionJtis.add(jti);
  }
}

export function isServerlessSessionJtiRevoked(jti?: string): boolean {
  if (!jti) return false;
  return revokedSessionJtis.has(jti);
}

export function clearRevokedServerlessJtisForTest(): void {
  revokedSessionJtis.clear();
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function signSegment(segment: string, secret: string): string {
  return toBase64Url(crypto.createHmac('sha256', secret).update(segment).digest());
}

export function createSignedAdminToken(
  user: AdminUser,
  secret: string,
  now: number = Date.now(),
  ttlMs: number = SESSION_DURATION_MS
): { token: string; jti: string; expiresAt: number } {
  const expiresAt = now + ttlMs;
  const jti = crypto.randomBytes(16).toString('hex');
  const normalizedRole = normalizeAdminRole(user.role);
  const normalizedUser: AdminUser = {
    ...user,
    role: normalizedRole,
    permissions:
      Array.isArray(user.permissions) && user.permissions.length > 0
        ? user.permissions
        : getPermissionsForRole(normalizedRole),
  };

  const payload: SignedTokenPayload = {
    jti,
    user: normalizedUser,
    iat: now,
    exp: expiresAt,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSegment(encodedPayload, secret);
  return {
    token: `${encodedPayload}.${signature}`,
    jti,
    expiresAt,
  };
}

export function verifySignedAdminToken(
  token: string,
  secret: string,
  now: number = Date.now()
): { user: AdminUser; jti: string; expiresAt: number } | null {
  if (!token || !secret || !token.includes('.')) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = signSegment(encodedPayload, secret);
  const providedBuf = Buffer.from(providedSignature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SignedTokenPayload;
    if (!payload || !payload.user || typeof payload.exp !== 'number') {
      return null;
    }
    if (now > payload.exp) {
      return null;
    }
    if (payload.jti && isServerlessSessionJtiRevoked(payload.jti)) {
      return null;
    }

    const normalizedRole = normalizeAdminRole(payload.user.role);
    const normalizedUser: AdminUser = {
      ...payload.user,
      role: normalizedRole,
      permissions:
        Array.isArray(payload.user.permissions) && payload.user.permissions.length > 0
          ? payload.user.permissions
          : getPermissionsForRole(normalizedRole),
    };

    return {
      user: normalizedUser,
      jti: payload.jti || '',
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function timingSafeStringCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

export function extractAdminToken(event: NetlifyEvent): string | null {
  const cookieHeader = getHeader(event.headers, 'cookie');
  const cookies = parseCookies(cookieHeader);
  if (cookies[ADMIN_SESSION_COOKIE]) {
    return cookies[ADMIN_SESSION_COOKIE];
  }

  const authHeader = getHeader(event.headers, 'authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }

  return null;
}

export function isRequestOriginAllowed(
  event: NetlifyEvent,
  env: Record<string, string | undefined> = process.env
): boolean {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const cookieHeader = getHeader(event.headers, 'cookie');
  const cookies = parseCookies(cookieHeader);
  // Only enforce strict browser Origin check when cookie auth is present
  if (!cookies[ADMIN_SESSION_COOKIE]) {
    return true;
  }

  const originHeader = getHeader(event.headers, 'origin');
  const refererHeader = getHeader(event.headers, 'referer');
  const rawOrigin = originHeader || refererHeader;
  if (!rawOrigin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(rawOrigin).origin;
    const config = getRuntimeEnvironmentConfig(env);
    const hostHeader = getHeader(event.headers, 'host');
    if (hostHeader && (parsedOrigin.endsWith(`://${hostHeader}`))) {
      return true;
    }
    const resolved = resolveCorsOrigin(parsedOrigin, config);
    return resolved === parsedOrigin;
  } catch {
    return false;
  }
}

export function buildAdminSessionCookieHeader(
  token: string,
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const maxAgeSec = Math.floor(SESSION_DURATION_MS / 1000);
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
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

export function buildClearAdminSessionCookieHeader(
  env: Record<string, string | undefined> = process.env
): string {
  const config = getRuntimeEnvironmentConfig(env);
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
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

export type ServerlessAuthResult =
  | { authorized: true; user: AdminUser; jti: string; expiresAt: number }
  | { authorized: false; response: NetlifyResponse };

export interface RequireAdminAuthOptions {
  requiredPermission?: AdminPermission;
}

export function requireServerlessAdminAuth(
  event: NetlifyEvent,
  allowedMethods: string[],
  env: Record<string, string | undefined> = process.env,
  options?: RequireAdminAuthOptions
): ServerlessAuthResult {
  if (!isRequestOriginAllowed(event, env)) {
    return {
      authorized: false,
      response: errorResponse(
        event,
        403,
        'Forbidden',
        'Cross-origin state-changing request rejected by CSRF protection.',
        { code: 'CSRF_ORIGIN_DENIED', allowedMethods },
        env
      ),
    };
  }

  const token = extractAdminToken(event);
  if (!token) {
    const cookies = parseCookies(getHeader(event.headers, 'cookie'));
    if (cookies['bionexa_student_session']) {
      return {
        authorized: false,
        response: errorResponse(
          event,
          403,
          'Forbidden',
          'Student accounts are not permitted to access administrator APIs.',
          { code: 'ROLE_FORBIDDEN', allowedMethods },
          env
        ),
      };
    }
    if (cookies['bionexa_company_session']) {
      return {
        authorized: false,
        response: errorResponse(
          event,
          403,
          'Forbidden',
          'Company accounts are not permitted to access administrator APIs.',
          { code: 'ROLE_FORBIDDEN', allowedMethods },
          env
        ),
      };
    }
    return {
      authorized: false,
      response: errorResponse(
        event,
        401,
        'Authentication Required',
        'Admin credentials required to perform this action.',
        { code: 'AUTH_REQUIRED', allowedMethods },
        env
      ),
    };
  }

  const creds = getServerlessAdminCredentials(env);
  const sessionSecret = creds?.sessionSecret || (env.ADMIN_SESSION_SECRET || '').trim();
  if (!sessionSecret || sessionSecret.length < 16) {
    return {
      authorized: false,
      response: serviceUnavailableResponse(
        event,
        'Administrator authentication environment variables (ADMIN_USERNAME, ADMIN_PASSWORD or ADMIN_PASSWORD_HASH, and ADMIN_SESSION_SECRET) are not configured on Netlify.',
        'ADMIN_AUTH_NOT_CONFIGURED',
        allowedMethods,
        env
      ),
    };
  }

  const verified = verifySignedAdminToken(token, sessionSecret);
  if (!verified) {
    return {
      authorized: false,
      response: errorResponse(
        event,
        403,
        'Forbidden',
        'Invalid, revoked, or expired administrative session.',
        { code: 'INVALID_SESSION', allowedMethods },
        env
      ),
    };
  }

  if (options?.requiredPermission && !hasAdminPermission(verified.user, options.requiredPermission)) {
    return {
      authorized: false,
      response: errorResponse(
        event,
        403,
        'Forbidden',
        `Insufficient permissions: '${options.requiredPermission}' is required for this action.`,
        { code: 'INSUFFICIENT_PERMISSIONS', allowedMethods },
        env
      ),
    };
  }

  return {
    authorized: true,
    user: verified.user,
    jti: verified.jti,
    expiresAt: verified.expiresAt,
  };
}

export async function requireServerlessAdminAuthAsync(
  event: NetlifyEvent,
  allowedMethods: string[],
  options?: RequireAdminAuthOptions,
  env: Record<string, string | undefined> = process.env
): Promise<ServerlessAuthResult> {
  const baseResult = requireServerlessAdminAuth(event, allowedMethods, env, options);
  if (baseResult.authorized === false) {
    return baseResult;
  }

  const repo = getSupabaseRepository(env);
  if (repo && baseResult.jti) {
    try {
      const revoked = await repo.isAdminSessionRevoked(baseResult.jti);
      if (revoked) {
        revokeServerlessSessionJti(baseResult.jti);
        return {
          authorized: false,
          response: errorResponse(
            event,
            403,
            'Forbidden',
            'Administrative session has been revoked or expired.',
            { code: 'SESSION_REVOKED', allowedMethods },
            env
          ),
        };
      }
    } catch {
      // Fail open on transient lookup only if local JTI revocation didn't flag it
    }
  }

  return baseResult;
}
