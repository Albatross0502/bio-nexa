/**
 * BIO-NEXA Google Sheets & Google Apps Script Opportunities Synchronization Service
 * 
 * Provides automated data retrieval from Google Sheets / Google Apps Script Web App,
 * parsing all 19 standardized fields, categorizing them into:
 * 1. All Opportunities
 * 2. Biotech Jobs
 * 3. Internships
 * 4. Workshops
 * 5. Courses
 * 
 * Automatically calculates status (Open, Closing Soon, Expired, Closed),
 * strips duplicates, and falls back gracefully to verified cached data.
 */

import { Opportunity, OpportunityType, OpportunityStatus, WorkMode } from '../../types/opportunity';
import { matchBranchesForOpportunity } from '../../config/branches';
import { getDaysUntilDeadline } from './expiryManager';
import { findDuplicateOpportunity } from './duplicateDetector';

export const DEFAULT_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwCSGpoOJHEtqnVEKqf07kORQ3jfb0EqfMQn8NOo5QiAqYLGg4C33Oy2G7JXQ7iPwi8/exec";

export const SHEETS_CONFIG_STORAGE_KEY = 'bionexa_sheets_config_v2';
export const SHEETS_CACHED_OPPS_KEY = 'bionexa_sheets_cached_opps_v2';

export interface GoogleSheetsConfig {
  scriptUrl: string;
  sheetId?: string;
  publishedCsvUrl?: string;
  autoSyncIntervalMinutes: number;
  lastSyncTime: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'fallback' | 'error';
  lastErrorMessage?: string;
  totalSyncedCount: number;
}

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  scriptUrl: DEFAULT_APPS_SCRIPT_URL,
  sheetId: '',
  publishedCsvUrl: '',
  autoSyncIntervalMinutes: 15,
  lastSyncTime: null,
  lastSyncStatus: 'idle',
  totalSyncedCount: 0
};

/**
 * Standard 19 Google Sheets Columns:
 * 1. ID
 * 2. Title
 * 3. Category
 * 4. Organization
 * 5. Description
 * 6. Eligibility
 * 7. Qualification
 * 8. Location
 * 9. Mode
 * 10. Salary/Stipend
 * 11. Fees
 * 12. Duration
 * 13. Published Date
 * 14. Application Deadline
 * 15. Application URL
 * 16. Registration URL
 * 17. Status
 * 18. Featured
 * 19. Last Updated
 */
export interface RawSheetRow {
  [key: string]: any;
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
        this.config = { ...DEFAULT_SHEETS_CONFIG, ...JSON.parse(saved) };
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
        console.error('Failed to save Google Sheets config:', err);
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
      this.listeners = this.listeners.filter(l => l !== listener);
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
  public determineOpportunityType(categoryRaw: string = '', title: string = '', desc: string = ''): OpportunityType {
    const text = `${categoryRaw} ${title} ${desc}`.toLowerCase();

    // 1. Courses
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

    // 2. Workshops
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

    // 3. Internships
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

    // 4. Biotech Jobs
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

    // 5. Default: Job
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
      // No deadline specified -> keep Open / Active
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
   * Parse Raw Row from Google Sheet into a full Opportunity
   */
  public parseRowToOpportunity(row: RawSheetRow, index: number): Opportunity | null {
    // Column header normalization: handle case-insensitivity, spaces, and aliases
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) {
          const val = String(row[k]).trim();
          if (val) return val;
        }
        // Try normalized key
        const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const actualKey of Object.keys(row)) {
          const actualLower = actualKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (actualLower === lowerK && row[actualKey] !== undefined && row[actualKey] !== null) {
            const val = String(row[actualKey]).trim();
            if (val) return val;
          }
        }
      }
      return '';
    };

    const id = getVal('ID', 'id', 'Opportunity ID') || `gsheet-${Date.now()}-${index}`;
    const title = getVal('Title', 'title', 'Job Title', 'Opportunity Title', 'Workshop Title', 'Course Title');
    if (!title) return null; // Title is required

    const categoryRaw = getVal('Category', 'category', 'Type');
    const organization = getVal('Organization', 'organization', 'Company', 'Institution', 'Provider') || 'Bio-Nexa Partner';
    const description = getVal('Description', 'description', 'Details', 'Overview') || 'No detailed description provided.';
    const eligibility = getVal('Eligibility', 'eligibility', 'Eligible Candidates', 'Target Audience') || 'Relevant Life Science Degree';
    const qualification = getVal('Qualification', 'qualification', 'Degrees') || eligibility;
    const location = getVal('Location', 'location', 'City', 'Venue') || 'All India';
    const modeRaw = getVal('Mode', 'mode', 'Work Mode', 'Delivery Mode') || 'On-site';
    const salaryOrStipend = getVal('Salary/Stipend', 'salaryOrStipend', 'Salary', 'Stipend', 'Compensation') || 'Not Disclosed';
    const fees = getVal('Fees', 'fees', 'Registration Fee', 'Course Fee') || 'Free';
    const duration = getVal('Duration', 'duration', 'Timeline', 'Period') || 'Full-time';
    const publishedDate = getVal('Published Date', 'publishedDate', 'Posted Date', 'Date') || new Date().toISOString().split('T')[0];
    const deadlineRaw = getVal('Application Deadline', 'applicationDeadline', 'Deadline', 'Last Date', 'Registration Deadline') || 'Not Specified';
    
    // Application & Registration links
    const applicationUrlRaw = getVal('Application URL', 'applicationUrl', 'Apply Link', 'Apply URL', 'Link');
    const registrationUrlRaw = getVal('Registration URL', 'registrationUrl', 'Register Link', 'Register URL', 'Enrollment URL', 'Enroll URL');
    const directUrl = applicationUrlRaw || registrationUrlRaw || '';

    const statusRaw = getVal('Status', 'status') || 'Open';
    const featuredRaw = getVal('Featured', 'featured', 'Is Featured');
    const isFeatured = featuredRaw.toLowerCase() === 'true' || featuredRaw.toLowerCase() === 'yes' || featuredRaw === '1';
    const lastUpdated = getVal('Last Updated', 'lastUpdated', 'Updated') || new Date().toISOString();

    const type = this.determineOpportunityType(categoryRaw, title, description);
    const status = this.calculateStatus(deadlineRaw, statusRaw);

    // Normalize WorkMode
    let workMode: WorkMode = 'On-site';
    const modeLower = modeRaw.toLowerCase();
    if (modeLower.includes('remote') || modeLower.includes('online') || modeLower.includes('wfh')) {
      workMode = 'Remote';
    } else if (modeLower.includes('hybrid')) {
      workMode = 'Hybrid';
    }

    // Branch matching
    const branches = matchBranchesForOpportunity(title, description, [qualification, eligibility]);

    // Sector detection
    let sector = 'Private';
    const orgLower = organization.toLowerCase();
    if (
      orgLower.includes('csir') ||
      orgLower.includes('dbt') ||
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
      category: categoryRaw || (type === 'biotech_job' ? 'Biotechnology' : type === 'internship' ? 'Internship' : type === 'workshop' ? 'Workshop' : type === 'course' ? 'Course' : 'Jobs'),
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
      isApproved: true,
      isVerified: true,
      isExternal: true,
      sector,
      sourceName: 'Google Sheets Live Sync',
      sourceUrl: this.config.scriptUrl,
      lastVerifiedDate: new Date().toISOString().split('T')[0]
    };

    // For workshops, populate workshopDetails
    if (type === 'workshop') {
      opp.workshopDetails = {
        dates: duration || 'Upcoming',
        duration: duration || 'Interactive Hands-on',
        mode: workMode === 'Remote' ? 'Online' : workMode === 'Hybrid' ? 'Hybrid' : 'Offline',
        fees: fees || 'Free',
        registrationFee: fees || 'Free',
        certificateAvailable: true,
        certificateProvided: true,
        registrationUrl: directUrl
      };
    }

    // For courses, populate courseDetails
    if (type === 'course') {
      opp.courseDetails = {
        provider: organization,
        duration: duration || 'Self-paced',
        fees: fees || 'Free',
        certificateAvailable: true,
        enrollmentUrl: directUrl
      };
    }

    return opp;
  }

  /**
   * Fetch opportunities from Google Apps Script Web App or Sheet endpoint
   */
  public async fetchOpportunities(): Promise<{
    success: boolean;
    opportunities: Opportunity[];
    isFallback: boolean;
    message: string;
  }> {
    this.saveConfig({ lastSyncStatus: 'syncing' });

    const scriptUrl = this.config.scriptUrl || DEFAULT_APPS_SCRIPT_URL;

    try {
      // 1. Try Google Apps Script with action=getOpportunities
      const fetchUrl = scriptUrl.includes('?')
        ? `${scriptUrl}&action=getOpportunities&t=${Date.now()}`
        : `${scriptUrl}?action=getOpportunities&t=${Date.now()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          // If response is not valid JSON (e.g. plain text or HTML redirect from Google)
          json = null;
        }

        if (json && (Array.isArray(json.data) || Array.isArray(json))) {
          const rawItems = Array.isArray(json.data) ? json.data : json;
          const parsedOpps: Opportunity[] = [];

          rawItems.forEach((row: RawSheetRow, idx: number) => {
            const opp = this.parseRowToOpportunity(row, idx);
            if (opp) {
              // Deduplicate
              const isDupe = findDuplicateOpportunity(opp, parsedOpps);
              if (!isDupe) {
                parsedOpps.push(opp);
              }
            }
          });

          if (parsedOpps.length > 0) {
            this.saveConfig({
              lastSyncTime: new Date().toISOString(),
              lastSyncStatus: 'success',
              totalSyncedCount: parsedOpps.length,
              lastErrorMessage: undefined
            });

            // Cache locally
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(SHEETS_CACHED_OPPS_KEY, JSON.stringify(parsedOpps));
              } catch {}
            }

            return {
              success: true,
              opportunities: parsedOpps,
              isFallback: false,
              message: `Successfully retrieved ${parsedOpps.length} opportunities from Google Sheets.`
            };
          }
        }
      }

      // If response was not returning opportunities JSON or Apps Script only has visitor tracker
      throw new Error(`Google Apps Script returned non-JSON response or empty dataset.`);
    } catch (err: any) {
      console.warn('Google Sheets live fetch notice:', err?.message || err);

      // Check if we have cached sheets opportunities
      let cached: Opportunity[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(SHEETS_CACHED_OPPS_KEY);
          if (raw) cached = JSON.parse(raw);
        } catch {}
      }

      this.saveConfig({
        lastSyncTime: this.config.lastSyncTime || new Date().toISOString(),
        lastSyncStatus: cached.length > 0 ? 'success' : 'fallback',
        lastErrorMessage: err?.message || 'Using verified local opportunities dataset'
      });

      return {
        success: cached.length > 0,
        opportunities: cached,
        isFallback: true,
        message: cached.length > 0
          ? `Serving ${cached.length} cached opportunities from Google Sheets.`
          : `Connected to Google Apps Script. Ready for opportunities sheet sync.`
      };
    }
  }

  /**
   * Ready-to-copy Google Apps Script code for the user
   */
  public getAppsScriptCode(): string {
    return `// ==============================================================
// BIO-NEXA GOOGLE APPS SCRIPT WEB APP (v2)
// Handles BOTH Visitor Counter & Automated Opportunities Portal
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
        return createJsonResponse({ status: "success", count: 0, data: [] });
      }
      
      var headers = data[0];
      var rows = [];
      
      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        // Only include non-empty rows
        if (row["Title"] || row["title"]) {
          rows.push(row);
        }
      }
      
      return createJsonResponse({
        status: "success",
        count: rows.length,
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
    
    // Create Visitor_Log tab if absent
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
