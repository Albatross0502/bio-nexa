import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createEmailVerificationToken,
  createStudentPasswordResetToken,
  createStudentSessionToken,
  hashEmailForAudit,
  hashOpaqueToken,
  hashStudentPassword,
  hasStudentPermission,
  isStudentAllowedAdminPermission,
  maskIpAddress,
  normalizeStudentEmail,
  parseStudentSkills,
  StudentAuthRateLimiter,
  toSafeStudentProfile,
  validateDeletionRequestInput,
  validateOptionalLinkedInUrl,
  validateOptionalOrcidId,
  validateStudentPasswordStrength,
  validateStudentProfileUpdateInput,
  validateStudentRegistrationInput,
  verifyStudentPassword,
} from './studentAuthService';
import { BionexaDatabase } from '../../db/bionexaDatabase';
import { parseRoute } from '../../utils/routeMatcher';

test('student password hashing uses salted scrypt and verifies securely', () => {
  const pw = 'BioTech#2026Secure';
  const hashA = hashStudentPassword(pw);
  const hashB = hashStudentPassword(pw);

  assert.notEqual(hashA, pw);
  assert.notEqual(hashA, hashB, 'Different random salts must yield unique hashes');
  assert.equal(verifyStudentPassword(pw, hashA), true);
  assert.equal(verifyStudentPassword(pw, hashB), true);
  assert.equal(verifyStudentPassword('WrongPass#2026', hashA), false);
});

test('student password strength rules reject weak/common/email-derived passwords', () => {
  assert.equal(validateStudentPasswordStrength('short1!A').valid, true);
  assert.equal(validateStudentPasswordStrength('Short1!').valid, false);
  assert.equal(validateStudentPasswordStrength('lowercase1!').valid, false);
  assert.equal(validateStudentPasswordStrength('UPPERCASE1!').valid, false);
  assert.equal(validateStudentPasswordStrength('NoNumbers!A').valid, false);
  assert.equal(validateStudentPasswordStrength('NoSymbol123A').valid, false);
  assert.equal(
    validateStudentPasswordStrength('MyMeera2026!Pass', 'meera@iisc.ac.in').valid,
    false,
    'Password containing email local part should be rejected'
  );
  assert.equal(
    validateStudentPasswordStrength('CrisprLab#2026!', 'meera@iisc.ac.in').valid,
    true
  );
});

test('registration, profile, LinkedIn, ORCID, and deletion validators enforce strict input rules', () => {
  // Missing privacy consent fails
  const noConsent = validateStudentRegistrationInput({
    fullName: 'Meera Krishnan',
    email: 'MEERA.K@IISC.AC.IN',
    password: 'CrisprLab#2026!',
    privacyConsent: false,
  });
  assert.equal(noConsent.valid, false);

  // Invalid graduation year fails
  const badGrad = validateStudentRegistrationInput({
    fullName: 'Meera Krishnan',
    email: 'meera.k@iisc.ac.in',
    password: 'CrisprLab#2026!',
    graduationYear: '99',
    privacyConsent: true,
  });
  assert.equal(badGrad.valid, false);

  // Valid registration normalizes email
  const validReg = validateStudentRegistrationInput({
    fullName: '  Meera Krishnan  ',
    email: '  MEERA.K@IISC.AC.IN ',
    password: 'CrisprLab#2026!',
    degreeTitle: 'M.Sc Biotechnology',
    institution: 'IISc Bengaluru',
    graduationYear: '2027',
    privacyConsent: true,
  });
  assert.equal(validReg.valid, true);
  assert.equal(validReg.data?.email, 'meera.k@iisc.ac.in');
  assert.equal(validReg.data?.fullName, 'Meera Krishnan');

  // LinkedIn & ORCID validators
  assert.equal(validateOptionalLinkedInUrl('https://www.linkedin.com/in/meera-bio').valid, true);
  assert.equal(validateOptionalLinkedInUrl('https://evil.example.com/in/meera').valid, false);
  assert.equal(validateOptionalLinkedInUrl('javascript:alert(1)').valid, false);

  assert.equal(validateOptionalOrcidId('0000-0002-1825-0097').valid, true);
  assert.equal(validateOptionalOrcidId('https://orcid.org/0000-0002-1825-009X').data, '0000-0002-1825-009X');
  assert.equal(validateOptionalOrcidId('invalid-orcid').valid, false);

  // Skills parser deduplicates case-insensitively and caps at 20
  const skills = parseStudentSkills('RT-qPCR, crispr, RT-qPCR, Python, , HPLC');
  assert.deepEqual(skills, ['RT-qPCR', 'crispr', 'Python', 'HPLC']);

  // Profile update validator
  const profileOk = validateStudentProfileUpdateInput({
    fullName: 'Meera K.',
    institution: 'NCBS Bengaluru',
    skills: 'CRISPR, RNA-Seq, CRISPR',
    linkedinUrl: 'https://linkedin.com/in/meera',
    orcidId: '0000-0002-1825-0097',
  });
  assert.equal(profileOk.valid, true);
  assert.deepEqual(profileOk.data?.skills, ['CRISPR', 'RNA-Seq']);

  // Deletion request validator
  assert.equal(
    validateDeletionRequestInput({ password: 'x', confirmation: 'wrong' }).valid,
    false
  );
  assert.equal(
    validateDeletionRequestInput({ password: '', confirmation: 'DELETE' }).valid,
    false
  );
  const delOk = validateDeletionRequestInput({
    password: 'CrisprLab#2026!',
    confirmation: 'delete',
    reason: 'Graduated',
    mode: 'delete_now',
  });
  assert.equal(delOk.valid, true);
  assert.equal(delOk.data?.mode, 'delete_now');
});

test('RBAC helpers enforce student permissions and strictly forbid admin permissions', () => {
  const activeStudent = {
    role: 'student' as const,
    accountStatus: 'active' as const,
    permissions: ['student:profile:read' as const, 'student:profile:write' as const],
  };
  assert.equal(hasStudentPermission(activeStudent, 'student:profile:read'), true);
  assert.equal(hasStudentPermission(activeStudent, 'student:sessions:manage'), false);
  assert.equal(
    hasStudentPermission({ ...activeStudent, accountStatus: 'suspended' }, 'student:profile:read'),
    false
  );
  assert.equal(isStudentAllowedAdminPermission('student', 'dashboard:read'), false);
  assert.equal(isStudentAllowedAdminPermission('student', 'jobs:write'), false);
});

test('privacy helpers mask IP addresses, hash emails, and strip secret fields from safe profile DTO', () => {
  assert.equal(maskIpAddress('192.168.44.120'), '192.168.x.x');
  assert.equal(maskIpAddress('::ffff:10.20.30.40'), '10.20.x.x');
  assert.equal(maskIpAddress('2001:db8:85a3::8a2e:370:7334'), '2001:db8:xxxx');
  assert.equal(normalizeStudentEmail('  Student@Bio.Org  '), 'student@bio.org');

  const h1 = hashEmailForAudit('Student@Bio.Org');
  const h2 = hashEmailForAudit('student@bio.org');
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test('StudentAuthRateLimiter enforces attempt thresholds, lockout, reset, and window expiry', () => {
  const limiter = new StudentAuthRateLimiter(3, 60_000, 120_000);
  const t0 = 1_700_000_000_000;

  assert.equal(limiter.check('ip:1', t0).allowed, true);
  assert.equal(limiter.consume('ip:1', t0).allowed, true);
  assert.equal(limiter.consume('ip:1', t0 + 1000).allowed, true);
  const third = limiter.consume('ip:1', t0 + 2000);
  assert.equal(third.allowed, false);
  assert.equal(third.isLocked, true);
  assert.ok((third.retryAfterSec || 0) > 0);

  // Blocked while locked
  assert.equal(limiter.check('ip:1', t0 + 10_000).allowed, false);

  // Allowed again after lockout expires
  assert.equal(limiter.check('ip:1', t0 + 125_000).allowed, true);

  // Explicit reset clears state
  limiter.consume('ip:2', t0);
  limiter.reset('ip:2');
  assert.equal(limiter.check('ip:2', t0).remainingAttempts, 3);
});

test('routeMatcher recognizes Phase 14 student authentication routes', () => {
  assert.equal(parseRoute('/student/login').route, 'student-login');
  assert.equal(parseRoute('/login').route, 'student-login');
  assert.equal(parseRoute('/student/register').route, 'student-register');
  assert.equal(parseRoute('/register').route, 'student-register');
  assert.equal(parseRoute('/student/verify-email?token=abc123').route, 'student-verify-email');
  assert.equal(parseRoute('/student/verify-email?token=abc123').queryParams.token, 'abc123');
  assert.equal(parseRoute('/student/reset-password?token=xyz789').route, 'student-reset-password');
  assert.equal(parseRoute('/student/reset-password?token=xyz789').queryParams.token, 'xyz789');
});

test('BionexaDatabase executes full Phase 14 student account lifecycle (register, verify, sessions, profile edit, password reset, deletion)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bionexa-student-db-'));
  const dbPath = path.join(tmpDir, 'test-student.db');
  const db = new BionexaDatabase(dbPath);

  try {
    const verification = createEmailVerificationToken();
    const pwHash = hashStudentPassword('BioSecure#2026!');

    // 1. Create student account
    const created = db.createStudentAccount({
      email: 'ananya.genomics@ncbs.res.in',
      passwordHash: pwHash,
      fullName: 'Ananya Deshmukh',
      degreeTitle: 'M.Sc Molecular Biology',
      institution: 'NCBS Bengaluru',
      specialization: 'Single-Cell Genomics',
      graduationYear: '2027',
      verificationTokenHash: verification.tokenHash,
      verificationExpiresAt: verification.expiresAtIso,
      privacyConsentAt: new Date().toISOString(),
    });
    assert.ok(created.id.startsWith('stu-'));
    assert.equal(created.emailVerified, false);
    assert.equal(created.profileVisibility, 'private');

    // Safe DTO never exposes passwordHash or token hashes
    const safeDto = toSafeStudentProfile(created) as unknown as Record<string, unknown>;
    assert.equal(safeDto.passwordHash, undefined);
    assert.equal(safeDto.verificationTokenHash, undefined);
    assert.equal(safeDto.resetTokenHash, undefined);

    // 2. Verify email by raw token (hashed internally)
    const verifyRes = db.verifyStudentEmailByToken(verification.rawToken);
    assert.ok(verifyRes);
    assert.equal(verifyRes.emailVerified, true);

    // Token cannot be reused
    const reuseRes = db.verifyStudentEmailByToken(verification.rawToken);
    assert.equal(reuseRes, null);

    // 3. Session creation, listing, and selective revocation
    const sess1 = createStudentSessionToken();
    const sess2 = createStudentSessionToken();
    db.createStudentSession({
      jti: sess1.jti,
      studentId: created.id,
      tokenHash: sess1.tokenHash,
      userAgent: 'Chromium Desktop',
      ipAddressMasked: maskIpAddress('127.0.0.1'),
      expiresAt: sess1.expiresAtIso,
    });
    db.createStudentSession({
      jti: sess2.jti,
      studentId: created.id,
      tokenHash: sess2.tokenHash,
      userAgent: 'Mobile Safari',
      ipAddressMasked: maskIpAddress('10.0.0.5'),
      expiresAt: sess2.expiresAtIso,
    });

    const validated1 = db.validateStudentSessionToken(sess1.rawToken);
    assert.equal(validated1?.student.id, created.id);

    const activeSessions = db.listStudentSessions(created.id, sess1.jti);
    assert.equal(activeSessions.length, 2);
    assert.equal(activeSessions.some((s) => s.jti === sess1.jti && s.isCurrent), true);

    // Revoke other sessions keeping sess1
    const revokedOthers = db.revokeAllStudentSessions(created.id, sess1.jti);
    assert.equal(revokedOthers, 1);
    assert.equal(db.validateStudentSessionToken(sess2.rawToken), null);
    assert.ok(db.validateStudentSessionToken(sess1.rawToken));

    // 4. Profile editing persisted in DB
    const updated = db.updateStudentProfile(created.id, {
      institution: 'IISc Bengaluru',
      location: 'Bengaluru, India',
      skills: ['CRISPR', 'RNA-Seq', 'Python'],
      bio: 'Investigating spatial transcriptomics in stem cells.',
      orcidId: '0000-0002-1825-0097',
    });
    assert.equal(updated?.institution, 'IISc Bengaluru');
    assert.deepEqual(updated?.skills, ['CRISPR', 'RNA-Seq', 'Python']);
    assert.equal(updated?.orcidId, '0000-0002-1825-0097');

    // 5. Password reset updates hash and revokes ALL existing sessions
    const reset = createStudentPasswordResetToken();
    db.setStudentPasswordResetToken(created.id, reset.tokenHash, reset.expiresAtIso);
    const newHash = hashStudentPassword('NewStrong#2026!');
    const consumed = db.consumeStudentPasswordResetToken(reset.rawToken, newHash);
    assert.ok(consumed);
    assert.equal(db.validateStudentSessionToken(sess1.rawToken), null);

    const postResetAccount = db.getStudentById(created.id);
    assert.equal(verifyStudentPassword('NewStrong#2026!', postResetAccount!.passwordHash), true);
    assert.equal(verifyStudentPassword('BioSecure#2026!', postResetAccount!.passwordHash), false);

    // 6. Pending deletion request + cancellation
    const pendingDel = db.createStudentDeletionRequest(
      created.id,
      'Testing DPDP workflow',
      'request'
    );
    assert.ok(pendingDel.request.id);
    assert.equal(pendingDel.deletedImmediately, false);
    assert.equal(db.getStudentById(created.id)?.accountStatus, 'deletion_pending');

    const cancelled = db.cancelStudentDeletionRequest(created.id);
    assert.equal(cancelled?.accountStatus, 'active');
    assert.equal(cancelled?.deletionRequestedAt, null);

    // 7. Immediate self-service deletion erases student record permanently
    const immediateDel = db.createStudentDeletionRequest(
      created.id,
      'Cleanup after test',
      'delete_now'
    );
    assert.ok(immediateDel.request.id);
    assert.equal(immediateDel.deletedImmediately, true);
    assert.equal(db.getStudentById(created.id), null);
    assert.equal(db.getStudentByEmail('ananya.genomics@ncbs.res.in'), null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
