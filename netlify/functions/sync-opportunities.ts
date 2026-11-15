/**
 * Netlify Serverless & Scheduled Function: sync-opportunities
 * Routes:
 * - POST|GET /api/sync-opportunities (Admin authenticated)
 * - Scheduled invocation via Netlify Cron
 *
 * Replaces previous hardcoded mock stats ({ sourcesSynced: 7, addedCount: 4, expiredCount: 1 })
 * with explicit persistent-DB checks and genuine authorization guards.
 */

import { getRuntimeEnvironmentConfig } from '../../src/config/environment';
import {
  getHeader,
  handleCorsPreflight,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuth } from './_shared/serverlessAuth';

const ALLOWED_METHODS = ['GET', 'POST'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const isScheduledEvent =
    !event.httpMethod ||
    Boolean(getHeader(event.headers, 'x-netlify-event') === 'schedule');

  if (!isScheduledEvent) {
    const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
    if (preflight) return preflight;

    const method = (event.httpMethod || '').toUpperCase();
    if (!ALLOWED_METHODS.includes(method)) {
      return methodNotAllowedResponse(event, ALLOWED_METHODS);
    }

    const auth = requireServerlessAdminAuth(event, ALLOWED_METHODS);
    if (auth.authorized === false) return auth.response;
  }

  const config = getRuntimeEnvironmentConfig();
  if (!config.supabaseConfigured) {
    return serviceUnavailableResponse(
      event,
      'Opportunity feed sync cannot persist changes in serverless production until shared cloud database credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are configured.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ALLOWED_METHODS
    );
  }

  return serviceUnavailableResponse(
    event,
    'Live Supabase sync persistence pipeline will be enabled in Phase 04.',
    'SYNC_PIPELINE_PENDING_PHASE_04',
    ALLOWED_METHODS
  );
};
