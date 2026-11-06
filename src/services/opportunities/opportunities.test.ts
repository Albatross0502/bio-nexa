import test from 'node:test';
import assert from 'node:assert/strict';
import { matchBranchesForOpportunity, EDUCATIONAL_BRANCHES } from '../../config/branches';
import { isDuplicateOpportunity } from './duplicateDetector';
import { calculateOpportunityStatus, getDaysUntilDeadline } from './expiryManager';
import { Opportunity } from '../../types/opportunity';

test('Branch Matching: matches microbiology role with microbiology keywords', () => {
  const branches = matchBranchesForOpportunity({
    title: 'Senior Microbiologist - QC',
    description: 'Looking for a specialist with expertise in microbial culture and aseptic techniques.',
  });
  assert.ok(branches.includes('microbiology'));
});

test('Branch Matching: matches bioinformatics role with computational biology keywords', () => {
  const branches = matchBranchesForOpportunity({
    title: 'Computational Biology Fellow',
    description: 'Next-Generation Sequencing (NGS) data analysis, Python pipeline development, and structural modeling.',
  });
  assert.ok(branches.includes('bioinformatics'));
});

test('Branch Matching: matches food technology with HACCP and food safety', () => {
  const branches = matchBranchesForOpportunity({
    title: 'Food Safety Officer',
    description: 'HACCP compliance, fermentation monitoring, and food processing quality analysis.',
  });
  assert.ok(branches.includes('food_technology'));
});

test('Branch Matching: fallback assigns biotechnology when life science keywords present', () => {
  const branches = matchBranchesForOpportunity({
    title: 'Scientific Officer',
    description: 'General biotechnology research and recombinant DNA assays.',
  });
  assert.ok(branches.includes('biotechnology') || branches.includes('life_sciences'));
});

test('Duplicate Detection: detects duplicate with identical canonical URL ignoring UTM tracking params', () => {
  const existing: Opportunity[] = [
    {
      id: 'opp-1',
      title: 'Junior Research Fellow (JRF)',
      organization: 'CSIR-IGIB',
      type: 'internship',
      subCategory: 'Junior Research Fellow',
      location: 'New Delhi',
      workMode: 'On-site',
      branches: ['biotechnology', 'life_sciences'],
      qualifications: ['M.Sc Life Sciences'],
      skills: ['PCR', 'Genomics'],
      experience: 'Fresher',
      salaryOrStipend: '₹31,000 / month',
      salaryTier: '20k_to_40k',
      deadline: '2025-05-31',
      postedDate: '2025-04-01',
      sourceName: 'CSIR Official Gazette',
      sourceUrl: 'https://igib.res.in',
      sourceId: 'csir-101',
      lastVerifiedDate: '2025-04-01',
      status: 'Active',
      isApproved: true,
      dataCollectionTimestamp: new Date().toISOString(),
      attributionRequirements: 'Official CSIR Gazette',
      description: 'Genomics project',
      applicationUrl: 'https://igib.res.in/careers/jrf-2025?utm_source=linkedin&utm_medium=feed',
    },
  ];

  const duplicate = isDuplicateOpportunity(
    {
      title: 'Junior Research Fellow (JRF)',
      organization: 'CSIR - IGIB',
      applicationUrl: 'https://igib.res.in/careers/jrf-2025?utm_campaign=share',
    },
    existing
  );

  assert.ok(duplicate !== null);
  assert.equal(duplicate?.id, 'opp-1');
});

test('Expiry Management: correctly flags expired when deadline is in the past', () => {
  const pastDate = '2020-01-01';
  const status = calculateOpportunityStatus(pastDate, 'Active');
  assert.equal(status, 'Expired');
});

test('Expiry Management: correctly flags closing soon when deadline is within 5 days', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const dateStr = futureDate.toISOString().split('T')[0];
  const status = calculateOpportunityStatus(dateStr, 'Active');
  assert.equal(status, 'Closing Soon');
});

test('Expiry Management: preserves active status when deadline is undefined (Not Specified)', () => {
  const status = calculateOpportunityStatus(undefined, 'Active');
  assert.equal(status, 'Active');
});

test('Expiry Management: calculate days until deadline correctly', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);
  const dateStr = futureDate.toISOString().split('T')[0];
  const days = getDaysUntilDeadline(dateStr);
  assert.ok(days !== null && days >= 9 && days <= 11);
});
