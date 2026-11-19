/**
 * BIO-INEXA Shared Genuine Opportunity Synchronization Engine
 *
 * Isomorphic (zero node:sqlite / node:fs dependencies) so both the Express/SQLite server
 * and Netlify Serverless Functions / Supabase PostgreSQL share the exact same ingestion,
 * normalization, URL validation, deduplication, retry, safe-update, and audit logic.
 *
 * Strict Governance Guarantees:
 * - Never invents sample opportunities or reports fake import counts.
 * - Never scrapes websites against their Terms of Service.
 * - Validates both source URLs and application destinations.
 * - Forces all newly imported listings into 'Pending Verification' (isApproved: false).
 * - Safely updates existing records without overwriting admin verification decisions.
 */

import { matchBranchesForOpportunity } from '../../config/branches';
import {
  findDuplicateJob,
  isJobExpiredByDeadline,
  normalizeJobVerificationStatus,
  validateApplicationUrl,
} from './jobVerification';
import { JobVerificationStatus } from '../../types';
import { fetchWithRetry, FetchWithRetryOptions } from '../../utils/fetchWithRetry';
import {
  fetchGoogleSheetsRawData,
  getGoogleSheetsConfigSummary,
} from '../opportunities/googleSheetsConnector';
import { RawSheetRow, validateSpreadsheetHeaders } from '../opportunities/googleSheetsSync';

export { fetchWithRetry };
export type { FetchWithRetryOptions };

export class SyncInProgressError extends Error {
  public readonly code = 'SYNC_IN_PROGRESS';
  public readonly statusCode = 409;

  constructor(message: string = 'An opportunity synchronization job is already running.') {
    super(message);
    this.name = 'SyncInProgressError';
  }
}

export interface SyncScheduleConfig {
  intervalHours: number;
  intervalMs: number;
  cronExpression: string;
}

export function getSyncScheduleConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): SyncScheduleConfig {
  const rawHours = Number(env.SYNC_INTERVAL_HOURS || '6');
  const intervalHours =
    Number.isFinite(rawHours) && rawHours >= 1 && rawHours <= 168 ? Math.round(rawHours) : 6;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const cronExpression =
    intervalHours >= 24 ? '0 0 * * *' : `0 */${intervalHours} * * *`;
  return { intervalHours, intervalMs, cronExpression };
}

export interface AuthorizedSourceDescriptor {
  id: string;
  name: string;
  category: string;
  provider: string;
  endpointUrl: string;
  rateLimit: string;
  termsOfServiceCompliant: boolean;
  integrationMethod: 'official_api' | 'authorized_json_feed' | 'authorized_rss_feed' | 'search_fallback_only';
  configured: boolean;
  configurationNote: string;
  notes: string;
}

export function getAuthorizedSourcesWithEnvStatus(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): AuthorizedSourceDescriptor[] {
  const adzunaConfigured = Boolean((env.ADZUNA_APP_ID || '').trim() && (env.ADZUNA_APP_KEY || '').trim());
  const sheetsSummary = getGoogleSheetsConfigSummary(env);
  const customFeedsRaw = (env.AUTHORIZED_FEED_URLS || '').trim();
  const customFeeds = customFeedsRaw
    ? customFeedsRaw.split(',').map((u) => u.trim()).filter(Boolean)
    : [];

  return [
    {
      id: 'feed-adzuna-lifesciences',
      name: 'Adzuna Developer Life Sciences Feed',
      category: 'Licensed Job Search Index',
      provider: 'Adzuna Developer API',
      endpointUrl: 'https://api.adzuna.com/v1/api/jobs/in/search/1',
      rateLimit: '250 requests / day (Developer License)',
      termsOfServiceCompliant: true,
      integrationMethod: 'official_api',
      configured: adzunaConfigured,
      configurationNote: adzunaConfigured
        ? 'API credentials configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).'
        : 'Skipped until ADZUNA_APP_ID and ADZUNA_APP_KEY are configured.',
      notes: 'Authorized programmatic API search for Indian biotechnology, microbiology, QC, and pharma roles.',
    },
    {
      id: 'feed-google-sheets',
      name: 'BIO-INEXA Collaborative Google Sheet Feed',
      category: 'Verified Partner Institutions',
      provider:
        sheetsSummary.mode === 'service_account'
          ? 'Google Sheets API v4 (Service Account)'
          : sheetsSummary.mode === 'api_key'
          ? 'Google Sheets API v4 (API Key)'
          : sheetsSummary.mode === 'csv'
          ? 'Google Sheets Published CSV'
          : 'Google Apps Script Web App Endpoint',
      endpointUrl:
        sheetsSummary.mode === 'service_account' || sheetsSummary.mode === 'api_key'
          ? 'https://sheets.googleapis.com/v4/spreadsheets'
          : 'https://script.google.com/macros/s/exec',
      rateLimit: '10 requests / minute',
      termsOfServiceCompliant: true,
      integrationMethod:
        sheetsSummary.mode === 'service_account' || sheetsSummary.mode === 'api_key'
          ? 'official_api'
          : 'authorized_json_feed',
      configured: sheetsSummary.configured,
      configurationNote: sheetsSummary.note,
      notes: '19-column standardized collaborative sheet maintained by career cells & academic partners.',
    },
    {
      id: 'feed-authorized-partner-feeds',
      name: 'Authorized Institutional RSS / JSON Feeds',
      category: 'Government / Academic & Employer Partners',
      provider: 'Configured Public Gazettes & Partner Endpoints',
      endpointUrl: customFeeds[0] || 'Configured via AUTHORIZED_FEED_URLS',
      rateLimit: '30 requests / hour (Retry-Safe)',
      termsOfServiceCompliant: true,
      integrationMethod: 'authorized_rss_feed',
      configured: customFeeds.length > 0,
      configurationNote:
        customFeeds.length > 0
          ? `${customFeeds.length} authorized feed endpoint(s) configured.`
          : 'No external institutional RSS/JSON feed URLs configured (AUTHORIZED_FEED_URLS).',
      notes: 'Connects strictly to explicitly authorized JSON, RSS, or Atom feeds with robots/ToS compliance.',
    },
    {
      id: 'feed-ncbi-pubmed',
      name: 'NCBI E-utilities Research Registry',
      category: 'Scientific Publication / Fellowship Reference',
      provider: 'National Center for Biotechnology Information (NCBI)',
      endpointUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      rateLimit: '3 requests / second',
      termsOfServiceCompliant: true,
      integrationMethod: 'official_api',
      configured: Boolean((env.NCBI_OPPORTUNITIES_FEED_URL || '').trim()),
      configurationNote: (env.NCBI_OPPORTUNITIES_FEED_URL || '').trim()
        ? 'Custom fellowship query configured.'
        : 'Literature reference active; fellowship auto-ingestion disabled unless NCBI_OPPORTUNITIES_FEED_URL is set.',
      notes: 'Open access NCBI API endpoint; never auto-imports research articles as fake job openings.',
    },
    {
      id: 'feed-linkedin-search-fallback',
      name: 'LinkedIn / Naukri Pre-Filtered Search Redirects',
      category: 'Search Discovery Fallback (ToS-Compliant)',
      provider: 'Pre-Filtered Search Query Links',
      endpointUrl: 'https://www.google.com/search?ibp=htl;jobs',
      rateLimit: 'User-initiated redirection only',
      termsOfServiceCompliant: true,
      integrationMethod: 'search_fallback_only',
      configured: true,
      configurationNote: 'Search redirection only (zero automated scraping).',
      notes: 'Preserves external portal ToS by redirecting users rather than scraping third-party job boards.',
    },
  ];
}

export interface RawFeedCandidate {
  id?: string;
  title?: string;
  employer?: string;
  company?: string;
  organization?: string;
  description?: string;
  location?: string;
  qualification?: string;
  skills?: string[];
  employmentType?: string;
  type?: string;
  salary?: string;
  salaryOrStipend?: string;
  applicationUrl?: string;
  registrationUrl?: string;
  url?: string;
  source?: string;
  sourceName?: string;
  sourceId?: string;
  originalJobUrl?: string;
  sourceUrl?: string;
  publicationDate?: string;
  postedDate?: string;
  expiryDate?: string;
  deadline?: string;
  sector?: string;
  responsibilities?: string[];
  requirements?: string[];
}

export interface NormalizedSyncCandidate {
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
  originalJobUrl: string;
  publicationDate: string;
  expiryDate: string;
  sector: string;
  responsibilities: string[];
  requirements: string[];
}

export interface SyncErrorEntry {
  sourceId: string;
  sourceName: string;
  error: string;
  fallbackRetained: boolean;
}

export interface SourceSyncDetail {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'skipped_unconfigured' | 'failed';
  fetchedCount: number;
  importedCount: number;
  updatedCount: number;
  duplicatesSkippedCount: number;
  rejectedCount: number;
  message: string;
}

export interface OpportunitySyncReport {
  timestamp: string;
  scheduleIntervalHours: number;
  sourcesAttempted: number;
  sourcesSuccessful: number;
  sourcesFailed: number;
  sourcesSkippedUnconfigured: number;
  candidatesProcessed: number;
  newImportedCount: number;
  updatedCount: number;
  duplicatesSkippedCount: number;
  invalidRejectedCount: number;
  expiredSkippedCount: number;
  expiredMarkedCount: number;
  brokenUrlsFoundCount: number;
  errors: SyncErrorEntry[];
  brokenUrls: { jobId: string; title: string; employer: string; url: string; error: string }[];
  sourceDetails: SourceSyncDetail[];
  rejectedDetails: Array<{ title: string; reason: string }>;
}

export interface PersistedJobRecord {
  id: string;
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
  lastVerificationDate?: string;
  verificationStatus: JobVerificationStatus | string;
  verificationNotes?: string;
  isActive: boolean;
  isApproved: boolean;
  featured: boolean;
  responsibilities: string[];
  requirements: string[];
  sector: string;
}

export interface SyncStorageAdapter {
  getAllJobs: () => Promise<PersistedJobRecord[]> | PersistedJobRecord[];
  createJob: (job: {
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
    originalJobUrl: string;
    publicationDate: string;
    expiryDate: string;
    lastVerificationDate: string;
    verificationStatus: JobVerificationStatus;
    verificationNotes: string;
    isActive: boolean;
    isApproved: boolean;
    featured: boolean;
    responsibilities: string[];
    requirements: string[];
    sector: string;
  }) => Promise<PersistedJobRecord> | PersistedJobRecord;
  updateJob: (
    id: string,
    updates: Partial<PersistedJobRecord>
  ) => Promise<PersistedJobRecord | null> | PersistedJobRecord | null;
  markExpiredListings: () => Promise<number> | number;
  recordSyncLog: (entry: {
    sourceId: string;
    sourceName: string;
    status: 'Success' | 'Partial' | 'Error';
    itemsFetched?: number;
    itemsAdded?: number;
    itemsUpdated?: number;
    itemsExpired?: number;
    details?: string;
  }) => Promise<any> | any;
  saveLastReport?: (report: OpportunitySyncReport) => Promise<void> | void;
  acquireSyncLock?: (ownerId: string, ttlMs: number) => Promise<boolean> | boolean;
  releaseSyncLock?: (ownerId: string) => Promise<void> | void;
}

function getSheetCell(row: RawSheetRow, ...aliases: string[]): string {
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

function stripHtmlAndDecode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIsoDate(rawDate?: string): string {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower === 'not specified' || lower === 'rolling' || lower === 'open / rolling') {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

const KNOWN_BIOTECH_SKILLS = [
  'PCR',
  'qPCR',
  'RT-PCR',
  'CRISPR',
  'HPLC',
  'LC-MS',
  'ELISA',
  'Flow Cytometry',
  'Cell Culture',
  'Fermentation',
  'Bioprocess',
  'Downstream Processing',
  'Bioinformatics',
  'RNA-Seq',
  'NGS',
  'Python',
  'R',
  'cGMP',
  'Quality Control',
  'Quality Assurance',
  'Microbiology',
  'Sterility Testing',
  'Clinical Research',
  'Pharmacovigilance',
];

function extractSkills(title: string, description: string, supplied?: string[]): string[] {
  if (Array.isArray(supplied) && supplied.length > 0) {
    return supplied.map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
  }
  const haystack = `${title} ${description}`.toLowerCase();
  const matched = KNOWN_BIOTECH_SKILLS.filter((skill) =>
    haystack.includes(skill.toLowerCase())
  );
  if (matched.length > 0) return matched.slice(0, 6);

  const branches = matchBranchesForOpportunity(title, description);
  return branches.slice(0, 3).map((b) =>
    b
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function inferSector(employer: string, explicitSector?: string): string {
  if (explicitSector && explicitSector.trim()) return explicitSector.trim();
  const lower = employer.toLowerCase();
  if (
    lower.includes('csir') ||
    lower.includes('dbt') ||
    lower.includes('icmr') ||
    lower.includes('icar') ||
    lower.includes('iisc') ||
    lower.includes('aiims') ||
    lower.includes('iit') ||
    lower.includes('nit') ||
    lower.includes('ncbs') ||
    lower.includes('ccmb') ||
    lower.includes('igib') ||
    lower.includes('thsti') ||
    lower.includes('rcb') ||
    lower.includes('government') ||
    lower.includes('govt') ||
    lower.includes('ministry')
  ) {
    return 'Government / Autonomous Research';
  }
  return 'Biotechnology & Life Sciences';
}

export function normalizeAndValidateCandidate(
  raw: RawFeedCandidate,
  fallbackSourceName: string = 'Authorized External Feed',
  referenceDate: Date = new Date()
): { valid: true; candidate: NormalizedSyncCandidate; isAlreadyExpired: boolean } | { valid: false; reason: string } {
  const title = stripHtmlAndDecode(String(raw.title || ''));
  const employer = stripHtmlAndDecode(
    String(raw.employer || raw.company || raw.organization || '')
  );

  if (!title || title.length < 3) {
    return { valid: false, reason: 'Missing or invalid job title.' };
  }
  if (!employer || employer.length < 2) {
    return { valid: false, reason: 'Missing or invalid employer/organization name.' };
  }

  const rawAppUrl = String(raw.applicationUrl || raw.registrationUrl || raw.url || '').trim();
  const appUrlCheck = validateApplicationUrl(rawAppUrl);
  if (!appUrlCheck.valid) {
    return {
      valid: false,
      reason: appUrlCheck.reason || `Invalid application destination URL: ${rawAppUrl || 'empty'}`,
    };
  }

  const rawSourceUrl = String(raw.originalJobUrl || raw.sourceUrl || '').trim();
  let normalizedSourceUrl = appUrlCheck.normalizedUrl;
  if (rawSourceUrl) {
    const sourceUrlCheck = validateApplicationUrl(rawSourceUrl);
    if (!sourceUrlCheck.valid) {
      return {
        valid: false,
        reason: `Invalid source URL: ${sourceUrlCheck.reason || rawSourceUrl}`,
      };
    }
    normalizedSourceUrl = sourceUrlCheck.normalizedUrl;
  }

  const cleanDesc = stripHtmlAndDecode(String(raw.description || ''));
  const description =
    cleanDesc.length >= 10
      ? cleanDesc
      : `${title} at ${employer}. Verify complete role criteria on the official employer portal.`;

  const location = stripHtmlAndDecode(String(raw.location || '')) || 'India';
  const qualification =
    stripHtmlAndDecode(String(raw.qualification || '')) || 'Relevant Degree in Life Sciences / Biotechnology';
  const employmentType = stripHtmlAndDecode(String(raw.employmentType || raw.type || '')) || 'Full-time';
  const salary =
    stripHtmlAndDecode(String(raw.salary || raw.salaryOrStipend || '')) ||
    'Not Disclosed / Competitive';
  const source =
    stripHtmlAndDecode(String(raw.source || raw.sourceName || '')) || fallbackSourceName;

  const publicationDate =
    normalizeIsoDate(raw.publicationDate || raw.postedDate) ||
    referenceDate.toISOString().split('T')[0];
  const expiryDate = normalizeIsoDate(raw.expiryDate || raw.deadline);

  const isAlreadyExpired =
    Boolean(expiryDate) && isJobExpiredByDeadline(expiryDate);

  return {
    valid: true,
    isAlreadyExpired,
    candidate: {
      title,
      employer,
      description,
      location,
      qualification,
      skills: extractSkills(title, description, raw.skills),
      employmentType,
      salary,
      applicationUrl: appUrlCheck.normalizedUrl,
      source,
      originalJobUrl: normalizedSourceUrl,
      publicationDate,
      expiryDate,
      sector: inferSector(employer, raw.sector),
      responsibilities: Array.isArray(raw.responsibilities)
        ? raw.responsibilities.map((r) => stripHtmlAndDecode(String(r))).filter(Boolean)
        : [],
      requirements: Array.isArray(raw.requirements)
        ? raw.requirements.map((r) => stripHtmlAndDecode(String(r))).filter(Boolean)
        : [],
    },
  };
}

function extractXmlTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? stripHtmlAndDecode(match[1]) : '';
}

function extractAtomLink(block: string): string {
  const altMatch = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (altMatch) return altMatch[1].trim();
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch) return hrefMatch[1].trim();
  return extractXmlTag(block, 'link');
}

export function parseRssOrAtomFeed(
  xmlText: string,
  defaultEmployer: string,
  feedUrl: string
): RawFeedCandidate[] {
  const candidates: RawFeedCandidate[] = [];
  const itemBlocks = xmlText.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];

  for (const block of itemBlocks) {
    const title = extractXmlTag(block, 'title');
    const link = extractAtomLink(block);
    const description =
      extractXmlTag(block, 'description') ||
      extractXmlTag(block, 'summary') ||
      extractXmlTag(block, 'content');
    const pubDate =
      extractXmlTag(block, 'pubDate') ||
      extractXmlTag(block, 'published') ||
      extractXmlTag(block, 'updated');
    const author =
      extractXmlTag(block, 'dc:creator') ||
      extractXmlTag(block, 'author') ||
      defaultEmployer;

    if (title && link) {
      candidates.push({
        title,
        employer: author || defaultEmployer,
        description,
        location: 'India',
        applicationUrl: link,
        originalJobUrl: feedUrl,
        source: defaultEmployer,
        publicationDate: pubDate,
      });
    }
  }

  return candidates;
}

const BIOTECH_ADZUNA_QUERIES = ['biotechnology', 'microbiology', 'bioinformatics', 'clinical research'];

export async function fetchFromAdzuna(
  env: Record<string, string | undefined>,
  fetchOptions: FetchWithRetryOptions = {}
): Promise<{ configured: boolean; sourceId: string; sourceName: string; candidates: RawFeedCandidate[]; error?: string }> {
  const sourceId = 'feed-adzuna-lifesciences';
  const sourceName = 'Adzuna Developer Life Sciences Feed';
  const appId = (env.ADZUNA_APP_ID || '').trim();
  const appKey = (env.ADZUNA_APP_KEY || '').trim();

  if (!appId || !appKey) {
    return { configured: false, sourceId, sourceName, candidates: [] };
  }

  const allCandidates: RawFeedCandidate[] = [];
  const errors: string[] = [];
  let succeededQueries = 0;

  for (const what of BIOTECH_ADZUNA_QUERIES) {
    const url =
      `https://api.adzuna.com/v1/api/jobs/in/search/1` +
      `?app_id=${encodeURIComponent(appId)}` +
      `&app_key=${encodeURIComponent(appKey)}` +
      `&results_per_page=10` +
      `&what=${encodeURIComponent(what)}` +
      `&content-type=application/json`;

    try {
      const res = await fetchWithRetry(
        url,
        { method: 'GET', headers: { Accept: 'application/json' } },
        fetchOptions
      );
      if (!res.ok) {
        errors.push(`Query "${what}" returned HTTP ${res.status}`);
        continue;
      }
      const data: any = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      succeededQueries++;
      for (const item of results) {
        const minSal = item.salary_min ? Number(item.salary_min) : 0;
        const maxSal = item.salary_max ? Number(item.salary_max) : 0;
        const salary =
          minSal && maxSal
            ? `₹${Math.round(minSal).toLocaleString('en-IN')} - ₹${Math.round(maxSal).toLocaleString('en-IN')} / yr`
            : minSal
            ? `₹${Math.round(minSal).toLocaleString('en-IN')}+ / yr`
            : 'Not Disclosed';

        allCandidates.push({
          id: item.id ? `adzuna-${item.id}` : undefined,
          title: item.title,
          employer: item.company?.display_name || 'Life Sciences Employer',
          description: item.description,
          location: item.location?.display_name || 'India',
          employmentType: item.contract_time === 'part_time' ? 'Part-time' : 'Full-time',
          salary,
          applicationUrl: item.redirect_url,
          originalJobUrl: 'https://www.adzuna.in',
          source: 'Adzuna India API',
          publicationDate: item.created,
          sector: item.category?.label || 'Biotechnology & Life Sciences',
        });
      }
    } catch (err: any) {
      errors.push(`Query "${what}" failed: ${err?.message || String(err)}`);
    }
  }

  return {
    configured: true,
    sourceId,
    sourceName,
    candidates: allCandidates,
    ...(succeededQueries === 0 && errors.length > 0 ? { error: errors.join('; ') } : {}),
  };
}

export async function fetchFromGoogleSheetWebApp(
  env: Record<string, string | undefined>,
  fetchOptions: FetchWithRetryOptions = {}
): Promise<{ configured: boolean; sourceId: string; sourceName: string; candidates: RawFeedCandidate[]; error?: string }> {
  const sourceId = 'feed-google-sheets';
  const sourceName = 'BIO-INEXA Collaborative Google Sheet Feed';
  const rawPayload = await fetchGoogleSheetsRawData(env, fetchOptions);

  if (!rawPayload.configured) {
    return { configured: false, sourceId, sourceName, candidates: [] };
  }

  if (rawPayload.error) {
    return {
      configured: true,
      sourceId,
      sourceName,
      candidates: [],
      error: rawPayload.error,
    };
  }

  if (rawPayload.headers.length === 0 && rawPayload.rows.length === 0) {
    return { configured: true, sourceId, sourceName, candidates: [] };
  }

  const effectiveHeaders =
    rawPayload.headers.length > 0
      ? rawPayload.headers
      : Object.keys(rawPayload.rows[0] || {});
  const colValidation = validateSpreadsheetHeaders(effectiveHeaders);
  if (!colValidation.valid) {
    return {
      configured: true,
      sourceId,
      sourceName,
      candidates: [],
      error: `Google Sheet column validation failed. Missing required column(s): ${colValidation.missingRequired.join(', ')}.`,
    };
  }

  const candidates: RawFeedCandidate[] = [];
  for (const row of rawPayload.rows) {
    const title = getSheetCell(row, 'Title', 'title', 'Job Title', 'Opportunity Title', 'Position');
    const employer = getSheetCell(row, 'Organization', 'organization', 'Company', 'Employer', 'Institution', 'Provider');
    const appUrl = getSheetCell(row, 'Application URL', 'applicationUrl', 'Apply Link', 'Apply URL', 'URL', 'Link');
    const regUrl = getSheetCell(row, 'Registration URL', 'registrationUrl', 'Register Link', 'Register URL');
    if (!title && !employer && !appUrl && !regUrl) continue;
    const rowStatus = getSheetCell(row, 'Status', 'status').toLowerCase();
    if (rowStatus === 'closed' || rowStatus === 'expired') continue;

    candidates.push({
      title,
      employer,
      description: getSheetCell(row, 'Description', 'description', 'Details', 'Overview'),
      location: getSheetCell(row, 'Location', 'location', 'City', 'Venue') || 'All India',
      qualification: getSheetCell(row, 'Qualification', 'qualification', 'Eligibility', 'Degrees'),
      employmentType: getSheetCell(row, 'Mode', 'mode', 'Work Mode', 'Employment Type') || 'Full-time',
      salary: getSheetCell(row, 'Salary/Stipend', 'salaryOrStipend', 'Salary', 'Stipend') || 'Not Disclosed',
      applicationUrl: appUrl || regUrl,
      originalJobUrl: rawPayload.sourceUrlLabel,
      source: 'Google Sheets Institutional Feed',
      publicationDate: getSheetCell(row, 'Published Date', 'publishedDate', 'Posted Date', 'Date'),
      expiryDate: getSheetCell(row, 'Application Deadline', 'applicationDeadline', 'Deadline', 'Expiry Date'),
      sector: getSheetCell(row, 'Category', 'category', 'Type', 'Sector') || 'Biotechnology Jobs',
    });
  }

  return {
    configured: true,
    sourceId,
    sourceName,
    candidates,
  };
}

export async function fetchFromConfiguredFeedUrls(
  env: Record<string, string | undefined>,
  fetchOptions: FetchWithRetryOptions = {}
): Promise<Array<{ sourceId: string; sourceName: string; candidates: RawFeedCandidate[]; error?: string }>> {
  const rawList = (env.AUTHORIZED_FEED_URLS || '').trim();
  if (!rawList) return [];

  const urls = rawList
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  const outcomes: Array<{ sourceId: string; sourceName: string; candidates: RawFeedCandidate[]; error?: string }> = [];

  for (let i = 0; i < urls.length; i++) {
    const feedUrl = urls[i];
    const sourceId = `feed-partner-${i + 1}`;
    let hostname = 'Partner Feed';
    try {
      hostname = new URL(feedUrl).hostname;
    } catch {
      hostname = feedUrl;
    }
    const sourceName = `Authorized Feed (${hostname})`;

    const urlCheck = validateApplicationUrl(feedUrl);
    if (!urlCheck.valid) {
      outcomes.push({
        sourceId,
        sourceName,
        candidates: [],
        error: `Rejected unsafe feed URL: ${urlCheck.reason}`,
      });
      continue;
    }

    try {
      const res = await fetchWithRetry(
        urlCheck.normalizedUrl,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json, application/rss+xml, application/atom+xml, application/xml, text/xml',
            'User-Agent': 'BIO-INEXA-AuthorizedSync/1.0 (+https://bio-inexa-0.netlify.app)',
          },
        },
        fetchOptions
      );

      if (!res.ok) {
        outcomes.push({
          sourceId,
          sourceName,
          candidates: [],
          error: `HTTP ${res.status} returned by ${hostname}`,
        });
        continue;
      }

      const bodyText = await res.text();
      const trimmed = bodyText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        const rows = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.jobs)
          ? parsed.jobs
          : Array.isArray(parsed?.opportunities)
          ? parsed.opportunities
          : Array.isArray(parsed?.data)
          ? parsed.data
          : [];
        const candidates: RawFeedCandidate[] = rows.map((row: any) => ({
          ...row,
          source: row.source || row.sourceName || sourceName,
          originalJobUrl: row.originalJobUrl || row.sourceUrl || urlCheck.normalizedUrl,
        }));
        outcomes.push({ sourceId, sourceName, candidates });
      } else if (trimmed.includes('<rss') || trimmed.includes('<feed') || trimmed.includes('<item') || trimmed.includes('<entry')) {
        const candidates = parseRssOrAtomFeed(trimmed, hostname, urlCheck.normalizedUrl);
        outcomes.push({ sourceId, sourceName, candidates });
      } else {
        outcomes.push({
          sourceId,
          sourceName,
          candidates: [],
          error: 'Unsupported non-JSON/non-RSS feed format; HTML scraping is disabled for compliance.',
        });
      }
    } catch (err: any) {
      outcomes.push({
        sourceId,
        sourceName,
        candidates: [],
        error: err?.message || `Failed to query ${hostname}`,
      });
    }
  }

  return outcomes;
}

export interface CustomFeedSourceAdapter {
  sourceId: string;
  sourceName: string;
  fetchCandidates: () => Promise<RawFeedCandidate[]>;
}

export interface ExecuteSyncOptions {
  env?: Record<string, string | undefined>;
  fetchOptions?: FetchWithRetryOptions;
  customSources?: CustomFeedSourceAdapter[];
  customCandidates?: RawFeedCandidate[];
  simulateSourceErrors?: string[];
  ownerId?: string;
  lockTtlMs?: number;
  referenceDate?: Date;
}

function mergeSafeExistingUpdates(
  existing: PersistedJobRecord,
  incoming: NormalizedSyncCandidate
): Partial<PersistedJobRecord> | null {
  const existingVerStatus = normalizeJobVerificationStatus(existing.verificationStatus);
  // Never resurrect or mutate admin-rejected listings automatically
  if (existingVerStatus === 'Rejected') {
    return null;
  }

  const patch: Partial<PersistedJobRecord> = {};
  let changed = false;

  // Safely update deadline if incoming provides a valid non-empty deadline that changed
  if (incoming.expiryDate && incoming.expiryDate !== existing.expiryDate) {
    patch.expiryDate = incoming.expiryDate;
    changed = true;

    if (existing.isActive && isJobExpiredByDeadline(incoming.expiryDate)) {
      patch.isActive = false;
      patch.verificationStatus = 'Expired';
      patch.verificationNotes = `Deadline expired per upstream feed update (${incoming.expiryDate}).`;
    }
  }

  // Safely enrich missing/generic salary without wiping admin curation
  const existingSalaryLower = (existing.salary || '').toLowerCase();
  const isGenericExistingSalary =
    !existing.salary ||
    existingSalaryLower.includes('not disclosed') ||
    existingSalaryLower === 'competitive';
  const incomingSalaryLower = (incoming.salary || '').toLowerCase();
  const isIncomingRealSalary =
    Boolean(incoming.salary) &&
    !incomingSalaryLower.includes('not disclosed') &&
    incomingSalaryLower !== 'competitive';

  if (isGenericExistingSalary && isIncomingRealSalary) {
    patch.salary = incoming.salary;
    changed = true;
  }

  // Enrich empty skills or qualification safely
  if ((!existing.skills || existing.skills.length === 0) && incoming.skills.length > 0) {
    patch.skills = incoming.skills;
    changed = true;
  }

  if (!existing.qualification && incoming.qualification) {
    patch.qualification = incoming.qualification;
    changed = true;
  }

  // Strictly NEVER touch isApproved, lastVerificationDate (unless transitioning to Expired),
  // or revert Verified status during automated updates.
  return changed ? patch : null;
}

export async function executeOpportunitySync(
  storage: SyncStorageAdapter,
  options: ExecuteSyncOptions = {}
): Promise<OpportunitySyncReport> {
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});
  const schedule = getSyncScheduleConfig(env);
  const referenceDate = options.referenceDate || new Date();
  const ownerId = options.ownerId || `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lockTtlMs = options.lockTtlMs ?? 5 * 60 * 1000;

  if (storage.acquireSyncLock) {
    const acquired = await storage.acquireSyncLock(ownerId, lockTtlMs);
    if (!acquired) {
      throw new SyncInProgressError(
        'Another automated opportunity synchronization run is currently in progress. Wait for completion before retrying.'
      );
    }
  }

  const report: OpportunitySyncReport = {
    timestamp: referenceDate.toISOString(),
    scheduleIntervalHours: schedule.intervalHours,
    sourcesAttempted: 0,
    sourcesSuccessful: 0,
    sourcesFailed: 0,
    sourcesSkippedUnconfigured: 0,
    candidatesProcessed: 0,
    newImportedCount: 0,
    updatedCount: 0,
    duplicatesSkippedCount: 0,
    invalidRejectedCount: 0,
    expiredSkippedCount: 0,
    expiredMarkedCount: 0,
    brokenUrlsFoundCount: 0,
    errors: [],
    brokenUrls: [],
    sourceDetails: [],
    rejectedDetails: [],
  };

  try {
    const existingJobs = [...(await storage.getAllJobs())];

    type CollectedBatch = {
      sourceId: string;
      sourceName: string;
      rawCandidates: RawFeedCandidate[];
      error?: string;
      skippedUnconfigured?: boolean;
    };

    const batches: CollectedBatch[] = [];

    if (options.customCandidates !== undefined) {
      batches.push({
        sourceId: 'custom-authorized-feed',
        sourceName: 'Custom Authorized Feed Batch',
        rawCandidates: options.customCandidates,
      });
    } else if (options.customSources && options.customSources.length > 0) {
      for (const src of options.customSources) {
        if (options.simulateSourceErrors?.includes(src.sourceId)) {
          batches.push({
            sourceId: src.sourceId,
            sourceName: src.sourceName,
            rawCandidates: [],
            error: 'Simulated upstream source timeout (HTTP 504). Existing listings preserved.',
          });
          continue;
        }
        try {
          const rawCandidates = await src.fetchCandidates();
          batches.push({
            sourceId: src.sourceId,
            sourceName: src.sourceName,
            rawCandidates,
          });
        } catch (err: any) {
          batches.push({
            sourceId: src.sourceId,
            sourceName: src.sourceName,
            rawCandidates: [],
            error: err?.message || 'Upstream source query failed.',
          });
        }
      }
    } else {
      // Production & Local Server Authorized Connectors
      const [adzunaRes, sheetRes, configuredFeedRes] = await Promise.all([
        fetchFromAdzuna(env, options.fetchOptions),
        fetchFromGoogleSheetWebApp(env, options.fetchOptions),
        fetchFromConfiguredFeedUrls(env, options.fetchOptions),
      ]);

      batches.push({
        sourceId: adzunaRes.sourceId,
        sourceName: adzunaRes.sourceName,
        rawCandidates: adzunaRes.candidates,
        error: adzunaRes.error,
        skippedUnconfigured: !adzunaRes.configured,
      });

      batches.push({
        sourceId: sheetRes.sourceId,
        sourceName: sheetRes.sourceName,
        rawCandidates: sheetRes.candidates,
        error: sheetRes.error,
        skippedUnconfigured: !sheetRes.configured,
      });

      for (const feedOutcome of configuredFeedRes) {
        batches.push({
          sourceId: feedOutcome.sourceId,
          sourceName: feedOutcome.sourceName,
          rawCandidates: feedOutcome.candidates,
          error: feedOutcome.error,
        });
      }

      if (options.simulateSourceErrors && options.simulateSourceErrors.length > 0) {
        for (const simulatedId of options.simulateSourceErrors) {
          if (!batches.some((b) => b.sourceId === simulatedId)) {
            batches.push({
              sourceId: simulatedId,
              sourceName: simulatedId,
              rawCandidates: [],
              error: 'Upstream source unavailable. Existing listings preserved.',
            });
          }
        }
      }
    }

    for (const batch of batches) {
      if (batch.skippedUnconfigured) {
        report.sourcesSkippedUnconfigured++;
        report.sourceDetails.push({
          sourceId: batch.sourceId,
          sourceName: batch.sourceName,
          status: 'skipped_unconfigured',
          fetchedCount: 0,
          importedCount: 0,
          updatedCount: 0,
          duplicatesSkippedCount: 0,
          rejectedCount: 0,
          message: 'Skipped: credentials or endpoint URL not configured in environment.',
        });
        continue;
      }

      report.sourcesAttempted++;

      if (batch.error) {
        report.sourcesFailed++;
        report.errors.push({
          sourceId: batch.sourceId,
          sourceName: batch.sourceName,
          error: batch.error,
          fallbackRetained: true,
        });
        report.sourceDetails.push({
          sourceId: batch.sourceId,
          sourceName: batch.sourceName,
          status: 'failed',
          fetchedCount: 0,
          importedCount: 0,
          updatedCount: 0,
          duplicatesSkippedCount: 0,
          rejectedCount: 0,
          message: batch.error,
        });
        continue;
      }

      report.sourcesSuccessful++;
      let srcImported = 0;
      let srcUpdated = 0;
      let srcDupes = 0;
      let srcRejected = 0;

      for (const raw of batch.rawCandidates) {
        report.candidatesProcessed++;

        const normResult = normalizeAndValidateCandidate(
          raw,
          batch.sourceName,
          referenceDate
        );

        if (normResult.valid === false) {
          report.invalidRejectedCount++;
          srcRejected++;
          report.rejectedDetails.push({
            title: String(raw.title || 'Untitled'),
            reason: normResult.reason,
          });
          continue;
        }

        const candidate = normResult.candidate;
        const matchedExisting = findDuplicateJob(
          {
            title: candidate.title,
            employer: candidate.employer,
            location: candidate.location,
            applicationUrl: candidate.applicationUrl,
          },
          existingJobs
        );

        if (matchedExisting) {
          const safePatch = mergeSafeExistingUpdates(matchedExisting, candidate);
          if (safePatch) {
            const updatedRecord = await storage.updateJob(matchedExisting.id, safePatch);
            if (updatedRecord) {
              const idx = existingJobs.findIndex((j) => j.id === matchedExisting.id);
              if (idx >= 0) existingJobs[idx] = updatedRecord;
              report.updatedCount++;
              srcUpdated++;
              continue;
            }
          }
          report.duplicatesSkippedCount++;
          srcDupes++;
          continue;
        }

        if (normResult.isAlreadyExpired) {
          report.expiredSkippedCount++;
          continue;
        }

        // Strict Phase 08 Rule: Never automatically approve or verify imported jobs
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
          verificationNotes: 'Imported via automated sync — awaiting administrator verification.',
          isActive: true,
          isApproved: false,
          featured: false,
          responsibilities: candidate.responsibilities,
          requirements: candidate.requirements,
          sector: candidate.sector,
        });

        existingJobs.push(created);
        report.newImportedCount++;
        srcImported++;
      }

      report.sourceDetails.push({
        sourceId: batch.sourceId,
        sourceName: batch.sourceName,
        status: 'success',
        fetchedCount: batch.rawCandidates.length,
        importedCount: srcImported,
        updatedCount: srcUpdated,
        duplicatesSkippedCount: srcDupes,
        rejectedCount: srcRejected,
        message: `Fetched ${batch.rawCandidates.length}, imported ${srcImported}, updated ${srcUpdated}, duplicates ${srcDupes}, rejected ${srcRejected}.`,
      });
    }

    // Always execute genuine deadline expiration check on existing database listings
    report.expiredMarkedCount = await storage.markExpiredListings();

    if (storage.saveLastReport) {
      await storage.saveLastReport(report);
    }

    const logStatus: 'Success' | 'Partial' | 'Error' =
      report.sourcesFailed > 0 && report.sourcesSuccessful === 0 && report.sourcesAttempted > 0
        ? 'Error'
        : report.sourcesFailed > 0
        ? 'Partial'
        : 'Success';

    const detailParts = [
      `Queried ${report.sourcesSuccessful}/${report.sourcesAttempted} configured feed(s)`,
      report.sourcesSkippedUnconfigured > 0
        ? `${report.sourcesSkippedUnconfigured} unconfigured feed(s) skipped`
        : '',
      `processed ${report.candidatesProcessed} candidate(s)`,
      `imported ${report.newImportedCount} (Pending Verification)`,
      `updated ${report.updatedCount}`,
      `skipped ${report.duplicatesSkippedCount} duplicate(s)`,
      report.invalidRejectedCount > 0 ? `rejected ${report.invalidRejectedCount} invalid URL(s)` : '',
      `marked ${report.expiredMarkedCount} expired`,
    ].filter(Boolean);

    await storage.recordSyncLog({
      sourceId: 'automated-opportunity-sync',
      sourceName:
        report.sourcesAttempted > 0
          ? `Authorized Opportunity Sync (${report.sourcesSuccessful}/${report.sourcesAttempted} feeds)`
          : 'Scheduled Expiry & Feed Configuration Check',
      status: logStatus,
      itemsFetched: report.candidatesProcessed,
      itemsAdded: report.newImportedCount,
      itemsUpdated: report.updatedCount,
      itemsExpired: report.expiredMarkedCount,
      details: `${detailParts.join('; ')}.`,
    });

    return report;
  } finally {
    if (storage.releaseSyncLock) {
      await storage.releaseSyncLock(ownerId);
    }
  }
}
