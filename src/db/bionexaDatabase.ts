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
import {
  classifyInternshipCompensation,
  isInternshipDeadlineExpired,
  matchesInternshipModeFilter,
} from '../services/internships/internshipHelpers.js';
import {
  isWorkshopExpired,
  normalizeWorkshopApprovalStatus,
} from '../services/workshops/workshopHelpers.js';
import {
  COURSE_CATEGORIES,
  classifyCoursePricing,
  isCourseExpired,
  normalizeCourseApprovalStatus,
  normalizeCourseProviderType,
  type CourseApprovalStatus,
  type CoursePricingType,
  type CourseProviderType,
} from '../services/courses/courseHelpers.js';
import {
  type DbStudentAccount,
  type DbStudentSession,
  type SafeStudentSession,
  type StudentAccountStatus,
  type StudentDeletionRequestRecord,
  hashEmailForAudit,
  hashOpaqueToken,
  normalizeStudentEmail,
} from '../services/student/studentAuthService.js';
import {
  type ApplicationDestinationType,
  type CompanyAccountRecord,
  type CompanyAccountStatus,
  type CompanyAuditLogRecord,
  type CompanySessionRecord,
  type CompanyVerificationStatus,
  generateCompanyAuditId,
  normalizeAccountStatus as normalizeCompanyAccountStatus,
  normalizeApplicationDestinationType,
  normalizeCompanyEmail,
  normalizeVerificationStatus as normalizeCompanyVerificationStatus,
} from '../services/company/companyAuthService.js';

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
  companyAccountId?: string;
  applicationDestinationType?: ApplicationDestinationType;
  applicationEmail?: string;
  applicationInstructions?: string;
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
export type WorkshopApprovalState = 'approved' | 'pending' | 'rejected';

export interface DbWorkshop {
  id: string;
  name: string;
  description: string;
  organizer?: string;
  instructor: string;
  category?: string;
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
  approvalStatus?: WorkshopApprovalState;
  isApproved?: boolean;
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
  providerType: CourseProviderType;
  description: string;
  duration: string;
  fees: string;
  pricingType: CoursePricingType;
  eligibility: string;
  curriculum: string[];
  deliveryMode: string;
  certificateInfo: string;
  registrationDeadline: string;
  registrationLink: string;
  availability: string;
  status: CourseStatus;
  approvalStatus: CourseApprovalStatus;
  isApproved: boolean;
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
        organizer TEXT DEFAULT '',
        instructor TEXT DEFAULT '',
        category TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT DEFAULT '',
        duration TEXT DEFAULT '',
        format TEXT NOT NULL DEFAULT 'Online',
        venue TEXT NOT NULL,
        registration_deadline TEXT DEFAULT '',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Open',
        status TEXT NOT NULL DEFAULT 'upcoming',
        fees TEXT DEFAULT '',
        capacity INTEGER DEFAULT 0,
        image_url TEXT DEFAULT '',
        featured INTEGER NOT NULL DEFAULT 0,
        skills_covered TEXT NOT NULL DEFAULT '[]',
        approval_status TEXT NOT NULL DEFAULT 'approved',
        is_approved INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT DEFAULT '',
        provider_type TEXT NOT NULL DEFAULT 'third_party',
        description TEXT NOT NULL,
        duration TEXT NOT NULL,
        fees TEXT DEFAULT '',
        pricing_type TEXT NOT NULL DEFAULT 'free',
        eligibility TEXT DEFAULT '',
        curriculum TEXT NOT NULL DEFAULT '[]',
        delivery_mode TEXT DEFAULT 'Online (Self-Paced)',
        certificate_info TEXT DEFAULT '',
        registration_deadline TEXT DEFAULT '',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Available',
        status TEXT NOT NULL DEFAULT 'available',
        approval_status TEXT NOT NULL DEFAULT 'approved',
        is_approved INTEGER NOT NULL DEFAULT 1,
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

      CREATE TABLE IF NOT EXISTS student_accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        degree_title TEXT DEFAULT '',
        institution TEXT DEFAULT '',
        specialization TEXT DEFAULT '',
        graduation_year TEXT DEFAULT '',
        location TEXT DEFAULT '',
        skills TEXT NOT NULL DEFAULT '[]',
        bio TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        orcid_id TEXT DEFAULT '',
        profile_visibility TEXT NOT NULL DEFAULT 'private',
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verified_at TEXT DEFAULT NULL,
        verification_token_hash TEXT DEFAULT NULL,
        verification_expires_at TEXT DEFAULT NULL,
        reset_token_hash TEXT DEFAULT NULL,
        reset_expires_at TEXT DEFAULT NULL,
        privacy_consent_at TEXT NOT NULL,
        account_status TEXT NOT NULL DEFAULT 'active',
        deletion_requested_at TEXT DEFAULT NULL,
        deletion_reason TEXT DEFAULT NULL,
        last_login_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS student_sessions (
        jti TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        user_agent TEXT DEFAULT '',
        ip_address_masked TEXT DEFAULT 'unknown',
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS student_deletion_requests (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        email_hash TEXT NOT NULL,
        reason TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TEXT NOT NULL,
        processed_at TEXT DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS company_accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_title TEXT DEFAULT '',
        contact_phone TEXT DEFAULT '',
        organization_name TEXT NOT NULL,
        organization_type TEXT NOT NULL DEFAULT 'Private Biopharma',
        official_website TEXT DEFAULT '',
        headquarters_location TEXT DEFAULT '',
        organization_size TEXT DEFAULT '',
        founded_year TEXT DEFAULT '',
        industry_focus TEXT DEFAULT '',
        description TEXT DEFAULT '',
        registration_identifier TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        default_application_destination_type TEXT NOT NULL DEFAULT 'external_url',
        default_application_url TEXT DEFAULT '',
        default_application_email TEXT DEFAULT '',
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verified_at TEXT DEFAULT NULL,
        verification_token_hash TEXT DEFAULT NULL,
        verification_token_expires_at TEXT DEFAULT NULL,
        reset_token_hash TEXT DEFAULT NULL,
        reset_token_expires_at TEXT DEFAULT NULL,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        verification_submitted_at TEXT DEFAULT NULL,
        verification_evidence_url TEXT DEFAULT '',
        verification_notes TEXT DEFAULT '',
        verified_by TEXT DEFAULT NULL,
        verified_at TEXT DEFAULT NULL,
        rejection_reason TEXT DEFAULT '',
        account_status TEXT NOT NULL DEFAULT 'active',
        suspended_at TEXT DEFAULT NULL,
        suspended_by TEXT DEFAULT NULL,
        suspension_reason TEXT DEFAULT '',
        privacy_consent_accepted INTEGER NOT NULL DEFAULT 0,
        privacy_consent_at TEXT DEFAULT NULL,
        last_login_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS company_sessions (
        jti TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES company_accounts(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        user_agent TEXT DEFAULT '',
        ip_masked TEXT DEFAULT 'unknown',
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS company_audit_logs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        actor_type TEXT NOT NULL DEFAULT 'company',
        actor_id TEXT DEFAULT '',
        actor_email TEXT DEFAULT '',
        action TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT 'company',
        target_id TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'success',
        ip_masked TEXT DEFAULT 'unknown',
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
      CREATE INDEX IF NOT EXISTS idx_student_accounts_email ON student_accounts(email);
      CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_sessions_token ON student_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_student_deletion_student ON student_deletion_requests(student_id);
      CREATE INDEX IF NOT EXISTS idx_company_accounts_email ON company_accounts(email);
      CREATE INDEX IF NOT EXISTS idx_company_accounts_verify_status ON company_accounts(verification_status);
      CREATE INDEX IF NOT EXISTS idx_company_accounts_status ON company_accounts(account_status);
      CREATE INDEX IF NOT EXISTS idx_company_sessions_company ON company_sessions(company_id);
      CREATE INDEX IF NOT EXISTS idx_company_sessions_token ON company_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_company_audit_company ON company_audit_logs(company_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_attempts_ident ON admin_login_attempts(identifier, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_resets_hash ON admin_password_resets(token_hash);
    `);

    // Ensure verification & Phase 15 employer columns exist on existing databases
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN original_job_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN last_verification_date TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN verification_notes TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN company_account_id TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN application_destination_type TEXT DEFAULT 'external_url';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN application_email TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN application_instructions TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_company_account_id ON jobs(company_account_id);"); } catch (_) {}
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
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN organizer TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN category TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1;"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_workshops_featured ON workshops(featured);"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_workshops_approval ON workshops(approval_status, is_approved);"); } catch (_) {}

    // Ensure Phase 09 & Phase 13 course columns exist on existing databases
    try { this.db.exec("ALTER TABLE courses ADD COLUMN provider TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'third_party';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN pricing_type TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN delivery_mode TEXT DEFAULT 'Online (Self-Paced)';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN certificate_info TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN registration_deadline TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN image_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE courses ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1;"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses(featured);"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_courses_approval ON courses(approval_status, is_approved);"); } catch (_) {}
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
        sector, company_account_id, application_destination_type, application_email, application_instructions,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
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
      job.applicationUrl || '',
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
      job.companyAccountId || '',
      normalizeApplicationDestinationType(job.applicationDestinationType),
      job.applicationEmail || '',
      job.applicationInstructions || '',
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
      companyAccountId: updates.companyAccountId !== undefined ? updates.companyAccountId : (existing.companyAccountId || ''),
      applicationDestinationType:
        updates.applicationDestinationType !== undefined
          ? normalizeApplicationDestinationType(updates.applicationDestinationType)
          : normalizeApplicationDestinationType(existing.applicationDestinationType),
      applicationEmail: updates.applicationEmail !== undefined ? updates.applicationEmail : (existing.applicationEmail || ''),
      applicationInstructions:
        updates.applicationInstructions !== undefined ? updates.applicationInstructions : (existing.applicationInstructions || ''),
      updatedAt: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE jobs SET
        title = ?, employer = ?, description = ?, location = ?,
        qualification = ?, skills = ?, employment_type = ?, salary = ?,
        application_url = ?, source = ?, original_job_url = ?, publication_date = ?, expiry_date = ?,
        last_verification_date = ?, verification_status = ?, verification_notes = ?,
        is_active = ?, is_approved = ?, featured = ?,
        responsibilities = ?, requirements = ?, sector = ?,
        company_account_id = ?, application_destination_type = ?, application_email = ?, application_instructions = ?,
        updated_at = ?
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
      merged.applicationUrl || '',
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
      merged.companyAccountId || '',
      normalizeApplicationDestinationType(merged.applicationDestinationType),
      merged.applicationEmail || '',
      merged.applicationInstructions || '',
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
    location?: string;
    mode?: string;
    compensation?: string;
    includeExpired?: boolean;
    onlyActive?: boolean;
    onlyApproved?: boolean;
  }): DbInternship[] {
    let sql = 'SELECT * FROM internships WHERE 1=1';
    const params: any[] = [];

    if (filter?.onlyActive !== false && !filter?.includeExpired) {
      sql += ' AND is_active = 1';
    }
    if (filter?.onlyApproved !== false) {
      sql += ' AND is_approved = 1';
    }
    if (filter?.category && filter.category !== 'All' && filter.category !== 'all') {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.location && filter.location !== 'All' && filter.location !== 'all') {
      sql += ' AND location LIKE ?';
      params.push(`%${filter.location}%`);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR organization LIKE ? OR description LIKE ? OR location LIKE ? OR eligibility LIKE ? OR skills_required LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term, term, term);
    }

    sql += ' ORDER BY featured DESC, created_at DESC';
    const rows = (this.db.prepare(sql).all(...params) as any[]).map((r) => this.mapInternshipRow(r));
    const compFilter = String(filter?.compensation || 'all').trim().toLowerCase();

    return rows.filter((intern) => {
      if (filter?.mode && !matchesInternshipModeFilter(intern.workMode, filter.mode)) {
        return false;
      }
      if (compFilter === 'paid' || compFilter === 'unpaid') {
        if (classifyInternshipCompensation(intern.stipend) !== compFilter) {
          return false;
        }
      }
      if (!filter?.includeExpired && filter?.onlyActive !== false) {
        if (
          intern.verificationStatus === 'Expired' ||
          intern.verificationStatus === 'Rejected' ||
          isInternshipDeadlineExpired(intern.deadline)
        ) {
          return false;
        }
      }
      return true;
    });
  }

  public expirePastDeadlineInternships(referenceDate: Date = new Date()): {
    expiredCount: number;
    expiredIds: string[];
  } {
    const all = this.getAllInternshipsAdmin();
    const expiredIds: string[] = [];
    for (const intern of all) {
      if (
        intern.isActive &&
        intern.verificationStatus !== 'Rejected' &&
        intern.verificationStatus !== 'Expired' &&
        isInternshipDeadlineExpired(intern.deadline, referenceDate)
      ) {
        this.updateInternship(intern.id, {
          isActive: false,
          verificationStatus: 'Expired',
          verificationNotes: intern.verificationNotes
            ? `${intern.verificationNotes} · Automatically marked expired after deadline (${intern.deadline}).`
            : `Automatically marked expired after deadline (${intern.deadline}).`,
        });
        expiredIds.push(intern.id);
      }
    }
    return { expiredCount: expiredIds.length, expiredIds };
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
    onlyApproved?: boolean;
    status?: string;
    format?: string;
    category?: string;
    approvalStatus?: string;
    featured?: boolean;
    includeExpired?: boolean;
    search?: string;
  }): DbWorkshop[] {
    let sql = 'SELECT * FROM workshops WHERE 1=1';
    const params: any[] = [];

    if (typeof filter === 'boolean') {
      if (filter) {
        sql += " AND status != 'completed' AND is_approved = 1";
      }
    } else if (filter) {
      if (filter.onlyApproved) {
        sql += " AND is_approved = 1 AND approval_status = 'approved'";
      }
      if (filter.approvalStatus && filter.approvalStatus !== 'all') {
        sql += ' AND approval_status = ?';
        params.push(filter.approvalStatus);
      }
      if (filter.status && filter.status !== 'all') {
        sql += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter.format && filter.format !== 'all') {
        sql += ' AND format = ?';
        params.push(filter.format);
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
        sql += ' AND (name LIKE ? OR organizer LIKE ? OR instructor LIKE ? OR category LIKE ? OR description LIKE ? OR venue LIKE ?)';
        const term = `%${filter.search}%`;
        params.push(term, term, term, term, term, term);
      }
    }

    sql += ' ORDER BY featured DESC, date ASC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    const mapped = rows.map((row) => this.mapWorkshopRow(row));
    if (typeof filter === 'object' && filter && filter.includeExpired === false) {
      return mapped.filter((w) => !isWorkshopExpired(w));
    }
    return mapped;
  }

  public getWorkshopById(id: string): DbWorkshop | null {
    const row = this.db.prepare('SELECT * FROM workshops WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapWorkshopRow(row);
  }

  public createWorkshop(data: Omit<DbWorkshop, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbWorkshop {
    const id = data.id || `ws-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const approvalStatus = normalizeWorkshopApprovalStatus(data.approvalStatus, data.isApproved);
    const isApproved = approvalStatus === 'approved' && data.isApproved !== false;
    const capacityVal = Number.isFinite(Number(data.capacity)) && Number(data.capacity) > 0 ? Math.floor(Number(data.capacity)) : 0;

    this.db.prepare(`
      INSERT INTO workshops (
        id, name, description, organizer, instructor, category, date, time, duration,
        format, venue, registration_deadline, registration_link,
        availability, status, fees, capacity, image_url,
        featured, skills_covered, approval_status, is_approved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.organizer || '',
      data.instructor || '',
      data.category || '',
      data.date,
      data.time || '',
      data.duration || '',
      data.format || 'Online',
      data.venue,
      data.registrationDeadline || '',
      data.registrationLink,
      data.availability || 'Open',
      data.status || 'upcoming',
      data.fees || '',
      capacityVal,
      data.imageUrl || '',
      data.featured ? 1 : 0,
      JSON.stringify(data.skillsCovered || []),
      approvalStatus,
      isApproved ? 1 : 0,
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
    const approvalStatus = normalizeWorkshopApprovalStatus(merged.approvalStatus, merged.isApproved);
    const isApproved = approvalStatus === 'approved' && merged.isApproved !== false;
    const capacityVal = Number.isFinite(Number(merged.capacity)) && Number(merged.capacity) > 0 ? Math.floor(Number(merged.capacity)) : 0;

    this.db.prepare(`
      UPDATE workshops SET
        name = ?, description = ?, organizer = ?, instructor = ?, category = ?, date = ?,
        time = ?, duration = ?, format = ?, venue = ?,
        registration_deadline = ?, registration_link = ?,
        availability = ?, status = ?, fees = ?, capacity = ?,
        image_url = ?, featured = ?, skills_covered = ?, approval_status = ?, is_approved = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description,
      merged.organizer || '',
      merged.instructor || '',
      merged.category || '',
      merged.date,
      merged.time || '',
      merged.duration || '',
      merged.format,
      merged.venue,
      merged.registrationDeadline || '',
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.fees || '',
      capacityVal,
      merged.imageUrl || '',
      merged.featured ? 1 : 0,
      JSON.stringify(merged.skillsCovered || []),
      approvalStatus,
      isApproved ? 1 : 0,
      merged.updatedAt,
      id
    );

    return this.getWorkshopById(id);
  }

  /**
   * Automatically scans active workshops whose registration deadline or workshop date has passed
   * and marks them completed / Closed so expired sessions are accurately surfaced.
   */
  public expirePastWorkshops(referenceDate: Date = new Date()): { expiredCount: number; expiredIds: string[] } {
    const rows = this.db.prepare("SELECT * FROM workshops WHERE status != 'completed'").all() as any[];
    const expiredIds: string[] = [];
    const nowIso = referenceDate.toISOString();

    for (const row of rows) {
      const ws = this.mapWorkshopRow(row);
      if (isWorkshopExpired(ws, referenceDate)) {
        this.db.prepare(`
          UPDATE workshops
          SET status = 'completed', availability = 'Closed', updated_at = ?
          WHERE id = ?
        `).run(nowIso, ws.id);
        expiredIds.push(ws.id);
      }
    }

    return { expiredCount: expiredIds.length, expiredIds };
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
    onlyApproved?: boolean;
    approvalStatus?: string;
    category?: string;
    status?: string;
    pricingType?: string;
    providerType?: string;
    includeExpired?: boolean;
    featured?: boolean;
    search?: string;
  }): DbCourse[] {
    let sql = 'SELECT * FROM courses WHERE 1=1';
    const params: any[] = [];

    if (typeof filter === 'boolean') {
      if (filter) {
        sql += " AND status NOT IN ('closed', 'archived') AND is_approved = 1 AND approval_status = 'approved'";
      }
    } else if (filter) {
      if (filter.onlyAvailable) {
        sql += " AND status NOT IN ('closed', 'archived')";
      }
      if (filter.onlyApproved) {
        sql += " AND is_approved = 1 AND approval_status = 'approved'";
      }
      if (filter.approvalStatus && filter.approvalStatus !== 'all') {
        const normApproval = normalizeCourseApprovalStatus(filter.approvalStatus);
        sql += ' AND approval_status = ?';
        params.push(normApproval);
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
    let mapped = rows.map(this.mapCourseRow);

    if (typeof filter === 'object' && filter) {
      if (filter.pricingType && filter.pricingType !== 'all') {
        const targetPricing = filter.pricingType.toLowerCase();
        mapped = mapped.filter((c) => c.pricingType === targetPricing);
      }
      if (filter.providerType && filter.providerType !== 'all') {
        const targetProviderType = normalizeCourseProviderType(filter.providerType);
        mapped = mapped.filter((c) => c.providerType === targetProviderType);
      }
      if (filter.includeExpired === false) {
        mapped = mapped.filter((c) => !isCourseExpired(c));
      }
    }

    return mapped;
  }

  public getCourseById(id: string): DbCourse | null {
    const row = this.db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapCourseRow(row);
  }

  public createCourse(
    data: Omit<
      DbCourse,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'provider'
      | 'providerType'
      | 'pricingType'
      | 'deliveryMode'
      | 'certificateInfo'
      | 'registrationDeadline'
      | 'isCertificateAvailable'
      | 'approvalStatus'
      | 'isApproved'
    > & {
      id?: string;
      provider?: string;
      providerType?: CourseProviderType;
      pricingType?: CoursePricingType;
      deliveryMode?: string;
      certificateInfo?: string;
      registrationDeadline?: string;
      isCertificateAvailable?: boolean;
      approvalStatus?: CourseApprovalStatus;
      isApproved?: boolean;
    }
  ): DbCourse {
    const id = data.id || `course-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const expired = isCourseExpired({ registrationDeadline: data.registrationDeadline });
    const normStatus: CourseStatus = expired ? 'closed' : normalizeDbCourseStatus(data.status);
    const certInfo = (data.certificateInfo || '').trim();
    const hasCert = Boolean(certInfo);
    const provider = String(data.provider || '').trim();
    const providerType = normalizeCourseProviderType(data.providerType);
    const fees = String(data.fees || '').trim();
    const pricingType = classifyCoursePricing(fees, data.pricingType);
    const approvalStatus = normalizeCourseApprovalStatus(data.approvalStatus, data.isApproved);
    const isApproved = approvalStatus === 'approved';

    this.db.prepare(`
      INSERT INTO courses (
        id, name, provider, provider_type, description, duration, fees, pricing_type,
        eligibility, curriculum, delivery_mode, certificate_info, registration_deadline,
        registration_link, availability, status, approval_status, is_approved,
        instructor, level, category, image_url, is_certificate_available, featured,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      provider,
      providerType,
      data.description,
      data.duration || '',
      fees,
      pricingType,
      data.eligibility || '',
      JSON.stringify(data.curriculum || []),
      data.deliveryMode || 'Online (Self-Paced)',
      certInfo,
      data.registrationDeadline || '',
      data.registrationLink,
      expired ? 'Expired' : normStatus === 'closed' ? 'Closed' : (data.availability || 'Available'),
      normStatus,
      approvalStatus,
      isApproved ? 1 : 0,
      String(data.instructor || '').trim(),
      data.level || '',
      data.category || 'Biotechnology',
      data.imageUrl || '',
      hasCert ? 1 : 0,
      isApproved && data.featured ? 1 : 0,
      now,
      now
    );

    return this.getCourseById(id)!;
  }

  public updateCourse(id: string, updates: Partial<DbCourse>): DbCourse | null {
    const existing = this.getCourseById(id);
    if (!existing) return null;

    const nextDeadline =
      updates.registrationDeadline !== undefined
        ? updates.registrationDeadline
        : existing.registrationDeadline;

    const mergedStatus: CourseStatus =
      updates.status !== undefined
        ? normalizeDbCourseStatus(updates.status)
        : normalizeDbCourseStatus(existing.status);

    const certInfo =
      updates.certificateInfo !== undefined
        ? updates.certificateInfo.trim()
        : existing.certificateInfo;

    const nextFees = updates.fees !== undefined ? updates.fees : existing.fees;
    const nextPricingType =
      updates.pricingType !== undefined
        ? classifyCoursePricing(nextFees, updates.pricingType)
        : updates.fees !== undefined
        ? classifyCoursePricing(nextFees)
        : existing.pricingType;

    const nextProviderType =
      updates.providerType !== undefined
        ? normalizeCourseProviderType(updates.providerType)
        : existing.providerType;

    const nextApprovalStatus =
      updates.approvalStatus !== undefined || updates.isApproved !== undefined
        ? normalizeCourseApprovalStatus(updates.approvalStatus, updates.isApproved)
        : existing.approvalStatus;
    const nextIsApproved = nextApprovalStatus === 'approved';

    const merged: DbCourse = {
      ...existing,
      ...updates,
      providerType: nextProviderType,
      fees: nextFees,
      pricingType: nextPricingType,
      registrationDeadline: nextDeadline,
      status: mergedStatus,
      approvalStatus: nextApprovalStatus,
      isApproved: nextIsApproved,
      featured: nextIsApproved ? (updates.featured !== undefined ? Boolean(updates.featured) : existing.featured) : false,
      availability:
        updates.availability !== undefined
          ? updates.availability
          : mergedStatus === 'closed'
          ? 'Closed'
          : 'Available',
      certificateInfo: certInfo,
      isCertificateAvailable: Boolean(certInfo),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE courses SET
        name = ?, provider = ?, provider_type = ?, description = ?, duration = ?,
        fees = ?, pricing_type = ?, eligibility = ?, curriculum = ?, delivery_mode = ?,
        certificate_info = ?, registration_deadline = ?, registration_link = ?,
        availability = ?, status = ?, approval_status = ?, is_approved = ?,
        instructor = ?, level = ?, category = ?, image_url = ?,
        is_certificate_available = ?, featured = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.provider,
      merged.providerType,
      merged.description,
      merged.duration,
      merged.fees,
      merged.pricingType,
      merged.eligibility,
      JSON.stringify(merged.curriculum || []),
      merged.deliveryMode,
      merged.certificateInfo || '',
      merged.registrationDeadline || '',
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.approvalStatus,
      merged.isApproved ? 1 : 0,
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

  public expirePastCourses(referenceDate: Date = new Date()): { expiredCount: number; expiredIds: string[] } {
    const rows = this.db.prepare("SELECT * FROM courses WHERE status != 'closed'").all() as any[];
    const nowIso = referenceDate.toISOString();
    const expiredIds: string[] = [];

    for (const row of rows) {
      const mapped = this.mapCourseRow(row);
      if (isCourseExpired(mapped, referenceDate)) {
        this.db.prepare(`
          UPDATE courses SET
            status = 'closed',
            availability = 'Expired',
            updated_at = ?
          WHERE id = ?
        `).run(nowIso, mapped.id);
        expiredIds.push(mapped.id);
      }
    }

    return { expiredCount: expiredIds.length, expiredIds };
  }

  public getCourseCategories(): string[] {
    const saved = this.getContent('course_categories', []);
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

  public addCourseCategory(categoryName: string, updatedBy: string = 'admin'): string[] {
    const clean = String(categoryName || '').trim();
    if (clean.length < 2 || clean.length > 64) {
      throw new Error('Category name must be between 2 and 64 characters.');
    }
    const existing = this.getCourseCategories();
    if (!existing.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      const saved = this.getContent('course_categories', []);
      const customList = Array.isArray(saved) ? saved : [];
      customList.push(clean);
      this.setContent('course_categories', customList, updatedBy);
    }
    return this.getCourseCategories();
  }

  public removeCourseCategory(categoryName: string, updatedBy: string = 'admin'): { categories: string[]; removed: boolean } {
    const clean = String(categoryName || '').trim().toLowerCase();
    if (COURSE_CATEGORIES.some((c) => c.toLowerCase() === clean)) {
      return { categories: this.getCourseCategories(), removed: false };
    }
    const saved = this.getContent('course_categories', []);
    const customList = Array.isArray(saved) ? saved : [];
    const nextList = customList.filter((c) => String(c || '').trim().toLowerCase() !== clean);
    const removed = nextList.length !== customList.length;
    if (removed) {
      this.setContent('course_categories', nextList, updatedBy);
    }
    return { categories: this.getCourseCategories(), removed };
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
      companyAccountId: r.company_account_id || '',
      applicationDestinationType: normalizeApplicationDestinationType(r.application_destination_type),
      applicationEmail: r.application_email || '',
      applicationInstructions: r.application_instructions || '',
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

    const approvalStatus = normalizeWorkshopApprovalStatus(
      r.approval_status,
      r.is_approved === undefined ? true : r.is_approved === 1
    );
    const isApproved = approvalStatus === 'approved' && (r.is_approved === undefined || r.is_approved === 1);

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      organizer: r.organizer || '',
      instructor: r.instructor || '',
      category: r.category || '',
      date: r.date,
      time: r.time || '',
      duration: r.duration || '',
      format: (r.format as WorkshopFormat) || 'Online',
      venue: r.venue,
      registrationDeadline: r.registration_deadline || '',
      registrationLink: r.registration_link,
      availability: (r.availability as WorkshopAvailability) || 'Open',
      status: (r.status as WorkshopStatus) || 'upcoming',
      fees: r.fees || '',
      capacity: typeof r.capacity === 'number' && r.capacity > 0 ? r.capacity : 0,
      imageUrl: r.image_url || '',
      featured: r.featured === 1,
      skillsCovered,
      approvalStatus,
      isApproved,
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
    const fees = String(r.fees || '').trim();
    const pricingType = classifyCoursePricing(fees, r.pricing_type);
    const providerType = normalizeCourseProviderType(r.provider_type);
    const approvalStatus = normalizeCourseApprovalStatus(r.approval_status, r.is_approved);
    const isApproved = approvalStatus === 'approved';
    const expired = isCourseExpired({ registrationDeadline: r.registration_deadline });

    return {
      id: r.id,
      name: r.name,
      provider: String(r.provider || '').trim(),
      providerType,
      description: r.description || '',
      duration: r.duration || '',
      fees,
      pricingType,
      eligibility: r.eligibility || '',
      curriculum,
      deliveryMode: r.delivery_mode || 'Online (Self-Paced)',
      certificateInfo: certInfo,
      registrationDeadline: r.registration_deadline || '',
      registrationLink: r.registration_link,
      availability:
        expired || String(r.availability || '').trim().toLowerCase() === 'expired'
          ? 'Expired'
          : normStatus === 'closed'
          ? 'Closed'
          : (r.availability || 'Available'),
      status: expired ? 'closed' : normStatus,
      approvalStatus,
      isApproved,
      instructor: String(r.instructor || '').trim(),
      level: r.level || '',
      category: r.category || 'Biotechnology',
      imageUrl: r.image_url || '',
      isCertificateAvailable: Boolean(certInfo),
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

        // Backfill category and organizer for legacy seeded workshops if missing
        let seedCategory = '';
        let seedOrganizer = '';
        if (row.id === 'opp-work-1' || row.name.includes('CRISPR')) {
          seedCategory = 'Molecular Biology & CRISPR';
          seedOrganizer = 'CSIR-IGIB New Delhi';
        } else if (row.id === 'opp-work-2' || row.name.includes('RNA-Seq')) {
          seedCategory = 'Bioinformatics & NGS';
          seedOrganizer = 'DBT Bioinformatics Centre';
        } else if (row.id === 'opp-work-3' || row.name.includes('HACCP')) {
          seedCategory = 'Quality Control & Regulatory';
          seedOrganizer = 'AFSTI India';
        } else if (row.id === 'opp-work-4' || row.name.includes('Manuscript')) {
          seedCategory = 'Scientific Writing & Career';
          seedOrganizer = 'DST Scientific Publishing Cell';
        } else if (row.id === 'opp-work-5' || row.name.includes('Fermentation')) {
          seedCategory = 'Bioprocess & Fermentation';
          seedOrganizer = 'Biocon Academy';
        } else if (row.id === 'opp-work-6' || row.name.includes('Flow Cytometry')) {
          seedCategory = 'Cell Culture & Flow Cytometry';
          seedOrganizer = 'NCBS-TIFR Bengaluru';
        }
        if (seedCategory || seedOrganizer) {
          this.db.prepare(`
            UPDATE workshops SET
              category = CASE WHEN category = '' OR category IS NULL THEN ? ELSE category END,
              organizer = CASE WHEN organizer = '' OR organizer IS NULL THEN ? ELSE organizer END
            WHERE id = ?
          `).run(seedCategory, seedOrganizer, row.id);
        }
      }

      // Add Fermentation and Flow Cytometry if not existing
      const hasFermentation = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-5'").get() as any;
      if (hasFermentation.c === 0) {
        this.createWorkshop({
          id: 'opp-work-5',
          name: 'Industrial Bioprocess Scaling & Microbial Fermentation Practicum',
          description: 'Hands-on training on 100L pilot bioreactors, dissolved oxygen profiling, batch fed-batch kinetics, and downstream cross-flow filtration at Biocon Academy.',
          organizer: 'Biocon Academy',
          instructor: 'Dr. Ramgopal Rao, Director of Academic Affairs',
          category: 'Bioprocess & Fermentation',
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
          skillsCovered: ['Bioreactor Setup', 'Fed-Batch Fermentation', 'Downstream Processing', 'CIP / SIP Protocols'],
          approvalStatus: 'approved',
          isApproved: true
        });
      }

      const hasFlowCytometry = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-6'").get() as any;
      if (hasFlowCytometry.c === 0) {
        this.createWorkshop({
          id: 'opp-work-6',
          name: 'Multicolor Flow Cytometry & High-Speed Cell Sorting Masterclass',
          description: 'Advanced fluorophore compensation, panel design for immunophenotyping, gating strategies with FlowJo, and aseptic sorting of primary T cells.',
          organizer: 'NCBS-TIFR Bengaluru',
          instructor: 'NCBS Central Flow Cytometry Core Facility',
          category: 'Cell Culture & Flow Cytometry',
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
          skillsCovered: ['Multicolor FlowJo', 'Antibody Conjugation', 'Cell Sorting', 'Gating Analysis'],
          approvalStatus: 'approved',
          isApproved: true
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

  // ==========================================
  // PHASE 14: STUDENT AUTHENTICATION, PROFILES, SESSIONS & DELETION REQUESTS
  // ==========================================

  private mapStudentAccountRow(r: any): DbStudentAccount {
    let skills: string[] = [];
    try {
      const parsed = JSON.parse(r.skills || '[]');
      if (Array.isArray(parsed)) skills = parsed.map((s) => String(s));
    } catch {
      skills = [];
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
      emailVerified: r.email_verified === 1,
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

  public getStudentByEmail(email: string): DbStudentAccount | null {
    const clean = normalizeStudentEmail(email);
    if (!clean) return null;
    const row = this.db.prepare('SELECT * FROM student_accounts WHERE LOWER(email) = LOWER(?)').get(clean) as any;
    return row ? this.mapStudentAccountRow(row) : null;
  }

  public getStudentById(id: string): DbStudentAccount | null {
    if (!id) return null;
    const row = this.db.prepare('SELECT * FROM student_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapStudentAccountRow(row) : null;
  }

  public createStudentAccount(input: {
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
  }): DbStudentAccount {
    const cleanEmail = normalizeStudentEmail(input.email);
    const existing = this.getStudentByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const now = new Date().toISOString();
    const id = input.id || `stu-${crypto.randomBytes(8).toString('hex')}`;

    this.db.prepare(`
      INSERT INTO student_accounts (
        id, email, password_hash, full_name, role,
        degree_title, institution, specialization, graduation_year,
        location, skills, bio, linkedin_url, orcid_id, profile_visibility,
        email_verified, email_verified_at, verification_token_hash, verification_expires_at,
        privacy_consent_at, account_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?, '', '[]', '', '', '', 'private', 0, NULL, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      cleanEmail,
      input.passwordHash,
      input.fullName,
      input.degreeTitle || '',
      input.institution || '',
      input.specialization || '',
      input.graduationYear || '',
      input.verificationTokenHash,
      input.verificationExpiresAt,
      input.privacyConsentAt || now,
      now,
      now
    );

    return this.getStudentById(id)!;
  }

  public updateStudentLastLogin(studentId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE student_accounts SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, studentId);
  }

  public updateStudentProfile(
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
  ): DbStudentAccount | null {
    const existing = this.getStudentById(studentId);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE student_accounts SET
        full_name = ?,
        degree_title = ?,
        institution = ?,
        specialization = ?,
        graduation_year = ?,
        location = ?,
        skills = ?,
        bio = ?,
        linkedin_url = ?,
        orcid_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.fullName !== undefined ? updates.fullName : existing.fullName,
      updates.degreeTitle !== undefined ? updates.degreeTitle : existing.degreeTitle,
      updates.institution !== undefined ? updates.institution : existing.institution,
      updates.specialization !== undefined ? updates.specialization : existing.specialization,
      updates.graduationYear !== undefined ? updates.graduationYear : existing.graduationYear,
      updates.location !== undefined ? updates.location : existing.location,
      JSON.stringify(updates.skills !== undefined ? updates.skills : existing.skills),
      updates.bio !== undefined ? updates.bio : existing.bio,
      updates.linkedinUrl !== undefined ? updates.linkedinUrl : existing.linkedinUrl,
      updates.orcidId !== undefined ? updates.orcidId : existing.orcidId,
      now,
      studentId
    );

    return this.getStudentById(studentId);
  }

  public setStudentVerificationToken(
    studentId: string,
    tokenHash: string,
    expiresAtIso: string
  ): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE student_accounts SET
        verification_token_hash = ?,
        verification_expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(tokenHash, expiresAtIso, now, studentId) as any;
    return (res.changes ?? 0) > 0;
  }

  public verifyStudentEmailByToken(rawToken: string, now: Date = new Date()): DbStudentAccount | null {
    const tokenHash = hashOpaqueToken(rawToken);
    if (!tokenHash) return null;
    const row = this.db
      .prepare('SELECT * FROM student_accounts WHERE verification_token_hash = ?')
      .get(tokenHash) as any;
    if (!row) return null;

    const account = this.mapStudentAccountRow(row);
    if (account.verificationExpiresAt && new Date(account.verificationExpiresAt).getTime() < now.getTime()) {
      return null;
    }

    const nowIso = now.toISOString();
    this.db.prepare(`
      UPDATE student_accounts SET
        email_verified = 1,
        email_verified_at = ?,
        verification_token_hash = NULL,
        verification_expires_at = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(nowIso, nowIso, account.id);

    return this.getStudentById(account.id);
  }

  public setStudentPasswordResetToken(
    studentId: string,
    tokenHash: string,
    expiresAtIso: string
  ): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE student_accounts SET
        reset_token_hash = ?,
        reset_expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(tokenHash, expiresAtIso, now, studentId) as any;
    return (res.changes ?? 0) > 0;
  }

  public consumeStudentPasswordResetToken(
    rawToken: string,
    newPasswordHash: string,
    now: Date = new Date()
  ): DbStudentAccount | null {
    const tokenHash = hashOpaqueToken(rawToken);
    if (!tokenHash) return null;
    const row = this.db
      .prepare('SELECT * FROM student_accounts WHERE reset_token_hash = ?')
      .get(tokenHash) as any;
    if (!row) return null;

    const account = this.mapStudentAccountRow(row);
    if (!account.resetExpiresAt || new Date(account.resetExpiresAt).getTime() < now.getTime()) {
      return null;
    }

    const nowIso = now.toISOString();
    this.db.prepare(`
      UPDATE student_accounts SET
        password_hash = ?,
        reset_token_hash = NULL,
        reset_expires_at = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(newPasswordHash, nowIso, account.id);

    // Revoke all active sessions after password reset
    this.revokeAllStudentSessions(account.id);

    return this.getStudentById(account.id);
  }

  public updateStudentPasswordHash(studentId: string, newPasswordHash: string): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE student_accounts SET
        password_hash = ?,
        reset_token_hash = NULL,
        reset_expires_at = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(newPasswordHash, now, studentId) as any;
    return (res.changes ?? 0) > 0;
  }

  public createStudentSession(input: {
    jti: string;
    studentId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddressMasked?: string;
    expiresAt: string;
  }): DbStudentSession {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO student_sessions (
        jti, student_id, token_hash, user_agent, ip_address_masked,
        created_at, last_active_at, expires_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      input.jti,
      input.studentId,
      input.tokenHash,
      (input.userAgent || '').slice(0, 220),
      input.ipAddressMasked || 'unknown',
      now,
      now,
      input.expiresAt
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

  public validateStudentSessionToken(
    rawToken: string,
    now: Date = new Date()
  ): { session: DbStudentSession; student: DbStudentAccount } | null {
    if (!rawToken || rawToken.length < 16) return null;
    const tokenHash = hashOpaqueToken(rawToken);
    const row = this.db
      .prepare('SELECT * FROM student_sessions WHERE token_hash = ? AND revoked_at IS NULL')
      .get(tokenHash) as any;
    if (!row) return null;

    const expiresMs = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) {
      this.revokeStudentSessionByJti(row.jti);
      return null;
    }

    const student = this.getStudentById(row.student_id);
    if (!student || student.accountStatus === 'suspended') {
      return null;
    }

    const nowIso = now.toISOString();
    this.db.prepare('UPDATE student_sessions SET last_active_at = ? WHERE jti = ?').run(nowIso, row.jti);

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

  public listStudentSessions(studentId: string, currentJti?: string): SafeStudentSession[] {
    const nowIso = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT jti, user_agent, ip_address_masked, created_at, last_active_at, expires_at
      FROM student_sessions
      WHERE student_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY last_active_at DESC
    `).all(studentId, nowIso) as any[];

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

  public revokeStudentSessionByJti(jti: string, studentId?: string): boolean {
    const nowIso = new Date().toISOString();
    const res = studentId
      ? (this.db
          .prepare('UPDATE student_sessions SET revoked_at = ? WHERE jti = ? AND student_id = ? AND revoked_at IS NULL')
          .run(nowIso, jti, studentId) as any)
      : (this.db
          .prepare('UPDATE student_sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL')
          .run(nowIso, jti) as any);
    return (res.changes ?? 0) > 0;
  }

  public revokeAllStudentSessions(studentId: string, exceptJti?: string): number {
    const nowIso = new Date().toISOString();
    const res = exceptJti
      ? (this.db
          .prepare('UPDATE student_sessions SET revoked_at = ? WHERE student_id = ? AND jti != ? AND revoked_at IS NULL')
          .run(nowIso, studentId, exceptJti) as any)
      : (this.db
          .prepare('UPDATE student_sessions SET revoked_at = ? WHERE student_id = ? AND revoked_at IS NULL')
          .run(nowIso, studentId) as any);
    return res.changes ?? 0;
  }

  public createStudentDeletionRequest(
    studentId: string,
    reason: string,
    mode: 'request' | 'delete_now' = 'request'
  ): { request: StudentDeletionRequestRecord; deletedImmediately: boolean } {
    const account = this.getStudentById(studentId);
    if (!account) {
      throw new Error('Student account not found.');
    }

    const nowIso = new Date().toISOString();
    const reqId = `del-stu-${crypto.randomBytes(6).toString('hex')}`;
    const emailHash = hashEmailForAudit(account.email);

    if (mode === 'delete_now') {
      this.db.prepare(`
        INSERT INTO student_deletion_requests (id, student_id, email_hash, reason, status, requested_at, processed_at)
        VALUES (?, ?, ?, ?, 'completed', ?, ?)
      `).run(reqId, studentId, emailHash, reason || 'Self-service immediate erasure', nowIso, nowIso);

      this.revokeAllStudentSessions(studentId);
      this.db.prepare('DELETE FROM student_accounts WHERE id = ?').run(studentId);

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

    this.db.prepare(`
      UPDATE student_deletion_requests SET status = 'cancelled', processed_at = ?
      WHERE student_id = ? AND status = 'pending'
    `).run(nowIso, studentId);

    this.db.prepare(`
      INSERT INTO student_deletion_requests (id, student_id, email_hash, reason, status, requested_at, processed_at)
      VALUES (?, ?, ?, ?, 'pending', ?, NULL)
    `).run(reqId, studentId, emailHash, reason || 'Student requested account deletion', nowIso);

    this.db.prepare(`
      UPDATE student_accounts SET
        account_status = 'deletion_pending',
        deletion_requested_at = ?,
        deletion_reason = ?,
        updated_at = ?
      WHERE id = ?
    `).run(nowIso, reason || 'Student requested account deletion', nowIso, studentId);

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

  public cancelStudentDeletionRequest(studentId: string): DbStudentAccount | null {
    const account = this.getStudentById(studentId);
    if (!account) return null;

    const nowIso = new Date().toISOString();
    this.db.prepare(`
      UPDATE student_deletion_requests SET status = 'cancelled', processed_at = ?
      WHERE student_id = ? AND status = 'pending'
    `).run(nowIso, studentId);

    this.db.prepare(`
      UPDATE student_accounts SET
        account_status = 'active',
        deletion_requested_at = NULL,
        deletion_reason = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(nowIso, studentId);

    return this.getStudentById(studentId);
  }

  public getStudentAccountCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM student_accounts').get() as any;
    return Number(row?.count || 0);
  }

  // =========================================================================
  // PHASE 15: COMPANY & EMPLOYER AUTHENTICATION, VERIFICATION & AUDIT LOGS
  // =========================================================================

  private mapCompanyAccountRow(r: any): CompanyAccountRecord {
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
      emailVerified: r.email_verified === 1 || r.email_verified === true,
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
      privacyConsentAccepted: r.privacy_consent_accepted === 1 || r.privacy_consent_accepted === true,
      privacyConsentAt: r.privacy_consent_at || null,
      lastLoginAt: r.last_login_at || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapCompanySessionRow(r: any): CompanySessionRecord {
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

  private mapCompanyAuditLogRow(r: any): CompanyAuditLogRecord {
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

  public getCompanyById(id: string): CompanyAccountRecord | null {
    const row = this.db.prepare('SELECT * FROM company_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapCompanyAccountRow(row) : null;
  }

  public getCompanyByEmail(email: string): CompanyAccountRecord | null {
    const normalized = normalizeCompanyEmail(email);
    const row = this.db.prepare('SELECT * FROM company_accounts WHERE email = ?').get(normalized) as any;
    return row ? this.mapCompanyAccountRow(row) : null;
  }

  public listAllCompaniesAdmin(): Array<CompanyAccountRecord & { jobCount: number }> {
    const rows = this.db
      .prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM jobs j WHERE j.company_account_id = c.id) AS job_count
        FROM company_accounts c
        ORDER BY c.created_at DESC
      `)
      .all() as any[];

    return rows.map((r) => ({
      ...this.mapCompanyAccountRow(r),
      jobCount: Number(r.job_count || 0),
    }));
  }

  public createCompanyAccount(input: {
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
  }): CompanyAccountRecord {
    const normalizedEmail = normalizeCompanyEmail(input.email);
    const existing = this.getCompanyByEmail(normalizedEmail);
    if (existing) {
      throw new Error('A company account with this work email is already registered.');
    }

    const id = `comp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO company_accounts (
          id, email, password_hash, contact_name, contact_title, contact_phone,
          organization_name, organization_type, official_website, headquarters_location,
          organization_size, founded_year, industry_focus, description, registration_identifier,
          default_application_destination_type, default_application_url, default_application_email,
          email_verified, verification_token_hash, verification_token_expires_at,
          verification_status, account_status, privacy_consent_accepted, privacy_consent_at,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'external_url', ?, ?,
          0, ?, ?,
          'unverified', 'active', 1, ?,
          ?, ?
        )
      `)
      .run(
        id,
        normalizedEmail,
        input.passwordHash,
        input.contactName,
        input.contactTitle || '',
        input.contactPhone || '',
        input.organizationName,
        input.organizationType || 'Private Biopharma',
        input.officialWebsite,
        input.headquartersLocation,
        input.organizationSize || '',
        input.foundedYear || '',
        input.industryFocus || '',
        input.description || '',
        input.registrationIdentifier || '',
        input.officialWebsite,
        normalizedEmail,
        input.verificationTokenHash,
        input.verificationTokenExpiresAt,
        now,
        now,
        now
      );

    return this.getCompanyById(id)!;
  }

  public setCompanyVerificationToken(companyId: string, tokenHash: string, expiresAtIso: string): boolean {
    const res = this.db
      .prepare(`
        UPDATE company_accounts SET
          verification_token_hash = ?,
          verification_token_expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(tokenHash, expiresAtIso, new Date().toISOString(), companyId) as any;
    return (res.changes ?? 0) > 0;
  }

  public verifyCompanyEmailByToken(rawToken: string): CompanyAccountRecord | null {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const row = this.db
      .prepare(`
        SELECT * FROM company_accounts
        WHERE verification_token_hash = ?
          AND verification_token_expires_at IS NOT NULL
          AND verification_token_expires_at > ?
      `)
      .get(tokenHash, nowIso) as any;
    if (!row) return null;

    this.db
      .prepare(`
        UPDATE company_accounts SET
          email_verified = 1,
          email_verified_at = ?,
          verification_token_hash = NULL,
          verification_token_expires_at = NULL,
          updated_at = ?
        WHERE id = ?
      `)
      .run(nowIso, nowIso, row.id);

    return this.getCompanyById(row.id);
  }

  public setCompanyPasswordResetToken(companyId: string, tokenHash: string, expiresAtIso: string): boolean {
    const res = this.db
      .prepare(`
        UPDATE company_accounts SET
          reset_token_hash = ?,
          reset_token_expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(tokenHash, expiresAtIso, new Date().toISOString(), companyId) as any;
    return (res.changes ?? 0) > 0;
  }

  public consumeCompanyPasswordResetToken(rawToken: string, newPasswordHash: string): CompanyAccountRecord | null {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const row = this.db
      .prepare(`
        SELECT * FROM company_accounts
        WHERE reset_token_hash = ?
          AND reset_token_expires_at IS NOT NULL
          AND reset_token_expires_at > ?
      `)
      .get(tokenHash, nowIso) as any;
    if (!row) return null;

    this.db
      .prepare(`
        UPDATE company_accounts SET
          password_hash = ?,
          reset_token_hash = NULL,
          reset_token_expires_at = NULL,
          updated_at = ?
        WHERE id = ?
      `)
      .run(newPasswordHash, nowIso, row.id);

    this.revokeAllCompanySessions(row.id);
    return this.getCompanyById(row.id);
  }

  public updateCompanyPassword(companyId: string, newPasswordHash: string): boolean {
    const res = this.db
      .prepare('UPDATE company_accounts SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newPasswordHash, new Date().toISOString(), companyId) as any;
    return (res.changes ?? 0) > 0;
  }

  public updateCompanyLastLogin(companyId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE company_accounts SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, companyId);
  }

  public updateCompanyProfile(
    companyId: string,
    updates: {
      contactName?: string;
      contactTitle?: string;
      contactPhone?: string;
      organizationName?: string;
      organizationType?: string;
      officialWebsite?: string;
      headquartersLocation?: string;
      organizationSize?: string;
      foundedYear?: string;
      industryFocus?: string;
      description?: string;
      registrationIdentifier?: string;
      linkedinUrl?: string;
      defaultApplicationDestinationType?: ApplicationDestinationType;
      defaultApplicationUrl?: string;
      defaultApplicationEmail?: string;
    }
  ): CompanyAccountRecord | null {
    const existing = this.getCompanyById(companyId);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE company_accounts SET
          contact_name = ?,
          contact_title = ?,
          contact_phone = ?,
          organization_name = ?,
          organization_type = ?,
          official_website = ?,
          headquarters_location = ?,
          organization_size = ?,
          founded_year = ?,
          industry_focus = ?,
          description = ?,
          registration_identifier = ?,
          linkedin_url = ?,
          default_application_destination_type = ?,
          default_application_url = ?,
          default_application_email = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        updates.contactName ?? existing.contactName,
        updates.contactTitle ?? existing.contactTitle,
        updates.contactPhone ?? existing.contactPhone,
        updates.organizationName ?? existing.organizationName,
        updates.organizationType ?? existing.organizationType,
        updates.officialWebsite ?? existing.officialWebsite,
        updates.headquartersLocation ?? existing.headquartersLocation,
        updates.organizationSize ?? existing.organizationSize,
        updates.foundedYear ?? existing.foundedYear,
        updates.industryFocus ?? existing.industryFocus,
        updates.description ?? existing.description,
        updates.registrationIdentifier ?? existing.registrationIdentifier,
        updates.linkedinUrl ?? existing.linkedinUrl,
        updates.defaultApplicationDestinationType ?? existing.defaultApplicationDestinationType,
        updates.defaultApplicationUrl ?? existing.defaultApplicationUrl,
        updates.defaultApplicationEmail ?? existing.defaultApplicationEmail,
        now,
        companyId
      );

    return this.getCompanyById(companyId);
  }

  public submitCompanyEmployerVerification(
    companyId: string,
    payload: {
      officialWebsite: string;
      registrationIdentifier?: string;
      verificationEvidenceUrl?: string;
      verificationNotes: string;
    }
  ): CompanyAccountRecord | null {
    const existing = this.getCompanyById(companyId);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE company_accounts SET
          official_website = ?,
          registration_identifier = ?,
          verification_evidence_url = ?,
          verification_notes = ?,
          verification_status = 'pending_review',
          verification_submitted_at = ?,
          rejection_reason = '',
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        payload.officialWebsite,
        payload.registrationIdentifier ?? existing.registrationIdentifier,
        payload.verificationEvidenceUrl || '',
        payload.verificationNotes,
        now,
        now,
        companyId
      );

    return this.getCompanyById(companyId);
  }

  public setCompanyVerificationDecisionAdmin(
    companyId: string,
    decision: 'verified' | 'rejected' | 'unverified',
    adminIdentifier: string,
    notesOrReason: string = ''
  ): CompanyAccountRecord | null {
    const existing = this.getCompanyById(companyId);
    if (!existing) return null;

    const now = new Date().toISOString();
    if (decision === 'verified') {
      this.db
        .prepare(`
          UPDATE company_accounts SET
            verification_status = 'verified',
            verified_by = ?,
            verified_at = ?,
            rejection_reason = '',
            updated_at = ?
          WHERE id = ?
        `)
        .run(adminIdentifier, now, now, companyId);
    } else if (decision === 'rejected') {
      this.db
        .prepare(`
          UPDATE company_accounts SET
            verification_status = 'rejected',
            verified_by = ?,
            verified_at = NULL,
            rejection_reason = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(adminIdentifier, notesOrReason || 'Verification evidence could not be confirmed.', now, companyId);
    } else {
      this.db
        .prepare(`
          UPDATE company_accounts SET
            verification_status = 'unverified',
            verified_by = NULL,
            verified_at = NULL,
            rejection_reason = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(notesOrReason, now, companyId);
    }

    return this.getCompanyById(companyId);
  }

  public setCompanyAccountStatusAdmin(
    companyId: string,
    status: CompanyAccountStatus,
    adminIdentifier: string,
    reason: string = ''
  ): { company: CompanyAccountRecord | null; revokedSessions: number } {
    const existing = this.getCompanyById(companyId);
    if (!existing) return { company: null, revokedSessions: 0 };

    const now = new Date().toISOString();
    let revokedSessions = 0;

    if (status === 'suspended') {
      this.db
        .prepare(`
          UPDATE company_accounts SET
            account_status = 'suspended',
            suspended_at = ?,
            suspended_by = ?,
            suspension_reason = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(now, adminIdentifier, reason || 'Suspended by platform administrator.', now, companyId);
      revokedSessions = this.revokeAllCompanySessions(companyId);
    } else {
      this.db
        .prepare(`
          UPDATE company_accounts SET
            account_status = 'active',
            suspended_at = NULL,
            suspended_by = NULL,
            suspension_reason = '',
            updated_at = ?
          WHERE id = ?
        `)
        .run(now, companyId);
    }

    return {
      company: this.getCompanyById(companyId),
      revokedSessions,
    };
  }

  public createCompanySession(input: {
    jti: string;
    companyId: string;
    rawToken: string;
    userAgent: string;
    ipMasked: string;
    expiresAt: string;
  }): CompanySessionRecord {
    const now = new Date().toISOString();
    const tokenHash = hashOpaqueToken(input.rawToken);

    this.db
      .prepare(`
        INSERT INTO company_sessions (jti, company_id, token_hash, user_agent, ip_masked, created_at, last_active_at, expires_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(
        input.jti,
        input.companyId,
        tokenHash,
        input.userAgent.slice(0, 260),
        input.ipMasked || 'unknown',
        now,
        now,
        input.expiresAt
      );

    const row = this.db.prepare('SELECT * FROM company_sessions WHERE jti = ?').get(input.jti) as any;
    return this.mapCompanySessionRow(row);
  }

  public validateCompanySessionToken(
    rawToken: string
  ): { session: CompanySessionRecord; company: CompanyAccountRecord } | null {
    const tokenHash = hashOpaqueToken(rawToken);
    const nowIso = new Date().toISOString();
    const sessionRow = this.db
      .prepare(`
        SELECT * FROM company_sessions
        WHERE token_hash = ?
          AND revoked_at IS NULL
          AND expires_at > ?
      `)
      .get(tokenHash, nowIso) as any;

    if (!sessionRow) return null;

    const company = this.getCompanyById(sessionRow.company_id);
    if (!company) return null;

    this.db
      .prepare('UPDATE company_sessions SET last_active_at = ? WHERE jti = ?')
      .run(nowIso, sessionRow.jti);

    return {
      session: { ...this.mapCompanySessionRow(sessionRow), lastActiveAt: nowIso },
      company,
    };
  }

  public listActiveCompanySessions(companyId: string, currentJti?: string): CompanySessionRecord[] {
    const nowIso = new Date().toISOString();
    const rows = this.db
      .prepare(`
        SELECT * FROM company_sessions
        WHERE company_id = ? AND revoked_at IS NULL AND expires_at > ?
        ORDER BY last_active_at DESC
      `)
      .all(companyId, nowIso) as any[];
    return rows.map((r) => ({
      ...this.mapCompanySessionRow(r),
      isCurrent: Boolean(currentJti && r.jti === currentJti),
    }));
  }

  public revokeCompanySessionByJti(jti: string, companyId?: string): boolean {
    const nowIso = new Date().toISOString();
    const res = companyId
      ? (this.db
          .prepare('UPDATE company_sessions SET revoked_at = ? WHERE jti = ? AND company_id = ? AND revoked_at IS NULL')
          .run(nowIso, jti, companyId) as any)
      : (this.db
          .prepare('UPDATE company_sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL')
          .run(nowIso, jti) as any);
    return (res.changes ?? 0) > 0;
  }

  public revokeAllCompanySessions(companyId: string, exceptJti?: string): number {
    const nowIso = new Date().toISOString();
    const res = exceptJti
      ? (this.db
          .prepare('UPDATE company_sessions SET revoked_at = ? WHERE company_id = ? AND jti != ? AND revoked_at IS NULL')
          .run(nowIso, companyId, exceptJti) as any)
      : (this.db
          .prepare('UPDATE company_sessions SET revoked_at = ? WHERE company_id = ? AND revoked_at IS NULL')
          .run(nowIso, companyId) as any);
    return res.changes ?? 0;
  }

  public getJobsByCompanyAccountId(companyAccountId: string): DbJob[] {
    const rows = this.db
      .prepare('SELECT * FROM jobs WHERE company_account_id = ? ORDER BY created_at DESC')
      .all(companyAccountId) as any[];
    return rows.map((r) => this.mapJobRow(r));
  }

  public createCompanyAuditLog(entry: {
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
  }): CompanyAuditLogRecord {
    const id = generateCompanyAuditId();
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO company_audit_logs (
          id, company_id, actor_type, actor_id, actor_email,
          action, target_type, target_id, status, ip_masked, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        entry.companyId,
        entry.actorType,
        entry.actorId || '',
        entry.actorEmail || '',
        entry.action,
        entry.targetType || 'company',
        entry.targetId || '',
        entry.status || 'success',
        entry.ipMasked || 'unknown',
        entry.details || '',
        now
      );

    const row = this.db.prepare('SELECT * FROM company_audit_logs WHERE id = ?').get(id) as any;
    return this.mapCompanyAuditLogRow(row);
  }

  public getCompanyAuditLogs(companyId?: string, limit: number = 100): CompanyAuditLogRecord[] {
    const clampedLimit = Math.max(1, Math.min(limit, 250));
    const rows = companyId
      ? (this.db
          .prepare(`
            SELECT l.*, c.organization_name
            FROM company_audit_logs l
            LEFT JOIN company_accounts c ON c.id = l.company_id
            WHERE l.company_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
          `)
          .all(companyId, clampedLimit) as any[])
      : (this.db
          .prepare(`
            SELECT l.*, c.organization_name
            FROM company_audit_logs l
            LEFT JOIN company_accounts c ON c.id = l.company_id
            ORDER BY l.created_at DESC
            LIMIT ?
          `)
          .all(clampedLimit) as any[]);

    return rows.map((r) => this.mapCompanyAuditLogRow(r));
  }

  public deleteCompanyAccount(companyId: string): boolean {
    this.revokeAllCompanySessions(companyId);
    const res = this.db.prepare('DELETE FROM company_accounts WHERE id = ?').run(companyId) as any;
    return (res.changes ?? 0) > 0;
  }
}

export const bionexaDb = new BionexaDatabase();
