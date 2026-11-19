import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createServiceAccountJwtAssertion,
  getGoogleSheetsConfigSummary,
  GoogleSheetsSyncStatusRecord,
  runGoogleSheetsSync,
} from './serverGoogleSheetsService';
import { BionexaDatabase, DbJob } from '../../db/bionexaDatabase';
import { SyncInProgressError } from '../jobs/opportunitySyncEngine';

test('Phase 09: getGoogleSheetsConfigSummary masks identifiers and never leaks raw credentials', () => {
  const unconf = getGoogleSheetsConfigSummary({});
  assert.equal(unconf.configured, false);
  assert.equal(unconf.mode, 'unconfigured');

  const saSummary = getGoogleSheetsConfigSummary({
    GOOGLE_SHEETS_SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sheets-reader@bionexa.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'SECRET_PRIVATE_KEY_MATERIAL',
  });
  assert.equal(saSummary.configured, true);
  assert.equal(saSummary.mode, 'service_account');
  assert.equal(saSummary.maskedSpreadsheetId, '1Bxi...upms');
  assert.equal(JSON.stringify(saSummary).includes('SECRET_PRIVATE_KEY_MATERIAL'), false);
  assert.equal(JSON.stringify(saSummary).includes('sheets-reader@bionexa.iam.gserviceaccount.com'), false);

  const keySummary = getGoogleSheetsConfigSummary({
    GOOGLE_SHEETS_SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    GOOGLE_SHEETS_API_KEY: 'AIzaSySecretKeyMaterial12345',
  });
  assert.equal(keySummary.mode, 'api_key');
  assert.equal(JSON.stringify(keySummary).includes('AIzaSySecretKeyMaterial12345'), false);
});

test('Phase 09: Service Account RS256 JWT auth + retry on 503 + imports strictly Pending Verification', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const jwt = createServiceAccountJwtAssertion({
    clientEmail: 'sync@bio-inexa.iam.gserviceaccount.com',
    privateKey,
    nowEpochSec: 1700000000,
  });
  const [hdrB64, payB64, sigB64] = jwt.split('.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${hdrB64}.${payB64}`);
  assert.equal(verifier.verify(publicKey, Buffer.from(sigB64, 'base64url')), true);

  const db = new BionexaDatabase(':memory:');
  const initialCount = db.getAllJobsAdmin().length;
  const capturedStatuses: GoogleSheetsSyncStatusRecord[] = [];

  let sheetsAttempts = 0;
  const mockFetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'mock-google-token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('sheets.googleapis.com/v4/spreadsheets')) {
      assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer mock-google-token');
      sheetsAttempts++;
      if (sheetsAttempts === 1) {
        return new Response('Backend Error', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          values: [
            [
              'Title',
              'Organization',
              'Location',
              'Application URL',
              'Salary/Stipend',
              'Application Deadline',
              'Description',
            ],
            [
              'CRISPR Assay Research Scientist',
              'CSIR-IGIB',
              'New Delhi',
              'https://www.igib.res.in/careers/crispr-2099',
              '₹56,000 / month',
              '2099-12-20',
              'Gene editing assay optimization using qPCR and NGS.',
            ],
            [
              'Blocked Shortener Role',
              'Unknown Lab',
              'Bengaluru',
              'https://bit.ly/trap-link',
              '₹30,000 / month',
              '2099-12-20',
              'Should be rejected cleanly during row validation.',
            ],
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Not Found', { status: 404 });
  }) as unknown as typeof fetch;

  const report = await runGoogleSheetsSync(
    {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (job) => db.createJob(job),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => 0,
      recordSyncLog: (entry) => db.recordSyncLog(entry),
      getGoogleSheetsStatus: () => db.getContent('google_sheets_sync_status', null),
      saveGoogleSheetsStatus: (s) => {
        capturedStatuses.push(s);
        db.setContent('google_sheets_sync_status', s, 'test');
      },
    },
    {
      env: {
        GOOGLE_SHEETS_SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sync@bio-inexa.iam.gserviceaccount.com',
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
      },
      fetchOptions: { fetchFn: mockFetch, maxRetries: 2, baseDelayMs: 1 },
    }
  );

  assert.equal(sheetsAttempts, 2);
  assert.equal(report.mode, 'service_account');
  assert.equal(report.rowsFetched, 2);
  assert.equal(report.importedCount, 1);
  assert.equal(report.invalidRowsCount, 1);
  assert.equal(report.deletedCount, 0);
  assert.equal(report.invalidRows[0].title, 'Blocked Shortener Role');

  assert.equal(db.getAllJobsAdmin().length, initialCount + 1);
  const created = db
    .getAllJobsAdmin()
    .find((j) => j.applicationUrl === 'https://www.igib.res.in/careers/crispr-2099');
  assert.ok(created);
  assert.equal(created!.verificationStatus, 'Pending Verification');
  assert.equal(created!.isApproved, false);
  assert.equal(created!.lastVerificationDate, '');

  const latestStatus = capturedStatuses[capturedStatuses.length - 1];
  assert.ok(latestStatus);
  assert.equal(latestStatus.lastStatus, 'partial');
  assert.ok(latestStatus.lastSyncAttemptAt);
  assert.ok(latestStatus.lastSuccessfulSyncAt);
});

test('Phase 09: missing required columns abort sync safely with zero DB deletions', async () => {
  const db = new BionexaDatabase(':memory:');
  const beforeJobs = db.getAllJobsAdmin();
  const capturedStatuses: GoogleSheetsSyncStatusRecord[] = [];

  const report = await runGoogleSheetsSync(
    {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (job) => db.createJob(job),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => 0,
      recordSyncLog: (entry) => db.recordSyncLog(entry),
      saveGoogleSheetsStatus: (s) => {
        capturedStatuses.push(s);
      },
    },
    {
      overrideRawData: {
        configured: true,
        mode: 'api_key',
        headers: ['Title', 'Location'],
        rows: [{ Title: 'Row Without Org Or URL', Location: 'Pune' }],
        sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
      },
    }
  );

  assert.equal(report.importedCount, 0);
  assert.equal(report.deletedCount, 0);
  assert.equal(report.columnValidation?.valid, false);
  assert.match(report.error || '', /Missing required column/i);
  assert.equal(db.getAllJobsAdmin().length, beforeJobs.length);
  assert.equal(capturedStatuses[capturedStatuses.length - 1]?.lastStatus, 'error');
});

test('Phase 09: duplicate matching enriches safely without overwriting Verified or deleting omitted DB rows', async () => {
  const db = new BionexaDatabase(':memory:');
  const existingVerified = db.createJob({
    title: 'QC Analytical Microbiologist',
    employer: 'Biocon Biologics',
    description: 'GMP stability testing role.',
    location: 'Bengaluru',
    qualification: 'M.Sc Microbiology',
    skills: [],
    employmentType: 'Full-time',
    salary: 'Not Disclosed',
    applicationUrl: 'https://www.biocon.com/careers/qc-micro-2099',
    source: 'Google Sheets Institutional Feed',
    originalJobUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
    publicationDate: '2026-11-01',
    expiryDate: '2099-11-10',
    lastVerificationDate: '2026-11-03',
    verificationStatus: 'Verified',
    verificationNotes: 'Manually approved by admin.',
    isActive: true,
    isApproved: true,
    featured: true,
    responsibilities: [],
    requirements: [],
    sector: 'Quality Control Jobs',
  });

  const beforeCount = db.getAllJobsAdmin().length;

  const mockCsv = [
    'Title,Organization,Location,Application URL,Salary/Stipend,Application Deadline',
    'QC Analytical Microbiologist,Biocon Biologics,Bengaluru,https://www.biocon.com/careers/qc-micro-2099?utm_source=sheets,₹7.2 LPA,2099-12-25',
  ].join('\n');

  const mockFetch = (async () =>
    new Response(mockCsv, {
      status: 200,
      headers: { 'Content-Type': 'text/csv' },
    })) as unknown as typeof fetch;

  const report = await runGoogleSheetsSync(
    {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (job) => db.createJob(job),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => 0,
      recordSyncLog: (entry) => db.recordSyncLog(entry),
    },
    {
      env: {
        GOOGLE_SHEETS_CSV_URL: 'https://docs.google.com/spreadsheets/d/pub?output=csv',
      },
      fetchOptions: { fetchFn: mockFetch, maxRetries: 1, baseDelayMs: 1 },
    }
  );

  assert.equal(report.mode, 'csv');
  assert.equal(report.importedCount, 0);
  assert.equal(report.updatedCount, 1);
  assert.equal(report.deletedCount, 0);
  assert.equal(db.getAllJobsAdmin().length, beforeCount);

  const refreshed = db.getJobById(existingVerified.id)!;
  assert.equal(refreshed.salary, '₹7.2 LPA');
  assert.equal(refreshed.expiryDate, '2099-12-25');
  assert.equal(refreshed.isApproved, true);
  assert.equal(refreshed.verificationStatus, 'Verified');
  assert.equal(refreshed.lastVerificationDate, '2026-11-03');
});

test('Phase 09: Google Sheets outage records timestamps & errors gracefully and enforces overlap lock', async () => {
  const db = new BionexaDatabase(':memory:');
  const baselineCount = db.getAllJobsAdmin().length;
  const capturedStatuses: GoogleSheetsSyncStatusRecord[] = [];

  const failingFetch = (async () => new Response('Down', { status: 503 })) as unknown as typeof fetch;

  const errReport = await runGoogleSheetsSync(
    {
      getAllJobs: () => db.getAllJobsAdmin(),
      createJob: (job) => db.createJob(job),
      updateJob: (id, patch) => db.updateJob(id, patch as Partial<DbJob>),
      markExpiredListings: () => 0,
      recordSyncLog: (entry) => db.recordSyncLog(entry),
      saveGoogleSheetsStatus: (s) => {
        capturedStatuses.push(s);
      },
    },
    {
      env: {
        GOOGLE_SHEETS_SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        GOOGLE_SHEETS_API_KEY: 'AIzaSyFakeTestKey',
      },
      fetchOptions: { fetchFn: failingFetch, maxRetries: 1, baseDelayMs: 1 },
    }
  );

  assert.equal(errReport.deletedCount, 0);
  assert.match(errReport.error || '', /503/);
  assert.equal(db.getAllJobsAdmin().length, baselineCount);
  const latestStatus = capturedStatuses[capturedStatuses.length - 1];
  assert.equal(latestStatus?.lastStatus, 'error');
  assert.ok(latestStatus?.lastSyncAttemptAt);
  assert.equal(latestStatus?.lastSuccessfulSyncAt, null);

  await assert.rejects(
    () =>
      runGoogleSheetsSync({
        getAllJobs: () => [],
        createJob: () => {
          throw new Error('should not be called');
        },
        updateJob: () => null,
        markExpiredListings: () => 0,
        recordSyncLog: () => {},
        acquireSyncLock: () => false,
      }),
    (err: any) => err instanceof SyncInProgressError && err.statusCode === 409
  );
});
