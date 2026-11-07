import test from 'node:test';
import assert from 'node:assert/strict';
import { BionexaDatabase } from './bionexaDatabase.js';

test('BionexaDatabase initializes tables and manages Job lifecycle', () => {
  const db = new BionexaDatabase(':memory:');

  // 1. Create a job
  const job = db.createJob({
    id: 'test-job-1',
    title: 'Senior Bioinformatics Specialist',
    employer: 'National Genomics Center',
    description: 'Lead high-throughput RNA-Seq analysis',
    location: 'Bengaluru, Karnataka',
    qualification: 'M.Sc / Ph.D in Bioinformatics',
    skills: ['Python', 'Bioconductor', 'Nextflow'],
    employmentType: 'Full-time',
    salary: '₹12,00,000 / yr',
    applicationUrl: 'https://genomics.res.in/careers',
    source: 'Official Bulletin',
    publicationDate: '2026-11-01',
    expiryDate: '2026-12-31',
    verificationStatus: 'Verified',
    isActive: true,
    isApproved: true,
    featured: true,
    responsibilities: ['Pipeline development'],
    requirements: ['3+ years in genomics'],
    sector: 'Government / Autonomous'
  });

  assert.equal(job.id, 'test-job-1');
  assert.equal(job.title, 'Senior Bioinformatics Specialist');
  assert.deepEqual(job.skills, ['Python', 'Bioconductor', 'Nextflow']);

  // 2. Query jobs
  const jobs = db.getJobs({ search: 'Bioinformatics' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].employer, 'National Genomics Center');

  // 3. Update job
  const updated = db.updateJob('test-job-1', {
    salary: '₹14,00,000 / yr',
    location: 'Bengaluru / Hybrid'
  });
  assert.equal(updated?.salary, '₹14,00,000 / yr');
  assert.equal(updated?.location, 'Bengaluru / Hybrid');

  // 4. Verify job with audit record
  const verified = db.verifyJob('test-job-1', 'admin@bionexa.org', 'Verified', 'Verified with HR department');
  assert.equal(verified, true);

  const auditRecords = db.getVerificationRecords('test-job-1');
  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0].verifiedBy, 'admin@bionexa.org');
  assert.equal(auditRecords[0].sourceStatus, 'Verified');

  // 5. Delete job
  const deleted = db.deleteJob('test-job-1');
  assert.equal(deleted, true);
  assert.equal(db.getJobById('test-job-1'), null);
});

test('BionexaDatabase manages Workshops and Courses', () => {
  const db = new BionexaDatabase(':memory:');

  // Workshop
  const ws = db.createWorkshop({
    id: 'test-ws-1',
    name: 'Hands-on CRISPR Workshop',
    description: 'Laboratory guide to ribonucleoprotein editing',
    instructor: 'Dr. Sen',
    date: '2026-12-01',
    time: '09:00 AM - 05:00 PM',
    venue: 'New Delhi (Hybrid)',
    registrationLink: 'https://bionexa.org/ws-crispr',
    availability: 'Open (20 seats)',
    status: 'active',
    fees: '₹1,500',
    duration: '3 Days',
    capacity: 30,
    skillsCovered: ['gRNA design', 'Electroporation']
  });
  assert.equal(ws.id, 'test-ws-1');
  assert.deepEqual(ws.skillsCovered, ['gRNA design', 'Electroporation']);

  const workshops = db.getWorkshops();
  assert.equal(workshops.length, 1);
  assert.equal(workshops[0].name, 'Hands-on CRISPR Workshop');

  // Course
  const course = db.createCourse({
    id: 'test-c-1',
    name: 'Industrial Bioprocessing Track',
    description: 'Fermentation upscaling masterclass',
    duration: '16 Hours',
    fees: 'Free',
    eligibility: 'B.Sc / M.Sc Students',
    curriculum: ['Upstream', 'Downstream', 'QC'],
    registrationLink: 'https://bionexa.org/courses/bioprocess',
    availability: 'Immediate Access',
    status: 'active',
    instructor: 'Dr. Ramanathan',
    level: 'Advanced',
    category: 'Bioprocess & Fermentation',
    isCertificateAvailable: true,
    featured: true
  });
  assert.equal(course.id, 'test-c-1');
  assert.equal(course.name, 'Industrial Bioprocessing Track');
  assert.deepEqual(course.curriculum, ['Upstream', 'Downstream', 'QC']);

  const courses = db.getCourses();
  assert.equal(courses.length, 1);
});

test('BionexaDatabase creates point-in-time database backups', () => {
  const db = new BionexaDatabase(':memory:');
  const backup = db.createBackup();

  assert.equal(backup.success, true);
  assert.ok(backup.filename.startsWith('bionexa_backup_'));

  const backups = db.listBackups();
  assert.equal(backups.length, 1);
  assert.equal(backups[0].status, 'completed');
});
