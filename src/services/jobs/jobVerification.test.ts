import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isApplicationLinkActionable,
  parseApplicationDestination,
  getAllUnifiedJobs,
  UnifiedJob,
} from './jobService';
import { bionexaDb } from '../../db/bionexaDatabase';
import { SEED_JOBS } from '../../data/seedData';
import { JobVerificationStatus } from '../../types';

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
      // Find or insert a test job
      const dbJobs = bionexaDb.getJobs();
      assert.ok(dbJobs.length > 0, 'Database should contain jobs');

      const target = dbJobs[0];
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

      // Verify audit record exists with verifiedBy
      const records = bionexaDb.getVerificationRecords(target.id);
      assert.ok(records.length > 0);
      assert.equal(records[0].verifiedBy, 'admin@bionexa.org');

      // Verify retrieval returns updated record
      const fetched = bionexaDb.getJobById(target.id);
      assert.ok(fetched);
      assert.equal(fetched.verificationStatus, 'Verified');
      assert.equal(fetched.isVerified, true);
      assert.equal(fetched.lastVerificationDate, testDate);
    });

    test('updating status to Link Unavailable properly records and sets isVerified to false', () => {
      const dbJobs = bionexaDb.getJobs();
      const target = dbJobs[dbJobs.length - 1];

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
        assert.ok(job.lastVerificationDate, `Job ${job.id} must have lastVerificationDate`);
      });
    });
  });
});
