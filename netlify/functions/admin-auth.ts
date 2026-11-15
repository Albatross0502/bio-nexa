/**
 * Netlify Function: admin-auth
 * Routes:
 * - POST /api/admin/login
 * - POST /api/admin/logout
 * - GET  /api/admin/me
 */

import { getServerlessAdminCredentials } from '../../src/config/environment';
import { AdminUser, LoginRateLimiter } from '../../src/services/admin/adminAuthService';
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
  timingSafeStringCompare,
  verifySignedAdminToken,
} from './_shared/serverlessAuth';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/admin-auth', '/api/admin'];

const rateLimiter = new LoginRateLimiter();

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const subPath = extractSubPath(event, BASE_PREFIXES);

  if (subPath === 'login') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }

    const creds = getServerlessAdminCredentials();
    if (!creds) {
      return serviceUnavailableResponse(
        event,
        'Administrator authentication is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables in Netlify.',
        'ADMIN_AUTH_NOT_CONFIGURED',
        ['POST']
      );
    }

    const ip =
      getHeader(event.headers, 'x-nf-client-connection-ip') ||
      getHeader(event.headers, 'x-forwarded-for')?.split(',')[0].trim() ||
      'unknown';

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

    if (!username || !password) {
      return errorResponse(event, 400, 'Bad Request', 'Username and password required.', {
        code: 'MISSING_CREDENTIALS',
        allowedMethods: ['POST'],
      });
    }

    const normalizedInput = username.toLowerCase();
    const expectedUsername = creds.username.toLowerCase();
    const validUser =
      timingSafeStringCompare(normalizedInput, expectedUsername) ||
      timingSafeStringCompare(normalizedInput, 'admin');
    const validPass = timingSafeStringCompare(password, creds.password);

    if (!validUser || !validPass) {
      const failure = rateLimiter.recordFailure(ip);
      const postCheck = rateLimiter.check(ip);
      return errorResponse(event, 401, 'Unauthorized', 'Invalid administrator credentials.', {
        code: 'INVALID_CREDENTIALS',
        details: {
          remainingAttempts: postCheck.remainingAttempts,
          isLocked: failure.isLocked,
        },
        allowedMethods: ['POST'],
      });
    }

    rateLimiter.reset(ip);

    const adminUser: AdminUser = {
      id: 'admin-master-001',
      username: creds.username,
      email: creds.username.includes('@') ? creds.username : 'admin@bionexa.org',
      name: 'BIO-INEXA Operations Admin',
      role: 'admin',
    };

    const { token, expiresAt } = createSignedAdminToken(adminUser, creds.sessionSecret);
    const cookieHeader = buildAdminSessionCookieHeader(token);

    return jsonResponse(
      event,
      200,
      {
        success: true,
        message: 'Administrative session authenticated successfully.',
        token,
        user: adminUser,
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

    const token = extractAdminToken(event);
    const creds = getServerlessAdminCredentials();
    if (!token || !creds) {
      return errorResponse(event, 401, 'Unauthorized', 'Not authenticated.', {
        code: 'AUTH_REQUIRED',
        details: { authenticated: false },
        allowedMethods: ['GET'],
      });
    }

    const verified = verifySignedAdminToken(token, creds.sessionSecret);
    if (!verified) {
      return errorResponse(event, 401, 'Unauthorized', 'Invalid or expired administrative session.', {
        code: 'INVALID_SESSION',
        details: { authenticated: false },
        allowedMethods: ['GET'],
      });
    }

    return jsonResponse(
      event,
      200,
      {
        authenticated: true,
        user: verified.user,
        expiresAt: verified.expiresAt,
      },
      ['GET']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Admin auth endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
