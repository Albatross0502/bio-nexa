import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { handler as healthHandler } from '../health';
import { handler as jobsHandler } from '../jobs';
import { handler as internshipsHandler } from '../internships';
import { handler as workshopsHandler } from '../workshops';
import { handler as coursesHandler } from '../courses';
import { handler as contentHandler } from '../content';
import { handler as complianceHandler } from '../compliance';
import { handler as opportunitiesHandler } from '../opportunities';
import { handler as syncOpportunitiesHandler } from '../sync-opportunities';
import { handler as adminAuthHandler, resetServerlessAdminRateLimiterForTest } from '../admin-auth';
import { handler as adminDataHandler } from '../admin-data';
import { handler as adminJobsHandler } from '../admin-jobs';
import { handler as adminInternshipsHandler } from '../admin-internships';
import { handler as adminWorkshopsHandler } from '../admin-workshops';
import { handler as adminCoursesHandler } from '../admin-courses';
import { handler as adminContentHandler } from '../admin-content';
import { handler as adminAutomationHandler } from '../admin-automation';
import { handler as adminInboxHandler } from '../admin-inbox';
import { handler as adminExportHandler } from '../admin-export';
import { handler as communityHandler } from '../community';
import {
  handler as studentAuthHandler,
  resetServerlessStudentRateLimitersForTest,
} from '../student-auth';
import {
  handler as companyAuthHandler,
  resetServerlessCompanyRateLimitersForTest,
} from '../company-auth';
import { handler as adminCompaniesHandler } from '../admin-companies';
import { handler as apiNotFoundHandler } from '../api-not-found';
import {
  runServerlessGoogleSheetsSync,
  runServerlessOpportunitySync,
} from '../_shared/supabaseSyncRunner';
import { SyncInProgressError } from '../../../src/services/jobs/opportunitySyncEngine';
import type { NetlifyEvent } from '../_shared/http';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function makeEvent(overrides: Partial<NetlifyEvent> = {}): NetlifyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    headers: { origin: 'https://bio-inexa-0.netlify.app' },
    queryStringParameters: {},
    body: null,
    ...overrides,
  };
}

import {
  computeTotpCode,
  generateTotpSecret,
  hashPassword,
} from '../../../src/services/admin/adminAuthService';

function withAdminEnv<T>(
  fn: () => Promise<T>,
  overrides: {
    username?: string;
    password?: string;
    passwordHash?: string;
    sessionSecret?: string;
    role?: string;
    totpSecret?: string;
  } = {}
): Promise<T> {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevPassHash = process.env.ADMIN_PASSWORD_HASH;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  const prevRole = process.env.ADMIN_ROLE;
  const prevTotp = process.env.ADMIN_TOTP_SECRET;
  const prevNetlify = process.env.NETLIFY;

  process.env.ADMIN_USERNAME = overrides.username ?? 'admin@bio-inexa.org';
  if (overrides.passwordHash !== undefined) {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD_HASH = overrides.passwordHash;
  } else {
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD = overrides.password ?? 'TestAdminPassword!2026';
  }
  process.env.ADMIN_SESSION_SECRET = overrides.sessionSecret ?? 'TestSessionSecret!2026-Complex-Key';
  if (overrides.role !== undefined) process.env.ADMIN_ROLE = overrides.role;
  else delete process.env.ADMIN_ROLE;
  if (overrides.totpSecret !== undefined) process.env.ADMIN_TOTP_SECRET = overrides.totpSecret;
  else delete process.env.ADMIN_TOTP_SECRET;
  process.env.NETLIFY = 'true';

  return fn().finally(() => {
    if (prevUser === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPass;
    if (prevPassHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = prevPassHash;
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
    if (prevRole === undefined) delete process.env.ADMIN_ROLE;
    else process.env.ADMIN_ROLE = prevRole;
    if (prevTotp === undefined) delete process.env.ADMIN_TOTP_SECRET;
    else process.env.ADMIN_TOTP_SECRET = prevTotp;
    if (prevNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = prevNetlify;
  });
}

function extractCookiePair(setCookieHeader?: string): string {
  assert.ok(setCookieHeader, 'Expected Set-Cookie header');
  const firstSegment = setCookieHeader.split(';')[0].trim();
  assert.ok(firstSegment.startsWith('bionexa_admin_session='));
  return firstSegment;
}

test('no Netlify Function imports local SQLite DB or writes local upload files', () => {
  const fnDir = path.join(WORKSPACE_ROOT, 'netlify', 'functions');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        return [full];
      }
      return [];
    });

  const files = walk(fnDir);
  assert.ok(files.length >= 16);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.includes('node:sqlite'), false, `${file} must not import node:sqlite`);
    assert.equal(content.includes('node:fs'), false, `${file} must not import node:fs`);
    assert.equal(content.includes('bionexaDatabase'), false, `${file} must not import bionexaDatabase`);
  }
});

test('netlify.toml and public/_redirects route all /api/* paths before SPA /* catch-all', () => {
  const netlifyToml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'netlify.toml'), 'utf8');
  const redirectsFile = fs.readFileSync(path.join(WORKSPACE_ROOT, 'public', '_redirects'), 'utf8');

  assert.match(netlifyToml, /directory\s*=\s*"netlify\/functions"/);
  assert.match(netlifyToml, /node_bundler\s*=\s*"esbuild"/);

  const requiredApiPrefixes = [
    '/api/health',
    '/api/jobs',
    '/api/internships',
    '/api/internships/*',
    '/api/workshops',
    '/api/courses',
    '/api/announcements',
    '/api/content/*',
    '/api/compliance/*',
    '/api/opportunities',
    '/api/sync-opportunities',
    '/api/admin/login',
    '/api/admin/logout',
    '/api/admin/me',
    '/api/admin/audit-logs',
    '/api/admin/sessions',
    '/api/admin/sessions/*',
    '/api/admin/auth/*',
    '/api/admin/password-reset/*',
    '/api/admin/data',
    '/api/admin/jobs',
    '/api/admin/internships',
    '/api/admin/internships/*',
    '/api/admin/export',
    '/api/admin/workshops',
    '/api/admin/courses',
    '/api/admin/content',
    '/api/admin/backups',
    '/api/admin/compliance-requests',
    '/api/admin/automated-sync/*',
    '/api/admin/google-sheets/*',
    '/api/admin/opportunities',
    '/api/admin/opportunities/*',
    '/api/admin/contact-messages',
    '/api/contact',
    '/api/newsletter',
    '/api/certificates',
    '/api/certificates/*',
    '/api/applications',
    '/api/applications/*',
    '/api/discussions',
    '/api/discussions/*',
    '/api/student/*',
    '/api/admin/companies',
    '/api/admin/companies/*',
    '/api/company/*',
    '/api/*',
  ];

  const spaCatchAllPosToml = netlifyToml.indexOf('from = "/*"');
  const spaCatchAllPosRedirects = redirectsFile.indexOf('\n/* ');
  assert.ok(spaCatchAllPosToml > 0);
  assert.ok(spaCatchAllPosRedirects > 0);

  for (const prefix of requiredApiPrefixes) {
    const tomlPos = netlifyToml.indexOf(`from = "${prefix}"`);
    const redirPos = redirectsFile.indexOf(`\n${prefix} `);
    assert.ok(tomlPos >= 0 && tomlPos < spaCatchAllPosToml, `Missing or misordered ${prefix} in netlify.toml`);
    assert.ok(redirPos >= 0 && redirPos < spaCatchAllPosRedirects, `Missing or misordered ${prefix} in public/_redirects`);
  }

  assert.match(netlifyToml, /\[functions\."sync-opportunities"\]/);
  assert.match(netlifyToml, /schedule\s*=\s*"0 \*\/6 \* \* \*"/);
});

test('health endpoint handles GET, OPTIONS CORS, and 405 Method Not Allowed', async () => {
  const preflight = await healthHandler(makeEvent({ httpMethod: 'OPTIONS', path: '/api/health' }));
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers?.['Access-Control-Allow-Origin'], 'https://bio-inexa-0.netlify.app');
  assert.equal(preflight.headers?.['Access-Control-Allow-Credentials'], 'true');

  const okRes = await healthHandler(makeEvent({ httpMethod: 'GET', path: '/api/health' }));
  assert.equal(okRes.statusCode, 200);
  const okBody = JSON.parse(okRes.body);
  assert.equal(okBody.success, true);
  assert.equal(okBody.ok, true);

  const badMethod = await healthHandler(makeEvent({ httpMethod: 'DELETE', path: '/api/health' }));
  assert.equal(badMethod.statusCode, 405);
  assert.equal(JSON.parse(badMethod.body).code, 'METHOD_NOT_ALLOWED');
});

test('public catalog endpoints return genuine jobs, workshops, courses, announcements, and homepage highlights', async () => {
  const jobsRes = await jobsHandler(makeEvent({ path: '/api/jobs' }));
  assert.equal(jobsRes.statusCode, 200);
  const jobsData = JSON.parse(jobsRes.body);
  assert.equal(jobsData.success, true);
  assert.ok(jobsData.jobs.length >= 4);

  const singleJobRes = await jobsHandler(makeEvent({ path: '/api/jobs/job-1' }));
  assert.equal(singleJobRes.statusCode, 200);
  assert.equal(JSON.parse(singleJobRes.body).job.id, 'job-1');

  const missingJobRes = await jobsHandler(makeEvent({ path: '/api/jobs/missing-id' }));
  assert.equal(missingJobRes.statusCode, 404);
  assert.equal(JSON.parse(missingJobRes.body).code, 'JOB_NOT_FOUND');

  const workshopsRes = await workshopsHandler(makeEvent({ path: '/api/workshops' }));
  assert.equal(workshopsRes.statusCode, 200);
  assert.ok(JSON.parse(workshopsRes.body).workshops.length >= 6);

  const coursesRes = await coursesHandler(
    makeEvent({ path: '/api/courses', queryStringParameters: { category: 'Bioinformatics' } })
  );
  assert.equal(coursesRes.statusCode, 200);
  const coursesData = JSON.parse(coursesRes.body);
  assert.ok(coursesData.courses.length >= 1);
  assert.equal(coursesData.courses[0].category, 'Bioinformatics');

  const annRes = await contentHandler(makeEvent({ path: '/api/announcements' }));
  assert.equal(annRes.statusCode, 200);
  assert.ok(JSON.parse(annRes.body).announcements.length >= 3);

  const highlightsRes = await contentHandler(makeEvent({ path: '/api/content/homepage' }));
  assert.equal(highlightsRes.statusCode, 200);
  assert.ok(JSON.parse(highlightsRes.body).highlights.heroBadge);

  const internshipsRes = await internshipsHandler(makeEvent({ path: '/api/internships' }));
  assert.equal(internshipsRes.statusCode, 200);
  const internshipsData = JSON.parse(internshipsRes.body);
  assert.equal(internshipsData.success, true);
  assert.ok(internshipsData.internships.length >= 4);
  assert.ok(['paid', 'unpaid'].includes(internshipsData.internships[0].compensationType));

  const paidInternshipsRes = await internshipsHandler(
    makeEvent({ path: '/api/internships', queryStringParameters: { compensation: 'paid', includeExpired: 'true' } })
  );
  assert.equal(paidInternshipsRes.statusCode, 200);
  const paidInternshipsData = JSON.parse(paidInternshipsRes.body);
  assert.ok(paidInternshipsData.internships.length >= 1);
  assert.ok(paidInternshipsData.internships.every((i: any) => i.compensationType === 'paid'));

  const badInternSubmit = await internshipsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/internships/submit',
      body: JSON.stringify({
        title: 'Bad URL Internship',
        organization: 'Test Bio Lab',
        location: 'Bengaluru',
        duration: '8 Weeks',
        eligibility: 'M.Sc Biotech',
        description: 'Testing strict URL rejection on internship submission.',
        applicationUrl: 'https://example.com/fake-internship',
      }),
    })
  );
  assert.equal(badInternSubmit.statusCode, 400);

  const validInternSubmit = await internshipsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/internships/submit',
      body: JSON.stringify({
        title: 'Genomics Summer Fellowship',
        organization: 'CSIR-IGIB',
        location: 'New Delhi',
        mode: 'Remote / Dry Lab',
        stipend: '₹15,000 / month',
        duration: '8 Weeks',
        deadline: '2027-06-30',
        category: 'Summer Fellowship',
        eligibility: 'M.Sc Life Sciences / B.Tech Biotechnology',
        description: 'Computational genomics and transcriptomics summer fellowship training.',
        applicationUrl: 'https://www.igib.res.in/academics/summer-fellowship',
      }),
    })
  );
  assert.equal(validInternSubmit.statusCode, 503);
  assert.equal(JSON.parse(validInternSubmit.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');
});

test('public write and opportunity endpoints validate payloads strictly and return honest 503 instead of fake success IDs', async () => {
  const badSubmit = await jobsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/jobs/submit',
      body: JSON.stringify({ title: 'Test Job' }),
    })
  );
  assert.equal(badSubmit.statusCode, 400);

  const shortenerSubmit = await jobsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/jobs/submit',
      body: JSON.stringify({
        title: 'Suspicious Job',
        company: 'Unknown Lab',
        applicationUrl: 'https://bit.ly/fake-biotech-job',
        description: 'Testing shortener URL rejection rule.',
        location: 'Bengaluru',
      }),
    })
  );
  assert.equal(shortenerSubmit.statusCode, 400);
  assert.equal(JSON.parse(shortenerSubmit.body).code, 'INVALID_URL');

  const validSubmit = await jobsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/jobs/submit',
      body: JSON.stringify({
        title: 'Research Associate',
        company: 'CSIR-IGIB',
        applicationUrl: 'https://www.igib.res.in/careers',
        description: 'Molecular diagnostics research role.',
        location: 'New Delhi',
      }),
    })
  );
  assert.equal(validSubmit.statusCode, 503);
  assert.equal(JSON.parse(validSubmit.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

  const reportRes = await jobsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/jobs/job-1/report',
      body: JSON.stringify({ reason: 'Broken Link' }),
    })
  );
  assert.equal(reportRes.statusCode, 503);

  const badCompliance = await complianceHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/compliance/request',
      body: JSON.stringify({ requestType: 'privacy_request', requesterName: 'A' }),
    })
  );
  assert.equal(badCompliance.statusCode, 400);

  const validCompliance = await complianceHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/compliance/request',
      body: JSON.stringify({
        requestType: 'privacy_request',
        subCategory: 'Data Access Request (DPDP Section 11)',
        requesterName: 'Dr. Ananya Sharma',
        requesterEmail: 'ananya@example.org',
        details: 'Requesting copy of any stored submission metadata under DPDP Act.',
        consentAccepted: true,
      }),
    })
  );
  assert.equal(validCompliance.statusCode, 503);

  const oppGet = await opportunitiesHandler(
    makeEvent({ path: '/api/opportunities', queryStringParameters: { type: 'workshop' } })
  );
  assert.equal(oppGet.statusCode, 200);
  assert.ok(JSON.parse(oppGet.body).opportunities.length >= 4);

  const oppPost = await opportunitiesHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/opportunities',
      body: JSON.stringify({
        title: 'QC Analyst',
        organization: 'Biocon',
        applicationUrl: 'https://www.biocon.com/careers',
      }),
    })
  );
  assert.equal(oppPost.statusCode, 503);
});

test('admin endpoints fail closed when unconfigured, use HttpOnly cookies (no token leak), revoke jti on logout, and enforce CSRF', async () => {
  resetServerlessAdminRateLimiterForTest();

  // Fail closed with 503 if ADMIN_* environment variables are absent
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    const unconfiguredLogin = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        body: JSON.stringify({ username: 'admin', password: 'BioNexa@2026!Admin' }),
      })
    );
    assert.equal(unconfiguredLogin.statusCode, 503);
    assert.equal(JSON.parse(unconfiguredLogin.body).code, 'ADMIN_AUTH_NOT_CONFIGURED');
  } finally {
    if (prevUser !== undefined) process.env.ADMIN_USERNAME = prevUser;
    if (prevPass !== undefined) process.env.ADMIN_PASSWORD = prevPass;
    if (prevSecret !== undefined) process.env.ADMIN_SESSION_SECRET = prevSecret;
  }

  await withAdminEnv(async () => {
    const unauthData = await adminDataHandler(makeEvent({ path: '/api/admin/data' }));
    assert.equal(unauthData.statusCode, 401);

    const unauthSync = await syncOpportunitiesHandler(
      makeEvent({ httpMethod: 'POST', path: '/api/sync-opportunities' })
    );
    assert.equal(unauthSync.statusCode, 401);

    // Reject 'admin' fallback alias when configured ADMIN_USERNAME is 'admin@bio-inexa.org'
    const aliasBypassAttempt = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.10' },
        body: JSON.stringify({ username: 'admin', password: 'TestAdminPassword!2026' }),
      })
    );
    assert.equal(aliasBypassAttempt.statusCode, 401);

    const badLogin = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.11' },
        body: JSON.stringify({ username: 'admin@bio-inexa.org', password: 'WrongPassword' }),
      })
    );
    assert.equal(badLogin.statusCode, 401);

    const loginRes = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.11' },
        body: JSON.stringify({
          username: 'admin@bio-inexa.org',
          password: 'TestAdminPassword!2026',
        }),
      })
    );
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.success, true);
    assert.equal(loginBody.token, undefined, 'Session token must never be exposed in JSON body');
    assert.ok(loginRes.headers?.['Set-Cookie']?.includes('HttpOnly'));
    assert.ok(loginRes.headers?.['Set-Cookie']?.includes('SameSite=Lax'));
    assert.ok(loginRes.headers?.['Set-Cookie']?.includes('Secure'));

    const sessionCookie = extractCookiePair(loginRes.headers?.['Set-Cookie']);
    const authHeaders = {
      origin: 'https://bio-inexa-0.netlify.app',
      cookie: sessionCookie,
    };

    const meRes = await adminAuthHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/me', headers: authHeaders })
    );
    assert.equal(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.equal(meBody.authenticated, true);
    assert.equal(meBody.user.role, 'super_admin');

    // Cross-origin cookie-based POST must be blocked by CSRF origin guard
    const csrfBlocked = await adminJobsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/jobs',
        headers: {
          origin: 'https://evil-attacker.example',
          host: 'bio-inexa-0.netlify.app',
          cookie: sessionCookie,
        },
        body: JSON.stringify({ title: 'CSRF Job', applicationUrl: 'https://www.igib.res.in/' }),
      })
    );
    assert.equal(csrfBlocked.statusCode, 403);
    assert.equal(JSON.parse(csrfBlocked.body).code, 'CSRF_ORIGIN_DENIED');

    const dataRes = await adminDataHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/data', headers: authHeaders })
    );
    assert.equal(dataRes.statusCode, 200);
    const dashData = JSON.parse(dataRes.body);
    assert.ok(dashData.jobs.length >= 6);
    assert.ok(dashData.workshops.length >= 6);
    assert.ok(dashData.courses.length >= 9);

    const badJobCreate = await adminJobsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/jobs',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Missing URL', company: 'Lab' }),
      })
    );
    assert.equal(badJobCreate.statusCode, 400);

    const jobVerificationsGet = await adminJobsHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/jobs/job-1/verifications',
        headers: authHeaders,
      })
    );
    assert.equal(jobVerificationsGet.statusCode, 200);
    const verificationsBody = JSON.parse(jobVerificationsGet.body);
    assert.equal(verificationsBody.success, true);
    assert.ok(Array.isArray(verificationsBody.verifications));

    const invalidWorkshopUrl = await adminWorkshopsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/workshops',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Invalid URL Workshop',
          organizer: 'CSIR-IGIB',
          registrationUrl: 'https://example.com/fake',
        }),
      })
    );
    assert.equal(invalidWorkshopUrl.statusCode, 400);

    const validWorkshopCreate = await adminWorkshopsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/workshops',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'qPCR Masterclass',
          organizer: 'CSIR-IGIB',
          registrationUrl: 'https://www.igib.res.in/',
        }),
      })
    );
    assert.equal(validWorkshopCreate.statusCode, 503);

    const workshopStatusNoDb = await adminWorkshopsHandler(
      makeEvent({
        httpMethod: 'PATCH',
        path: '/api/admin/workshops/opp-work-1/status',
        headers: authHeaders,
        body: JSON.stringify({ approvalStatus: 'approved' }),
      })
    );
    assert.equal(workshopStatusNoDb.statusCode, 503);

    const workshopExpireScanNoDb = await adminWorkshopsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/workshops/expire-scan',
        headers: authHeaders,
      })
    );
    assert.equal(workshopExpireScanNoDb.statusCode, 503);

    const missingCourseUpdate = await adminCoursesHandler(
      makeEvent({
        httpMethod: 'PUT',
        path: '/api/admin/courses/nonexistent-id',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Updated' }),
      })
    );
    assert.equal(missingCourseUpdate.statusCode, 404);

    const adminContentGet = await adminContentHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/content', headers: authHeaders })
    );
    assert.equal(adminContentGet.statusCode, 200);

    const backupsGet = await adminContentHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/backups', headers: authHeaders })
    );
    assert.equal(backupsGet.statusCode, 503);

    const auditGet = await adminAuthHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/audit-logs', headers: authHeaders })
    );
    assert.equal(auditGet.statusCode, 200);

    const sessionsGet = await adminAuthHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/sessions', headers: authHeaders })
    );
    assert.equal(sessionsGet.statusCode, 200);

    const syncStatusGet = await adminAutomationHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/automated-sync/status',
        headers: authHeaders,
      })
    );
    assert.equal(syncStatusGet.statusCode, 200);
    const syncBody = JSON.parse(syncStatusGet.body);
    assert.ok(syncBody.sources.length >= 5);
    assert.ok(Array.isArray(syncBody.syncHistory));
    assert.equal(syncBody.schedule?.intervalHours, 6);
    assert.equal(typeof syncBody.sources[0].configured, 'boolean');

    const sheetsStatusGet = await adminAutomationHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/google-sheets/status',
        headers: authHeaders,
      })
    );
    assert.equal(sheetsStatusGet.statusCode, 200);
    const sheetsBody = JSON.parse(sheetsStatusGet.body);
    assert.equal(sheetsBody.success, true);
    assert.equal(typeof sheetsBody.config?.configured, 'boolean');
    assert.equal(sheetsBody.status?.lastStatus, 'never_run');
    assert.ok(Array.isArray(sheetsBody.syncHistory));

    const sheetsSyncNoDb = await adminAutomationHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/google-sheets/sync',
        headers: authHeaders,
      })
    );
    assert.equal(sheetsSyncNoDb.statusCode, 503);
    assert.equal(JSON.parse(sheetsSyncNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

    const adminInternshipsGet = await adminInternshipsHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/internships', headers: authHeaders })
    );
    assert.equal(adminInternshipsGet.statusCode, 200);
    assert.ok(JSON.parse(adminInternshipsGet.body).internships.length >= 4);

    const badAdminInternCreate = await adminInternshipsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/internships',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Invalid URL Fellowship',
          organization: 'NCBS',
          applicationUrl: 'javascript:alert(1)',
        }),
      })
    );
    assert.equal(badAdminInternCreate.statusCode, 400);

    const expireScanNoDb = await adminInternshipsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/internships/expire-scan',
        headers: authHeaders,
      })
    );
    assert.equal(expireScanNoDb.statusCode, 503);
    assert.equal(JSON.parse(expireScanNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

    const exportJobsCsv = await adminExportHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/export',
        queryStringParameters: { dataset: 'jobs', format: 'csv' },
        headers: authHeaders,
      })
    );
    assert.equal(exportJobsCsv.statusCode, 200);
    assert.match(exportJobsCsv.headers?.['Content-Type'] || '', /text\/csv/);
    assert.match(exportJobsCsv.body, /ID,Title,Employer/);

    const logoutRes = await adminAuthHandler(
      makeEvent({ httpMethod: 'POST', path: '/api/admin/logout', headers: authHeaders })
    );
    assert.equal(logoutRes.statusCode, 200);
    assert.ok(logoutRes.headers?.['Set-Cookie']?.includes('Max-Age=0'));

    // Revoked session jti must be rejected immediately even if cookie is replayed
    const replayedMeRes = await adminAuthHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/me', headers: authHeaders })
    );
    assert.equal(replayedMeRes.statusCode, 401);
  });
});

test('admin auth enforces scrypt ADMIN_PASSWORD_HASH, optional TOTP 2FA, RBAC verifier restrictions, and rate limit lockout', async () => {
  resetServerlessAdminRateLimiterForTest();
  const scryptHash = hashPassword('ScryptStrong!Pass2026');
  const totpSecret = generateTotpSecret();

  await withAdminEnv(
    async () => {
      // Missing TOTP triggers 401 MFA_REQUIRED
      const step1 = await adminAuthHandler(
        makeEvent({
          httpMethod: 'POST',
          path: '/api/admin/login',
          headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.50' },
          body: JSON.stringify({
            username: 'verifier@bio-inexa.org',
            password: 'ScryptStrong!Pass2026',
          }),
        })
      );
      assert.equal(step1.statusCode, 401);
      assert.equal(JSON.parse(step1.body).code, 'MFA_REQUIRED');

      // Valid TOTP succeeds with 'verifier' role
      const code = computeTotpCode(totpSecret);
      const step2 = await adminAuthHandler(
        makeEvent({
          httpMethod: 'POST',
          path: '/api/admin/login',
          headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.50' },
          body: JSON.stringify({
            username: 'verifier@bio-inexa.org',
            password: 'ScryptStrong!Pass2026',
            totpCode: code,
          }),
        })
      );
      assert.equal(step2.statusCode, 200);
      const cookie = extractCookiePair(step2.headers?.['Set-Cookie']);

      // Verifier can read dashboard data
      const dataOk = await adminDataHandler(
        makeEvent({
          httpMethod: 'GET',
          path: '/api/admin/data',
          headers: { origin: 'https://bio-inexa-0.netlify.app', cookie },
        })
      );
      assert.equal(dataOk.statusCode, 200);

      // Verifier is blocked (403) from backups & exporting audit_logs
      const backupsDenied = await adminContentHandler(
        makeEvent({
          httpMethod: 'GET',
          path: '/api/admin/backups',
          headers: { origin: 'https://bio-inexa-0.netlify.app', cookie },
        })
      );
      assert.equal(backupsDenied.statusCode, 403);
      assert.equal(JSON.parse(backupsDenied.body).code, 'INSUFFICIENT_PERMISSIONS');

      const exportAuditDenied = await adminExportHandler(
        makeEvent({
          httpMethod: 'GET',
          path: '/api/admin/export',
          queryStringParameters: { dataset: 'audit_logs', format: 'csv' },
          headers: { origin: 'https://bio-inexa-0.netlify.app', cookie },
        })
      );
      assert.equal(exportAuditDenied.statusCode, 403);
      assert.equal(JSON.parse(exportAuditDenied.body).code, 'INSUFFICIENT_PERMISSIONS');

      // Verifier CAN export jobs
      const exportJobsOk = await adminExportHandler(
        makeEvent({
          httpMethod: 'GET',
          path: '/api/admin/export',
          queryStringParameters: { dataset: 'jobs', format: 'json' },
          headers: { origin: 'https://bio-inexa-0.netlify.app', cookie },
        })
      );
      assert.equal(exportJobsOk.statusCode, 200);

      // 5 consecutive invalid login attempts trigger 429 RATE_LIMITED
      for (let i = 0; i < 5; i++) {
        const fail = await adminAuthHandler(
          makeEvent({
            httpMethod: 'POST',
            path: '/api/admin/login',
            headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.99' },
            body: JSON.stringify({ username: 'verifier@bio-inexa.org', password: 'Wrong' }),
          })
        );
        assert.equal(fail.statusCode, 401);
      }
      const locked = await adminAuthHandler(
        makeEvent({
          httpMethod: 'POST',
          path: '/api/admin/login',
          headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.99' },
          body: JSON.stringify({
            username: 'verifier@bio-inexa.org',
            password: 'ScryptStrong!Pass2026',
            totpCode: code,
          }),
        })
      );
      assert.equal(locked.statusCode, 429);
      assert.equal(JSON.parse(locked.body).code, 'RATE_LIMITED');
    },
    {
      username: 'verifier@bio-inexa.org',
      passwordHash: scryptHash,
      role: 'verifier',
      totpSecret,
    }
  );
});

test('api-not-found returns structured 404 JSON instead of HTML', async () => {
  const res = await apiNotFoundHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/.netlify/functions/api-not-found/nonexistent',
      headers: {
        origin: 'https://bio-inexa-0.netlify.app',
        'x-nf-original-path': '/api/nonexistent',
      },
    })
  );
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.success, false);
  assert.equal(body.code, 'API_ROUTE_NOT_FOUND');
  assert.equal(body.path, '/api/nonexistent');
});

test('community and admin-inbox endpoints enforce validation, admin auth, and honest 503 when DB unconfigured', async () => {
  const badContact = await communityHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/contact',
      body: JSON.stringify({ name: 'A', email: 'bad', message: 'short' }),
    })
  );
  assert.equal(badContact.statusCode, 400);

  const validContact = await communityHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/contact',
      body: JSON.stringify({
        name: 'Dr. Ananya Rao',
        email: 'ananya@institute.res.in',
        subject: 'Partnership Query',
        message: 'We would like to verify our lab workshop schedule on BIO-INEXA.',
      }),
    })
  );
  assert.equal(validContact.statusCode, 503);
  assert.equal(JSON.parse(validContact.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

  const unauthInbox = await adminInboxHandler(
    makeEvent({ httpMethod: 'GET', path: '/api/admin/contact-messages' })
  );
  assert.equal(unauthInbox.statusCode, 401);
});

test('runServerlessOpportunitySync persists Pending Verification jobs via SupabaseRepository and enforces overlap lock', async () => {
  const storedJobs: any[] = [];
  const syncLogs: any[] = [];
  const contentStore = new Map<string, any>();
  let lockHeld = false;

  const mockRepo: any = {
    getAllJobsAdmin: async () => [...storedJobs],
    createJob: async (job: any) => {
      const created = { id: `supa-job-${storedJobs.length + 1}`, ...job };
      storedJobs.push(created);
      return created;
    },
    updateJob: async (id: string, patch: any) => {
      const idx = storedJobs.findIndex((j) => j.id === id);
      if (idx < 0) return null;
      storedJobs[idx] = { ...storedJobs[idx], ...patch };
      return storedJobs[idx];
    },
    markExpiredListings: async () => 0,
    recordSyncLog: async (entry: any) => {
      syncLogs.push(entry);
      return entry;
    },
    getContentRecord: async (key: string, defaultValue: any) =>
      contentStore.has(key) ? contentStore.get(key) : defaultValue,
    setContentRecord: async (key: string, value: any) => {
      contentStore.set(key, value);
    },
    acquireSyncLock: async () => {
      if (lockHeld) return false;
      lockHeld = true;
      return true;
    },
    releaseSyncLock: async () => {
      lockHeld = false;
    },
  };

  // Locked execution rejects with 409 SyncInProgressError
  lockHeld = true;
  await assert.rejects(
    () => runServerlessOpportunitySync(mockRepo, { env: {} }),
    (err: any) => err instanceof SyncInProgressError && err.statusCode === 409
  );
  lockHeld = false;

  const report = await runServerlessOpportunitySync(mockRepo, {
    env: {},
    customCandidates: [
      {
        title: 'DBT Research Fellow (Genomics)',
        employer: 'NIBMG Kalyani',
        applicationUrl: 'https://www.nibmg.ac.in/careers/jrf-2099',
        originalJobUrl: 'https://www.nibmg.ac.in/careers',
        source: 'NIBMG Official Feed',
        location: 'Kalyani, WB',
        publicationDate: '2026-11-12',
        expiryDate: '2099-12-15',
        sector: 'Research Fellowships',
        description: 'Whole-genome sequencing fellowship.',
      },
    ],
  });

  assert.equal(report.newImportedCount, 1);
  assert.equal(storedJobs.length, 1);
  assert.equal(storedJobs[0].verificationStatus, 'Pending Verification');
  assert.equal(storedJobs[0].isApproved, false);
  assert.equal(storedJobs[0].lastVerificationDate, '');
  assert.equal(lockHeld, false);
  assert.ok(contentStore.has('automated_sync_report'));
  assert.equal(syncLogs.length, 1);

  // Phase 09: Google Sheets serverless sync saves Pending Verification records & prevents overlap/deletions
  const sheetsReport = await runServerlessGoogleSheetsSync(mockRepo, {
    env: {},
    overrideRawData: {
      configured: true,
      mode: 'service_account',
      headers: ['Title', 'Organization', 'Location', 'Application URL', 'Application Deadline'],
      rows: [
        {
          Title: 'Cell Culture Bioprocess Lead',
          Organization: 'Serum Institute of India',
          Location: 'Pune',
          'Application URL': 'https://www.seruminstitute.com/careers/cell-culture-2099',
          'Application Deadline': '2099-12-30',
        },
      ],
      sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
    },
  });

  assert.equal(sheetsReport.importedCount, 1);
  assert.equal(sheetsReport.deletedCount, 0);
  assert.equal(storedJobs.length, 2);
  assert.equal(storedJobs[1].verificationStatus, 'Pending Verification');
  assert.equal(storedJobs[1].isApproved, false);
  assert.equal(storedJobs[1].lastVerificationDate, '');
  assert.ok(contentStore.has('google_sheets_sync_status'));
  assert.equal(syncLogs.length, 2);
});

test('Phase 12: public workshops endpoint supports category/includeExpired filters and validates /api/workshops/submit', async () => {
  const byCategory = await workshopsHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/workshops',
      queryStringParameters: { category: 'Genomics & Gene Editing', includeExpired: 'false' },
    })
  );
  assert.equal(byCategory.statusCode, 200);
  const catBody = JSON.parse(byCategory.body);
  assert.ok(catBody.workshops.length >= 1);
  assert.ok(catBody.workshops.every((w: any) => w.category === 'Genomics & Gene Editing' && !w.isExpired));

  const badSubmit = await workshopsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/workshops/submit',
      body: JSON.stringify({
        title: 'Fake Domain Workshop',
        organizer: 'Test Org',
        category: 'Genomics & Gene Editing',
        description: 'Testing strict domain validation on public workshop submission.',
        format: 'Online',
        date: '2027-01-15',
        registrationUrl: 'https://example.com/fake-registration',
      }),
    })
  );
  assert.equal(badSubmit.statusCode, 400);
  assert.equal(JSON.parse(badSubmit.body).code, 'INVALID_WORKSHOP_SUBMISSION');

  const validSubmitNoDb = await workshopsHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/workshops/submit',
      body: JSON.stringify({
        title: 'Single-Cell Proteomics Bootcamp',
        organizer: 'NCBS-TIFR',
        category: 'Proteomics & Structural Biology',
        description: 'Hands-on mass spectrometry proteomics workflow and bioinformatics analysis.',
        format: 'Hybrid',
        venue: 'NCBS Campus & Online',
        date: '2027-04-12',
        registrationDeadline: '2027-04-01',
        registrationUrl: 'https://www.ncbs.res.in/workshops/proteomics',
      }),
    })
  );
  assert.equal(validSubmitNoDb.statusCode, 503);
  assert.equal(JSON.parse(validSubmitNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');
});

test('Phase 13: courses endpoint supports pricingType/categories/includeExpired filters and validates /api/courses/submit and admin course routes', async () => {
  const categoriesRes = await coursesHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/courses/categories',
    })
  );
  assert.equal(categoriesRes.statusCode, 200);
  const categoriesBody = JSON.parse(categoriesRes.body);
  assert.ok(Array.isArray(categoriesBody.categories));
  assert.ok(categoriesBody.categories.length >= 9);

  const freeCoursesRes = await coursesHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/courses',
      queryStringParameters: { pricingType: 'free', includeExpired: 'false' },
    })
  );
  assert.equal(freeCoursesRes.statusCode, 200);
  const freeBody = JSON.parse(freeCoursesRes.body);
  assert.ok(Array.isArray(freeBody.courses));
  assert.ok(freeBody.courses.every((c: any) => c.pricingType === 'free' && c.providerType === 'third_party'));

  const badCourseSubmit = await coursesHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/courses/submit',
      body: JSON.stringify({
        title: 'Placeholder URL Biotech Course',
        provider: 'Test Institute',
        category: 'Biotechnology',
        description: 'Testing strict rejection of example.com registration links.',
        duration: '6 Weeks',
        fees: 'Free',
        registrationUrl: 'https://example.com/fake-course',
      }),
    })
  );
  assert.equal(badCourseSubmit.statusCode, 400);
  assert.equal(JSON.parse(badCourseSubmit.body).code, 'INVALID_COURSE_SUBMISSION');

  const validCourseSubmitNoDb = await coursesHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/courses/submit',
      body: JSON.stringify({
        title: 'Applied Bioprocess Fermentation',
        provider: 'NPTEL / IIT Guwahati',
        category: 'Biotechnology',
        description: 'Quantitative upstream bioprocess engineering and bioreactor kinetics.',
        duration: '8 Weeks',
        fees: 'Free online learning',
        registrationUrl: 'https://onlinecourses.nptel.ac.in/noc26_bt12',
      }),
    })
  );
  assert.equal(validCourseSubmitNoDb.statusCode, 503);
  assert.equal(JSON.parse(validCourseSubmitNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

  // Admin course Phase 13 endpoints
  resetServerlessAdminRateLimiterForTest();
  await withAdminEnv(async () => {
    const loginRes = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        headers: { origin: 'https://bio-inexa-0.netlify.app', 'x-forwarded-for': '10.0.0.77' },
        body: JSON.stringify({ username: 'admin@bio-inexa.org', password: 'TestAdminPassword!2026' }),
      })
    );
    assert.equal(loginRes.statusCode, 200);
    const cookie = extractCookiePair(loginRes.headers?.['Set-Cookie']);
    const authHeaders = { origin: 'https://bio-inexa-0.netlify.app', cookie };

    const adminCatsRes = await adminCoursesHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/courses/categories',
        headers: authHeaders,
      })
    );
    assert.equal(adminCatsRes.statusCode, 200);
    assert.ok(JSON.parse(adminCatsRes.body).coreCategories.length === 9);

    const expireScanNoDb = await adminCoursesHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/courses/expire-scan',
        headers: authHeaders,
      })
    );
    assert.equal(expireScanNoDb.statusCode, 503);
    assert.equal(JSON.parse(expireScanNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

    const badAdminCourseCreate = await adminCoursesHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/courses',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Invalid Course Link',
          provider: 'Test Provider',
          description: 'Description that meets length requirements.',
          duration: '4 Weeks',
          fees: 'Free',
          registrationUrl: 'https://localhost:3000/bad',
        }),
      })
    );
    assert.equal(badAdminCourseCreate.statusCode, 400);
  });
});

test('Phase 14: student-auth serverless routes validate inputs, return honest 503 without Supabase, and enforce student/admin RBAC isolation', async () => {
  resetServerlessStudentRateLimitersForTest();

  // GET /api/student/me without session cookie returns unauthenticated
  const meGuest = await studentAuthHandler(
    makeEvent({ httpMethod: 'GET', path: '/api/student/me' })
  );
  assert.equal(meGuest.statusCode, 200);
  assert.equal(JSON.parse(meGuest.body).authenticated, false);

  // Invalid registration (missing privacyConsent + weak password) fails with 400
  const badReg = await studentAuthHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/student/register',
      body: JSON.stringify({
        fullName: 'Meera',
        email: 'meera@iisc.ac.in',
        password: 'weak',
        privacyConsent: false,
      }),
    })
  );
  assert.equal(badReg.statusCode, 400);
  assert.equal(JSON.parse(badReg.body).code, 'INVALID_REGISTRATION');

  // Valid registration returns honest 503 when Supabase is unconfigured
  const validRegNoDb = await studentAuthHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/student/register',
      body: JSON.stringify({
        fullName: 'Meera Krishnan',
        email: 'meera.k@iisc.ac.in',
        password: 'BioSecure#2026!',
        degreeTitle: 'M.Sc Biotechnology',
        institution: 'IISc Bengaluru',
        privacyConsent: true,
      }),
    })
  );
  assert.equal(validRegNoDb.statusCode, 503);
  assert.equal(JSON.parse(validRegNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

  // Unauthenticated profile update returns 401
  const unauthProfile = await studentAuthHandler(
    makeEvent({
      httpMethod: 'PATCH',
      path: '/api/student/profile',
      body: JSON.stringify({ institution: 'NCBS' }),
    })
  );
  assert.equal(unauthProfile.statusCode, 401);
  assert.equal(JSON.parse(unauthProfile.body).code, 'STUDENT_AUTH_REQUIRED');

  // Student session cookie presented to /api/admin/data is strictly rejected with 403 ROLE_FORBIDDEN
  const studentAdminAttempt = await adminDataHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/admin/data',
      headers: {
        origin: 'https://bio-inexa-0.netlify.app',
        cookie: 'bionexa_student_session=fake-student-session-token',
      },
    })
  );
  assert.equal(studentAdminAttempt.statusCode, 403);
  assert.equal(JSON.parse(studentAdminAttempt.body).code, 'ROLE_FORBIDDEN');
});

test('Phase 15: company-auth and admin-companies serverless routes enforce validation, 503 without Supabase, and strict company/admin RBAC isolation', async () => {
  resetServerlessCompanyRateLimitersForTest();

  // GET /api/company/me without cookie returns authenticated: false
  const meGuest = await companyAuthHandler(
    makeEvent({ httpMethod: 'GET', path: '/api/company/me' })
  );
  assert.equal(meGuest.statusCode, 200);
  const meBody = JSON.parse(meGuest.body);
  assert.equal(meBody.authenticated, false);
  assert.equal(meBody.company, null);

  // Invalid company registration (missing consent + invalid website) returns 400
  const badReg = await companyAuthHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/company/register',
      body: JSON.stringify({
        contactName: 'Dr. Kavitha Rao',
        email: 'hr@helixgen.in',
        password: 'weak',
        organizationName: 'HelixGen',
        officialWebsite: 'https://example.com',
        headquartersLocation: 'Bengaluru',
        privacyConsentAccepted: false,
      }),
    })
  );
  assert.equal(badReg.statusCode, 400);
  assert.equal(JSON.parse(badReg.body).code, 'VALIDATION_ERROR');

  // Valid company registration returns honest 503 when Supabase is unconfigured
  const validRegNoDb = await companyAuthHandler(
    makeEvent({
      httpMethod: 'POST',
      path: '/api/company/register',
      body: JSON.stringify({
        contactName: 'Dr. Kavitha Rao',
        email: 'hr@helixgen.in',
        password: 'HelixSecure#2026!',
        organizationName: 'HelixGen Diagnostics Pvt Ltd',
        organizationType: 'Diagnostics & CRO',
        officialWebsite: 'https://helixgen.in',
        headquartersLocation: 'Bengaluru, Karnataka',
        privacyConsentAccepted: true,
      }),
    })
  );
  assert.equal(validRegNoDb.statusCode, 503);
  assert.equal(JSON.parse(validRegNoDb.body).code, 'PERSISTENT_DB_NOT_CONFIGURED');

  // Protected company jobs endpoint requires company auth cookie
  const unauthJobs = await companyAuthHandler(
    makeEvent({ httpMethod: 'GET', path: '/api/company/jobs' })
  );
  assert.equal(unauthJobs.statusCode, 401);
  assert.equal(JSON.parse(unauthJobs.body).code, 'COMPANY_AUTH_REQUIRED');

  // Admin companies endpoint requires admin auth (401 when unauthenticated)
  const unauthAdminCompanies = await adminCompaniesHandler(
    makeEvent({ httpMethod: 'GET', path: '/api/admin/companies' })
  );
  assert.equal(unauthAdminCompanies.statusCode, 401);

  // Strict RBAC isolation: company session cookie presented to admin endpoints MUST return 403 ROLE_FORBIDDEN
  const companyToAdminData = await adminDataHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/admin/data',
      headers: {
        origin: 'https://bio-inexa-0.netlify.app',
        cookie: 'bionexa_company_session=fake-company-session-token',
      },
    })
  );
  assert.equal(companyToAdminData.statusCode, 403);
  assert.equal(JSON.parse(companyToAdminData.body).code, 'ROLE_FORBIDDEN');

  const companyToAdminCompanies = await adminCompaniesHandler(
    makeEvent({
      httpMethod: 'GET',
      path: '/api/admin/companies',
      headers: {
        origin: 'https://bio-inexa-0.netlify.app',
        cookie: 'bionexa_company_session=fake-company-session-token',
      },
    })
  );
  assert.equal(companyToAdminCompanies.statusCode, 403);
  assert.equal(JSON.parse(companyToAdminCompanies.body).code, 'ROLE_FORBIDDEN');
});



