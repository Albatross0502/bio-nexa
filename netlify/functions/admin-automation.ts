/**
 * Netlify Function: admin-automation
 * Routes:
 * - GET  /api/admin/automated-sync/status
 * - POST /api/admin/automated-sync/run
 * - POST /api/admin/automated-sync/check-urls
 * - POST /api/admin/automated-sync/expire
 */

import { getRuntimeEnvironmentConfig } from '../../src/config/environment';
import {
  getAuthorizedSourcesWithEnvStatus,
  getSyncScheduleConfig,
  OpportunitySyncReport,
  SyncInProgressError,
} from '../../src/services/jobs/opportunitySyncEngine';
import {
  getGoogleSheetsConfigSummary,
  GoogleSheetsSyncStatusRecord,
} from '../../src/services/opportunities/serverGoogleSheetsService';
import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import { getSupabaseRepository } from './_shared/supabaseDb';
import {
  isServerlessSyncActiveInMemory,
  runServerlessGoogleSheetsSync,
  runServerlessOpportunitySync,
} from './_shared/supabaseSyncRunner';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = [
  '/.netlify/functions/admin-automation',
  '/api/admin/automated-sync',
  '/api/admin',
];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission: method === 'GET' ? 'dashboard:read' : 'sync:run',
  });
  if (auth.authorized === false) return auth.response;

  const config = getRuntimeEnvironmentConfig();
  const repo = getSupabaseRepository();
  const sources = getAuthorizedSourcesWithEnvStatus();
  const schedule = getSyncScheduleConfig();

  if (subPath === 'status') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }

    const [storedReport, lastSyncRow, syncHistory, lockRecord] = repo
      ? await Promise.all([
          repo.getContentRecord<OpportunitySyncReport | null>('automated_sync_report', null),
          repo.getLatestSyncLog(),
          repo.getSyncLogs(50),
          repo.getContentRecord<{ ownerId?: string; expiresAtMs?: number } | null>('automated_sync_lock', null),
        ])
      : [null, null, [], null];

    const lastReport =
      storedReport ||
      (lastSyncRow
        ? {
            timestamp: lastSyncRow.created_at,
            scheduleIntervalHours: schedule.intervalHours,
            sourcesAttempted: 0,
            sourcesSuccessful: 0,
            sourcesFailed: lastSyncRow.status === 'Error' ? 1 : 0,
            sourcesSkippedUnconfigured: sources.filter((s) => !s.configured && s.integrationMethod !== 'search_fallback_only').length,
            candidatesProcessed: lastSyncRow.items_fetched ?? 0,
            newImportedCount: lastSyncRow.items_added ?? 0,
            updatedCount: lastSyncRow.items_updated ?? 0,
            duplicatesSkippedCount: 0,
            invalidRejectedCount: 0,
            expiredSkippedCount: 0,
            expiredMarkedCount: lastSyncRow.items_expired ?? 0,
            brokenUrlsFoundCount: 0,
            errors: [],
            brokenUrls: [],
            sourceDetails: [],
            rejectedDetails: [],
          }
        : null);

    const dbLockActive = Boolean(
      lockRecord && lockRecord.ownerId && lockRecord.expiresAtMs && lockRecord.expiresAtMs > Date.now()
    );

    return jsonResponse(
      event,
      200,
      {
        success: true,
        lastReport,
        sources,
        schedule,
        syncHistory,
        isSyncing: isServerlessSyncActiveInMemory() || dbLockActive,
        persistentDbConfigured: config.supabaseConfigured,
      },
      ['GET']
    );
  }

  if (subPath === 'google-sheets/status' || subPath === 'google-sheets') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }

    const sheetsConfig = getGoogleSheetsConfigSummary();
    const [storedSheetsStatus, syncLogs, lockRecord] = repo
      ? await Promise.all([
          repo.getContentRecord<GoogleSheetsSyncStatusRecord | null>('google_sheets_sync_status', null),
          repo.getSyncLogs(50),
          repo.getContentRecord<{ ownerId?: string; expiresAtMs?: number } | null>('automated_sync_lock', null),
        ])
      : [null, [], null];

    const dbLockActive = Boolean(
      lockRecord && lockRecord.ownerId && lockRecord.expiresAtMs && lockRecord.expiresAtMs > Date.now()
    );

    const statusPayload: GoogleSheetsSyncStatusRecord = storedSheetsStatus || {
      lastSyncAttemptAt: null,
      lastSuccessfulSyncAt: null,
      lastStatus: 'never_run',
      lastError: null,
      mode: sheetsConfig.mode,
      columnValidation: null,
      lastReport: null,
    };

    return jsonResponse(
      event,
      200,
      {
        success: true,
        config: sheetsConfig,
        status: statusPayload,
        syncHistory: syncLogs.filter((l: any) => (l.sourceId || l.source_id) === 'feed-google-sheets'),
        isSyncing: isServerlessSyncActiveInMemory() || dbLockActive,
        persistentDbConfigured: config.supabaseConfigured,
      },
      ['GET']
    );
  }

  if (subPath === 'google-sheets/sync') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Google Sheets synchronization cannot persist imported records in serverless production until Supabase PostgreSQL is configured.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    try {
      const report = await runServerlessGoogleSheetsSync(repo);
      await repo.recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_GOOGLE_SHEETS_SYNC',
        entityType: 'sync',
        details: {
          mode: report.mode,
          rowsFetched: report.rowsFetched,
          importedCount: report.importedCount,
          updatedCount: report.updatedCount,
          duplicatesSkippedCount: report.duplicatesSkippedCount,
          invalidRowsCount: report.invalidRowsCount,
          error: report.error || null,
        },
      }).catch(() => {});

      const message = !report.configured
        ? 'Google Sheets API credentials or endpoint are not configured on the server. Existing database records remain accessible.'
        : report.error && report.rowsFetched === 0
        ? `Google Sheets sync error: ${report.error}. Existing database records remain intact.`
        : `Google Sheets sync complete (${report.mode}): fetched ${report.rowsFetched} row(s), imported ${report.importedCount} (Pending Verification), updated ${report.updatedCount}, skipped ${report.duplicatesSkippedCount} duplicate(s), rejected ${report.invalidRowsCount} invalid row(s).`;

      return jsonResponse(
        event,
        200,
        {
          success: !report.error || report.importedCount > 0 || report.updatedCount > 0,
          message,
          report,
        },
        ['POST']
      );
    } catch (err: any) {
      if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
        return errorResponse(
          event,
          409,
          'Sync In Progress',
          err.message || 'Synchronization is currently running.',
          { code: 'SYNC_IN_PROGRESS', allowedMethods: ['POST'] }
        );
      }
      return errorResponse(
        event,
        500,
        'Google Sheets Sync Failed',
        err?.message || 'Google Sheets synchronization failed.',
        { code: 'GOOGLE_SHEETS_SYNC_FAILED', allowedMethods: ['POST'] }
      );
    }
  }

  if (subPath === 'expire') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Expiry persistence requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const expiredCount = await repo.markExpiredListings();
    await repo.recordSyncLog({
      sourceId: 'deadline-expiry-scan',
      sourceName: 'Automated Expiry Deadline Monitor',
      status: 'Success',
      itemsExpired: expiredCount,
      details: `Scanned Supabase jobs and marked ${expiredCount} expired listing(s).`,
    });
    await repo.recordAdminAuditLog({
      adminUserId: auth.user.id,
      actorUsername: auth.user.username,
      action: 'ADMIN_SYNC_EXPIRE_SCAN',
      entityType: 'job',
      details: { expiredCount },
    }).catch(() => {});
    return jsonResponse(
      event,
      200,
      {
        success: true,
        expiredCount,
        message: `Expiry scan completed on Supabase PostgreSQL: ${expiredCount} listing(s) updated.`,
      },
      ['POST']
    );
  }

  if (subPath === 'run' || subPath === 'check-urls') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Automated feed synchronization and expiry persistence require Supabase PostgreSQL configuration before saving updates in serverless production.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }

    if (subPath === 'check-urls') {
      const jobs = await repo.getAllJobsAdmin();
      const targets = jobs.filter((j) => j.isActive).slice(0, 15);
      const broken: { jobId: string; title: string; employer: string; url: string; error: string }[] = [];
      for (const job of targets) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(job.applicationUrl, { method: 'HEAD', signal: controller.signal });
          if (res.status === 404 || res.status === 410) {
            broken.push({
              jobId: job.id,
              title: job.title,
              employer: job.employer,
              url: job.applicationUrl,
              error: `HTTP ${res.status}`,
            });
            await repo.updateJob(job.id, {
              verificationStatus: 'Link Unavailable',
              verificationNotes: `Automated link check detected HTTP ${res.status}.`,
            });
          }
        } catch (err: any) {
          broken.push({
            jobId: job.id,
            title: job.title,
            employer: job.employer,
            url: job.applicationUrl,
            error: err?.name === 'AbortError' ? 'Probe timed out' : err?.message || 'Reachability probe failed',
          });
        } finally {
          clearTimeout(timer);
        }
      }
      await repo.recordSyncLog({
        sourceId: 'url-reachability-audit',
        sourceName: 'Application URL Reachability Audit',
        status: broken.length > 0 ? 'Partial' : 'Success',
        itemsFetched: targets.length,
        itemsUpdated: broken.length,
        details: `Probed ${targets.length} active URL(s); flagged ${broken.length} unreachable link(s).`,
      }).catch(() => {});
      return jsonResponse(
        event,
        200,
        {
          success: true,
          message: `Probed ${targets.length} active application URL(s) from Supabase.`,
          brokenCount: broken.length,
          broken,
        },
        ['POST']
      );
    }

    try {
      const report = await runServerlessOpportunitySync(repo);
      await repo.recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_AUTOMATED_SYNC_RUN',
        entityType: 'sync',
        details: {
          sourcesAttempted: report.sourcesAttempted,
          sourcesSuccessful: report.sourcesSuccessful,
          newImportedCount: report.newImportedCount,
          updatedCount: report.updatedCount,
          expiredMarkedCount: report.expiredMarkedCount,
        },
      }).catch(() => {});
      return jsonResponse(
        event,
        200,
        {
          success: true,
          message:
            report.sourcesAttempted === 0
              ? `Expiry scan completed (${report.expiredMarkedCount} expired). External feeds skipped until API credentials or sheet URLs are configured.`
              : `Automated sync completed (${report.sourcesSuccessful}/${report.sourcesAttempted} feeds): ${report.newImportedCount} imported (Pending Verification), ${report.updatedCount} updated, ${report.duplicatesSkippedCount} duplicates skipped, ${report.expiredMarkedCount} expired.`,
          report,
        },
        ['POST']
      );
    } catch (err: any) {
      if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
        return errorResponse(
          event,
          409,
          'Sync In Progress',
          err.message || 'Automated synchronization is currently running.',
          { code: 'SYNC_IN_PROGRESS', allowedMethods: ['POST'] }
        );
      }
      return errorResponse(
        event,
        500,
        'Automated Sync Failed',
        err?.message || 'Automated synchronization failed.',
        { code: 'SYNC_FAILED', allowedMethods: ['POST'] }
      );
    }
  }

  return errorResponse(event, 404, 'Not Found', 'Automated sync endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
