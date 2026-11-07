import { Job } from '../../types';
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
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  benefits: string[];
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string;
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
  const daysLeft = getDaysUntilDeadline(job.deadline);
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isClosingSoon = daysLeft !== null && daysLeft <= 5 && daysLeft >= 0;
  const status: UnifiedJob['status'] = isExpired ? 'Expired' : isClosingSoon ? 'Closing Soon' : 'Active';

  const locLower = (job.location || '').toLowerCase();
  const workMode = locLower.includes('remote') ? 'Remote' : locLower.includes('hybrid') ? 'Hybrid' : 'On-site';

  return {
    id: job.id,
    slug: job.slug || slugify(job.title),
    title: job.title,
    company: job.company,
    companyLogo: job.companyLogo,
    location: job.location,
    workMode,
    type: job.type || 'Full-time',
    sector: job.sector || 'Biotechnology & Life Sciences',
    experienceLevel: job.experienceLevel || 'Not Specified',
    qualification: job.qualification || 'Relevant Degree in Life Sciences',
    salary: job.salary || 'Not Disclosed',
    postedDate: job.postedDate || '',
    deadline: job.deadline || 'Not Specified',
    description: job.description || '',
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    benefits: job.benefits || [],
    sourceName: job.source?.name || 'Verified Career Portal',
    sourceUrl: job.source?.url || job.applicationUrl || '',
    applicationUrl: job.applicationUrl || job.source?.url || '',
    status,
    isExpired,
    isClosed: false,
    isClosingSoon,
    featured: !!job.featured,
    isVerified: true,
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

  return {
    id: opp.id,
    slug: slugify(opp.title),
    title: opp.title,
    company: opp.organization,
    companyLogo: opp.organizationLogo,
    location: opp.location,
    workMode: opp.workMode || 'On-site',
    type: opp.subCategory || (opp.type === 'internship' ? 'Internship' : 'Full-time'),
    sector: opp.sector || 'Biotechnology & Life Sciences',
    experienceLevel: opp.experience || 'Not Specified',
    qualification: opp.qualification || opp.qualifications?.join(', ') || opp.eligibility || 'Relevant Degree in Life Sciences',
    salary,
    postedDate: opp.postedDate || opp.createdAt || '',
    deadline: opp.deadline || opp.applicationDeadline || 'Not Specified',
    description: opp.description || '',
    responsibilities: opp.responsibilities || [],
    requirements: opp.requirements || opp.qualifications || [],
    skills: opp.skills || [],
    benefits: (opp as any).benefits || [],
    sourceName: opp.source?.name || opp.sourceName || 'Official Career Gazette',
    sourceUrl: opp.source?.originalUrl || opp.sourceUrl || appUrl,
    applicationUrl: appUrl,
    status,
    isExpired,
    isClosed,
    isClosingSoon,
    featured: !!opp.featured,
    isVerified: !!opp.isVerified,
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
 */
export function isApplicationLinkActionable(job: UnifiedJob): boolean {
  if (job.isExpired || job.isClosed) return false;
  if (!job.applicationUrl) return false;
  const url = job.applicationUrl.trim();
  if (url === '#' || url === '' || url.startsWith('javascript:')) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
}
