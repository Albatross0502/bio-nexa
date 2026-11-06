-- =========================================================================
-- BIO-NEXA: PostgreSQL / Supabase Zero-Budget Database Schema
-- Provides persistence for 13 Educational Branches, Opportunities,
-- Workshop Specifications, Source Attribution, and Moderation Audit Logs.
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('job', 'internship', 'workshop')),
    location VARCHAR(255) NOT NULL,
    work_mode VARCHAR(32) NOT NULL CHECK (work_mode IN ('onsite', 'remote', 'hybrid')),
    experience VARCHAR(128) DEFAULT 'Not Specified',
    qualification VARCHAR(255),
    branches TEXT[] NOT NULL DEFAULT '{}',
    description TEXT NOT NULL,
    responsibilities TEXT[] DEFAULT '{}',
    requirements TEXT[] DEFAULT '{}',
    compensation JSONB DEFAULT '{"isDisclosed": false}'::jsonb,
    application_url TEXT NOT NULL,
    deadline DATE,
    source JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closing_soon', 'expired', 'verification_needed', 'source_unavailable')),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    duplicate_of UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    workshop_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for High Performance Branch & Type Filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_branches ON opportunities USING GIN(branches);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_approved ON opportunities(is_approved);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Anonymous users (Students/Jobseekers) can view ONLY approved listings
CREATE POLICY "Public Read Approved Opportunities"
    ON opportunities
    FOR SELECT
    USING (is_approved = true);

-- Authenticated Admin can perform full CRUD
CREATE POLICY "Admin Full Access"
    ON opportunities
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Anyone can insert pending submissions (is_approved must be FALSE on insert)
CREATE POLICY "Public Can Submit For Moderation"
    ON opportunities
    FOR INSERT
    WITH CHECK (is_approved = false);

-- 4. Sync Logs Table
CREATE TABLE IF NOT EXISTS opportunity_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id VARCHAR(64) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    items_fetched INT NOT NULL DEFAULT 0,
    items_added INT NOT NULL DEFAULT 0,
    items_expired INT NOT NULL DEFAULT 0,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
