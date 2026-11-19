/**
 * BIO-INEXA Internship Portal Domain Helpers (Phase 11)
 *
 * Pure, decoupled helpers for:
 * - Paid vs Unpaid compensation classification
 * - Work mode normalization (On-site Lab, Hybrid, Remote / Dry Lab)
 * - Application URL strict validation & destination domain extraction
 * - Deadline parsing & expired internship detection
 * - Multi-facet filtering (search, category, location, paid/unpaid, mode, expiry)
 * - Submission payload validation (strictly enforcing Pending Verification)
 */

import type { Internship } from '../../types';

export type InternshipCompensationFilter = 'all' | 'paid' | 'unpaid';
export type InternshipModeFilter = 'all' | 'On-site Lab' | 'Hybrid' | 'Remote / Dry Lab';

export interface InternshipUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  domain?: string;
  reason?: string;
}

export interface InternshipFilterCriteria {
  search?: string;
  category?: string;
  location?: string;
  compensation?: InternshipCompensationFilter | string;
  mode?: InternshipModeFilter | string;
  includeExpired?: boolean;
}

export interface InternshipSubmissionInput {
  title: string;
  organization: string;
  location: string;
  mode?: string;
  workMode?: string;
  stipend: string;
  duration: string;
  deadline?: string;
  category: string;
  eligibility: string;
  description: string;
  applicationUrl: string;
  sourceName?: string;
  sourceUrl?: string;
  skillsRequired?: string[];
  learningOutcomes?: string[];
  submitterEmail?: string;
}

export const INTERNSHIP_CATEGORIES = [
  'Summer Fellowship',
  'Industrial R&D',
  'Academic Dissertation',
  'Clinical Research'
] as const;

export const INTERNSHIP_MODES = [
  'On-site Lab',
  'Hybrid',
  'Remote / Dry Lab'
] as const;

const BLOCKED_PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'example.net',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'test.com',
  'invalid'
]);

/**
 * Classifies an internship stipend label as 'paid' or 'unpaid'.
 */
export function classifyInternshipCompensation(stipend?: string): 'paid' | 'unpaid' {
  const raw = String(stipend || '').trim().toLowerCase();
  if (!raw) return 'unpaid';

  // Explicit unpaid markers
  if (
    /\bunpaid\b/.test(raw) ||
    /\bno stipend\b/.test(raw) ||
    /\bwithout stipend\b/.test(raw) ||
    /\bzero stipend\b/.test(raw) ||
    /\bself[- ]?funded\b/.test(raw) ||
    /\bvolunteer\b/.test(raw) ||
    /\bfee[- ]?based\b/.test(raw) ||
    /\btraining fee\b/.test(raw) ||
    /^(?:₹|rs\.?|inr|\$)?\s*0+(?:\.0+)?(?:\s*\/\s*\w+)?$/.test(raw)
  ) {
    return 'unpaid';
  }

  // Explicit paid markers (currency figures > 0 or funded/fellowship stipends)
  if (
    /(?:₹|rs\.?|inr|\$|€|£)\s*[1-9]/.test(raw) ||
    /\b[1-9][0-9,]{2,}\b/.test(raw) ||
    /\bpaid\b/.test(raw) ||
    /\bcompetitive stipend\b/.test(raw) ||
    /\bstipend\b/.test(raw) ||
    /\bfunded\b/.test(raw) ||
    /\bfellowship\b/.test(raw) ||
    /\bcontingency\b/.test(raw) ||
    /\bhonorarium\b/.test(raw)
  ) {
    return 'paid';
  }

  return 'unpaid';
}

/**
 * Normalizes arbitrary work mode strings into canonical BIO-INEXA internship modes.
 */
export function normalizeInternshipMode(raw?: string): 'On-site Lab' | 'Hybrid' | 'Remote / Dry Lab' {
  const val = String(raw || '').trim().toLowerCase();
  if (val.includes('hybrid')) {
    return 'Hybrid';
  }
  if (val.includes('remote') || val.includes('dry') || val.includes('online') || val.includes('wfh')) {
    return 'Remote / Dry Lab';
  }
  return 'On-site Lab';
}

/**
 * Checks whether an internship matches a mode filter (accepts canonical labels or 'remote'/'onsite'/'hybrid').
 */
export function matchesInternshipModeFilter(rawMode: string, filterMode?: string): boolean {
  if (!filterMode || filterMode === 'all' || filterMode === 'All') return true;
  const normalizedItem = normalizeInternshipMode(rawMode);
  const f = filterMode.trim().toLowerCase();
  if (f === 'remote' || f.includes('remote') || f.includes('dry')) {
    return normalizedItem === 'Remote / Dry Lab';
  }
  if (f === 'hybrid' || f.includes('hybrid')) {
    return normalizedItem === 'Hybrid';
  }
  if (f === 'onsite' || f === 'on-site' || f.includes('on-site') || f.includes('wet')) {
    return normalizedItem === 'On-site Lab';
  }
  return normalizedItem.toLowerCase() === f;
}

/**
 * Parses a deadline string (ISO YYYY-MM-DD or readable date) into end-of-day UTC timestamp.
 * Returns null for empty, "Rolling", "Open", or unparseable values.
 */
export function parseInternshipDeadline(deadline?: string): Date | null {
  const raw = String(deadline || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower.includes('rolling') ||
    lower.includes('open') ||
    lower.includes('not specified') ||
    lower.includes('tba') ||
    lower.includes('ongoing')
  ) {
    return null;
  }

  // Prefer explicit YYYY-MM-DD so timezone differences never prematurely expire same-day deadlines
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // Set to end of that day UTC
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

/**
 * Returns true if the internship deadline has strictly passed relative to referenceDate.
 */
export function isInternshipDeadlineExpired(deadline?: string, referenceDate: Date = new Date()): boolean {
  const parsed = parseInternshipDeadline(deadline);
  if (!parsed) return false;
  return parsed.getTime() < referenceDate.getTime();
}

/**
 * Computes days remaining until deadline (negative if expired, null if rolling/unspecified).
 */
export function getInternshipDaysRemaining(deadline?: string, referenceDate: Date = new Date()): number | null {
  const parsed = parseInternshipDeadline(deadline);
  if (!parsed) return null;
  const diffMs = parsed.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Strictly validates an external internship application URL.
 * Rejects non-HTTP(S) schemes, malformed URLs, and localhost/example placeholders.
 */
export function validateInternshipApplicationUrl(url?: string): InternshipUrlValidationResult {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return { valid: false, normalizedUrl: '', reason: 'Application URL is required.' };
  }
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, normalizedUrl: '', reason: 'Unsafe URL scheme is not permitted.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalizedUrl: '',
        reason: 'Application URL must use https:// or http://.'
      };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes('.') || BLOCKED_PLACEHOLDER_HOSTS.has(host)) {
      return {
        valid: false,
        normalizedUrl: '',
        reason: 'Please enter a valid official institutional or employer domain.'
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      domain: host
    };
  } catch {
    return { valid: false, normalizedUrl: '', reason: 'Malformed application URL.' };
  }
}

/**
 * Extracts distinct clean location options from a list of internships for location filtering.
 */
export function extractInternshipLocations(items: Array<{ location?: string }>): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const raw = String(item.location || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, raw);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters internships by search query, category, location, paid/unpaid compensation, work mode, and expiry.
 */
export function filterInternships<
  T extends Pick<
    Internship,
    'title' | 'organization' | 'location' | 'mode' | 'stipend' | 'deadline' | 'category' | 'eligibility' | 'description' | 'skillsRequired'
  > & {
    verificationStatus?: string;
    isActive?: boolean;
    isExpired?: boolean;
  }
>(items: T[], criteria: InternshipFilterCriteria, referenceDate: Date = new Date()): T[] {
  const searchLower = String(criteria.search || '').trim().toLowerCase();
  const categoryFilter = String(criteria.category || 'all').trim();
  const locationFilter = String(criteria.location || 'all').trim().toLowerCase();
  const compFilter = String(criteria.compensation || 'all').trim().toLowerCase();
  const modeFilter = String(criteria.mode || 'all').trim();
  const includeExpired = Boolean(criteria.includeExpired);

  return items.filter((intern) => {
    const expired =
      Boolean(intern.isExpired) ||
      intern.verificationStatus === 'Expired' ||
      intern.isActive === false ||
      isInternshipDeadlineExpired(intern.deadline, referenceDate);

    if (!includeExpired && expired) {
      return false;
    }

    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'All') {
      if (intern.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
    }

    if (locationFilter && locationFilter !== 'all') {
      if (!String(intern.location || '').toLowerCase().includes(locationFilter)) {
        return false;
      }
    }

    if (compFilter === 'paid' || compFilter === 'unpaid') {
      const actualComp = classifyInternshipCompensation(intern.stipend);
      if (actualComp !== compFilter) {
        return false;
      }
    }

    if (!matchesInternshipModeFilter(intern.mode, modeFilter)) {
      return false;
    }

    if (searchLower) {
      const haystack = [
        intern.title,
        intern.organization,
        intern.location,
        intern.category,
        intern.eligibility,
        intern.description,
        intern.stipend,
        ...(intern.skillsRequired || [])
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts internships: active upcoming deadlines first (nearest first), rolling next, expired last.
 */
export function sortInternshipsByUpcomingDeadline<
  T extends { deadline?: string; featured?: boolean; isActive?: boolean; verificationStatus?: string }
>(items: T[], referenceDate: Date = new Date()): T[] {
  return [...items].sort((a, b) => {
    const aExpired =
      a.verificationStatus === 'Expired' ||
      a.isActive === false ||
      isInternshipDeadlineExpired(a.deadline, referenceDate);
    const bExpired =
      b.verificationStatus === 'Expired' ||
      b.isActive === false ||
      isInternshipDeadlineExpired(b.deadline, referenceDate);

    if (aExpired !== bExpired) return aExpired ? 1 : -1;

    const aDate = parseInternshipDeadline(a.deadline);
    const bDate = parseInternshipDeadline(b.deadline);
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
  });
}

/**
 * Validates and normalizes a public internship submission.
 * Governance invariant: NEVER marks a submitted internship as Verified or Approved.
 */
export function validateInternshipSubmissionPayload(input: Partial<InternshipSubmissionInput>): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    organization: string;
    location: string;
    workMode: 'On-site Lab' | 'Hybrid' | 'Remote / Dry Lab';
    stipend: string;
    duration: string;
    deadline: string;
    category: 'Summer Fellowship' | 'Industrial R&D' | 'Academic Dissertation' | 'Clinical Research';
    eligibility: string;
    description: string;
    applicationUrl: string;
    sourceName: string;
    sourceUrl: string;
    skillsRequired: string[];
    learningOutcomes: string[];
    verificationStatus: 'Pending Verification';
    isApproved: false;
    isActive: true;
    lastVerificationDate: '';
  };
} {
  const errors: string[] = [];
  const title = String(input.title || '').trim();
  const organization = String(input.organization || '').trim();
  const location = String(input.location || '').trim();
  const duration = String(input.duration || '').trim();
  const eligibility = String(input.eligibility || '').trim();
  const stipend = String(input.stipend || '').trim() || 'Unpaid';
  const deadline = String(input.deadline || '').trim();
  const description = String(input.description || '').trim();

  if (title.length < 4) errors.push('Internship title must be at least 4 characters.');
  if (organization.length < 2) errors.push('Host institution or organization name is required.');
  if (location.length < 2) errors.push('Location (city or Remote) is required.');
  if (duration.length < 2) errors.push('Duration is required (e.g. 2 Months, 6 Months).');
  if (eligibility.length < 4) errors.push('Eligibility criteria are required.');
  if (description.length < 15) errors.push('Program description must be at least 15 characters.');

  const urlCheck = validateInternshipApplicationUrl(input.applicationUrl);
  if (!urlCheck.valid) {
    errors.push(urlCheck.reason || 'Valid official application URL is required.');
  }

  if (deadline && isInternshipDeadlineExpired(deadline)) {
    errors.push('Application deadline cannot be in the past.');
  }

  const rawCategory = String(input.category || '').trim();
  const category = (INTERNSHIP_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as 'Summer Fellowship' | 'Industrial R&D' | 'Academic Dissertation' | 'Clinical Research')
    : 'Industrial R&D';

  const workMode = normalizeInternshipMode(input.mode || input.workMode);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const skillsRequired = Array.isArray(input.skillsRequired)
    ? input.skillsRequired.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
    : [];
  const learningOutcomes = Array.isArray(input.learningOutcomes)
    ? input.learningOutcomes.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : [];

  const sourceUrlCheck = input.sourceUrl ? validateInternshipApplicationUrl(input.sourceUrl) : null;

  return {
    valid: true,
    errors: [],
    sanitized: {
      title,
      organization,
      location,
      workMode,
      stipend,
      duration,
      deadline,
      category,
      eligibility,
      description,
      applicationUrl: urlCheck.normalizedUrl,
      sourceName: String(input.sourceName || '').trim() || `Submitted by ${organization}`,
      sourceUrl: sourceUrlCheck?.valid ? sourceUrlCheck.normalizedUrl : urlCheck.normalizedUrl,
      skillsRequired,
      learningOutcomes,
      // Strict governance invariant: never auto-verify or auto-approve submitted internships
      verificationStatus: 'Pending Verification',
      isApproved: false,
      isActive: true,
      lastVerificationDate: ''
    }
  };
}
