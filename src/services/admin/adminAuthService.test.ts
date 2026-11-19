import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  validateAdminPasswordStrength,
  getPermissionsForRole,
  hasAdminPermission,
  generateTotpSecret,
  computeTotpCode,
  verifyTotpCode,
  buildTotpOtpAuthUri,
  createPasswordResetToken,
  hashResetToken,
  LoginRateLimiter,
  AdminSessionManager,
  AdminUser,
  MAX_FAILED_ATTEMPTS,
} from './adminAuthService.js';

test('Password hashing generates versioned scrypt hash with explicit cost parameters and verifies legacy hashes', () => {
  const pass = 'BioNexa@SecurePass2026';
  const hash = hashPassword(pass);
  assert.ok(hash.startsWith('scrypt$N=32768,r=8,p=1$'));
  const parts = hash.split('$');
  assert.equal(parts.length, 4);
  assert.equal(parts[2].length, 32); // 16 bytes salt hex
  assert.equal(parts[3].length, 128); // 64 bytes key hex

  assert.equal(verifyPassword(pass, hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword(pass, ''), false);

  // Backwards-compatible legacy salt:key scrypt format
  const legacySalt = crypto.randomBytes(16).toString('hex');
  const legacyKey = crypto.scryptSync(pass, legacySalt, 64).toString('hex');
  assert.equal(verifyPassword(pass, `${legacySalt}:${legacyKey}`), true);
  assert.equal(verifyPassword('WrongPass', `${legacySalt}:${legacyKey}`), false);
});

test('validateAdminPasswordStrength enforces strong administrator passphrases', () => {
  assert.equal(validateAdminPasswordStrength('short').valid, false);
  assert.equal(validateAdminPasswordStrength('alllowercase123!').valid, false);
  assert.equal(validateAdminPasswordStrength('ALLUPPERCASE123!').valid, false);
  assert.equal(validateAdminPasswordStrength('NoDigitsPassword!').valid, false);
  assert.equal(validateAdminPasswordStrength('NoSpecialChar1234').valid, false);
  assert.equal(validateAdminPasswordStrength('BioInexa@Admin2026!').valid, true);
});

test('Role-based permissions restrict non-super_admin actions accurately', () => {
  const superAdminPerms = getPermissionsForRole('super_admin');
  assert.ok(superAdminPerms.includes('admins:manage'));
  assert.ok(superAdminPerms.includes('backups:manage'));

  const verifierUser: AdminUser = {
    id: 'adm-ver',
    username: 'verifier@bio-inexa.org',
    email: 'verifier@bio-inexa.org',
    name: 'Job Verifier',
    role: 'verifier',
  };
  assert.equal(hasAdminPermission(verifierUser, 'jobs:verify'), true);
  assert.equal(hasAdminPermission(verifierUser, 'sync:run'), true);
  assert.equal(hasAdminPermission(verifierUser, 'backups:manage'), false);
  assert.equal(hasAdminPermission(verifierUser, 'jobs:delete'), false);

  const editorUser: AdminUser = {
    id: 'adm-ed',
    username: 'editor@bio-inexa.org',
    email: 'editor@bio-inexa.org',
    name: 'Content Editor',
    role: 'editor',
  };
  assert.equal(hasAdminPermission(editorUser, 'content:write'), true);
  assert.equal(hasAdminPermission(editorUser, 'audit:read'), false);
});

test('TOTP RFC 6238 generation and verification work cleanly across clock window', () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 16);
  const now = 1_760_000_000_000;
  const code = computeTotpCode(secret, now);
  assert.match(code, /^\d{6}$/);

  assert.equal(verifyTotpCode(secret, code, now), true);
  assert.equal(verifyTotpCode(secret, code, now + 29_000), true);
  assert.equal(verifyTotpCode(secret, '000000', now + 120_000), false);

  const uri = buildTotpOtpAuthUri('admin@bio-inexa.org', secret);
  assert.ok(uri.startsWith('otpauth://totp/'));
  assert.ok(uri.includes(`secret=${secret}`));
});

test('Password reset token generator creates distinct raw token and deterministic SHA-256 hash', () => {
  const reset = createPasswordResetToken();
  assert.equal(reset.rawToken.length, 64);
  assert.equal(hashResetToken(reset.rawToken), reset.tokenHash);
});

test('LoginRateLimiter locks out after 5 consecutive failures and records failure events', () => {
  const limiter = new LoginRateLimiter();
  const ip = '192.168.1.100';

  // First 4 failures
  for (let i = 0; i < 4; i++) {
    const status = limiter.check(ip);
    assert.equal(status.allowed, true);
    assert.equal(status.remainingAttempts, MAX_FAILED_ATTEMPTS - i);
    const fail = limiter.recordFailure(ip, Date.now(), { usernameAttempted: 'attacker@bad.org' });
    assert.equal(fail.isLocked, false);
  }

  // 5th failure triggers lockout
  const fail5 = limiter.recordFailure(ip, Date.now(), { usernameAttempted: 'attacker@bad.org' });
  assert.equal(fail5.isLocked, true);
  assert.ok(fail5.retryAfterSec && fail5.retryAfterSec > 0);
  assert.equal(limiter.getFailureEvents().length, 5);
  assert.equal(limiter.getFailureEvents()[0].isLocked, true);

  // Subsequent check should reject
  const lockedStatus = limiter.check(ip);
  assert.equal(lockedStatus.allowed, false);
  assert.equal(lockedStatus.remainingAttempts, 0);

  // Reset clears lockout
  limiter.reset(ip);
  const resetStatus = limiter.check(ip);
  assert.equal(resetStatus.allowed, true);
  assert.equal(resetStatus.remainingAttempts, MAX_FAILED_ATTEMPTS);
});

test('AdminSessionManager manages session lifecycle, jti assignment, and bulk user revocation', () => {
  const manager = new AdminSessionManager();
  const user: AdminUser = {
    id: 'admin-1',
    username: 'admin@bio-inexa.org',
    email: 'admin@bio-inexa.org',
    name: 'Chief Moderator',
    role: 'super_admin',
  };

  const session = manager.createSession(user);
  assert.ok(session.token);
  assert.ok(session.jti);
  assert.equal(session.token.length, 64);
  assert.equal(session.user.role, 'super_admin');
  assert.ok((session.user.permissions || []).includes('backups:manage'));

  const validated = manager.validateSession(session.token);
  assert.ok(validated);
  assert.equal(validated?.user.username, 'admin@bio-inexa.org');

  assert.equal(manager.validateSession('invalid-token-123'), null);

  const expiredTime = Date.now() + 10 * 60 * 60 * 1000;
  assert.equal(manager.validateSession(session.token, expiredTime), null);

  const sessionA = manager.createSession(user);
  const sessionB = manager.createSession(user);
  assert.equal(manager.revokeAllForUser(user.id, sessionA.token), 1);
  assert.ok(manager.validateSession(sessionA.token));
  assert.equal(manager.validateSession(sessionB.token), null);

  assert.equal(manager.destroySession(sessionA.token), true);
  assert.equal(manager.validateSession(sessionA.token), null);
});
