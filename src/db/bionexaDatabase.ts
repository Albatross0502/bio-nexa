/**
 * BIO-NEXA Embedded Relational Database Service
 * Powered by Node.js 22 built-in node:sqlite (DatabaseSync)
 * 
 * Provides zero-dependency, ACID-compliant persistence for:
 * - Jobs (with verification records & expiry tracking)
 * - Workshops (dates, venues, fees, registration links)
 * - Courses (curricula, prerequisites, fees)
 * - Announcements & Content Management Records
 * - Admin Accounts & Audit Records
 * - Automated Point-in-Time Database Backups (VACUUM INTO)
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  computeAdminDashboardStats,
  AdminDashboardStats,
} from '../services/admin/adminHelpers.js';
import { findDuplicateJob as matchDuplicateJob } from '../services/jobs/jobVerification.js';

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
  if (clean === 'Pending Verification' || clean === 'Pending Review' || clean === 'Flagged') return 'Pending Verification';
  return 'Pending Verification';
}

export interface DbJob {
  id: string;
  title: string;
  employer: string;
  description: string;
  location: string;
  qualification: string;
  skills: string[]; // Stored as JSON array in SQLite
  employmentType: string;
  salary: string;
  applicationUrl: string; // Application destination
  source: string; // Original listing source
  originalJobUrl?: string; // Original job URL
  publicationDate: string;
  expiryDate: string;
  lastVerificationDate?: string;
  verificationStatus: JobVerificationStatus;
  verificationNotes?: string;
  isVerified?: boolean;
  isActive: boolean;
  isApproved: boolean;
  featured: boolean;
  responsibilities: string[];
  requirements: string[];
  sector: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbInternship {
  id: string;
  slug: string;
  title: string;
  organization: string;
  location: string;
  workMode: string;
  stipend: string;
  duration: string;
  deadline: string;
  category: string;
  eligibility: string;
  description: string;
  learningOutcomes: string[];
  skillsRequired: string[];
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string;
  verificationStatus: JobVerificationStatus;
  verificationNotes: string;
  lastVerificationDate: string;
  isVerified: boolean;
  isApproved: boolean;
  isActive: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbSyncLog {
  id: string;
  sourceId: string;
  sourceName: string;
  status: 'Success' | 'Partial' | 'Error';
  itemsFetched: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsExpired: number;
  details: string;
  createdAt: string;
}

export type WorkshopFormat = 'Online' | 'Offline' | 'Hybrid';
export type WorkshopStatus = 'upcoming' | 'ongoing' | 'completed';
export type WorkshopAvailability = 'Open' | 'Filling Fast' | 'Waitlist' | 'Closed';

export interface DbWorkshop {
  id: string;
  name: string;
  description: string;
  instructor: string;
  date: string;
  time: string;
  duration: string;
  format: WorkshopFormat;
  venue: string;
  registrationDeadline: string;
  registrationLink: string;
  availability: WorkshopAvailability | string;
  status: WorkshopStatus | string;
  fees: string;
  capacity: number;
  imageUrl?: string;
  featured: boolean;
  skillsCovered: string[];
  createdAt: string;
  updatedAt: string;
}

export type CourseStatus = 'available' | 'closed' | 'active' | 'archived';

export function normalizeDbCourseStatus(status?: string): 'available' | 'closed' {
  const clean = (status || '').trim().toLowerCase();
  if (clean === 'closed' || clean === 'archived' || clean === 'expired' || clean === 'inactive') {
    return 'closed';
  }
  return 'available';
}

export interface DbCourse {
  id: string;
  name: string;
  provider: string;
  description: string;
  duration: string;
  fees: string;
  eligibility: string;
  curriculum: string[];
  deliveryMode: string;
  certificateInfo: string;
  registrationDeadline: string;
  registrationLink: string;
  availability: string;
  status: CourseStatus;
  instructor: string;
  level: string;
  category: string;
  imageUrl?: string;
  isCertificateAvailable: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbAnnouncement {
  id: string;
  title: string;
  tag: string;
  content: string;
  date: string;
  link: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export interface DbVerificationRecord {
  id: string;
  jobId: string;
  verifiedBy: string;
  verifiedAt: string;
  sourceStatus: string;
  notes: string;
}

export interface DbBackupRecord {
  id: string;
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  status: string;
}

export type DbComplianceRequestType =
  | 'privacy_request'
  | 'grievance'
  | 'job_report'
  | 'content_removal';

export type DbComplianceRequestStatus = 'Pending' | 'In Review' | 'Resolved' | 'Action Taken';

export interface DbComplianceRequest {
  id: string;
  referenceId: string;
  requestType: DbComplianceRequestType;
  subCategory: string;
  requesterName: string;
  requesterEmail: string;
  organization: string;
  targetTitleOrUrl: string;
  details: string;
  consentAccepted: boolean;
  status: DbComplianceRequestStatus;
  resolutionNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbSubmittedOpportunity {
  id: string;
  title: string;
  organization: string;
  type: string;
  subCategory: string;
  description: string;
  location: string;
  workMode: string;
  experience: string;
  qualification: string;
  branches: string[];
  skills: string[];
  salaryOrStipend: string;
  salaryTier: string;
  deadline: string;
  postedDate: string;
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string;
  contactEmail: string;
  status: string;
  isApproved: boolean;
  workshopDetails?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbContactMessage {
  id: string;
  referenceId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'New' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

export interface DbNewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
  isActive: boolean;
}

export interface DbCertificate {
  id: string;
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  issueDate: string;
  score: number;
  verificationCode: string;
  createdAt: string;
}

export interface DbJobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  applicantName: string;
  applicantEmail: string;
  phone: string;
  qualification: string;
  experienceYears: string;
  coverNote: string;
  appliedDate: string;
  status: 'Under Review' | 'Shortlisted' | 'Interview Scheduled' | 'Rejected';
  createdAt: string;
}

export interface DbDiscussionReply {
  id: string;
  topicId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  upvotes: number;
}

export interface DbDiscussionTopic {
  id: string;
  title: string;
  authorName: string;
  authorRole: string;
  category: string;
  content: string;
  createdAt: string;
  upvotes: number;
  replies: DbDiscussionReply[];
}

export class BionexaDatabase {
  private db!: DatabaseSync;
  private dbPath: string;
  private backupDir: string;

  constructor(dbPath?: string, backupDir?: string) {
    this.dbPath = dbPath || process.env.DATABASE_PATH || path.resolve(process.cwd(), 'db', 'bionexa.db');
    this.backupDir = backupDir || path.resolve(process.cwd(), 'db', 'backups');
    this.init();
  }

  private init(): void {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Enable WAL mode for high concurrency read/write
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        employer TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        qualification TEXT DEFAULT '',
        skills TEXT NOT NULL DEFAULT '[]',
        employment_type TEXT DEFAULT 'Full-time',
        salary TEXT DEFAULT 'Competitive',
        application_url TEXT NOT NULL,
        source TEXT DEFAULT 'BIO-INEXA Verified',
        original_job_url TEXT DEFAULT '',
        publication_date TEXT NOT NULL,
        expiry_date TEXT DEFAULT '',
        last_verification_date TEXT DEFAULT '',
        verification_status TEXT NOT NULL DEFAULT 'Pending Verification',
        verification_notes TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        is_approved INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        responsibilities TEXT NOT NULL DEFAULT '[]',
        requirements TEXT NOT NULL DEFAULT '[]',
        sector TEXT DEFAULT 'Biotechnology',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workshops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        instructor TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT DEFAULT '09:00 AM - 05:00 PM IST',
        duration TEXT DEFAULT '1 Day',
        format TEXT NOT NULL DEFAULT 'Online',
        venue TEXT NOT NULL,
        registration_deadline TEXT DEFAULT '',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Open',
        status TEXT NOT NULL DEFAULT 'upcoming',
        fees TEXT DEFAULT 'Free',
        capacity INTEGER DEFAULT 50,
        image_url TEXT DEFAULT '',
        featured INTEGER NOT NULL DEFAULT 0,
        skills_covered TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT DEFAULT '',
        description TEXT NOT NULL,
        duration TEXT NOT NULL,
        fees TEXT DEFAULT 'Free',
        eligibility TEXT DEFAULT 'Open to all Science Students',
        curriculum TEXT NOT NULL DEFAULT '[]',
        delivery_mode TEXT DEFAULT 'Online (Self-Paced)',
        certificate_info TEXT DEFAULT '',
        registration_deadline TEXT DEFAULT '',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Available',
        status TEXT NOT NULL DEFAULT 'available',
        instructor TEXT DEFAULT '',
        level TEXT DEFAULT 'Intermediate',
        category TEXT DEFAULT 'Biotechnology',
        image_url TEXT DEFAULT '',
        is_certificate_available INTEGER NOT NULL DEFAULT 0,
        featured INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tag TEXT NOT NULL,
        content TEXT DEFAULT '',
        date TEXT NOT NULL,
        link TEXT DEFAULT '/opportunities',
        is_active INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_verification_records (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        verified_by TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        source_status TEXT NOT NULL,
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS content_records (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS database_backups (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compliance_requests (
        id TEXT PRIMARY KEY,
        reference_id TEXT UNIQUE NOT NULL,
        request_type TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        requester_email TEXT NOT NULL,
        organization TEXT DEFAULT '',
        target_title_or_url TEXT DEFAULT '',
        details TEXT NOT NULL,
        consent_accepted INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Pending',
        resolution_notes TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS submitted_opportunities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        organization TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'job',
        sub_category TEXT DEFAULT '',
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        work_mode TEXT NOT NULL DEFAULT 'On-site',
        experience TEXT DEFAULT 'Not Specified',
        qualification TEXT DEFAULT '',
        branches TEXT NOT NULL DEFAULT '[]',
        skills TEXT NOT NULL DEFAULT '[]',
        salary_or_stipend TEXT DEFAULT 'Not Disclosed',
        salary_tier TEXT DEFAULT 'not_disclosed',
        deadline TEXT DEFAULT '',
        posted_date TEXT NOT NULL,
        source_name TEXT DEFAULT 'Direct Employer / Organizer Submission',
        source_url TEXT DEFAULT '',
        application_url TEXT NOT NULL,
        contact_email TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Pending Verification',
        is_approved INTEGER NOT NULL DEFAULT 0,
        workshop_details TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_messages (
        id TEXT PRIMARY KEY,
        reference_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        subscribed_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        certificate_number TEXT UNIQUE NOT NULL,
        recipient_name TEXT NOT NULL,
        course_title TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        score INTEGER NOT NULL,
        verification_code TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_applications (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_title TEXT NOT NULL,
        company TEXT NOT NULL,
        applicant_name TEXT NOT NULL,
        applicant_email TEXT NOT NULL,
        phone TEXT DEFAULT '',
        qualification TEXT DEFAULT '',
        experience_years TEXT DEFAULT '',
        cover_note TEXT DEFAULT '',
        applied_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Under Review',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discussions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT DEFAULT 'BIO-INEXA Member',
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        upvotes INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS discussion_replies (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        author_role TEXT DEFAULT 'BIO-INEXA Member',
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        upvotes INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'super_admin',
        password_hash TEXT NOT NULL DEFAULT '',
        totp_secret TEXT DEFAULT '',
        totp_enabled INTEGER NOT NULL DEFAULT 0,
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT DEFAULT '',
        password_updated_at TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        jti TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        admin_user_id TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'super_admin',
        ip_address TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER DEFAULT NULL,
        last_active_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        ip_address TEXT DEFAULT '',
        attempted_username TEXT DEFAULT '',
        success INTEGER NOT NULL DEFAULT 0,
        failure_reason TEXT DEFAULT '',
        locked_until TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_password_resets (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT DEFAULT '',
        actor_username TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT DEFAULT '',
        ip_address TEXT DEFAULT '',
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS internships (
        id TEXT PRIMARY KEY,
        slug TEXT DEFAULT '',
        title TEXT NOT NULL,
        organization TEXT NOT NULL,
        location TEXT NOT NULL,
        work_mode TEXT DEFAULT 'On-site Lab',
        stipend TEXT DEFAULT 'Competitive Stipend',
        duration TEXT DEFAULT '3 Months',
        deadline TEXT DEFAULT '',
        category TEXT DEFAULT 'Industrial R&D',
        eligibility TEXT DEFAULT '',
        description TEXT NOT NULL,
        learning_outcomes TEXT NOT NULL DEFAULT '[]',
        skills_required TEXT NOT NULL DEFAULT '[]',
        source_name TEXT DEFAULT 'BIO-INEXA Verified',
        source_url TEXT DEFAULT '',
        application_url TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'Pending Verification',
        verification_notes TEXT DEFAULT '',
        last_verification_date TEXT DEFAULT '',
        is_approved INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opportunity_sync_logs (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Success',
        items_fetched INTEGER NOT NULL DEFAULT 0,
        items_added INTEGER NOT NULL DEFAULT 0,
        items_updated INTEGER NOT NULL DEFAULT 0,
        items_expired INTEGER NOT NULL DEFAULT 0,
        details TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
      CREATE INDEX IF NOT EXISTS idx_jobs_is_approved ON jobs(is_approved);
      CREATE INDEX IF NOT EXISTS idx_jobs_sector ON jobs(sector);
      CREATE INDEX IF NOT EXISTS idx_internships_active ON internships(is_active, is_approved);
      CREATE INDEX IF NOT EXISTS idx_internships_category ON internships(category);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON opportunity_sync_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);
      CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
      CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
      CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_requests(request_type);
      CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_requests(status);
      CREATE INDEX IF NOT EXISTS idx_sub_opps_approved ON submitted_opportunities(is_approved);
      CREATE INDEX IF NOT EXISTS idx_sub_opps_type ON submitted_opportunities(type);
      CREATE INDEX IF NOT EXISTS idx_cert_number ON certificates(certificate_number);
      CREATE INDEX IF NOT EXISTS idx_job_apps_job ON job_applications(job_id);
      CREATE INDEX IF NOT EXISTS idx_disc_replies_topic ON discussion_replies(topic_id);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_attempts_ident ON admin_login_attempts(identifier, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_resets_hash ON admin_password_resets(token_hash);
    `);

    // Ensure verification columns exist on existing databases
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN original_job_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN last_verification_date TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN verification_notes TEXT DEFAULT '';"); } catch (_) {}
    // Ensure pending jobs never carry artificial verification dates
    try {
      this.db.exec(
        "UPDATE jobs SET last_verification_date = '' WHERE verification_status = 'Pending Verification' AND last_verification_date != '';"
      );
    } catch (_) {}

    // Ensure workshop columns exist on existing databases
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN format TEXT DEFAULT 'Online';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN image_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN registration_deadline TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN featured INTEGER DEFAULT 0;"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_workshops_featured ON workshops(featured);"); } catch (_) {}

    // Ensure Phase 09 course columns exist on existing databases
    try { this.db.exec("ALTER TABLE courses ADD COLUMN provider TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN delivery_mode TEXT DEFAULT 'Online (Self-Paced)';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN certificate_info TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN registration_deadline TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN image_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses(featured);"); } catch (_) {}
  }

  // ==========================================
  // JOBS CRUD & VERIFICATION
  // ==========================================

  public getJobs(filter?: {
    search?: string;
    sector?: string;
    location?: string;
    onlyActive?: boolean;
    onlyApproved?: boolean;
    verificationStatus?: string;
  }): DbJob[] {
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];

    if (filter?.onlyActive !== false) {
      sql += ' AND is_active = 1';
    }
    if (filter?.onlyApproved !== false) {
      sql += ' AND is_approved = 1';
    }
    if (filter?.verificationStatus) {
      sql += ' AND verification_status = ?';
      params.push(normalizeVerificationStatus(filter.verificationStatus));
    }
    if (filter?.sector) {
      sql += ' AND sector LIKE ?';
      params.push(`%${filter.sector}%`);
    }
    if (filter?.location) {
      sql += ' AND location LIKE ?';
      params.push(`%${filter.location}%`);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR employer LIKE ? OR description LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }

    sql += ' ORDER BY featured DESC, publication_date DESC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapJobRow);
  }

  public getAllJobsAdmin(): DbJob[] {
    const rows = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapJobRow);
  }

  public getJobById(id: string): DbJob | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapJobRow(row);
  }

  public findDuplicateJob(candidate: {
    id?: string;
    title: string;
    employer: string;
    applicationUrl?: string;
  }): DbJob | null {
    const allJobs = this.getAllJobsAdmin();
    return matchDuplicateJob(candidate, allJobs);
  }

  public createJob(job: Omit<DbJob, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbJob {
    const id = job.id || `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const verStatus = normalizeVerificationStatus(job.verificationStatus);
    const lastVerDate = verStatus === 'Pending Verification' ? '' : (job.lastVerificationDate || '');

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, title, employer, description, location, qualification,
        skills, employment_type, salary, application_url, source, original_job_url,
        publication_date, expiry_date, last_verification_date, verification_status, verification_notes,
        is_active, is_approved, featured, responsibilities, requirements,
        sector, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      id,
      job.title,
      job.employer,
      job.description,
      job.location,
      job.qualification || '',
      JSON.stringify(job.skills || []),
      job.employmentType || 'Full-time',
      job.salary || 'Competitive',
      job.applicationUrl,
      job.source || 'BIO-INEXA Portal',
      job.originalJobUrl || job.applicationUrl || '',
      job.publicationDate || now.split('T')[0],
      job.expiryDate || '',
      lastVerDate,
      verStatus,
      job.verificationNotes || '',
      job.isActive ? 1 : 0,
      job.isApproved ? 1 : 0,
      job.featured ? 1 : 0,
      JSON.stringify(job.responsibilities || []),
      JSON.stringify(job.requirements || []),
      job.sector || 'Biotechnology',
      now,
      now
    );

    return this.getJobById(id)!;
  }

  public updateJob(id: string, updates: Partial<DbJob>): DbJob | null {
    const existing = this.getJobById(id);
    if (!existing) return null;

    const verStatus = updates.verificationStatus !== undefined 
      ? normalizeVerificationStatus(updates.verificationStatus) 
      : normalizeVerificationStatus(existing.verificationStatus);

    const merged: DbJob = {
      ...existing,
      ...updates,
      verificationStatus: verStatus,
      updatedAt: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE jobs SET
        title = ?, employer = ?, description = ?, location = ?,
        qualification = ?, skills = ?, employment_type = ?, salary = ?,
        application_url = ?, source = ?, original_job_url = ?, publication_date = ?, expiry_date = ?,
        last_verification_date = ?, verification_status = ?, verification_notes = ?,
        is_active = ?, is_approved = ?, featured = ?,
        responsibilities = ?, requirements = ?, sector = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.title,
      merged.employer,
      merged.description,
      merged.location,
      merged.qualification,
      JSON.stringify(merged.skills || []),
      merged.employmentType,
      merged.salary,
      merged.applicationUrl,
      merged.source,
      merged.originalJobUrl || merged.applicationUrl || '',
      merged.publicationDate,
      merged.expiryDate,
      merged.lastVerificationDate || '',
      merged.verificationStatus,
      merged.verificationNotes || '',
      merged.isActive ? 1 : 0,
      merged.isApproved ? 1 : 0,
      merged.featured ? 1 : 0,
      JSON.stringify(merged.responsibilities || []),
      JSON.stringify(merged.requirements || []),
      merged.sector,
      merged.updatedAt,
      id
    );

    return this.getJobById(id);
  }

  public deleteJob(id: string): boolean {
    const res = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  public verifyJob(jobId: string, verifiedBy: string, status: string, notes: string = '', customDate?: string): DbJob | null {
    const job = this.getJobById(jobId);
    if (!job) return null;

    const now = new Date().toISOString();
    const recordId = `ver-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const validStatus = normalizeVerificationStatus(status);
    const verDate = validStatus === 'Pending Verification' ? '' : (customDate || now.split('T')[0]);

    this.db.prepare(`
      INSERT INTO job_verification_records (id, job_id, verified_by, verified_at, source_status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recordId, jobId, verifiedBy, now, validStatus, notes);

    const isApproved = validStatus === 'Verified' || validStatus === 'Link Unavailable';
    const isActive = validStatus !== 'Rejected' && validStatus !== 'Expired';

    this.updateJob(jobId, {
      verificationStatus: validStatus,
      lastVerificationDate: verDate,
      verificationNotes: notes,
      isApproved,
      isActive,
      updatedAt: now
    });

    return this.getJobById(jobId);
  }

  public getVerificationRecords(jobId: string): DbVerificationRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM job_verification_records WHERE job_id = ? ORDER BY verified_at DESC'
    ).all(jobId) as any[];

    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      verifiedBy: r.verified_by,
      verifiedAt: r.verified_at,
      sourceStatus: r.source_status,
      notes: r.notes || ''
    }));
  }

  // ==========================================
  // INTERNSHIPS CRUD & VERIFICATION
  // ==========================================

  public getInternships(filter?: {
    search?: string;
    category?: string;
    mode?: string;
    onlyActive?: boolean;
    onlyApproved?: boolean;
  }): DbInternship[] {
    let sql = 'SELECT * FROM internships WHERE 1=1';
    const params: any[] = [];

    if (filter?.onlyActive !== false) {
      sql += ' AND is_active = 1';
    }
    if (filter?.onlyApproved !== false) {
      sql += ' AND is_approved = 1';
    }
    if (filter?.category && filter.category !== 'All' && filter.category !== 'all') {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.mode && filter.mode !== 'All' && filter.mode !== 'all') {
      sql += ' AND work_mode LIKE ?';
      params.push(`%${filter.mode}%`);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR organization LIKE ? OR description LIKE ? OR location LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY featured DESC, created_at DESC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapInternshipRow(r));
  }

  public getAllInternshipsAdmin(): DbInternship[] {
    const rows = this.db.prepare('SELECT * FROM internships ORDER BY featured DESC, created_at DESC').all() as any[];
    return rows.map((r) => this.mapInternshipRow(r));
  }

  public getInternshipById(id: string): DbInternship | null {
    const row = this.db.prepare('SELECT * FROM internships WHERE id = ? OR slug = ?').get(id, id) as any;
    return row ? this.mapInternshipRow(row) : null;
  }

  public createInternship(
    data: Omit<DbInternship, 'id' | 'slug' | 'isVerified' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      slug?: string;
    }
  ): DbInternship {
    const id = data.id || `intern-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const slug =
      data.slug ||
      `${data.title}-${data.organization}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
    const verStatus = normalizeVerificationStatus(data.verificationStatus);
    const lastVerDate =
      data.lastVerificationDate || (verStatus === 'Verified' ? now.split('T')[0] : '');

    this.db.prepare(`
      INSERT INTO internships (
        id, slug, title, organization, location, work_mode, stipend, duration,
        deadline, category, eligibility, description, learning_outcomes, skills_required,
        source_name, source_url, application_url, verification_status, verification_notes,
        last_verification_date, is_approved, is_active, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      slug,
      data.title,
      data.organization,
      data.location || 'India',
      data.workMode || 'On-site Lab',
      data.stipend || 'Competitive Stipend',
      data.duration || '3 Months',
      data.deadline || '',
      data.category || 'Industrial R&D',
      data.eligibility || '',
      data.description || '',
      JSON.stringify(data.learningOutcomes || []),
      JSON.stringify(data.skillsRequired || []),
      data.sourceName || 'BIO-INEXA Admin Portal',
      data.sourceUrl || data.applicationUrl,
      data.applicationUrl,
      verStatus,
      data.verificationNotes || '',
      lastVerDate,
      data.isApproved ? 1 : 0,
      data.isActive !== false ? 1 : 0,
      data.featured ? 1 : 0,
      now,
      now
    );

    return this.getInternshipById(id)!;
  }

  public updateInternship(id: string, updates: Partial<DbInternship>): DbInternship | null {
    const existing = this.getInternshipById(id);
    if (!existing) return null;

    const verStatus =
      updates.verificationStatus !== undefined
        ? normalizeVerificationStatus(updates.verificationStatus)
        : normalizeVerificationStatus(existing.verificationStatus);

    const merged: DbInternship = {
      ...existing,
      ...updates,
      verificationStatus: verStatus,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE internships SET
        slug = ?, title = ?, organization = ?, location = ?, work_mode = ?, stipend = ?,
        duration = ?, deadline = ?, category = ?, eligibility = ?, description = ?,
        learning_outcomes = ?, skills_required = ?, source_name = ?, source_url = ?,
        application_url = ?, verification_status = ?, verification_notes = ?,
        last_verification_date = ?, is_approved = ?, is_active = ?, featured = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.slug,
      merged.title,
      merged.organization,
      merged.location,
      merged.workMode,
      merged.stipend,
      merged.duration,
      merged.deadline,
      merged.category,
      merged.eligibility,
      merged.description,
      JSON.stringify(merged.learningOutcomes || []),
      JSON.stringify(merged.skillsRequired || []),
      merged.sourceName,
      merged.sourceUrl,
      merged.applicationUrl,
      merged.verificationStatus,
      merged.verificationNotes || '',
      merged.lastVerificationDate || '',
      merged.isApproved ? 1 : 0,
      merged.isActive ? 1 : 0,
      merged.featured ? 1 : 0,
      merged.updatedAt,
      existing.id
    );

    return this.getInternshipById(existing.id);
  }

  public verifyInternship(
    internshipId: string,
    _verifiedBy: string,
    status: string,
    notes: string = '',
    customDate?: string
  ): DbInternship | null {
    const existing = this.getInternshipById(internshipId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const verDate = customDate || now.split('T')[0];
    const validStatus = normalizeVerificationStatus(status);
    const isApproved = validStatus === 'Verified' || validStatus === 'Link Unavailable';
    const isActive = validStatus !== 'Rejected' && validStatus !== 'Expired';

    return this.updateInternship(existing.id, {
      verificationStatus: validStatus,
      verificationNotes: notes,
      lastVerificationDate: verDate,
      isApproved,
      isActive,
      updatedAt: now,
    });
  }

  public deleteInternship(id: string): boolean {
    const res = this.db.prepare('DELETE FROM internships WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  private mapInternshipRow(r: any): DbInternship {
    let learningOutcomes: string[] = [];
    let skillsRequired: string[] = [];
    try { learningOutcomes = JSON.parse(r.learning_outcomes || '[]'); } catch { learningOutcomes = []; }
    try { skillsRequired = JSON.parse(r.skills_required || '[]'); } catch { skillsRequired = []; }
    const verStatus = normalizeVerificationStatus(r.verification_status);

    return {
      id: r.id,
      slug: r.slug || r.id,
      title: r.title,
      organization: r.organization,
      location: r.location,
      workMode: r.work_mode || 'On-site Lab',
      stipend: r.stipend || 'Competitive Stipend',
      duration: r.duration || '3 Months',
      deadline: r.deadline || '',
      category: r.category || 'Industrial R&D',
      eligibility: r.eligibility || '',
      description: r.description,
      learningOutcomes,
      skillsRequired,
      sourceName: r.source_name || 'BIO-INEXA Verified',
      sourceUrl: r.source_url || r.application_url,
      applicationUrl: r.application_url,
      verificationStatus: verStatus,
      verificationNotes: r.verification_notes || '',
      lastVerificationDate: r.last_verification_date || '',
      isVerified: verStatus === 'Verified',
      isApproved: r.is_approved === 1,
      isActive: r.is_active === 1,
      featured: r.featured === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // ==========================================
  // SYNCHRONIZATION LOGS & DASHBOARD KPI STATS
  // ==========================================

  public recordSyncLog(input: {
    sourceId: string;
    sourceName: string;
    status: 'Success' | 'Partial' | 'Error';
    itemsFetched?: number;
    itemsAdded?: number;
    itemsUpdated?: number;
    itemsExpired?: number;
    details?: string;
  }): DbSyncLog {
    const id = `sync-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO opportunity_sync_logs (
        id, source_id, source_name, status, items_fetched, items_added,
        items_updated, items_expired, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.sourceId,
      input.sourceName,
      input.status,
      input.itemsFetched ?? 0,
      input.itemsAdded ?? 0,
      input.itemsUpdated ?? 0,
      input.itemsExpired ?? 0,
      input.details || '',
      createdAt
    );
    return {
      id,
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      status: input.status,
      itemsFetched: input.itemsFetched ?? 0,
      itemsAdded: input.itemsAdded ?? 0,
      itemsUpdated: input.itemsUpdated ?? 0,
      itemsExpired: input.itemsExpired ?? 0,
      details: input.details || '',
      createdAt,
    };
  }

  public getSyncLogs(limit: number = 50): DbSyncLog[] {
    const rows = this.db
      .prepare('SELECT * FROM opportunity_sync_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      status: (r.status as DbSyncLog['status']) || 'Success',
      itemsFetched: r.items_fetched ?? 0,
      itemsAdded: r.items_added ?? 0,
      itemsUpdated: r.items_updated ?? 0,
      itemsExpired: r.items_expired ?? 0,
      details: r.details || '',
      createdAt: r.created_at,
    }));
  }

  public getDashboardStats(): AdminDashboardStats {
    const jobs = this.getAllJobsAdmin();
    const internships = this.getAllInternshipsAdmin();
    const workshops = this.getWorkshops();
    const courses = this.getCourses();
    const submissions = this.getSubmittedOpportunities({ onlyApproved: false });
    const complianceRequests = this.getComplianceRequests();
    const contactMessagesCount = (this.db.prepare('SELECT COUNT(*) as c FROM contact_messages').get() as any).c || 0;
    const syncRunsCount = (this.db.prepare('SELECT COUNT(*) as c FROM opportunity_sync_logs').get() as any).c || 0;
    const backupsCount = (this.db.prepare('SELECT COUNT(*) as c FROM database_backups').get() as any).c || 0;
    const auditLogsCount = (this.db.prepare('SELECT COUNT(*) as c FROM admin_audit_logs').get() as any).c || 0;
    const announcementsCount = (this.db.prepare('SELECT COUNT(*) as c FROM announcements').get() as any).c || 0;

    return computeAdminDashboardStats({
      jobs,
      internships,
      workshops,
      courses,
      submissions,
      complianceRequests,
      contactMessagesCount,
      syncRunsCount,
      backupsCount,
      auditLogsCount,
      announcementsCount,
    });
  }

  // ==========================================
  // WORKSHOPS CRUD
  // ==========================================

  public getWorkshops(filter?: boolean | {
    onlyActive?: boolean;
    status?: string;
    format?: string;
    featured?: boolean;
    search?: string;
  }): DbWorkshop[] {
    let sql = 'SELECT * FROM workshops WHERE 1=1';
    const params: any[] = [];

    if (typeof filter === 'boolean') {
      if (filter) {
        sql += " AND status != 'completed'";
      }
    } else if (filter) {
      if (filter.status && filter.status !== 'all') {
        sql += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter.format && filter.format !== 'all') {
        sql += ' AND format = ?';
        params.push(filter.format);
      }
      if (filter.featured !== undefined) {
        sql += ' AND featured = ?';
        params.push(filter.featured ? 1 : 0);
      }
      if (filter.search) {
        sql += ' AND (name LIKE ? OR instructor LIKE ? OR description LIKE ? OR venue LIKE ?)';
        const term = `%${filter.search}%`;
        params.push(term, term, term, term);
      }
    }

    sql += ' ORDER BY featured DESC, date ASC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapWorkshopRow);
  }

  public getWorkshopById(id: string): DbWorkshop | null {
    const row = this.db.prepare('SELECT * FROM workshops WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapWorkshopRow(row);
  }

  public createWorkshop(data: Omit<DbWorkshop, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbWorkshop {
    const id = data.id || `ws-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO workshops (
        id, name, description, instructor, date, time, duration,
        format, venue, registration_deadline, registration_link,
        availability, status, fees, capacity, image_url,
        featured, skills_covered, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.instructor || '',
      data.date,
      data.time || '09:30 AM - 04:30 PM IST',
      data.duration || '1 Day',
      data.format || 'Online',
      data.venue,
      data.registrationDeadline || '',
      data.registrationLink,
      data.availability || 'Open',
      data.status || 'upcoming',
      data.fees || 'Free',
      data.capacity || 50,
      data.imageUrl || '',
      data.featured ? 1 : 0,
      JSON.stringify(data.skillsCovered || []),
      now,
      now
    );

    return this.getWorkshopById(id)!;
  }

  public updateWorkshop(id: string, updates: Partial<DbWorkshop>): DbWorkshop | null {
    const existing = this.getWorkshopById(id);
    if (!existing) return null;

    const merged: DbWorkshop = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE workshops SET
        name = ?, description = ?, instructor = ?, date = ?,
        time = ?, duration = ?, format = ?, venue = ?,
        registration_deadline = ?, registration_link = ?,
        availability = ?, status = ?, fees = ?, capacity = ?,
        image_url = ?, featured = ?, skills_covered = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description,
      merged.instructor,
      merged.date,
      merged.time,
      merged.duration,
      merged.format,
      merged.venue,
      merged.registrationDeadline,
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.fees,
      merged.capacity,
      merged.imageUrl || '',
      merged.featured ? 1 : 0,
      JSON.stringify(merged.skillsCovered || []),
      merged.updatedAt,
      id
    );

    return this.getWorkshopById(id);
  }

  public deleteWorkshop(id: string): boolean {
    const res = this.db.prepare('DELETE FROM workshops WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // COURSES CRUD
  // ==========================================

  public getCourses(filter?: boolean | {
    onlyAvailable?: boolean;
    category?: string;
    status?: string;
    featured?: boolean;
    search?: string;
  }): DbCourse[] {
    let sql = 'SELECT * FROM courses WHERE 1=1';
    const params: any[] = [];

    if (typeof filter === 'boolean') {
      if (filter) {
        sql += " AND status NOT IN ('closed', 'archived')";
      }
    } else if (filter) {
      if (filter.onlyAvailable) {
        sql += " AND status NOT IN ('closed', 'archived')";
      }
      if (filter.status && filter.status !== 'all') {
        const norm = normalizeDbCourseStatus(filter.status);
        if (norm === 'closed') {
          sql += " AND status IN ('closed', 'archived')";
        } else {
          sql += " AND status NOT IN ('closed', 'archived')";
        }
      }
      if (filter.category && filter.category !== 'all') {
        sql += ' AND LOWER(category) = LOWER(?)';
        params.push(filter.category);
      }
      if (filter.featured !== undefined) {
        sql += ' AND featured = ?';
        params.push(filter.featured ? 1 : 0);
      }
      if (filter.search) {
        sql += ' AND (name LIKE ? OR provider LIKE ? OR instructor LIKE ? OR description LIKE ? OR category LIKE ?)';
        const term = `%${filter.search}%`;
        params.push(term, term, term, term, term);
      }
    }

    sql += ' ORDER BY featured DESC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapCourseRow);
  }

  public getCourseById(id: string): DbCourse | null {
    const row = this.db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapCourseRow(row);
  }

  public createCourse(
    data: Omit<DbCourse, 'id' | 'createdAt' | 'updatedAt' | 'provider' | 'deliveryMode' | 'certificateInfo' | 'registrationDeadline' | 'isCertificateAvailable'> & {
      id?: string;
      provider?: string;
      deliveryMode?: string;
      certificateInfo?: string;
      registrationDeadline?: string;
      isCertificateAvailable?: boolean;
    }
  ): DbCourse {
    const id = data.id || `course-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const normStatus = normalizeDbCourseStatus(data.status);
    const certInfo = (data.certificateInfo || '').trim();
    const hasCert = Boolean(certInfo) || Boolean(data.isCertificateAvailable);

    this.db.prepare(`
      INSERT INTO courses (
        id, name, provider, description, duration, fees, eligibility,
        curriculum, delivery_mode, certificate_info, registration_deadline,
        registration_link, availability, status, instructor, level, category,
        image_url, is_certificate_available, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.provider || data.instructor || 'Course Provider',
      data.description,
      data.duration || 'Self-Paced',
      data.fees || 'Free',
      data.eligibility || 'Life Sciences & Biotechnology Students',
      JSON.stringify(data.curriculum || []),
      data.deliveryMode || 'Online (Self-Paced)',
      certInfo,
      data.registrationDeadline || 'Open / Rolling',
      data.registrationLink,
      normStatus === 'closed' ? 'Closed' : (data.availability || 'Available'),
      normStatus,
      data.instructor || data.provider || '',
      data.level || 'Intermediate',
      data.category || 'Biotechnology',
      data.imageUrl || '',
      hasCert ? 1 : 0,
      data.featured ? 1 : 0,
      now,
      now
    );

    return this.getCourseById(id)!;
  }

  public updateCourse(id: string, updates: Partial<DbCourse>): DbCourse | null {
    const existing = this.getCourseById(id);
    if (!existing) return null;

    const mergedStatus = updates.status !== undefined
      ? normalizeDbCourseStatus(updates.status)
      : normalizeDbCourseStatus(existing.status);

    const certInfo = updates.certificateInfo !== undefined
      ? updates.certificateInfo.trim()
      : existing.certificateInfo;

    const merged: DbCourse = {
      ...existing,
      ...updates,
      status: mergedStatus,
      availability: updates.availability !== undefined
        ? updates.availability
        : mergedStatus === 'closed'
        ? 'Closed'
        : 'Available',
      certificateInfo: certInfo,
      isCertificateAvailable: updates.certificateInfo !== undefined
        ? Boolean(certInfo)
        : (updates.isCertificateAvailable !== undefined ? updates.isCertificateAvailable : existing.isCertificateAvailable),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE courses SET
        name = ?, provider = ?, description = ?, duration = ?, fees = ?,
        eligibility = ?, curriculum = ?, delivery_mode = ?, certificate_info = ?,
        registration_deadline = ?, registration_link = ?, availability = ?,
        status = ?, instructor = ?, level = ?, category = ?, image_url = ?,
        is_certificate_available = ?, featured = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.provider,
      merged.description,
      merged.duration,
      merged.fees,
      merged.eligibility,
      JSON.stringify(merged.curriculum || []),
      merged.deliveryMode,
      merged.certificateInfo || '',
      merged.registrationDeadline || '',
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.instructor,
      merged.level,
      merged.category,
      merged.imageUrl || '',
      merged.isCertificateAvailable ? 1 : 0,
      merged.featured ? 1 : 0,
      merged.updatedAt,
      id
    );

    return this.getCourseById(id);
  }

  public deleteCourse(id: string): boolean {
    const res = this.db.prepare('DELETE FROM courses WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // ANNOUNCEMENTS CRUD
  // ==========================================

  public getAnnouncements(onlyActive: boolean = true): DbAnnouncement[] {
    let sql = 'SELECT * FROM announcements';
    if (onlyActive) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY priority DESC, date DESC, created_at DESC';

    const rows = this.db.prepare(sql).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tag: r.tag,
      content: r.content || '',
      date: r.date,
      link: r.link || '/opportunities',
      isActive: r.is_active === 1,
      priority: r.priority || 0,
      createdAt: r.created_at
    }));
  }

  public createAnnouncement(data: Omit<DbAnnouncement, 'id' | 'createdAt'> & { id?: string }): DbAnnouncement {
    const id = data.id || `ann-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO announcements (id, title, tag, content, date, link, is_active, priority, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.tag,
      data.content || '',
      data.date || now.split('T')[0],
      data.link || '/opportunities',
      data.isActive ? 1 : 0,
      data.priority || 0,
      now
    );

    const row = this.db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
    return {
      id: row.id,
      title: row.title,
      tag: row.tag,
      content: row.content,
      date: row.date,
      link: row.link,
      isActive: row.is_active === 1,
      priority: row.priority,
      createdAt: row.created_at
    };
  }

  public updateAnnouncement(id: string, updates: Partial<DbAnnouncement>): DbAnnouncement | null {
    const rows = this.db.prepare('SELECT * FROM announcements WHERE id = ?').all(id) as any[];
    if (rows.length === 0) return null;
    const current = rows[0];

    const title = updates.title !== undefined ? updates.title : current.title;
    const tag = updates.tag !== undefined ? updates.tag : current.tag;
    const content = updates.content !== undefined ? updates.content : current.content;
    const date = updates.date !== undefined ? updates.date : current.date;
    const link = updates.link !== undefined ? updates.link : current.link;
    const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : current.is_active;
    const priority = updates.priority !== undefined ? updates.priority : current.priority;

    this.db.prepare(`
      UPDATE announcements SET
        title = ?, tag = ?, content = ?, date = ?, link = ?, is_active = ?, priority = ?
      WHERE id = ?
    `).run(title, tag, content, date, link, isActive, priority, id);

    const updated = this.db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
    return {
      id: updated.id,
      title: updated.title,
      tag: updated.tag,
      content: updated.content,
      date: updated.date,
      link: updated.link,
      isActive: updated.is_active === 1,
      priority: updated.priority,
      createdAt: updated.created_at
    };
  }

  public deleteAnnouncement(id: string): boolean {
    const res = this.db.prepare('DELETE FROM announcements WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // CONTENT MANAGEMENT RECORDS
  // ==========================================

  public getContent(key: string, defaultValue: any = null): any {
    const row = this.db.prepare('SELECT value FROM content_records WHERE key = ?').get(key) as any;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  public setContent(key: string, value: any, updatedBy: string = 'system'): void {
    const now = new Date().toISOString();
    const id = `content-${key}`;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    this.db.prepare(`
      INSERT INTO content_records (id, key, value, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(id, key, serialized, now, updatedBy);
  }

  // ==========================================
  // ATOMIC DATABASE BACKUPS
  // ==========================================

  public createBackup(): { success: boolean; filename: string; path: string; sizeBytes: number } {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `bionexa_backup_${timestamp}.db`;
    const targetPath = path.resolve(this.backupDir, filename);

    if (this.dbPath === ':memory:') {
      // In-memory backup: dump table counts
      const backupId = `bk-${Date.now()}`;
      this.db.prepare(`
        INSERT INTO database_backups (id, filename, path, size_bytes, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(backupId, filename, targetPath, 1024, now.toISOString(), 'completed');

      return {
        success: true,
        filename,
        path: targetPath,
        sizeBytes: 1024
      };
    }

    try {
      // SQLite VACUUM INTO produces an atomic point-in-time binary snapshot
      const sanitizedPath = targetPath.replace(/'/g, "''");
      this.db.exec(`VACUUM INTO '${sanitizedPath}'`);

      const stats = fs.statSync(targetPath);
      const backupId = `bk-${Date.now()}`;

      this.db.prepare(`
        INSERT INTO database_backups (id, filename, path, size_bytes, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(backupId, filename, targetPath, stats.size, now.toISOString(), 'completed');

      return {
        success: true,
        filename,
        path: targetPath,
        sizeBytes: stats.size
      };
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      throw new Error(`Database backup failed: ${err.message}`);
    }
  }

  public listBackups(): DbBackupRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM database_backups ORDER BY created_at DESC'
    ).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      path: r.path,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      status: r.status
    }));
  }

  // ==========================================
  // COMPLIANCE, PRIVACY & GRIEVANCE REQUESTS
  // ==========================================

  public createComplianceRequest(data: {
    referenceId?: string;
    requestType: DbComplianceRequestType;
    subCategory: string;
    requesterName: string;
    requesterEmail: string;
    organization?: string;
    targetTitleOrUrl?: string;
    details: string;
    consentAccepted: boolean;
  }): DbComplianceRequest {
    const now = new Date().toISOString();
    const id = `comp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const referenceId =
      data.referenceId ||
      `BN-COMP-${now.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    this.db.prepare(`
      INSERT INTO compliance_requests (
        id, reference_id, request_type, sub_category, requester_name, requester_email,
        organization, target_title_or_url, details, consent_accepted, status, resolution_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      referenceId,
      data.requestType,
      data.subCategory,
      data.requesterName,
      data.requesterEmail,
      data.organization || '',
      data.targetTitleOrUrl || '',
      data.details,
      data.consentAccepted ? 1 : 0,
      'Pending',
      '',
      now,
      now
    );

    return this.getComplianceRequestById(id)!;
  }

  public getComplianceRequestById(id: string): DbComplianceRequest | null {
    const row = this.db.prepare('SELECT * FROM compliance_requests WHERE id = ?').get(id) as any;
    return row ? this.mapComplianceRow(row) : null;
  }

  public getComplianceRequests(filter?: {
    requestType?: string;
    status?: string;
  }): DbComplianceRequest[] {
    let sql = 'SELECT * FROM compliance_requests WHERE 1=1';
    const params: any[] = [];
    if (filter?.requestType && filter.requestType !== 'all') {
      sql += ' AND request_type = ?';
      params.push(filter.requestType);
    }
    if (filter?.status && filter.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapComplianceRow(r));
  }

  public updateComplianceRequestStatus(
    id: string,
    status: DbComplianceRequestStatus,
    resolutionNotes?: string
  ): DbComplianceRequest | null {
    const existing = this.getComplianceRequestById(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE compliance_requests
      SET status = ?, resolution_notes = ?, updated_at = ?
      WHERE id = ?
    `).run(status, resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes, now, id);
    return this.getComplianceRequestById(id);
  }

  public deleteComplianceRequest(id: string): boolean {
    const result = this.db.prepare('DELETE FROM compliance_requests WHERE id = ?').run(id);
    return (result as any).changes > 0;
  }

  private mapComplianceRow(r: any): DbComplianceRequest {
    return {
      id: r.id,
      referenceId: r.reference_id,
      requestType: r.request_type as DbComplianceRequestType,
      subCategory: r.sub_category,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
      organization: r.organization || '',
      targetTitleOrUrl: r.target_title_or_url || '',
      details: r.details,
      consentAccepted: r.consent_accepted === 1,
      status: (r.status as DbComplianceRequestStatus) || 'Pending',
      resolutionNotes: r.resolution_notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // ==========================================
  // SUBMITTED OPPORTUNITIES (MODERATION QUEUE)
  // ==========================================

  public createSubmittedOpportunity(
    data: Omit<DbSubmittedOpportunity, 'id' | 'createdAt' | 'updatedAt' | 'postedDate' | 'isApproved' | 'status'> & {
      id?: string;
      postedDate?: string;
      isApproved?: boolean;
      status?: string;
    }
  ): DbSubmittedOpportunity {
    const id = data.id || `sub-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const postedDate = data.postedDate || now.split('T')[0];

    this.db.prepare(`
      INSERT INTO submitted_opportunities (
        id, title, organization, type, sub_category, description, location, work_mode,
        experience, qualification, branches, skills, salary_or_stipend, salary_tier,
        deadline, posted_date, source_name, source_url, application_url, contact_email,
        status, is_approved, workshop_details, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.organization,
      data.type || 'job',
      data.subCategory || '',
      data.description || '',
      data.location || 'All India',
      data.workMode || 'On-site',
      data.experience || 'Not Specified',
      data.qualification || '',
      JSON.stringify(data.branches || []),
      JSON.stringify(data.skills || []),
      data.salaryOrStipend || 'Not Disclosed',
      data.salaryTier || 'not_disclosed',
      data.deadline || '',
      postedDate,
      data.sourceName || 'Direct Employer / Organizer Submission',
      data.sourceUrl || data.applicationUrl,
      data.applicationUrl,
      data.contactEmail || '',
      data.status || 'Pending Verification',
      data.isApproved ? 1 : 0,
      data.workshopDetails ? JSON.stringify(data.workshopDetails) : null,
      now,
      now
    );

    return this.getSubmittedOpportunityById(id)!;
  }

  public getSubmittedOpportunities(filter?: {
    onlyApproved?: boolean;
    type?: string;
    search?: string;
  }): DbSubmittedOpportunity[] {
    let sql = 'SELECT * FROM submitted_opportunities WHERE 1=1';
    const params: any[] = [];

    if (filter?.onlyApproved) {
      sql += ' AND is_approved = 1';
    }
    if (filter?.type && filter.type !== 'all') {
      sql += ' AND LOWER(type) = LOWER(?)';
      params.push(filter.type);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR organization LIKE ? OR description LIKE ? OR location LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapSubmittedOpportunityRow(r));
  }

  public getSubmittedOpportunityById(id: string): DbSubmittedOpportunity | null {
    const row = this.db.prepare('SELECT * FROM submitted_opportunities WHERE id = ?').get(id) as any;
    return row ? this.mapSubmittedOpportunityRow(row) : null;
  }

  public updateSubmittedOpportunity(
    id: string,
    updates: Partial<DbSubmittedOpportunity>
  ): DbSubmittedOpportunity | null {
    const existing = this.getSubmittedOpportunityById(id);
    if (!existing) return null;

    const merged: DbSubmittedOpportunity = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE submitted_opportunities SET
        title = ?, organization = ?, type = ?, sub_category = ?, description = ?,
        location = ?, work_mode = ?, experience = ?, qualification = ?,
        branches = ?, skills = ?, salary_or_stipend = ?, salary_tier = ?,
        deadline = ?, source_name = ?, source_url = ?, application_url = ?,
        contact_email = ?, status = ?, is_approved = ?, workshop_details = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.title,
      merged.organization,
      merged.type,
      merged.subCategory,
      merged.description,
      merged.location,
      merged.workMode,
      merged.experience,
      merged.qualification,
      JSON.stringify(merged.branches || []),
      JSON.stringify(merged.skills || []),
      merged.salaryOrStipend,
      merged.salaryTier,
      merged.deadline,
      merged.sourceName,
      merged.sourceUrl,
      merged.applicationUrl,
      merged.contactEmail,
      merged.status,
      merged.isApproved ? 1 : 0,
      merged.workshopDetails ? JSON.stringify(merged.workshopDetails) : null,
      merged.updatedAt,
      id
    );

    return this.getSubmittedOpportunityById(id);
  }

  public deleteSubmittedOpportunity(id: string): boolean {
    const res = this.db.prepare('DELETE FROM submitted_opportunities WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  private mapSubmittedOpportunityRow(r: any): DbSubmittedOpportunity {
    let branches: string[] = [];
    let skills: string[] = [];
    let workshopDetails: Record<string, any> | null = null;
    try { branches = JSON.parse(r.branches || '[]'); } catch { branches = []; }
    try { skills = JSON.parse(r.skills || '[]'); } catch { skills = []; }
    try { workshopDetails = r.workshop_details ? JSON.parse(r.workshop_details) : null; } catch { workshopDetails = null; }

    return {
      id: r.id,
      title: r.title,
      organization: r.organization,
      type: r.type,
      subCategory: r.sub_category || '',
      description: r.description,
      location: r.location,
      workMode: r.work_mode || 'On-site',
      experience: r.experience || 'Not Specified',
      qualification: r.qualification || '',
      branches,
      skills,
      salaryOrStipend: r.salary_or_stipend || 'Not Disclosed',
      salaryTier: r.salary_tier || 'not_disclosed',
      deadline: r.deadline || '',
      postedDate: r.posted_date,
      sourceName: r.source_name || 'Direct Employer / Organizer Submission',
      sourceUrl: r.source_url || r.application_url,
      applicationUrl: r.application_url,
      contactEmail: r.contact_email || '',
      status: r.status || 'Pending Verification',
      isApproved: r.is_approved === 1,
      workshopDetails,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // ==========================================
  // CONTACT MESSAGES & NEWSLETTER SUBSCRIBERS
  // ==========================================

  public createContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): DbContactMessage {
    const now = new Date().toISOString();
    const id = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const referenceId = `BN-MSG-${now.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    this.db.prepare(`
      INSERT INTO contact_messages (id, reference_id, name, email, subject, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, referenceId, data.name, data.email, data.subject, data.message, 'New', now);

    const row = this.db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as any;
    return {
      id: row.id,
      referenceId: row.reference_id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.created_at
    };
  }

  public getContactMessages(): DbContactMessage[] {
    const rows = this.db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      referenceId: r.reference_id,
      name: r.name,
      email: r.email,
      subject: r.subject,
      message: r.message,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  public subscribeNewsletter(email: string): { subscriber: DbNewsletterSubscriber; alreadySubscribed: boolean } {
    const normalized = email.trim().toLowerCase();
    const existing = this.db.prepare('SELECT * FROM newsletter_subscribers WHERE LOWER(email) = LOWER(?)').get(normalized) as any;
    if (existing) {
      if (existing.is_active !== 1) {
        this.db.prepare('UPDATE newsletter_subscribers SET is_active = 1 WHERE id = ?').run(existing.id);
      }
      return {
        alreadySubscribed: existing.is_active === 1,
        subscriber: {
          id: existing.id,
          email: existing.email,
          subscribedAt: existing.subscribed_at,
          isActive: true
        }
      };
    }

    const id = `sub-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO newsletter_subscribers (id, email, subscribed_at, is_active)
      VALUES (?, ?, ?, 1)
    `).run(id, normalized, now);

    return {
      alreadySubscribed: false,
      subscriber: {
        id,
        email: normalized,
        subscribedAt: now,
        isActive: true
      }
    };
  }

  public getNewsletterSubscribers(): DbNewsletterSubscriber[] {
    const rows = this.db.prepare('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      subscribedAt: r.subscribed_at,
      isActive: r.is_active === 1
    }));
  }

  // ==========================================
  // ACADEMY CERTIFICATES REGISTRY
  // ==========================================

  public verifyCertificate(certificateNumber: string): DbCertificate | null {
    const clean = certificateNumber.trim().toUpperCase();
    if (!clean) return null;
    const row = this.db.prepare('SELECT * FROM certificates WHERE UPPER(certificate_number) = ?').get(clean) as any;
    if (!row) return null;
    return {
      id: row.id,
      certificateNumber: row.certificate_number,
      recipientName: row.recipient_name,
      courseTitle: row.course_title,
      issueDate: row.issue_date,
      score: row.score,
      verificationCode: row.verification_code,
      createdAt: row.created_at
    };
  }

  public createCertificate(data: {
    id?: string;
    certificateNumber?: string;
    recipientName: string;
    courseTitle: string;
    issueDate?: string;
    score: number;
    verificationCode?: string;
  }): DbCertificate {
    const now = new Date().toISOString();
    const id = data.id || `cert-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const prefix = data.courseTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'ACAD';
    const certificateNumber =
      (data.certificateNumber || `BN-${new Date().getFullYear()}-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    const verificationCode =
      data.verificationCode || `VERIFIED-BIO-INEXA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const issueDate = data.issueDate || now.split('T')[0];

    this.db.prepare(`
      INSERT INTO certificates (id, certificate_number, recipient_name, course_title, issue_date, score, verification_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(certificate_number) DO UPDATE SET
        recipient_name = excluded.recipient_name,
        course_title = excluded.course_title,
        score = excluded.score
    `).run(id, certificateNumber, data.recipientName, data.courseTitle, issueDate, Math.round(data.score), verificationCode, now);

    return this.verifyCertificate(certificateNumber)!;
  }

  public getCertificates(): DbCertificate[] {
    const rows = this.db.prepare('SELECT * FROM certificates ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      certificateNumber: r.certificate_number,
      recipientName: r.recipient_name,
      courseTitle: r.course_title,
      issueDate: r.issue_date,
      score: r.score,
      verificationCode: r.verification_code,
      createdAt: r.created_at
    }));
  }

  // ==========================================
  // JOB APPLICATIONS
  // ==========================================

  public createJobApplication(
    data: Omit<DbJobApplication, 'id' | 'appliedDate' | 'status' | 'createdAt'> & {
      id?: string;
      appliedDate?: string;
      status?: DbJobApplication['status'];
    }
  ): DbJobApplication {
    const now = new Date().toISOString();
    const id = data.id || `app-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const appliedDate = data.appliedDate || now.split('T')[0];
    const status = data.status || 'Under Review';

    this.db.prepare(`
      INSERT INTO job_applications (
        id, job_id, job_title, company, applicant_name, applicant_email,
        phone, qualification, experience_years, cover_note, applied_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.jobId,
      data.jobTitle,
      data.company,
      data.applicantName,
      data.applicantEmail,
      data.phone || '',
      data.qualification || '',
      data.experienceYears || '',
      data.coverNote || '',
      appliedDate,
      status,
      now
    );

    const row = this.db.prepare('SELECT * FROM job_applications WHERE id = ?').get(id) as any;
    return this.mapApplicationRow(row);
  }

  public getJobApplications(): DbJobApplication[] {
    const rows = this.db.prepare('SELECT * FROM job_applications ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => this.mapApplicationRow(r));
  }

  public updateJobApplicationStatus(id: string, status: DbJobApplication['status']): DbJobApplication | null {
    const res = this.db.prepare('UPDATE job_applications SET status = ? WHERE id = ?').run(status, id) as any;
    if ((res.changes ?? 0) === 0) return null;
    const row = this.db.prepare('SELECT * FROM job_applications WHERE id = ?').get(id) as any;
    return row ? this.mapApplicationRow(row) : null;
  }

  private mapApplicationRow(r: any): DbJobApplication {
    return {
      id: r.id,
      jobId: r.job_id,
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
      createdAt: r.created_at
    };
  }

  // ==========================================
  // COMMUNITY DISCUSSIONS
  // ==========================================

  public getDiscussions(category?: string): DbDiscussionTopic[] {
    let sql = 'SELECT * FROM discussions';
    const params: any[] = [];
    if (category && category !== 'all') {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY created_at DESC';
    const topics = this.db.prepare(sql).all(...params) as any[];
    const replyStmt = this.db.prepare('SELECT * FROM discussion_replies WHERE topic_id = ? ORDER BY created_at ASC');

    return topics.map((t) => {
      const replies = replyStmt.all(t.id) as any[];
      return {
        id: t.id,
        title: t.title,
        authorName: t.author_name,
        authorRole: t.author_role || 'BIO-INEXA Member',
        category: t.category,
        content: t.content,
        createdAt: t.created_at,
        upvotes: t.upvotes,
        replies: replies.map((r) => ({
          id: r.id,
          topicId: r.topic_id,
          authorName: r.author_name,
          authorRole: r.author_role || 'BIO-INEXA Member',
          content: r.content,
          createdAt: r.created_at,
          upvotes: r.upvotes
        }))
      };
    });
  }

  public createDiscussion(data: {
    id?: string;
    title: string;
    authorName: string;
    authorRole?: string;
    category: string;
    content: string;
    createdAt?: string;
    upvotes?: number;
    replies?: Array<{ id?: string; authorName: string; authorRole?: string; content: string; createdAt?: string; upvotes?: number }>;
  }): DbDiscussionTopic {
    const id = data.id || `disc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = data.createdAt || new Date().toISOString().split('T')[0];

    this.db.prepare(`
      INSERT INTO discussions (id, title, author_name, author_role, category, content, created_at, upvotes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.authorName,
      data.authorRole || 'BIO-INEXA Member',
      data.category,
      data.content,
      createdAt,
      data.upvotes ?? 1
    );

    if (Array.isArray(data.replies)) {
      for (const r of data.replies) {
        this.addDiscussionReply(id, r);
      }
    }

    return this.getDiscussions().find((t) => t.id === id)!;
  }

  public addDiscussionReply(
    topicId: string,
    data: { id?: string; authorName: string; authorRole?: string; content: string; createdAt?: string; upvotes?: number }
  ): DbDiscussionReply | null {
    const topic = this.db.prepare('SELECT id FROM discussions WHERE id = ?').get(topicId) as any;
    if (!topic) return null;

    const id = data.id || `rep-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = data.createdAt || new Date().toISOString().split('T')[0];

    this.db.prepare(`
      INSERT INTO discussion_replies (id, topic_id, author_name, author_role, content, created_at, upvotes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, topicId, data.authorName, data.authorRole || 'BIO-INEXA Member', data.content, createdAt, data.upvotes ?? 0);

    return {
      id,
      topicId,
      authorName: data.authorName,
      authorRole: data.authorRole || 'BIO-INEXA Member',
      content: data.content,
      createdAt,
      upvotes: data.upvotes ?? 0
    };
  }

  public upvoteDiscussion(topicId: string): DbDiscussionTopic | null {
    const res = this.db.prepare('UPDATE discussions SET upvotes = upvotes + 1 WHERE id = ?').run(topicId) as any;
    if ((res.changes ?? 0) === 0) return null;
    return this.getDiscussions().find((t) => t.id === topicId) || null;
  }

  // ==========================================
  // HELPER MAPPERS
  // ==========================================

  private mapJobRow(r: any): DbJob {
    let skills: string[] = [];
    let responsibilities: string[] = [];
    let requirements: string[] = [];

    try {
      skills = JSON.parse(r.skills || '[]');
    } catch {
      skills = [];
    }

    try {
      responsibilities = JSON.parse(r.responsibilities || '[]');
    } catch {
      responsibilities = [];
    }

    try {
      requirements = JSON.parse(r.requirements || '[]');
    } catch {
      requirements = [];
    }

    return {
      id: r.id,
      title: r.title,
      employer: r.employer,
      description: r.description,
      location: r.location,
      qualification: r.qualification || '',
      skills,
      employmentType: r.employment_type,
      salary: r.salary,
      applicationUrl: r.application_url,
      source: r.source,
      originalJobUrl: r.original_job_url || r.application_url || '',
      publicationDate: r.publication_date,
      expiryDate: r.expiry_date || '',
      lastVerificationDate: r.last_verification_date || '',
      verificationStatus: normalizeVerificationStatus(r.verification_status),
      verificationNotes: r.verification_notes || '',
      isVerified: normalizeVerificationStatus(r.verification_status) === 'Verified',
      isActive: r.is_active === 1,
      isApproved: r.is_approved === 1,
      featured: r.featured === 1,
      responsibilities,
      requirements,
      sector: r.sector || 'Biotechnology',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapWorkshopRow(r: any): DbWorkshop {
    let skillsCovered: string[] = [];
    try {
      skillsCovered = JSON.parse(r.skills_covered || '[]');
    } catch {
      skillsCovered = [];
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      instructor: r.instructor || '',
      date: r.date,
      time: r.time || '09:30 AM - 04:30 PM IST',
      duration: r.duration || '1 Day',
      format: (r.format as WorkshopFormat) || 'Online',
      venue: r.venue,
      registrationDeadline: r.registration_deadline || '',
      registrationLink: r.registration_link,
      availability: (r.availability as WorkshopAvailability) || 'Open',
      status: (r.status as WorkshopStatus) || 'upcoming',
      fees: r.fees || 'Free',
      capacity: r.capacity || 50,
      imageUrl: r.image_url || '',
      featured: r.featured === 1,
      skillsCovered,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapCourseRow(r: any): DbCourse {
    let curriculum: string[] = [];
    try {
      curriculum = JSON.parse(r.curriculum || '[]');
    } catch {
      curriculum = [];
    }

    const normStatus = normalizeDbCourseStatus(r.status);
    const certInfo = (r.certificate_info || '').trim();

    return {
      id: r.id,
      name: r.name,
      provider: r.provider || r.instructor || 'Course Provider',
      description: r.description,
      duration: r.duration,
      fees: r.fees,
      eligibility: r.eligibility,
      curriculum,
      deliveryMode: r.delivery_mode || 'Online (Self-Paced)',
      certificateInfo: certInfo,
      registrationDeadline: r.registration_deadline || 'Open / Rolling',
      registrationLink: r.registration_link,
      availability: normStatus === 'closed' ? 'Closed' : (r.availability || 'Available'),
      status: normStatus,
      instructor: r.instructor || r.provider || '',
      level: r.level || 'Intermediate',
      category: r.category || 'Biotechnology',
      imageUrl: r.image_url || '',
      isCertificateAvailable: Boolean(certInfo) || r.is_certificate_available === 1,
      featured: r.featured === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // ==========================================
  // ADMIN USERS, SESSIONS, AUDIT LOGS & AUTH SECURITY (PHASE 05)
  // ==========================================

  private hashTokenSha256(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  public upsertAdminUser(input: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    passwordHash?: string;
    totpSecret?: string;
    totpEnabled?: boolean;
  }) {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM admin_users WHERE lower(username) = lower(?) OR id = ?')
      .get(input.username, input.id) as any;

    if (existing) {
      this.db
        .prepare(
          `UPDATE admin_users SET
            email = ?,
            display_name = ?,
            role = ?,
            password_hash = COALESCE(NULLIF(?, ''), password_hash),
            totp_secret = COALESCE(NULLIF(?, ''), totp_secret),
            totp_enabled = CASE WHEN ? THEN 1 ELSE totp_enabled END,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.email,
          input.displayName,
          input.role,
          input.passwordHash || '',
          input.totpSecret || '',
          input.totpEnabled ? 1 : 0,
          now,
          existing.id
        );
      return this.getAdminUserByUsername(existing.username)!;
    }

    this.db
      .prepare(
        `INSERT INTO admin_users (
          id, username, email, display_name, role, password_hash, totp_secret, totp_enabled, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        input.id,
        input.username,
        input.email,
        input.displayName,
        input.role,
        input.passwordHash || '',
        input.totpSecret || '',
        input.totpEnabled ? 1 : 0,
        now,
        now
      );
    return this.getAdminUserByUsername(input.username)!;
  }

  public getAdminUserByUsername(usernameOrEmail: string): {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    passwordHash: string;
    totpSecret: string;
    totpEnabled: boolean;
    isActive: boolean;
    lastLoginAt: string;
    passwordUpdatedAt: string;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM admin_users WHERE (lower(username) = lower(?) OR lower(email) = lower(?)) AND is_active = 1 LIMIT 1')
      .get(usernameOrEmail, usernameOrEmail) as any;
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      passwordHash: row.password_hash || '',
      totpSecret: row.totp_secret || '',
      totpEnabled: row.totp_enabled === 1,
      isActive: row.is_active === 1,
      lastLoginAt: row.last_login_at || '',
      passwordUpdatedAt: row.password_updated_at || '',
    };
  }

  public listAdminUsers(): Array<{
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    totpEnabled: boolean;
    isActive: boolean;
    lastLoginAt: string;
    passwordUpdatedAt: string;
    createdAt: string;
  }> {
    const rows = this.db.prepare('SELECT * FROM admin_users ORDER BY created_at ASC').all() as any[];
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      totpEnabled: row.totp_enabled === 1,
      isActive: row.is_active === 1,
      lastLoginAt: row.last_login_at || '',
      passwordUpdatedAt: row.password_updated_at || '',
      createdAt: row.created_at,
    }));
  }

  public updateAdminPasswordHash(adminUserId: string, newPasswordHash: string): boolean {
    const now = new Date().toISOString();
    const res = this.db
      .prepare('UPDATE admin_users SET password_hash = ?, password_updated_at = ?, updated_at = ? WHERE id = ?')
      .run(newPasswordHash, now, now, adminUserId);
    return Number(res.changes) > 0;
  }

  public updateAdminLastLogin(adminUserId: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE admin_users SET last_login_at = ?, failed_login_count = 0, locked_until = \'\', updated_at = ? WHERE id = ?').run(now, now, adminUserId);
  }

  public createAdminSessionRecord(input: {
    jti: string;
    token: string;
    adminUserId: string;
    actorUsername: string;
    role: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: number;
    createdAt?: number;
  }): void {
    const now = input.createdAt || Date.now();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO admin_sessions (
          jti, token_hash, admin_user_id, actor_username, role, ip_address, user_agent, expires_at, revoked_at, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        input.jti,
        this.hashTokenSha256(input.token),
        input.adminUserId,
        input.actorUsername,
        input.role,
        input.ipAddress || '',
        input.userAgent || '',
        input.expiresAt,
        now,
        now
      );
  }

  public validateAdminSessionRecord(
    token: string,
    now: number = Date.now()
  ): {
    jti: string;
    adminUserId: string;
    actorUsername: string;
    role: string;
    expiresAt: number;
    createdAt: number;
  } | null {
    if (!token) return null;
    const tokenHash = this.hashTokenSha256(token);
    const row = this.db
      .prepare('SELECT * FROM admin_sessions WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as any;
    if (!row) return null;
    if (row.revoked_at !== null && row.revoked_at !== undefined) return null;
    if (now > Number(row.expires_at)) {
      this.db.prepare('DELETE FROM admin_sessions WHERE jti = ?').run(row.jti);
      return null;
    }
    this.db.prepare('UPDATE admin_sessions SET last_active_at = ? WHERE jti = ?').run(now, row.jti);
    return {
      jti: row.jti,
      adminUserId: row.admin_user_id,
      actorUsername: row.actor_username,
      role: row.role,
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
    };
  }

  public revokeAdminSessionRecord(token: string, now: number = Date.now()): boolean {
    if (!token) return false;
    const tokenHash = this.hashTokenSha256(token);
    const res = this.db
      .prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .run(now, tokenHash);
    return Number(res.changes) > 0;
  }

  public revokeAllAdminSessions(adminUserId: string, exceptJti?: string, now: number = Date.now()): number {
    const res = exceptJti
      ? this.db
          .prepare('UPDATE admin_sessions SET revoked_at = ? WHERE admin_user_id = ? AND jti != ? AND revoked_at IS NULL')
          .run(now, adminUserId, exceptJti)
      : this.db
          .prepare('UPDATE admin_sessions SET revoked_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL')
          .run(now, adminUserId);
    return Number(res.changes);
  }

  public listActiveAdminSessions(now: number = Date.now()): Array<{
    jti: string;
    adminUserId: string;
    actorUsername: string;
    role: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: string;
    lastActiveAt: string;
    createdAt: string;
  }> {
    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(now);
    const rows = this.db
      .prepare('SELECT jti, admin_user_id, actor_username, role, ip_address, user_agent, expires_at, last_active_at, created_at FROM admin_sessions WHERE revoked_at IS NULL ORDER BY last_active_at DESC')
      .all() as any[];
    return rows.map((r) => ({
      jti: r.jti,
      adminUserId: r.admin_user_id,
      actorUsername: r.actor_username,
      role: r.role,
      ipAddress: r.ip_address || '',
      userAgent: r.user_agent || '',
      expiresAt: new Date(Number(r.expires_at)).toISOString(),
      lastActiveAt: new Date(Number(r.last_active_at)).toISOString(),
      createdAt: new Date(Number(r.created_at)).toISOString(),
    }));
  }

  public recordLoginAttempt(input: {
    identifier: string;
    ipAddress?: string;
    attemptedUsername: string;
    success: boolean;
    failureReason?: string;
    lockedUntil?: string;
  }): void {
    const id = `lgn-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_login_attempts (
          id, identifier, ip_address, attempted_username, success, failure_reason, locked_until, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.identifier,
        input.ipAddress || '',
        input.attemptedUsername,
        input.success ? 1 : 0,
        input.failureReason || '',
        input.lockedUntil || '',
        now
      );
  }

  public getRecentLoginAttempts(limit: number = 50): Array<{
    id: string;
    identifier: string;
    ipAddress: string;
    attemptedUsername: string;
    success: boolean;
    failureReason: string;
    lockedUntil: string;
    createdAt: string;
  }> {
    const rows = this.db
      .prepare('SELECT * FROM admin_login_attempts ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      ipAddress: r.ip_address || '',
      attemptedUsername: r.attempted_username || '',
      success: r.success === 1,
      failureReason: r.failure_reason || '',
      lockedUntil: r.locked_until || '',
      createdAt: r.created_at,
    }));
  }

  public recordAdminAuditLog(input: {
    adminUserId?: string;
    actorUsername: string;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    details?: Record<string, unknown>;
  }): void {
    const id = `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_audit_logs (
          id, admin_user_id, actor_username, action, entity_type, entity_id, ip_address, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.adminUserId || '',
        input.actorUsername,
        input.action,
        input.entityType,
        input.entityId || '',
        input.ipAddress || '',
        JSON.stringify(input.details || {}),
        now
      );
  }

  public getAdminAuditLogs(limit: number = 100): Array<{
    id: string;
    adminUserId: string;
    actorUsername: string;
    action: string;
    entityType: string;
    entityId: string;
    ipAddress: string;
    details: Record<string, unknown>;
    createdAt: string;
  }> {
    const rows = this.db
      .prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(r.details || '{}');
      } catch {
        details = {};
      }
      return {
        id: r.id,
        adminUserId: r.admin_user_id || '',
        actorUsername: r.actor_username,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id || '',
        ipAddress: r.ip_address || '',
        details,
        createdAt: r.created_at,
      };
    });
  }

  public createPasswordResetRecord(input: {
    adminUserId: string;
    actorUsername: string;
    tokenHash: string;
    expiresAtIso: string;
  }): { id: string; expiresAt: string } {
    const id = `rst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_password_resets (
          id, admin_user_id, actor_username, token_hash, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?)`
      )
      .run(id, input.adminUserId, input.actorUsername, input.tokenHash, input.expiresAtIso, now);
    return { id, expiresAt: input.expiresAtIso };
  }

  public consumePasswordResetToken(
    rawToken: string,
    newPasswordHash: string,
    nowMs: number = Date.now()
  ): { ok: boolean; adminUserId?: string; actorUsername?: string; error?: string } {
    const tokenHash = this.hashTokenSha256(rawToken);
    const row = this.db
      .prepare('SELECT * FROM admin_password_resets WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as any;

    if (!row) {
      return { ok: false, error: 'Invalid password reset token.' };
    }
    if (row.used_at) {
      return { ok: false, error: 'Password reset token has already been used.' };
    }
    if (nowMs > Date.parse(row.expires_at)) {
      return { ok: false, error: 'Password reset token has expired.' };
    }

    const nowIso = new Date(nowMs).toISOString();
    this.db.prepare('UPDATE admin_password_resets SET used_at = ? WHERE id = ?').run(nowIso, row.id);
    this.updateAdminPasswordHash(row.admin_user_id, newPasswordHash);
    this.revokeAllAdminSessions(row.admin_user_id, undefined, nowMs);

    return {
      ok: true,
      adminUserId: row.admin_user_id,
      actorUsername: row.actor_username,
    };
  }

  public seedInitialDataIfEmpty(
    seedJobs: any[],
    seedWorkshops: any[],
    seedCourses: any[],
    seedDiscussions: any[] = [],
    seedCertificate?: any,
    seedInternships: any[] = []
  ): void {
    const jobCount = (this.db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any).count;
    if (jobCount === 0 && seedJobs.length > 0) {
      for (const j of seedJobs) {
        this.createJob({
          id: j.id,
          title: j.title,
          employer: j.company || j.employer || 'Biotechnology Enterprise',
          description: j.description,
          location: j.location,
          qualification: j.qualification || 'M.Sc / B.Tech',
          skills: j.skills || [],
          employmentType: j.type || 'Full-time',
          salary: j.salary || 'Competitive',
          applicationUrl: j.applicationUrl,
          source: j.source?.name || j.sourceName || 'BIO-INEXA Verified',
          originalJobUrl: j.originalJobUrl || j.source?.url || j.applicationUrl || '',
          publicationDate: j.postedDate || j.publicationDate || '2026-11-01',
          expiryDate: j.deadline || '',
          lastVerificationDate: j.lastVerificationDate || '',
          verificationStatus: j.verificationStatus || 'Pending Verification',
          verificationNotes: j.verificationNotes || '',
          isActive: j.isActive !== undefined ? j.isActive : true,
          isApproved: j.isApproved !== undefined ? j.isApproved : (j.verificationStatus === 'Verified' || j.verificationStatus === 'Link Unavailable'),
          featured: !!j.featured,
          responsibilities: j.responsibilities || [],
          requirements: j.requirements || [],
          sector: j.sector || 'Private Biopharma'
        });
      }
    }

    const internshipCount = (this.db.prepare('SELECT COUNT(*) as count FROM internships').get() as any).count;
    if (internshipCount === 0 && seedInternships.length > 0) {
      for (const intern of seedInternships) {
        this.createInternship({
          id: intern.id,
          slug: intern.slug,
          title: intern.title,
          organization: intern.organization,
          location: intern.location,
          workMode: intern.mode || intern.workMode || 'On-site Lab',
          stipend: intern.stipend || 'Competitive Stipend',
          duration: intern.duration || '3 Months',
          deadline: intern.deadline || '',
          category: intern.category || 'Industrial R&D',
          eligibility: intern.eligibility || '',
          description: intern.description || '',
          learningOutcomes: intern.learningOutcomes || [],
          skillsRequired: intern.skillsRequired || [],
          sourceName: intern.source?.name || intern.sourceName || 'Verified Partner Program',
          sourceUrl: intern.source?.url || intern.sourceUrl || intern.applicationUrl,
          applicationUrl: intern.applicationUrl,
          verificationStatus: intern.verificationStatus || 'Verified',
          verificationNotes: intern.verificationNotes || 'Verified against official host institute portal.',
          lastVerificationDate: intern.lastVerificationDate || '2026-11-07',
          isApproved: intern.isApproved !== undefined ? intern.isApproved : true,
          isActive: intern.isActive !== undefined ? intern.isActive : true,
          featured: !!intern.featured,
        });
      }
    }

    const workshopCount = (this.db.prepare('SELECT COUNT(*) as count FROM workshops').get() as any).count;
    if (workshopCount === 0 && seedWorkshops.length > 0) {
      for (const w of seedWorkshops) {
        let fmt: WorkshopFormat = 'Online';
        if (w.workMode === 'In-Person' || w.workMode === 'On-site') fmt = 'Offline';
        else if (w.workMode === 'Hybrid') fmt = 'Hybrid';

        this.createWorkshop({
          id: w.id,
          name: w.title || w.name,
          description: w.description,
          instructor: w.organization || w.instructor || 'Lead Research Faculty',
          date: w.workshopDetails?.dates?.split(' to ')[0] || w.date || '2026-12-01',
          time: '09:30 AM - 04:30 PM IST',
          duration: w.workshopDetails?.duration || '3 Days Intensive',
          format: fmt,
          venue: `${w.location || 'Online'}`,
          registrationDeadline: '2026-12-05',
          registrationLink: w.workshopDetails?.registrationUrl || w.applicationUrl || 'https://www.igib.res.in/',
          availability: 'Open',
          status: 'upcoming',
          fees: w.workshopDetails?.fees || '₹1,500 (Subsidized Student Rate)',
          capacity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
          featured: true,
          skillsCovered: w.skills || ['Hands-on Wet Lab', 'Protocol Optimization']
        });
      }
    }

    // Enrich existing workshop records with images, format, deadlines, valid URLs, and featured flags
    try {
      const rows = this.db.prepare('SELECT id, name, image_url, format, status, registration_link, registration_deadline, availability FROM workshops').all() as any[];
      const brokenSeedUrlReplacements: Record<string, string> = {
        'https://csirhrdg.res.in/workshops/crispr2026': 'https://www.igib.res.in/',
        'https://www.igib.res.in/training': 'https://www.igib.res.in/',
        'https://bioinformatics.org/workshops/rnaseq-bootcamp': 'https://www.bioinformatics.org/',
        'https://www.afsti.org/workshops/haccp-jaipur': 'https://www.afsti.org/',
        'https://dst.gov.in/workshops/manuscript-writing-2026': 'https://dst.gov.in/',
        'https://www.bioconacademy.com/programs': 'https://www.bioconacademy.com/'
      };

      for (const row of rows) {
        if (row.registration_link && brokenSeedUrlReplacements[row.registration_link]) {
          this.db.prepare('UPDATE workshops SET registration_link = ? WHERE id = ?')
            .run(brokenSeedUrlReplacements[row.registration_link], row.id);
        }

        if (row.id === 'opp-work-3' && row.registration_deadline === '2026-11-12') {
          this.db.prepare('UPDATE workshops SET registration_deadline = ? WHERE id = ?')
            .run('2026-12-15', row.id);
        }

        if (row.id === 'opp-work-2' && row.image_url === 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80') {
          this.db.prepare('UPDATE workshops SET image_url = ? WHERE id = ?')
            .run('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', row.id);
        }

        if (row.id === 'opp-work-3' && row.image_url === 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80') {
          this.db.prepare('UPDATE workshops SET image_url = ? WHERE id = ?')
            .run('https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80', row.id);
        }

        if (row.id === 'opp-work-3' && row.format === 'Online') {
          this.db.prepare('UPDATE workshops SET format = ? WHERE id = ?')
            .run('Offline', row.id);
        }

        if (row.status === 'completed' && row.availability && !row.availability.toLowerCase().includes('closed')) {
          this.db.prepare('UPDATE workshops SET availability = ? WHERE id = ?')
            .run('Closed', row.id);
        }

        if (!row.image_url || !row.format || row.status === 'active') {
          let imageUrl = 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
          let format: WorkshopFormat = 'Offline';
          let status: WorkshopStatus = 'upcoming';
          let deadline = '2026-12-05';
          let time = '09:30 AM - 05:00 PM IST';
          let duration = '3 Days Intensive';
          let featured = 1;
          let availability = 'Open (28/40 Seats)';

          if (row.id === 'opp-work-1' || row.name.includes('CRISPR')) {
            imageUrl = 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
            format = 'Offline';
            status = 'upcoming';
            deadline = '2026-12-05';
            time = '09:30 AM - 05:00 PM IST';
            duration = '3 Days Intensive';
            featured = 1;
            availability = 'Open (28/40 Seats)';
          } else if (row.id === 'opp-work-2' || row.name.includes('RNA-Seq')) {
            imageUrl = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80';
            format = 'Online';
            status = 'upcoming';
            deadline = '2026-12-14';
            time = '10:00 AM - 04:30 PM IST';
            duration = '2 Days Virtual';
            featured = 1;
            availability = 'Filling Fast (8 Seats Left)';
          } else if (row.id === 'opp-work-3' || row.name.includes('HACCP')) {
            imageUrl = 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80';
            format = 'Offline';
            status = 'ongoing';
            deadline = '2026-12-15';
            time = '10:00 AM - 03:00 PM IST';
            duration = '1 Day Certification';
            featured = 1;
            availability = 'Open';
          } else if (row.id === 'opp-work-4' || row.name.includes('Manuscript')) {
            imageUrl = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
            format = 'Hybrid';
            status = 'completed';
            deadline = '2026-10-20';
            time = '02:00 PM - 06:00 PM IST';
            duration = '2 Days Masterclass';
            featured = 0;
            availability = 'Closed';
          }

          this.db.prepare(`
            UPDATE workshops SET
              image_url = CASE WHEN image_url = '' OR image_url IS NULL THEN ? ELSE image_url END,
              format = CASE WHEN format = '' OR format IS NULL OR format = 'Online' THEN ? ELSE format END,
              status = CASE WHEN status = 'active' THEN ? ELSE status END,
              registration_deadline = CASE WHEN registration_deadline = '' OR registration_deadline IS NULL THEN ? ELSE registration_deadline END,
              time = CASE WHEN time = '' OR time IS NULL THEN ? ELSE time END,
              duration = CASE WHEN duration = '' OR duration IS NULL THEN ? ELSE duration END,
              featured = CASE WHEN featured IS NULL OR featured = 0 THEN ? ELSE featured END,
              availability = CASE WHEN availability = '' OR availability IS NULL THEN ? ELSE availability END
            WHERE id = ?
          `).run(imageUrl, format, status, deadline, time, duration, featured, availability, row.id);
        }
      }

      // Add Fermentation and Flow Cytometry if not existing
      const hasFermentation = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-5'").get() as any;
      if (hasFermentation.c === 0) {
        this.createWorkshop({
          id: 'opp-work-5',
          name: 'Industrial Bioprocess Scaling & Microbial Fermentation Practicum',
          description: 'Hands-on training on 100L pilot bioreactors, dissolved oxygen profiling, batch fed-batch kinetics, and downstream cross-flow filtration at Biocon Academy.',
          instructor: 'Dr. Ramgopal Rao, Director of Academic Affairs',
          date: '2026-12-20',
          time: '09:00 AM - 05:30 PM IST',
          duration: '4 Days Pilot-Scale Lab',
          format: 'Offline',
          venue: 'Biocon Academy Pilot Bioreactor Facility, Electronic City Phase 1, Bengaluru 560100',
          registrationDeadline: '2026-12-10',
          registrationLink: 'https://www.bioconacademy.com/',
          availability: 'Filling Fast (6 Seats Left)',
          status: 'upcoming',
          fees: '₹3,500 (Academic / Student Subsidized)',
          capacity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
          featured: true,
          skillsCovered: ['Bioreactor Setup', 'Fed-Batch Fermentation', 'Downstream Processing', 'CIP / SIP Protocols']
        });
      }

      const hasFlowCytometry = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-6'").get() as any;
      if (hasFlowCytometry.c === 0) {
        this.createWorkshop({
          id: 'opp-work-6',
          name: 'Multicolor Flow Cytometry & High-Speed Cell Sorting Masterclass',
          description: 'Advanced fluorophore compensation, panel design for immunophenotyping, gating strategies with FlowJo, and aseptic sorting of primary T cells.',
          instructor: 'NCBS Central Flow Cytometry Core Facility',
          date: '2026-11-28',
          time: '09:30 AM - 04:30 PM IST',
          duration: '2 Days Hybrid Intensive',
          format: 'Hybrid',
          venue: 'National Centre for Biological Sciences (NCBS-TIFR), Bellary Road, Bengaluru 560065',
          registrationDeadline: '2026-11-22',
          registrationLink: 'https://www.ncbs.res.in/facilities/fcc',
          availability: 'Open (18/25 Seats)',
          status: 'upcoming',
          fees: '₹2,000 (Research Scholars)',
          capacity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
          featured: false,
          skillsCovered: ['Multicolor FlowJo', 'Antibody Conjugation', 'Cell Sorting', 'Gating Analysis']
        });
      }
    } catch (e) {
      console.error('[BIO-NEXA DB] Workshop migration note:', e);
    }

    const phase9Courses = [
      {
        id: 'course-1',
        name: 'CRISPR-Cas9 & Precision Gene Editing: Theory to Bench Protocol',
        provider: 'CSIR-IGIB Training Portal',
        instructor: 'Dr. Arindam Sen, Ph.D.',
        category: 'Molecular Biology',
        description: 'Rigorous curriculum covering CRISPR-Cas9 mechanisms, sgRNA design workflows (CRISPOR, CHOPCHOP), off-target analysis, Cas variants, and mammalian editing protocols.',
        duration: '14 Hours (Self-Paced)',
        eligibility: 'B.Sc, B.Tech, M.Sc, or Ph.D students in Life Sciences',
        curriculum: [
          'Module 1: Evolution of Genomic Editing — From Zinc Fingers to Cas9/Cas12',
          'Module 2: sgRNA Design Engine & Off-Target Scoring',
          'Module 3: Delivery Systems — Electroporation, AAV & Lipid Nanoparticles',
          'Module 4: Validation Assays — T7E1, Sanger Deconvolution & NGS Amplicon-seq',
          'Module 5: Therapeutic Applications & Assay Capstone'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free Open Curriculum',
        certificateInfo: '',
        registrationDeadline: '2026-12-31',
        registrationLink: 'https://www.igib.res.in/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Intermediate',
        imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
        featured: true
      },
      {
        id: 'course-2',
        name: 'Industrial Bioprocess Technology: Upstream to Downstream Scale-Up',
        provider: 'Biocon Academy',
        instructor: 'Dr. Meenakshi Ramanathan',
        category: 'Biotechnology',
        description: 'Industrial fermentation kinetics, oxygen mass transfer coefficients (kLa), fed-batch optimization, single-use bioreactors, and downstream Protein A / IEX chromatography.',
        duration: '6 Weeks (Self-Paced)',
        eligibility: 'B.E./B.Tech or M.Sc in Biotechnology, Chemical Engineering, or Microbiology',
        curriculum: [
          'Module 1: Microbial vs Mammalian Bioprocess Kinetics',
          'Module 2: Bioreactor Aeration, Agitation & kLa Determination',
          'Module 3: Continuous & Fed-Batch Feeding Strategies',
          'Module 4: Harvest, Depth Filtration & Tangential Flow Filtration',
          'Module 5: Downstream Purification & CIP/SIP Overview'
        ],
        deliveryMode: 'Hybrid',
        fees: 'Program fee applies at provider portal',
        certificateInfo: 'Program completion documentation governed by Biocon Academy enrollment terms.',
        registrationDeadline: '2026-12-20',
        registrationLink: 'https://www.bioconacademy.com/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Advanced',
        imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
        featured: true
      },
      {
        id: 'course-3',
        name: 'NGS Data Analysis & Bioinformatics Workflows',
        provider: 'Institute of Bioinformatics and Applied Biotechnology (IBAB)',
        instructor: 'Dr. Vikramaditya Joshi',
        category: 'Bioinformatics',
        description: 'Hands-on computational pipeline covering FASTQ quality control, reference alignment (BWA-MEM, STAR), variant calling best practices, and Python/Biopython scripting.',
        duration: '4 Weeks (Self-Paced)',
        eligibility: 'Undergraduate or Postgraduate students in Biology, Bioinformatics, or CS',
        curriculum: [
          'Module 1: FASTQ Format & Phred Quality Trimming',
          'Module 2: Genome Indexing & Alignment (SAM/BAM Formats)',
          'Module 3: Germline & Somatic Variant Calling Workflows',
          'Module 4: Automation Scripting with Python & Biopython',
          'Module 5: Genome Visualization & Functional Annotation'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Check institutional course schedule',
        certificateInfo: '',
        registrationDeadline: '2026-12-31',
        registrationLink: 'https://www.ibab.ac.in/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Beginner',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        featured: true
      },
      {
        id: 'course-4',
        name: 'Applied Industrial & Environmental Microbiology',
        provider: 'NPTEL / SWAYAM',
        instructor: 'NPTEL Life Sciences Faculty',
        category: 'Microbiology',
        description: 'Covers microbial diversity, aseptic screening, industrial strain improvement, antimicrobial susceptibility methods, and bioremediation systems.',
        duration: '8 Weeks',
        eligibility: 'B.Sc / M.Sc Microbiology, Biotechnology, and Life Sciences learners',
        curriculum: [
          'Module 1: Microbial Physiology & Growth Kinetics',
          'Module 2: Isolation, Screening & Strain Preservation',
          'Module 3: Microbial Enzymes & Metabolite Production',
          'Module 4: Quality & Sterility Testing Principles'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free to audit (Optional exam fee per SWAYAM policy)',
        certificateInfo: 'Optional proctored exam certificate as published on SWAYAM/NPTEL.',
        registrationDeadline: '2026-12-18',
        registrationLink: 'https://onlinecourses.nptel.ac.in/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Intermediate',
        imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
        featured: false
      },
      {
        id: 'course-5',
        name: 'Human Genetics & Population Genomics Primer',
        provider: 'EMBL-EBI Open Training',
        instructor: 'EMBL-EBI Training Team',
        category: 'Genetics',
        description: 'Explore Mendelian and complex inheritance, genome-wide association study (GWAS) concepts, variant interpretation databases, and Ensembl genome resources.',
        duration: '6 Hours (Self-Paced)',
        eligibility: 'Students & researchers in Genetics, Genomics, or Molecular Medicine',
        curriculum: [
          'Module 1: Human Genome Architecture & Variation',
          'Module 2: Interpreting Variants in Ensembl & ClinVar',
          'Module 3: Population Stratification & Linkage Disequilibrium',
          'Module 4: Responsible Genomic Data Sharing'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free Open Access',
        certificateInfo: '',
        registrationDeadline: 'Open / Rolling',
        registrationLink: 'https://www.ebi.ac.uk/training',
        availability: 'Available',
        status: 'available' as const,
        level: 'Beginner',
        imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
        featured: false
      },
      {
        id: 'course-6',
        name: 'Biopharmaceutical Formulation & Quality Control Fundamentals',
        provider: 'SWAYAM National Portal',
        instructor: 'Pharmaceutical Sciences Faculty',
        category: 'Pharmaceutical Sciences',
        description: 'Foundations of drug delivery, stability indicating analytical assays (HPLC/UV), Good Manufacturing Practice (GMP) documentation, and pharmacopeial standards.',
        duration: '12 Weeks',
        eligibility: 'B.Pharm, M.Pharm, M.Sc Chemistry or Biotechnology candidates',
        curriculum: [
          'Module 1: Pre-formulation & Excipient Compatibility',
          'Module 2: Stability Testing & Shelf-Life Estimation',
          'Module 3: Analytical Method Validation (ICH Guidelines)',
          'Module 4: cGMP Batch Records & Regulatory Audits'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free course access via SWAYAM',
        certificateInfo: 'Official SWAYAM course rules apply upon exam registration.',
        registrationDeadline: '2026-12-28',
        registrationLink: 'https://swayam.gov.in/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Intermediate',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        featured: false
      },
      {
        id: 'course-7',
        name: 'Good Clinical Practice (GCP) & Clinical Trial Design Cohort',
        provider: 'NPTEL Health Sciences Track',
        instructor: 'Clinical Research Faculty',
        category: 'Clinical Research',
        description: 'Phase I–IV clinical trial protocols, informed consent ethics, Institutional Ethics Committee (IEC) submissions, pharmacovigilance reporting, and biostatistical endpoints.',
        duration: '8 Weeks (Cohort)',
        eligibility: 'Graduates in Pharmacy, Medicine, Clinical Research, or Life Sciences',
        curriculum: [
          'Module 1: Ethics, Declaration of Helsinki & ICH-GCP',
          'Module 2: Randomized Controlled Trial Design & Blinding',
          'Module 3: Adverse Event Monitoring & Pharmacovigilance',
          'Module 4: Clinical Data Management & Case Report Forms'
        ],
        deliveryMode: 'Online (Live Cohort)',
        fees: 'Cohort Enrollment Closed for Current Cycle',
        certificateInfo: '',
        registrationDeadline: '2026-10-30',
        registrationLink: 'https://nptel.ac.in/',
        availability: 'Closed',
        status: 'closed' as const,
        level: 'Intermediate',
        imageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80',
        featured: false
      },
      {
        id: 'course-8',
        name: 'Essential Wet-Lab Instrumentation: PCR, Electrophoresis & Spectrophotometry',
        provider: 'NCBI & Open Science Learning Modules',
        instructor: 'Molecular Methods Curators',
        category: 'Laboratory Techniques',
        description: 'Practical grounding in micropipetting accuracy, buffer preparation, nucleic acid quantification, primer design, end-point/qPCR troubleshooting, and SDS-PAGE.',
        duration: '3 Weeks (Self-Paced)',
        eligibility: 'B.Sc / M.Sc Life Sciences, MLT & Allied Biosciences students',
        curriculum: [
          'Module 1: Lab Math, Molarity, Serial Dilutions & Buffer Prep',
          'Module 2: UV-Vis Spectrophotometry & Nucleic Acid Purity (A260/280)',
          'Module 3: Primer Design & PCR/RT-qPCR Troubleshooting',
          'Module 4: Agarose Gel & SDS-PAGE Electrophoresis'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free Open Resource',
        certificateInfo: '',
        registrationDeadline: 'Open / Rolling',
        registrationLink: 'https://www.ncbi.nlm.nih.gov/home/learn/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Beginner',
        imageUrl: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=800&q=80',
        featured: false
      },
      {
        id: 'course-9',
        name: 'Research Methodology, Experimental Design & Biostatistics',
        provider: 'NPTEL Research Methodology Program',
        instructor: 'Research Methodology Faculty',
        category: 'Research Methodology',
        description: 'Hypothesis formulation, experimental controls, ANOVA, non-parametric tests, reproducible data reporting, literature review tools, and research ethics.',
        duration: '8 Weeks',
        eligibility: 'M.Sc, M.Tech, Ph.D scholars and early-career researchers',
        curriculum: [
          'Module 1: Formulating Research Questions & Experimental Controls',
          'Module 2: Sample Size Power Analysis & Hypothesis Testing',
          'Module 3: Reproducible Figures, Reference Managers & Preprints',
          'Module 4: Publication Ethics & Peer Review Standards'
        ],
        deliveryMode: 'Online (Self-Paced)',
        fees: 'Free to audit (Optional exam fee per NPTEL)',
        certificateInfo: 'Official NPTEL exam rules apply if registered for proctored assessment.',
        registrationDeadline: '2026-12-25',
        registrationLink: 'https://onlinecourses.nptel.ac.in/',
        availability: 'Available',
        status: 'available' as const,
        level: 'Intermediate',
        imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
        featured: false
      }
    ];

    const courseCount = (this.db.prepare('SELECT COUNT(*) as count FROM courses').get() as any).count;
    const phase9SeedFlag = this.getContent('phase9_courses_initialized', false);

    if (courseCount === 0 || !phase9SeedFlag) {
      for (const c of phase9Courses) {
        const existing = this.getCourseById(c.id);
        if (!existing) {
          this.createCourse(c);
        } else {
          // Enrich legacy pre-Phase-09 seeded courses cleanly with verified links, categories, and Phase 09 metadata
          const isLegacyLink = !existing.registrationLink || existing.registrationLink.startsWith('/courses');
          this.db.prepare(`
            UPDATE courses SET
              provider = CASE WHEN provider = '' OR provider IS NULL THEN ? ELSE provider END,
              category = CASE WHEN category IN ('Molecular Biology & CRISPR', 'Bioprocess & Fermentation', 'Bioinformatics & NGS', '') OR category IS NULL THEN ? ELSE category END,
              delivery_mode = CASE WHEN delivery_mode = '' OR delivery_mode IS NULL THEN ? ELSE delivery_mode END,
              certificate_info = CASE WHEN certificate_info IS NULL OR certificate_info = '' THEN ? ELSE certificate_info END,
              registration_deadline = CASE WHEN registration_deadline = '' OR registration_deadline IS NULL THEN ? ELSE registration_deadline END,
              registration_link = CASE WHEN ? THEN ? ELSE registration_link END,
              image_url = CASE WHEN image_url = '' OR image_url IS NULL THEN ? ELSE image_url END,
              eligibility = CASE WHEN eligibility = 'Open to all Science Students' OR eligibility = '' THEN ? ELSE eligibility END,
              fees = CASE WHEN fees IN ('Free (Sponsored Access)', 'Free Certified Masterclass') THEN ? ELSE fees END,
              status = CASE WHEN status = 'active' THEN 'available' WHEN status = 'archived' THEN 'closed' ELSE status END,
              availability = CASE WHEN availability = 'Immediate Access' THEN ? ELSE availability END,
              featured = CASE WHEN id IN ('course-1', 'course-2', 'course-3') THEN 1 ELSE featured END,
              is_certificate_available = ?
            WHERE id = ?
          `).run(
            c.provider,
            c.category,
            c.deliveryMode,
            c.certificateInfo,
            c.registrationDeadline,
            isLegacyLink ? 1 : 0,
            c.registrationLink,
            c.imageUrl,
            c.eligibility,
            c.fees,
            c.availability,
            c.certificateInfo ? 1 : 0,
            existing.id
          );
        }
      }
      this.setContent('phase9_courses_initialized', true, 'system');
    }

    const annCount = (this.db.prepare('SELECT COUNT(*) as count FROM announcements').get() as any).count;
    if (annCount === 0) {
      this.createAnnouncement({
        id: 'ann-1',
        title: 'IASc-INSA-NASI Summer Research Fellowships 2027 Open for Applications',
        tag: 'Fellowship',
        content: 'Indian Academy of Sciences invites applications from 1st and 2nd year Master students.',
        date: '2026-11-05',
        link: '/opportunities',
        isActive: true,
        priority: 10
      });
      this.createAnnouncement({
        id: 'ann-2',
        title: 'CSIR NET Life Sciences 2026 Examination Bulletin Released',
        tag: 'Exam',
        content: 'National Testing Agency releases official syllabus and online test dates.',
        date: '2026-11-01',
        link: '/exams',
        isActive: true,
        priority: 8
      });
      this.createAnnouncement({
        id: 'ann-3',
        title: 'Biocon Biologics Campus Drive: 2026 Fermentation Scientist Openings',
        tag: 'Careers',
        content: 'Direct walk-in and virtual technical interviews for Bioprocess specialists.',
        date: '2026-10-28',
        link: '/jobs/job-1',
        isActive: true,
        priority: 5
      });
    }

    // Default homepage highlights
    if (!this.getContent('homepage_highlights')) {
      this.setContent('homepage_highlights', {
        heroBadge: 'National Life Sciences Career & Research Gateway',
        bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
        activeVacanciesCount: '23+ Active Biotech Openings',
        participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers'
      });
    }

    // Seed official verification registry sample certificate if empty
    const certCount = (this.db.prepare('SELECT COUNT(*) as count FROM certificates').get() as any).count;
    if (certCount === 0) {
      const sampleCert = seedCertificate || {
        id: 'cert-demo-1',
        certificateNumber: 'BN-2026-CRISPR-9842',
        recipientName: 'Aarav Gautam',
        courseTitle: 'CRISPR-Cas9 Gene Editing & Computational Design',
        issueDate: '2026-10-15',
        score: 92,
        verificationCode: 'VERIFIED-BIO-INEXA-2026-9842'
      };
      this.createCertificate(sampleCert);
    }

    // Seed initial community discussions if empty
    const discCount = (this.db.prepare('SELECT COUNT(*) as count FROM discussions').get() as any).count;
    if (discCount === 0 && seedDiscussions.length > 0) {
      for (const topic of seedDiscussions) {
        this.createDiscussion(topic);
      }
    }

    // Seed initial newsletter & sample application if empty
    const appCount = (this.db.prepare('SELECT COUNT(*) as count FROM job_applications').get() as any).count;
    if (appCount === 0) {
      this.createJobApplication({
        id: 'app-initial-1',
        jobId: 'job-1',
        jobTitle: 'Senior Bioprocess Scientist - Upstream Fermentation',
        company: 'Biocon Biologics',
        applicantName: 'Aarav Gautam',
        applicantEmail: 'aarav.biotech@university.edu',
        phone: '+91 98765 43210',
        qualification: 'M.Sc / M.Tech',
        experienceYears: '1 Year Research Project',
        coverNote: 'Extensive hands-on training with 10L fermenters and DO cascade control.',
        appliedDate: '2026-11-02',
        status: 'Under Review'
      });
    }
  }
}

export const bionexaDb = new BionexaDatabase();
