/**
 * BIO-INEXA Server-Side Google Sheets Synchronization Service (Phase 09)
 *
 * Strictly server-only integration supporting:
 * 1. Google Sheets API v4 with Service Account JWT (RS256 OAuth2 Bearer)
 * 2. Google Sheets API v4 with API Key
 * 3. Server-side Google Apps Script Web App JSON feed (+ optional token)
 * 4. Server-side Published CSV URL
 *
 * Security & Data Integrity Guarantees:
 * - Zero Google credentials ever exposed to the frontend.
 * - Website availability never depends on Google Sheets uptime.
 * - Spreadsheet column mappings validated before processing records.
 * - Every newly imported listing enters PostgreSQL / SQLite strictly as
 *   'Pending Verification' (isApproved: false, lastVerificationDate: '').
 * - Existing approved/verified/rejected admin decisions are never overwritten.
 * - Existing database records are NEVER deleted when rows disappear or sync fails.
 */

import { FetchWithRetryOptions } from '../../utils/fetchWithRetry';
import {
  createServiceAccountJwtAssertion,
  FetchedSheetRawPayload,
  fetchGoogleSheetsRawData,
  getGoogleSheetsConfigSummary,
  GoogleSheetsConfigSummary,
  GoogleSheetsIntegrationMode,
} from './googleSheetsConnector';
import {
  RawSheetRow,
  SheetColumnValidationResult,
  validateSpreadsheetHeaders,
} from './googleSheetsSync';
import {
  normalizeAndValidateCandidate,
  NormalizedSyncCandidate,
  PersistedJobRecord,
  RawFeedCandidate,
  SyncInProgressError,
  SyncStorageAdapter,
} from '../jobs/opportunitySyncEngine';
import {
  findDuplicateJob,
  isJobExpiredByDeadline,
  normalizeJobVerificationStatus,
} from '../jobs/jobVerification';

export {
  createServiceAccountJwtAssertion,
  fetchGoogleSheetsRawData,
  getGoogleSheetsConfigSummary,
};
export type {
  FetchedSheetRawPayload,
  GoogleSheetsConfigSummary,
  GoogleSheetsIntegrationMode,
};

export interface GoogleSheetsInvalidRowDetail {
  rowNumber: number;
  title: string;
  reason: string;
}

export interface GoogleSheetsSyncReport {
  timestamp: string;
  configured: boolean;
  mode: GoogleSheetsIntegrationMode;
  columnValidation: SheetColumnValidationResult | null;
  rowsFetched: number;
  importedCount: number;
  updatedCount: number;
  duplicatesSkippedCount: number;
  invalidRowsCount: number;
  expiredSkippedCount: number;
  deletedCount: number;
  invalidRows: GoogleSheetsInvalidRowDetail[];
  error?: string;
}

export interface GoogleSheetsSyncStatusRecord {
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastStatus: 'never_run' | 'success' | 'partial' | 'error';
  lastError: string | null;
  mode: GoogleSheetsIntegrationMode;
  columnValidation: SheetColumnValidationResult | null;
  lastReport: GoogleSheetsSyncReport | null;
}

export interface GoogleSheetsStorageAdapter extends SyncStorageAdapter {
  getGoogleSheetsStatus?: () =>
    | Promise<GoogleSheetsSyncStatusRecord | null>
    | GoogleSheetsSyncStatusRecord | null;
  saveGoogleSheetsStatus?: (status: GoogleSheetsSyncStatusRecord) => Promise<void> | void;
}

function getRowField(row: RawSheetRow, ...aliases: string[]): string {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== null) {
      const val = String(row[key]).trim();
      if (val) return val;
    }
    const cleanTarget = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const actual of Object.keys(row)) {
      if (actual.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) {
        const val = String(row[actual] ?? '').trim();
        if (val) return val;
      }
    }
  }
  return '';
}

function sheetRowToRawCandidate(row: RawSheetRow, sourceLabel: string): RawFeedCandidate {
  const appUrl = getRowField(row, 'Application URL', 'applicationUrl', 'Apply Link', 'Apply URL', 'URL', 'Link');
  const regUrl = getRowField(row, 'Registration URL', 'registrationUrl', 'Register Link', 'Register URL', 'Enrollment URL');
  const effectiveUrl = appUrl || regUrl;

  return {
    id: getRowField(row, 'ID', 'id', 'Opportunity ID') || undefined,
    title: getRowField(row, 'Title', 'title', 'Job Title', 'Opportunity Title', 'Workshop Title', 'Course Title', 'Position'),
    employer: getRowField(row, 'Organization', 'organization', 'Company', 'Employer', 'Institution', 'Provider'),
    description: getRowField(row, 'Description', 'description', 'Details', 'Overview', 'Summary'),
    location: getRowField(row, 'Location', 'location', 'City', 'Venue') || 'All India',
    qualification: getRowField(row, 'Qualification', 'qualification', 'Eligibility', 'Degrees', 'Education'),
    employmentType: getRowField(row, 'Mode', 'mode', 'Work Mode', 'Delivery Mode', 'Employment Type') || 'Full-time',
    salary: getRowField(row, 'Salary/Stipend', 'salaryOrStipend', 'Salary', 'Stipend', 'Compensation') || 'Not Disclosed',
    applicationUrl: effectiveUrl,
    originalJobUrl: sourceLabel,
    source: 'Google Sheets Institutional Feed',
    publicationDate: getRowField(row, 'Published Date', 'publishedDate', 'Posted Date', 'Publication Date', 'Date'),
    expiryDate: getRowField(row, 'Application Deadline', 'applicationDeadline', 'Deadline', 'Expiry Date', 'Last Date', 'Registration Deadline'),
    sector: getRowField(row, 'Category', 'category', 'Type', 'Sector') || 'Biotechnology Jobs',
  };
}

function mergeSafeSheetUpdates(
  existing: PersistedJobRecord,
  incoming: NormalizedSyncCandidate
): Partial<PersistedJobRecord> | null {
  const existingVerStatus = normalizeJobVerificationStatus(existing.verificationStatus);
  // Never resurrect or mutate admin-rejected entries
  if (existingVerStatus === 'Rejected') {
    return null;
  }

  const patch: Partial<PersistedJobRecord> = {};
  let changed = false;

  if (incoming.expiryDate && incoming.expiryDate !== existing.expiryDate) {
    patch.expiryDate = incoming.expiryDate;
    changed = true;
    if (existing.isActive && isJobExpiredByDeadline(incoming.expiryDate)) {
      patch.isActive = false;
      patch.verificationStatus = 'Expired';
      patch.verificationNotes = `Deadline expired per Google Sheets update (${incoming.expiryDate}).`;
    }
  }

  const existingSalaryLower = (existing.salary || '').toLowerCase();
  const isGenericSalary =
    !existing.salary ||
    existingSalaryLower.includes('not disclosed') ||
    existingSalaryLower === 'competitive';
  const incomingSalaryLower = (incoming.salary || '').toLowerCase();
  const isRealSalary =
    Boolean(incoming.salary) &&
    !incomingSalaryLower.includes('not disclosed') &&
    incomingSalaryLower !== 'competitive';

  if (isGenericSalary && isRealSalary) {
    patch.salary = incoming.salary;
    changed = true;
  }

  if ((!existing.skills || existing.skills.length === 0) && incoming.skills.length > 0) {
    patch.skills = incoming.skills;
    changed = true;
  }

  if (!existing.qualification && incoming.qualification) {
    patch.qualification = incoming.qualification;
    changed = true;
  }

  // Strictly NEVER touch isApproved, lastVerificationDate (except expiry), or revert Verified status.
  return changed ? patch : null;
}

export interface RunGoogleSheetsSyncOptions {
  env?: Record<string, string | undefined>;
  fetchOptions?: FetchWithRetryOptions;
  overrideRawData?: FetchedSheetRawPayload;
  ownerId?: string;
  lockTtlMs?: number;
  referenceDate?: Date;
}

/**
 * Executes end-to-end server-side Google Sheets synchronization:
 * validates config -> fetches with retry -> validates columns -> validates rows ->
 * deduplicates -> creates Pending Verification records (never deletes existing DB rows) ->
 * records timestamps and any errors.
 */
export async function runGoogleSheetsSync(
  storage: GoogleSheetsStorageAdapter,
  options: RunGoogleSheetsSyncOptions = {}
): Promise<GoogleSheetsSyncReport> {
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});
  const referenceDate = options.referenceDate || new Date();
  const timestamp = referenceDate.toISOString();
  const ownerId = options.ownerId || `gsheets-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lockTtlMs = options.lockTtlMs ?? 5 * 60 * 1000;

  if (storage.acquireSyncLock) {
    const acquired = await storage.acquireSyncLock(ownerId, lockTtlMs);
    if (!acquired) {
      throw new SyncInProgressError(
        'An opportunity or Google Sheets synchronization job is already in progress.'
      );
    }
  }

  const previousStatus = storage.getGoogleSheetsStatus
    ? await Promise.resolve(storage.getGoogleSheetsStatus()).catch(() => null)
    : null;

  try {
    const rawPayload =
      options.overrideRawData ?? (await fetchGoogleSheetsRawData(env, options.fetchOptions));

    const report: GoogleSheetsSyncReport = {
      timestamp,
      configured: rawPayload.configured,
      mode: rawPayload.mode,
      columnValidation: null,
      rowsFetched: rawPayload.rows.length,
      importedCount: 0,
      updatedCount: 0,
      duplicatesSkippedCount: 0,
      invalidRowsCount: 0,
      expiredSkippedCount: 0,
      deletedCount: 0, // Strictly never delete existing database records on Sheet sync
      invalidRows: [],
    };

    const persistStatus = async (
      statusKind: GoogleSheetsSyncStatusRecord['lastStatus'],
      errorMsg: string | null
    ) => {
      if (storage.saveGoogleSheetsStatus) {
        const nextStatus: GoogleSheetsSyncStatusRecord = {
          lastSyncAttemptAt: timestamp,
          lastSuccessfulSyncAt:
            statusKind === 'success' || statusKind === 'partial'
              ? timestamp
              : previousStatus?.lastSuccessfulSyncAt ?? null,
          lastStatus: statusKind,
          lastError: errorMsg,
          mode: rawPayload.mode,
          columnValidation: report.columnValidation,
          lastReport: report,
        };
        await storage.saveGoogleSheetsStatus(nextStatus);
      }
    };

    if (!rawPayload.configured) {
      report.error =
        'Google Sheets API credentials or endpoint are not configured on the server.';
      await persistStatus('error', report.error);
      await storage.recordSyncLog({
        sourceId: 'feed-google-sheets',
        sourceName: 'Google Sheets Sync',
        status: 'Error',
        itemsFetched: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        itemsExpired: 0,
        details: `${report.error} Existing approved database records remain accessible.`,
      });
      return report;
    }

    if (rawPayload.error) {
      report.error = rawPayload.error;
      await persistStatus('error', rawPayload.error);
      await storage.recordSyncLog({
        sourceId: 'feed-google-sheets',
        sourceName: `Google Sheets Sync (${rawPayload.mode})`,
        status: 'Error',
        itemsFetched: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        itemsExpired: 0,
        details: `Sync error: ${rawPayload.error}. Existing database records retained safely.`,
      });
      return report;
    }

    // Empty sheet or no header row at all
    if (rawPayload.headers.length === 0 && rawPayload.rows.length === 0) {
      report.columnValidation = validateSpreadsheetHeaders([]);
      await persistStatus('success', null);
      await storage.recordSyncLog({
        sourceId: 'feed-google-sheets',
        sourceName: `Google Sheets Sync (${rawPayload.mode})`,
        status: 'Success',
        itemsFetched: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        itemsExpired: 0,
        details: 'Spreadsheet is empty (0 rows). No existing database records modified or deleted.',
      });
      return report;
    }

    const effectiveHeaders =
      rawPayload.headers.length > 0 ? rawPayload.headers : Object.keys(rawPayload.rows[0] || {});
    const colValidation = validateSpreadsheetHeaders(effectiveHeaders);
    report.columnValidation = colValidation;

    if (!colValidation.valid) {
      report.error = `Spreadsheet column mapping validation failed. Missing required column(s): ${colValidation.missingRequired.join(', ')}.`;
      await persistStatus('error', report.error);
      await storage.recordSyncLog({
        sourceId: 'feed-google-sheets',
        sourceName: `Google Sheets Sync (${rawPayload.mode})`,
        status: 'Error',
        itemsFetched: rawPayload.rows.length,
        itemsAdded: 0,
        itemsUpdated: 0,
        itemsExpired: 0,
        details: `${report.error} Sync aborted without altering existing database records.`,
      });
      return report;
    }

    const existingJobs = [...(await storage.getAllJobs())];

    for (let i = 0; i < rawPayload.rows.length; i++) {
      const row = rawPayload.rows[i];
      const rowNumber = i + 2; // 1-indexed spreadsheet row (row 1 = headers)
      const rawCandidate = sheetRowToRawCandidate(row, rawPayload.sourceUrlLabel);

      // Handle completely empty spreadsheet rows gracefully
      if (!rawCandidate.title && !rawCandidate.employer && !rawCandidate.applicationUrl) {
        continue;
      }

      // Skip rows explicitly marked Closed/Expired by sheet status before import
      const rawStatus = getRowField(row, 'Status', 'status').toLowerCase();
      if (rawStatus === 'closed' || rawStatus === 'expired') {
        report.expiredSkippedCount++;
        continue;
      }

      const normResult = normalizeAndValidateCandidate(
        rawCandidate,
        'Google Sheets Institutional Feed',
        referenceDate
      );

      if (normResult.valid === false) {
        report.invalidRowsCount++;
        report.invalidRows.push({
          rowNumber,
          title: rawCandidate.title || '(Missing Title)',
          reason: normResult.reason,
        });
        continue;
      }

      const candidate = normResult.candidate;
      const existingMatch = findDuplicateJob(
        {
          title: candidate.title,
          employer: candidate.employer,
          location: candidate.location,
          applicationUrl: candidate.applicationUrl,
        },
        existingJobs
      );

      if (existingMatch) {
        const safePatch = mergeSafeSheetUpdates(existingMatch, candidate);
        if (safePatch) {
          const updated = await storage.updateJob(existingMatch.id, safePatch);
          if (updated) {
            const idx = existingJobs.findIndex((j) => j.id === existingMatch.id);
            if (idx >= 0) existingJobs[idx] = updated;
            report.updatedCount++;
            continue;
          }
        }
        report.duplicatesSkippedCount++;
        continue;
      }

      if (normResult.isAlreadyExpired) {
        report.expiredSkippedCount++;
        continue;
      }

      // Phase 09 Governance Rule: Every newly imported record begins as Pending Verification
      const created = await storage.createJob({
        title: candidate.title,
        employer: candidate.employer,
        description: candidate.description,
        location: candidate.location,
        qualification: candidate.qualification,
        skills: candidate.skills,
        employmentType: candidate.employmentType,
        salary: candidate.salary,
        applicationUrl: candidate.applicationUrl,
        source: candidate.source,
        originalJobUrl: candidate.originalJobUrl,
        publicationDate: candidate.publicationDate,
        expiryDate: candidate.expiryDate,
        lastVerificationDate: '',
        verificationStatus: 'Pending Verification',
        verificationNotes: 'Imported via server-side Google Sheets sync — awaiting administrator verification.',
        isActive: true,
        isApproved: false,
        featured: false,
        responsibilities: candidate.responsibilities,
        requirements: candidate.requirements,
        sector: candidate.sector,
      });

      existingJobs.push(created);
      report.importedCount++;
    }

    const finalStatus: GoogleSheetsSyncStatusRecord['lastStatus'] =
      report.invalidRowsCount > 0 ? 'partial' : 'success';

    await persistStatus(
      finalStatus,
      report.invalidRowsCount > 0
        ? `${report.invalidRowsCount} row(s) failed validation and were skipped.`
        : null
    );

    await storage.recordSyncLog({
      sourceId: 'feed-google-sheets',
      sourceName: `Google Sheets Sync (${rawPayload.mode})`,
      status: report.invalidRowsCount > 0 ? 'Partial' : 'Success',
      itemsFetched: report.rowsFetched,
      itemsAdded: report.importedCount,
      itemsUpdated: report.updatedCount,
      itemsExpired: report.expiredSkippedCount,
      details: `Fetched ${report.rowsFetched} row(s); imported ${report.importedCount} (Pending Verification), updated ${report.updatedCount}, skipped ${report.duplicatesSkippedCount} duplicate(s), rejected ${report.invalidRowsCount} invalid row(s). 0 records deleted.`,
    });

    return report;
  } finally {
    if (storage.releaseSyncLock) {
      await storage.releaseSyncLock(ownerId);
    }
  }
}
