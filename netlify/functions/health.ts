/**
 * Netlify Function: health
 * Route: GET /api/health -> /.netlify/functions/health
 */

import { getRuntimeEnvironmentConfig } from '../../src/config/environment';
import {
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';

const ALLOWED_METHODS = ['GET'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const config = getRuntimeEnvironmentConfig();
  return jsonResponse(
    event,
    200,
    {
      success: true,
      ok: true,
      service: 'bio-inexa-api',
      runtime: config.runtimeMode,
      environment: config.nodeEnv,
      persistentDbConfigured: config.supabaseConfigured,
      adzunaConfigured: config.adzunaConfigured,
      timestamp: new Date().toISOString(),
    },
    ALLOWED_METHODS
  );
};
