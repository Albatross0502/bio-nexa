import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isApplicationLinkActionable,
  parseApplicationDestination,
  validateApplicationUrl,
  getOfficialEmployerPortal,
  findDuplicateJob,
  mapJobToUnified,
  mapOpportunityToUnified,
  UnifiedJob,
} from './jobService';
import { bionexaDb } from '../../db/bionexaDatabase';
import { SEED_JOBS } from '../../data/seedData';
import { Job, JobVerificationStatus } from '../../types';
import { Opportunity } from '../../types/opportunity';

describe('PHASE 07 — Job Verification and Application System', () => {
  const sampleJob: UnifiedJob = {
    id: 'test-job-verify-1',
    slug: 'senior-fermentation-specialist-biocon',
    title: 'Senior Fermentation Specialist',
    company: 'Biocon Biologics',
    employer: 'Biocon Biologics Limited',
    sector: 'Private Biopharma',
    location: 'Bengaluru, Karnataka',
    workMode: 'On-site',
    type: 'Full-time',
    salary: '₹12,00,000 - ₹16,00,000 / yr',
    qualification: 'M.Sc / M.Tech in Biotechnology',
    experienceLevel: 'Mid-level (2-5 yrs)',
    description: 'Lead upstream fed-batch fermentation operations.',
    responsibilities: ['Scale up bioreactors to 1000L'],
    requirements: ['Experience with Sartorius or Applikon bioreactors'],
    skills: ['Bioreactors', 'HPLC', 'Fermentation'],
    benefits: ['Medical Insurance', 'PF'],
    deadline: '2026-12-31',
    applicationUrl: 'https://careers.biocon.com/jobs/bioprocess-01',
    originalJobUrl: 'https://careers.biocon.com/jobs/bioprocess-01',
    sourceName: 'Biocon Careers Portal',
    sourceUrl: 'https://careers.biocon.com',
    publicationDate: '2026-03-01',
    expiryDate: '2026-12-31',
    lastVerificationDate: '2026-03-05',
    verificationStatus: 'Verified',
    verificationNotes: 'Direct official career portal verified by administrator.',
    postedDate: '2026-03-01',
    status: 'Active',
    featured: true,
    isVerified: true,
    isExpired: false,
    isClosed: false,
    isClosingSoon: false,
    daysLeft: 300,
    branches: ['Biotechnology'],
  };

  test('records all 8 required verification attributes for jobs', () => {
    // 1. Employer identity
    assert.equal(sampleJob.employer, 'Biocon Biologics Limited');
    // 2. Original listing source
    assert.equal(sampleJob.sourceName, 'Biocon Careers Portal');
    // 3. Original job URL
    assert.equal(sampleJob.originalJobUrl, 'https://careers.biocon.com/jobs/bioprocess-01');
    // 4. Application destination
    assert.equal(sampleJob.applicationUrl, 'https://careers.biocon.com/jobs/bioprocess-01');
    // 5. Publication date
    assert.equal(sampleJob.publicationDate, '2026-03-01');
    // 6. Expiry date
    assert.equal(sampleJob.expiryDate, '2026-12-31');
    // 7. Last verification date
    assert.equal(sampleJob.lastVerificationDate, '2026-03-05');
    // 8. Verification status
    assert.equal(sampleJob.verificationStatus, 'Verified');
  });

  test('supports all 5 mandatory verification statuses', () => {
    const validStatuses: JobVerificationStatus[] = [
      'Pending Verification',
      'Verified',
      'Rejected',
      'Expired',
      'Link Unavailable',
    ];

    validStatuses.forEach((status) => {
      const jobCopy = { ...sampleJob, verificationStatus: status };
      assert.equal(jobCopy.verificationStatus, status);
    });
  });

  describe('isApplicationLinkActionable link state rules', () => {
    test('enables apply link for live verified jobs', () => {
      assert.equal(isApplicationLinkActionable(sampleJob), true);
    });

    test('disables apply link when verificationStatus is Expired', () => {
      const expiredJob: UnifiedJob = {
        ...sampleJob,
        verificationStatus: 'Expired',
        isExpired: true,
      };
      assert.equal(isApplicationLinkActionable(expiredJob), false);
    });

    test('disables apply link when verificationStatus is Link Unavailable', () => {
      const brokenJob: UnifiedJob = {
        ...sampleJob,
        verificationStatus: 'Link Unavailable',
      };
      assert.equal(isApplicationLinkActionable(brokenJob), false);
    });

    test('disables apply link when verificationStatus is Rejected', () => {
      const rejectedJob: UnifiedJob = {
        ...sampleJob,
        verificationStatus: 'Rejected',
      };
      assert.equal(isApplicationLinkActionable(rejectedJob), false);
    });

    test('disables apply link when deadline date is in the past', () => {
      const pastJob: UnifiedJob = {
        ...sampleJob,
        deadline: '2020-01-01',
        expiryDate: '2020-01-01',
      };
      assert.equal(isApplicationLinkActionable(pastJob), false);
    });

    test('disables apply link when applicationUrl is empty or placeholder', () => {
      const noUrlJob: UnifiedJob = {
        ...sampleJob,
        applicationUrl: '#',
      };
      assert.equal(isApplicationLinkActionable(noUrlJob), false);
    });
  });

  describe('parseApplicationDestination URL safety & fraud detection', () => {
    test('extracts hostname and official domain cleanly', () => {
      const result = parseApplicationDestination(sampleJob);
      assert.equal(result.domain, 'careers.biocon.com');
      assert.equal(result.isOfficialDomain, true);
      assert.equal(result.isSuspicious, false);
      assert.equal(result.warning, undefined);
    });

    test('flags URL shorteners as suspicious destinations', () => {
      const shortenedJob: UnifiedJob = {
        ...sampleJob,
        applicationUrl: 'https://bit.ly/biotech-apply-now',
      };
      const result = parseApplicationDestination(shortenedJob);
      assert.equal(result.isSuspicious, true);
      assert.match(result.warning || '', /shortener/i);
    });

    test('flags suspicious fee-demanding URLs', () => {
      const feeJob: UnifiedJob = {
        ...sampleJob,
        applicationUrl: 'https://external-recruiter.net/pay-exam-fee/apply',
      };
      const result = parseApplicationDestination(feeJob);
      assert.equal(result.isSuspicious, true);
      assert.match(result.warning || '', /fee|payment/i);
    });

    test('flags unverified or pending opportunities with advisory notice', () => {
      const pendingJob: UnifiedJob = {
        ...sampleJob,
        verificationStatus: 'Pending Verification',
        isVerified: false,
      };
      const result = parseApplicationDestination(pendingJob);
      assert.equal(result.isSuspicious, true);
      assert.match(result.warning || '', /pending audit/i);
    });
  });

  describe('bionexaDb job verification persistence', () => {
    test('verifyJob updates verificationStatus, notes, and lastVerificationDate in database', () => {
      const dbJobs = bionexaDb.getJobs();
      assert.ok(dbJobs.length > 0, 'Database should contain jobs');

      const target = bionexaDb.createJob({
        id: 'phase7-db-verify-persist-1',
        title: 'Temporary Fermentation Audit Job',
        employer: 'Biocon Biologics Limited',
        location: 'Bengaluru, Karnataka',
        sector: 'Private Biopharma',
        employmentType: 'Full-time',
        qualification: 'M.Sc / M.Tech',
        salary: 'Not Disclosed',
        description: 'Temporary job for verification persistence test.',
        responsibilities: [],
        requirements: [],
        skills: [],
        applicationUrl: 'https://careers.biocon.com/jobs/temp-verify-1',
        originalJobUrl: 'https://careers.biocon.com/jobs/temp-verify-1',
        source: 'Biocon Careers Portal',
        publicationDate: '2026-03-01',
        expiryDate: '2099-12-31',
        lastVerificationDate: '',
        verificationStatus: 'Pending Verification',
        verificationNotes: '',
        isVerified: false,
        isActive: true,
        isApproved: false,
        featured: false,
      });

      try {
        const testNotes = 'Verified against official institutional gazette notification.';
        const testDate = '2026-03-08';

        const updated = bionexaDb.verifyJob(
          target.id,
          'admin@bionexa.org',
          'Verified',
          testNotes,
          testDate
        );

        assert.ok(updated);
        assert.equal(updated.id, target.id);
        assert.equal(updated.verificationStatus, 'Verified');
        assert.equal(updated.isVerified, true);
        assert.equal(updated.verificationNotes, testNotes);
        assert.equal(updated.lastVerificationDate, testDate);

        const records = bionexaDb.getVerificationRecords(target.id);
        assert.ok(records.length > 0);
        assert.equal(records[0].verifiedBy, 'admin@bionexa.org');

        const fetched = bionexaDb.getJobById(target.id);
        assert.ok(fetched);
        assert.equal(fetched.verificationStatus, 'Verified');
        assert.equal(fetched.isVerified, true);
        assert.equal(fetched.lastVerificationDate, testDate);
      } finally {
        bionexaDb.deleteJob(target.id);
      }
    });

    test('updating status to Link Unavailable properly records and sets isVerified to false', () => {
      const target = bionexaDb.createJob({
        id: 'phase7-db-verify-broken-1',
        title: 'Temporary Broken Link Audit Job',
        employer: 'IGIB Lab',
        location: 'New Delhi',
        sector: 'Government / Research',
        employmentType: 'Full-time',
        qualification: 'Ph.D / Postdoc',
        salary: 'Not Disclosed',
        description: 'Temporary job for broken link verification test.',
        responsibilities: [],
        requirements: [],
        skills: [],
        applicationUrl: 'https://www.igib.res.in/jobs/broken-temp-1',
        originalJobUrl: 'https://www.igib.res.in/jobs/broken-temp-1',
        source: 'CSIR-IGIB Careers',
        publicationDate: '2026-03-01',
        expiryDate: '2099-12-31',
        lastVerificationDate: '',
        verificationStatus: 'Pending Verification',
        verificationNotes: '',
        isVerified: false,
        isActive: true,
        isApproved: false,
        featured: false,
      });

      try {
        const updated = bionexaDb.verifyJob(
          target.id,
          'admin@bionexa.org',
          'Link Unavailable',
          'Portal URL returned HTTP 404 during automated check.'
        );

        assert.ok(updated);
        assert.equal(updated.verificationStatus, 'Link Unavailable');
        assert.equal(updated.isVerified, false);

        const fetched = bionexaDb.getJobById(target.id);
        assert.ok(fetched);
        assert.equal(fetched.verificationStatus, 'Link Unavailable');
        assert.equal(fetched.isVerified, false);
      } finally {
        bionexaDb.deleteJob(target.id);
      }
    });
  });

  describe('Seed data honest verification claim check', () => {
    test('seed jobs contain only real verified flags for actually audited records', () => {
      SEED_JOBS.forEach((job) => {
        // Honest claim requirement: isVerified must match verificationStatus === 'Verified'
        if (job.verificationStatus === 'Verified') {
          assert.equal(job.isVerified, true, `Job ${job.id} should be isVerified=true`);
        } else {
          assert.equal(job.isVerified, false, `Job ${job.id} should NOT claim verified`);
        }

        // Each seed job has employer recorded
        assert.ok(job.employer, `Job ${job.id} must have employer`);
        assert.ok(job.originalJobUrl, `Job ${job.id} must have originalJobUrl`);
        assert.ok(job.publicationDate, `Job ${job.id} must have publicationDate`);
        assert.ok(job.expiryDate, `Job ${job.id} must have expiryDate`);

        // Unverified / Pending Verification jobs must NOT fabricate lastVerificationDate
        if (job.verificationStatus === 'Pending Verification') {
          assert.equal(
            job.lastVerificationDate || '',
            '',
            `Pending job ${job.id} must NOT fabricate lastVerificationDate`
          );
        } else {
          assert.ok(job.lastVerificationDate, `Audited job ${job.id} must have lastVerificationDate`);
        }
      });
    });
  });

  describe('Phase 07 URL validation, portal fallback, duplicate check, and mapper defaults', () => {
    test('validateApplicationUrl rejects placeholders, shorteners, javascript URLs, and fee links', () => {
      assert.equal(validateApplicationUrl('').valid, false);
      assert.equal(validateApplicationUrl('#').valid, false);
      assert.equal(validateApplicationUrl('javascript:alert(1)').valid, false);
      assert.equal(validateApplicationUrl('https://bit.ly/apply-now').valid, false);
      assert.equal(validateApplicationUrl('https://careers.example.com/pay-registration-fee').valid, false);

      const ok = validateApplicationUrl('https://careers.biocon.com/job/123');
      assert.equal(ok.valid, true);
      assert.equal(ok.domain, 'careers.biocon.com');
    });

    test('getOfficialEmployerPortal resolves official domain for Link Unavailable listings', () => {
      const brokenJob: UnifiedJob = {
        ...sampleJob,
        verificationStatus: 'Link Unavailable',
        applicationUrl: '#',
        originalJobUrl: '#',
        sourceUrl: '#',
        employer: 'Biocon Biologics',
        company: 'Biocon Biologics',
      };
      const portal = getOfficialEmployerPortal(brokenJob);
      assert.ok(portal);
      assert.equal(portal.portalDomain, 'www.biocon.com');
      assert.match(portal.portalUrl, /^https:\/\/www\.biocon\.com/);

      const withExplicitSource = getOfficialEmployerPortal({
        ...brokenJob,
        sourceUrl: 'https://careers.biocon.com',
      });
      assert.ok(withExplicitSource);
      assert.equal(withExplicitSource.portalDomain, 'careers.biocon.com');
    });

    test('findDuplicateJob catches canonical URL duplicates (ignoring UTM params) and employer+title duplicates', () => {
      const existing = [
        {
          id: 'existing-1',
          title: 'Quality Control Scientist',
          employer: 'Biocon Biologics',
          company: 'Biocon Biologics',
          applicationUrl: 'https://careers.biocon.com/jobs/qc-101',
          originalJobUrl: 'https://careers.biocon.com/jobs/qc-101',
          location: 'Bengaluru',
        },
      ];

      const urlDup = findDuplicateJob(
        {
          title: 'QC Scientist',
          company: 'Biocon',
          applicationUrl: 'https://careers.biocon.com/jobs/qc-101/?utm_source=linkedin',
        },
        existing
      );
      assert.ok(urlDup);
      assert.equal(urlDup.id, 'existing-1');

      const titleEmployerDup = findDuplicateJob(
        {
          title: 'Quality Control Scientist',
          employer: 'Biocon Biologics',
          applicationUrl: 'https://careers.biocon.com/jobs/qc-101-repost',
          location: 'Bengaluru',
        },
        existing
      );
      assert.ok(titleEmployerDup);
      assert.equal(titleEmployerDup.id, 'existing-1');

      const distinct = findDuplicateJob(
        {
          title: 'Upstream Fermentation Lead',
          employer: 'Biocon Biologics',
          applicationUrl: 'https://careers.biocon.com/jobs/ferm-202',
        },
        existing
      );
      assert.equal(distinct, null);
    });

    test('mapJobToUnified and mapOpportunityToUnified default unverified entries to Pending Verification with no fake date', () => {
      const unverifiedJob: Job = {
        id: 'unverified-1',
        slug: 'genomics-analyst-csir-igib',
        title: 'Genomics Analyst',
        company: 'CSIR-IGIB',
        sector: 'Government / Autonomous',
        location: 'New Delhi',
        type: 'Full-time',
        salary: '₹6 LPA',
        qualification: 'M.Sc / M.Tech',
        experienceLevel: 'Fresher (0-1 yr)',
        description: 'NGS analysis',
        responsibilities: [],
        requirements: [],
        skills: [],
        deadline: '2099-12-31',
        postedDate: '2026-03-01',
        applicationUrl: 'https://www.igib.res.in/careers',
        source: {
          name: 'CSIR-IGIB Careers',
          url: 'https://www.igib.res.in/careers',
          isExternal: true,
        },
      };
      const mappedJob = mapJobToUnified(unverifiedJob);
      assert.equal(mappedJob.verificationStatus, 'Pending Verification');
      assert.equal(mappedJob.isVerified, false);
      assert.equal(mappedJob.lastVerificationDate, '');
      assert.equal(mappedJob.verificationNotes, undefined);

      const unverifiedOpp: Opportunity = {
        id: 'opp-unverified-1',
        title: 'Molecular Biology Intern',
        type: 'biotech_job',
        organization: 'NCBS Bengaluru',
        description: 'Research role',
        eligibility: 'M.Sc',
        location: 'Bengaluru',
        workMode: 'On-site',
        applicationDeadline: '2099-12-31',
        applicationUrl: 'https://www.ncbs.res.in/jobportal',
        sourceName: 'Google Sheets Sync',
        status: 'Open',
        isExternal: true,
        isApproved: false,
        isVerified: false,
        branches: ['biotechnology'],
        postedDate: '2026-03-01',
        createdAt: '2026-03-01',
      };
      const mappedOpp = mapOpportunityToUnified(unverifiedOpp);
      assert.equal(mappedOpp.verificationStatus, 'Pending Verification');
      assert.equal(mappedOpp.isVerified, false);
      assert.equal(mappedOpp.lastVerificationDate, '');
      assert.equal(mappedOpp.verificationNotes, undefined);
    });

    test('bionexaDb.verifyJob clears lastVerificationDate when reset to Pending Verification', () => {
      const created = bionexaDb.createJob({
        id: 'phase7-db-verify-test',
        title: 'Phase 7 Audit Job',
        employer: 'CSIR-IGIB',
        location: 'New Delhi',
        employmentType: 'Full-time',
        sector: 'Research',
        qualification: 'M.Sc',
        salary: 'Not Disclosed',
        publicationDate: '2026-03-01',
        expiryDate: '2099-12-31',
        description: 'Testing verification persistence.',
        responsibilities: [],
        requirements: [],
        skills: [],
        applicationUrl: 'https://www.igib.res.in/careers/test-1',
        originalJobUrl: 'https://www.igib.res.in/careers/test-1',
        source: 'Direct',
        verificationStatus: 'Pending Verification',
        isVerified: false,
        lastVerificationDate: '',
        verificationNotes: '',
        featured: false,
        isActive: true,
        isApproved: false,
      });

      assert.equal(created.verificationStatus, 'Pending Verification');
      assert.equal(created.lastVerificationDate, '');

      const reset = bionexaDb.verifyJob(
        created.id,
        'admin@bionexa.org',
        'Pending Verification',
        'Queued for re-audit',
        '2026-03-09'
      );
      assert.ok(reset);
      assert.equal(reset.verificationStatus, 'Pending Verification');
      assert.equal(reset.isVerified, false);
      assert.equal(reset.lastVerificationDate, '');

      bionexaDb.deleteJob(created.id);
    });
  });
});
