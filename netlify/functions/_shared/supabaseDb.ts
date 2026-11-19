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
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    organization: row.organization,
    location: row.location || 'India',
    mode: workMode,
    workMode,
    stipend: row.stipend || 'Competitive Stipend',
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
    verificationStatus,
    verificationNotes: row.verification_notes || '',
    lastVerificationDate: row.last_verification_date || '',
    isVerified: verificationStatus === 'Verified',
    isApproved: Boolean(row.is_approved),
    isActive: row.is_active !== false,
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
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    description: row.description,
    instructor: row.instructor || '',
    organizer: row.instructor || '',
    date: row.date,
    startDate: row.date,
    endDate: row.date,
    time: row.time || '09:00 AM - 05:00 PM IST',
    duration: row.duration || '1 Day',
    format: row.format || 'Online',
    workMode: row.format || 'Online',
    venue: row.venue,
    location: row.venue,
    registrationDeadline: row.registration_deadline || '',
    registrationLink: row.registration_link,
    registrationUrl: row.registration_link,
    availability: row.availability || 'Open',
    status: row.status || 'upcoming',
    fees: row.fees || 'Free',
    capacity: Number(row.capacity ?? 50),
    imageUrl: row.image_url || '',
    featured: Boolean(row.featured),
    skillsCovered: parseJsonArray(row.skills_covered),
    isApproved: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseRow(row: any) {
  const status = normalizeCourseStatus(row.status);
  const certInfo = (row.certificate_info || '').trim();
  const isCert = Boolean(certInfo) || Boolean(row.is_certificate_available);
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    provider: row.provider || row.instructor || 'Course Provider',
    description: row.description,
    duration: row.duration,
    fees: row.fees || 'Free',
    price: row.fees || 'Free',
    eligibility: row.eligibility || 'Open to all Science Students',
    curriculum: parseJsonArray(row.curriculum),
    syllabus: parseJsonArray(row.curriculum),
    deliveryMode: row.delivery_mode || 'Online (Self-Paced)',
    certificateInfo: certInfo,
    registrationDeadline: row.registration_deadline || '',
    registrationLink: row.registration_link,
    registrationUrl: row.registration_link,
    availability: status === 'closed' ? 'Closed' : row.availability || 'Available',
    status,
    instructor: row.instructor || row.provider || '',
    level: row.level || 'Intermediate',
    category: row.category || 'Biotechnology',
    imageUrl: row.image_url || '',
    isCertificateAvailable: isCert,
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
          application_url: input.applicationUrl,
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
    mode?: string;
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
    if (filter?.onlyActive !== false) {
      query = query.eq('is_active', true);
    }

    const rows = this.assertOk<any[]>(await query, 'getInternships') || [];
    return rows.map(mapInternshipRow).filter((item) => {
      if (filter?.category && filter.category !== 'All' && filter.category !== 'all' && item.category !== filter.category) {
        return false;
      }
      if (filter?.mode && filter.mode !== 'All' && filter.mode !== 'all' && !item.workMode.toLowerCase().includes(filter.mode.toLowerCase())) {
        return false;
      }
      if (filter?.search) {
        const term = filter.search.toLowerCase();
        return [item.title, item.organization, item.description, item.location, ...item.skillsRequired]
          .join(' ')
          .toLowerCase()
          .includes(term);
      }
      return true;
    });
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
          is_approved: input.isApproved !== false,
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
      if (!filter?.search) return true;
      const term = filter.search.toLowerCase();
      return [ws.name, ws.description, ws.instructor, ws.venue, ...ws.skillsCovered]
        .join(' ')
        .toLowerCase()
        .includes(term);
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
    const row = this.assertOk<any>(
      await this.client
        .from('workshops')
        .insert({
          id,
          name: input.title || input.name,
          description: input.description || '',
          instructor: input.organizer || input.instructor || '',
          date: input.date || input.startDate || now.split('T')[0],
          time: input.time || '09:30 AM - 04:30 PM IST',
          duration: input.duration || '1 Day',
          format: input.format || input.workMode || 'Online',
          venue: input.venue || input.location || 'Online',
          registration_deadline: input.registrationDeadline || '',
          registration_link: input.registrationUrl || input.registrationLink,
          availability: input.availability || 'Open',
          status: input.status || 'upcoming',
          fees: input.fees || 'Free',
          capacity: Number(input.capacity ?? 50),
          image_url: input.imageUrl || '',
          featured: Boolean(input.featured),
          skills_covered: input.skillsCovered || [],
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
    if (updates.organizer !== undefined || updates.instructor !== undefined) {
      patch.instructor = updates.organizer ?? updates.instructor;
    }
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
    if (updates.capacity !== undefined) patch.capacity = Number(updates.capacity);
    if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl;
    if (updates.featured !== undefined) patch.featured = Boolean(updates.featured);
    if (updates.skillsCovered !== undefined) patch.skills_covered = updates.skillsCovered;

    const row = this.assertOk<any>(
      await this.client.from('workshops').update(patch).eq('id', id).select('*').single(),
      'updateWorkshop'
    );
    return mapWorkshopRow(row);
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
    category?: string;
    status?: string;
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
      if (filter?.onlyAvailable && c.status !== 'available') return false;
      if (filter?.status && filter.status !== 'all' && c.status !== normalizeCourseStatus(filter.status)) return false;
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
    const normStatus = normalizeCourseStatus(input.status);
    const certInfo = String(input.certificateInfo || '').trim();
    const row = this.assertOk<any>(
      await this.client
        .from('courses')
        .insert({
          id,
          name: input.title || input.name,
          provider: input.provider || input.instructor || 'Course Provider',
          description: input.description || '',
          duration: input.duration || 'Self-Paced',
          fees: input.fees || input.price || 'Free',
          eligibility: input.eligibility || 'Open to all Science Students',
          curriculum: input.curriculum || input.syllabus || [],
          delivery_mode: input.deliveryMode || 'Online (Self-Paced)',
          certificate_info: certInfo,
          registration_deadline: input.registrationDeadline || 'Open / Rolling',
          registration_link: input.registrationUrl || input.registrationLink,
          availability: normStatus === 'closed' ? 'Closed' : input.availability || 'Available',
          status: normStatus,
          instructor: input.instructor || input.provider || '',
          level: input.level || 'Intermediate',
          category: input.category || 'Biotechnology',
          image_url: input.imageUrl || '',
          is_certificate_available: Boolean(certInfo) || Boolean(input.isCertificateAvailable),
          featured: Boolean(input.featured),
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
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.duration !== undefined) patch.duration = updates.duration;
    if (updates.fees !== undefined || updates.price !== undefined) patch.fees = updates.fees ?? updates.price;
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
}

export function getSupabaseRepository(
  env: Record<string, string | undefined> = process.env,
  customFetch?: typeof fetch
): SupabaseRepository | null {
  const client = getSupabaseAdminClient(env, customFetch);
  if (!client) return null;
  return new SupabaseRepository(client);
}
