import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { handler as healthHandler } from '../health';
import { handler as jobsHandler } from '../jobs';
import { handler as workshopsHandler } from '../workshops';
import { handler as coursesHandler } from '../courses';
import { handler as contentHandler } from '../content';
import { handler as complianceHandler } from '../compliance';
import { handler as opportunitiesHandler } from '../opportunities';
import { handler as syncOpportunitiesHandler } from '../sync-opportunities';
import { handler as adminAuthHandler } from '../admin-auth';
import { handler as adminDataHandler } from '../admin-data';
import { handler as adminJobsHandler } from '../admin-jobs';
import { handler as adminWorkshopsHandler } from '../admin-workshops';
import { handler as adminCoursesHandler } from '../admin-courses';
import { handler as adminContentHandler } from '../admin-content';
import { handler as adminAutomationHandler } from '../admin-automation';
import { handler as apiNotFoundHandler } from '../api-not-found';
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

function withAdminEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  const prevNetlify = process.env.NETLIFY;

  process.env.ADMIN_USERNAME = 'admin@bio-inexa.org';
  process.env.ADMIN_PASSWORD = 'TestAdminPassword!2026';
  process.env.ADMIN_SESSION_SECRET = 'TestSessionSecret!2026';
  process.env.NETLIFY = 'true';

  return fn().finally(() => {
    if (prevUser === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPass;
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
    if (prevNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = prevNetlify;
  });
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
    '/api/admin/data',
    '/api/admin/jobs',
    '/api/admin/workshops',
    '/api/admin/courses',
    '/api/admin/content',
    '/api/admin/backups',
    '/api/admin/compliance-requests',
    '/api/admin/automated-sync/*',
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

test('admin endpoints reject unauthenticated requests and support full signed session lifecycle', async () => {
  await withAdminEnv(async () => {
    const unauthData = await adminDataHandler(makeEvent({ path: '/api/admin/data' }));
    assert.equal(unauthData.statusCode, 401);

    const unauthSync = await syncOpportunitiesHandler(
      makeEvent({ httpMethod: 'POST', path: '/api/sync-opportunities' })
    );
    assert.equal(unauthSync.statusCode, 401);

    const badLogin = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        body: JSON.stringify({ username: 'admin@bio-inexa.org', password: 'WrongPassword' }),
      })
    );
    assert.equal(badLogin.statusCode, 401);

    const loginRes = await adminAuthHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/login',
        body: JSON.stringify({
          username: 'admin@bio-inexa.org',
          password: 'TestAdminPassword!2026',
        }),
      })
    );
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.success, true);
    assert.ok(loginBody.token);
    assert.ok(loginRes.headers?.['Set-Cookie']?.includes('HttpOnly'));

    const authHeaders = {
      origin: 'https://bio-inexa-0.netlify.app',
      authorization: `Bearer ${loginBody.token}`,
    };

    const meRes = await adminAuthHandler(
      makeEvent({ httpMethod: 'GET', path: '/api/admin/me', headers: authHeaders })
    );
    assert.equal(meRes.statusCode, 200);
    assert.equal(JSON.parse(meRes.body).authenticated, true);

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

    const validWorkshopCreate = await adminWorkshopsHandler(
      makeEvent({
        httpMethod: 'POST',
        path: '/api/admin/workshops',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'qPCR Masterclass',
          registrationUrl: 'https://www.igib.res.in/',
        }),
      })
    );
    assert.equal(validWorkshopCreate.statusCode, 503);

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

    const syncStatusGet = await adminAutomationHandler(
      makeEvent({
        httpMethod: 'GET',
        path: '/api/admin/automated-sync/status',
        headers: authHeaders,
      })
    );
    assert.equal(syncStatusGet.statusCode, 200);
    assert.ok(JSON.parse(syncStatusGet.body).sources.length >= 5);

    const logoutRes = await adminAuthHandler(
      makeEvent({ httpMethod: 'POST', path: '/api/admin/logout', headers: authHeaders })
    );
    assert.equal(logoutRes.statusCode, 200);
    assert.ok(logoutRes.headers?.['Set-Cookie']?.includes('Max-Age=0'));
  });
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
