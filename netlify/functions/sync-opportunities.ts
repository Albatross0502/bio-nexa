/**
 * Netlify Serverless & Scheduled Function: sync-opportunities
 * Routes:
 * - POST|GET /api/sync-opportunities (Admin authenticated)
 * - Scheduled invocation via Netlify Cron (configured in netlify.toml every 6 hours)
 *
 * Executes genuine opportunity synchronization against authorized configured feeds,
 * validates source and application URLs, deduplicates, safely updates existing records,
 * queues new imports as 'Pending Verification' (isApproved: false), scans expired
 * deadlines, prevents overlapping sync runs, and persists logs in PostgreSQL.
 */

import { getRuntimeEnvironmentConfig } from '../../src/config/environment';
import {
  getSyncScheduleConfig,
  SyncInProgressError,
} from '../../src/services/jobs/opportunitySyncEngine';
import {
  errorResponse,
  getHeader,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { runServerlessOpportunitySync } from './_shared/supabaseSyncRunner';

const ALLOWED_METHODS = ['GET', 'POST'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const isScheduledEvent =
    !event.httpMethod ||
    getHeader(event.headers, 'x-netlify-event') === 'schedule';

  if (!isScheduledEvent) {
    const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
    if (preflight) return preflight;

    const method = (event.httpMethod || '').toUpperCase();
    if (!ALLOWED_METHODS.includes(method)) {
      return methodNotAllowedResponse(event, ALLOWED_METHODS);
    }

    const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
      requiredPermission: 'sync:run',
    });
    if (auth.authorized === false) return auth.response;
  }

  const config = getRuntimeEnvironmentConfig();
  const repo = getSupabaseRepository();
  const schedule = getSyncScheduleConfig();

  if (!config.supabaseConfigured || !repo) {
    return serviceUnavailableResponse(
      event,
      'Opportunity feed sync cannot persist changes in serverless production until shared cloud database credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are configured.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ALLOWED_METHODS
    );
  }

  try {
    const report = await runServerlessOpportunitySync(repo);
    return jsonResponse(
      event,
      200,
      {
        success: true,
        persistentDbConfigured: true,
        schedule,
        expiredCount: report.expiredMarkedCount,
        newImportedCount: report.newImportedCount,
        updatedCount: report.updatedCount,
        duplicatesSkippedCount: report.duplicatesSkippedCount,
        sourcesAttempted: report.sourcesAttempted,
        sourcesSuccessful: report.sourcesSuccessful,
        sourcesFailed: report.sourcesFailed,
        sourcesSkippedUnconfigured: report.sourcesSkippedUnconfigured,
        timestamp: report.timestamp,
        report,
        message:
          report.sourcesAttempted === 0
            ? `Scheduled deadline audit complete (${report.expiredMarkedCount} expired). External feeds skipped until API/sheet credentials are configured.`
            : `Synchronized ${report.sourcesSuccessful}/${report.sourcesAttempted} configured feed(s): ${report.newImportedCount} imported (Pending Verification), ${report.updatedCount} updated, ${report.duplicatesSkippedCount} duplicates skipped, ${report.expiredMarkedCount} expired.`,
      },
      ALLOWED_METHODS
    );
  } catch (err: any) {
    if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
      return errorResponse(
        event,
        409,
        'Sync In Progress',
        err.message || 'An opportunity synchronization job is already running.',
        { code: 'SYNC_IN_PROGRESS', allowedMethods: ALLOWED_METHODS }
      );
    }
    return errorResponse(
      event,
      500,
      'Sync Error',
      err?.message || 'Opportunity synchronization encountered an unexpected error.',
      { code: 'SYNC_FAILED', allowedMethods: ALLOWED_METHODS }
    );
  }
};
