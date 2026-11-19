-- =========================================================================
-- Migration 002: Phase 05 — Secure Admin Authentication, RBAC & Audit Logs
-- Safe, idempotent migration over existing Phase 04 Supabase schema.
-- =========================================================================

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

ALTER TABLE admin_audit_logs
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(128) DEFAULT '';

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

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ident ON admin_login_attempts(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_resets_token_hash ON admin_password_resets(token_hash);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_password_resets ENABLE ROW LEVEL SECURITY;
