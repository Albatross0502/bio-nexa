# BIO-INEXA — Supabase PostgreSQL Production Integration Guide (Phase 04)

This guide documents how BIO-INEXA transitions from local development SQLite (`db/bionexa.db`) to shared, persistent **Supabase PostgreSQL** in Netlify serverless production while preserving 100% of existing local and design functionality.

---

## 1. Environment Variables Required

Configure these variables in Netlify Site Settings (or local `.env`, never committed to Git):

| Variable | Visibility | Purpose |
|---|---|---|
| `SUPABASE_URL` | **Server-side only** | Your Supabase Project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-side secret ONLY** | Used exclusively by Netlify Functions (`netlify/functions/_shared/supabaseDb.ts`) & migration CLI |
| `ADMIN_USERNAME` | **Server-side** | Operations Console administrator email/username |
| `ADMIN_PASSWORD` | **Server-side secret** | Master admin password |
| `ADMIN_SESSION_SECRET` | **Server-side secret** | HMAC-SHA256 signing key for HttpOnly session cookies |

> **Security Rule**: `SUPABASE_SERVICE_ROLE_KEY` must **NEVER** be prefixed with `VITE_` and must **NEVER** appear in `src/components/`, `src/context/`, or any frontend Vite bundle.

---

## 2. Apply the PostgreSQL Schema & Row Level Security (RLS)

1. Open your Supabase project -> **SQL Editor**.
2. Execute the contents of `/db/schema.sql` (also referenced by `/db/migrations/001_phase04_supabase_postgresql.sql`).
3. This creates all **22 relational tables**, GIN & B-tree indexes, foreign-key constraints, and strict **Row Level Security (RLS)** policies:
   - Public (`anon`) can `SELECT` only approved/active public catalog listings (`jobs`, `internships`, `workshops`, `courses`, `opportunities`, `submitted_opportunities`, `announcements`, `content_records`, `certificates`, `discussions`, `discussion_replies`, verified `companies`).
   - Sensitive/PII/operational tables (`users`, `admin_users`, `admin_audit_logs`, `job_verification_records`, `compliance_requests`, `contact_messages`, `newsletter_subscribers`, `job_applications`, `opportunity_sync_logs`, `database_backups`) deny anonymous reads/writes and are accessed strictly server-side using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 3. Migrate Existing SQLite Data Without Duplication

1. Preview the deduplicated migration payload cleanly without touching remote tables:
   ```bash
   npx tsx scripts/migrate-to-supabase.ts --dry-run
   ```
2. Run idempotent batch upsert + post-migration count verification:
   ```bash
   SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
   npx tsx scripts/migrate-to-supabase.ts
   ```
3. The script keeps `db/bionexa.db` untouched, upserts parent tables (`companies`, `jobs`, `discussions`, ...) before child FK tables (`job_verification_records`, `job_applications`, `discussion_replies`), and verifies row counts on every table.

---

## 4. Backup & Point-in-Time Recovery Procedures

- **Local Express / SQLite Dev**: Click **Create Instant Backup (VACUUM INTO)** in **Admin Panel -> G. Database & Backups** or run:
  ```bash
  npx tsx scripts/backup-database.ts
  ```
  This creates both a binary SQLite snapshot and a SHA-256 verified portable JSON recovery file in `db/backups/`.
- **Netlify + Supabase Production**: `POST /api/admin/backups` generates an authenticated logical snapshot stored in PostgreSQL `database_backups` with SHA-256 checksum & table counts, alongside Supabase automated daily database backups.
