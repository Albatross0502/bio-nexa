/**
 * BIO-INEXA Automated Job Listing Management System
 *
 * Handles:
 * 1. Authorized external source & employer feed ingestion (Adzuna API, Collaborative Google Sheet,
 *    and explicitly configured institutional RSS/JSON feeds — never unpermitted scraping or sample invention)
 * 2. Automated categorization into 11 target biotechnology fields
 * 3. Duplicate detection, URL validation (source + application links), & safe non-destructive updates
 * 4. Publication & expiry date monitoring (auto-marking expired listings)
 * 5. Broken application URL detection & health probe
 * 6. Admin approval & source audit pipeline (mandatory 'Pending Verification' / isApproved: false on import)
 * 7. Overlap prevention & exponential-backoff retry handling
 */

import { bionexaDb, DbJob } from '../../db/bionexaDatabase.js';
import {
  AuthorizedSourceDescriptor,
  CustomFeedSourceAdapter,
  executeOpportunitySync,
  FetchWithRetryOptions,
  getAuthorizedSourcesWithEnvStatus,
  getSyncScheduleConfig,
  OpportunitySyncReport,
  RawFeedCandidate,
  SyncInProgressError,
  SyncStorageAdapter,
} from './opportunitySyncEngine.js';
import {
  getGoogleSheetsConfigSummary,
  GoogleSheetsConfigSummary,
  GoogleSheetsStorageAdapter,
  GoogleSheetsSyncReport,
  GoogleSheetsSyncStatusRecord,
  runGoogleSheetsSync,
  RunGoogleSheetsSyncOptions,
} from '../opportunities/serverGoogleSheetsService.js';

export type {
  AuthorizedSourceDescriptor,
  CustomFeedSourceAdapter,
  GoogleSheetsConfigSummary,
  GoogleSheetsSyncReport,
  GoogleSheetsSyncStatusRecord,
  OpportunitySyncReport,
  RawFeedCandidate,
};
export {
  getAuthorizedSourcesWithEnvStatus,
  getGoogleSheetsConfigSummary,
  getSyncScheduleConfig,
  SyncInProgressError,
};

export type JobCategory =
  | 'Biotechnology Jobs'
  | 'Microbiology Jobs'
  | 'Research Jobs'
  | 'Pharmaceutical Jobs'
  | 'Clinical Research Jobs'
  | 'Bioinformatics Jobs'
  | 'Laboratory Jobs'
  | 'Quality Control Jobs'
  | 'Quality Assurance Jobs'
  | 'Biotechnology Internships'
  | 'Research Fellowships';

export interface AuthorizedFeedConfig {
  id: string;
  name: string;
  category: string;
  provider: string;
  endpointUrl: string;
  rateLimit: string;
  termsOfServiceCompliant: boolean;
  configured?: boolean;
  configurationNote?: string;
  notes: string;
}

export interface IngestionCandidate {
  title: string;
  employer: string;
  description: string;
  location: string;
  qualification: string;
  skills: string[];
  employmentType: string;
  salary: string;
  applicationUrl: string;
  source: string;
  originalJobUrl?: string;
  publicationDate: string;
  expiryDate: string;
  sector: string;
}

export type IngestionRunReport = OpportunitySyncReport;

export const AUTHORIZED_SOURCES: AuthorizedFeedConfig[] = getAuthorizedSourcesWithEnvStatus().map((src) => ({
  id: src.id,
  name: src.name,
  category: src.category,
  provider: src.provider,
  endpointUrl: src.endpointUrl,
  rateLimit: src.rateLimit,
  termsOfServiceCompliant: src.termsOfServiceCompliant,
  configured: src.configured,
  configurationNote: src.configurationNote,
  notes: src.notes,
}));

export class AutomatedJobManager {
  private lastReport: OpportunitySyncReport | null = null;
  private isSyncing = false;

  /**
   * Categorizes a job into one of the 11 target categories
   */
  public categorizeJob(title: string, description: string = ''): JobCategory {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('fellowship') || text.includes('jrf') || text.includes('srf') || text.includes('pmrf') || text.includes('postdoc')) {
      return 'Research Fellowships';
    }
    if (text.includes('intern') || text.includes('trainee') || text.includes('dissertation')) {
      return 'Biotechnology Internships';
    }
    if (text.includes('quality assurance') || text.includes('qa officer') || text.includes('qa specialist') || text.includes('qa associate')) {
      return 'Quality Assurance Jobs';
    }
    if (text.includes('quality control') || text.includes('qc associate') || text.includes('qc analyst') || text.includes('hplc') || text.includes('release testing')) {
      return 'Quality Control Jobs';
    }
    if (text.includes('bioinformatics') || text.includes('computational biology') || text.includes('nextflow') || text.includes('rnaseq') || text.includes('genomics pipeline')) {
      return 'Bioinformatics Jobs';
    }
    if (text.includes('clinical research') || text.includes('clinical trial') || text.includes('crc') || text.includes('cra') || text.includes('pharmacovigilance')) {
      return 'Clinical Research Jobs';
    }
    if (text.includes('pharma') || text.includes('formulation') || text.includes('drug discovery') || text.includes('regulatory affairs') || text.includes('active pharmaceutical')) {
      return 'Pharmaceutical Jobs';
    }
    if (text.includes('microbiology') || text.includes('microbiologist') || text.includes('fermentation') || text.includes('bacterial') || text.includes('aseptic')) {
      return 'Microbiology Jobs';
    }
    if (text.includes('laboratory') || text.includes('lab technologist') || text.includes('lab assistant') || text.includes('bench scientist') || text.includes('histopathology')) {
      return 'Laboratory Jobs';
    }
    if (text.includes('researcher') || text.includes('scientist') || text.includes('r&d') || text.includes('investigator') || text.includes('molecular biology')) {
      return 'Research Jobs';
    }
    return 'Biotechnology Jobs';
  }

  /**
   * Normalizes text for deduplication matching
   */
  public normalizeText(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes URLs for canonical matching
   */
  public normalizeUrl(url: string): string {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`.replace(/\/$/, '').toLowerCase();
    } catch {
      return url.trim().toLowerCase().replace(/\/$/, '');
    }
  }

  /**
   * Evaluates if two jobs are duplicates based on canonical URL or title+employer matching
   */
  public isDuplicate(candidate: IngestionCandidate, existingJobs: DbJob[]): boolean {
    const candidateNormUrl = this.normalizeUrl(candidate.applicationUrl);
    const candidateTitle = this.normalizeText(candidate.title);
    const candidateEmployer = this.normalizeText(candidate.employer);

    for (const j of existingJobs) {
      if (candidateNormUrl && this.normalizeUrl(j.applicationUrl) === candidateNormUrl) {
        return true;
      }

      const existingTitle = this.normalizeText(j.title);
      const existingEmployer = this.normalizeText(j.employer);

      if (candidateTitle === existingTitle && candidateEmployer === existingEmployer) {
        return true;
      }

      if (
        candidateEmployer === existingEmployer &&
        (candidateTitle.includes(existingTitle) || existingTitle.includes(candidateTitle)) &&
        Math.abs(candidateTitle.length - existingTitle.length) < 8
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates if a deadline is in the past
   */
  public isExpired(deadlineStr?: string, referenceDate: Date = new Date()): boolean {
    if (!deadlineStr || deadlineStr.toLowerCase().includes('not specified') || deadlineStr.toLowerCase().includes('rolling')) {
      return false;
    }
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime())) {
      return false;
    }

    deadline.setHours(23, 59, 59, 999);
    return deadline.getTime() < referenceDate.getTime();
  }

  /**
   * Probes URL reachability with timeout
   */
  public async probeUrl(url: string, timeoutMs: number = 4000): Promise<{ reachable: boolean; status?: number; error?: string }> {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return { reachable: false, error: 'Invalid URL protocol' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'BIO-INEXA-LinkChecker/1.0 (+https://bio-inexa-0.netlify.app)' }
        });
      } catch {
        res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'BIO-INEXA-LinkChecker/1.0 (+https://bio-inexa-0.netlify.app)' }
        });
      } finally {
        clearTimeout(timerOrTimeout(timeoutId));
      }

      if (res.status >= 200 && res.status < 400) {
        return { reachable: true, status: res.status };
      }
      if (res.status === 403 || res.status === 401) {
        return { reachable: true, status: res.status };
      }
      if (res.status === 404 || res.status === 410) {
        return { reachable: false, status: res.status, error: 'Page Not Found (404/410)' };
      }
      return { reachable: true, status: res.status };
    } catch (err: any) {
      return { reachable: false, error: err.name === 'AbortError' ? 'Probe timed out' : err.message };
    }
  }

  /**
   * Scans all stored jobs in database and marks expired listings
   */
  public markExpiredListings(recordLog: boolean = false): number {
    const allJobs = bionexaDb.getAllJobsAdmin();
    let updatedCount = 0;
    const now = new Date();

    for (const job of allJobs) {
      if (job.isActive && job.expiryDate && this.isExpired(job.expiryDate, now)) {
        bionexaDb.updateJob(job.id, {
          isActive: false,
          verificationStatus: 'Expired',
          verificationNotes: `Marked expired by deadline monitor (${job.expiryDate}).`,
        });
        updatedCount++;
      }
    }

    if (recordLog) {
      bionexaDb.recordSyncLog({
        sourceId: 'deadline-expiry-scan',
        sourceName: 'Automated Deadline Expiry Scan',
        status: 'Success',
        itemsFetched: allJobs.length,
        itemsAdded: 0,
        itemsUpdated: updatedCount,
        itemsExpired: updatedCount,
        details: `Scanned ${allJobs.length} job listings and marked ${updatedCount} expired.`
      });
    }

    return updatedCount;
  }

  /**
   * Checks health of all active job application links
   */
  public async auditApplicationUrls(limit: number = 20): Promise<{ jobId: string; title: string; employer: string; url: string; error: string }[]> {
    const jobs = bionexaDb.getJobs({ onlyActive: true });
    const broken: { jobId: string; title: string; employer: string; url: string; error: string }[] = [];

    const candidates = jobs.slice(0, limit);
    for (const j of candidates) {
      if (!j.applicationUrl) continue;
      const result = await this.probeUrl(j.applicationUrl);
      if (!result.reachable && (result.status === 404 || result.status === 410)) {
        broken.push({
          jobId: j.id,
          title: j.title,
          employer: j.employer,
          url: j.applicationUrl,
          error: result.error || `HTTP ${result.status} Not Found`
        });

        bionexaDb.updateJob(j.id, {
          verificationStatus: 'Link Unavailable',
          verificationNotes: result.error || 'Automated link reachability check detected HTTP 404/410.'
        });
      }
    }

    bionexaDb.recordSyncLog({
      sourceId: 'url-reachability-audit',
      sourceName: 'Application URL Reachability Audit',
      status: broken.length > 0 ? 'Partial' : 'Success',
      itemsFetched: candidates.length,
      itemsAdded: 0,
      itemsUpdated: broken.length,
      itemsExpired: 0,
      details: `Probed ${candidates.length} active URLs; ${broken.length} flagged as Link Unavailable.`
    });

    return broken;
  }

  /**
   * Executes genuine automated ingestion across authorized/configured feeds.
   * Never fabricates sample candidates or reports false import counts.
   */
  public async runAutomatedSync(options?: {
    customCandidates?: Array<IngestionCandidate | RawFeedCandidate>;
    customSources?: CustomFeedSourceAdapter[];
    simulateSourceErrors?: string[];
    fetchOptions?: FetchWithRetryOptions;
    env?: Record<string, string | undefined>;
    db?: typeof bionexaDb;
  }): Promise<OpportunitySyncReport> {
    if (this.isSyncing) {
      throw new SyncInProgressError('Automated ingestion is currently running.');
    }

    this.isSyncing = true;
    const db = options?.db || bionexaDb;

    const storage: SyncStorageAdapter = {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (jobInput) => db.createJob(jobInput),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => {
        const allJobs = db.getAllJobsAdmin();
        let updatedCount = 0;
        const now = new Date();
        for (const job of allJobs) {
          if (job.isActive && job.expiryDate && this.isExpired(job.expiryDate, now)) {
            db.updateJob(job.id, {
              isActive: false,
              verificationStatus: 'Expired',
              verificationNotes: `Marked expired by automated deadline monitor (${job.expiryDate}).`,
            });
            updatedCount++;
          }
        }
        return updatedCount;
      },
      recordSyncLog: (entry) => db.recordSyncLog(entry),
      saveLastReport: (report) => {
        this.lastReport = report;
        db.setContent('automated_sync_report', report, 'system_scheduler');
      },
    };

    try {
      const report = await executeOpportunitySync(storage, {
        env: options?.env,
        customCandidates: options?.customCandidates,
        customSources: options?.customSources,
        simulateSourceErrors: options?.simulateSourceErrors,
        fetchOptions: options?.fetchOptions,
      });
      this.lastReport = report;
      return report;
    } finally {
      this.isSyncing = false;
    }
  }

  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  public getScheduleConfig() {
    return getSyncScheduleConfig();
  }

  public getAuthorizedSources(): AuthorizedSourceDescriptor[] {
    return getAuthorizedSourcesWithEnvStatus();
  }

  public getLastReport(): OpportunitySyncReport | null {
    if (this.lastReport) return this.lastReport;
    return bionexaDb.getContent('automated_sync_report', null);
  }

  public getSyncHistory(limit: number = 50) {
    return bionexaDb.getSyncLogs(limit);
  }

  public getGoogleSheetsConfig(): GoogleSheetsConfigSummary {
    return getGoogleSheetsConfigSummary();
  }

  public getGoogleSheetsStatus(): GoogleSheetsSyncStatusRecord {
    const config = getGoogleSheetsConfigSummary();
    const stored = bionexaDb.getContent('google_sheets_sync_status', null) as GoogleSheetsSyncStatusRecord | null;
    if (stored) return stored;
    return {
      lastSyncAttemptAt: null,
      lastSuccessfulSyncAt: null,
      lastStatus: 'never_run',
      lastError: null,
      mode: config.mode,
      columnValidation: null,
      lastReport: null,
    };
  }

  public async runGoogleSheetsSync(
    options?: RunGoogleSheetsSyncOptions & { db?: typeof bionexaDb }
  ): Promise<GoogleSheetsSyncReport> {
    if (this.isSyncing) {
      throw new SyncInProgressError('A Google Sheets or automated synchronization run is currently in progress.');
    }

    this.isSyncing = true;
    const db = options?.db || bionexaDb;

    const storage: GoogleSheetsStorageAdapter = {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (jobInput) => db.createJob(jobInput),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => 0,
      recordSyncLog: (entry) => db.recordSyncLog(entry),
      getGoogleSheetsStatus: () => db.getContent('google_sheets_sync_status', null),
      saveGoogleSheetsStatus: (status) => {
        db.setContent('google_sheets_sync_status', status, 'system_scheduler');
      },
    };

    try {
      return await runGoogleSheetsSync(storage, options);
    } finally {
      this.isSyncing = false;
    }
  }
}

function timerOrTimeout(id: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
  return id;
}

export const automatedJobManager = new AutomatedJobManager();
