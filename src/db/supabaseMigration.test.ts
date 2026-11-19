import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BionexaDatabase } from './bionexaDatabase.js';
import {
  buildDatabaseSnapshotPayload,
  buildSupabaseMigrationPayload,
  migrateSqliteToSupabase,
  verifyDatabaseSnapshotPayload,
} from './supabaseMigration.js';
import { getSupabaseRepository } from '../../netlify/functions/_shared/supabaseDb.js';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '..', '..');

test('db/schema.sql defines all Phase 04 PostgreSQL tables, FKs, indexes, and RLS policies', () => {
  const schema = fs.readFileSync(path.join(WORKSPACE_ROOT, 'db', 'schema.sql'), 'utf8');

  const requiredTables = [
    'companies',
    'users',
    'admin_users',
    'admin_sessions',
    'admin_login_attempts',
    'admin_audit_logs',
    'admin_password_resets',
    'jobs',
    'job_verification_records',
    'internships',
    'workshops',
    'courses',
    'opportunities',
    'submitted_opportunities',
    'announcements',
    'content_records',
    'opportunity_sync_logs',
    'database_backups',
    'compliance_requests',
    'contact_messages',
    'newsletter_subscribers',
    'certificates',
    'job_applications',
    'discussions',
    'discussion_replies',
  ];

  for (const table of requiredTables) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), `Missing table ${table}`);
    assert.match(schema, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`), `Missing RLS on ${table}`);
  }

  // Must use TEXT primary keys (with uuid_generate_v4()::text default) to migrate legacy IDs cleanly
  assert.doesNotMatch(schema, /\bid UUID PRIMARY KEY\b/);
});

test('buildSupabaseMigrationPayload extracts deduplicated FK-safe records and computes valid SHA-256 snapshot', () => {
  const db = new BionexaDatabase(':memory:');
  db.seedInitialDataIfEmpty(
    [],
    [],
    [],
    [],
    {
      certificateNumber: 'BN-2026-CRISPR-9842',
      recipientName: 'Aarav Gautam',
      courseTitle: 'CRISPR-Cas9 Gene Editing',
      issueDate: '2026-10-15',
      score: 92,
      verificationCode: 'VERIFIED-BN-2026',
    }
  );

  db.createJob({
    id: 'job-intern-test',
    title: 'Summer Biotech Research Internship',
    employer: 'CSIR-IGIB',
    description: 'Summer genomics training internship.',
    location: 'New Delhi (On-site)',
    qualification: 'B.Tech / M.Sc',
    skills: ['PCR', 'NGS'],
    employmentType: 'Internship',
    salary: '₹15,000 / month',
    applicationUrl: 'https://www.igib.res.in/careers',
    source: 'CSIR Official Portal',
    publicationDate: '2026-11-01',
    expiryDate: '2026-12-30',
    verificationStatus: 'Verified',
    isActive: true,
    isApproved: true,
    featured: false,
    responsibilities: ['Assist lab workflows'],
    requirements: ['Molecular biology basics'],
    sector: 'Government / Autonomous',
  });

  db.subscribeNewsletter('dup@bio.edu');
  db.subscribeNewsletter('DUP@BIO.EDU');

  const payload = buildSupabaseMigrationPayload(db);
  assert.ok(payload.jobs.length >= 1);
  assert.ok(payload.internships.length >= 1);
  assert.ok(payload.companies.length >= 1);
  assert.equal(payload.newsletterSubscribers.length, 1);
  assert.equal(payload.certificates.length, 1);

  const snapshot = buildDatabaseSnapshotPayload(db);
  assert.equal(verifyDatabaseSnapshotPayload(snapshot).valid, true);

  // Tampering breaks SHA-256 verification
  const tampered = { ...snapshot, checksumSha256: '0'.repeat(64) };
  assert.equal(verifyDatabaseSnapshotPayload(tampered).valid, false);
});

test('migrateSqliteToSupabase runs idempotent dry-run & mocked remote upsert verification cleanly', async () => {
  const db = new BionexaDatabase(':memory:');
  db.createCertificate({
    certificateNumber: 'BN-MIG-100',
    recipientName: 'Priya Nair',
    courseTitle: 'NGS Data Analysis',
    score: 95,
  });

  const dryReport = await migrateSqliteToSupabase({ db, dryRun: true });
  assert.equal(dryReport.dryRun, true);
  assert.equal(dryReport.success, true);
  assert.equal(dryReport.sourceCounts.certificates, 1);

  const upsertedTables: string[] = [];
  const fakeClient: any = {
    from(table: string) {
      return {
        async upsert(rows: any[]) {
          upsertedTables.push(`${table}:${rows.length}`);
          return { error: null };
        },
        async select() {
          return { count: 100, error: null };
        },
      };
    },
  };

  const liveReport = await migrateSqliteToSupabase({ db, client: fakeClient, dryRun: false });
  assert.equal(liveReport.dryRun, false);
  assert.equal(liveReport.success, true);
  assert.equal(liveReport.mismatches.length, 0);
  assert.ok(upsertedTables.some((entry) => entry.startsWith('certificates:1')));
});

test('getSupabaseRepository returns null without credentials and executes authenticated PostgREST calls when configured', async () => {
  assert.equal(getSupabaseRepository({}), null);

  const requests: Array<{ url: string; method: string; authHeader: string | null }> = [];
  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init?.headers);
    requests.push({
      url,
      method: (init?.method || 'GET').toUpperCase(),
      authHeader: headers.get('authorization'),
    });
    return new Response(
      JSON.stringify([
        {
          id: 'job-remote-1',
          title: 'Genomics Analyst',
          employer: 'NCBS',
          description: 'Single-cell genomics role',
          location: 'Bengaluru',
          skills: ['Python'],
          employment_type: 'Full-time',
          salary: '₹10,00,000 / yr',
          application_url: 'https://www.ncbs.res.in/',
          source: 'NCBS Portal',
          publication_date: '2026-11-10',
          expiry_date: '2026-12-31',
          verification_status: 'Verified',
          is_active: true,
          is_approved: true,
          featured: true,
          responsibilities: [],
          requirements: [],
          sector: 'Research',
          created_at: '2026-11-10T00:00:00Z',
          updated_at: '2026-11-10T00:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const repo = getSupabaseRepository(
    {
      SUPABASE_URL: 'https://example-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-secret',
    },
    mockFetch
  );
  assert.ok(repo);

  const jobs = await repo!.getJobs();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'job-remote-1');
  assert.equal(jobs[0].isVerified, true);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.includes('https://example-project.supabase.co/rest/v1/jobs'));
  assert.equal(requests[0].authHeader, 'Bearer test-service-role-secret');
});
