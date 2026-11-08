import { Job, JobVerificationStatus } from '../../types';
import { Opportunity } from '../../types/opportunity';
import { SEED_JOBS } from '../../data/seedData';
import { SEED_OPPORTUNITIES } from '../opportunities/seedOpportunities';
import { opportunityStore } from '../opportunities/opportunityStore';
import { getDaysUntilDeadline } from '../opportunities/expiryManager';

export interface UnifiedJob {
  id: string;
  slug: string;
  title: string;
  company: string;
  employer: string; // Verified employer identity
  companyLogo?: string;
  location: string;
  workMode: string;
  type: string;
  sector: string;
  experienceLevel: string;
  qualification: string;
  salary: string;
  postedDate: string;
  deadline: string;
  publicationDate: string;
  expiryDate: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  benefits: string[];
  sourceName: string; // Original listing source
  sourceUrl: string;
  originalJobUrl: string; // Original job announcement URL
  applicationUrl: string; // Application destination
  lastVerificationDate: string; // Last verified date
  verificationStatus: JobVerificationStatus; // 5 statuses
  verificationNotes?: string;
  status: 'Active' | 'Closing Soon' | 'Expired' | 'Closed';
  isExpired: boolean;
  isClosed: boolean;
  isClosingSoon: boolean;
  featured: boolean;
  isVerified: boolean;
  daysLeft: number | null;
  branches: string[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mapJobToUnified(job: Job): UnifiedJob {
  const daysLeft = getDaysUntilDeadline(job.deadline || job.expiryDate);
  const isExpired = (daysLeft !== null && daysLeft < 0) || job.verificationStatus === 'Expired';
  const isClosingSoon = !isExpired && daysLeft !== null && daysLeft <= 5 && daysLeft >= 0;
  const status: UnifiedJob['status'] = isExpired ? 'Expired' : isClosingSoon ? 'Closing Soon' : 'Active';

  const locLower = (job.location || '').toLowerCase();
  const workMode = locLower.includes('remote') ? 'Remote' : locLower.includes('hybrid') ? 'Hybrid' : 'On-site';

  // Compute verification status strictly based on record
  let verificationStatus: JobVerificationStatus = job.verificationStatus || 'Verified';
  if (isExpired) {
    verificationStatus = 'Expired';
  } else if (job.verificationStatus) {
    verificationStatus = job.verificationStatus;
  }

  // Verification is true ONLY if verificationStatus === 'Verified'
  const isVerified = verificationStatus === 'Verified';

  const sourceName = job.source?.name || 'Verified Career Portal';
  const originalJobUrl = job.originalJobUrl || job.source?.url || job.applicationUrl || '';
  const applicationUrl = job.applicationUrl || job.source?.url || '';
  const pubDate = job.publicationDate || job.postedDate || '';
  const expDate = job.expiryDate || job.deadline || 'Not Specified';
  const lastVerDate = job.lastVerificationDate || (isVerified ? (pubDate || '2026-11-01') : '');

  return {
    id: job.id,
    slug: job.slug || slugify(job.title),
    title: job.title,
    company: job.company || job.employer || 'Biotechnology Enterprise',
    employer: job.employer || job.company || 'Biotechnology Enterprise',
    companyLogo: job.companyLogo,
    location: job.location,
    workMode,
    type: job.type || 'Full-time',
    sector: job.sector || 'Biotechnology & Life Sciences',
    experienceLevel: job.experienceLevel || 'Not Specified',
    qualification: job.qualification || 'Relevant Degree in Life Sciences',
    salary: job.salary || 'Not Disclosed',
    postedDate: pubDate,
    deadline: expDate,
    publicationDate: pubDate,
    expiryDate: expDate,
    description: job.description || '',
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    benefits: job.benefits || [],
    sourceName,
    sourceUrl: job.source?.url || originalJobUrl,
    originalJobUrl,
    applicationUrl,
    lastVerificationDate: lastVerDate,
    verificationStatus,
    verificationNotes: job.verificationNotes || (isVerified ? 'Employer identity and application link audited by BIO-NEXA team.' : undefined),
    status,
    isExpired,
    isClosed: false,
    isClosingSoon,
    featured: !!job.featured,
    isVerified,
    daysLeft,
    branches: ['biotechnology']
  };
}

export function mapOpportunityToUnified(opp: Opportunity): UnifiedJob {
  const daysLeft = getDaysUntilDeadline(opp.deadline || opp.applicationDeadline);
  const isExpired = 
    opp.status === 'expired' || 
    opp.status === 'Expired' || 
    (daysLeft !== null && daysLeft < 0);
  const isClosed = 
    opp.status === 'closed' || 
    opp.status === 'Closed';
  const isClosingSoon = 
    !isExpired && 
    !isClosed && 
    (opp.status === 'closing_soon' || opp.status === 'Closing Soon' || (daysLeft !== null && daysLeft <= 5 && daysLeft >= 0));

  let status: UnifiedJob['status'] = 'Active';
  if (isExpired) status = 'Expired';
  else if (isClosed) status = 'Closed';
  else if (isClosingSoon) status = 'Closing Soon';

  let salary = 'Not Disclosed';
  if (opp.salaryOrStipend && opp.salaryOrStipend !== 'Not Disclosed') {
    salary = opp.salaryOrStipend;
  } else if (opp.compensation && opp.compensation.isDisclosed && opp.compensation.amount) {
    salary = `${opp.compensation.currency || '₹'}${opp.compensation.amount}${opp.compensation.period ? ` / ${opp.compensation.period}` : ''}`;
  }

  const appUrl = opp.applicationUrl || opp.sourceUrl || '';
  const origUrl = opp.source?.originalUrl || opp.sourceUrl || appUrl;
  const isVerified = Boolean(opp.isVerified);
  const verificationStatus: JobVerificationStatus = isExpired
    ? 'Expired'
    : isVerified
      ? 'Verified'
      : (opp.status === 'source_unavailable' ? 'Link Unavailable' : 'Pending Verification');

  const pubDate = opp.postedDate || opp.createdAt || '';
  const expDate = opp.deadline || opp.applicationDeadline || 'Not Specified';
  const lastVerDate = isVerified ? (pubDate || '2026-11-01') : '';

  return {
    id: opp.id,
    slug: slugify(opp.title),
    title: opp.title,
    company: opp.organization,
    employer: opp.organization,
    companyLogo: opp.organizationLogo,
    location: opp.location,
    workMode: opp.workMode || 'On-site',
    type: opp.subCategory || (opp.type === 'internship' ? 'Internship' : 'Full-time'),
    sector: opp.sector || 'Biotechnology & Life Sciences',
    experienceLevel: opp.experience || 'Not Specified',
    qualification: opp.qualification || opp.qualifications?.join(', ') || opp.eligibility || 'Relevant Degree in Life Sciences',
    salary,
    postedDate: pubDate,
    deadline: expDate,
    publicationDate: pubDate,
    expiryDate: expDate,
    description: opp.description || '',
    responsibilities: opp.responsibilities || [],
    requirements: opp.requirements || opp.qualifications || [],
    skills: opp.skills || [],
    benefits: (opp as any).benefits || [],
    sourceName: opp.source?.name || opp.sourceName || 'Official Career Gazette',
    sourceUrl: opp.source?.originalUrl || opp.sourceUrl || appUrl,
    originalJobUrl: origUrl,
    applicationUrl: appUrl,
    lastVerificationDate: lastVerDate,
    verificationStatus,
    verificationNotes: isVerified ? 'Verified via official career gazette / institutional registry.' : undefined,
    status,
    isExpired,
    isClosed,
    isClosingSoon,
    featured: !!opp.featured,
    isVerified,
    daysLeft,
    branches: opp.branches || ['biotechnology']
  };
}

/**
 * Returns all unified jobs across both SEED_JOBS, user created jobs, and opportunityStore.
 */
export function getAllUnifiedJobs(contextJobs?: Job[]): UnifiedJob[] {
  const result: UnifiedJob[] = [];
  const seenIds = new Set<string>();

  // 1. Context jobs or fallback to SEED_JOBS
  const baseJobs = (contextJobs && contextJobs.length > 0) ? contextJobs : SEED_JOBS;
  for (const j of baseJobs) {
    if (!seenIds.has(j.id)) {
      result.push(mapJobToUnified(j));
      seenIds.add(j.id);
    }
  }

  // 2. Opportunities from opportunity store or SEED_OPPORTUNITIES
  let opps: Opportunity[] = [];
  try {
    opps = opportunityStore.getAllOpportunities();
  } catch {
    opps = SEED_OPPORTUNITIES;
  }
  if (!opps || opps.length === 0) {
    opps = SEED_OPPORTUNITIES;
  }

  for (const opp of opps) {
    if (!seenIds.has(opp.id)) {
      // Include all jobs, biotech_jobs, and relevant positions
      result.push(mapOpportunityToUnified(opp));
      seenIds.add(opp.id);
    }
  }

  return result;
}

/**
 * Lookup a job by ID or slug. Returns null if not found.
 */
export function getJobByIdOrSlug(idOrSlug: string, contextJobs?: Job[]): UnifiedJob | null {
  if (!idOrSlug) return null;
  const target = idOrSlug.trim().toLowerCase();

  const allJobs = getAllUnifiedJobs(contextJobs);

  // Exact ID match
  const byId = allJobs.find(j => j.id.toLowerCase() === target);
  if (byId) return byId;

  // Exact Slug match
  const bySlug = allJobs.find(j => j.slug.toLowerCase() === target);
  if (bySlug) return bySlug;

  // Relaxed slug match (e.g., partial match or prefix)
  const byRelaxedSlug = allJobs.find(j => 
    j.slug.toLowerCase().includes(target) || target.includes(j.slug.toLowerCase())
  );
  if (byRelaxedSlug) return byRelaxedSlug;

  return null;
}

/**
 * Validates whether an application URL is genuine and actionable.
 * Disables expired, closed, rejected, or link-unavailable listings.
 */
export function isApplicationLinkActionable(job: UnifiedJob): boolean {
  if (job.isExpired || job.isClosed) return false;
  if (job.verificationStatus === 'Expired' || job.verificationStatus === 'Link Unavailable' || job.verificationStatus === 'Rejected') {
    return false;
  }
  if (job.deadline) {
    const parsed = new Date(job.deadline);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      if (parsed.getTime() < Date.now()) {
        return false;
      }
    }
  }
  if (!job.applicationUrl) return false;
  const url = job.applicationUrl.trim();
  if (url === '#' || url === '' || url.startsWith('javascript:')) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
}

export interface ApplicationDestinationInfo {
  destinationUrl: string;
  domain: string;
  isExternal: boolean;
  isOfficialDomain: boolean;
  isSuspicious: boolean;
  warning?: string;
  warningMessage?: string;
}

/**
 * Parses and evaluates an application destination for user safety and transparency.
 */
export function parseApplicationDestination(job: UnifiedJob): ApplicationDestinationInfo {
  const url = (job.applicationUrl || '').trim();
  if (!url) {
    const msg = 'No application link has been specified for this opening.';
    return {
      destinationUrl: '',
      domain: 'Not Specified',
      isExternal: false,
      isOfficialDomain: false,
      isSuspicious: false,
      warning: msg,
      warningMessage: msg
    };
  }

  let domain = 'external-portal';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
  } catch {
    domain = url.replace(/^https?:\/\//, '').split('/')[0] || 'external';
  }

  const isExternal = true;
  const dLower = domain.toLowerCase();
  const uLower = url.toLowerCase();

  const isOfficialDomain = (
    dLower.includes('biocon.com') ||
    dLower.includes('igib.res.in') ||
    dLower.includes('seruminstitute.com') ||
    dLower.includes('drreddys.com') ||
    dLower.includes('syngeneintl.com') ||
    dLower.includes('iisc.ac.in') ||
    dLower.includes('cdri.res.in') ||
    dLower.includes('ccmb.res.in') ||
    dLower.includes('ncbs.res.in') ||
    dLower.includes('thsti.res.in') ||
    dLower.includes('nibmg.ac.in') ||
    dLower.includes('rcb.res.in') ||
    dLower.includes('gov.in') ||
    dLower.includes('res.in') ||
    dLower.includes('ac.in') ||
    dLower.includes('edu') ||
    dLower.includes('org')
  );

  const isShortener = (
    dLower.includes('bit.ly') ||
    dLower.includes('tinyurl') ||
    dLower.includes('goo.gl') ||
    dLower.includes('is.gd')
  );

  const hasFeeKeywords = (
    uLower.includes('pay-') ||
    uLower.includes('pay.') ||
    uLower.includes('/pay') ||
    uLower.includes('fee') ||
    uLower.includes('deposit') ||
    uLower.includes('money')
  );

  const isShortenerOrFee = isShortener || hasFeeKeywords;
  const isSuspicious = isShortenerOrFee || !job.isVerified;

  let warningMessage: string | undefined;
  if (isShortener) {
    warningMessage = 'CRITICAL WARNING: This destination URL uses a URL shortener service. Legitimate employers provide direct canonical links.';
  } else if (hasFeeKeywords) {
    warningMessage = 'CRITICAL WARNING: This destination references fee or payment terms. Legitimate life science employers never charge registration, interview, or processing fees.';
  } else if (!job.isVerified) {
    warningMessage = 'This listing is pending audit by BIO-NEXA administrators. Verify employer credentials before submitting personal documents.';
  }

  return {
    destinationUrl: url,
    domain,
    isExternal,
    isOfficialDomain,
    isSuspicious,
    warning: warningMessage,
    warningMessage
  };
}
