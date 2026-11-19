import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  assert.ok(verified);
  assert.equal(verified?.verificationStatus, 'Verified');

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
    format: 'Hybrid',
    venue: 'New Delhi (Hybrid)',
    registrationDeadline: '2026-11-28',
    registrationLink: 'https://www.igib.res.in/',
    availability: 'Open (20 seats)',
    status: 'upcoming',
    fees: '₹1,500',
    duration: '3 Days',
    capacity: 30,
    featured: true,
    skillsCovered: ['gRNA design', 'Electroporation']
  });
  assert.equal(ws.id, 'test-ws-1');
  assert.deepEqual(ws.skillsCovered, ['gRNA design', 'Electroporation']);

  const workshops = db.getWorkshops();
  assert.equal(workshops.length, 1);
  assert.equal(workshops[0].name, 'Hands-on CRISPR Workshop');

  // Course (Phase 09)
  const course = db.createCourse({
    id: 'test-c-1',
    name: 'Industrial Bioprocessing Track',
    provider: 'NPTEL / Biocon Academy',
    description: 'Fermentation upscaling masterclass',
    duration: '16 Hours',
    fees: 'Free',
    eligibility: 'B.Sc / M.Sc Students',
    curriculum: ['Upstream', 'Downstream', 'QC'],
    deliveryMode: 'Online (Self-Paced)',
    certificateInfo: '',
    registrationDeadline: '2026-12-31',
    registrationLink: 'https://onlinecourses.nptel.ac.in/',
    availability: 'Available',
    status: 'available',
    instructor: 'Dr. Ramanathan',
    level: 'Advanced',
    category: 'Biotechnology',
    isCertificateAvailable: false,
    featured: true
  });
  assert.equal(course.id, 'test-c-1');
  assert.equal(course.name, 'Industrial Bioprocessing Track');
  assert.equal(course.provider, 'NPTEL / Biocon Academy');
  assert.equal(course.deliveryMode, 'Online (Self-Paced)');
  assert.equal(course.registrationDeadline, '2026-12-31');
  assert.equal(course.status, 'available');
  assert.deepEqual(course.curriculum, ['Upstream', 'Downstream', 'QC']);

  const courses = db.getCourses({ category: 'Biotechnology' });
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

test('BionexaDatabase manages submitted opportunities moderation lifecycle', () => {
  const db = new BionexaDatabase(':memory:');

  const created = db.createSubmittedOpportunity({
    title: 'CRISPR Core Scientist',
    organization: 'IGIB Lab',
    type: 'job',
    subCategory: 'Research',
    description: 'Gene editing core facility scientist.',
    location: 'New Delhi',
    workMode: 'On-site',
    experience: '2+ Years',
    qualification: 'M.Sc / Ph.D',
    branches: ['Genetic Engineering'],
    skills: ['CRISPR', 'NGS'],
    salaryOrStipend: '₹9,00,000 / yr',
    salaryTier: 'disclosed',
    deadline: '2026-12-15',
    sourceName: 'Direct Employer / Organizer Submission',
    sourceUrl: 'https://www.igib.res.in/careers',
    applicationUrl: 'https://www.igib.res.in/careers',
    contactEmail: 'hr@igib.res.in',
    workshopDetails: null,
  });

  assert.equal(created.isApproved, false);
  assert.equal(created.status, 'Pending Verification');
  assert.equal(db.getSubmittedOpportunities({ onlyApproved: true }).length, 0);
  assert.equal(db.getSubmittedOpportunities().length, 1);

  const approved = db.updateSubmittedOpportunity(created.id, {
    isApproved: true,
    status: 'Active',
  });
  assert.ok(approved);
  assert.equal(approved?.isApproved, true);
  assert.equal(approved?.status, 'Active');
  assert.equal(db.getSubmittedOpportunities({ onlyApproved: true }).length, 1);

  assert.equal(db.deleteSubmittedOpportunity(created.id), true);
  assert.equal(db.getSubmittedOpportunityById(created.id), null);
});

test('BionexaDatabase persists contact messages, newsletter subscribers, and certificates', () => {
  const db = new BionexaDatabase(':memory:');

  const msg = db.createContactMessage({
    name: 'Dr. Kavita Rao',
    email: 'kavita@biotech.org',
    subject: 'Workshop Listing Inquiry',
    message: 'Requesting verification of our upcoming PCR workshop.',
  });
  assert.ok(msg.referenceId.startsWith('BN-MSG-'));
  assert.equal(db.getContactMessages().length, 1);

  const sub1 = db.subscribeNewsletter('Researcher@Example.ORG');
  assert.equal(sub1.alreadySubscribed, false);
  assert.equal(sub1.subscriber.email, 'researcher@example.org');

  const sub2 = db.subscribeNewsletter('researcher@example.org');
  assert.equal(sub2.alreadySubscribed, true);
  assert.equal(db.getNewsletterSubscribers().length, 1);

  const cert = db.createCertificate({
    certificateNumber: 'BN-2026-TEST-1001',
    recipientName: 'Arjun Mehta',
    courseTitle: 'CRISPR Gene Editing Foundations',
    score: 92,
  });
  assert.equal(cert.certificateNumber, 'BN-2026-TEST-1001');
  const verifiedLower = db.verifyCertificate('bn-2026-test-1001');
  assert.ok(verifiedLower);
  assert.equal(verifiedLower?.recipientName, 'Arjun Mehta');
  assert.equal(db.verifyCertificate('NON-EXISTENT'), null);
});

test('BionexaDatabase manages job applications and community discussions', () => {
  const db = new BionexaDatabase(':memory:');

  const app = db.createJobApplication({
    jobId: 'job-1',
    jobTitle: 'Upstream Process Engineer',
    company: 'Biocon Biologics',
    applicantName: 'Neha Verma',
    applicantEmail: 'neha@bio.edu',
    phone: '+91-9876543210',
    qualification: 'M.Tech Biotechnology',
    experienceYears: '2 yrs',
    coverNote: 'Experienced with 50L fed-batch reactors.',
  });
  assert.equal(app.status, 'Under Review');
  assert.equal(db.getJobApplications().length, 1);

  const updatedApp = db.updateJobApplicationStatus(app.id, 'Shortlisted');
  assert.equal(updatedApp?.status, 'Shortlisted');

  const topic = db.createDiscussion({
    title: 'Troubleshooting T4 Ligase transformation efficiency',
    authorName: 'Rohan Das',
    authorRole: 'PhD Scholar',
    category: 'Wet Lab Protocols',
    content: 'Observing low colony count after PEG heat shock.',
  });
  assert.equal(topic.upvotes, 1);

  const reply = db.addDiscussionReply(topic.id, {
    authorName: 'Dr. Priya Nair',
    authorRole: 'Principal Scientist',
    content: 'Check ATP freshness in your T4 ligase buffer.',
  });
  assert.ok(reply);
  assert.equal(db.addDiscussionReply('missing-topic', { authorName: 'X', content: 'Y' }), null);

  const upvoted = db.upvoteDiscussion(topic.id);
  assert.equal(upvoted?.upvotes, 2);
  assert.equal(upvoted?.replies.length, 1);
});

test('BionexaDatabase persists admin users, sessions, revocations, login attempts, audit logs, and password resets', () => {
  const db = new BionexaDatabase(':memory:');

  const adminUser = db.upsertAdminUser({
    id: 'adm-test-1',
    username: 'ops@bio-inexa.org',
    email: 'ops@bio-inexa.org',
    displayName: 'Ops Lead',
    role: 'moderator',
    passwordHash: 'scrypt$N=32768,r=8,p=1$deadbeef$cafebabe',
  });
  assert.equal(adminUser.username, 'ops@bio-inexa.org');
  assert.equal(adminUser.role, 'moderator');

  db.createAdminSessionRecord({
    jti: 'jti-1',
    token: 'tok-alpha',
    adminUserId: adminUser.id,
    actorUsername: adminUser.username,
    role: adminUser.role,
    expiresAt: Date.now() + 60_000,
    ipAddress: '127.0.0.1',
  });
  db.createAdminSessionRecord({
    jti: 'jti-2',
    token: 'tok-beta',
    adminUserId: adminUser.id,
    actorUsername: adminUser.username,
    role: adminUser.role,
    expiresAt: Date.now() + 60_000,
    ipAddress: '127.0.0.2',
  });
  const validated1 = db.validateAdminSessionRecord('tok-alpha');
  assert.equal(validated1?.jti, 'jti-1');
  assert.equal(db.listActiveAdminSessions().length, 2);

  // Revoke all other sessions except jti-1
  const revokedOthers = db.revokeAllAdminSessions(adminUser.id, 'jti-1');
  assert.equal(revokedOthers, 1);
  assert.ok(db.validateAdminSessionRecord('tok-alpha'));
  assert.equal(db.validateAdminSessionRecord('tok-beta'), null);

  // Record login attempt + audit log
  db.recordLoginAttempt({
    identifier: '127.0.0.1',
    ipAddress: '127.0.0.1',
    attemptedUsername: 'ops@bio-inexa.org',
    success: false,
    failureReason: 'INVALID_CREDENTIALS',
  });
  assert.equal(db.getRecentLoginAttempts(10).length, 1);

  db.recordAdminAuditLog({
    adminUserId: adminUser.id,
    actorUsername: adminUser.username,
    action: 'ADMIN_LOGIN_FAILED',
    entityType: 'admin_auth',
    ipAddress: '127.0.0.1',
  });
  assert.equal(db.getAdminAuditLogs(10).length, 1);

  // Password reset token creation & single-use consumption revokes remaining sessions
  const rawToken = 'reset-secret-token-123';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  db.createPasswordResetRecord({
    adminUserId: adminUser.id,
    actorUsername: adminUser.username,
    tokenHash,
    expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
  });

  const consumed = db.consumePasswordResetToken(rawToken, 'scrypt$N=32768,r=8,p=1$new$hash');
  assert.equal(consumed.ok, true);
  assert.equal(db.validateAdminSessionRecord('tok-alpha'), null);

  // Replay fails
  const replayed = db.consumePasswordResetToken(rawToken, 'scrypt$N=32768,r=8,p=1$new$hash');
  assert.equal(replayed.ok, false);
});

test('BionexaDatabase manages internships CRUD, verification, sync history logs, and dashboard stats', () => {
  const db = new BionexaDatabase(':memory:');

  // 1. Create internship
  const intern = db.createInternship({
    id: 'test-intern-1',
    title: 'CRISPR Wet Lab Summer Trainee',
    organization: 'CSIR-IGIB New Delhi',
    location: 'New Delhi',
    workMode: 'On-site Lab',
    stipend: '₹15,000 / month',
    duration: '8 Weeks',
    deadline: '2026-12-20',
    category: 'Summer Fellowship',
    eligibility: 'M.Sc / B.Tech Biotechnology',
    description: 'Hands-on gRNA cloning and Sanger trace analysis.',
    learningOutcomes: ['Primer design', 'Plasmid prep'],
    skillsRequired: ['PCR', 'Molecular Cloning'],
    sourceName: 'IGIB Portal',
    sourceUrl: 'https://www.igib.res.in',
    applicationUrl: 'https://www.igib.res.in/careers',
    verificationStatus: 'Pending Verification',
    verificationNotes: '',
    lastVerificationDate: '',
    isApproved: false,
    isActive: true,
    featured: true,
  });

  assert.equal(intern.id, 'test-intern-1');
  assert.equal(intern.isVerified, false);
  // Hidden from public query when unapproved
  assert.equal(db.getInternships().length, 0);
  // Visible in admin query
  assert.equal(db.getAllInternshipsAdmin().length, 1);

  // 2. Verify & approve internship
  const verified = db.verifyInternship('test-intern-1', 'admin@bio-inexa.org', 'Verified', 'Official portal confirmed');
  assert.ok(verified);
  assert.equal(verified?.isVerified, true);
  assert.equal(verified?.isApproved, true);
  assert.equal(db.getInternships().length, 1);

  // 3. Record sync logs
  const log = db.recordSyncLog({
    sourceId: 'feed-dbt-csir',
    sourceName: 'DBT & CSIR National Scientific Gazettes',
    status: 'Success',
    itemsFetched: 5,
    itemsAdded: 2,
    itemsExpired: 1,
    details: 'Synced clean.',
  });
  assert.equal(log.itemsAdded, 2);
  assert.equal(db.getSyncLogs(10).length, 1);

  // 4. Live dashboard stats match exact DB rows
  const stats = db.getDashboardStats();
  assert.equal(stats.totalInternships, 1);
  assert.equal(stats.verifiedInternships, 1);
  assert.equal(stats.activeInternships, 1);
  assert.equal(stats.syncRunsCount, 1);

  // 5. Reject & delete internship
  const rejected = db.verifyInternship('test-intern-1', 'admin@bio-inexa.org', 'Rejected', 'Program paused');
  assert.equal(rejected?.verificationStatus, 'Rejected');
  assert.equal(rejected?.isActive, false);
  assert.equal(db.getInternships().length, 0);

  assert.equal(db.deleteInternship('test-intern-1'), true);
  assert.equal(db.getInternshipById('test-intern-1'), null);
});


