/**
 * Shared Serverless Opportunity Synchronization Runner for Netlify Functions.
 *
 * Bridges the pure opportunitySyncEngine with Supabase PostgreSQL persistence
 * and enforces both local in-memory and PostgreSQL distributed overlap locks.
 */

import {
  ExecuteSyncOptions,
  executeOpportunitySync,
  OpportunitySyncReport,
  SyncInProgressError,
  SyncStorageAdapter,
} from '../../../src/services/jobs/opportunitySyncEngine';
import {
  GoogleSheetsStorageAdapter,
  GoogleSheetsSyncReport,
  GoogleSheetsSyncStatusRecord,
  runGoogleSheetsSync,
  RunGoogleSheetsSyncOptions,
} from '../../../src/services/opportunities/serverGoogleSheetsService';
import type { SupabaseRepository } from './supabaseDb';

let localServerlessSyncActive = false;

export function isServerlessSyncActiveInMemory(): boolean {
  return localServerlessSyncActive;
}

export async function runServerlessOpportunitySync(
  repo: SupabaseRepository,
  options: ExecuteSyncOptions = {}
): Promise<OpportunitySyncReport> {
  if (localServerlessSyncActive) {
    throw new SyncInProgressError(
      'An opportunity synchronization run is already active in this execution instance.'
    );
  }

  localServerlessSyncActive = true;
  const storage: SyncStorageAdapter = {
    getAllJobs: () => repo.getAllJobsAdmin(),
    createJob: (job) => repo.createJob(job),
    updateJob: (id, patch) => repo.updateJob(id, patch),
    markExpiredListings: () => repo.markExpiredListings(),
    recordSyncLog: (entry) => repo.recordSyncLog(entry),
    saveLastReport: (report) => repo.setContentRecord('automated_sync_report', report, 'system_scheduler'),
    acquireSyncLock: (ownerId, ttlMs) => repo.acquireSyncLock(ownerId, ttlMs),
    releaseSyncLock: (ownerId) => repo.releaseSyncLock(ownerId),
  };

  try {
    return await executeOpportunitySync(storage, options);
  } finally {
    localServerlessSyncActive = false;
  }
}

export async function runServerlessGoogleSheetsSync(
  repo: SupabaseRepository,
  options: RunGoogleSheetsSyncOptions = {}
): Promise<GoogleSheetsSyncReport> {
  if (localServerlessSyncActive) {
    throw new SyncInProgressError(
      'A Google Sheets or automated synchronization run is already active in this execution instance.'
    );
  }

  localServerlessSyncActive = true;
  const storage: GoogleSheetsStorageAdapter = {
    getAllJobs: () => repo.getAllJobsAdmin(),
    createJob: (job) => repo.createJob(job),
    updateJob: (id, patch) => repo.updateJob(id, patch),
    markExpiredListings: () => repo.markExpiredListings(),
    recordSyncLog: (entry) => repo.recordSyncLog(entry),
    getGoogleSheetsStatus: () =>
      repo.getContentRecord<GoogleSheetsSyncStatusRecord | null>('google_sheets_sync_status', null),
    saveGoogleSheetsStatus: (status) =>
      repo.setContentRecord('google_sheets_sync_status', status, 'system_scheduler'),
    acquireSyncLock: (ownerId, ttlMs) => repo.acquireSyncLock(ownerId, ttlMs),
    releaseSyncLock: (ownerId) => repo.releaseSyncLock(ownerId),
  };

  try {
    return await runGoogleSheetsSync(storage, options);
  } finally {
    localServerlessSyncActive = false;
  }
}
