/**
 * BIO-INEXA Google Sheets Standardized Schema, Column Mapping Validator & Safe Client Adapter
 *
 * Security & Resilience Architecture (Phase 09):
 * - Zero Google API keys, spreadsheet IDs, or service-account credentials live in frontend code.
 * - Direct spreadsheet synchronization executes strictly on the server (Express or Netlify Functions)
 *   and saves newly imported opportunities into PostgreSQL / SQLite with 'Pending Verification'.
 * - On the client, `fetchOpportunities()` retrieves approved, eligible database records from
 *   the BIO-INEXA backend API so website availability never depends on Google Sheets uptime.
 */

import { Opportunity, OpportunityType, OpportunityStatus, WorkMode } from '../../types/opportunity';
import { matchBranchesForOpportunity } from '../../config/branches';
import { getDaysUntilDeadline } from './expiryManager';

export const SHEETS_CONFIG_STORAGE_KEY = 'bionexa_sheets_config_v2';
export const SHEETS_CACHED_OPPS_KEY = 'bionexa_sheets_cached_opps_v2';

export const STANDARD_SHEET_COLUMNS = [
  'ID',
  'Title',
  'Category',
  'Organization',
  'Description',
  'Eligibility',
  'Qualification',
  'Location',
  'Mode',
  'Salary/Stipend',
  'Fees',
  'Duration',
  'Published Date',
  'Application Deadline',
  'Application URL',
  'Registration URL',
  'Status',
  'Featured',
  'Last Updated',
] as const;

export interface GoogleSheetsConfig {
  scriptUrl: string;
  autoSyncIntervalMinutes: number;
  lastSyncTime: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'fallback' | 'error';
  lastErrorMessage?: string;
  totalSyncedCount: number;
}

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  scriptUrl: '',
  autoSyncIntervalMinutes: 360,
  lastSyncTime: null,
  lastSyncStatus: 'idle',
  totalSyncedCount: 0,
};

export interface RawSheetRow {
  [key: string]: any;
}

export interface SheetColumnValidationResult {
  valid: boolean;
  detectedHeaders: string[];
  matchedColumns: Record<string, string>;
  missingRequired: string[];
  warnings: string[];
}

function normalizeHeaderKey(header: string): string {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const COLUMN_ALIAS_MAP: Record<string, string[]> = {
  id: ['id', 'opportunityid'],
  title: ['title', 'jobtitle', 'opportunitytitle', 'workshoptitle', 'coursetitle', 'position'],
  category: ['category', 'type', 'sector'],
  organization: ['organization', 'company', 'employer', 'institution', 'provider'],
  description: ['description', 'details', 'overview', 'summary'],
  eligibility: ['eligibility', 'eligiblecandidates', 'targetaudience'],
  qualification: ['qualification', 'degrees', 'education'],
  location: ['location', 'city', 'venue'],
  mode: ['mode', 'workmode', 'deliverymode', 'employmenttype'],
  salaryOrStipend: ['salarystipend', 'salary', 'stipend', 'compensation'],
  fees: ['fees', 'registrationfee', 'coursefee'],
  duration: ['duration', 'timeline', 'period'],
  publishedDate: ['publisheddate', 'posteddate', 'publicationdate', 'date'],
  deadline: ['applicationdeadline', 'deadline', 'expirydate', 'lastdate', 'registrationdeadline'],
  applicationUrl: ['applicationurl', 'applylink', 'applyurl', 'url', 'link'],
  registrationUrl: ['registrationurl', 'registerlink', 'registerurl', 'enrollmenturl', 'enrollurl'],
  status: ['status'],
  featured: ['featured', 'isfeatured'],
  lastUpdated: ['lastupdated', 'updated'],
};

/**
 * Validates spreadsheet header names against the expected 19-column BIO-INEXA schema.
 * Accepts canonical column names as well as documented institutional aliases.
 */
export function validateSpreadsheetHeaders(headers: string[]): SheetColumnValidationResult {
  const cleanHeaders = (headers || []).map((h) => String(h || '').trim()).filter(Boolean);
  const normalizedToOriginal = new Map<string, string>();
  for (const h of cleanHeaders) {
    normalizedToOriginal.set(normalizeHeaderKey(h), h);
  }

  const matchedColumns: Record<string, string> = {};
  for (const [canonicalField, aliases] of Object.entries(COLUMN_ALIAS_MAP)) {
    for (const alias of aliases) {
      const original = normalizedToOriginal.get(alias);
      if (original) {
        matchedColumns[canonicalField] = original;
        break;
      }
    }
  }

  const missingRequired: string[] = [];
  if (!matchedColumns.title) {
    missingRequired.push('Title');
  }
  if (!matchedColumns.organization) {
    missingRequired.push('Organization (or Company/Employer)');
  }
  if (!matchedColumns.applicationUrl && !matchedColumns.registrationUrl) {
    missingRequired.push('Application URL (or Registration URL)');
  }

  const warnings: string[] = [];
  if (!matchedColumns.category) warnings.push('Category column absent; will infer from title and description.');
  if (!matchedColumns.deadline) warnings.push('Application Deadline column absent; listings will default to open.');
  if (!matchedColumns.location) warnings.push('Location column absent; will default to All India.');

  return {
    valid: missingRequired.length === 0,
    detectedHeaders: cleanHeaders,
    matchedColumns,
    missingRequired,
    warnings,
  };
}

/**
 * Converts a 2D Google Sheets API v4 `values` matrix (header row + data rows)
 * into keyed row objects while skipping completely blank rows.
 */
export function parseSheetValuesToRows(values: unknown[][]): {
  headers: string[];
  rows: RawSheetRow[];
} {
  if (!Array.isArray(values) || values.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaderRow = Array.isArray(values[0]) ? values[0] : [];
  const headers = rawHeaderRow.map((cell) => String(cell ?? '').trim());
  const rows: RawSheetRow[] = [];

  for (let i = 1; i < values.length; i++) {
    const rowCells = Array.isArray(values[i]) ? values[i] : [];
    const rowObj: RawSheetRow = {};
    let hasAnyValue = false;

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const cellVal = rowCells[c] !== undefined && rowCells[c] !== null ? String(rowCells[c]).trim() : '';
      if (cellVal) hasAnyValue = true;
      rowObj[key] = cellVal;
    }

    if (hasAnyValue) {
      rows.push(rowObj);
    }
  }

  return { headers, rows };
}

/**
 * Parses a standard RFC-4180 CSV payload into headers + keyed row objects.
 */
export function parseCsvToSheetMatrix(csvText: string): unknown[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const text = (csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  currentRow.push(currentField);
  if (currentRow.some((cell) => cell.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

export class GoogleSheetsSyncService {
  private config: GoogleSheetsConfig = { ...DEFAULT_SHEETS_CONFIG };
  private listeners: ((config: GoogleSheetsConfig) => void)[] = [];

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(SHEETS_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = {
          ...DEFAULT_SHEETS_CONFIG,
          ...parsed,
          // Never retain legacy external script URLs or secrets from older storage keys
          scriptUrl: '',
        };
      }
    } catch {
      this.config = { ...DEFAULT_SHEETS_CONFIG };
    }
  }

  public saveConfig(patch: Partial<GoogleSheetsConfig>): GoogleSheetsConfig {
    this.config = { ...this.config, ...patch };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SHEETS_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      } catch (err) {
        console.error('Failed to save Google Sheets status:', err);
      }
    }
    this.notify();
    return this.config;
  }

  public updateConfig(patch: Partial<GoogleSheetsConfig>): GoogleSheetsConfig {
    return this.saveConfig(patch);
  }

  public getConfig(): GoogleSheetsConfig {
    return { ...this.config };
  }

  public subscribe(listener: (config: GoogleSheetsConfig) => void): () => void {
    this.listeners.push(listener);
    listener(this.getConfig());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const current = this.getConfig();
    for (const l of this.listeners) {
      try {
        l(current);
      } catch (e) {
        console.error('Error notifying config listener:', e);
      }
    }
  }

  /**
   * Automatically categorize opportunity from Category, Title & Description
   */
  public determineOpportunityType(
    categoryRaw: string = '',
    title: string = '',
    desc: string = ''
  ): OpportunityType {
    const text = `${categoryRaw} ${title} ${desc}`.toLowerCase();

    if (
      text.includes('course') ||
      text.includes('masterclass') ||
      text.includes('certification') ||
      text.includes('diploma') ||
      text.includes('academy') ||
      text.includes('curriculum') ||
      text.includes('modules')
    ) {
      return 'course';
    }

    if (
      text.includes('workshop') ||
      text.includes('webinar') ||
      text.includes('conference') ||
      text.includes('bootcamp') ||
      text.includes('hands-on training') ||
      text.includes('practical training') ||
      text.includes('seminar')
    ) {
      return 'workshop';
    }

    if (
      text.includes('intern') ||
      text.includes('trainee') ||
      text.includes('fellowship') ||
      text.includes('summer research') ||
      text.includes('summer training') ||
      text.includes('stipendiary')
    ) {
      return 'internship';
    }

    if (
      text.includes('biotech') ||
      text.includes('fermentation') ||
      text.includes('bioprocess') ||
      text.includes('molecular biology') ||
      text.includes('genomics') ||
      text.includes('crispr') ||
      text.includes('bioinformatics') ||
      text.includes('biochemistry') ||
      text.includes('microbiology') ||
      text.includes('vaccine') ||
      text.includes('cell culture') ||
      text.includes('ngs')
    ) {
      return 'biotech_job';
    }

    return 'job';
  }

  /**
   * Determine Opportunity Status accurately (Open, Closing Soon, Expired, Closed)
   */
  public calculateStatus(deadlineRaw: string = '', statusRaw: string = ''): OpportunityStatus {
    const rawLower = (statusRaw || '').toLowerCase().trim();
    if (rawLower === 'closed') return 'Closed';
    if (rawLower === 'expired') return 'Expired';

    const daysLeft = getDaysUntilDeadline(deadlineRaw);
    if (daysLeft === null) {
      return 'Open';
    }

    if (daysLeft < 0) {
      return 'Expired';
    }

    if (daysLeft <= 5) {
      return 'Closing Soon';
    }

    return 'Open';
  }

  /**
   * Parse Raw Row from Google Sheet into a full Opportunity (always unapproved / Pending Verification)
   */
  public parseRowToOpportunity(row: RawSheetRow, index: number): Opportunity | null {
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) {
          const val = String(row[k]).trim();
          if (val) return val;
        }
        const lowerK = normalizeHeaderKey(k);
        for (const actualKey of Object.keys(row)) {
          const actualLower = normalizeHeaderKey(actualKey);
          if (actualLower === lowerK && row[actualKey] !== undefined && row[actualKey] !== null) {
            const val = String(row[actualKey]).trim();
            if (val) return val;
          }
        }
      }
      return '';
    };

    const id = getVal('ID', 'id', 'Opportunity ID') || `gsheet-${Date.now()}-${index}`;
    const title = getVal(
      'Title',
      'title',
      'Job Title',
      'Opportunity Title',
      'Workshop Title',
      'Course Title',
      'Position'
    );
    if (!title) return null;

    const categoryRaw = getVal('Category', 'category', 'Type', 'Sector');
    const organization = getVal('Organization', 'organization', 'Company', 'Employer', 'Institution', 'Provider');
    if (!organization) return null;

    const description =
      getVal('Description', 'description', 'Details', 'Overview', 'Summary') ||
      `${title} at ${organization}. Review full criteria on official institutional portal.`;
    const eligibility =
      getVal('Eligibility', 'eligibility', 'Eligible Candidates', 'Target Audience') ||
      'Relevant Life Science Degree';
    const qualification = getVal('Qualification', 'qualification', 'Degrees', 'Education') || eligibility;
    const location = getVal('Location', 'location', 'City', 'Venue') || 'All India';
    const modeRaw = getVal('Mode', 'mode', 'Work Mode', 'Delivery Mode', 'Employment Type') || 'On-site';
    const salaryOrStipend =
      getVal('Salary/Stipend', 'salaryOrStipend', 'Salary', 'Stipend', 'Compensation') || 'Not Disclosed';
    const fees = getVal('Fees', 'fees', 'Registration Fee', 'Course Fee') || 'Free';
    const duration = getVal('Duration', 'duration', 'Timeline', 'Period') || 'Full-time';
    const publishedDate =
      getVal('Published Date', 'publishedDate', 'Posted Date', 'Publication Date', 'Date') ||
      new Date().toISOString().split('T')[0];
    const deadlineRaw =
      getVal(
        'Application Deadline',
        'applicationDeadline',
        'Deadline',
        'Expiry Date',
        'Last Date',
        'Registration Deadline'
      ) || 'Not Specified';

    const applicationUrlRaw = getVal('Application URL', 'applicationUrl', 'Apply Link', 'Apply URL', 'URL', 'Link');
    const registrationUrlRaw = getVal(
      'Registration URL',
      'registrationUrl',
      'Register Link',
      'Register URL',
      'Enrollment URL',
      'Enroll URL'
    );
    const directUrl = applicationUrlRaw || registrationUrlRaw || '';

    const statusRaw = getVal('Status', 'status') || 'Open';
    const featuredRaw = getVal('Featured', 'featured', 'Is Featured');
    const isFeatured =
      featuredRaw.toLowerCase() === 'true' || featuredRaw.toLowerCase() === 'yes' || featuredRaw === '1';
    const lastUpdated = getVal('Last Updated', 'lastUpdated', 'Updated') || new Date().toISOString();

    const type = this.determineOpportunityType(categoryRaw, title, description);
    const status = this.calculateStatus(deadlineRaw, statusRaw);

    let workMode: WorkMode = 'On-site';
    const modeLower = modeRaw.toLowerCase();
    if (modeLower.includes('remote') || modeLower.includes('online') || modeLower.includes('wfh')) {
      workMode = 'Remote';
    } else if (modeLower.includes('hybrid')) {
      workMode = 'Hybrid';
    }

    const branches = matchBranchesForOpportunity(title, description, [qualification, eligibility]);

    let sector = 'Private';
    const orgLower = organization.toLowerCase();
    if (
      orgLower.includes('csir') ||
      orgLower.includes('dbt') ||
      orgLower.includes('icmr') ||
      orgLower.includes('iisc') ||
      orgLower.includes('aiims') ||
      orgLower.includes('icar') ||
      orgLower.includes('dst') ||
      orgLower.includes('fssai') ||
      orgLower.includes('government') ||
      orgLower.includes('national') ||
      orgLower.includes('state')
    ) {
      sector = 'Government';
    }

    const opp: Opportunity = {
      id,
      title,
      category:
        categoryRaw ||
        (type === 'biotech_job'
          ? 'Biotechnology'
          : type === 'internship'
          ? 'Internship'
          : type === 'workshop'
          ? 'Workshop'
          : type === 'course'
          ? 'Course'
          : 'Jobs'),
      organization,
      description,
      type,
      branches,
      eligibility,
      qualification,
      qualifications: [qualification],
      location,
      workMode,
      mode: modeRaw,
      salaryOrStipend,
      fees,
      duration,
      deadline: deadlineRaw,
      applicationDeadline: deadlineRaw,
      postedDate: publishedDate,
      publishedDate,
      applicationUrl: directUrl,
      registrationUrl: registrationUrlRaw || directUrl,
      status,
      featured: isFeatured,
      lastUpdated,
      isApproved: false,
      isVerified: false,
      verificationStatus: 'Pending Verification',
      isExternal: true,
      sector,
      sourceName: 'Google Sheets Institutional Feed',
      sourceUrl: '',
      attributionRequirements: 'Imported via server-side Google Sheets sync — Pending administrator verification',
    };

    if (type === 'workshop') {
      opp.workshopDetails = {
        dates: duration || 'Upcoming',
        duration: duration || 'Interactive Hands-on',
        mode: workMode === 'Remote' ? 'Online' : workMode === 'Hybrid' ? 'Hybrid' : 'Offline',
        fees: fees || 'Free',
        registrationFee: fees || 'Free',
        certificateAvailable: true,
        certificateProvided: true,
        registrationUrl: directUrl,
      };
    }

    if (type === 'course') {
      opp.courseDetails = {
        provider: organization,
        duration: duration || 'Self-paced',
        fees: fees || 'Free',
        certificateAvailable: true,
        enrollmentUrl: directUrl,
      };
    }

    return opp;
  }

  /**
   * Public frontend read path: fetches approved, eligible records strictly from the
   * BIO-INEXA backend database API (/api/opportunities). Never calls Google Sheets APIs
   * or reads Google credentials from the browser.
   */
  public async fetchOpportunities(): Promise<{
    success: boolean;
    opportunities: Opportunity[];
    isFallback: boolean;
    message: string;
  }> {
    this.saveConfig({ lastSyncStatus: 'syncing' });

    try {
      const response = await fetch('/api/opportunities?limit=100', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Backend catalog returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const opportunities = Array.isArray(data?.opportunities) ? (data.opportunities as Opportunity[]) : [];

      this.saveConfig({
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'success',
        totalSyncedCount: opportunities.length,
        lastErrorMessage: undefined,
      });

      return {
        success: true,
        opportunities,
        isFallback: false,
        message: `Retrieved ${opportunities.length} approved opportunities from database.`,
      };
    } catch (err: any) {
      this.saveConfig({
        lastSyncStatus: 'fallback',
        lastErrorMessage: err?.message || 'Database backend temporarily unreachable',
      });

      return {
        success: false,
        opportunities: [],
        isFallback: true,
        message: err?.message || 'Using locally retained database snapshot.',
      };
    }
  }

  /**
   * Ready-to-copy Google Apps Script Web App v2 code for optional server-side Sheet integration.
   */
  public getAppsScriptCode(): string {
    return `// ==============================================================
// BIO-INEXA GOOGLE APPS SCRIPT WEB APP (v2)
// Handles Visitor Counter & Standardized Server-Side Opportunities JSON Feed
// ==============================================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";

  // -------------------------------------------------------------
  // 1. GET OPPORTUNITIES (Jobs, Internships, Workshops, Courses)
  // -------------------------------------------------------------
  if (action === "getOpportunities" || action === "opportunities") {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName("Opportunities") || ss.getSheets()[0];
      var data = sheet.getDataRange().getValues();

      if (!data || data.length <= 1) {
        return createJsonResponse({ status: "success", count: 0, headers: [], data: [] });
      }

      var headers = data[0];
      var rows = [];

      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        if (row["Title"] || row["title"]) {
          rows.push(row);
        }
      }

      return createJsonResponse({
        status: "success",
        count: rows.length,
        headers: headers,
        timestamp: new Date().toISOString(),
        data: rows
      });
    } catch (err) {
      return createJsonResponse({ status: "error", message: err.toString() });
    }
  }

  // -------------------------------------------------------------
  // 2. VISITOR TRACKING (Default for ENTER Button)
  // -------------------------------------------------------------
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var trackerSheet = ss.getSheetByName("Visitor_Log");

    if (!trackerSheet) {
      trackerSheet = ss.insertSheet("Visitor_Log");
      trackerSheet.appendRow(["Entry No.", "Date", "Time", "Timestamp"]);
    }

    var now = new Date();
    var rowCount = Math.max(1, trackerSheet.getLastRow());
    trackerSheet.appendRow([rowCount, now.toLocaleDateString(), now.toLocaleTimeString(), now.toISOString()]);

    return ContentService.createTextOutput("OK - Visitor Logged")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;
  }
}

export const googleSheetsSync = new GoogleSheetsSyncService();
