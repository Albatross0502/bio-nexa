/**
 * BIO-INEXA Server-Side Supabase PostgreSQL Repository
 *
 * Exclusively uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server side.
 * Runs purely in serverless Node/edge environments without embedded SQLite or local filesystem imports.
 * Never import this module from frontend React bundles.
 */

import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isJobExpiredByDeadline } from '../../../src/services/jobs/jobVerification';
import {
  classifyInternshipCompensation,
  isInternshipDeadlineExpired,
  matchesInternshipModeFilter,
} from '../../../src/services/internships/internshipHelpers';
import {
  isWorkshopExpired,
  normalizeWorkshopApprovalStatus,
} from '../../../src/services/workshops/workshopHelpers';
import {
  COURSE_CATEGORIES,
  classifyCoursePricing,
  isCourseExpired,
  normalizeCourseApprovalStatus,
  normalizeCourseProviderType,
} from '../../../src/services/courses/courseHelpers';
import {
  type DbStudentAccount,
  type DbStudentSession,
  type SafeStudentSession,
  type StudentAccountStatus,
  type StudentDeletionRequestRecord,
  hashEmailForAudit,
  hashOpaqueToken,
  normalizeStudentEmail,
} from '../../../src/services/student/studentAuthService';
import {
  type ApplicationDestinationType,
  type CompanyAccountRecord,
  type CompanyAccountStatus,
  type CompanyAuditLogRecord,
  type CompanySessionRecord,
  generateCompanyAuditId,
  normalizeAccountStatus as normalizeCompanyAccountStatus,
  normalizeApplicationDestinationType,
  normalizeCompanyEmail,
  normalizeVerificationStatus as normalizeCompanyVerificationStatus,
} from '../../../src/services/company/companyAuthService';

export type JobVerificationStatus =
  | 'Pending Verification'
  | 'Verified'
  | 'Rejected'
  | 'Expired'
  | 'Link Unavailable';

export function normalizeVerificationStatus(status?: string): JobVerificationStatus {
  if (!status) return 'Pending Verification';
  const clean = status.trim();
  if (clean === 'Verified') return 'Verified';
  if (clean === 'Rejected') return 'Rejected';
  if (clean === 'Expired') return 'Expired';
  if (clean === 'Link Unavailable' || clean === 'Source Unavailable') return 'Link Unavailable';
  return 'Pending Verification';
}

export function normalizeCourseStatus(status?: string): 'available' | 'closed' {
  const clean = (status || '').trim().toLowerCase();
  if (clean === 'closed' || clean === 'archived' || clean === 'expired' || clean === 'inactive') {
    return 'closed';
  }
  return 'available';
}

export function isSupabaseConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return Boolean(url && key);
}

export function getSupabaseAdminClient(
  env: Record<string, string | undefined> = process.env,
  customFetch?: typeof fetch
): SupabaseClient | null {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(customFetch ? { global: { fetch: customFetch } } : {}),
  });
}

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x));
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapJobRow(row: any) {
  const verificationStatus = normalizeVerificationStatus(row.verification_status);
  return {
    id: row.id,
    title: row.title,
    employer: row.employer,
    description: row.description,
    location: row.location,
    qualification: row.qualification || '',
    skills: parseJsonArray(row.skills),
    employmentType: row.employment_type || 'Full-time',
    salary: row.salary || 'Competitive',
    applicationUrl: row.application_url,
    source: row.source || 'BIO-INEXA Verified',
    originalJobUrl: row.original_job_url || '',
    publicationDate: row.publication_date,
    expiryDate: row.expiry_date || '',
    lastVerificationDate: row.last_verification_date || '',
    verificationStatus,
    verificationNotes: row.verification_notes || '',
    isVerified: verificationStatus === 'Verified',
    isActive: Boolean(row.is_active),
    isApproved: Boolean(row.is_approved),
    featured: Boolean(row.featured),
    responsibilities: parseJsonArray(row.responsibilities),
    requirements: parseJsonArray(row.requirements),
    sector: row.sector || 'Biotechnology',
    companyAccountId: row.company_account_id || '',
    applicationDestinationType: normalizeApplicationDestinationType(row.application_destination_type),
    applicationEmail: row.application_email || '',
    applicationInstructions: row.application_instructions || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatAdminJob(job: ReturnType<typeof mapJobRow>) {
  const deadline = job.expiryDate || '';
  const isExpired =
    !job.isActive ||
    job.verificationStatus === 'Expired' ||
    (Boolean(deadline) && deadline < new Date().toISOString().split('T')[0]);

  return {
    id: job.id,
    title: job.title,
    company: job.employer,
    employer: job.employer,
    sector: job.sector,
    location: job.location,
    type: job.employmentType,
    salary: job.salary,
    qualification: job.qualification,
    experienceLevel: 'All Experience Levels',
    description: job.description,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    deadline,
    expiryDate: job.expiryDate,
    publicationDate: job.publicationDate,
    applicationUrl: job.applicationUrl,
    originalJobUrl: job.originalJobUrl || '',
    status: job.isActive ? (isExpired ? 'Expired' : 'Active') : 'Inactive',
    featured: job.featured,
    isApproved: job.isApproved,
    isExpired,
    sourceName: job.source,
    originalSource: job.source,
    sourceUrl: job.originalJobUrl || job.applicationUrl,
    postedDate: job.publicationDate,
    verificationStatus: job.verificationStatus,
    lastVerificationDate: job.lastVerificationDate || '',
    verificationNotes: job.verificationNotes || '',
  };
}

function normalizeSupabaseWorkMode(mode?: string): 'On-site' | 'Remote' | 'Hybrid' {
  const lower = (mode || '').toLowerCase();
  if (lower.includes('remote') || lower.includes('dry')) return 'Remote';
  if (lower.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

function mapInternshipRow(row: any) {
  const verificationStatus = normalizeVerificationStatus(row.verification_status);
  const workMode = row.work_mode || 'On-site';
  const tags = parseJsonArray(row.tags);
  const stipend = row.stipend || 'Competitive Stipend';
  const compensationType = classifyInternshipCompensation(stipend);
  const expired =
    verificationStatus === 'Expired' ||
    row.is_active === false ||
    isInternshipDeadlineExpired(row.deadline || '');
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    organization: row.organization,
    location: row.location || 'India',
    mode: workMode,
    workMode,
    stipend,
    compensationType,
    isPaid: compensationType === 'paid',
    duration: row.duration || '3 Months',
    deadline: row.deadline || '',
    category: row.category || tags[0] || 'Industrial R&D',
    eligibility: row.eligibility || '',
    description: row.description || '',
    learningOutcomes: parseJsonArray(row.learning_outcomes),
    skillsRequired: parseJsonArray(row.skills).length > 0 ? parseJsonArray(row.skills) : tags,
    source: {
      name: row.source_name || 'Verified Partner Program',
      url: row.source_url || row.application_url || '',
      isExternal: true,
    },
    sourceName: row.source_name || 'Verified Partner Program',
    sourceUrl: row.source_url || row.application_url || '',
    applicationUrl: row.application_url || '',
    verificationStatus: expired && verificationStatus !== 'Rejected' ? 'Expired' : verificationStatus,
    verificationNotes: row.verification_notes || '',
    lastVerificationDate: row.last_verification_date || '',
    isVerified: verificationStatus === 'Verified' && !expired,
    isApproved: Boolean(row.is_approved),
    isActive: row.is_active !== false && !expired,
    isExpired: expired,
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatAdminInternship(intern: ReturnType<typeof mapInternshipRow>) {
  return {
    ...intern,
    status:
      intern.verificationStatus === 'Rejected'
        ? 'Rejected'
        : !intern.isActive
        ? 'Expired'
        : 'Active',
  };
}

function mapWorkshopRow(row: any) {
  const approvalStatus = normalizeWorkshopApprovalStatus(row.approval_status, row.is_approved ?? true);
  const expired = isWorkshopExpired({
    status: row.status,
    availability: row.availability,
    date: row.date,
    registrationDeadline: row.registration_deadline,
  });
  const numericCap = Number(row.capacity ?? 0);
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    description: row.description || '',
    organizer: row.organizer || '',
    instructor: row.instructor || '',
    category: row.category || '',
    date: row.date || '',
    startDate: row.date || '',
    endDate: row.date || '',
    time: row.time || '',
    duration: row.duration || '',
    format: row.format || 'Online',
    workMode: row.format || 'Online',
    venue: row.venue || '',
    location: row.venue || '',
    registrationDeadline: row.registration_deadline || '',
    registrationLink: row.registration_link,
    registrationUrl: row.registration_link,
    availability: row.availability || (expired ? 'Closed' : 'Open'),
    status: expired ? 'completed' : (row.status || 'upcoming'),
    fees: row.fees || '',
    capacity: Number.isFinite(numericCap) && numericCap > 0 ? numericCap : null,
    imageUrl: row.image_url || '',
    featured: Boolean(row.featured),
    skillsCovered: parseJsonArray(row.skills_covered),
    approvalStatus,
    isApproved: approvalStatus === 'approved',
    isExpired: expired,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseRow(row: any) {
  const expired = isCourseExpired({ registrationDeadline: row.registration_deadline });
  const status = expired ? 'closed' : normalizeCourseStatus(row.status);
  const certInfo = (row.certificate_info || '').trim();
  const fees = String(row.fees || '').trim();
  const pricingType = classifyCoursePricing(fees, row.pricing_type);
  const providerType = normalizeCourseProviderType(row.provider_type);
  const approvalStatus = normalizeCourseApprovalStatus(row.approval_status, row.is_approved);
  const isApproved = approvalStatus === 'approved';
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    provider: String(row.provider || '').trim(),
    providerType,
    description: row.description || '',
    duration: row.duration || '',
    fees,
    price: fees,
    pricingType,
    eligibility: row.eligibility || '',
    curriculum: parseJsonArray(row.curriculum),
    syllabus: parseJsonArray(row.curriculum),
    deliveryMode: row.delivery_mode || 'Online (Self-Paced)',
    certificateInfo: certInfo,
    registrationDeadline: row.registration_deadline || '',
    registrationLink: row.registration_link,
    registrationUrl: row.registration_link,
    availability: expired ? 'Expired' : status === 'closed' ? 'Closed' : row.availability || 'Available',
    status,
    approvalStatus,
    isApproved,
    isExpired: expired,
    instructor: String(row.instructor || '').trim(),
    level: row.level || '',
    category: row.category || 'Biotechnology',
    imageUrl: row.image_url || '',
    isCertificateAvailable: Boolean(certInfo),
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmittedOpportunityRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    organization: row.organization,
    type: row.type || 'job',
    subCategory: row.sub_category || '',
    description: row.description,
    location: row.location,
    workMode: row.work_mode || 'On-site',
    experience: row.experience || 'Not Specified',
    qualification: row.qualification || '',
    branches: parseJsonArray(row.branches),
    skills: parseJsonArray(row.skills),
    salaryOrStipend: row.salary_or_stipend || 'Not Disclosed',
    salaryTier: row.salary_tier || 'not_disclosed',
    deadline: row.deadline || '',
    postedDate: row.posted_date,
    sourceName: row.source_name || 'Direct Employer / Organizer Submission',
    sourceUrl: row.source_url || '',
    applicationUrl: row.application_url,
    contactEmail: row.contact_email || '',
    status: row.status || 'Pending Verification',
    isApproved: Boolean(row.is_approved),
    workshopDetails: row.workshop_details || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComplianceRow(row: any) {
  return {
    id: row.id,
    referenceId: row.reference_id,
    requestType: row.request_type,
    subCategory: row.sub_category,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    organization: row.organization || '',
    targetTitleOrUrl: row.target_title_or_url || '',
    details: row.details,
    consentAccepted: Boolean(row.consent_accepted),
    status: row.status,
    resolutionNotes: row.resolution_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  private assertOk<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
    if (result.error) {
      throw new Error(`Supabase ${context} failed: ${result.error.message}`);
    }
    return result.data as T;
  }

  // -----------------------------------------------------------------------
  // JOBS & VERIFICATION
  // -----------------------------------------------------------------------

  public async getJobs(filter?: {
    search?: string;
    sector?: string;
    location?: string;
    verificationStatus?: string;
    onlyApproved?: boolean;
    onlyActive?: boolean;
  }) {
    let query = this.client
      .from('jobs')
      .select('*')
      .order('featured', { ascending: false })
      .order('publication_date', { ascending: false });

    if (filter?.onlyActive !== false) {
      query = query.eq('is_active', true);
    }
    if (filter?.onlyApproved !== false) {
      query = query.eq('is_approved', true);
    }
    if (filter?.verificationStatus && filter.verificationStatus !== 'all') {
      query = query.eq('verification_status', normalizeVerificationStatus(filter.verificationStatus));
    }

    const rows = this.assertOk<any[]>(await query, 'getJobs') || [];
    return rows
      .map(mapJobRow)
      .filter((job) => {
        if (filter?.sector && filter.sector !== 'all') {
          if (!job.sector.toLowerCase().includes(filter.sector.toLowerCase())) return false;
        }
        if (filter?.location && filter.location !== 'all') {
          if (!job.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
        }
        if (filter?.search) {
          const term = filter.search.toLowerCase();
          const hay = [job.title, job.employer, job.description, job.location, job.sector, ...job.skills]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
  }

  public async getAllJobsAdmin() {
    const rows = this.assertOk<any[]>(
      await this.client.from('jobs').select('*').order('created_at', { ascending: false }),
      'getAllJobsAdmin'
    );
    return (rows || []).map(mapJobRow);
  }

  public async getJobById(id: string) {
    const { data, error } = await this.client.from('jobs').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getJobById failed: ${error.message}`);
    return data ? mapJobRow(data) : null;
  }

  public async getJobVerificationRecords(jobId: string) {
    const rows = this.assertOk<any[]>(
      await this.client
        .from('job_verification_records')
        .select('*')
        .eq('job_id', jobId)
        .order('verified_at', { ascending: false }),
      'getJobVerificationRecords'
    );
    return (rows || []).map((r) => ({
      id: r.id,
      jobId: r.job_id,
      verifiedBy: r.verified_by,
      verifiedAt: r.verified_at,
      sourceStatus: r.source_status,
      notes: r.notes || '',
    }));
  }

  public async createJob(input: {
    id?: string;
    title: string;
    employer: string;
    description: string;
    location: string;
    qualification?: string;
    skills?: string[];
    employmentType?: string;
    salary?: string;
    applicationUrl: string;
    source?: string;
    originalJobUrl?: string;
    publicationDate?: string;
    expiryDate?: string;
    lastVerificationDate?: string;
    verificationStatus?: string;
    verificationNotes?: string;
    isActive?: boolean;
    isApproved?: boolean;
    featured?: boolean;
    responsibilities?: string[];
    requirements?: string[];
    sector?: string;
    companyAccountId?: string;
    applicationDestinationType?: ApplicationDestinationType;
    applicationEmail?: string;
    applicationInstructions?: string;
  }) {
    const now = new Date().toISOString();
    const id = input.id || `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const verStatus = normalizeVerificationStatus(input.verificationStatus);
    const pubDate = input.publicationDate || now.split('T')[0];
    const lastVerDate = verStatus === 'Pending Verification' ? '' : (input.lastVerificationDate || '');

    const row = this.assertOk<any>(
      await this.client
        .from('jobs')
        .insert({
          id,
          title: input.title,
          employer: input.employer,
          description: input.description,
          location: input.location,
          qualification: input.qualification || '',
          skills: input.skills || [],
          employment_type: input.employmentType || 'Full-time',
          salary: input.salary || 'Competitive',
          application_url: input.applicationUrl || '',
          source: input.source || 'BIO-INEXA Verified',
          original_job_url: input.originalJobUrl || '',
          publication_date: pubDate,
          expiry_date: input.expiryDate || '',
          last_verification_date: lastVerDate,
          verification_status: verStatus,
          verification_notes: input.verificationNotes || '',
          is_active: input.isActive !== false,
          is_approved: Boolean(input.isApproved),
          featured: Boolean(input.featured),
          responsibilities: input.responsibilities || [],
          requirements: input.requirements || [],
          sector: input.sector || 'Biotechnology',
          company_account_id: input.companyAccountId || '',
          application_destination_type: normalizeApplicationDestinationType(input.applicationDestinationType),
          application_email: input.applicationEmail || '',
          application_instructions: input.applicationInstructions || '',
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createJob'
    );
    return mapJobRow(row);
  }

  public async updateJob(id: string, updates: Record<string, any>) {
    const existing = await this.getJobById(id);
    if (!existing) return null;

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.employer !== undefined || updates.company !== undefined) {
      patch.employer = updates.employer ?? updates.company;
    }
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.qualification !== undefined) patch.qualification = updates.qualification;
    if (updates.skills !== undefined) patch.skills = updates.skills;
    if (updates.employmentType !== undefined || updates.type !== undefined) {
      patch.employment_type = updates.employmentType ?? updates.type;
    }
    if (updates.salary !== undefined) patch.salary = updates.salary;
    if (updates.applicationUrl !== undefined) patch.application_url = updates.applicationUrl;
    if (updates.source !== undefined) patch.source = updates.source;
    if (updates.originalJobUrl !== undefined) patch.original_job_url = updates.originalJobUrl;
    if (updates.publicationDate !== undefined) patch.publication_date = updates.publicationDate;
    if (updates.expiryDate !== undefined || updates.deadline !== undefined) {
      patch.expiry_date = updates.expiryDate ?? updates.deadline;
    }
    if (updates.verificationStatus !== undefined) {
      patch.verification_status = normalizeVerificationStatus(updates.verificationStatus);
    }
    if (updates.verificationNotes !== undefined) patch.verification_notes = updates.verificationNotes;
    if (updates.lastVerificationDate !== undefined) patch.last_verification_date = updates.lastVerificationDate;
    if (updates.isActive !== undefined) patch.is_active = Boolean(updates.isActive);
    if (updates.isApproved !== undefined) patch.is_approved = Boolean(updates.isApproved);
    if (updates.featured !== undefined) patch.featured = Boolean(updates.featured);
    if (updates.responsibilities !== undefined) patch.responsibilities = updates.responsibilities;
    if (updates.requirements !== undefined) patch.requirements = updates.requirements;
    if (updates.sector !== undefined) patch.sector = updates.sector;
    if (updates.companyAccountId !== undefined) patch.company_account_id = updates.companyAccountId;
    if (updates.applicationDestinationType !== undefined) {
      patch.application_destination_type = normalizeApplicationDestinationType(updates.applicationDestinationType);
    }
    if (updates.applicationEmail !== undefined) patch.application_email = updates.applicationEmail;
    if (updates.applicationInstructions !== undefined) {
      patch.application_instructions = updates.applicationInstructions;
    }

    const row = this.assertOk<any>(
      await this.client.from('jobs').update(patch).eq('id', id).select('*').single(),
      'updateJob'
    );
    return mapJobRow(row);
  }

  public async deleteJob(id: string): Promise<boolean> {
    const existing = await this.getJobById(id);
    if (!existing) return false;
    this.assertOk(await this.client.from('jobs').delete().eq('id', id), 'deleteJob');
    return true;
  }

  public async verifyJob(
    jobId: string,
    verifiedBy: string,
    sourceStatus: string,
    notes: string,
    lastVerificationDate?: string
  ) {
    const existing = await this.getJobById(jobId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const verStatus = normalizeVerificationStatus(sourceStatus);
    const verDate = verStatus === 'Pending Verification' ? '' : (lastVerificationDate || nowIso.split('T')[0]);
    const isApproved = verStatus === 'Verified' || verStatus === 'Link Unavailable';
    const isActive = verStatus !== 'Expired' && verStatus !== 'Rejected';

    const updatedJob = await this.updateJob(jobId, {
      verificationStatus: verStatus,
      verificationNotes: notes,
      lastVerificationDate: verDate,
      isApproved,
      isActive,
    });

    await this.client.from('job_verification_records').insert({
      id: `ver-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      job_id: jobId,
      verified_by: verifiedBy,
      verified_at: nowIso,
      source_status: verStatus,
      notes: notes || '',
    });

    return updatedJob;
  }

  // -----------------------------------------------------------------------
  // INTERNSHIPS
  // -----------------------------------------------------------------------

  public async getInternships(filter?: {
    search?: string;
    category?: string;
    location?: string;
    mode?: string;
    compensation?: string;
    includeExpired?: boolean;
    onlyApproved?: boolean;
    onlyActive?: boolean;
  }) {
    let query = this.client
      .from('internships')
      .select('*')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (filter?.onlyApproved !== false) {
      query = query.eq('is_approved', true);
    }
    if (filter?.onlyActive !== false && !filter?.includeExpired) {
      query = query.eq('is_active', true);
    }

    const rows = this.assertOk<any[]>(await query, 'getInternships') || [];
    const compFilter = String(filter?.compensation || 'all').trim().toLowerCase();

    return rows.map(mapInternshipRow).filter((item) => {
      if (!filter?.includeExpired && filter?.onlyActive !== false && item.isExpired) {
        return false;
      }
      if (filter?.category && filter.category !== 'All' && filter.category !== 'all' && item.category !== filter.category) {
        return false;
      }
      if (filter?.location && filter.location !== 'All' && filter.location !== 'all') {
        if (!item.location.toLowerCase().includes(filter.location.toLowerCase())) {
          return false;
        }
      }
      if (filter?.mode && !matchesInternshipModeFilter(item.workMode, filter.mode)) {
        return false;
      }
      if (compFilter === 'paid' || compFilter === 'unpaid') {
        if (item.compensationType !== compFilter) {
          return false;
        }
      }
      if (filter?.search) {
        const term = filter.search.toLowerCase();
        return [item.title, item.organization, item.description, item.location, item.eligibility, ...item.skillsRequired]
          .join(' ')
          .toLowerCase()
          .includes(term);
      }
      return true;
    });
  }

  public async expirePastDeadlineInternships(referenceDate: Date = new Date()): Promise<{
    expiredCount: number;
    expiredIds: string[];
  }> {
    const all = await this.getAllInternshipsAdmin();
    const expiredIds: string[] = [];
    for (const item of all) {
      if (
        item.isActive &&
        item.verificationStatus !== 'Rejected' &&
        item.verificationStatus !== 'Expired' &&
        isInternshipDeadlineExpired(item.deadline, referenceDate)
      ) {
        await this.updateInternship(item.id, {
          isActive: false,
          verificationStatus: 'Expired',
          verificationNotes: item.verificationNotes
            ? `${item.verificationNotes} · Automatically marked expired after deadline (${item.deadline}).`
            : `Automatically marked expired after deadline (${item.deadline}).`,
        });
        expiredIds.push(item.id);
      }
    }
    return { expiredCount: expiredIds.length, expiredIds };
  }

  public async getAllInternshipsAdmin() {
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('internships')
          .select('*')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false }),
        'getAllInternshipsAdmin'
      ) || [];
    return rows.map(mapInternshipRow);
  }

  public async getInternshipById(id: string) {
    const { data, error } = await this.client.from('internships').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getInternshipById failed: ${error.message}`);
    return data ? mapInternshipRow(data) : null;
  }

  public async createInternship(input: Record<string, any>) {
    const now = new Date().toISOString();
    const id = input.id || `intern-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const verStatus = normalizeVerificationStatus(input.verificationStatus);
    const row = this.assertOk<any>(
      await this.client
        .from('internships')
        .insert({
          id,
          title: input.title,
          organization: input.organization,
          description: input.description || `${input.title} at ${input.organization}`,
          location: input.location || 'India',
          work_mode: normalizeSupabaseWorkMode(input.mode || input.workMode),
          stipend: input.stipend || 'Competitive Stipend',
          duration: input.duration || '3 Months',
          deadline: input.deadline || '',
          eligibility: input.eligibility || 'Life Sciences Students',
          skills: Array.isArray(input.skillsRequired) ? input.skillsRequired : [],
          tags: input.category ? [input.category] : ['Industrial R&D'],
          application_url: input.applicationUrl,
          source_name: input.sourceName || 'BIO-INEXA Admin Portal',
          source_url: input.sourceUrl || input.applicationUrl,
          verification_status: verStatus,
          verification_notes: input.verificationNotes || '',
          last_verification_date: input.lastVerificationDate || (verStatus === 'Verified' ? now.split('T')[0] : ''),
          is_active: input.isActive !== false,
          is_approved: Boolean(input.isApproved),
          featured: Boolean(input.featured),
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createInternship'
    );
    return mapInternshipRow(row);
  }

  public async updateInternship(id: string, updates: Record<string, any>) {
    const existing = await this.getInternshipById(id);
    if (!existing) return null;

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.organization !== undefined) patch.organization = updates.organization;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.workMode !== undefined || updates.mode !== undefined) {
      patch.work_mode = normalizeSupabaseWorkMode(updates.workMode || updates.mode);
    }
    if (updates.stipend !== undefined) patch.stipend = updates.stipend;
    if (updates.duration !== undefined) patch.duration = updates.duration;
    if (updates.deadline !== undefined) patch.deadline = updates.deadline;
    if (updates.eligibility !== undefined) patch.eligibility = updates.eligibility;
    if (Array.isArray(updates.skillsRequired)) patch.skills = updates.skillsRequired;
    if (updates.category !== undefined) patch.tags = [updates.category];
    if (updates.applicationUrl !== undefined) patch.application_url = updates.applicationUrl;
    if (updates.sourceName !== undefined) patch.source_name = updates.sourceName;
    if (updates.sourceUrl !== undefined) patch.source_url = updates.sourceUrl;
    if (updates.verificationStatus !== undefined) patch.verification_status = normalizeVerificationStatus(updates.verificationStatus);
    if (updates.verificationNotes !== undefined) patch.verification_notes = updates.verificationNotes;
    if (updates.lastVerificationDate !== undefined) patch.last_verification_date = updates.lastVerificationDate;
    if (updates.isActive !== undefined) patch.is_active = Boolean(updates.isActive);
    if (updates.isApproved !== undefined) patch.is_approved = Boolean(updates.isApproved);
    if (updates.featured !== undefined) patch.featured = Boolean(updates.featured);

    const row = this.assertOk<any>(
      await this.client.from('internships').update(patch).eq('id', id).select('*').single(),
      'updateInternship'
    );
    return mapInternshipRow(row);
  }

  public async verifyInternship(
    internshipId: string,
    _verifiedBy: string,
    sourceStatus: string,
    notes: string,
    lastVerificationDate?: string
  ) {
    const existing = await this.getInternshipById(internshipId);
    if (!existing) return null;
    const nowIso = new Date().toISOString();
    const verStatus = normalizeVerificationStatus(sourceStatus);
    return this.updateInternship(internshipId, {
      verificationStatus: verStatus,
      verificationNotes: notes,
      lastVerificationDate: lastVerificationDate || nowIso.split('T')[0],
      isApproved: verStatus === 'Verified' || verStatus === 'Link Unavailable',
      isActive: verStatus !== 'Expired' && verStatus !== 'Rejected',
    });
  }

  public async deleteInternship(id: string): Promise<boolean> {
    const existing = await this.getInternshipById(id);
    if (!existing) return false;
    this.assertOk(await this.client.from('internships').delete().eq('id', id), 'deleteInternship');
    return true;
  }

  // -----------------------------------------------------------------------
  // WORKSHOPS
  // -----------------------------------------------------------------------

  public async getWorkshops(filter?: {
    onlyApproved?: boolean;
    approvalStatus?: string;
    category?: string;
    includeExpired?: boolean;
    status?: string;
    format?: string;
    featured?: boolean;
    search?: string;
  }) {
    let query = this.client
      .from('workshops')
      .select('*')
      .order('featured', { ascending: false })
      .order('date', { ascending: true });

    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter?.format && filter.format !== 'all') {
      query = query.eq('format', filter.format);
    }
    if (filter?.featured !== undefined) {
      query = query.eq('featured', filter.featured);
    }

    const rows = this.assertOk<any[]>(await query, 'getWorkshops') || [];
    return rows.map(mapWorkshopRow).filter((ws) => {
      if (filter?.onlyApproved && !ws.isApproved) return false;
      if (filter?.approvalStatus && filter.approvalStatus !== 'all' && ws.approvalStatus !== filter.approvalStatus) {
        return false;
      }
      if (filter?.category && filter.category !== 'all' && ws.category.toLowerCase() !== filter.category.toLowerCase()) {
        return false;
      }
      if (filter?.includeExpired === false && ws.isExpired) return false;
      if (filter?.search) {
        const term = filter.search.toLowerCase();
        const hay = [ws.name, ws.description, ws.organizer, ws.instructor, ws.category, ws.venue, ...ws.skillsCovered]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  public async getWorkshopById(id: string) {
    const { data, error } = await this.client.from('workshops').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getWorkshopById failed: ${error.message}`);
    return data ? mapWorkshopRow(data) : null;
  }

  public async createWorkshop(input: Record<string, any>) {
    const now = new Date().toISOString();
    const id = input.id || `ws-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const approvalStatus = normalizeWorkshopApprovalStatus(input.approvalStatus, input.isApproved ?? true);
    const parsedCap = input.capacity !== undefined && input.capacity !== null && input.capacity !== '' ? Number(input.capacity) : 0;
    const row = this.assertOk<any>(
      await this.client
        .from('workshops')
        .insert({
          id,
          name: input.title || input.name,
          description: input.description || '',
          organizer: input.organizer || '',
          instructor: input.instructor || '',
          category: input.category || '',
          date: input.date || input.startDate || '',
          time: input.time || '',
          duration: input.duration || '',
          format: input.format || input.workMode || 'Online',
          venue: input.venue || input.location || '',
          registration_deadline: input.registrationDeadline || '',
          registration_link: input.registrationUrl || input.registrationLink,
          availability: input.availability || 'Open',
          status: input.status || 'upcoming',
          fees: input.fees || '',
          capacity: Number.isFinite(parsedCap) && parsedCap > 0 ? Math.floor(parsedCap) : 0,
          image_url: input.imageUrl || '',
          featured: approvalStatus === 'approved' ? Boolean(input.featured) : false,
          skills_covered: input.skillsCovered || [],
          approval_status: approvalStatus,
          is_approved: approvalStatus === 'approved',
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createWorkshop'
    );
    return mapWorkshopRow(row);
  }

  public async updateWorkshop(id: string, updates: Record<string, any>) {
    const existing = await this.getWorkshopById(id);
    if (!existing) return null;

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined || updates.name !== undefined) patch.name = updates.title ?? updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.organizer !== undefined) patch.organizer = updates.organizer;
    if (updates.instructor !== undefined) patch.instructor = updates.instructor;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.date !== undefined || updates.startDate !== undefined) patch.date = updates.date ?? updates.startDate;
    if (updates.time !== undefined) patch.time = updates.time;
    if (updates.duration !== undefined) patch.duration = updates.duration;
    if (updates.format !== undefined || updates.workMode !== undefined) patch.format = updates.format ?? updates.workMode;
    if (updates.venue !== undefined || updates.location !== undefined) patch.venue = updates.venue ?? updates.location;
    if (updates.registrationDeadline !== undefined) patch.registration_deadline = updates.registrationDeadline;
    if (updates.registrationUrl !== undefined || updates.registrationLink !== undefined) {
      patch.registration_link = updates.registrationUrl ?? updates.registrationLink;
    }
    if (updates.availability !== undefined) patch.availability = updates.availability;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.fees !== undefined) patch.fees = updates.fees;
    if (updates.capacity !== undefined) {
      const cap = updates.capacity === null || updates.capacity === '' ? 0 : Number(updates.capacity);
      patch.capacity = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
    }
    if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl;
    if (updates.featured !== undefined) patch.featured = Boolean(updates.featured);
    if (updates.skillsCovered !== undefined) patch.skills_covered = updates.skillsCovered;
    if (updates.approvalStatus !== undefined) {
      const status = normalizeWorkshopApprovalStatus(updates.approvalStatus);
      patch.approval_status = status;
      patch.is_approved = status === 'approved';
      if (status !== 'approved') patch.featured = false;
    }

    const row = this.assertOk<any>(
      await this.client.from('workshops').update(patch).eq('id', id).select('*').single(),
      'updateWorkshop'
    );
    return mapWorkshopRow(row);
  }

  public async expirePastWorkshops(): Promise<{ expiredCount: number; expiredIds: string[] }> {
    const all = await this.getWorkshops();
    const expiredIds: string[] = [];
    for (const w of all) {
      if (w.isExpired && w.status !== 'completed') {
        await this.updateWorkshop(w.id, { status: 'completed', availability: 'Closed' });
        expiredIds.push(w.id);
      }
    }
    return { expiredCount: expiredIds.length, expiredIds };
  }

  public async deleteWorkshop(id: string): Promise<boolean> {
    const existing = await this.getWorkshopById(id);
    if (!existing) return false;
    this.assertOk(await this.client.from('workshops').delete().eq('id', id), 'deleteWorkshop');
    return true;
  }

  // -----------------------------------------------------------------------
  // COURSES
  // -----------------------------------------------------------------------

  public async getCourses(filter?: {
    onlyAvailable?: boolean;
    onlyApproved?: boolean;
    approvalStatus?: string;
    category?: string;
    status?: string;
    pricingType?: string;
    providerType?: string;
    includeExpired?: boolean;
    featured?: boolean;
    search?: string;
  }) {
    let query = this.client
      .from('courses')
      .select('*')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (filter?.featured !== undefined) {
      query = query.eq('featured', filter.featured);
    }

    const rows = this.assertOk<any[]>(await query, 'getCourses') || [];
    return rows.map(mapCourseRow).filter((c) => {
      if (filter?.onlyApproved && (!c.isApproved || c.approvalStatus !== 'approved')) return false;
      if (filter?.approvalStatus && filter.approvalStatus !== 'all') {
        if (c.approvalStatus !== normalizeCourseApprovalStatus(filter.approvalStatus)) return false;
      }
      if (filter?.onlyAvailable && c.status !== 'available') return false;
      if (filter?.includeExpired === false && c.isExpired) return false;
      if (filter?.status && filter.status !== 'all' && c.status !== normalizeCourseStatus(filter.status)) return false;
      if (filter?.pricingType && filter.pricingType !== 'all' && c.pricingType !== filter.pricingType.toLowerCase()) return false;
      if (filter?.providerType && filter.providerType !== 'all' && c.providerType !== normalizeCourseProviderType(filter.providerType)) return false;
      if (filter?.category && filter.category !== 'all') {
        if (c.category.toLowerCase() !== filter.category.toLowerCase()) return false;
      }
      if (filter?.search) {
        const term = filter.search.toLowerCase();
        if (![c.name, c.provider, c.instructor, c.category, c.description, ...c.curriculum].join(' ').toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }

  public async getCourseById(id: string) {
    const { data, error } = await this.client.from('courses').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getCourseById failed: ${error.message}`);
    return data ? mapCourseRow(data) : null;
  }

  public async createCourse(input: Record<string, any>) {
    const now = new Date().toISOString();
    const id = input.id || `course-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const expired = isCourseExpired({ registrationDeadline: input.registrationDeadline });
    const normStatus = expired ? 'closed' : normalizeCourseStatus(input.status);
    const certInfo = String(input.certificateInfo || '').trim();
    const fees = String(input.fees ?? input.price ?? '').trim();
    const pricingType = classifyCoursePricing(fees, input.pricingType);
    const providerType = normalizeCourseProviderType(input.providerType);
    const approvalStatus = normalizeCourseApprovalStatus(input.approvalStatus, input.isApproved);
    const isApproved = approvalStatus === 'approved';
    const row = this.assertOk<any>(
      await this.client
        .from('courses')
        .insert({
          id,
          name: input.title || input.name,
          provider: String(input.provider || '').trim(),
          provider_type: providerType,
          description: input.description || '',
          duration: input.duration || '',
          fees,
          pricing_type: pricingType,
          eligibility: input.eligibility || '',
          curriculum: input.curriculum || input.syllabus || [],
          delivery_mode: input.deliveryMode || 'Online (Self-Paced)',
          certificate_info: certInfo,
          registration_deadline: input.registrationDeadline || '',
          registration_link: input.registrationUrl || input.registrationLink,
          availability: expired ? 'Expired' : normStatus === 'closed' ? 'Closed' : input.availability || 'Available',
          status: normStatus,
          approval_status: approvalStatus,
          is_approved: isApproved,
          instructor: String(input.instructor || '').trim(),
          level: input.level || '',
          category: input.category || 'Biotechnology',
          image_url: input.imageUrl || '',
          is_certificate_available: Boolean(certInfo),
          featured: isApproved && Boolean(input.featured),
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createCourse'
    );
    return mapCourseRow(row);
  }

  public async updateCourse(id: string, updates: Record<string, any>) {
    const existing = await this.getCourseById(id);
    if (!existing) return null;

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined || updates.name !== undefined) patch.name = updates.title ?? updates.name;
    if (updates.provider !== undefined) patch.provider = updates.provider;
    if (updates.providerType !== undefined) patch.provider_type = normalizeCourseProviderType(updates.providerType);
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.duration !== undefined) patch.duration = updates.duration;
    if (updates.fees !== undefined || updates.price !== undefined) {
      const nextFees = String(updates.fees ?? updates.price ?? '').trim();
      patch.fees = nextFees;
      patch.pricing_type = classifyCoursePricing(nextFees, updates.pricingType);
    } else if (updates.pricingType !== undefined) {
      patch.pricing_type = classifyCoursePricing(existing.fees, updates.pricingType);
    }
    if (updates.eligibility !== undefined) patch.eligibility = updates.eligibility;
    if (updates.curriculum !== undefined || updates.syllabus !== undefined) {
      patch.curriculum = updates.curriculum ?? updates.syllabus;
    }
    if (updates.deliveryMode !== undefined) patch.delivery_mode = updates.deliveryMode;
    if (updates.certificateInfo !== undefined) {
      patch.certificate_info = String(updates.certificateInfo).trim();
      patch.is_certificate_available = Boolean(patch.certificate_info);
    }
    if (updates.registrationDeadline !== undefined) patch.registration_deadline = updates.registrationDeadline;
    if (updates.registrationUrl !== undefined || updates.registrationLink !== undefined) {
      patch.registration_link = updates.registrationUrl ?? updates.registrationLink;
    }
    if (updates.status !== undefined) {
      const s = normalizeCourseStatus(updates.status);
      patch.status = s;
      patch.availability = s === 'closed' ? 'Closed' : updates.availability || 'Available';
    } else if (updates.availability !== undefined) {
      patch.availability = updates.availability;
    }
    if (updates.approvalStatus !== undefined || updates.isApproved !== undefined) {
      const nextApproval = normalizeCourseApprovalStatus(updates.approvalStatus, updates.isApproved);
      patch.approval_status = nextApproval;
      patch.is_approved = nextApproval === 'approved';
      if (nextApproval !== 'approved') patch.featured = false;
    }
    if (updates.instructor !== undefined) patch.instructor = updates.instructor;
    if (updates.level !== undefined) patch.level = updates.level;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl;
    if (updates.featured !== undefined) patch.featured = Boolean(updates.featured);

    const row = this.assertOk<any>(
      await this.client.from('courses').update(patch).eq('id', id).select('*').single(),
      'updateCourse'
    );
    return mapCourseRow(row);
  }

  public async expirePastCourses(referenceDate: Date = new Date()): Promise<{ expiredCount: number; expiredIds: string[] }> {
    const allCourses = await this.getCourses();
    const expiredIds: string[] = [];
    for (const c of allCourses) {
      if (c.status !== 'closed' && isCourseExpired(c, referenceDate)) {
        await this.client
          .from('courses')
          .update({ status: 'closed', availability: 'Expired', updated_at: referenceDate.toISOString() })
          .eq('id', c.id);
        expiredIds.push(c.id);
      }
    }
    return { expiredCount: expiredIds.length, expiredIds };
  }

  public async getCourseCategories(): Promise<string[]> {
    const saved = await this.getContentRecord<string[]>('course_categories', []);
    const customList = Array.isArray(saved) ? saved : [];
    const seen = new Map<string, string>();
    for (const cat of COURSE_CATEGORIES) {
      seen.set(cat.toLowerCase(), cat);
    }
    for (const cat of customList) {
      const clean = String(cat || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.set(clean.toLowerCase(), clean);
      }
    }
    return Array.from(seen.values());
  }

  public async addCourseCategory(categoryName: string, updatedBy: string = 'admin'): Promise<string[]> {
    const clean = String(categoryName || '').trim();
    const existing = await this.getCourseCategories();
    if (!existing.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      const saved = await this.getContentRecord<string[]>('course_categories', []);
      const customList = Array.isArray(saved) ? saved : [];
      customList.push(clean);
      await this.setContentRecord('course_categories', customList, updatedBy);
    }
    return this.getCourseCategories();
  }

  public async removeCourseCategory(categoryName: string, updatedBy: string = 'admin'): Promise<{ categories: string[]; removed: boolean }> {
    const clean = String(categoryName || '').trim().toLowerCase();
    if (COURSE_CATEGORIES.some((c) => c.toLowerCase() === clean)) {
      return { categories: await this.getCourseCategories(), removed: false };
    }
    const saved = await this.getContentRecord<string[]>('course_categories', []);
    const customList = Array.isArray(saved) ? saved : [];
    const nextList = customList.filter((c) => String(c || '').trim().toLowerCase() !== clean);
    const removed = nextList.length !== customList.length;
    if (removed) {
      await this.setContentRecord('course_categories', nextList, updatedBy);
    }
    return { categories: await this.getCourseCategories(), removed };
  }

  public async deleteCourse(id: string): Promise<boolean> {
    const existing = await this.getCourseById(id);
    if (!existing) return false;
    this.assertOk(await this.client.from('courses').delete().eq('id', id), 'deleteCourse');
    return true;
  }

  // -----------------------------------------------------------------------
  // ANNOUNCEMENTS, CONTENT RECORDS, BACKUPS, SYNC LOGS
  // -----------------------------------------------------------------------

  public async getAnnouncements(onlyActive: boolean = true) {
    let query = this.client
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('date', { ascending: false });
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    const rows = this.assertOk<any[]>(await query, 'getAnnouncements') || [];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tag: r.tag,
      content: r.content || '',
      date: r.date,
      link: r.link || '/opportunities',
      isActive: Boolean(r.is_active),
      active: Boolean(r.is_active),
      priority: Number(r.priority ?? 0),
      createdAt: r.created_at,
    }));
  }

  public async replaceAnnouncements(announcements: Array<{
    id?: string;
    title: string;
    tag: string;
    date?: string;
    link?: string;
    active?: boolean;
    isActive?: boolean;
  }>) {
    const now = new Date().toISOString();
    this.assertOk(await this.client.from('announcements').delete().neq('id', '__keep_none__'), 'clearAnnouncements');
    if (announcements.length === 0) return [];
    const payload = announcements.map((a, idx) => ({
      id: a.id || `ann-${Date.now()}-${idx}`,
      title: a.title,
      tag: a.tag || 'Notice',
      content: '',
      date: a.date || now.split('T')[0],
      link: a.link || '/opportunities',
      is_active: a.active !== undefined ? Boolean(a.active) : a.isActive !== false,
      priority: announcements.length - idx,
      created_at: now,
    }));
    this.assertOk(await this.client.from('announcements').insert(payload), 'insertAnnouncements');
    return this.getAnnouncements(false);
  }

  public async getHomepageHighlights() {
    const { data, error } = await this.client
      .from('content_records')
      .select('value')
      .eq('key', 'homepage_highlights')
      .maybeSingle();
    if (error) throw new Error(`Supabase getHomepageHighlights failed: ${error.message}`);
    return (
      data?.value || {
        heroBadge: 'National Life Sciences Career & Research Gateway',
        bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
        activeVacanciesCount: '23+ Active Biotech Openings',
        participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers',
      }
    );
  }

  public async setHomepageHighlights(highlights: Record<string, any>, updatedBy: string = 'admin') {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client.from('content_records').upsert(
        {
          id: 'content-homepage-highlights',
          key: 'homepage_highlights',
          value: highlights,
          updated_at: now,
          updated_by: updatedBy,
        },
        { onConflict: 'key' }
      ),
      'setHomepageHighlights'
    );
    return highlights;
  }

  public async listBackups() {
    const rows = this.assertOk<any[]>(
      await this.client.from('database_backups').select('*').order('created_at', { ascending: false }).limit(25),
      'listBackups'
    );
    return (rows || []).map((r) => ({
      id: r.id,
      filename: r.filename,
      storageBackend: r.storage_backend || 'supabase-snapshot',
      path: r.path,
      sizeBytes: Number(r.size_bytes ?? 0),
      recordCounts: r.record_counts || {},
      checksumSha256: r.checksum_sha256 || '',
      createdAt: r.created_at,
      status: r.status || 'completed',
    }));
  }

  public async createLogicalBackupSnapshot() {
    const now = new Date().toISOString();
    const [jobs, workshops, courses, announcements, submittedOpportunities] = await Promise.all([
      this.getAllJobsAdmin(),
      this.getWorkshops(),
      this.getCourses(),
      this.getAnnouncements(false),
      this.getSubmittedOpportunities({ onlyApproved: false }),
    ]);

    const snapshotPayload = {
      version: '2026.1-supabase-snapshot',
      createdAt: now,
      tables: { jobs, workshops, courses, announcements, submittedOpportunities },
    };
    const serialized = JSON.stringify(snapshotPayload);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    const checksumSha256 = crypto.createHash('sha256').update(serialized).digest('hex');
    const filename = `bionexa_supabase_snapshot_${now.replace(/[:.]/g, '-')}.json`;
    const recordCounts = {
      jobs: jobs.length,
      workshops: workshops.length,
      courses: courses.length,
      announcements: announcements.length,
      submittedOpportunities: submittedOpportunities.length,
    };

    const row = this.assertOk<any>(
      await this.client
        .from('database_backups')
        .insert({
          id: `bak-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          filename,
          storage_backend: 'supabase-snapshot',
          path: `supabase://database_backups/${filename}`,
          size_bytes: sizeBytes,
          record_counts: recordCounts,
          checksum_sha256: checksumSha256,
          snapshot_data: snapshotPayload,
          status: 'completed',
          created_at: now,
        })
        .select('*')
        .single(),
      'createLogicalBackupSnapshot'
    );

    return {
      success: true,
      id: row.id,
      filename: row.filename,
      path: row.path,
      sizeBytes: row.size_bytes,
      checksumSha256,
      recordCounts,
      createdAt: row.created_at,
      status: row.status,
    };
  }

  public async recordSyncLog(entry: {
    sourceId: string;
    sourceName: string;
    status: string;
    itemsFetched?: number;
    itemsAdded?: number;
    itemsUpdated?: number;
    itemsExpired?: number;
    details?: string;
  }) {
    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('opportunity_sync_logs')
        .insert({
          id: `sync-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          source_id: entry.sourceId,
          source_name: entry.sourceName,
          status: entry.status,
          items_fetched: entry.itemsFetched ?? 0,
          items_added: entry.itemsAdded ?? 0,
          items_updated: entry.itemsUpdated ?? 0,
          items_expired: entry.itemsExpired ?? 0,
          details: entry.details || '',
          created_at: now,
        })
        .select('*')
        .single(),
      'recordSyncLog'
    );
    return row;
  }

  public async getLatestSyncLog() {
    const { data, error } = await this.client
      .from('opportunity_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase getLatestSyncLog failed: ${error.message}`);
    return data || null;
  }

  public async getSyncLogs(limit: number = 50) {
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('opportunity_sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        'getSyncLogs'
      ) || [];
    return rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      status: r.status || 'Success',
      itemsFetched: Number(r.items_fetched ?? 0),
      itemsAdded: Number(r.items_added ?? 0),
      itemsUpdated: Number(r.items_updated ?? 0),
      itemsExpired: Number(r.items_expired ?? 0),
      details: r.details || '',
      createdAt: r.created_at,
    }));
  }

  public async getContentRecord<T = any>(key: string, defaultValue: T = null as any): Promise<T> {
    const { data, error } = await this.client
      .from('content_records')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw new Error(`Supabase getContentRecord(${key}) failed: ${error.message}`);
    return (data?.value ?? defaultValue) as T;
  }

  public async setContentRecord(key: string, value: any, updatedBy: string = 'system'): Promise<void> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client.from('content_records').upsert(
        {
          id: `content-${key}`,
          key,
          value,
          updated_at: now,
          updated_by: updatedBy,
        },
        { onConflict: 'key' }
      ),
      `setContentRecord(${key})`
    );
  }

  public async acquireSyncLock(ownerId: string, ttlMs: number = 5 * 60 * 1000): Promise<boolean> {
    const nowMs = Date.now();
    const existing = await this.getContentRecord<{ ownerId?: string; expiresAtMs?: number } | null>(
      'automated_sync_lock',
      null
    );
    if (existing && existing.ownerId && existing.expiresAtMs && existing.expiresAtMs > nowMs) {
      return false;
    }
    await this.setContentRecord(
      'automated_sync_lock',
      {
        ownerId,
        lockedAt: new Date(nowMs).toISOString(),
        expiresAtMs: nowMs + ttlMs,
      },
      ownerId
    );
    const verify = await this.getContentRecord<{ ownerId?: string } | null>('automated_sync_lock', null);
    return verify?.ownerId === ownerId;
  }

  public async releaseSyncLock(ownerId: string): Promise<void> {
    const existing = await this.getContentRecord<{ ownerId?: string } | null>(
      'automated_sync_lock',
      null
    );
    if (!existing || existing.ownerId === ownerId) {
      await this.setContentRecord(
        'automated_sync_lock',
        { ownerId: '', lockedAt: null, expiresAtMs: 0 },
        ownerId
      ).catch(() => {});
    }
  }

  public async markExpiredListings() {
    const jobs = await this.getAllJobsAdmin();
    let expiredCount = 0;
    for (const job of jobs) {
      if (job.isActive && job.expiryDate && isJobExpiredByDeadline(job.expiryDate, job.verificationStatus)) {
        await this.updateJob(job.id, {
          isActive: false,
          verificationStatus: 'Expired',
          verificationNotes: `Marked expired by deadline scan (${job.expiryDate}).`,
        });
        expiredCount += 1;
      }
    }
    return expiredCount;
  }

  // -----------------------------------------------------------------------
  // SUBMITTED OPPORTUNITIES MODERATION QUEUE
  // -----------------------------------------------------------------------

  public async getSubmittedOpportunities(filter?: { onlyApproved?: boolean; type?: string; search?: string }) {
    let query = this.client.from('submitted_opportunities').select('*').order('created_at', { ascending: false });
    if (filter?.onlyApproved) {
      query = query.eq('is_approved', true);
    }
    if (filter?.type && filter.type !== 'all') {
      query = query.eq('type', filter.type);
    }
    const rows = this.assertOk<any[]>(await query, 'getSubmittedOpportunities') || [];
    return rows.map(mapSubmittedOpportunityRow).filter((opp) => {
      if (!filter?.search) return true;
      const term = filter.search.toLowerCase();
      return [opp.title, opp.organization, opp.description, opp.location, ...opp.skills]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }

  public async getSubmittedOpportunityById(id: string) {
    const { data, error } = await this.client
      .from('submitted_opportunities')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getSubmittedOpportunityById failed: ${error.message}`);
    return data ? mapSubmittedOpportunityRow(data) : null;
  }

  public async createSubmittedOpportunity(input: Record<string, any>) {
    const now = new Date().toISOString();
    const id = input.id || `sub-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const row = this.assertOk<any>(
      await this.client
        .from('submitted_opportunities')
        .insert({
          id,
          title: input.title,
          organization: input.organization,
          type: input.type || 'job',
          sub_category: input.subCategory || '',
          description: input.description || '',
          location: input.location || 'India',
          work_mode: input.workMode || 'On-site',
          experience: input.experience || 'Not Specified',
          qualification: input.qualification || '',
          branches: input.branches || ['Biotechnology'],
          skills: input.skills || [],
          salary_or_stipend: input.salaryOrStipend || 'Not Disclosed',
          salary_tier: input.salaryTier || 'not_disclosed',
          deadline: input.deadline || '',
          posted_date: input.postedDate || now.split('T')[0],
          source_name: input.sourceName || 'Direct Employer / Organizer Submission',
          source_url: input.sourceUrl || input.applicationUrl,
          application_url: input.applicationUrl,
          contact_email: input.contactEmail || '',
          status: 'Pending Verification',
          is_approved: false,
          workshop_details: input.workshopDetails || null,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createSubmittedOpportunity'
    );
    return mapSubmittedOpportunityRow(row);
  }

  public async updateSubmittedOpportunity(id: string, updates: Record<string, any>) {
    const existing = await this.getSubmittedOpportunityById(id);
    if (!existing) return null;
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.organization !== undefined) patch.organization = updates.organization;
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.subCategory !== undefined) patch.sub_category = updates.subCategory;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.workMode !== undefined) patch.work_mode = updates.workMode;
    if (updates.experience !== undefined) patch.experience = updates.experience;
    if (updates.qualification !== undefined) patch.qualification = updates.qualification;
    if (Array.isArray(updates.branches)) patch.branches = updates.branches;
    if (Array.isArray(updates.skills)) patch.skills = updates.skills;
    if (updates.salaryOrStipend !== undefined) patch.salary_or_stipend = updates.salaryOrStipend;
    if (updates.deadline !== undefined) patch.deadline = updates.deadline;
    if (updates.sourceName !== undefined) patch.source_name = updates.sourceName;
    if (updates.sourceUrl !== undefined) patch.source_url = updates.sourceUrl;
    if (updates.applicationUrl !== undefined) patch.application_url = updates.applicationUrl;
    if (updates.contactEmail !== undefined) patch.contact_email = updates.contactEmail;
    if (updates.isApproved !== undefined) patch.is_approved = Boolean(updates.isApproved);
    if (updates.status !== undefined) patch.status = updates.status;

    const row = this.assertOk<any>(
      await this.client.from('submitted_opportunities').update(patch).eq('id', id).select('*').single(),
      'updateSubmittedOpportunity'
    );
    return mapSubmittedOpportunityRow(row);
  }

  public async deleteSubmittedOpportunity(id: string): Promise<boolean> {
    const existing = await this.getSubmittedOpportunityById(id);
    if (!existing) return false;
    this.assertOk(await this.client.from('submitted_opportunities').delete().eq('id', id), 'deleteSubmittedOpportunity');
    return true;
  }

  // -----------------------------------------------------------------------
  // COMPLIANCE, CONTACT, NEWSLETTER, CERTIFICATES, APPLICATIONS, COMMUNITY
  // -----------------------------------------------------------------------

  public async createComplianceRequest(input: {
    requestType: string;
    subCategory: string;
    requesterName: string;
    requesterEmail: string;
    organization?: string;
    targetTitleOrUrl?: string;
    details: string;
    consentAccepted: boolean;
  }) {
    const now = new Date().toISOString();
    const id = `cmp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const referenceId = `BN-CMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const row = this.assertOk<any>(
      await this.client
        .from('compliance_requests')
        .insert({
          id,
          reference_id: referenceId,
          request_type: input.requestType,
          sub_category: input.subCategory,
          requester_name: input.requesterName,
          requester_email: input.requesterEmail,
          organization: input.organization || '',
          target_title_or_url: input.targetTitleOrUrl || '',
          details: input.details,
          consent_accepted: Boolean(input.consentAccepted),
          status: 'Pending',
          resolution_notes: '',
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createComplianceRequest'
    );
    return mapComplianceRow(row);
  }

  public async getComplianceRequests(filter?: { requestType?: string; status?: string }) {
    let query = this.client.from('compliance_requests').select('*').order('created_at', { ascending: false });
    if (filter?.requestType && filter.requestType !== 'all') {
      query = query.eq('request_type', filter.requestType);
    }
    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    const rows = this.assertOk<any[]>(await query, 'getComplianceRequests') || [];
    return rows.map(mapComplianceRow);
  }

  public async updateComplianceRequest(id: string, status: string, resolutionNotes?: string) {
    const { data: existing, error } = await this.client.from('compliance_requests').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase fetch compliance failed: ${error.message}`);
    if (!existing) return null;

    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (resolutionNotes !== undefined) patch.resolution_notes = resolutionNotes;

    const row = this.assertOk<any>(
      await this.client.from('compliance_requests').update(patch).eq('id', id).select('*').single(),
      'updateComplianceRequest'
    );
    return mapComplianceRow(row);
  }

  public async deleteComplianceRequest(id: string): Promise<boolean> {
    const { data: existing, error } = await this.client.from('compliance_requests').select('id').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase fetch compliance failed: ${error.message}`);
    if (!existing) return false;
    this.assertOk(await this.client.from('compliance_requests').delete().eq('id', id), 'deleteComplianceRequest');
    return true;
  }

  public async createContactMessage(input: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const now = new Date().toISOString();
    const id = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const referenceId = `BN-MSG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const row = this.assertOk<any>(
      await this.client
        .from('contact_messages')
        .insert({
          id,
          reference_id: referenceId,
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
          status: 'New',
          created_at: now,
        })
        .select('*')
        .single(),
      'createContactMessage'
    );
    return {
      id: row.id,
      referenceId: row.reference_id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  public async getContactMessages() {
    const rows = this.assertOk<any[]>(
      await this.client.from('contact_messages').select('*').order('created_at', { ascending: false }),
      'getContactMessages'
    );
    return (rows || []).map((row) => ({
      id: row.id,
      referenceId: row.reference_id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  public async subscribeNewsletter(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const { data: existing, error } = await this.client
      .from('newsletter_subscribers')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(`Supabase newsletter check failed: ${error.message}`);

    if (existing) {
      if (!existing.is_active) {
        await this.client.from('newsletter_subscribers').update({ is_active: true }).eq('id', existing.id);
      }
      return {
        alreadySubscribed: Boolean(existing.is_active),
        subscriber: {
          id: existing.id,
          email: existing.email,
          subscribedAt: existing.subscribed_at,
          isActive: true,
        },
      };
    }

    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('newsletter_subscribers')
        .insert({
          id: `sub-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          email,
          subscribed_at: now,
          is_active: true,
        })
        .select('*')
        .single(),
      'subscribeNewsletter'
    );
    return {
      alreadySubscribed: false,
      subscriber: {
        id: row.id,
        email: row.email,
        subscribedAt: row.subscribed_at,
        isActive: Boolean(row.is_active),
      },
    };
  }

  public async verifyCertificate(certificateNumber: string) {
    const clean = certificateNumber.trim().toUpperCase();
    const { data, error } = await this.client
      .from('certificates')
      .select('*')
      .ilike('certificate_number', clean)
      .maybeSingle();
    if (error) throw new Error(`Supabase verifyCertificate failed: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      certificateNumber: data.certificate_number,
      recipientName: data.recipient_name,
      courseTitle: data.course_title,
      issueDate: data.issue_date,
      score: Number(data.score),
      verificationCode: data.verification_code,
    };
  }

  public async createCertificate(input: {
    certificateNumber?: string;
    recipientName: string;
    courseTitle: string;
    issueDate?: string;
    score: number;
    verificationCode?: string;
  }) {
    const now = new Date().toISOString();
    const certNo = (input.certificateNumber || `BN-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim();
    const existing = await this.verifyCertificate(certNo);
    if (existing) return existing;

    const row = this.assertOk<any>(
      await this.client
        .from('certificates')
        .insert({
          id: `cert-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          certificate_number: certNo,
          recipient_name: input.recipientName.trim(),
          course_title: input.courseTitle.trim(),
          issue_date: input.issueDate || now.split('T')[0],
          score: Number(input.score),
          verification_code: input.verificationCode || `VER-${certNo}`,
          created_at: now,
        })
        .select('*')
        .single(),
      'createCertificate'
    );
    return {
      id: row.id,
      certificateNumber: row.certificate_number,
      recipientName: row.recipient_name,
      courseTitle: row.course_title,
      issueDate: row.issue_date,
      score: Number(row.score),
      verificationCode: row.verification_code,
    };
  }

  public async getJobApplications() {
    const rows = this.assertOk<any[]>(
      await this.client.from('job_applications').select('*').order('created_at', { ascending: false }),
      'getJobApplications'
    );
    return (rows || []).map((r) => ({
      id: r.id,
      jobId: r.job_id || '',
      jobTitle: r.job_title,
      company: r.company,
      applicantName: r.applicant_name,
      applicantEmail: r.applicant_email,
      phone: r.phone || '',
      qualification: r.qualification || '',
      experienceYears: r.experience_years || '',
      coverNote: r.cover_note || '',
      appliedDate: r.applied_date,
      status: r.status,
    }));
  }

  public async createJobApplication(input: Record<string, any>) {
    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('job_applications')
        .insert({
          id: `app-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          job_id: input.jobId || null,
          job_title: input.jobTitle,
          company: input.company,
          applicant_name: input.applicantName,
          applicant_email: input.applicantEmail,
          phone: input.phone || '',
          qualification: input.qualification || '',
          experience_years: input.experienceYears || '',
          cover_note: input.coverNote || '',
          applied_date: input.appliedDate || now.split('T')[0],
          application_channel: 'bioinexa_direct',
          status: 'Under Review',
          created_at: now,
        })
        .select('*')
        .single(),
      'createJobApplication'
    );
    return {
      id: row.id,
      jobId: row.job_id || '',
      jobTitle: row.job_title,
      company: row.company,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      phone: row.phone || '',
      qualification: row.qualification || '',
      experienceYears: row.experience_years || '',
      coverNote: row.cover_note || '',
      appliedDate: row.applied_date,
      status: row.status,
    };
  }

  public async updateJobApplicationStatus(id: string, status: string) {
    const { data: existing, error } = await this.client.from('job_applications').select('id').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase fetch application failed: ${error.message}`);
    if (!existing) return null;

    const row = this.assertOk<any>(
      await this.client.from('job_applications').update({ status }).eq('id', id).select('*').single(),
      'updateJobApplicationStatus'
    );
    return {
      id: row.id,
      jobId: row.job_id || '',
      jobTitle: row.job_title,
      company: row.company,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      phone: row.phone || '',
      qualification: row.qualification || '',
      experienceYears: row.experience_years || '',
      coverNote: row.cover_note || '',
      appliedDate: row.applied_date,
      status: row.status,
    };
  }

  public async getDiscussions(category?: string) {
    let topicQuery = this.client.from('discussions').select('*').order('created_at', { ascending: false });
    if (category && category !== 'all') {
      topicQuery = topicQuery.eq('category', category);
    }
    const topics = this.assertOk<any[]>(await topicQuery, 'getDiscussions') || [];
    const replies =
      this.assertOk<any[]>(
        await this.client.from('discussion_replies').select('*').order('created_at', { ascending: true }),
        'getDiscussionReplies'
      ) || [];

    const replyMap = new Map<string, any[]>();
    for (const r of replies) {
      const list = replyMap.get(r.topic_id) || [];
      list.push({
        id: r.id,
        authorName: r.author_name,
        authorRole: r.author_role || 'BIO-INEXA Member',
        content: r.content,
        createdAt: r.created_at,
        upvotes: Number(r.upvotes ?? 0),
      });
      replyMap.set(r.topic_id, list);
    }

    return topics.map((t) => ({
      id: t.id,
      title: t.title,
      authorName: t.author_name,
      authorRole: t.author_role || 'BIO-INEXA Member',
      category: t.category,
      content: t.content,
      createdAt: t.created_at,
      upvotes: Number(t.upvotes ?? 1),
      replies: replyMap.get(t.id) || [],
    }));
  }

  public async createDiscussion(input: {
    title: string;
    authorName: string;
    authorRole?: string;
    category: string;
    content: string;
  }) {
    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('discussions')
        .insert({
          id: `disc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          title: input.title,
          author_name: input.authorName,
          author_role: input.authorRole || 'BIO-INEXA Member',
          category: input.category,
          content: input.content,
          upvotes: 1,
          created_at: now,
        })
        .select('*')
        .single(),
      'createDiscussion'
    );
    return {
      id: row.id,
      title: row.title,
      authorName: row.author_name,
      authorRole: row.author_role,
      category: row.category,
      content: row.content,
      createdAt: row.created_at,
      upvotes: Number(row.upvotes ?? 1),
      replies: [],
    };
  }

  public async addDiscussionReply(
    topicId: string,
    input: { authorName: string; authorRole?: string; content: string }
  ) {
    const { data: topic, error } = await this.client.from('discussions').select('id').eq('id', topicId).maybeSingle();
    if (error) throw new Error(`Supabase fetch topic failed: ${error.message}`);
    if (!topic) return null;

    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('discussion_replies')
        .insert({
          id: `rep-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          topic_id: topicId,
          author_name: input.authorName,
          author_role: input.authorRole || 'BIO-INEXA Member',
          content: input.content,
          upvotes: 0,
          created_at: now,
        })
        .select('*')
        .single(),
      'addDiscussionReply'
    );
    return {
      id: row.id,
      authorName: row.author_name,
      authorRole: row.author_role,
      content: row.content,
      createdAt: row.created_at,
      upvotes: Number(row.upvotes ?? 0),
    };
  }

  public async upvoteDiscussion(topicId: string) {
    const { data: topic, error } = await this.client.from('discussions').select('*').eq('id', topicId).maybeSingle();
    if (error) throw new Error(`Supabase fetch topic failed: ${error.message}`);
    if (!topic) return null;

    const updated = this.assertOk<any>(
      await this.client
        .from('discussions')
        .update({ upvotes: Number(topic.upvotes ?? 1) + 1 })
        .eq('id', topicId)
        .select('*')
        .single(),
      'upvoteDiscussion'
    );
    const replies =
      this.assertOk<any[]>(
        await this.client
          .from('discussion_replies')
          .select('*')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true }),
        'getRepliesForTopic'
      ) || [];

    return {
      id: updated.id,
      title: updated.title,
      authorName: updated.author_name,
      authorRole: updated.author_role,
      category: updated.category,
      content: updated.content,
      createdAt: updated.created_at,
      upvotes: Number(updated.upvotes ?? 1),
      replies: replies.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        authorRole: r.author_role,
        content: r.content,
        createdAt: r.created_at,
        upvotes: Number(r.upvotes ?? 0),
      })),
    };
  }

  // ==========================================
  // ADMIN USERS, SESSIONS, AUDIT LOGS & AUTH SECURITY (PHASE 05)
  // ==========================================

  public async upsertAdminUser(input: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    passwordHash?: string;
  }) {
    const now = new Date().toISOString();
    const { data: existing } = await this.client
      .from('admin_users')
      .select('id, username, email, display_name, role, password_hash')
      .eq('username', input.username)
      .maybeSingle();

    if (existing) {
      const updated = this.assertOk<any>(
        await this.client
          .from('admin_users')
          .update({
            email: input.email,
            display_name: input.displayName,
            role: input.role,
            ...(input.passwordHash ? { password_hash: input.passwordHash } : {}),
            updated_at: now,
          })
          .eq('id', existing.id)
          .select('*')
          .single(),
        'updateAdminUser'
      );
      return updated;
    }

    return this.assertOk<any>(
      await this.client
        .from('admin_users')
        .insert({
          id: input.id,
          username: input.username,
          email: input.email,
          display_name: input.displayName,
          role: input.role,
          password_hash: input.passwordHash || '',
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'insertAdminUser'
    );
  }

  public async getAdminUserByUsername(usernameOrEmail: string) {
    const clean = usernameOrEmail.trim();
    const { data, error } = await this.client
      .from('admin_users')
      .select('*')
      .eq('is_active', true)
      .or(`username.ilike.${clean},email.ilike.${clean}`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase fetch admin user failed: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      displayName: data.display_name,
      role: data.role,
      passwordHash: data.password_hash || '',
      totpSecret: data.totp_secret || '',
      totpEnabled: Boolean(data.totp_enabled),
      isActive: Boolean(data.is_active),
    };
  }

  public async updateAdminPasswordHash(adminUserId: string, newPasswordHash: string): Promise<boolean> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('admin_users')
      .update({
        password_hash: newPasswordHash,
        password_updated_at: now,
        updated_at: now,
      })
      .eq('id', adminUserId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Supabase update admin password failed: ${error.message}`);
    return Boolean(data);
  }

  public async createAdminSession(input: {
    jti: string;
    adminUserId?: string;
    actorUsername: string;
    role: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAtMs: number;
  }) {
    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('admin_sessions')
        .upsert(
          {
            jti: input.jti,
            admin_user_id: input.adminUserId || null,
            actor_username: input.actorUsername,
            role: input.role,
            ip_address: input.ipAddress || '',
            user_agent: input.userAgent || '',
            expires_at: new Date(input.expiresAtMs).toISOString(),
            revoked_at: null,
            last_active_at: now,
            created_at: now,
          },
          { onConflict: 'jti' }
        )
        .select('*')
        .single(),
      'createAdminSession'
    );
    return row;
  }

  public async isAdminSessionRevoked(jti: string): Promise<boolean> {
    if (!jti) return true;
    const { data, error } = await this.client
      .from('admin_sessions')
      .select('jti, revoked_at, expires_at')
      .eq('jti', jti)
      .maybeSingle();
    if (error) throw new Error(`Supabase session check failed: ${error.message}`);
    if (!data) return false; // Allow signed token issued before session sync if not explicitly revoked
    if (data.revoked_at) return true;
    if (data.expires_at && Date.now() > Date.parse(data.expires_at)) return true;
    return false;
  }

  public async revokeAdminSession(jti: string): Promise<boolean> {
    if (!jti) return false;
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('admin_sessions')
      .upsert(
        {
          jti,
          actor_username: 'revoked',
          role: 'super_admin',
          expires_at: now,
          revoked_at: now,
          last_active_at: now,
        },
        { onConflict: 'jti' }
      )
      .select('jti')
      .maybeSingle();
    if (error) throw new Error(`Supabase revoke session failed: ${error.message}`);
    return Boolean(data);
  }

  public async revokeAllAdminSessions(actorUsername: string, exceptJti?: string): Promise<number> {
    const now = new Date().toISOString();
    let query = this.client
      .from('admin_sessions')
      .update({ revoked_at: now })
      .eq('actor_username', actorUsername)
      .is('revoked_at', null);
    if (exceptJti) {
      query = query.neq('jti', exceptJti);
    }
    const { data, error } = await query.select('jti');
    if (error) throw new Error(`Supabase revoke all sessions failed: ${error.message}`);
    return Array.isArray(data) ? data.length : 0;
  }

  public async listActiveAdminSessions() {
    const now = new Date().toISOString();
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('admin_sessions')
          .select('jti, admin_user_id, actor_username, role, ip_address, user_agent, expires_at, last_active_at, created_at')
          .is('revoked_at', null)
          .gt('expires_at', now)
          .order('last_active_at', { ascending: false }),
        'listActiveAdminSessions'
      ) || [];
    return rows.map((r) => ({
      jti: r.jti,
      adminUserId: r.admin_user_id || '',
      actorUsername: r.actor_username,
      role: r.role,
      ipAddress: r.ip_address || '',
      userAgent: r.user_agent || '',
      expiresAt: r.expires_at,
      lastActiveAt: r.last_active_at,
      createdAt: r.created_at,
    }));
  }

  public async recordLoginAttempt(input: {
    identifier: string;
    ipAddress?: string;
    attemptedUsername: string;
    success: boolean;
    failureReason?: string;
    lockedUntilIso?: string | null;
  }) {
    const row = this.assertOk<any>(
      await this.client
        .from('admin_login_attempts')
        .insert({
          id: `lgn-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          identifier: input.identifier,
          ip_address: input.ipAddress || '',
          attempted_username: input.attemptedUsername,
          success: input.success,
          failure_reason: input.failureReason || '',
          locked_until: input.lockedUntilIso || null,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'recordLoginAttempt'
    );
    return row;
  }

  public async getRecentLoginAttempts(limit: number = 50) {
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('admin_login_attempts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        'getRecentLoginAttempts'
      ) || [];
    return rows.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      ipAddress: r.ip_address || '',
      attemptedUsername: r.attempted_username || '',
      success: Boolean(r.success),
      failureReason: r.failure_reason || '',
      lockedUntil: r.locked_until || '',
      createdAt: r.created_at,
    }));
  }

  public async recordAdminAuditLog(input: {
    adminUserId?: string;
    actorUsername: string;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    details?: Record<string, unknown>;
  }) {
    const row = this.assertOk<any>(
      await this.client
        .from('admin_audit_logs')
        .insert({
          id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          admin_user_id: input.adminUserId || null,
          actor_username: input.actorUsername,
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId || '',
          ip_address: input.ipAddress || '',
          details: input.details || {},
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'recordAdminAuditLog'
    );
    return row;
  }

  public async getAdminAuditLogs(limit: number = 100) {
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('admin_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        'getAdminAuditLogs'
      ) || [];
    return rows.map((r) => ({
      id: r.id,
      adminUserId: r.admin_user_id || '',
      actorUsername: r.actor_username,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id || '',
      ipAddress: r.ip_address || '',
      details: r.details || {},
      createdAt: r.created_at,
    }));
  }

  public async createPasswordResetRecord(input: {
    adminUserId?: string;
    actorUsername: string;
    tokenHash: string;
    expiresAtIso: string;
  }) {
    return this.assertOk<any>(
      await this.client
        .from('admin_password_resets')
        .insert({
          id: `rst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          admin_user_id: input.adminUserId || null,
          actor_username: input.actorUsername,
          token_hash: input.tokenHash,
          expires_at: input.expiresAtIso,
          used_at: null,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'createPasswordResetRecord'
    );
  }

  public async consumePasswordResetToken(tokenHash: string, newPasswordHash: string, nowMs: number = Date.now()) {
    const { data: row, error } = await this.client
      .from('admin_password_resets')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw new Error(`Supabase fetch reset token failed: ${error.message}`);
    if (!row) return { ok: false, error: 'Invalid password reset token.' };
    if (row.used_at) return { ok: false, error: 'Password reset token has already been used.' };
    if (nowMs > Date.parse(row.expires_at)) return { ok: false, error: 'Password reset token has expired.' };

    const nowIso = new Date(nowMs).toISOString();
    await this.client.from('admin_password_resets').update({ used_at: nowIso }).eq('id', row.id);
    if (row.admin_user_id) {
      await this.updateAdminPasswordHash(row.admin_user_id, newPasswordHash);
    }
    await this.revokeAllAdminSessions(row.actor_username);
    return {
      ok: true,
      adminUserId: row.admin_user_id || '',
      actorUsername: row.actor_username,
    };
  }

  // -----------------------------------------------------------------------
  // PHASE 14: STUDENT ACCOUNTS, SESSIONS & DELETION REQUESTS
  // -----------------------------------------------------------------------

  private mapStudentAccount(r: any): DbStudentAccount {
    let skills: string[] = [];
    if (Array.isArray(r.skills)) {
      skills = r.skills.map((s: any) => String(s));
    } else if (typeof r.skills === 'string') {
      try {
        const parsed = JSON.parse(r.skills);
        if (Array.isArray(parsed)) skills = parsed.map((s: any) => String(s));
      } catch {
        skills = [];
      }
    }
    const statusRaw = String(r.account_status || 'active');
    const accountStatus: StudentAccountStatus =
      statusRaw === 'deletion_pending' || statusRaw === 'suspended' ? statusRaw : 'active';

    return {
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      fullName: r.full_name,
      role: 'student',
      degreeTitle: r.degree_title || '',
      institution: r.institution || '',
      specialization: r.specialization || '',
      graduationYear: r.graduation_year || '',
      location: r.location || '',
      skills,
      bio: r.bio || '',
      linkedinUrl: r.linkedin_url || '',
      orcidId: r.orcid_id || '',
      profileVisibility: 'private',
      emailVerified: Boolean(r.email_verified),
      emailVerifiedAt: r.email_verified_at || null,
      verificationTokenHash: r.verification_token_hash || null,
      verificationExpiresAt: r.verification_expires_at || null,
      resetTokenHash: r.reset_token_hash || null,
      resetExpiresAt: r.reset_expires_at || null,
      privacyConsentAt: r.privacy_consent_at,
      accountStatus,
      deletionRequestedAt: r.deletion_requested_at || null,
      deletionReason: r.deletion_reason || null,
      lastLoginAt: r.last_login_at || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getStudentByEmail(email: string): Promise<DbStudentAccount | null> {
    const clean = normalizeStudentEmail(email);
    if (!clean) return null;
    const { data, error } = await this.client
      .from('student_accounts')
      .select('*')
      .ilike('email', clean)
      .maybeSingle();
    if (error) throw new Error(`Supabase getStudentByEmail failed: ${error.message}`);
    return data ? this.mapStudentAccount(data) : null;
  }

  public async getStudentById(id: string): Promise<DbStudentAccount | null> {
    if (!id) return null;
    const { data, error } = await this.client
      .from('student_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getStudentById failed: ${error.message}`);
    return data ? this.mapStudentAccount(data) : null;
  }

  public async createStudentAccount(input: {
    id?: string;
    email: string;
    passwordHash: string;
    fullName: string;
    degreeTitle?: string;
    institution?: string;
    specialization?: string;
    graduationYear?: string;
    verificationTokenHash: string;
    verificationExpiresAt: string;
    privacyConsentAt?: string;
  }): Promise<DbStudentAccount> {
    const cleanEmail = normalizeStudentEmail(input.email);
    const existing = await this.getStudentByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }
    const now = new Date().toISOString();
    const id = input.id || `stu-${crypto.randomBytes(8).toString('hex')}`;
    const row = this.assertOk<any>(
      await this.client
        .from('student_accounts')
        .insert({
          id,
          email: cleanEmail,
          password_hash: input.passwordHash,
          full_name: input.fullName,
          role: 'student',
          degree_title: input.degreeTitle || '',
          institution: input.institution || '',
          specialization: input.specialization || '',
          graduation_year: input.graduationYear || '',
          location: '',
          skills: [],
          bio: '',
          linkedin_url: '',
          orcid_id: '',
          profile_visibility: 'private',
          email_verified: false,
          email_verified_at: null,
          verification_token_hash: input.verificationTokenHash,
          verification_expires_at: input.verificationExpiresAt,
          privacy_consent_at: input.privacyConsentAt || now,
          account_status: 'active',
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createStudentAccount'
    );
    return this.mapStudentAccount(row);
  }

  public async updateStudentLastLogin(studentId: string): Promise<void> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client
        .from('student_accounts')
        .update({ last_login_at: now, updated_at: now })
        .eq('id', studentId),
      'updateStudentLastLogin'
    );
  }

  public async updateStudentProfile(
    studentId: string,
    updates: {
      fullName?: string;
      degreeTitle?: string;
      institution?: string;
      specialization?: string;
      graduationYear?: string;
      location?: string;
      skills?: string[];
      bio?: string;
      linkedinUrl?: string;
      orcidId?: string;
    }
  ): Promise<DbStudentAccount | null> {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.fullName !== undefined) patch.full_name = updates.fullName;
    if (updates.degreeTitle !== undefined) patch.degree_title = updates.degreeTitle;
    if (updates.institution !== undefined) patch.institution = updates.institution;
    if (updates.specialization !== undefined) patch.specialization = updates.specialization;
    if (updates.graduationYear !== undefined) patch.graduation_year = updates.graduationYear;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.skills !== undefined) patch.skills = updates.skills;
    if (updates.bio !== undefined) patch.bio = updates.bio;
    if (updates.linkedinUrl !== undefined) patch.linkedin_url = updates.linkedinUrl;
    if (updates.orcidId !== undefined) patch.orcid_id = updates.orcidId;

    const { data, error } = await this.client
      .from('student_accounts')
      .update(patch)
      .eq('id', studentId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase updateStudentProfile failed: ${error.message}`);
    return data ? this.mapStudentAccount(data) : null;
  }

  public async setStudentVerificationToken(
    studentId: string,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client
        .from('student_accounts')
        .update({
          verification_token_hash: tokenHash,
          verification_expires_at: expiresAtIso,
          updated_at: now,
        })
        .eq('id', studentId),
      'setStudentVerificationToken'
    );
    return true;
  }

  public async verifyStudentEmailByToken(rawToken: string, now: Date = new Date()): Promise<DbStudentAccount | null> {
    const tokenHash = hashOpaqueToken(rawToken);
    if (!tokenHash) return null;
    const { data: row, error } = await this.client
      .from('student_accounts')
      .select('*')
      .eq('verification_token_hash', tokenHash)
      .maybeSingle();
    if (error) throw new Error(`Supabase verifyStudentEmailByToken failed: ${error.message}`);
    if (!row) return null;

    const account = this.mapStudentAccount(row);
    if (account.verificationExpiresAt && new Date(account.verificationExpiresAt).getTime() < now.getTime()) {
      return null;
    }

    const nowIso = now.toISOString();
    const updated = this.assertOk<any>(
      await this.client
        .from('student_accounts')
        .update({
          email_verified: true,
          email_verified_at: nowIso,
          verification_token_hash: null,
          verification_expires_at: null,
          updated_at: nowIso,
        })
        .eq('id', account.id)
        .select('*')
        .single(),
      'verifyStudentEmailUpdate'
    );
    return this.mapStudentAccount(updated);
  }

  public async setStudentPasswordResetToken(
    studentId: string,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client
        .from('student_accounts')
        .update({
          reset_token_hash: tokenHash,
          reset_expires_at: expiresAtIso,
          updated_at: now,
        })
        .eq('id', studentId),
      'setStudentPasswordResetToken'
    );
    return true;
  }

  public async consumeStudentPasswordResetToken(
    rawToken: string,
    newPasswordHash: string,
    now: Date = new Date()
  ): Promise<DbStudentAccount | null> {
    const tokenHash = hashOpaqueToken(rawToken);
    if (!tokenHash) return null;
    const { data: row, error } = await this.client
      .from('student_accounts')
      .select('*')
      .eq('reset_token_hash', tokenHash)
      .maybeSingle();
    if (error) throw new Error(`Supabase consumeStudentPasswordResetToken failed: ${error.message}`);
    if (!row) return null;

    const account = this.mapStudentAccount(row);
    if (!account.resetExpiresAt || new Date(account.resetExpiresAt).getTime() < now.getTime()) {
      return null;
    }

    const nowIso = now.toISOString();
    const updated = this.assertOk<any>(
      await this.client
        .from('student_accounts')
        .update({
          password_hash: newPasswordHash,
          reset_token_hash: null,
          reset_expires_at: null,
          updated_at: nowIso,
        })
        .eq('id', account.id)
        .select('*')
        .single(),
      'consumeStudentPasswordResetUpdate'
    );
    await this.revokeAllStudentSessions(account.id);
    return this.mapStudentAccount(updated);
  }

  public async updateStudentPasswordHash(studentId: string, newPasswordHash: string): Promise<boolean> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client
        .from('student_accounts')
        .update({
          password_hash: newPasswordHash,
          reset_token_hash: null,
          reset_expires_at: null,
          updated_at: now,
        })
        .eq('id', studentId),
      'updateStudentPasswordHash'
    );
    return true;
  }

  public async createStudentSession(input: {
    jti: string;
    studentId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddressMasked?: string;
    expiresAt: string;
  }): Promise<DbStudentSession> {
    const now = new Date().toISOString();
    this.assertOk(
      await this.client.from('student_sessions').insert({
        jti: input.jti,
        student_id: input.studentId,
        token_hash: input.tokenHash,
        user_agent: (input.userAgent || '').slice(0, 220),
        ip_address_masked: input.ipAddressMasked || 'unknown',
        created_at: now,
        last_active_at: now,
        expires_at: input.expiresAt,
        revoked_at: null,
      }),
      'createStudentSession'
    );
    return {
      jti: input.jti,
      studentId: input.studentId,
      tokenHash: input.tokenHash,
      userAgent: (input.userAgent || '').slice(0, 220),
      ipAddressMasked: input.ipAddressMasked || 'unknown',
      createdAt: now,
      lastActiveAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
  }

  public async validateStudentSessionToken(
    rawToken: string,
    now: Date = new Date()
  ): Promise<{ session: DbStudentSession; student: DbStudentAccount } | null> {
    if (!rawToken || rawToken.length < 16) return null;
    const tokenHash = hashOpaqueToken(rawToken);
    const { data: row, error } = await this.client
      .from('student_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();
    if (error) throw new Error(`Supabase validateStudentSessionToken failed: ${error.message}`);
    if (!row) return null;

    const expiresMs = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) {
      await this.revokeStudentSessionByJti(row.jti);
      return null;
    }

    const student = await this.getStudentById(row.student_id);
    if (!student || student.accountStatus === 'suspended') {
      return null;
    }

    const nowIso = now.toISOString();
    await this.client.from('student_sessions').update({ last_active_at: nowIso }).eq('jti', row.jti);

    return {
      session: {
        jti: row.jti,
        studentId: row.student_id,
        tokenHash: row.token_hash,
        userAgent: row.user_agent || '',
        ipAddressMasked: row.ip_address_masked || 'unknown',
        createdAt: row.created_at,
        lastActiveAt: nowIso,
        expiresAt: row.expires_at,
        revokedAt: null,
      },
      student,
    };
  }

  public async listStudentSessions(studentId: string, currentJti?: string): Promise<SafeStudentSession[]> {
    const nowIso = new Date().toISOString();
    const rows =
      this.assertOk<any[]>(
        await this.client
          .from('student_sessions')
          .select('jti, user_agent, ip_address_masked, created_at, last_active_at, expires_at')
          .eq('student_id', studentId)
          .is('revoked_at', null)
          .gt('expires_at', nowIso)
          .order('last_active_at', { ascending: false }),
        'listStudentSessions'
      ) || [];

    return rows.map((r) => ({
      jti: r.jti,
      userAgent: r.user_agent || 'Web Browser',
      ipAddressMasked: r.ip_address_masked || 'unknown',
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      expiresAt: r.expires_at,
      isCurrent: Boolean(currentJti && r.jti === currentJti),
    }));
  }

  public async revokeStudentSessionByJti(jti: string, studentId?: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    let query = this.client
      .from('student_sessions')
      .update({ revoked_at: nowIso })
      .eq('jti', jti)
      .is('revoked_at', null);
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    const { data, error } = await query.select('jti');
    if (error) throw new Error(`Supabase revokeStudentSessionByJti failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  public async revokeAllStudentSessions(studentId: string, exceptJti?: string): Promise<number> {
    const nowIso = new Date().toISOString();
    let query = this.client
      .from('student_sessions')
      .update({ revoked_at: nowIso })
      .eq('student_id', studentId)
      .is('revoked_at', null);
    if (exceptJti) {
      query = query.neq('jti', exceptJti);
    }
    const { data, error } = await query.select('jti');
    if (error) throw new Error(`Supabase revokeAllStudentSessions failed: ${error.message}`);
    return Array.isArray(data) ? data.length : 0;
  }

  public async createStudentDeletionRequest(
    studentId: string,
    reason: string,
    mode: 'request' | 'delete_now' = 'request'
  ): Promise<{ request: StudentDeletionRequestRecord; deletedImmediately: boolean }> {
    const account = await this.getStudentById(studentId);
    if (!account) {
      throw new Error('Student account not found.');
    }

    const nowIso = new Date().toISOString();
    const reqId = `del-stu-${crypto.randomBytes(6).toString('hex')}`;
    const emailHash = hashEmailForAudit(account.email);

    if (mode === 'delete_now') {
      this.assertOk(
        await this.client.from('student_deletion_requests').insert({
          id: reqId,
          student_id: studentId,
          email_hash: emailHash,
          reason: reason || 'Self-service immediate erasure',
          status: 'completed',
          requested_at: nowIso,
          processed_at: nowIso,
        }),
        'createImmediateDeletionRecord'
      );
      await this.revokeAllStudentSessions(studentId);
      this.assertOk(
        await this.client.from('student_accounts').delete().eq('id', studentId),
        'deleteStudentAccountImmediate'
      );
      return {
        request: {
          id: reqId,
          studentId,
          emailHash,
          reason: reason || 'Self-service immediate erasure',
          status: 'completed',
          requestedAt: nowIso,
          processedAt: nowIso,
        },
        deletedImmediately: true,
      };
    }

    await this.client
      .from('student_deletion_requests')
      .update({ status: 'cancelled', processed_at: nowIso })
      .eq('student_id', studentId)
      .eq('status', 'pending');

    this.assertOk(
      await this.client.from('student_deletion_requests').insert({
        id: reqId,
        student_id: studentId,
        email_hash: emailHash,
        reason: reason || 'Student requested account deletion',
        status: 'pending',
        requested_at: nowIso,
        processed_at: null,
      }),
      'createPendingDeletionRecord'
    );

    this.assertOk(
      await this.client
        .from('student_accounts')
        .update({
          account_status: 'deletion_pending',
          deletion_requested_at: nowIso,
          deletion_reason: reason || 'Student requested account deletion',
          updated_at: nowIso,
        })
        .eq('id', studentId),
      'markStudentDeletionPending'
    );

    return {
      request: {
        id: reqId,
        studentId,
        emailHash,
        reason: reason || 'Student requested account deletion',
        status: 'pending',
        requestedAt: nowIso,
        processedAt: null,
      },
      deletedImmediately: false,
    };
  }

  public async cancelStudentDeletionRequest(studentId: string): Promise<DbStudentAccount | null> {
    const nowIso = new Date().toISOString();
    await this.client
      .from('student_deletion_requests')
      .update({ status: 'cancelled', processed_at: nowIso })
      .eq('student_id', studentId)
      .eq('status', 'pending');

    const { data, error } = await this.client
      .from('student_accounts')
      .update({
        account_status: 'active',
        deletion_requested_at: null,
        deletion_reason: null,
        updated_at: nowIso,
      })
      .eq('id', studentId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase cancelStudentDeletionRequest failed: ${error.message}`);
    return data ? this.mapStudentAccount(data) : null;
  }

  // =========================================================================
  // PHASE 15: COMPANY & EMPLOYER AUTHENTICATION (SUPABASE POSTGRESQL)
  // =========================================================================

  private mapCompanyAccount(r: any): CompanyAccountRecord {
    return {
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      contactName: r.contact_name,
      contactTitle: r.contact_title || '',
      contactPhone: r.contact_phone || '',
      organizationName: r.organization_name,
      organizationType: r.organization_type || 'Private Biopharma',
      officialWebsite: r.official_website || '',
      headquartersLocation: r.headquarters_location || '',
      organizationSize: r.organization_size || '',
      foundedYear: r.founded_year || '',
      industryFocus: r.industry_focus || '',
      description: r.description || '',
      registrationIdentifier: r.registration_identifier || '',
      linkedinUrl: r.linkedin_url || '',
      defaultApplicationDestinationType: normalizeApplicationDestinationType(
        r.default_application_destination_type
      ),
      defaultApplicationUrl: r.default_application_url || '',
      defaultApplicationEmail: r.default_application_email || '',
      emailVerified: Boolean(r.email_verified),
      emailVerifiedAt: r.email_verified_at || null,
      verificationStatus: normalizeCompanyVerificationStatus(r.verification_status),
      verificationSubmittedAt: r.verification_submitted_at || null,
      verificationEvidenceUrl: r.verification_evidence_url || '',
      verificationNotes: r.verification_notes || '',
      verifiedBy: r.verified_by || null,
      verifiedAt: r.verified_at || null,
      rejectionReason: r.rejection_reason || '',
      accountStatus: normalizeCompanyAccountStatus(r.account_status),
      suspendedAt: r.suspended_at || null,
      suspendedBy: r.suspended_by || null,
      suspensionReason: r.suspension_reason || '',
      privacyConsentAccepted: Boolean(r.privacy_consent_accepted),
      privacyConsentAt: r.privacy_consent_at || null,
      lastLoginAt: r.last_login_at || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapCompanySession(r: any): CompanySessionRecord {
    return {
      jti: r.jti,
      companyId: r.company_id,
      userAgent: r.user_agent || '',
      ipMasked: r.ip_masked || 'unknown',
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at || null,
    };
  }

  private mapCompanyAuditLog(r: any): CompanyAuditLogRecord {
    return {
      id: r.id,
      companyId: r.company_id,
      organizationName: r.organization_name || undefined,
      actorType: (r.actor_type || 'company') as 'company' | 'admin' | 'system',
      actorId: r.actor_id || '',
      actorEmail: r.actor_email || '',
      action: r.action,
      targetType: r.target_type || 'company',
      targetId: r.target_id || '',
      status: (r.status || 'success') as 'success' | 'denied' | 'failure',
      ipMasked: r.ip_masked || 'unknown',
      details: r.details || '',
      createdAt: r.created_at,
    };
  }

  public async getCompanyById(id: string): Promise<CompanyAccountRecord | null> {
    const { data, error } = await this.client
      .from('company_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getCompanyById failed: ${error.message}`);
    return data ? this.mapCompanyAccount(data) : null;
  }

  public async getCompanyByEmail(email: string): Promise<CompanyAccountRecord | null> {
    const normalized = normalizeCompanyEmail(email);
    const { data, error } = await this.client
      .from('company_accounts')
      .select('*')
      .eq('email', normalized)
      .maybeSingle();
    if (error) throw new Error(`Supabase getCompanyByEmail failed: ${error.message}`);
    return data ? this.mapCompanyAccount(data) : null;
  }

  public async listAllCompaniesAdmin(): Promise<Array<CompanyAccountRecord & { jobCount: number }>> {
    const { data: companies, error } = await this.client
      .from('company_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase listAllCompaniesAdmin failed: ${error.message}`);

    const { data: jobRows } = await this.client
      .from('jobs')
      .select('company_account_id')
      .neq('company_account_id', '');

    const countMap = new Map<string, number>();
    for (const j of jobRows || []) {
      const cid = String((j as any).company_account_id || '');
      if (cid) countMap.set(cid, (countMap.get(cid) || 0) + 1);
    }

    return (companies || []).map((r: any) => {
      const mapped = this.mapCompanyAccount(r);
      return { ...mapped, jobCount: countMap.get(mapped.id) || 0 };
    });
  }

  public async createCompanyAccount(input: {
    email: string;
    passwordHash: string;
    contactName: string;
    contactTitle?: string;
    contactPhone?: string;
    organizationName: string;
    organizationType?: string;
    officialWebsite: string;
    headquartersLocation: string;
    organizationSize?: string;
    foundedYear?: string;
    industryFocus?: string;
    description?: string;
    registrationIdentifier?: string;
    verificationTokenHash: string;
    verificationTokenExpiresAt: string;
  }): Promise<CompanyAccountRecord> {
    const normalizedEmail = normalizeCompanyEmail(input.email);
    const existing = await this.getCompanyByEmail(normalizedEmail);
    if (existing) {
      throw new Error('A company account with this work email is already registered.');
    }

    const id = `comp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const row = this.assertOk<any>(
      await this.client
        .from('company_accounts')
        .insert({
          id,
          email: normalizedEmail,
          password_hash: input.passwordHash,
          contact_name: input.contactName,
          contact_title: input.contactTitle || '',
          contact_phone: input.contactPhone || '',
          organization_name: input.organizationName,
          organization_type: input.organizationType || 'Private Biopharma',
          official_website: input.officialWebsite,
          headquarters_location: input.headquartersLocation,
          organization_size: input.organizationSize || '',
          founded_year: input.foundedYear || '',
          industry_focus: input.industryFocus || '',
          description: input.description || '',
          registration_identifier: input.registrationIdentifier || '',
          default_application_destination_type: 'external_url',
          default_application_url: input.officialWebsite,
          default_application_email: normalizedEmail,
          email_verified: false,
          verification_token_hash: input.verificationTokenHash,
          verification_token_expires_at: input.verificationTokenExpiresAt,
          verification_status: 'unverified',
          account_status: 'active',
          privacy_consent_accepted: true,
          privacy_consent_at: now,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single(),
      'createCompanyAccount'
    );

    return this.mapCompanyAccount(row);
  }

  public async setCompanyVerificationToken(
    companyId: string,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('company_accounts')
      .update({
        verification_token_hash: tokenHash,
        verification_token_expires_at: expiresAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id');
    if (error) throw new Error(`Supabase setCompanyVerificationToken failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  public async verifyCompanyEmailByToken(rawToken: string): Promise<CompanyAccountRecord | null> {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const { data: match, error } = await this.client
      .from('company_accounts')
      .select('*')
      .eq('verification_token_hash', tokenHash)
      .gt('verification_token_expires_at', nowIso)
      .maybeSingle();
    if (error) throw new Error(`Supabase verifyCompanyEmailByToken lookup failed: ${error.message}`);
    if (!match) return null;

    const updated = this.assertOk<any>(
      await this.client
        .from('company_accounts')
        .update({
          email_verified: true,
          email_verified_at: nowIso,
          verification_token_hash: null,
          verification_token_expires_at: null,
          updated_at: nowIso,
        })
        .eq('id', match.id)
        .select('*')
        .single(),
      'verifyCompanyEmailByToken'
    );
    return this.mapCompanyAccount(updated);
  }

  public async setCompanyPasswordResetToken(
    companyId: string,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('company_accounts')
      .update({
        reset_token_hash: tokenHash,
        reset_token_expires_at: expiresAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id');
    if (error) throw new Error(`Supabase setCompanyPasswordResetToken failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  public async consumeCompanyPasswordResetToken(
    rawToken: string,
    newPasswordHash: string
  ): Promise<CompanyAccountRecord | null> {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const { data: match, error } = await this.client
      .from('company_accounts')
      .select('*')
      .eq('reset_token_hash', tokenHash)
      .gt('reset_token_expires_at', nowIso)
      .maybeSingle();
    if (error) throw new Error(`Supabase consumeCompanyPasswordResetToken failed: ${error.message}`);
    if (!match) return null;

    const updated = this.assertOk<any>(
      await this.client
        .from('company_accounts')
        .update({
          password_hash: newPasswordHash,
          reset_token_hash: null,
          reset_token_expires_at: null,
          updated_at: nowIso,
        })
        .eq('id', match.id)
        .select('*')
        .single(),
      'consumeCompanyPasswordResetToken'
    );
    await this.revokeAllCompanySessions(match.id);
    return this.mapCompanyAccount(updated);
  }

  public async updateCompanyPassword(companyId: string, newPasswordHash: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('company_accounts')
      .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select('id');
    if (error) throw new Error(`Supabase updateCompanyPassword failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  public async updateCompanyLastLogin(companyId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client
      .from('company_accounts')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', companyId);
  }

  public async updateCompanyProfile(
    companyId: string,
    updates: Record<string, any>
  ): Promise<CompanyAccountRecord | null> {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.contactName !== undefined) patch.contact_name = updates.contactName;
    if (updates.contactTitle !== undefined) patch.contact_title = updates.contactTitle;
    if (updates.contactPhone !== undefined) patch.contact_phone = updates.contactPhone;
    if (updates.organizationName !== undefined) patch.organization_name = updates.organizationName;
    if (updates.organizationType !== undefined) patch.organization_type = updates.organizationType;
    if (updates.officialWebsite !== undefined) patch.official_website = updates.officialWebsite;
    if (updates.headquartersLocation !== undefined) patch.headquarters_location = updates.headquartersLocation;
    if (updates.organizationSize !== undefined) patch.organization_size = updates.organizationSize;
    if (updates.foundedYear !== undefined) patch.founded_year = updates.foundedYear;
    if (updates.industryFocus !== undefined) patch.industry_focus = updates.industryFocus;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.registrationIdentifier !== undefined) patch.registration_identifier = updates.registrationIdentifier;
    if (updates.linkedinUrl !== undefined) patch.linkedin_url = updates.linkedinUrl;
    if (updates.defaultApplicationDestinationType !== undefined) {
      patch.default_application_destination_type = normalizeApplicationDestinationType(
        updates.defaultApplicationDestinationType
      );
    }
    if (updates.defaultApplicationUrl !== undefined) patch.default_application_url = updates.defaultApplicationUrl;
    if (updates.defaultApplicationEmail !== undefined) patch.default_application_email = updates.defaultApplicationEmail;

    const { data, error } = await this.client
      .from('company_accounts')
      .update(patch)
      .eq('id', companyId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase updateCompanyProfile failed: ${error.message}`);
    return data ? this.mapCompanyAccount(data) : null;
  }

  public async submitCompanyEmployerVerification(
    companyId: string,
    payload: {
      officialWebsite: string;
      registrationIdentifier?: string;
      verificationEvidenceUrl?: string;
      verificationNotes: string;
    }
  ): Promise<CompanyAccountRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('company_accounts')
      .update({
        official_website: payload.officialWebsite,
        registration_identifier: payload.registrationIdentifier || '',
        verification_evidence_url: payload.verificationEvidenceUrl || '',
        verification_notes: payload.verificationNotes,
        verification_status: 'pending_review',
        verification_submitted_at: now,
        rejection_reason: '',
        updated_at: now,
      })
      .eq('id', companyId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase submitCompanyEmployerVerification failed: ${error.message}`);
    return data ? this.mapCompanyAccount(data) : null;
  }

  public async setCompanyVerificationDecisionAdmin(
    companyId: string,
    decision: 'verified' | 'rejected' | 'unverified',
    adminIdentifier: string,
    notesOrReason: string = ''
  ): Promise<CompanyAccountRecord | null> {
    const now = new Date().toISOString();
    const patch: Record<string, any> = { updated_at: now };
    if (decision === 'verified') {
      patch.verification_status = 'verified';
      patch.verified_by = adminIdentifier;
      patch.verified_at = now;
      patch.rejection_reason = '';
    } else if (decision === 'rejected') {
      patch.verification_status = 'rejected';
      patch.verified_by = adminIdentifier;
      patch.verified_at = null;
      patch.rejection_reason = notesOrReason || 'Verification evidence could not be confirmed.';
    } else {
      patch.verification_status = 'unverified';
      patch.verified_by = null;
      patch.verified_at = null;
      patch.rejection_reason = notesOrReason;
    }

    const { data, error } = await this.client
      .from('company_accounts')
      .update(patch)
      .eq('id', companyId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase setCompanyVerificationDecisionAdmin failed: ${error.message}`);
    return data ? this.mapCompanyAccount(data) : null;
  }

  public async setCompanyAccountStatusAdmin(
    companyId: string,
    status: CompanyAccountStatus,
    adminIdentifier: string,
    reason: string = ''
  ): Promise<{ company: CompanyAccountRecord | null; revokedSessions: number }> {
    const now = new Date().toISOString();
    let revokedSessions = 0;

    const patch: Record<string, any> =
      status === 'suspended'
        ? {
            account_status: 'suspended',
            suspended_at: now,
            suspended_by: adminIdentifier,
            suspension_reason: reason || 'Suspended by platform administrator.',
            updated_at: now,
          }
        : {
            account_status: 'active',
            suspended_at: null,
            suspended_by: null,
            suspension_reason: '',
            updated_at: now,
          };

    const { data, error } = await this.client
      .from('company_accounts')
      .update(patch)
      .eq('id', companyId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase setCompanyAccountStatusAdmin failed: ${error.message}`);

    if (data && status === 'suspended') {
      revokedSessions = await this.revokeAllCompanySessions(companyId);
    }

    return {
      company: data ? this.mapCompanyAccount(data) : null,
      revokedSessions,
    };
  }

  public async createCompanySession(input: {
    jti: string;
    companyId: string;
    rawToken: string;
    userAgent: string;
    ipMasked: string;
    expiresAt: string;
  }): Promise<CompanySessionRecord> {
    const now = new Date().toISOString();
    const tokenHash = hashOpaqueToken(input.rawToken);
    const row = this.assertOk<any>(
      await this.client
        .from('company_sessions')
        .insert({
          jti: input.jti,
          company_id: input.companyId,
          token_hash: tokenHash,
          user_agent: input.userAgent.slice(0, 260),
          ip_masked: input.ipMasked || 'unknown',
          created_at: now,
          last_active_at: now,
          expires_at: input.expiresAt,
          revoked_at: null,
        })
        .select('*')
        .single(),
      'createCompanySession'
    );
    return this.mapCompanySession(row);
  }

  public async validateCompanySessionToken(
    rawToken: string
  ): Promise<{ session: CompanySessionRecord; company: CompanyAccountRecord } | null> {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const { data: sessionRow, error } = await this.client
      .from('company_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .maybeSingle();
    if (error) throw new Error(`Supabase validateCompanySessionToken failed: ${error.message}`);
    if (!sessionRow) return null;

    const company = await this.getCompanyById(sessionRow.company_id);
    if (!company) return null;

    await this.client
      .from('company_sessions')
      .update({ last_active_at: nowIso })
      .eq('jti', sessionRow.jti);

    return {
      session: { ...this.mapCompanySession(sessionRow), lastActiveAt: nowIso },
      company,
    };
  }

  public async listActiveCompanySessions(
    companyId: string,
    currentJti?: string
  ): Promise<CompanySessionRecord[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from('company_sessions')
      .select('*')
      .eq('company_id', companyId)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .order('last_active_at', { ascending: false });
    if (error) throw new Error(`Supabase listActiveCompanySessions failed: ${error.message}`);
    return (data || []).map((r: any) => ({
      ...this.mapCompanySession(r),
      isCurrent: Boolean(currentJti && r.jti === currentJti),
    }));
  }

  public async revokeCompanySessionByJti(jti: string, companyId?: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    let query = this.client
      .from('company_sessions')
      .update({ revoked_at: nowIso })
      .eq('jti', jti)
      .is('revoked_at', null);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query.select('jti');
    if (error) throw new Error(`Supabase revokeCompanySessionByJti failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  public async revokeAllCompanySessions(companyId: string, exceptJti?: string): Promise<number> {
    const nowIso = new Date().toISOString();
    let query = this.client
      .from('company_sessions')
      .update({ revoked_at: nowIso })
      .eq('company_id', companyId)
      .is('revoked_at', null);
    if (exceptJti) query = query.neq('jti', exceptJti);
    const { data, error } = await query.select('jti');
    if (error) throw new Error(`Supabase revokeAllCompanySessions failed: ${error.message}`);
    return Array.isArray(data) ? data.length : 0;
  }

  public async getJobsByCompanyAccountId(companyAccountId: string) {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('company_account_id', companyAccountId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase getJobsByCompanyAccountId failed: ${error.message}`);
    return (data || []).map(mapJobRow);
  }

  public async createCompanyAuditLog(entry: {
    companyId: string;
    actorType: 'company' | 'admin' | 'system';
    actorId: string;
    actorEmail: string;
    action: string;
    targetType?: string;
    targetId?: string;
    status?: 'success' | 'denied' | 'failure';
    ipMasked?: string;
    details?: string;
  }): Promise<CompanyAuditLogRecord> {
    const id = generateCompanyAuditId();
    const now = new Date().toISOString();
    const row = this.assertOk<any>(
      await this.client
        .from('company_audit_logs')
        .insert({
          id,
          company_id: entry.companyId,
          actor_type: entry.actorType,
          actor_id: entry.actorId || '',
          actor_email: entry.actorEmail || '',
          action: entry.action,
          target_type: entry.targetType || 'company',
          target_id: entry.targetId || '',
          status: entry.status || 'success',
          ip_masked: entry.ipMasked || 'unknown',
          details: entry.details || '',
          created_at: now,
        })
        .select('*')
        .single(),
      'createCompanyAuditLog'
    );
    return this.mapCompanyAuditLog(row);
  }

  public async getCompanyAuditLogs(
    companyId?: string,
    limit: number = 100
  ): Promise<CompanyAuditLogRecord[]> {
    const clampedLimit = Math.max(1, Math.min(limit, 250));
    let query = this.client
      .from('company_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(clampedLimit);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase getCompanyAuditLogs failed: ${error.message}`);
    return (data || []).map((r: any) => this.mapCompanyAuditLog(r));
  }
}

export function getSupabaseRepository(
  env: Record<string, string | undefined> = process.env,
  customFetch?: typeof fetch
): SupabaseRepository | null {
  const client = getSupabaseAdminClient(env, customFetch);
  if (!client) return null;
  return new SupabaseRepository(client);
}
