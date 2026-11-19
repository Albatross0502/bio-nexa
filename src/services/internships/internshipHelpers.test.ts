import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyInternshipCompensation,
  normalizeInternshipMode,
  matchesInternshipModeFilter,
  parseInternshipDeadline,
  isInternshipDeadlineExpired,
  getInternshipDaysRemaining,
  validateInternshipApplicationUrl,
  extractInternshipLocations,
  filterInternships,
  sortInternshipsByUpcomingDeadline,
  validateInternshipSubmissionPayload
} from './internshipHelpers';
import { BionexaDatabase } from '../../db/bionexaDatabase';

test('classifyInternshipCompensation accurately distinguishes paid and unpaid internships', () => {
  assert.equal(classifyInternshipCompensation('₹18,000 / month + Subsidized Accommodation'), 'paid');
  assert.equal(classifyInternshipCompensation('₹15,000 / month'), 'paid');
  assert.equal(classifyInternshipCompensation('Competitive Stipend'), 'paid');
  assert.equal(classifyInternshipCompensation('Funded Fellowship'), 'paid');
  assert.equal(classifyInternshipCompensation('Unpaid'), 'unpaid');
  assert.equal(classifyInternshipCompensation('No stipend (Academic Credit)'), 'unpaid');
  assert.equal(classifyInternshipCompensation('Self-funded training'), 'unpaid');
  assert.equal(classifyInternshipCompensation('Volunteer Research Trainee'), 'unpaid');
  assert.equal(classifyInternshipCompensation('₹0 / month'), 'unpaid');
  assert.equal(classifyInternshipCompensation(''), 'unpaid');
});

test('normalizeInternshipMode and matchesInternshipModeFilter support canonical and shorthand values', () => {
  assert.equal(normalizeInternshipMode('Remote / Dry Lab'), 'Remote / Dry Lab');
  assert.equal(normalizeInternshipMode('Online Bioinformatics'), 'Remote / Dry Lab');
  assert.equal(normalizeInternshipMode('Hybrid Wet/Dry'), 'Hybrid');
  assert.equal(normalizeInternshipMode('On-site Wet Lab'), 'On-site Lab');

  assert.equal(matchesInternshipModeFilter('Remote / Dry Lab', 'remote'), true);
  assert.equal(matchesInternshipModeFilter('Remote / Dry Lab', 'Remote / Dry Lab'), true);
  assert.equal(matchesInternshipModeFilter('Remote / Dry Lab', 'onsite'), false);
  assert.equal(matchesInternshipModeFilter('On-site Lab', 'onsite'), true);
  assert.equal(matchesInternshipModeFilter('Hybrid', 'hybrid'), true);
  assert.equal(matchesInternshipModeFilter('Hybrid', 'all'), true);
});

test('deadline parsing, expiry detection, and days remaining handle ISO dates and rolling deadlines', () => {
  const ref = new Date('2026-06-15T12:00:00.000Z');
  assert.equal(parseInternshipDeadline('Rolling'), null);
  assert.equal(parseInternshipDeadline(''), null);
  assert.equal(isInternshipDeadlineExpired('Rolling', ref), false);
  assert.equal(isInternshipDeadlineExpired('2026-06-14', ref), true);
  assert.equal(isInternshipDeadlineExpired('2026-06-15', ref), false); // End of day UTC
  assert.equal(isInternshipDeadlineExpired('2026-07-01', ref), false);
  assert.equal(getInternshipDaysRemaining('2026-06-20', ref), 6);
  assert.equal(getInternshipDaysRemaining('Rolling', ref), null);
});

test('validateInternshipApplicationUrl accepts official HTTPS/HTTP portals and blocks unsafe or placeholder URLs', () => {
  const valid = validateInternshipApplicationUrl('https://www.ncbs.res.in/academics/summer-fellowship');
  assert.equal(valid.valid, true);
  assert.equal(valid.domain, 'www.ncbs.res.in');

  assert.equal(validateInternshipApplicationUrl('javascript:alert(1)').valid, false);
  assert.equal(validateInternshipApplicationUrl('data:text/html,hi').valid, false);
  assert.equal(validateInternshipApplicationUrl('https://example.com/fake').valid, false);
  assert.equal(validateInternshipApplicationUrl('http://localhost:3000/apply').valid, false);
  assert.equal(validateInternshipApplicationUrl('not-a-url').valid, false);
  assert.equal(validateInternshipApplicationUrl('').valid, false);
});

test('filterInternships and sortInternshipsByUpcomingDeadline filter by category, location, paid/unpaid, mode, and expiry', () => {
  const ref = new Date('2026-06-15T00:00:00.000Z');
  const sample = [
    {
      id: 'i1',
      title: 'Structural Biology Summer Fellowship',
      organization: 'NCBS-TIFR',
      location: 'Bengaluru, Karnataka',
      mode: 'On-site Lab' as const,
      stipend: '₹18,000 / month',
      deadline: '2026-07-20',
      category: 'Summer Fellowship' as const,
      eligibility: 'M.Sc / B.Tech Biotechnology',
      description: 'Cryo-EM and protein purification fellowship.',
      skillsRequired: ['Protein Purification', 'Cryo-EM'],
      verificationStatus: 'Verified',
      isActive: true
    },
    {
      id: 'i2',
      title: 'Computational Genomics Dry-Lab Internship',
      organization: 'CSIR-IGIB',
      location: 'New Delhi',
      mode: 'Remote / Dry Lab' as const,
      stipend: 'Unpaid (Academic Credit)',
      deadline: '2026-06-25',
      category: 'Academic Dissertation' as const,
      eligibility: 'B.Tech Bioinformatics 4th Year',
      description: 'RNA-seq and variant calling workflows.',
      skillsRequired: ['Python', 'RNA-seq'],
      verificationStatus: 'Verified',
      isActive: true
    },
    {
      id: 'i3',
      title: 'Expired Bioprocess Training',
      organization: 'BioHub',
      location: 'Hyderabad, Telangana',
      mode: 'Hybrid' as const,
      stipend: '₹12,000 / month',
      deadline: '2026-05-01',
      category: 'Industrial R&D' as const,
      eligibility: 'M.Tech Bioprocess',
      description: 'Bioreactor scale-up internship.',
      skillsRequired: ['Bioreactor'],
      verificationStatus: 'Verified',
      isActive: true
    }
  ];

  // Excludes expired by default
  const activeOnly = filterInternships(sample, {}, ref);
  assert.deepEqual(activeOnly.map((i) => i.id), ['i1', 'i2']);

  // Sorting places nearer deadline first
  const sorted = sortInternshipsByUpcomingDeadline(activeOnly, ref);
  assert.deepEqual(sorted.map((i) => i.id), ['i2', 'i1']);

  // Include expired
  const withExpired = filterInternships(sample, { includeExpired: true }, ref);
  assert.equal(withExpired.length, 3);

  // Paid / unpaid filtering
  assert.deepEqual(filterInternships(sample, { compensation: 'paid' }, ref).map((i) => i.id), ['i1']);
  assert.deepEqual(filterInternships(sample, { compensation: 'unpaid' }, ref).map((i) => i.id), ['i2']);

  // Location & category & mode filtering
  assert.deepEqual(filterInternships(sample, { location: 'New Delhi' }, ref).map((i) => i.id), ['i2']);
  assert.deepEqual(filterInternships(sample, { category: 'Summer Fellowship' }, ref).map((i) => i.id), ['i1']);
  assert.deepEqual(filterInternships(sample, { mode: 'remote' }, ref).map((i) => i.id), ['i2']);

  // Distinct sorted locations
  assert.deepEqual(extractInternshipLocations(sample), [
    'Bengaluru, Karnataka',
    'Hyderabad, Telangana',
    'New Delhi'
  ]);
});

test('validateInternshipSubmissionPayload enforces required fields, URL safety, and Pending Verification governance', () => {
  const invalid = validateInternshipSubmissionPayload({
    title: 'Hi',
    organization: '',
    location: '',
    duration: '',
    eligibility: '',
    description: 'short',
    applicationUrl: 'https://example.com/fake',
    deadline: '2020-01-01'
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 5);

  const valid = validateInternshipSubmissionPayload({
    title: 'CRISPR Gene Editing Summer Internship',
    organization: 'CSIR-CCMB',
    location: 'Hyderabad, Telangana',
    mode: 'On-site Lab',
    stipend: '₹15,000 / month',
    duration: '8 Weeks',
    deadline: '2027-03-31',
    category: 'Summer Fellowship',
    eligibility: 'M.Sc Life Sciences / B.Tech Biotech',
    description: 'Hands-on training in CRISPR-Cas9 ribonucleoprotein delivery and amplicon sequencing.',
    applicationUrl: 'https://www.ccmb.res.in/training/summer-internship',
    skillsRequired: ['CRISPR', 'PCR']
  });

  assert.equal(valid.valid, true);
  assert.ok(valid.sanitized);
  // Strict governance invariant: never auto-verify or auto-approve
  assert.equal(valid.sanitized.verificationStatus, 'Pending Verification');
  assert.equal(valid.sanitized.isApproved, false);
  assert.equal(valid.sanitized.lastVerificationDate, '');
});

test('BionexaDatabase internship lifecycle: submit -> pending -> admin approve -> filter -> expire scan', () => {
  const db = new BionexaDatabase(':memory:');
  // 1. Public submission enters DB as Pending Verification & isApproved=false
  const validated = validateInternshipSubmissionPayload({
    title: 'Bioinformatics Transcriptomics Internship',
    organization: 'CSIR-IGIB',
    location: 'New Delhi',
    mode: 'Remote / Dry Lab',
    stipend: 'Unpaid',
    duration: '12 Weeks',
    deadline: '2027-06-30',
    category: 'Academic Dissertation',
    eligibility: 'Final year M.Sc Bioinformatics',
    description: 'Single-cell transcriptomics pipeline development and pathway enrichment analysis.',
    applicationUrl: 'https://www.igib.res.in/academics/internships',
    skillsRequired: ['Python', 'R', 'RNA-seq']
  });
  assert.equal(validated.valid, true);
  assert.ok(validated.sanitized);

  const created = db.createInternship({
    ...validated.sanitized,
    verificationNotes: '',
    featured: false,
    isApproved: false,
    isActive: true,
    verificationStatus: 'Pending Verification',
    lastVerificationDate: ''
  });

  assert.equal(created.isApproved, false);
  assert.equal(created.verificationStatus, 'Pending Verification');

  // Pending submission MUST NOT appear in public active listing
  const publicBeforeApproval = db.getInternships({ onlyApproved: true, onlyActive: true, includeExpired: false });
  assert.equal(publicBeforeApproval.some((i) => i.id === created.id), false);

  // Appears in admin dashboard list immediately
  const adminAll = db.getInternships({ onlyApproved: false, onlyActive: false, includeExpired: true });
  assert.equal(adminAll.some((i) => i.id === created.id), true);

  // 2. Admin verifies & approves internship
  const approved = db.updateInternship(created.id, {
    isApproved: true,
    isActive: true,
    verificationStatus: 'Verified',
    lastVerificationDate: new Date().toISOString()
  });
  assert.ok(approved);
  assert.equal(approved.verificationStatus, 'Verified');
  assert.equal(approved.isApproved, true);

  // Now visible via public filters (location + unpaid + remote)
  const filteredPublic = db.getInternships({
    onlyApproved: true,
    onlyActive: true,
    location: 'New Delhi',
    compensation: 'unpaid',
    mode: 'remote'
  });
  assert.equal(filteredPublic.some((i) => i.id === created.id), true);

  // 3. Past-deadline internship gets caught by expirePastDeadlineInternships
  const expiredItem = db.createInternship({
    title: 'Legacy Vaccine Assay Internship',
    organization: 'Serum Research Lab',
    location: 'Pune, Maharashtra',
    workMode: 'On-site Lab',
    stipend: '₹20,000 / month',
    duration: '3 Months',
    deadline: '2024-01-15',
    category: 'Industrial R&D',
    eligibility: 'M.Sc Microbiology',
    description: 'ELISA and potency assay internship for vaccine candidates.',
    learningOutcomes: ['Assay validation'],
    skillsRequired: ['ELISA'],
    sourceName: 'Serum Institute Careers',
    sourceUrl: 'https://www.seruminstitute.com/careers',
    applicationUrl: 'https://www.seruminstitute.com/careers',
    verificationStatus: 'Verified',
    verificationNotes: '',
    lastVerificationDate: '2024-01-01',
    featured: false,
    isApproved: true,
    isActive: true
  });

  const scanResult = db.expirePastDeadlineInternships(new Date('2026-06-01T00:00:00.000Z'));
  assert.ok(scanResult.expiredIds.includes(expiredItem.id));

  const refreshedExpired = db.getInternshipById(expiredItem.id);
  assert.ok(refreshedExpired);
  assert.equal(refreshedExpired.verificationStatus, 'Expired');
  assert.equal(refreshedExpired.isActive, false);

  // Excluded from default public listing, included when includeExpired=true
  const publicActiveAfterScan = db.getInternships({ onlyApproved: true, onlyActive: true, includeExpired: false });
  assert.equal(publicActiveAfterScan.some((i) => i.id === expiredItem.id), false);

  const publicWithExpired = db.getInternships({ onlyApproved: true, onlyActive: false, includeExpired: true });
  assert.equal(publicWithExpired.some((i) => i.id === expiredItem.id), true);
});
