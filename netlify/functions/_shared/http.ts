/**
 * Shared HTTP, CORS, Method Guard, and Consistent JSON Error Utilities
 * for BIO-INEXA Modular Netlify Functions.
 */

import {
  getRuntimeEnvironmentConfig,
  resolveCorsOrigin,
  RuntimeEnvironmentConfig,
} from '../../../src/config/environment';

export interface NetlifyEvent {
  httpMethod: string;
  path?: string;
  rawUrl?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
}

export function getHeader(
  headers: Record<string, string | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

export function buildResponseHeaders(
  event: NetlifyEvent,
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  extraHeaders: Record<string, string> = {},
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const config: RuntimeEnvironmentConfig = getRuntimeEnvironmentConfig(env);
  const requestOrigin = getHeader(event.headers, 'origin');
  const corsOrigin = resolveCorsOrigin(requestOrigin, config);
  const methodsList = Array.from(new Set([...allowedMethods, 'OPTIONS'])).join(', ');

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': methodsList,
    Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
}

export function handleCorsPreflight(
  event: NetlifyEvent,
  allowedMethods: string[],
  env: Record<string, string | undefined> = process.env
): NetlifyResponse | null {
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: buildResponseHeaders(event, allowedMethods, {}, env),
      body: '',
    };
  }
  return null;
}

export function jsonResponse(
  event: NetlifyEvent,
  statusCode: number,
  payload: Record<string, any>,
  allowedMethods: string[] = ['GET'],
  extraHeaders: Record<string, string> = {},
  env: Record<string, string | undefined> = process.env
): NetlifyResponse {
  return {
    statusCode,
    headers: buildResponseHeaders(event, allowedMethods, extraHeaders, env),
    body: JSON.stringify(payload),
  };
}

export function errorResponse(
  event: NetlifyEvent,
  statusCode: number,
  error: string,
  message: string,
  options: {
    code?: string;
    details?: Record<string, any>;
    allowedMethods?: string[];
    extraHeaders?: Record<string, string>;
  } = {},
  env: Record<string, string | undefined> = process.env
): NetlifyResponse {
  const body: Record<string, any> = {
    success: false,
    error,
    message,
  };
  if (options.code) {
    body.code = options.code;
  }
  if (options.details) {
    Object.assign(body, options.details);
  }

  return jsonResponse(
    event,
    statusCode,
    body,
    options.allowedMethods || ['GET'],
    options.extraHeaders || {},
    env
  );
}

export function methodNotAllowedResponse(
  event: NetlifyEvent,
  allowedMethods: string[],
  env: Record<string, string | undefined> = process.env
): NetlifyResponse {
  const allowHeader = Array.from(new Set([...allowedMethods, 'OPTIONS'])).join(', ');
  return errorResponse(
    event,
    405,
    'Method Not Allowed',
    `HTTP method ${(event.httpMethod || 'UNKNOWN').toUpperCase()} is not supported on this endpoint. Allowed: ${allowedMethods.join(', ')}.`,
    {
      code: 'METHOD_NOT_ALLOWED',
      allowedMethods,
      extraHeaders: { Allow: allowHeader },
    },
    env
  );
}

export function serviceUnavailableResponse(
  event: NetlifyEvent,
  message: string,
  code: string = 'PERSISTENT_DB_NOT_CONFIGURED',
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  env: Record<string, string | undefined> = process.env
): NetlifyResponse {
  return errorResponse(
    event,
    503,
    'Service Unavailable',
    message,
    {
      code,
      allowedMethods,
    },
    env
  );
}

export function parseJsonBody<T = Record<string, any>>(
  event: NetlifyEvent
): { ok: true; data: T } | { ok: false; message: string } {
  const rawBody = event.body;
  if (!rawBody) {
    return { ok: true, data: {} as T };
  }

  try {
    const decoded = event.isBase64Encoded
      ? Buffer.from(rawBody, 'base64').toString('utf8')
      : rawBody;
    if (!decoded.trim()) {
      return { ok: true, data: {} as T };
    }
    const parsed = JSON.parse(decoded);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'Request body must be a JSON object.' };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, message: 'Invalid JSON request body.' };
  }
}

export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts normalized sub-path whether a request hits `/api/...` via redirect
 * or `/.netlify/functions/<fn>/...` directly.
 */
export function extractSubPath(event: NetlifyEvent, functionBasePrefixes: string[]): string {
  const candidates: string[] = [];
  const originalPath = getHeader(event.headers, 'x-nf-original-path');
  if (originalPath) candidates.push(originalPath);
  if (event.path) candidates.push(event.path);
  if (event.rawUrl) {
    try {
      candidates.push(new URL(event.rawUrl).pathname);
    } catch {
      // ignore invalid rawUrl
    }
  }

  for (const candidate of candidates) {
    const cleanPath = candidate.split('?')[0].replace(/\/+$/, '') || '/';
    for (const prefix of functionBasePrefixes) {
      const normalizedPrefix = prefix.replace(/\/+$/, '');
      if (cleanPath === normalizedPrefix) {
        return '';
      }
      if (cleanPath.startsWith(`${normalizedPrefix}/`)) {
        return cleanPath.slice(normalizedPrefix.length + 1);
      }
    }
  }

  return '';
}
