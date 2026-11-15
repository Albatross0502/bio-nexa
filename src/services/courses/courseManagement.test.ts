import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_CATEGORIES,
  COURSE_DELIVERY_MODES,
  filterCourses,
  getDefaultCourseImageForCategory,
  isCourseRegistrationClosed,
  isValidCourseImageUrl,
  isValidCourseRegistrationUrl,
  mapApiCourseToUnified,
  mapUnifiedCourseToOpportunity,
  normalizeCourseCategory,
  normalizeCourseStatus,
  normalizeDeliveryMode,
  parseCurriculumInput
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

test('COURSE_CATEGORIES contains all 9 required Phase 09 categories', () => {
  assert.deepEqual([...COURSE_CATEGORIES], EXPECTED_CATEGORIES);
  assert.equal(COURSE_DELIVERY_MODES.length, 4);
});

test('Course URL & image validation blocks empty, relative, or invalid links', () => {
  assert.equal(isValidCourseRegistrationUrl('https://onlinecourses.nptel.ac.in/'), true);
  assert.equal(isValidCourseRegistrationUrl('http://ebi.ac.uk/training'), true);
  assert.equal(isValidCourseRegistrationUrl(''), false);
  assert.equal(isValidCourseRegistrationUrl('#'), false);
  assert.equal(isValidCourseRegistrationUrl('/courses/course-1'), false);
  assert.equal(isValidCourseRegistrationUrl('javascript:alert(1)'), false);

  assert.equal(isValidCourseImageUrl('/uploads/courses/course-123.png'), true);
  assert.equal(isValidCourseImageUrl('/assets/img/logo.jpeg'), true);
  assert.equal(isValidCourseImageUrl('https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800'), true);
  assert.equal(isValidCourseImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isValidCourseImageUrl('not-a-valid-url'), false);
});

test('Category, status, delivery mode, and curriculum helpers normalize consistently', () => {
  assert.equal(normalizeCourseCategory('Microbiology'), 'Microbiology');
  assert.equal(normalizeCourseCategory('Molecular Biology & CRISPR'), 'Molecular Biology');
  assert.equal(normalizeCourseCategory('Bioinformatics & NGS'), 'Bioinformatics');
  assert.equal(normalizeCourseCategory('QC & Regulatory Pharma'), 'Pharmaceutical Sciences');
  assert.equal(normalizeCourseCategory('Unknown Category'), 'Biotechnology');

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

test('isCourseRegistrationClosed checks status and past YYYY-MM-DD deadline accurately', () => {
  const refNow = new Date('2026-11-14T12:00:00Z');
  assert.equal(isCourseRegistrationClosed({ status: 'closed', registrationDeadline: '2026-12-31' }, refNow), true);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: '2026-10-01' }, refNow), true);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: '2026-12-31' }, refNow), false);
  assert.equal(isCourseRegistrationClosed({ status: 'available', registrationDeadline: 'Open / Rolling' }, refNow), false);
});

test('filterCourses and API/Opportunity mapping preserve all specs without fabricating claims', () => {
  const mappedOpen = mapApiCourseToUnified({
    id: 'c-101',
    title: 'Applied Genetics & Genomics',
    provider: 'NPTEL / IIT Madras',
    category: 'Genetics',
    description: 'Quantitative and Mendelian genetics course.',
    duration: '12 Weeks',
    eligibility: 'B.Sc / M.Sc Students',
    curriculum: ['Linkage Mapping', 'Population Genetics'],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free online learning',
    certificateInfo: '',
    registrationDeadline: '2026-12-31',
    registrationUrl: 'https://onlinecourses.nptel.ac.in/',
    status: 'available',
    featured: true
  });

  assert.equal(mappedOpen.certificateInfo, '');
  assert.equal(mappedOpen.isCertificateAvailable, false);
  assert.equal(mappedOpen.imageUrl, getDefaultCourseImageForCategory('Genetics'));

  const mappedClosed = mapApiCourseToUnified({
    id: 'c-102',
    title: 'Clinical Research Ethics',
    provider: 'NPTEL / ICMR-NIE',
    category: 'Clinical Research',
    description: 'GCP & clinical trial oversight.',
    duration: '8 Weeks',
    eligibility: 'Life Science Graduates',
    curriculum: ['ICH-GCP Guidelines'],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free access',
    certificateInfo: 'Optional paid exam certificate by provider',
    registrationDeadline: '2026-12-20',
    registrationUrl: 'https://swayam.gov.in/',
    status: 'closed',
    featured: false
  });

  const featuredOnly = filterCourses([mappedOpen, mappedClosed], { onlyFeatured: true });
  assert.equal(featuredOnly.length, 1);
  assert.equal(featuredOnly[0].id, 'c-101');

  const closedOnly = filterCourses([mappedOpen, mappedClosed], { status: 'closed' });
  assert.equal(closedOnly.length, 1);
  assert.equal(closedOnly[0].id, 'c-102');

  const oppOpen = mapUnifiedCourseToOpportunity(mappedOpen);
  const oppClosed = mapUnifiedCourseToOpportunity(mappedClosed);
  assert.equal(oppOpen.status, 'Open');
  assert.equal(oppOpen.courseDetails?.certificateAvailable, false);
  assert.equal(oppClosed.status, 'Closed');
  assert.equal(oppClosed.courseDetails?.certificateAvailable, true);
});

test('BionexaDatabase supports full Phase 09 Course CRUD, filtering, featuring, and available/closed updates', () => {
  const db = new BionexaDatabase(':memory:');

  const created = db.createCourse({
    id: 'db-course-1',
    name: 'Biostatistics & Research Methodology',
    provider: 'NPTEL / IIT',
    description: 'Experimental design and statistical inference in life sciences.',
    duration: '8 Weeks',
    fees: 'Free online access',
    eligibility: 'M.Sc / Ph.D Scholars',
    curriculum: ['ANOVA', 'Regression Modeling', 'Manuscript Reporting'],
    deliveryMode: 'Online (Self-Paced)',
    certificateInfo: '',
    registrationDeadline: '2026-12-25',
    registrationLink: 'https://onlinecourses.nptel.ac.in/',
    availability: 'Available',
    status: 'available',
    instructor: 'Faculty Team',
    level: 'Intermediate',
    category: 'Research Methodology',
    imageUrl: '/uploads/courses/sample.png',
    isCertificateAvailable: false,
    featured: false
  });

  assert.equal(created.id, 'db-course-1');
  assert.equal(created.provider, 'NPTEL / IIT');
  assert.equal(created.status, 'available');
  assert.equal(created.isCertificateAvailable, false);
  assert.equal(created.featured, false);

  const byCat = db.getCourses({ category: 'Research Methodology' });
  assert.equal(byCat.length, 1);

  const updated = db.updateCourse('db-course-1', {
    status: 'closed',
    featured: true,
    fees: '₹1,000 exam fee (optional)'
  });
  assert.equal(updated?.status, 'closed');
  assert.equal(updated?.availability, 'Closed');
  assert.equal(updated?.featured, true);
  assert.equal(db.getCourses({ status: 'closed' }).length, 1);
  assert.equal(db.getCourses({ featured: true }).length, 1);

  assert.equal(db.deleteCourse('db-course-1'), true);
  assert.equal(db.getCourseById('db-course-1'), null);
});
