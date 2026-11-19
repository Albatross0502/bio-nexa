/**
 * BIO-NEXA Phase 10 — Indian Legal Compliance, Privacy Governance & Operational Transparency
 *
 * Strictly grounded in BIO-NEXA's actual technical architecture and Indian statutory frameworks:
 * - Digital Personal Data Protection Act, 2023 (DPDP Act) & Rules framed thereunder
 * - Information Technology Act, 2000 & IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
 * - Trade Marks Act, 1999 & Copyright Act, 1957 (India)
 *
 * IMPORTANT: No corporate registration numbers (CIN), GSTINs, physical street addresses, or
 * statutory certifications are invented here. Items marked `requiresLegalReview: true` MUST be
 * completed and verified by a qualified Indian legal professional prior to public deployment.
 */

export type PolicySectionId =
  | 'privacy'
  | 'terms'
  | 'job-disclaimer'
  | 'external-links'
  | 'cookies'
  | 'grievance'
  | 'report-job'
  | 'content-removal';

export interface PolicyNavItem {
  id: PolicySectionId;
  code: string;
  title: string;
  shortTitle: string;
  route: string;
  summary: string;
}

export const POLICY_SECTIONS: PolicyNavItem[] = [
  {
    id: 'privacy',
    code: 'A',
    title: 'Privacy Policy (DPDP Act, 2023)',
    shortTitle: 'Privacy Policy',
    route: '/privacy',
    summary: 'Personal data inventory, purposes, browser vs server SQLite storage, third-party services, and DPDP Data Principal rights.'
  },
  {
    id: 'terms',
    code: 'B',
    title: 'Terms and Conditions',
    shortTitle: 'Terms & Conditions',
    route: '/terms',
    summary: 'Platform role as an informational aggregator & publisher, acceptable use, intellectual property, and Indian governing law.'
  },
  {
    id: 'job-disclaimer',
    code: 'C',
    title: 'Job Listing Disclaimer',
    shortTitle: 'Job Disclaimer',
    route: '/job-disclaimer',
    summary: 'Verification scope, third-party sourcing, no employment guarantee, and zero-fee anti-fraud notice.'
  },
  {
    id: 'external-links',
    code: 'D',
    title: 'External Links Disclaimer',
    shortTitle: 'External Links',
    route: '/external-links',
    summary: 'Redirection to official employer, university, course, and workshop portals; third-party payment independence.'
  },
  {
    id: 'cookies',
    code: 'E',
    title: 'Cookie and Tracking Notice',
    shortTitle: 'Cookies & Tracking',
    route: '/cookies',
    summary: 'Exact cookie, localStorage, sessionStorage, and Google Apps Script session telemetry disclosures with opt-out controls.'
  },
  {
    id: 'grievance',
    code: 'F',
    title: 'Contact and Grievance Information',
    shortTitle: 'Grievance & Contact',
    route: '/grievance',
    summary: 'Data Fiduciary / Grievance Officer submission channel, statutory response timelines, and legal counsel placeholders.'
  },
  {
    id: 'report-job',
    code: 'G',
    title: 'Job Reporting Policy',
    shortTitle: 'Report a Listing',
    route: '/report-job',
    summary: 'How candidates report fake jobs, application-fee demands, broken URLs, or expired vacancies.'
  },
  {
    id: 'content-removal',
    code: 'H',
    title: 'Content Removal and Correction Policy',
    shortTitle: 'Removal & Correction',
    route: '/content-removal',
    summary: 'Takedown and correction process for employers, copyright/trademark holders, and institutions under IT Rules, 2021.'
  }
];

export interface OperationalAuditFact {
  question: string;
  finding: string;
  legalImplication: string;
  requiresLegalReview: boolean;
}

export const OPERATIONAL_FACT_SHEET: OperationalAuditFact[] = [
  {
    question: 'Who operates BIO-INEXA?',
    finding:
      'An independent educational and career-discovery web platform managed by the BIO-INEXA operator team (contactable at council@bio-inexa.org). No corporate entity registration (CIN/LLPIN), MSME number, or statutory educational accreditation is claimed in the codebase.',
    legalImplication:
      'Before commercial/public launch in India, the exact legal operator identity (sole proprietor, partnership, LLP, Section 8 non-profit, or private limited company) and verified Indian registered correspondence address must be inserted by Indian legal counsel.',
    requiresLegalReview: true
  },
  {
    question: 'What personal information is collected and why?',
    finding:
      'Public browsing requires no registration. Visitor preferences, saved bookmarks, demo profile fields, local quiz progress, contact notes, and newsletter email inputs are stored in the visitor’s own browser (localStorage / sessionStorage). Server-side storage occurs only for: (1) employer-submitted listings pending moderation, (2) candidate listing reports, (3) DPDP/grievance/removal requests, and (4) authenticated Staff/Admin login sessions.',
    legalImplication:
      'Under Section 5 & Section 6 of India’s DPDP Act, 2023, BIO-INEXA must provide a clear itemized notice before/at collection, gather explicit affirmative consent for non-essential telemetry or submissions, and avoid claiming server-side recruiter CV matchmaking where none exists.',
    requiresLegalReview: false
  },
  {
    question: 'Where is information stored?',
    finding:
      'Client preferences and demo dashboard records reside strictly on the user’s device via browser localStorage/sessionStorage. Submitted job moderation items, job reports, compliance/grievance requests, and curated opportunities reside in the server-side SQLite database (db/bionexa.db) with atomic server backups.',
    legalImplication:
      'Cross-border cloud hosting (e.g., Cloud Run / Netlify region) should be disclosed truthfully, and server retention/deletion timelines for compliance tickets and backups should be reviewed under DPDP Rules, 2025.',
    requiresLegalReview: true
  },
  {
    question: 'Which external services receive information?',
    finding:
      'Upon visitor confirmation/entry from the Welcome Screen (unless set to Essential Only), the browser sends a one-per-session GET request to a Google Apps Script Web App (script.google.com) for visit counting/sheet feed reads. Browser requests also load typography from Google Fonts (fonts.googleapis.com / fonts.gstatic.com), course banner stock imagery where used, embedded YouTube videos (/courses player), and external redirects when users click Apply/Register on third-party portals. Server-side feed sync optionally queries Adzuna India API (when API keys are set) and runs URL reachability checks.',
    legalImplication:
      'All third-party processors/external domains triggered automatically vs on outbound user click must be separated clearly in Privacy & Cookie Notices, with consent gating before non-essential Google Apps Script telemetry.',
    requiresLegalReview: false
  },
  {
    question: 'Are third-party job sources used?',
    finding:
      'Yes. Listings combine public government notifications (e.g., DBT India, CSIR institutes, FSSAI, AIIMS, ICAR), institutional collaborative Google Sheets, optional licensed Adzuna API feeds, direct employer submissions (held in Pending Verification until admin approval), and outbound search query builders (LinkedIn, Naukri, WorkIndia, Google Jobs).',
    legalImplication:
      'BIO-INEXA must attribute public/licensed sources accurately, respect third-party trademarks under the Trade Marks Act, 1999, avoid automated scraping of prohibited sites, never imply official employer affiliation unless explicitly authorized, and offer fast takedown under IT Rules, 2021.',
    requiresLegalReview: false
  },
  {
    question: 'Do workshops or courses involve payments?',
    finding:
      'BIO-INEXA does not process, collect, or intermediate payments, tuition fees, registration charges, or deposits. Where a third-party workshop or external course charges fees (e.g., provider cohort fees or SWAYAM exam fees), any payment is conducted exclusively on that external organization’s official website.',
    legalImplication:
      'Must clearly disclaim any payment liability on third-party websites and strictly warn candidates against fraudulent recruitment fees.',
    requiresLegalReview: false
  },
  {
    question: 'Is BIO-INEXA a publisher, aggregator, or recruitment intermediary?',
    finding:
      'BIO-INEXA operates strictly as an informational discovery aggregator and educational content publisher redirecting candidates to external official application portals. It is not a licensed staffing/placement agency, recruitment broker, university, or statutory accreditation authority.',
    legalImplication:
      'Terms and Job Listing Disclaimers must explicitly state intermediary/aggregator status under IT Act Section 79 & IT Rules 2021, disclaim hiring outcomes, and define "Verified Listing" accurately as source-URL inspection rather than background/credit vetting.',
    requiresLegalReview: true
  }
];

export interface CookieAndStorageItem {
  name: string;
  mechanism: 'HTTP Cookie' | 'localStorage' | 'sessionStorage' | 'Third-Party Network / Embed';
  category: 'Strictly Necessary' | 'Functional Preference' | 'Optional Telemetry / External Embed';
  purpose: string;
  retention: string;
  canOptOut: boolean;
}

export const COOKIE_AND_STORAGE_INVENTORY: CookieAndStorageItem[] = [
  {
    name: 'bionexa_admin_session',
    mechanism: 'HTTP Cookie',
    category: 'Strictly Necessary',
    purpose: 'HttpOnly session token authenticating Staff/Administrator logins on /admin only. Not set for public visitors.',
    retention: 'Up to 8 hours or until logout',
    canOptOut: false
  },
  {
    name: 'bionexa_privacy_consent_v1',
    mechanism: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Remembers your privacy choice ("Accept All" vs "Essential Only") so the banner does not repeatedly prompt you.',
    retention: 'Until cleared by user',
    canOptOut: false
  },
  {
    name: 'bionexa_welcome_entered',
    mechanism: 'sessionStorage',
    category: 'Functional Preference',
    purpose: 'Tracks whether you have entered past the Welcome Landing Screen during your current tab session.',
    retention: 'Current browser tab session',
    canOptOut: false
  },
  {
    name: 'bionexa_dark_mode, bionexa_saved_ids & local demo state',
    mechanism: 'localStorage',
    category: 'Functional Preference',
    purpose:
      'Stores UI theme mode, saved opportunity IDs, locally simulated dashboard notes, and browser-only Academy lesson progress on your own device.',
    retention: 'Until cleared in browser or via "Clear Local Browser Data"',
    canOptOut: true
  },
  {
    name: 'Google Apps Script Session Entry Ping (script.google.com)',
    mechanism: 'Third-Party Network / Embed',
    category: 'Optional Telemetry / External Embed',
    purpose:
      'Sends a lightweight one-per-session GET request when clicking ENTER on the Welcome Screen to record an aggregate visit counter (no account login or form payload is sent). Blocked when "Essential Only" is selected.',
    retention: 'Controlled under Google Workspace / Apps Script logs',
    canOptOut: true
  },
  {
    name: 'Google Fonts & YouTube Instructional Embeds',
    mechanism: 'Third-Party Network / Embed',
    category: 'Optional Telemetry / External Embed',
    purpose:
      'Loads Plus Jakarta Sans / JetBrains Mono web fonts globally and renders embedded YouTube protocol lessons inside /courses Academy.',
    retention: 'Governed by Google / YouTube Privacy Policies',
    canOptOut: true
  }
];

export interface LegalCounselChecklistItem {
  id: string;
  area: string;
  statusLabel: string;
  actionRequired: string;
}

export const LEGAL_COUNSEL_REVIEW_CHECKLIST: LegalCounselChecklistItem[] = [
  {
    id: 'lc-operator',
    area: 'Legal Entity & Registered Address (IT Rules, 2021 / DPDP Act Sec 5)',
    statusLabel: 'PLACEHOLDER — REQUIRES COMPLETION',
    actionRequired:
      'Insert verified legal name of the proprietor, trust, LLP, or company operating BIO-INEXA along with a verified physical Indian address for service of legal notices.'
  },
  {
    id: 'lc-grievance-officer',
    area: 'Grievance Officer & Data Protection Contact (IT Rules Rule 3(2) & DPDP Act Sec 13)',
    statusLabel: 'PLACEHOLDER — REQUIRES APPOINTMENT',
    actionRequired:
      'Appoint and publish the full name, designation, dedicated grievance email (e.g., grievance@...), and Indian contact details of the designated Grievance Officer.'
  },
  {
    id: 'lc-dpdp-rules',
    area: 'DPDP Rules Notification & Children’s Verifiable Consent (Sec 9)',
    statusLabel: 'COUNSEL REVIEW REQUIRED',
    actionRequired:
      'Confirm age-gating / parental consent wording under notified DPDP Rules if minors (students aged under 18, e.g., B.Sc 1st-year or Class 12 visitors) submit applications or grievances.'
  },
  {
    id: 'lc-api-licensing',
    area: 'Commercial / API Terms for Third-Party Job Feeds',
    statusLabel: 'COUNSEL & OPERATIONS AUDIT',
    actionRequired:
      'Verify active written API/commercial license terms for Adzuna, Google Sheets Apps Script quotas, Unsplash assets, and external government notification republication.'
  },
  {
    id: 'lc-jurisdiction',
    area: 'Dispute Resolution & Exclusive Court Jurisdiction',
    statusLabel: 'PLACEHOLDER — REQUIRES CITY/STATE',
    actionRequired:
      'Specify exact city and state courts in India having exclusive territorial jurisdiction matching the operator’s principal place of business.'
  }
];

export const PRIVACY_CONSENT_KEY = 'bionexa_privacy_consent_v1';

export interface PrivacyConsentState {
  version: string;
  essential: true;
  optionalTelemetry: boolean;
  externalEmbedsNoticeAcknowledged: boolean;
  updatedAt: string;
}

export function createConsentState(optionalTelemetry: boolean): PrivacyConsentState {
  return {
    version: '2026-11-dpdp-v1',
    essential: true,
    optionalTelemetry,
    externalEmbedsNoticeAcknowledged: true,
    updatedAt: new Date().toISOString()
  };
}

export function readPrivacyConsent(storage?: Pick<Storage, 'getItem'> | null): PrivacyConsentState | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return null;
    const raw = store.getItem(PRIVACY_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      version: typeof parsed.version === 'string' ? parsed.version : '2026-11-dpdp-v1',
      essential: true,
      optionalTelemetry: Boolean(parsed.optionalTelemetry),
      externalEmbedsNoticeAcknowledged: Boolean(parsed.externalEmbedsNoticeAcknowledged),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
    };
  } catch {
    return null;
  }
}

export function savePrivacyConsent(
  optionalTelemetry: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): PrivacyConsentState {
  const next = createConsentState(optionalTelemetry);
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (store) {
      store.setItem(PRIVACY_CONSENT_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota errors in restricted environments
  }
  return next;
}

/**
 * Determines whether optional session telemetry (Google Apps Script GET ping) may execute.
 * Opting out ("Essential Only", i.e. optionalTelemetry: false) strictly blocks the request.
 * Before an explicit preference is saved, defaults to true unless visitor has set Do-Not-Track (`navigator.doNotTrack === '1'`).
 */
export function canSendNonEssentialTelemetry(
  storage?: Pick<Storage, 'getItem'> | null,
  doNotTrack?: string | null
): boolean {
  const dnt = doNotTrack ?? (typeof navigator !== 'undefined' ? navigator.doNotTrack : null);
  if (dnt === '1' || dnt === 'yes') {
    const explicitConsent = readPrivacyConsent(storage);
    return explicitConsent ? explicitConsent.optionalTelemetry : false;
  }
  const consent = readPrivacyConsent(storage);
  if (!consent) return true;
  return consent.optionalTelemetry;
}

export const BIONEXA_LOCAL_STORAGE_KEYS = [
  'bionexa_user',
  'bionexa_saved_ids',
  'bionexa_jobs',
  'bionexa_internships',
  'bionexa_courses',
  'bionexa_applications',
  'bionexa_enrolled_courses',
  'bionexa_completed_lessons',
  'bionexa_certificates',
  'bionexa_discussions',
  'bionexa_sync_logs',
  'bionexa_reports',
  'bionexa_contact_msgs',
  'bionexa_newsletter',
  'bionexa_opportunities_store_v1',
  'bionexa_sync_logs_v1',
  'bionexa_sheets_config_v1',
  'bionexa_sheets_cached_opportunities_v1',
  PRIVACY_CONSENT_KEY
];

export function clearBioNexaLocalData(
  localStore?: Pick<Storage, 'removeItem'> | null,
  sessionStore?: Pick<Storage, 'removeItem'> | null
): number {
  let cleared = 0;
  const ls = localStore ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const ss = sessionStore ?? (typeof window !== 'undefined' ? window.sessionStorage : null);

  if (ls) {
    for (const key of BIONEXA_LOCAL_STORAGE_KEYS) {
      try {
        ls.removeItem(key);
        cleared++;
      } catch {
        // Ignore
      }
    }
  }
  if (ss) {
    for (const sKey of ['bionexa_welcome_entered']) {
      try {
        ss.removeItem(sKey);
        cleared++;
      } catch {
        // Ignore
      }
    }
  }
  return cleared;
}

export type ComplianceRequestType =
  | 'privacy_request'
  | 'grievance'
  | 'job_report'
  | 'content_removal';

export interface ComplianceRequestInput {
  requestType: ComplianceRequestType;
  subCategory: string;
  requesterName: string;
  requesterEmail: string;
  organization?: string;
  targetTitleOrUrl?: string;
  details: string;
  consentAccepted: boolean;
}

export interface ComplianceValidationResult {
  valid: boolean;
  error?: string;
}

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeComplianceRequestType(raw?: string): ComplianceRequestType {
  const clean = (raw || '').trim().toLowerCase();
  if (clean === 'privacy_request' || clean === 'privacy') return 'privacy_request';
  if (clean === 'job_report' || clean === 'report') return 'job_report';
  if (clean === 'content_removal' || clean === 'removal' || clean === 'correction') return 'content_removal';
  return 'grievance';
}

export function validateComplianceRequest(input: ComplianceRequestInput): ComplianceValidationResult {
  if (!input.requesterName || input.requesterName.trim().length < 2) {
    return { valid: false, error: 'Please enter your full name (at least 2 characters).' };
  }
  if (!input.requesterEmail || !SIMPLE_EMAIL_REGEX.test(input.requesterEmail.trim())) {
    return { valid: false, error: 'Please enter a valid email address so we can respond.' };
  }
  if (!input.subCategory || !input.subCategory.trim()) {
    return { valid: false, error: 'Please select a request category.' };
  }
  if (!input.details || input.details.trim().length < 15) {
    return {
      valid: false,
      error: 'Please provide specific details (at least 15 characters) to help us review and act.'
    };
  }
  if (
    (input.requestType === 'job_report' || input.requestType === 'content_removal') &&
    (!input.targetTitleOrUrl || input.targetTitleOrUrl.trim().length < 4)
  ) {
    return {
      valid: false,
      error: 'Please specify the affected listing title, page route, or URL.'
    };
  }
  if (!input.consentAccepted) {
    return {
      valid: false,
      error: 'Please confirm your consent to process this request for compliance resolution.'
    };
  }
  return { valid: true };
}

export function createComplianceReferenceId(nowMs: number = Date.now(), randomHex?: string): string {
  const suffix = (randomHex || Math.random().toString(16).slice(2, 8)).toUpperCase().slice(0, 6);
  const stamp = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '');
  return `BN-COMP-${stamp}-${suffix}`;
}
