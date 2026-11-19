import { JobVerificationStatus } from '../../types';

export const VALID_JOB_VERIFICATION_STATUSES: readonly JobVerificationStatus[] = [
  'Pending Verification',
  'Verified',
  'Rejected',
  'Expired',
  'Link Unavailable',
] as const;

const SHORTENER_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  'tinyurl',
  'goo.gl',
  'is.gd',
  't.co',
  'ow.ly',
  'cutt.ly',
  'rb.gy',
  'shorturl.at',
];

const OFFICIAL_DOMAIN_HINTS = [
  'biocon.com',
  'igib.res.in',
  'seruminstitute.com',
  'drreddys.com',
  'syngeneintl.com',
  'iisc.ac.in',
  'cdri.res.in',
  'ccmb.res.in',
  'ncbs.res.in',
  'thsti.res.in',
  'nibmg.ac.in',
  'rcb.res.in',
  'dbtindia.gov.in',
  'icmr.gov.in',
  'csir.res.in',
  'gov.in',
  'res.in',
  'ac.in',
  'nic.in',
  '.edu',
  '.org',
];

const KNOWN_EMPLOYER_PORTALS: Array<{ match: string; url: string; label: string }> = [
  { match: 'biocon', url: 'https://www.biocon.com/careers/', label: 'Biocon Official Careers Portal' },
  { match: 'igib', url: 'https://www.igib.res.in/', label: 'CSIR-IGIB Official Portal' },
  { match: 'serum institute', url: 'https://www.seruminstitute.com/careers.php', label: 'Serum Institute Careers Portal' },
  { match: 'syngene', url: 'https://www.syngeneintl.com/careers/', label: 'Syngene Official Careers Portal' },
  { match: 'dr. reddy', url: 'https://careers.drreddys.com', label: "Dr. Reddy's Official Careers Portal" },
  { match: 'dr reddy', url: 'https://careers.drreddys.com', label: "Dr. Reddy's Official Careers Portal" },
  { match: 'national institute of virology', url: 'https://niv.icmr.org.in/', label: 'ICMR-NIV Official Institutional Portal' },
  { match: 'iisc', url: 'https://iisc.ac.in/careers/', label: 'IISc Official Careers Portal' },
  { match: 'ncbs', url: 'https://www.ncbs.res.in/jobportal/', label: 'NCBS Official Job Portal' },
  { match: 'ccmb', url: 'https://www.ccmb.res.in/Careers', label: 'CSIR-CCMB Official Careers' },
  { match: 'cdri', url: 'https://cdri.res.in/', label: 'CSIR-CDRI Official Portal' },
  { match: 'rcb', url: 'https://www.rcb.res.in/', label: 'Regional Centre for Biotechnology Portal' },
];

export function normalizeJobVerificationStatus(status?: string): JobVerificationStatus {
  if (!status) return 'Pending Verification';
  const clean = status.trim();
  if (clean === 'Verified') return 'Verified';
  if (clean === 'Rejected') return 'Rejected';
  if (clean === 'Expired') return 'Expired';
  if (clean === 'Link Unavailable' || clean === 'Source Unavailable' || clean === 'source_unavailable') {
    return 'Link Unavailable';
  }
  if (clean === 'Pending Verification' || clean === 'Pending Review' || clean === 'Flagged') {
    return 'Pending Verification';
  }
  return 'Pending Verification';
}

export interface ApplicationUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  domain: string;
  reason?: string;
  isShortener: boolean;
  hasSuspiciousFeeTerms: boolean;
  isOfficialDomain: boolean;
}

export function validateApplicationUrl(rawUrl?: string): ApplicationUrlValidationResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || trimmed === '#' || trimmed.toLowerCase().startsWith('javascript:')) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      domain: '',
      reason: 'Application URL must be a valid HTTP or HTTPS link (placeholders like "#" are not allowed).',
      isShortener: false,
      hasSuspiciousFeeTerms: false,
      isOfficialDomain: false,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: trimmed,
      domain: '',
      reason: 'Application URL is malformed. Provide a full URL starting with http:// or https://.',
      isShortener: false,
      hasSuspiciousFeeTerms: false,
      isOfficialDomain: false,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: trimmed,
      domain: parsed.hostname || '',
      reason: 'Application URL must use the http:// or https:// protocol.',
      isShortener: false,
      hasSuspiciousFeeTerms: false,
      isOfficialDomain: false,
    };
  }

  const domain = parsed.hostname.toLowerCase();
  if (!domain || (!domain.includes('.') && domain !== 'localhost')) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      domain,
      reason: 'Application URL must contain a valid destination hostname.',
      isShortener: false,
      hasSuspiciousFeeTerms: false,
      isOfficialDomain: false,
    };
  }

  const isShortener = SHORTENER_DOMAINS.some(
    (sd) => domain === sd || domain.endsWith(`.${sd}`) || domain.includes(sd)
  );
  const fullLower = trimmed.toLowerCase();
  const hasSuspiciousFeeTerms =
    fullLower.includes('pay-') ||
    fullLower.includes('pay.') ||
    fullLower.includes('/pay') ||
    /(?:^|[^a-z])fees?(?:[^a-z]|$)/.test(fullLower) ||
    fullLower.includes('deposit') ||
    fullLower.includes('money');

  const isOfficialDomain = OFFICIAL_DOMAIN_HINTS.some(
    (hint) => domain === hint || domain.endsWith(hint) || domain.includes(hint)
  );

  if (isShortener) {
    return {
      valid: false,
      normalizedUrl: parsed.toString(),
      domain,
      reason: 'URL shorteners (e.g. bit.ly, tinyurl) are not permitted as official application destinations.',
      isShortener: true,
      hasSuspiciousFeeTerms,
      isOfficialDomain,
    };
  }

  if (hasSuspiciousFeeTerms) {
    return {
      valid: false,
      normalizedUrl: parsed.toString(),
      domain,
      reason: 'Application URL contains payment/fee indicators; fee-charging listings are prohibited.',
      isShortener: false,
      hasSuspiciousFeeTerms: true,
      isOfficialDomain,
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    domain,
    isShortener: false,
    hasSuspiciousFeeTerms: false,
    isOfficialDomain,
  };
}

export interface OfficialPortalResolution {
  portalUrl: string;
  portalDomain: string;
  portalLabel: string;
  sourceType: 'source_url' | 'employer_domain' | 'known_registry';
}

export function getOfficialEmployerPortal(input: {
  employer?: string;
  company?: string;
  sourceName?: string;
  sourceUrl?: string;
  originalJobUrl?: string;
  applicationUrl?: string;
}): OfficialPortalResolution | null {
  const brokenAppUrl = (input.applicationUrl || '').trim().replace(/\/+$/, '').toLowerCase();
  const employerName = (input.employer || input.company || '').trim();
  const employerLower = employerName.toLowerCase();

  // 1. Check explicit sourceUrl if it is a valid HTTP(S) URL and distinct from the broken deep-link
  const sourceCandidate = (input.sourceUrl || '').trim();
  if (sourceCandidate) {
    const check = validateApplicationUrl(sourceCandidate);
    const normalizedSource = sourceCandidate.replace(/\/+$/, '').toLowerCase();
    if (check.valid && normalizedSource !== brokenAppUrl) {
      return {
        portalUrl: check.normalizedUrl,
        portalDomain: check.domain,
        portalLabel: input.sourceName || `${employerName || check.domain} Official Portal`,
        sourceType: 'source_url',
      };
    }
  }

  // 2. Known official life-science / institutional registry match
  if (employerLower) {
    const matched = KNOWN_EMPLOYER_PORTALS.find((entry) => employerLower.includes(entry.match));
    if (matched) {
      let portalDomain = '';
      try {
        portalDomain = new URL(matched.url).hostname;
      } catch {
        portalDomain = '';
      }
      return {
        portalUrl: matched.url,
        portalDomain,
        portalLabel: matched.label,
        sourceType: 'known_registry',
      };
    }
  }

  // 3. Fall back to root origin of valid employer domain if not a shortener/fee link
  for (const raw of [input.sourceUrl, input.originalJobUrl, input.applicationUrl]) {
    if (!raw) continue;
    const check = validateApplicationUrl(raw);
    if (check.valid && check.domain) {
      try {
        const parsed = new URL(check.normalizedUrl);
        return {
          portalUrl: parsed.origin,
          portalDomain: parsed.hostname,
          portalLabel: `${employerName || parsed.hostname} Career Domain`,
          sourceType: 'employer_domain',
        };
      } catch {
        // continue
      }
    }
  }

  return null;
}

export function isJobExpiredByDeadline(deadline?: string, verificationStatus?: string): boolean {
  if (verificationStatus === 'Expired') return true;
  if (!deadline) return false;
  const trimmed = deadline.trim();
  if (!trimmed || trimmed === 'Not Specified' || trimmed === 'Rolling') return false;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return false;
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < Date.now();
}

export function normalizeCanonicalJobUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    const cleanParams = new URLSearchParams();
    for (const [k, v] of parsed.searchParams.entries()) {
      if (!k.toLowerCase().startsWith('utm_') && k.toLowerCase() !== 'ref' && k.toLowerCase() !== 'source') {
        cleanParams.set(k, v);
      }
    }
    const qs = cleanParams.toString();
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function normalizeJobText(text?: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateJobCandidate {
  id?: string;
  title: string;
  employer?: string;
  company?: string;
  location?: string;
  applicationUrl?: string;
}

export function findDuplicateJob<T extends DuplicateJobCandidate>(
  candidate: DuplicateJobCandidate,
  existingJobs: T[]
): T | null {
  const candUrl = normalizeCanonicalJobUrl(candidate.applicationUrl);
  const candTitle = normalizeJobText(candidate.title);
  const candEmployer = normalizeJobText(candidate.employer || candidate.company);

  for (const existing of existingJobs) {
    if (candidate.id && existing.id === candidate.id) continue;

    // 1. Canonical application URL match (when not a generic domain homepage without path)
    if (candUrl) {
      const exUrl = normalizeCanonicalJobUrl(existing.applicationUrl);
      if (exUrl && candUrl === exUrl) {
        return existing;
      }
    }

    // 2. Employer + Title match
    const exTitle = normalizeJobText(existing.title);
    const exEmployer = normalizeJobText(existing.employer || existing.company);
    if (candTitle && exTitle && candTitle === exTitle && candEmployer && exEmployer && candEmployer === exEmployer) {
      return existing;
    }
  }

  return null;
}

export function isVerificationDateAllowed(status: JobVerificationStatus): boolean {
  return status !== 'Pending Verification';
}
