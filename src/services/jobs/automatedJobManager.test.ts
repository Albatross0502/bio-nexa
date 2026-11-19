import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AutomatedJobManager,
  SyncInProgressError,
  getSyncScheduleConfig,
} from './automatedJobManager.js';
import { executeOpportunitySync, fetchWithRetry } from './opportunitySyncEngine.js';
import { BionexaDatabase } from '../../db/bionexaDatabase.js';

test('AutomatedJobManager classifies jobs into 11 target categories', () => {
  const manager = new AutomatedJobManager();

  assert.equal(manager.categorizeJob('Senior Microbiologist - Endotoxin Testing'), 'Microbiology Jobs');
  assert.equal(manager.categorizeJob('QC Associate - HPLC & Analytical Release'), 'Quality Control Jobs');
  assert.equal(manager.categorizeJob('Quality Assurance Executive - 21 CFR Part 11'), 'Quality Assurance Jobs');
  assert.equal(manager.categorizeJob('Bioinformatics Analyst - Single-Cell RNA-Seq'), 'Bioinformatics Jobs');
  assert.equal(manager.categorizeJob('Clinical Research Coordinator - Phase III Trial'), 'Clinical Research Jobs');
  assert.equal(manager.categorizeJob('Formulation R&D Executive - Oral Solid Dosage'), 'Pharmaceutical Jobs');
  assert.equal(manager.categorizeJob('CSIR-JRF Junior Research Fellowship in Life Sciences'), 'Research Fellowships');
  assert.equal(manager.categorizeJob('Summer Research Intern - Plant Biotechnology'), 'Biotechnology Internships');
  assert.equal(manager.categorizeJob('Medical Laboratory Technologist - Histopathology'), 'Laboratory Jobs');
  assert.equal(manager.categorizeJob('Principal Research Scientist - CRISPR Editing'), 'Research Jobs');
  assert.equal(manager.categorizeJob('Bioprocess Engineer - Upstream Cell Culture'), 'Biotechnology Jobs');
});

test('AutomatedJobManager normalizes URLs and text for duplicate detection', () => {
  const manager = new AutomatedJobManager();

  const url1 = 'https://www.biocon.com/careers/job-1/?utm_source=adzuna&ref=linkedin';
  const url2 = 'https://www.biocon.com/careers/job-1/';
  assert.equal(manager.normalizeUrl(url1), manager.normalizeUrl(url2));

  const text1 = 'Senior Bioprocess Scientist — Upstream Fermentation!';
  const text2 = 'senior bioprocess scientist upstream fermentation';
  assert.equal(manager.normalizeText(text1), manager.normalizeText(text2));
});

test('AutomatedJobManager detects duplicate vacancies accurately', () => {
  const manager = new AutomatedJobManager();
  const existingJobs: any[] = [
    {
      id: 'job-existing-1',
      title: 'Senior Bioprocess Scientist',
      employer: 'Biocon Biologics',
      applicationUrl: 'https://www.biocon.com/careers/job-1'
    }
  ];

  // Identical URL duplicate
  const candidate1 = {
    title: 'Bioprocess Scientist Post',
    employer: 'Biocon Biologics',
    applicationUrl: 'https://www.biocon.com/careers/job-1?utm_medium=feed',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate1, existingJobs), true);

  // Identical Title & Employer duplicate
  const candidate2 = {
    title: 'Senior Bioprocess Scientist',
    employer: 'Biocon Biologics',
    applicationUrl: 'https://www.biocon.com/different-url',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate2, existingJobs), true);

  // Distinct vacancy
  const candidate3 = {
    title: 'QC Associate - HPLC',
    employer: 'Serum Institute',
    applicationUrl: 'https://www.seruminstitute.com/careers/qc-1',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate3, existingJobs), false);
});

test('AutomatedJobManager accurately marks expired dates', () => {
  const manager = new AutomatedJobManager();
  const today = new Date('2026-11-07T12:00:00Z');

  assert.equal(manager.isExpired('2026-10-31', today), true); // Past deadline
  assert.equal(manager.isExpired('2026-12-15', today), false); // Future deadline
  assert.equal(manager.isExpired('Not Specified', today), false); // Undefined deadline remains active
});

test('Phase 08: zero fabricated imports occur when no external sources are configured', async () => {
  const db = new BionexaDatabase(':memory:');
  const manager = new AutomatedJobManager();
  const initialCount = db.getAllJobsAdmin().length;

  const report = await manager.runAutomatedSync({
    db,
    env: {},
  });

  assert.equal(report.sourcesAttempted, 0);
  assert.equal(report.sourcesSkippedUnconfigured, 2);
  assert.equal(report.candidatesProcessed, 0);
  assert.equal(report.newImportedCount, 0);
  assert.equal(db.getAllJobsAdmin().length, initialCount);

  const logs = db.getSyncLogs(5);
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].itemsAdded, 0);
});

test('Phase 08: fetchWithRetry retries transient 503 failures and ingests authorized RSS feed as Pending Verification', async () => {
  const db = new BionexaDatabase(':memory:');
  const manager = new AutomatedJobManager();

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>CSIR-IGIB Careers</title>
        <item>
          <title>Project Associate-I (CRISPR Diagnostics)</title>
          <link>https://www.igib.res.in/careers/pa1-crispr-2026</link>
          <description>Molecular biology research position involving qPCR and CRISPR assays.</description>
          <pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`;

  let fetchCalls = 0;
  const mockFetch = (async () => {
    fetchCalls++;
    if (fetchCalls === 1) {
      return new Response('Service Unavailable', { status: 503 });
    }
    return new Response(rssXml, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    });
  }) as unknown as typeof fetch;

  const report = await manager.runAutomatedSync({
    db,
    env: {
      AUTHORIZED_FEED_URLS: 'https://www.igib.res.in/careers/feed.xml',
    },
    fetchOptions: {
      fetchFn: mockFetch,
      maxRetries: 2,
      baseDelayMs: 1,
    },
  });

  assert.equal(fetchCalls, 2);
  assert.equal(report.sourcesAttempted, 1);
  assert.equal(report.sourcesSuccessful, 1);
  assert.equal(report.newImportedCount, 1);

  const imported = db.getAllJobsAdmin().find((j) =>
    j.applicationUrl.includes('pa1-crispr-2026')
  );
  assert.ok(imported, 'Expected RSS item to be imported into SQLite jobs table');
  assert.equal(imported!.verificationStatus, 'Pending Verification');
  assert.equal(imported!.isApproved, false);
  assert.equal(imported!.lastVerificationDate, '');
  assert.equal(imported!.originalJobUrl, 'https://www.igib.res.in/careers/feed.xml');
});

test('Phase 08: strict URL validation rejects unsafe application and source URLs and skips expired candidates', async () => {
  const db = new BionexaDatabase(':memory:');
  const manager = new AutomatedJobManager();

  const report = await manager.runAutomatedSync({
    db,
    customCandidates: [
      {
        title: 'Shortener Trap Role',
        employer: 'Unknown Lab',
        applicationUrl: 'https://bit.ly/fake-role',
        source: 'Test Feed',
        location: 'Bengaluru',
        publicationDate: '2026-11-10',
        expiryDate: '2026-12-30',
        sector: 'Biotechnology Jobs',
        description: 'Invalid shortener destination test',
        qualification: 'M.Sc',
        skills: ['PCR'],
        employmentType: 'Full-time',
        salary: 'Not Disclosed',
      },
      {
        title: 'Bad Source URL Role',
        employer: 'Example Biotech',
        applicationUrl: 'https://www.biocon.com/careers/valid-role',
        originalJobUrl: 'http://tinyurl.com/bad-source',
        source: 'Test Feed',
        location: 'Bengaluru',
        publicationDate: '2026-11-10',
        expiryDate: '2026-12-30',
        sector: 'Biotechnology Jobs',
        description: 'Invalid source URL test',
        qualification: 'M.Sc',
        skills: ['HPLC'],
        employmentType: 'Full-time',
        salary: 'Not Disclosed',
      },
      {
        title: 'Fee Indicator Role',
        employer: 'Fee Biotech',
        applicationUrl: 'https://careers.example.org/pay-fee-apply',
        source: 'Test Feed',
        location: 'Pune',
        publicationDate: '2026-11-10',
        expiryDate: '2026-12-30',
        sector: 'Biotechnology Jobs',
        description: 'Prohibited fee link test',
        qualification: 'B.Tech',
        skills: ['ELISA'],
        employmentType: 'Full-time',
        salary: 'Not Disclosed',
      },
      {
        title: 'Already Expired Candidate',
        employer: 'CSIR-CCMB',
        applicationUrl: 'https://www.ccmb.res.in/careers/expired-post-2020',
        source: 'CSIR-CCMB Feed',
        location: 'Hyderabad',
        publicationDate: '2020-01-01',
        expiryDate: '2020-02-01',
        sector: 'Research Jobs',
        description: 'Past deadline candidate should be skipped cleanly.',
        qualification: 'Ph.D.',
        skills: ['Genomics'],
        employmentType: 'Full-time',
        salary: '₹56,000 / month',
      },
      {
        title: 'Valid Molecular Biologist Post',
        employer: 'CSIR-CDRI',
        applicationUrl: 'https://cdri.res.in/careers/mol-bio-2099',
        originalJobUrl: 'https://cdri.res.in/vacancies',
        source: 'CSIR-CDRI Official Feed',
        location: 'Lucknow',
        publicationDate: '2026-11-10',
        expiryDate: '2099-12-31',
        sector: 'Research Jobs',
        description: 'Valid genuine molecular biology opening with compliant URLs.',
        qualification: 'M.Sc Biotechnology',
        skills: ['qPCR', 'CRISPR'],
        employmentType: 'Full-time',
        salary: '₹42,000 / month',
      },
    ],
  });

  assert.equal(report.invalidRejectedCount, 3);
  assert.equal(report.expiredSkippedCount, 1);
  assert.equal(report.newImportedCount, 1);
});

test('Phase 08: safe non-destructive duplicate updates preserve Verified curation and never resurrect Rejected listings', async () => {
  const db = new BionexaDatabase(':memory:');
  const manager = new AutomatedJobManager();

  const verifiedJob = db.createJob({
    title: 'Bioprocess Upstream Scientist',
    employer: 'Syngene International',
    description: 'Cell culture & bioreactor scale-up role.',
    location: 'Bengaluru',
    qualification: 'M.Tech Biotechnology',
    skills: [],
    employmentType: 'Full-time',
    salary: 'Not Disclosed',
    applicationUrl: 'https://www.syngeneintl.com/careers/upstream-role-1',
    source: 'Syngene Partner Feed',
    originalJobUrl: 'https://www.syngeneintl.com/careers/',
    publicationDate: '2026-11-01',
    expiryDate: '2099-11-15',
    lastVerificationDate: '2026-11-02',
    verificationStatus: 'Verified',
    verificationNotes: 'Reviewed and approved by senior admin.',
    isActive: true,
    isApproved: true,
    featured: true,
    responsibilities: [],
    requirements: [],
    sector: 'Biotechnology Jobs',
  });

  const rejectedJob = db.createJob({
    title: 'Disallowed Third-Party Role',
    employer: 'Rejected Org',
    description: 'Admin explicitly rejected this record.',
    location: 'Mumbai',
    qualification: 'B.Sc',
    skills: ['PCR'],
    employmentType: 'Full-time',
    salary: 'Not Disclosed',
    applicationUrl: 'https://www.example.org/careers/rejected-role-1',
    source: 'Test Feed',
    originalJobUrl: 'https://www.example.org/',
    publicationDate: '2026-11-01',
    expiryDate: '2099-11-30',
    lastVerificationDate: '2026-11-02',
    verificationStatus: 'Rejected',
    verificationNotes: 'Duplicate/low quality.',
    isActive: false,
    isApproved: false,
    featured: false,
    responsibilities: [],
    requirements: [],
    sector: 'Biotechnology Jobs',
  });

  const report = await manager.runAutomatedSync({
    db,
    customCandidates: [
      {
        title: 'Bioprocess Upstream Scientist',
        employer: 'Syngene International',
        description: 'Updated upstream feed description',
        location: 'Bengaluru',
        qualification: 'M.Tech Biotechnology',
        skills: ['Cell Culture', 'Fermentation'],
        employmentType: 'Full-time',
        salary: '₹9,00,000 - ₹12,00,000 / yr',
        applicationUrl: 'https://www.syngeneintl.com/careers/upstream-role-1?utm_source=sync',
        source: 'Syngene Partner Feed',
        publicationDate: '2026-11-01',
        expiryDate: '2099-12-20',
        sector: 'Biotechnology Jobs',
      },
      {
        title: 'Disallowed Third-Party Role',
        employer: 'Rejected Org',
        description: 'Attempt to re-sync rejected record',
        location: 'Mumbai',
        qualification: 'B.Sc',
        skills: ['PCR'],
        employmentType: 'Full-time',
        salary: '₹6,00,000 / yr',
        applicationUrl: 'https://www.example.org/careers/rejected-role-1',
        source: 'Test Feed',
        publicationDate: '2026-11-01',
        expiryDate: '2099-12-25',
        sector: 'Biotechnology Jobs',
      },
    ],
  });

  assert.equal(report.updatedCount, 1);
  assert.equal(report.duplicatesSkippedCount, 1);
  assert.equal(report.newImportedCount, 0);

  const afterVerified = db.getJobById(verifiedJob.id)!;
  assert.equal(afterVerified.salary, '₹9,00,000 - ₹12,00,000 / yr');
  assert.equal(afterVerified.expiryDate, '2099-12-20');
  assert.deepEqual(afterVerified.skills, ['Cell Culture', 'Fermentation']);
  // Admin verification & approval decisions preserved untouched
  assert.equal(afterVerified.verificationStatus, 'Verified');
  assert.equal(afterVerified.isApproved, true);
  assert.equal(afterVerified.lastVerificationDate, '2026-11-02');

  const afterRejected = db.getJobById(rejectedJob.id)!;
  assert.equal(afterRejected.verificationStatus, 'Rejected');
  assert.equal(afterRejected.isApproved, false);
  assert.equal(afterRejected.salary, 'Not Disclosed');
});

test('Phase 08: overlap protection throws SyncInProgressError (409) and partial source failure preserves existing data', async () => {
  const db = new BionexaDatabase(':memory:');
  const manager = new AutomatedJobManager();
  const baselineCount = db.getAllJobsAdmin().length;

  let releaseSlowFetch!: () => void;
  const slowPromise = manager.runAutomatedSync({
    db,
    customSources: [
      {
        sourceId: 'slow-source',
        sourceName: 'Slow Authorized Source',
        fetchCandidates: () =>
          new Promise((resolve) => {
            releaseSlowFetch = () =>
              resolve([
                {
                  title: 'QC Analytical Scientist',
                  employer: 'Biocon Biologics',
                  applicationUrl: 'https://www.biocon.com/careers/qc-analytical-2099',
                  description: 'HPLC and stability assay testing.',
                  location: 'Bengaluru',
                  expiryDate: '2099-12-15',
                },
              ]);
          }),
      },
      {
        sourceId: 'broken-source',
        sourceName: 'Temporarily Down Source',
        fetchCandidates: async () => [],
      },
    ],
    simulateSourceErrors: ['broken-source'],
  });

  // Give the async sync loop a tick to enter custom source fetch
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(manager.isSyncInProgress(), true);

  await assert.rejects(
    () => manager.runAutomatedSync({ db, env: {} }),
    (err: any) =>
      err instanceof SyncInProgressError &&
      err.statusCode === 409 &&
      err.code === 'SYNC_IN_PROGRESS'
  );

  releaseSlowFetch();
  const report = await slowPromise;

  assert.equal(manager.isSyncInProgress(), false);
  assert.equal(report.sourcesAttempted, 2);
  assert.equal(report.sourcesSuccessful, 1);
  assert.equal(report.sourcesFailed, 1);
  assert.equal(report.newImportedCount, 1);
  assert.ok(db.getAllJobsAdmin().length === baselineCount + 1);
});

test('Phase 08: configurable sync interval defaults to 6h and respects SYNC_INTERVAL_HOURS', () => {
  const defaultSchedule = getSyncScheduleConfig({});
  assert.equal(defaultSchedule.intervalHours, 6);
  assert.equal(defaultSchedule.intervalMs, 6 * 60 * 60 * 1000);
  assert.equal(defaultSchedule.cronExpression, '0 */6 * * *');

  const customSchedule = getSyncScheduleConfig({ SYNC_INTERVAL_HOURS: '12' });
  assert.equal(customSchedule.intervalHours, 12);
  assert.equal(customSchedule.intervalMs, 12 * 60 * 60 * 1000);
  assert.equal(customSchedule.cronExpression, '0 */12 * * *');
});

