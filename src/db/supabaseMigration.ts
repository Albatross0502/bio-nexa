/**
 * BIO-INEXA Phase 04: SQLite -> Supabase PostgreSQL Migration,
 * Deduplication, Integrity Verification & Snapshot Recovery Utilities.
 *
 * Preserves existing db/bionexa.db SQLite data untouched while extracting
 * deduplicated, FK-ordered records ready for PostgreSQL upsert & verification.
 */

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BionexaDatabase, DbJob } from './bionexaDatabase.js';

export interface MigrationTableCounts {
  companies: number;
  jobs: number;
  internships: number;
  workshops: number;
  courses: number;
  announcements: number;
  contentRecords: number;
  submittedOpportunities: number;
  jobVerificationRecords: number;
  complianceRequests: number;
  contactMessages: number;
  newsletterSubscribers: number;
  certificates: number;
  jobApplications: number;
  discussions: number;
  discussionReplies: number;
  databaseBackups: number;
}

export interface SupabaseMigrationPayload {
  generatedAt: string;
  checksumSha256: string;
  companies: Record<string, any>[];
  jobs: Record<string, any>[];
  internships: Record<string, any>[];
  workshops: Record<string, any>[];
  courses: Record<string, any>[];
  announcements: Record<string, any>[];
  contentRecords: Record<string, any>[];
  submittedOpportunities: Record<string, any>[];
  jobVerificationRecords: Record<string, any>[];
  complianceRequests: Record<string, any>[];
  contactMessages: Record<string, any>[];
  newsletterSubscribers: Record<string, any>[];
  certificates: Record<string, any>[];
  jobApplications: Record<string, any>[];
  discussions: Record<string, any>[];
  discussionReplies: Record<string, any>[];
  databaseBackups: Record<string, any>[];
  counts: MigrationTableCounts;
}

export interface MigrationExecutionReport {
  dryRun: boolean;
  executedAt: string;
  checksumSha256: string;
  sourceCounts: MigrationTableCounts;
  upsertedCounts: Partial<MigrationTableCounts>;
  verifiedCounts: Partial<MigrationTableCounts>;
  mismatches: string[];
  success: boolean;
}

export function normalizeCompanySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableCompanyId(normalizedName: string): string {
  const hash = crypto.createHash('sha1').update(normalizedName).digest('hex').slice(0, 12);
  return `comp-${hash}`;
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function isInternshipJob(job: DbJob): boolean {
  const hay = `${job.title} ${job.employmentType} ${job.sector}`.toLowerCase();
  return hay.includes('intern') || hay.includes('fellowship') || hay.includes('trainee');
}

export function buildSupabaseMigrationPayload(db: BionexaDatabase): SupabaseMigrationPayload {
  const generatedAt = new Date().toISOString();
  const rawJobs = dedupeByKey(db.getAllJobsAdmin(), (j) => j.id);
  const rawWorkshops = dedupeByKey(db.getWorkshops(), (w) => w.id);
  const rawCourses = dedupeByKey(db.getCourses(), (c) => c.id);
  const rawAnnouncements = dedupeByKey(db.getAnnouncements(false), (a) => a.id);
  const rawSubmittedOpps = dedupeByKey(db.getSubmittedOpportunities({ onlyApproved: false }), (o) => o.id);
  const rawCompliance = dedupeByKey(db.getComplianceRequests(), (c) => c.id);
  const rawContacts = dedupeByKey(db.getContactMessages(), (m) => m.id);
  const rawSubscribers = dedupeByKey(
    db.getNewsletterSubscribers(),
    (s) => s.email.trim().toLowerCase()
  );
  const rawCerts = dedupeByKey(db.getCertificates(), (c) => c.certificateNumber.trim().toUpperCase());
  const rawApps = dedupeByKey(db.getJobApplications(), (a) => a.id);
  const rawDiscussions = dedupeByKey(db.getDiscussions(), (d) => d.id);
  const rawBackups = dedupeByKey(db.listBackups(), (b) => b.id);
  const homepageHighlights = db.getContent('homepage_highlights');

  // Derive deduplicated companies directory from jobs + submitted opportunities
  const companyMap = new Map<string, Record<string, any>>();
  for (const job of rawJobs) {
    const normalized = normalizeCompanySlug(job.employer);
    if (!normalized) continue;
    if (!companyMap.has(normalized)) {
      const isVerified = job.verificationStatus === 'Verified';
      companyMap.set(normalized, {
        id: stableCompanyId(normalized),
        name: job.employer.trim(),
        normalized_name: normalized,
        website_url: job.originalJobUrl || job.applicationUrl || '',
        careers_url: job.applicationUrl || '',
        sector: job.sector || 'Biotechnology',
        location: job.location || '',
        contact_email: '',
        verification_status: isVerified ? 'Verified' : 'Pending',
        verified_at: isVerified ? job.lastVerificationDate || generatedAt : null,
        created_at: job.createdAt || generatedAt,
        updated_at: job.updatedAt || generatedAt,
      });
    }
  }
  for (const sub of rawSubmittedOpps) {
    const normalized = normalizeCompanySlug(sub.organization);
    if (!normalized || companyMap.has(normalized)) continue;
    companyMap.set(normalized, {
      id: stableCompanyId(normalized),
      name: sub.organization.trim(),
      normalized_name: normalized,
      website_url: sub.sourceUrl || sub.applicationUrl || '',
      careers_url: sub.applicationUrl || '',
      sector: sub.subCategory || 'Biotechnology',
      location: sub.location || '',
      contact_email: sub.contactEmail || '',
      verification_status: sub.isApproved ? 'Verified' : 'Pending',
      verified_at: sub.isApproved ? generatedAt : null,
      created_at: sub.createdAt || generatedAt,
      updated_at: sub.updatedAt || generatedAt,
    });
  }
  const companies = Array.from(companyMap.values());

  const jobs = rawJobs.map((j) => {
    const comp = companyMap.get(normalizeCompanySlug(j.employer));
    return {
      id: j.id,
      company_id: comp?.id || null,
      title: j.title,
      employer: j.employer,
      description: j.description,
      location: j.location,
      qualification: j.qualification || '',
      skills: j.skills || [],
      employment_type: j.employmentType || 'Full-time',
      salary: j.salary || 'Competitive',
      application_url: j.applicationUrl,
      source: j.source || 'BIO-INEXA Verified',
      original_job_url: j.originalJobUrl || '',
      publication_date: j.publicationDate,
      expiry_date: j.expiryDate || '',
      last_verification_date: j.lastVerificationDate || '',
      verification_status: j.verificationStatus || 'Pending Verification',
      verification_notes: j.verificationNotes || '',
      is_active: Boolean(j.isActive),
      is_approved: Boolean(j.isApproved),
      featured: Boolean(j.featured),
      responsibilities: j.responsibilities || [],
      requirements: j.requirements || [],
      sector: j.sector || 'Biotechnology',
      created_at: j.createdAt || generatedAt,
      updated_at: j.updatedAt || generatedAt,
    };
  });

  const internships = rawJobs.filter(isInternshipJob).map((j) => {
    const comp = companyMap.get(normalizeCompanySlug(j.employer));
    const lowerLoc = `${j.location} ${j.employmentType}`.toLowerCase();
    const workMode = lowerLoc.includes('remote')
      ? 'Remote'
      : lowerLoc.includes('hybrid')
      ? 'Hybrid'
      : 'On-site';
    return {
      id: `intern-${j.id}`,
      company_id: comp?.id || null,
      title: j.title,
      organization: j.employer,
      description: j.description,
      location: j.location,
      work_mode: workMode,
      duration: '3–6 Months',
      stipend: j.salary || 'Not Disclosed',
      eligibility: j.qualification || 'Life Sciences Students / Freshers',
      qualification: j.qualification || '',
      branches: ['Biotechnology'],
      skills: j.skills || [],
      application_url: j.applicationUrl,
      source_name: j.source || 'BIO-INEXA Verified',
      source_url: j.originalJobUrl || j.applicationUrl,
      deadline: j.expiryDate || '',
      verification_status: j.verificationStatus || 'Pending Verification',
      is_active: Boolean(j.isActive),
      is_approved: Boolean(j.isApproved),
      featured: Boolean(j.featured),
      created_at: j.createdAt || generatedAt,
      updated_at: j.updatedAt || generatedAt,
    };
  });

  const workshops = rawWorkshops.map((w) => ({
    id: w.id,
    company_id: null,
    name: w.name,
    description: w.description,
    instructor: w.instructor || '',
    date: w.date,
    time: w.time || '09:00 AM - 05:00 PM IST',
    duration: w.duration || '1 Day',
    format: w.format || 'Online',
    venue: w.venue,
    registration_deadline: w.registrationDeadline || '',
    registration_link: w.registrationLink,
    availability: w.availability || 'Open',
    status: w.status || 'upcoming',
    fees: w.fees || 'Free',
    capacity: Number(w.capacity ?? 50),
    image_url: w.imageUrl || '',
    featured: Boolean(w.featured),
    skills_covered: w.skillsCovered || [],
    created_at: w.createdAt || generatedAt,
    updated_at: w.updatedAt || generatedAt,
  }));

  const courses = rawCourses.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider || '',
    description: c.description,
    duration: c.duration,
    fees: c.fees || 'Free',
    eligibility: c.eligibility || 'Open to all Science Students',
    curriculum: c.curriculum || [],
    delivery_mode: c.deliveryMode || 'Online (Self-Paced)',
    certificate_info: c.certificateInfo || '',
    registration_deadline: c.registrationDeadline || '',
    registration_link: c.registrationLink,
    availability: c.availability || 'Available',
    status: c.status || 'available',
    instructor: c.instructor || '',
    level: c.level || 'Intermediate',
    category: c.category || 'Biotechnology',
    image_url: c.imageUrl || '',
    is_certificate_available: Boolean(c.isCertificateAvailable),
    featured: Boolean(c.featured),
    created_at: c.createdAt || generatedAt,
    updated_at: c.updatedAt || generatedAt,
  }));

  const announcements = rawAnnouncements.map((a) => ({
    id: a.id,
    title: a.title,
    tag: a.tag,
    content: a.content || '',
    date: a.date,
    link: a.link || '/opportunities',
    is_active: Boolean(a.isActive),
    priority: Number(a.priority ?? 0),
    created_at: a.createdAt || generatedAt,
  }));

  const contentRecords = homepageHighlights
    ? [
        {
          id: 'content-homepage-highlights',
          key: 'homepage_highlights',
          value: homepageHighlights,
          updated_at: generatedAt,
          updated_by: 'sqlite-migration',
        },
      ]
    : [];

  const submittedOpportunities = rawSubmittedOpps.map((s) => {
    const comp = companyMap.get(normalizeCompanySlug(s.organization));
    return {
      id: s.id,
      company_id: comp?.id || null,
      title: s.title,
      organization: s.organization,
      type: s.type || 'job',
      sub_category: s.subCategory || '',
      description: s.description,
      location: s.location,
      work_mode: s.workMode || 'On-site',
      experience: s.experience || 'Not Specified',
      qualification: s.qualification || '',
      branches: s.branches || [],
      skills: s.skills || [],
      salary_or_stipend: s.salaryOrStipend || 'Not Disclosed',
      salary_tier: s.salaryTier || 'not_disclosed',
      deadline: s.deadline || '',
      posted_date: s.postedDate,
      source_name: s.sourceName || 'Direct Employer / Organizer Submission',
      source_url: s.sourceUrl || '',
      application_url: s.applicationUrl,
      contact_email: s.contactEmail || '',
      status: s.status || 'Pending Verification',
      is_approved: Boolean(s.isApproved),
      workshop_details: s.workshopDetails || null,
      created_at: s.createdAt || generatedAt,
      updated_at: s.updatedAt || generatedAt,
    };
  });

  const jobIdSet = new Set(jobs.map((j) => j.id));
  const jobVerificationRecords = dedupeByKey(
    rawJobs.flatMap((j) => db.getVerificationRecords(j.id)),
    (v) => v.id
  )
    .filter((v) => jobIdSet.has(v.jobId))
    .map((v) => ({
      id: v.id,
      job_id: v.jobId,
      admin_user_id: null,
      verified_by: v.verifiedBy,
      verified_at: v.verifiedAt || generatedAt,
      source_status: v.sourceStatus,
      notes: v.notes || '',
    }));

  const complianceRequests = rawCompliance.map((c) => ({
    id: c.id,
    reference_id: c.referenceId,
    request_type: c.requestType,
    sub_category: c.subCategory,
    requester_name: c.requesterName,
    requester_email: c.requesterEmail,
    organization: c.organization || '',
    target_title_or_url: c.targetTitleOrUrl || '',
    details: c.details,
    consent_accepted: Boolean(c.consentAccepted),
    status: c.status,
    resolution_notes: c.resolutionNotes || '',
    created_at: c.createdAt || generatedAt,
    updated_at: c.updatedAt || generatedAt,
  }));

  const contactMessages = rawContacts.map((m) => ({
    id: m.id,
    reference_id: m.referenceId,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: m.status,
    created_at: m.createdAt || generatedAt,
  }));

  const newsletterSubscribers = rawSubscribers.map((s) => ({
    id: s.id,
    email: s.email.trim().toLowerCase(),
    subscribed_at: s.subscribedAt || generatedAt,
    is_active: Boolean(s.isActive),
  }));

  const certificates = rawCerts.map((c) => ({
    id: c.id,
    certificate_number: c.certificateNumber.trim().toUpperCase(),
    recipient_name: c.recipientName,
    course_title: c.courseTitle,
    issue_date: c.issueDate,
    score: Number(c.score),
    verification_code: c.verificationCode,
    created_at: c.createdAt || generatedAt,
  }));

  const jobApplications = rawApps.map((a) => ({
    id: a.id,
    job_id: a.jobId && jobIdSet.has(a.jobId) ? a.jobId : null,
    internship_id: null,
    user_id: null,
    job_title: a.jobTitle,
    company: a.company,
    applicant_name: a.applicantName,
    applicant_email: a.applicantEmail,
    phone: a.phone || '',
    qualification: a.qualification || '',
    experience_years: a.experienceYears || '',
    cover_note: a.coverNote || '',
    applied_date: a.appliedDate,
    application_channel: 'bioinexa_direct',
    status: a.status,
    created_at: a.createdAt || generatedAt,
  }));

  const discussions = rawDiscussions.map((d) => ({
    id: d.id,
    user_id: null,
    title: d.title,
    author_name: d.authorName,
    author_role: d.authorRole || 'BIO-INEXA Member',
    category: d.category,
    content: d.content,
    upvotes: Number(d.upvotes ?? 1),
    created_at: d.createdAt || generatedAt,
  }));

  const discussionReplies = dedupeByKey(
    rawDiscussions.flatMap((d) =>
      (d.replies || []).map((r) => ({
        id: r.id,
        topic_id: d.id,
        user_id: null,
        author_name: r.authorName,
        author_role: r.authorRole || 'BIO-INEXA Member',
        content: r.content,
        upvotes: Number(r.upvotes ?? 0),
        created_at: r.createdAt || generatedAt,
      }))
    ),
    (r) => r.id
  );

  const databaseBackups = rawBackups.map((b) => ({
    id: b.id,
    filename: b.filename,
    storage_backend: 'sqlite-vacuum-archive',
    path: b.path,
    size_bytes: Number(b.sizeBytes ?? 0),
    record_counts: {},
    checksum_sha256: '',
    snapshot_data: null,
    status: b.status || 'completed',
    created_at: b.createdAt || generatedAt,
  }));

  const counts: MigrationTableCounts = {
    companies: companies.length,
    jobs: jobs.length,
    internships: internships.length,
    workshops: workshops.length,
    courses: courses.length,
    announcements: announcements.length,
    contentRecords: contentRecords.length,
    submittedOpportunities: submittedOpportunities.length,
    jobVerificationRecords: jobVerificationRecords.length,
    complianceRequests: complianceRequests.length,
    contactMessages: contactMessages.length,
    newsletterSubscribers: newsletterSubscribers.length,
    certificates: certificates.length,
    jobApplications: jobApplications.length,
    discussions: discussions.length,
    discussionReplies: discussionReplies.length,
    databaseBackups: databaseBackups.length,
  };

  const checksumSource = JSON.stringify({
    companies,
    jobs,
    internships,
    workshops,
    courses,
    announcements,
    contentRecords,
    submittedOpportunities,
    jobVerificationRecords,
    complianceRequests,
    contactMessages,
    newsletterSubscribers,
    certificates,
    jobApplications,
    discussions,
    discussionReplies,
  });
  const checksumSha256 = crypto.createHash('sha256').update(checksumSource).digest('hex');

  return {
    generatedAt,
    checksumSha256,
    companies,
    jobs,
    internships,
    workshops,
    courses,
    announcements,
    contentRecords,
    submittedOpportunities,
    jobVerificationRecords,
    complianceRequests,
    contactMessages,
    newsletterSubscribers,
    certificates,
    jobApplications,
    discussions,
    discussionReplies,
    databaseBackups,
    counts,
  };
}

export interface DatabaseBackupSnapshot {
  format: 'bio-inexa-logical-snapshot-v1';
  createdAt: string;
  checksumSha256: string;
  counts: MigrationTableCounts;
  payload: Omit<SupabaseMigrationPayload, 'generatedAt' | 'checksumSha256' | 'counts'>;
}

export function buildDatabaseSnapshotPayload(db: BionexaDatabase): DatabaseBackupSnapshot {
  const mig = buildSupabaseMigrationPayload(db);
  const { generatedAt, checksumSha256, counts, ...payload } = mig;
  return {
    format: 'bio-inexa-logical-snapshot-v1',
    createdAt: generatedAt,
    checksumSha256,
    counts,
    payload,
  };
}

export function verifyDatabaseSnapshotPayload(snapshot: DatabaseBackupSnapshot): {
  valid: boolean;
  reason?: string;
} {
  if (!snapshot || snapshot.format !== 'bio-inexa-logical-snapshot-v1' || !snapshot.payload) {
    return { valid: false, reason: 'Invalid snapshot format header.' };
  }
  const p = snapshot.payload;
  const checksumSource = JSON.stringify({
    companies: p.companies || [],
    jobs: p.jobs || [],
    internships: p.internships || [],
    workshops: p.workshops || [],
    courses: p.courses || [],
    announcements: p.announcements || [],
    contentRecords: p.contentRecords || [],
    submittedOpportunities: p.submittedOpportunities || [],
    jobVerificationRecords: p.jobVerificationRecords || [],
    complianceRequests: p.complianceRequests || [],
    contactMessages: p.contactMessages || [],
    newsletterSubscribers: p.newsletterSubscribers || [],
    certificates: p.certificates || [],
    jobApplications: p.jobApplications || [],
    discussions: p.discussions || [],
    discussionReplies: p.discussionReplies || [],
  });
  const computed = crypto.createHash('sha256').update(checksumSource).digest('hex');
  if (computed !== snapshot.checksumSha256) {
    return { valid: false, reason: 'Snapshot SHA-256 checksum mismatch (possible tampering or truncation).' };
  }
  return { valid: true };
}

export async function migrateSqliteToSupabase(options: {
  db: BionexaDatabase;
  client?: SupabaseClient | null;
  dryRun?: boolean;
}): Promise<MigrationExecutionReport> {
  const payload = buildSupabaseMigrationPayload(options.db);
  const dryRun = Boolean(options.dryRun) || !options.client;

  if (dryRun || !options.client) {
    return {
      dryRun: true,
      executedAt: new Date().toISOString(),
      checksumSha256: payload.checksumSha256,
      sourceCounts: payload.counts,
      upsertedCounts: { ...payload.counts },
      verifiedCounts: {},
      mismatches: [],
      success: true,
    };
  }

  const client = options.client;
  const tablePlans: Array<{
    key: keyof MigrationTableCounts;
    table: string;
    rows: Record<string, any>[];
    onConflict: string;
  }> = [
    { key: 'companies', table: 'companies', rows: payload.companies, onConflict: 'normalized_name' },
    { key: 'jobs', table: 'jobs', rows: payload.jobs, onConflict: 'id' },
    { key: 'internships', table: 'internships', rows: payload.internships, onConflict: 'id' },
    { key: 'workshops', table: 'workshops', rows: payload.workshops, onConflict: 'id' },
    { key: 'courses', table: 'courses', rows: payload.courses, onConflict: 'id' },
    { key: 'announcements', table: 'announcements', rows: payload.announcements, onConflict: 'id' },
    { key: 'contentRecords', table: 'content_records', rows: payload.contentRecords, onConflict: 'key' },
    { key: 'submittedOpportunities', table: 'submitted_opportunities', rows: payload.submittedOpportunities, onConflict: 'id' },
    { key: 'jobVerificationRecords', table: 'job_verification_records', rows: payload.jobVerificationRecords, onConflict: 'id' },
    { key: 'complianceRequests', table: 'compliance_requests', rows: payload.complianceRequests, onConflict: 'id' },
    { key: 'contactMessages', table: 'contact_messages', rows: payload.contactMessages, onConflict: 'id' },
    { key: 'newsletterSubscribers', table: 'newsletter_subscribers', rows: payload.newsletterSubscribers, onConflict: 'email' },
    { key: 'certificates', table: 'certificates', rows: payload.certificates, onConflict: 'certificate_number' },
    { key: 'jobApplications', table: 'job_applications', rows: payload.jobApplications, onConflict: 'id' },
    { key: 'discussions', table: 'discussions', rows: payload.discussions, onConflict: 'id' },
    { key: 'discussionReplies', table: 'discussion_replies', rows: payload.discussionReplies, onConflict: 'id' },
    { key: 'databaseBackups', table: 'database_backups', rows: payload.databaseBackups, onConflict: 'id' },
  ];

  const upsertedCounts: Partial<MigrationTableCounts> = {};
  const verifiedCounts: Partial<MigrationTableCounts> = {};
  const mismatches: string[] = [];

  for (const plan of tablePlans) {
    if (plan.rows.length > 0) {
      const { error } = await client
        .from(plan.table)
        .upsert(plan.rows, { onConflict: plan.onConflict, ignoreDuplicates: false });
      if (error) {
        throw new Error(`Migration upsert failed on table '${plan.table}': ${error.message}`);
      }
    }
    upsertedCounts[plan.key] = plan.rows.length;

    const { count, error: countErr } = await client
      .from(plan.table)
      .select('*', { count: 'exact', head: true });
    if (countErr) {
      throw new Error(`Verification count failed on table '${plan.table}': ${countErr.message}`);
    }
    const remoteCount = count ?? 0;
    verifiedCounts[plan.key] = remoteCount;
    if (remoteCount < plan.rows.length) {
      mismatches.push(`${plan.table}: expected >= ${plan.rows.length}, found ${remoteCount}`);
    }
  }

  return {
    dryRun: false,
    executedAt: new Date().toISOString(),
    checksumSha256: payload.checksumSha256,
    sourceCounts: payload.counts,
    upsertedCounts,
    verifiedCounts,
    mismatches,
    success: mismatches.length === 0,
  };
}
