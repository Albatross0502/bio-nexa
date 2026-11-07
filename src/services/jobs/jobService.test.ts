import test from 'node:test';
import assert from 'node:assert/strict';
import { getJobByIdOrSlug, getAllUnifiedJobs, isApplicationLinkActionable, slugify } from './jobService';

test('slugify converts titles into clean URL-friendly slugs', () => {
  assert.equal(slugify('Senior Bioprocess Scientist - Upstream Fermentation'), 'senior-bioprocess-scientist-upstream-fermentation');
  assert.equal(slugify('QC Associate / HPLC (Vaccine Testing)'), 'qc-associate-hplc-vaccine-testing');
});

test('getJobByIdOrSlug finds job by seed ID', () => {
  const job1 = getJobByIdOrSlug('job-1');
  assert.ok(job1, 'job-1 should be found');
  assert.equal(job1.id, 'job-1');
  assert.equal(job1.company, 'Biocon Biologics');
  assert.ok(job1.applicationUrl.includes('biocon.com'));

  const job2 = getJobByIdOrSlug('job-2');
  assert.ok(job2, 'job-2 should be found');
  assert.equal(job2.company, 'CSIR - Institute of Genomics & Integrative Biology (IGIB)');

  const job3 = getJobByIdOrSlug('job-3');
  assert.ok(job3, 'job-3 should be found');
  assert.equal(job3.company, 'Serum Institute of India (SII)');
});

test('getJobByIdOrSlug finds job by opportunity ID', () => {
  const oppBio1 = getJobByIdOrSlug('opp-bio-1');
  assert.ok(oppBio1, 'opp-bio-1 should be found');
  assert.equal(oppBio1.id, 'opp-bio-1');
  assert.equal(oppBio1.company, 'Biocon Biologics');

  const oppFood1 = getJobByIdOrSlug('opp-food-1');
  assert.ok(oppFood1, 'opp-food-1 should be found');
  assert.ok(oppFood1.title.includes('Food Quality Analyst'));
});

test('getJobByIdOrSlug finds job by slug', () => {
  const bySlug = getJobByIdOrSlug('senior-bioprocess-scientist-biocon');
  assert.ok(bySlug, 'should find job by slug');
  assert.equal(bySlug.id, 'job-1');
});

test('getJobByIdOrSlug returns null for invalid job IDs', () => {
  const invalid = getJobByIdOrSlug('non-existent-job-9999');
  assert.equal(invalid, null);

  const empty = getJobByIdOrSlug('');
  assert.equal(empty, null);
});

test('isApplicationLinkActionable validates links correctly', () => {
  const activeJob = getJobByIdOrSlug('job-1');
  assert.ok(activeJob);
  assert.equal(isApplicationLinkActionable(activeJob), true);

  const mockExpiredJob = {
    ...activeJob,
    isExpired: true,
    status: 'Expired' as const
  };
  assert.equal(isApplicationLinkActionable(mockExpiredJob), false);

  const mockNoLinkJob = {
    ...activeJob,
    isExpired: false,
    applicationUrl: '#'
  };
  assert.equal(isApplicationLinkActionable(mockNoLinkJob), false);
});
