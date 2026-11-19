-- =========================================================================
-- BIO-INEXA: Production PostgreSQL / Supabase Database Schema (Phase 04)
-- Supports: Opportunities, Jobs, Internships, Workshops, Courses, Users,
-- Companies, Job Applications, Admin Users & Roles, Verification Records,
-- Sync Logs, Announcements, Content Records, Compliance, Contact,
-- Newsletter, Certificates, Discussions & Replies, and Backups.
-- =========================================================================

-- Enable UUID generation extension for default text/uuid IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. COMPANIES / EMPLOYERS DIRECTORY
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) UNIQUE NOT NULL,
    website_url TEXT DEFAULT '',
    careers_url TEXT DEFAULT '',
    sector VARCHAR(128) DEFAULT 'Biotechnology',
    location VARCHAR(255) DEFAULT '',
    contact_email VARCHAR(255) DEFAULT '',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'Pending'
        CHECK (verification_status IN ('Pending', 'Verified', 'Suspended')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. USERS (Students, Researchers, Professionals, Employer Contacts)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email VARCHAR(320) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'researcher', 'professional', 'employer')),
    qualification VARCHAR(255) DEFAULT '',
    institution VARCHAR(255) DEFAULT '',
    branches TEXT[] NOT NULL DEFAULT '{}',
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    saved_opportunity_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 3. ADMIN USERS, ROLES & AUDIT LOGS (No Plaintext Secrets Stored)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(320) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'moderator'
        CHECK (role IN ('super_admin', 'moderator', 'verifier', 'editor')),
    password_hash TEXT NOT NULL DEFAULT '',
    totp_secret TEXT DEFAULT '',
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_updated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    jti TEXT PRIMARY KEY,
    admin_user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,
    actor_username VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'super_admin',
    ip_address VARCHAR(128) DEFAULT '',
    user_agent TEXT DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    identifier VARCHAR(255) NOT NULL,
    ip_address VARCHAR(128) DEFAULT '',
    attempted_username VARCHAR(255) DEFAULT '',
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(128) DEFAULT '',
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_password_resets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    admin_user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,
    actor_username VARCHAR(255) NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_username VARCHAR(255) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id TEXT DEFAULT '',
    ip_address VARCHAR(128) DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. JOBS & VERIFICATION AUDIT RECORDS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    employer VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    qualification VARCHAR(255) DEFAULT '',
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    employment_type VARCHAR(64) DEFAULT 'Full-time',
    salary VARCHAR(255) DEFAULT 'Competitive',
    application_url TEXT NOT NULL,
    source VARCHAR(255) DEFAULT 'BIO-INEXA Verified',
    original_job_url TEXT DEFAULT '',
    publication_date TEXT NOT NULL,
    expiry_date TEXT DEFAULT '',
    last_verification_date TEXT DEFAULT '',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'Pending Verification'
        CHECK (verification_status IN ('Pending Verification', 'Verified', 'Rejected', 'Expired', 'Link Unavailable')),
    verification_notes TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    sector VARCHAR(128) DEFAULT 'Biotechnology',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_verification_records (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
    verified_by VARCHAR(255) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_status VARCHAR(64) NOT NULL,
    notes TEXT DEFAULT ''
);

-- -------------------------------------------------------------------------
-- 5. INTERNSHIPS CATALOG
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internships (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    work_mode VARCHAR(32) NOT NULL DEFAULT 'On-site'
        CHECK (work_mode IN ('On-site', 'Remote', 'Hybrid', 'onsite', 'remote', 'hybrid')),
    duration VARCHAR(128) DEFAULT '6 Months',
    stipend VARCHAR(255) DEFAULT 'Not Disclosed',
    eligibility VARCHAR(255) DEFAULT '',
    qualification VARCHAR(255) DEFAULT '',
    branches TEXT[] NOT NULL DEFAULT '{}',
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    application_url TEXT NOT NULL,
    source_name VARCHAR(255) DEFAULT 'Official Organization Portal',
    source_url TEXT DEFAULT '',
    deadline TEXT DEFAULT '',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'Pending Verification'
        CHECK (verification_status IN ('Pending Verification', 'Verified', 'Rejected', 'Expired', 'Link Unavailable')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. WORKSHOPS & COURSES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    instructor VARCHAR(255) DEFAULT '',
    date TEXT NOT NULL,
    time VARCHAR(128) DEFAULT '09:00 AM - 05:00 PM IST',
    duration VARCHAR(128) DEFAULT '1 Day',
    format VARCHAR(32) NOT NULL DEFAULT 'Online' CHECK (format IN ('Online', 'Offline', 'Hybrid')),
    venue TEXT NOT NULL,
    registration_deadline TEXT DEFAULT '',
    registration_link TEXT NOT NULL,
    availability VARCHAR(128) DEFAULT 'Open',
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
    fees VARCHAR(128) DEFAULT 'Free',
    capacity INTEGER NOT NULL DEFAULT 50,
    image_url TEXT DEFAULT '',
    featured BOOLEAN NOT NULL DEFAULT false,
    skills_covered JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) DEFAULT '',
    description TEXT NOT NULL,
    duration VARCHAR(128) NOT NULL,
    fees VARCHAR(255) DEFAULT 'Free',
    eligibility TEXT DEFAULT 'Open to all Science Students',
    curriculum JSONB NOT NULL DEFAULT '[]'::jsonb,
    delivery_mode VARCHAR(128) DEFAULT 'Online (Self-Paced)',
    certificate_info TEXT DEFAULT '',
    registration_deadline TEXT DEFAULT '',
    registration_link TEXT NOT NULL,
    availability VARCHAR(128) DEFAULT 'Available',
    status VARCHAR(32) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'closed', 'active', 'archived')),
    instructor VARCHAR(255) DEFAULT '',
    level VARCHAR(64) DEFAULT 'Intermediate',
    category VARCHAR(128) DEFAULT 'Biotechnology',
    image_url TEXT DEFAULT '',
    is_certificate_available BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. UNIFIED OPPORTUNITIES & SUBMITTED OPPORTUNITIES MODERATION QUEUE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('job', 'internship', 'workshop', 'course', 'fellowship')),
    location VARCHAR(255) NOT NULL,
    work_mode VARCHAR(32) NOT NULL CHECK (work_mode IN ('onsite', 'remote', 'hybrid', 'On-site', 'Remote', 'Hybrid')),
    experience VARCHAR(128) DEFAULT 'Not Specified',
    qualification VARCHAR(255) DEFAULT '',
    branches TEXT[] NOT NULL DEFAULT '{}',
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT NOT NULL,
    responsibilities TEXT[] DEFAULT '{}',
    requirements TEXT[] DEFAULT '{}',
    compensation JSONB DEFAULT '{"isDisclosed": false}'::jsonb,
    application_url TEXT NOT NULL,
    deadline TEXT DEFAULT '',
    source JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closing_soon', 'expired', 'verification_needed', 'source_unavailable')),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    duplicate_of TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
    workshop_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submitted_opportunities (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'job',
    sub_category VARCHAR(128) DEFAULT '',
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    work_mode VARCHAR(32) NOT NULL DEFAULT 'On-site',
    experience VARCHAR(128) DEFAULT 'Not Specified',
    qualification VARCHAR(255) DEFAULT '',
    branches JSONB NOT NULL DEFAULT '[]'::jsonb,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    salary_or_stipend VARCHAR(255) DEFAULT 'Not Disclosed',
    salary_tier VARCHAR(64) DEFAULT 'not_disclosed',
    deadline TEXT DEFAULT '',
    posted_date TEXT NOT NULL,
    source_name VARCHAR(255) DEFAULT 'Direct Employer / Organizer Submission',
    source_url TEXT DEFAULT '',
    application_url TEXT NOT NULL,
    contact_email VARCHAR(320) DEFAULT '',
    status VARCHAR(64) NOT NULL DEFAULT 'Pending Verification',
    is_approved BOOLEAN NOT NULL DEFAULT false,
    workshop_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. ANNOUNCEMENTS & WEBSITE CONTENT RECORDS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    title VARCHAR(255) NOT NULL,
    tag VARCHAR(64) NOT NULL,
    content TEXT DEFAULT '',
    date TEXT NOT NULL,
    link TEXT DEFAULT '/opportunities',
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_records (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    key VARCHAR(128) UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

-- -------------------------------------------------------------------------
-- 9. SYNCHRONIZATION LOGS & POINT-IN-TIME BACKUPS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunity_sync_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    source_id VARCHAR(64) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    items_fetched INTEGER NOT NULL DEFAULT 0,
    items_added INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_expired INTEGER NOT NULL DEFAULT 0,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS database_backups (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    filename VARCHAR(255) NOT NULL,
    storage_backend VARCHAR(64) NOT NULL DEFAULT 'supabase-snapshot',
    path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    checksum_sha256 VARCHAR(128) DEFAULT '',
    snapshot_data JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 10. COMPLIANCE, CONTACT, NEWSLETTER, CERTIFICATES, APPLICATIONS, COMMUNITY
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_requests (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    request_type VARCHAR(64) NOT NULL
        CHECK (request_type IN ('privacy_request', 'grievance', 'job_report', 'content_removal')),
    sub_category VARCHAR(255) NOT NULL,
    requester_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(320) NOT NULL,
    organization VARCHAR(255) DEFAULT '',
    target_title_or_url TEXT DEFAULT '',
    details TEXT NOT NULL,
    consent_accepted BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(32) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'In Review', 'Resolved', 'Action Taken')),
    resolution_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Reviewed', 'Resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email VARCHAR(320) UNIQUE NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    certificate_number VARCHAR(128) UNIQUE NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    issue_date TEXT NOT NULL,
    score INTEGER NOT NULL,
    verification_code VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    internship_id TEXT REFERENCES internships(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    applicant_email VARCHAR(320) NOT NULL,
    phone VARCHAR(64) DEFAULT '',
    qualification VARCHAR(255) DEFAULT '',
    experience_years VARCHAR(64) DEFAULT '',
    cover_note TEXT DEFAULT '',
    applied_date TEXT NOT NULL,
    application_channel VARCHAR(32) NOT NULL DEFAULT 'bioinexa_direct'
        CHECK (application_channel IN ('bioinexa_direct', 'external_portal')),
    status VARCHAR(32) NOT NULL DEFAULT 'Under Review'
        CHECK (status IN ('Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discussions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(128) DEFAULT 'BIO-INEXA Member',
    category VARCHAR(128) NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discussion_replies (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    topic_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(128) DEFAULT 'BIO-INEXA Member',
    content TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 11. PERFORMANCE INDEXES
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_companies_verification ON companies(verification_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ident ON admin_login_attempts(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_resets_token_hash ON admin_password_resets(token_hash);

CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_is_approved ON jobs(is_approved);
CREATE INDEX IF NOT EXISTS idx_jobs_sector ON jobs(sector);
CREATE INDEX IF NOT EXISTS idx_jobs_verification_status ON jobs(verification_status);
CREATE INDEX IF NOT EXISTS idx_job_verifications_job_id ON job_verification_records(job_id);

CREATE INDEX IF NOT EXISTS idx_internships_active_approved ON internships(is_active, is_approved);
CREATE INDEX IF NOT EXISTS idx_internships_branches ON internships USING GIN(branches);

CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_featured ON workshops(featured);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses(featured);

CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_branches ON opportunities USING GIN(branches);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_approved ON opportunities(is_approved);

CREATE INDEX IF NOT EXISTS idx_sub_opps_approved ON submitted_opportunities(is_approved);
CREATE INDEX IF NOT EXISTS idx_sub_opps_type ON submitted_opportunities(type);

CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON opportunity_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_job_apps_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_disc_replies_topic ON discussion_replies(topic_id);

-- -------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) — LEAST-PRIVILEGE ENFORCEMENT
-- Note: Server-side API handlers use SUPABASE_SERVICE_ROLE_KEY which runs
-- privileged backend operations cleanly without exposing write permissions
-- to public/anon browser keys.
-- -------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE submitted_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;

-- Public Read-Only Policies (strictly approved/active non-sensitive public catalog data)
DROP POLICY IF EXISTS "Public Read Approved Opportunities" ON opportunities;
CREATE POLICY "Public Read Approved Opportunities"
    ON opportunities FOR SELECT
    USING (is_approved = true);

DROP POLICY IF EXISTS "Public Read Approved Submitted Opportunities" ON submitted_opportunities;
CREATE POLICY "Public Read Approved Submitted Opportunities"
    ON submitted_opportunities FOR SELECT
    USING (is_approved = true);

DROP POLICY IF EXISTS "Public Read Approved Jobs" ON jobs;
CREATE POLICY "Public Read Approved Jobs"
    ON jobs FOR SELECT
    USING (is_active = true AND is_approved = true);

DROP POLICY IF EXISTS "Public Read Approved Internships" ON internships;
CREATE POLICY "Public Read Approved Internships"
    ON internships FOR SELECT
    USING (is_active = true AND is_approved = true);

DROP POLICY IF EXISTS "Public Read Workshops" ON workshops;
CREATE POLICY "Public Read Workshops"
    ON workshops FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public Read Courses" ON courses;
CREATE POLICY "Public Read Courses"
    ON courses FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public Read Active Announcements" ON announcements;
CREATE POLICY "Public Read Active Announcements"
    ON announcements FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Public Read Content Records" ON content_records;
CREATE POLICY "Public Read Content Records"
    ON content_records FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public Read Verified Companies" ON companies;
CREATE POLICY "Public Read Verified Companies"
    ON companies FOR SELECT
    USING (verification_status = 'Verified');

DROP POLICY IF EXISTS "Public Read Certificates For Verification" ON certificates;
CREATE POLICY "Public Read Certificates For Verification"
    ON certificates FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public Read Community Discussions" ON discussions;
CREATE POLICY "Public Read Community Discussions"
    ON discussions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public Read Discussion Replies" ON discussion_replies;
CREATE POLICY "Public Read Discussion Replies"
    ON discussion_replies FOR SELECT
    USING (true);

-- Public users may submit pending unapproved opportunities only if inserting via anon JWT,
-- never pre-approved, while all privileged/PII tables (users, admin_users, admin_audit_logs,
-- job_verification_records, compliance_requests, contact_messages, newsletter_subscribers,
-- job_applications, opportunity_sync_logs, database_backups) remain strictly server-side only.
DROP POLICY IF EXISTS "Public Can Submit For Moderation" ON opportunities;
CREATE POLICY "Public Can Submit For Moderation"
    ON opportunities FOR INSERT
    WITH CHECK (is_approved = false AND is_verified = false);

DROP POLICY IF EXISTS "Public Can Submit Queued Opportunity" ON submitted_opportunities;
CREATE POLICY "Public Can Submit Queued Opportunity"
    ON submitted_opportunities FOR INSERT
    WITH CHECK (is_approved = false);
