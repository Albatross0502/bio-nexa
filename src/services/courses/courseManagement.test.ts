import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_CATEGORIES,
  COURSE_DELIVERY_MODES,
  classifyCoursePricing,
  extractCourseCategories,
  filterCourses,
  getDefaultCourseImageForCategory,
  isCourseExpired,
  isCourseRegistrationClosed,
  isValidCourseImageUrl,
  isValidCourseRegistrationUrl,
  mapApiCourseToUnified,
  mapUnifiedCourseToOpportunity,
  normalizeCourseApprovalStatus,
  normalizeCourseCategory,
  normalizeCourseProviderType,
  normalizeCourseStatus,
  normalizeDeliveryMode,
  parseCurriculumInput,
  resolveCourseCategory,
  validateCourseRegistrationUrl,
  validateCourseSubmissionPayload
} from './courseHelpers';
import { BionexaDatabase } from '../../db/bionexaDatabase';

const EXPECTED_CATEGORIES = [
  'Biotechnology',
  'Microbiology',
  'Molecular Biology',
  'Bioinformatics',
  'Genetics',
  'Pharmaceutical Sciences',
  'Clinical Research',
  'Laboratory Techniques',
  'Research Methodology'
];

test('COURSE_CATEGORIES contains all 9 canonical categories', () => {
  assert.deepEqual([...COURSE_CATEGORIES], EXPECTED_CATEGORIES);
  assert.equal(COURSE_DELIVERY_MODES.length, 4);
});

test('Strict Course URL & image validation blocks empty, relative, script, localhost, and example.com links', () => {
  const validNptel = validateCourseRegistrationUrl('https://onlinecourses.nptel.ac.in/noc26_bt01');
  assert.equal(validNptel.valid, true);
  assert.equal(validNptel.domain, 'onlinecourses.nptel.ac.in');

  assert.equal(isValidCourseRegistrationUrl('http://ebi.ac.uk/training'), true);
  assert.equal(isValidCourseRegistrationUrl(''), false);
  assert.equal(isValidCourseRegistrationUrl('#'), false);
  assert.equal(isValidCourseRegistrationUrl('/courses/course-1'), false);
  assert.equal(isValidCourseRegistrationUrl('javascript:alert(1)'), false);
  assert.equal(isValidCourseRegistrationUrl('https://example.com/fake-course'), false);
  assert.equal(isValidCourseRegistrationUrl('https://sub.example.org/course'), false);
  assert.equal(isValidCourseRegistrationUrl('http://localhost:3000/course'), false);
  assert.equal(isValidCourseRegistrationUrl('http://127.0.0.1/course'), false);

  assert.equal(isValidCourseImageUrl('/uploads/courses/course-123.png'), true);
  assert.equal(isValidCourseImageUrl('/assets/img/logo.jpeg'), true);
  assert.equal(isValidCourseImageUrl('https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800'), true);
  assert.equal(isValidCourseImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isValidCourseImageUrl('not-a-valid-url'), false);
});

test('Category, pricing, provider provenance, approval, status, delivery mode, and curriculum helpers work consistently', () => {
  assert.equal(normalizeCourseCategory('Microbiology'), 'Microbiology');
  assert.equal(normalizeCourseCategory('Molecular Biology & CRISPR'), 'Molecular Biology');
  assert.equal(normalizeCourseCategory('Bioinformatics & NGS'), 'Bioinformatics');
  assert.equal(normalizeCourseCategory('QC & Regulatory Pharma'), 'Pharmaceutical Sciences');
  assert.equal(normalizeCourseCategory('Unknown Category'), 'Biotechnology');

  assert.equal(resolveCourseCategory('Synthetic Biology', ['Synthetic Biology']), 'Synthetic Biology');
  assert.equal(resolveCourseCategory('microbiology', ['Synthetic Biology']), 'Microbiology');
  const merged = extractCourseCategories([{ category: 'Immunology' }], ['Synthetic Biology']);
  assert.ok(merged.includes('Synthetic Biology'));
  assert.ok(merged.includes('Immunology'));
  assert.ok(merged.includes('Biotechnology'));

  assert.equal(classifyCoursePricing('Free online access'), 'free');
  assert.equal(classifyCoursePricing('₹0 (Open Access)'), 'free');
  assert.equal(classifyCoursePricing('₹4,500'), 'paid');
  assert.equal(classifyCoursePricing('₹1,200', 'free'), 'free');
  assert.equal(classifyCoursePricing('Free', 'paid'), 'paid');

  assert.equal(normalizeCourseProviderType('bionexa'), 'bionexa');
  assert.equal(normalizeCourseProviderType('BIO-INEXA'), 'bionexa');
  assert.equal(normalizeCourseProviderType('third_party'), 'third_party');
  assert.equal(normalizeCourseProviderType(undefined), 'third_party');

  assert.equal(normalizeCourseApprovalStatus('pending'), 'pending');
  assert.equal(normalizeCourseApprovalStatus('rejected'), 'rejected');
  assert.equal(normalizeCourseApprovalStatus(undefined, false), 'pending');
  assert.equal(normalizeCourseApprovalStatus('approved', true), 'approved');

  assert.equal(normalizeCourseStatus('available'), 'available');
  assert.equal(normalizeCourseStatus('active'), 'available');
  assert.equal(normalizeCourseStatus('closed'), 'closed');
  assert.equal(normalizeCourseStatus('active', 'Closed'), 'closed');

  assert.equal(normalizeDeliveryMode('Live Virtual Cohort'), 'Online (Live Cohort)');
  assert.equal(normalizeDeliveryMode('Hybrid'), 'Hybrid');
  assert.equal(normalizeDeliveryMode('Offline Campus'), 'In-Person');
  assert.equal(normalizeDeliveryMode('Self-paced'), 'Online (Self-Paced)');

  assert.deepEqual(parseCurriculumInput('Module 1\n  Module 2  \n\nModule 3'), [
    'Module 1',
    'Module 2',
    'Module 3'
  ]);
  assert.deepEqual(parseCurriculumInput([' A ', '', 'B']), ['A', 'B']);
});

test('isCourseExpired and isCourseRegistrationClosed detect past YYYY-MM-DD and readable deadlines accurately', () => {
  const refNow = new Date('2026-11-14T12:00:00Z');
  assert.equal(isCourseExpired({ registrationDeadline: '2026-10-01' }, refNow), true);
  assert.equal(isCourseExpired({ registrationDeadline: '2026-12-31' }, refNow), false);
  assert.equal(isCourseExpired({ registrationDeadline: 'Open / Rolling' }, refNow), false);
  assert.equal(isCourseExpired({ registrationDeadline: '10 October 2026' }, refNow), true);

  assert.equal(isCourseRegistrationClosed({ status: 'closed', registrationDeadline: '2026-12-31' }, refNow), true);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: '2026-10-01' }, refNow), true);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: '2026-12-31' }, refNow), false);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: 'Open / Rolling' }, refNow), false);
});

test('validateCourseSubmissionPayload forces third_party provenance, pending approval, and rejects placeholder URLs', () => {
  const invalid = validateCourseSubmissionPayload({
    title: 'Fake Course',
    provider: 'Unknown Org',
    description: 'Attempting to submit an example.com placeholder URL.',
    duration: '4 Weeks',
    fees: 'Free',
    registrationUrl: 'https://example.com/enroll'
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((e) => e.toLowerCase().includes('placeholder')));

  const valid = validateCourseSubmissionPayload({
    title: 'Single-Cell Transcriptomics Analysis',
    provider: 'EMBL-EBI Training',
    category: 'Bioinformatics',
    description: 'Comprehensive workflow for scRNA-seq quality control, clustering, and trajectory inference.',
    duration: '6 Weeks',
    fees: 'Free',
    certificateInfo: '',
    registrationUrl: 'https://www.ebi.ac.uk/training/online/courses/single-cell'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized?.providerType, 'third_party');
  assert.equal(valid.sanitized?.approvalStatus, 'pending');
  assert.equal(valid.sanitized?.isApproved, false);
  assert.equal(valid.sanitized?.featured, false);
  assert.equal(valid.sanitized?.pricingType, 'free');
  assert.equal(valid.sanitized?.isCertificateAvailable, false);
});

test('filterCourses and API/Opportunity mapping preserve provenance, pricing, and specs without fabricating claims', () => {
  const mappedOpen = mapApiCourseToUnified({
    id: 'c-101',
    title: 'Applied Genetics & Genomics',
    provider: 'NPTEL / IIT Madras',
    providerType: 'third_party',
    category: 'Genetics',
    description: 'Quantitative and Mendelian genetics course.',
    duration: '12 Weeks',
    eligibility: 'B.Sc / M.Sc Students',
    curriculum: ['Linkage Mapping', 'Population Genetics'],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free online learning',
    certificateInfo: '',
    registrationDeadline: '2027-12-31',
    registrationUrl: 'https://onlinecourses.nptel.ac.in/',
    status: 'available',
    approvalStatus: 'approved',
    isApproved: true,
    featured: true
  });

  assert.equal(mappedOpen.certificateInfo, '');
  assert.equal(mappedOpen.isCertificateAvailable, false);
  assert.equal(mappedOpen.providerType, 'third_party');
  assert.equal(mappedOpen.pricingType, 'free');
  assert.equal(mappedOpen.imageUrl, getDefaultCourseImageForCategory('Genetics'));

  const mappedPaidClosed = mapApiCourseToUnified({
    id: 'c-102',
    title: 'Clinical Research Ethics',
    provider: 'NPTEL / ICMR-NIE',
    providerType: 'third_party',
    category: 'Clinical Research',
    description: 'GCP & clinical trial oversight.',
    duration: '8 Weeks',
    eligibility: 'Life Science Graduates',
    curriculum: ['ICH-GCP Guidelines'],
    deliveryMode: 'Online (Self-Paced)',
    fees: '₹4,500',
    pricingType: 'paid',
    certificateInfo: 'Optional paid exam certificate by provider',
    registrationDeadline: '2027-12-20',
    registrationUrl: 'https://swayam.gov.in/',
    status: 'closed',
    approvalStatus: 'approved',
    isApproved: true,
    featured: false
  });

  const featuredOnly = filterCourses([mappedOpen, mappedPaidClosed], { onlyFeatured: true });
  assert.equal(featuredOnly.length, 1);
  assert.equal(featuredOnly[0].id, 'c-101');

  const freeOnly = filterCourses([mappedOpen, mappedPaidClosed], { pricingType: 'free' });
  assert.equal(freeOnly.length, 1);
  assert.equal(freeOnly[0].id, 'c-101');

  const paidOnly = filterCourses([mappedOpen, mappedPaidClosed], { pricingType: 'paid' });
  assert.equal(paidOnly.length, 1);
  assert.equal(paidOnly[0].id, 'c-102');

  const closedOnly = filterCourses([mappedOpen, mappedPaidClosed], { status: 'closed' });
  assert.equal(closedOnly.length, 1);
  assert.equal(closedOnly[0].id, 'c-102');

  const oppOpen = mapUnifiedCourseToOpportunity(mappedOpen);
  const oppClosed = mapUnifiedCourseToOpportunity(mappedPaidClosed);
  assert.equal(oppOpen.status, 'Open');
  assert.equal(oppOpen.courseDetails?.providerType, 'third_party');
  assert.equal(oppOpen.courseDetails?.pricingType, 'free');
  assert.equal(oppOpen.courseDetails?.certificateAvailable, false);
  assert.equal(oppClosed.status, 'Closed');
  assert.equal(oppClosed.courseDetails?.pricingType, 'paid');
  assert.equal(oppClosed.courseDetails?.certificateAvailable, true);
});

test('BionexaDatabase supports Phase 13 Course CRUD, approval workflow, pricing/provider filtering, auto-expiry, and category management', () => {
  const db = new BionexaDatabase(':memory:');

  // Custom category management
  const initialCategories = db.getCourseCategories();
  assert.equal(initialCategories.length, 9);
  const afterAdd = db.addCourseCategory('Synthetic Biology', 'admin');
  assert.ok(afterAdd.includes('Synthetic Biology'));
  const coreRemoveAttempt = db.removeCourseCategory('Biotechnology', 'admin');
  assert.equal(coreRemoveAttempt.removed, false);
  assert.ok(coreRemoveAttempt.categories.includes('Biotechnology'));

  // Create pending third-party course
  const pendingCourse = db.createCourse({
    id: 'db-course-pending',
    name: 'Synthetic Circuit Design',
    provider: 'IISc Bengaluru Open Courseware',
    providerType: 'third_party',
    description: 'Design and modeling of synthetic genetic circuits in prokaryotes.',
    duration: '8 Weeks',
    fees: 'Free online access',
    pricingType: 'free',
    eligibility: 'M.Sc / Ph.D Scholars',
    curriculum: ['Toggle Switches', 'Repressilators'],
    deliveryMode: 'Online (Self-Paced)',
    certificateInfo: '',
    registrationDeadline: '2027-12-25',
    registrationLink: 'https://iisc.ac.in/courses/synthetic-biology',
    availability: 'Available',
    status: 'available',
    approvalStatus: 'pending',
    isApproved: false,
    instructor: 'Faculty Team',
    level: 'Intermediate',
    category: 'Synthetic Biology',
    imageUrl: '/uploads/courses/sample.png',
    isCertificateAvailable: false,
    featured: false
  });

  assert.equal(pendingCourse.approvalStatus, 'pending');
  assert.equal(pendingCourse.isApproved, false);
  assert.equal(pendingCourse.providerType, 'third_party');
  assert.equal(pendingCourse.pricingType, 'free');

  // Public query (onlyApproved: true) hides pending course
  assert.equal(db.getCourses({ onlyApproved: true }).length, 0);
  assert.equal(db.getCourses({ approvalStatus: 'pending' }).length, 1);

  // Admin approves course -> now visible publicly
  const approved = db.updateCourse('db-course-pending', {
    approvalStatus: 'approved',
    isApproved: true,
    featured: true
  });
  assert.equal(approved?.isApproved, true);
  assert.equal(approved?.approvalStatus, 'approved');
  assert.equal(db.getCourses({ onlyApproved: true, category: 'Synthetic Biology' }).length, 1);
  assert.equal(db.getCourses({ onlyApproved: true, pricingType: 'free' }).length, 1);
  assert.equal(db.getCourses({ onlyApproved: true, pricingType: 'paid' }).length, 0);

  // Create an initially active approved paid course and advance referenceDate past its deadline
  db.createCourse({
    id: 'db-course-expired',
    name: 'Legacy Proteomics Batch',
    provider: 'IBAB Bengaluru',
    providerType: 'third_party',
    description: 'Cohort proteomics certification program.',
    duration: '6 Weeks',
    fees: '₹6,000',
    pricingType: 'paid',
    eligibility: 'Life Science Graduates',
    curriculum: ['LC-MS/MS Basics'],
    deliveryMode: 'Hybrid',
    certificateInfo: 'IBAB Completion Certificate',
    registrationDeadline: '2027-03-15',
    registrationLink: 'https://www.ibab.ac.in/courses/proteomics',
    availability: 'Available',
    status: 'available',
    approvalStatus: 'approved',
    isApproved: true,
    instructor: '',
    level: 'Advanced',
    category: 'Bioinformatics',
    imageUrl: '',
    isCertificateAvailable: true,
    featured: false
  });

  const scanRes = db.expirePastCourses(new Date('2027-04-01T00:00:00Z'));
  assert.equal(scanRes.expiredCount, 1);
  assert.deepEqual(scanRes.expiredIds, ['db-course-expired']);
  const expiredRow = db.getCourseById('db-course-expired');
  assert.equal(expiredRow?.status, 'closed');
  assert.equal(expiredRow?.availability, 'Expired');

  // includeExpired: false hides expired course when deadline is in the past
  db.updateCourse('db-course-expired', { registrationDeadline: '2024-01-15' });
  const activeOnly = db.getCourses({ onlyApproved: true, includeExpired: false });
  assert.equal(activeOnly.length, 1);
  assert.equal(activeOnly[0].id, 'db-course-pending');

  // Remove custom category & clean up
  const afterRemove = db.removeCourseCategory('Synthetic Biology', 'admin');
  assert.equal(afterRemove.removed, true);
  assert.ok(!afterRemove.categories.includes('Synthetic Biology'));

  assert.equal(db.deleteCourse('db-course-pending'), true);
  assert.equal(db.deleteCourse('db-course-expired'), true);
  assert.equal(db.getCourseById('db-course-pending'), null);
});
