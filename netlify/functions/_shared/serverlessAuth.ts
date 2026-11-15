/**
 * Stateless HMAC-SHA256 Signed Admin Authentication Helpers
 * for Netlify Serverless Functions (no in-memory session loss across cold starts).
 */

import crypto from 'node:crypto';
import {
  getRuntimeEnvironmentConfig,
  getServerlessAdminCredentials,
} from '../../../src/config/environment';
import { AdminUser, SESSION_DURATION_MS } from '../../../src/services/admin/adminAuthService';
import {
  errorResponse,
  getHeader,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './http';

export const ADMIN_SESSION_COOKIE = 'bionexa_admin_session';

interface SignedTokenPayload {
  user: AdminUser;
  iat: number;
  exp: number;
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
): { token: string; expiresAt: number } {
  const expiresAt = now + ttlMs;
  const payload: SignedTokenPayload = {
    user,
    iat: now,
    exp: expiresAt,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSegment(encodedPayload, secret);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}

export function verifySignedAdminToken(
  token: string,
  secret: string,
  now: number = Date.now()
): { user: AdminUser; expiresAt: number } | null {
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
    return {
      user: payload.user,
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
  | { authorized: true; user: AdminUser; expiresAt: number }
  | { authorized: false; response: NetlifyResponse };

export function requireServerlessAdminAuth(
  event: NetlifyEvent,
  allowedMethods: string[],
  env: Record<string, string | undefined> = process.env
): ServerlessAuthResult {
  const token = extractAdminToken(event);
  if (!token) {
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
  if (!creds) {
    return {
      authorized: false,
      response: serviceUnavailableResponse(
        event,
        'Administrator authentication environment variables (ADMIN_PASSWORD, ADMIN_USERNAME) are not configured on Netlify.',
        'ADMIN_AUTH_NOT_CONFIGURED',
        allowedMethods,
        env
      ),
    };
  }

  const verified = verifySignedAdminToken(token, creds.sessionSecret);
  if (!verified) {
    return {
      authorized: false,
      response: errorResponse(
        event,
        403,
        'Forbidden',
        'Invalid or expired administrative session.',
        { code: 'INVALID_SESSION', allowedMethods },
        env
      ),
    };
  }

  return {
    authorized: true,
    user: verified.user,
    expiresAt: verified.expiresAt,
  };
}
