import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CompanyAuthRateLimiter,
  COMPANY_RESET_TOKEN_TTL_MS,
  COMPANY_SESSION_TTL_MS,
  COMPANY_VERIFY_TOKEN_TTL_MS,
  generateOpaqueToken,
  getCompanyPermissions,
  hashCompanyPassword,
  hashOpaqueToken,
  hasCompanyPermission,
  isCompanyAllowedAdminPermission,
  resolveEmployerJobSubmissionPolicy,
  toSafeCompanyProfile,
  validateCompanyJobInput,
  validateCompanyProfileUpdateInput,
  validateCompanyRegistrationInput,
  validateEmployerVerificationSubmission,
  verifyCompanyPassword,
} from './companyAuthService';
import { parseRoute } from '../../utils/routeMatcher';
import { BionexaDatabase } from '../../db/bionexaDatabase';

test('Phase 15: salted scrypt password hashing and verification', () => {
  const hash1 = hashCompanyPassword('HelixBio#2026!Secure');
  const hash2 = hashCompanyPassword('HelixBio#2026!Secure');

  assert.notEqual(hash1, hash2, 'Salted hashes must be unique per invocation');
  assert.equal(verifyCompanyPassword('HelixBio#2026!Secure', hash1), true);
  assert.equal(verifyCompanyPassword('WrongPassword#2026!', hash1), false);
});

test('Phase 15: company registration, profile, verification, and job destination validation', () => {
  // Missing consent & bad website fail
  const badReg = validateCompanyRegistrationInput({
    contactName: 'Dr. Kavitha Rao',
    email: 'hr@helixgen.in',
    password: 'StrongPassword#2026!',
    organizationName: 'HelixGen Labs',
    officialWebsite: 'https://example.com/fake',
    headquartersLocation: 'Bengaluru',
    privacyConsentAccepted: false,
  });
  assert.equal(badReg.valid, false);

  const validReg = validateCompanyRegistrationInput({
    contactName: 'Dr. Kavitha Rao',
    contactTitle: 'VP Scientific Talent',
    email: 'HR@HelixGen.IN',
    password: 'StrongPassword#2026!',
    organizationName: 'HelixGen Diagnostics Pvt Ltd',
    organizationType: 'Diagnostics & CRO',
    officialWebsite: 'https://helixgen.in',
    headquartersLocation: 'Bengaluru, Karnataka',
    foundedYear: '2019',
    privacyConsentAccepted: true,
  });
  assert.equal(validReg.valid, true);
  assert.equal(validReg.value?.email, 'hr@helixgen.in');

  // Profile update rejects invalid LinkedIn domain
  const badProfile = validateCompanyProfileUpdateInput({
    linkedinUrl: 'https://not-linkedin.example/company/helixgen',
  });
  assert.equal(badProfile.valid, false);

  const goodProfile = validateCompanyProfileUpdateInput({
    linkedinUrl: 'https://www.linkedin.com/company/helixgen-diagnostics',
    defaultApplicationDestinationType: 'email',
    defaultApplicationEmail: 'careers@helixgen.in',
  });
  assert.equal(goodProfile.valid, true);
  assert.equal(goodProfile.value?.defaultApplicationDestinationType, 'email');

  // Employer verification requires registration identifier OR evidence URL + >=15 char notes
  const badVerify = validateEmployerVerificationSubmission({
    officialWebsite: 'https://helixgen.in',
    verificationNotes: 'Too short',
  });
  assert.equal(badVerify.valid, false);

  const missingEvidenceVerify = validateEmployerVerificationSubmission({
    officialWebsite: 'https://helixgen.in',
    verificationNotes: 'Authorized HR lead submitting employer verification details.',
  });
  assert.equal(missingEvidenceVerify.valid, false);

  const goodVerify = validateEmployerVerificationSubmission({
    officialWebsite: 'https://helixgen.in',
    registrationIdentifier: 'CIN-U73100KA2019PTC123456',
    verificationEvidenceUrl: 'https://helixgen.in/careers',
    verificationNotes: 'Authorized HR director at HelixGen Diagnostics Bengaluru.',
  });
  assert.equal(goodVerify.valid, true);

  // Job destination validation across external_url, email, and bionexa_portal
  const externalJobBad = validateCompanyJobInput({
    title: 'Senior Genomics Scientist',
    location: 'Bengaluru',
    deadline: '2027-06-30',
    description: 'Lead NGS assay development and clinical bioinformatics validation.',
    applicationDestinationType: 'external_url',
    applicationUrl: 'https://localhost:3000/bad',
  });
  assert.equal(externalJobBad.valid, false);

  const externalJobOk = validateCompanyJobInput({
    title: 'Senior Genomics Scientist',
    location: 'Bengaluru',
    deadline: '2027-06-30',
    description: 'Lead NGS assay development and clinical bioinformatics validation.',
    applicationDestinationType: 'external_url',
    applicationUrl: 'https://helixgen.in/careers/genomics-scientist',
    skills: 'NGS, Python, Variant Calling',
  });
  assert.equal(externalJobOk.valid, true);
  assert.deepEqual(externalJobOk.value?.skills, ['NGS', 'Python', 'Variant Calling']);

  const emailJobOk = validateCompanyJobInput({
    title: 'Molecular Assay Associate',
    location: 'Hyderabad',
    deadline: '2027-07-15',
    description: 'Perform qPCR and ddPCR validation assays in ISO 15189 diagnostics lab.',
    applicationDestinationType: 'email',
    applicationEmail: 'careers@helixgen.in',
    applicationInstructions: 'Mention reference code HG-2027 in subject line.',
  });
  assert.equal(emailJobOk.valid, true);
  assert.equal(emailJobOk.value?.applicationUrl, 'mailto:careers@helixgen.in');
  assert.equal(emailJobOk.value?.applicationEmail, 'careers@helixgen.in');

  const portalJobOk = validateCompanyJobInput({
    title: 'Clinical Data Curator',
    location: 'Remote',
    deadline: '2027-08-01',
    description: 'Curate oncology biomarker literature and structured clinical trial endpoints.',
    applicationDestinationType: 'bionexa_portal',
  });
  assert.equal(portalJobOk.valid, true);
  assert.equal(portalJobOk.value?.applicationUrl, '');
});

test('Phase 15: RBAC permissions, admin isolation, and unverified employer publishing guard', () => {
  // Unverified + unverified email cannot submit or publish as verified
  const unverifiedNoEmail = getCompanyPermissions({
    accountStatus: 'active',
    emailVerified: false,
    verificationStatus: 'unverified',
  });
  assert.equal(unverifiedNoEmail.includes('company:profile:read'), true);
  assert.equal(unverifiedNoEmail.includes('company:jobs:submit'), false);
  assert.equal(unverifiedNoEmail.includes('company:jobs:publish_verified'), false);

  // Email verified but employer unverified: can submit for review, CANNOT publish as verified
  const unverifiedWithEmail = {
    accountStatus: 'active' as const,
    emailVerified: true,
    verificationStatus: 'unverified' as const,
  };
  assert.equal(hasCompanyPermission(unverifiedWithEmail, 'company:jobs:submit'), true);
  assert.equal(hasCompanyPermission(unverifiedWithEmail, 'company:jobs:publish_verified'), false);

  const unverifiedPolicy = resolveEmployerJobSubmissionPolicy({
    organizationName: 'HelixGen Labs',
    ...unverifiedWithEmail,
  });
  assert.equal(unverifiedPolicy.isApproved, false);
  assert.equal(unverifiedPolicy.status, 'Pending Review');
  assert.equal(unverifiedPolicy.verificationStatus, 'Pending Verification');
  assert.equal(unverifiedPolicy.publishedAsVerified, false);

  // Verified employer + verified email + active account CAN publish as verified
  const verifiedEmployer = {
    accountStatus: 'active' as const,
    emailVerified: true,
    verificationStatus: 'verified' as const,
  };
  assert.equal(hasCompanyPermission(verifiedEmployer, 'company:jobs:publish_verified'), true);
  const verifiedPolicy = resolveEmployerJobSubmissionPolicy({
    organizationName: 'HelixGen Labs',
    ...verifiedEmployer,
  });
  assert.equal(verifiedPolicy.isApproved, true);
  assert.equal(verifiedPolicy.status, 'Published');
  assert.equal(verifiedPolicy.verificationStatus, 'Verified');
  assert.equal(verifiedPolicy.publishedAsVerified, true);

  // Suspended account holds ZERO permissions
  const suspendedPerms = getCompanyPermissions({
    accountStatus: 'suspended',
    emailVerified: true,
    verificationStatus: 'verified',
  });
  assert.deepEqual(suspendedPerms, []);

  // Strict RBAC isolation from admin APIs
  assert.equal(isCompanyAllowedAdminPermission('jobs:write'), false);
  assert.equal(isCompanyAllowedAdminPermission('dashboard:read'), false);
  assert.equal(isCompanyAllowedAdminPermission('audit:read'), false);
});

test('Phase 15: CompanyAuthRateLimiter lockout and reset behavior', () => {
  const limiter = new CompanyAuthRateLimiter(3, 60_000, 120_000);
  const key = '10.0.0.1:hr@helixgen.in';
  const now = 1_700_000_000_000;

  assert.equal(limiter.check(key, now).allowed, true);
  limiter.consume(key, now);
  limiter.consume(key, now + 100);
  const third = limiter.consume(key, now + 200);
  assert.equal(third.allowed, false);
  assert.equal(limiter.check(key, now + 300).allowed, false);

  limiter.reset(key);
  assert.equal(limiter.check(key, now + 400).allowed, true);
});

test('Phase 15: routeMatcher resolves all company and employer auth/dashboard paths', () => {
  assert.equal(parseRoute('/company/login').route, 'company-login');
  assert.equal(parseRoute('/employer/signin').route, 'company-login');
  assert.equal(parseRoute('/company/register').route, 'company-register');
  assert.equal(parseRoute('/employer/signup').route, 'company-register');
  assert.equal(parseRoute('/company/verify-email').route, 'company-verify-email');
  assert.equal(parseRoute('/company/reset-password').route, 'company-reset-password');
  assert.equal(parseRoute('/company/dashboard').route, 'dashboard-company');
  assert.equal(parseRoute('/employer/dashboard').route, 'dashboard-company');
});

test('Phase 15: BionexaDatabase full company auth, verification, job scoping, suspension & audit lifecycle', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bionexa-p15-test-'));
  const dbFile = path.join(tmpDir, 'test.db');

  try {
    const db = new BionexaDatabase(dbFile);

    // 1. Register company -> starts unverified & email unverified
    const verifyToken = generateOpaqueToken(24);
    const created = db.createCompanyAccount({
      email: 'talent@novabiolabs.in',
      passwordHash: hashCompanyPassword('NovaBio#2026!Secure'),
      contactName: 'Rohan Kulkarni',
      contactTitle: 'Head of Hiring',
      organizationName: 'NovaBio Therapeutics Pvt Ltd',
      organizationType: 'Biotech Startup',
      officialWebsite: 'https://novabiolabs.in',
      headquartersLocation: 'Pune, Maharashtra',
      verificationTokenHash: hashOpaqueToken(verifyToken),
      verificationTokenExpiresAt: new Date(Date.now() + COMPANY_VERIFY_TOKEN_TTL_MS).toISOString(),
    });

    assert.equal(created.emailVerified, false);
    assert.equal(created.verificationStatus, 'unverified');
    assert.equal(created.accountStatus, 'active');

    const safeInitial = toSafeCompanyProfile(created);
    assert.equal(safeInitial.canPublishAsVerified, false);
    assert.equal('passwordHash' in safeInitial, false);

    // 2. Verify work email
    const verifiedEmailAccount = db.verifyCompanyEmailByToken(verifyToken);
    assert.ok(verifiedEmailAccount);
    assert.equal(verifiedEmailAccount.emailVerified, true);
    assert.equal(verifiedEmailAccount.verificationStatus, 'unverified', 'Email verification must NOT auto-verify employer identity');

    // 3. Create session & validate
    const sessionToken = generateOpaqueToken(32);
    const session = db.createCompanySession({
      jti: 'csess-test-1',
      companyId: created.id,
      rawToken: sessionToken,
      userAgent: 'NodeTest/1.0',
      ipMasked: '127.0.0.xxx',
      expiresAt: new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString(),
    });
    assert.equal(session.companyId, created.id);
    const validated = db.validateCompanySessionToken(sessionToken);
    assert.ok(validated);
    assert.equal(validated.company.id, created.id);

    // 4. Submit job while unverified -> policy forces Pending Verification & isApproved: false
    const unverifiedPolicy = resolveEmployerJobSubmissionPolicy(verifiedEmailAccount);
    const pendingJob = db.createJob({
      title: 'Bioprocess Development Scientist',
      employer: verifiedEmailAccount.organizationName,
      companyAccountId: verifiedEmailAccount.id,
      location: 'Pune',
      employmentType: 'Full-time',
      sector: 'Biotech Startup',
      qualification: 'M.Tech Biotechnology',
      salary: '₹12–16 LPA',
      publicationDate: '2026-11-18',
      expiryDate: '2027-09-30',
      description: 'Scale-up mammalian cell culture fermentation in 50L bioreactors.',
      responsibilities: ['Lead upstream optimization'],
      requirements: ['M.Tech / PhD in Bioprocess'],
      skills: ['Bioreactors', 'Upstream Processing'],
      applicationUrl: 'https://novabiolabs.in/careers/bioprocess',
      applicationDestinationType: 'external_url',
      applicationEmail: '',
      applicationInstructions: 'Upload CV via careers portal.',
      originalJobUrl: 'https://novabiolabs.in/careers/bioprocess',
      source: `Company Portal (${verifiedEmailAccount.organizationName})`,
      verificationStatus: unverifiedPolicy.verificationStatus,
      verificationNotes: unverifiedPolicy.verificationNotes,
      lastVerificationDate: '',
      isActive: true,
      isApproved: unverifiedPolicy.isApproved,
      featured: false,
    });
    assert.equal(pendingJob.isApproved, false);
    assert.equal(pendingJob.verificationStatus, 'Pending Verification');
    assert.equal(pendingJob.companyAccountId, verifiedEmailAccount.id);

    // 5. Submit employer verification -> pending_review
    const pendingVerify = db.submitCompanyEmployerVerification(created.id, {
      officialWebsite: 'https://novabiolabs.in',
      registrationIdentifier: 'CIN-U73100MH2022PTC987654',
      verificationEvidenceUrl: 'https://novabiolabs.in/careers',
      verificationNotes: 'Head of Hiring at NovaBio Therapeutics Pune.',
    });
    assert.equal(pendingVerify?.verificationStatus, 'pending_review');

    // 6. Admin approves employer -> verified
    const approvedEmployer = db.setCompanyVerificationDecisionAdmin(
      created.id,
      'verified',
      'admin@bio-inexa.org',
      'MCA registration and official careers domain confirmed.'
    );
    assert.equal(approvedEmployer?.verificationStatus, 'verified');
    assert.equal(approvedEmployer?.verifiedBy, 'admin@bio-inexa.org');

    const verifiedPolicy = resolveEmployerJobSubmissionPolicy(approvedEmployer!);
    assert.equal(verifiedPolicy.publishedAsVerified, true);
    const verifiedJob = db.createJob({
      title: 'Analytical QC Lead',
      employer: approvedEmployer!.organizationName,
      companyAccountId: approvedEmployer!.id,
      location: 'Pune',
      employmentType: 'Full-time',
      sector: 'Biotech Startup',
      qualification: 'M.Sc Analytical Chemistry',
      salary: '₹18–22 LPA',
      publicationDate: '2026-11-18',
      expiryDate: '2027-10-15',
      description: 'Oversee HPLC, SEC-MALS, and biologics stability release testing.',
      responsibilities: ['QC method validation'],
      requirements: ['5+ years biologics QC'],
      skills: ['HPLC', 'GMP'],
      applicationUrl: 'mailto:qc-hiring@novabiolabs.in',
      applicationDestinationType: 'email',
      applicationEmail: 'qc-hiring@novabiolabs.in',
      applicationInstructions: 'Send CV to QC hiring team.',
      originalJobUrl: 'https://novabiolabs.in/careers',
      source: `Verified Employer (${approvedEmployer!.organizationName})`,
      verificationStatus: verifiedPolicy.verificationStatus,
      verificationNotes: verifiedPolicy.verificationNotes,
      lastVerificationDate: '2026-11-18',
      isActive: true,
      isApproved: verifiedPolicy.isApproved,
      featured: false,
    });
    assert.equal(verifiedJob.isApproved, true);
    assert.equal(verifiedJob.verificationStatus, 'Verified');
    assert.equal(verifiedJob.applicationDestinationType, 'email');
    assert.equal(db.getJobsByCompanyAccountId(created.id).length, 2);

    // 7. Password reset revokes sessions
    const resetToken = generateOpaqueToken(24);
    db.setCompanyPasswordResetToken(
      created.id,
      hashOpaqueToken(resetToken),
      new Date(Date.now() + COMPANY_RESET_TOKEN_TTL_MS).toISOString()
    );
    const afterReset = db.consumeCompanyPasswordResetToken(
      resetToken,
      hashCompanyPassword('NovaBio#2027!Rotated')
    );
    assert.ok(afterReset);
    assert.equal(verifyCompanyPassword('NovaBio#2027!Rotated', afterReset.passwordHash), true);
    assert.equal(db.validateCompanySessionToken(sessionToken), null, 'Password reset must revoke active sessions');

    // 8. Admin suspend immediately revokes active sessions
    const session2Token = generateOpaqueToken(32);
    db.createCompanySession({
      jti: 'csess-test-2',
      companyId: created.id,
      rawToken: session2Token,
      userAgent: 'NodeTest/2.0',
      ipMasked: '127.0.0.xxx',
      expiresAt: new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString(),
    });
    const suspendResult = db.setCompanyAccountStatusAdmin(
      created.id,
      'suspended',
      'admin@bio-inexa.org',
      'Compliance review pending'
    );
    assert.equal(suspendResult.company?.accountStatus, 'suspended');
    assert.equal(suspendResult.revokedSessions, 1);
    assert.equal(db.validateCompanySessionToken(session2Token), null);

    // Reinstate
    const reinstateResult = db.setCompanyAccountStatusAdmin(created.id, 'active', 'admin@bio-inexa.org', '');
    assert.equal(reinstateResult.company?.accountStatus, 'active');

    // 9. Audit logs
    db.createCompanyAuditLog({
      companyId: created.id,
      actorType: 'admin',
      actorId: 'admin-1',
      actorEmail: 'admin@bio-inexa.org',
      action: 'EMPLOYER_VERIFIED',
      targetType: 'company',
      targetId: created.id,
      status: 'success',
      ipMasked: '127.0.0.xxx',
      details: 'Verified employer identity.',
    });
    const logs = db.getCompanyAuditLogs(created.id, 20);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'EMPLOYER_VERIFIED');
    assert.equal(logs[0].organizationName, 'NovaBio Therapeutics Pvt Ltd');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
