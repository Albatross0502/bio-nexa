import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  LoginRateLimiter,
  AdminSessionManager,
  AdminUser,
  MAX_FAILED_ATTEMPTS
} from './adminAuthService.js';

test('Password hashing generates valid salted scrypt hash', () => {
  const hash = hashPassword('BioNexa@SecurePass2026');
  assert.ok(hash.includes(':'));
  const [salt, key] = hash.split(':');
  assert.equal(salt.length, 32); // 16 bytes in hex = 32 chars
  assert.equal(key.length, 128); // 64 bytes in hex = 128 chars
});

test('Password verification correctly authenticates valid passwords', () => {
  const pass = 'SuperSecret123!';
  const hash = hashPassword(pass);

  assert.equal(verifyPassword(pass, hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword(pass, ''), false);
});

test('LoginRateLimiter locks out after 5 consecutive failures', () => {
  const limiter = new LoginRateLimiter();
  const ip = '192.168.1.100';

  // First 4 failures
  for (let i = 0; i < 4; i++) {
    const status = limiter.check(ip);
    assert.equal(status.allowed, true);
    assert.equal(status.remainingAttempts, MAX_FAILED_ATTEMPTS - i);
    const fail = limiter.recordFailure(ip);
    assert.equal(fail.isLocked, false);
  }

  // 5th failure triggers lockout
  const fail5 = limiter.recordFailure(ip);
  assert.equal(fail5.isLocked, true);
  assert.ok(fail5.retryAfterSec && fail5.retryAfterSec > 0);

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

test('AdminSessionManager manages session lifecycle securely', () => {
  const manager = new AdminSessionManager();
  const user: AdminUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@bionexa.org',
    name: 'Chief Moderator',
    role: 'admin'
  };

  const session = manager.createSession(user);
  assert.ok(session.token);
  assert.equal(session.token.length, 64); // 32 bytes hex = 64 chars
  assert.equal(session.user.role, 'admin');

  // Valid session lookup
  const validated = manager.validateSession(session.token);
  assert.ok(validated);
  assert.equal(validated?.user.username, 'admin');

  // Non-existent token
  assert.equal(manager.validateSession('invalid-token-123'), null);

  // Expired session validation
  const expiredTime = Date.now() + 10 * 60 * 60 * 1000;
  assert.equal(manager.validateSession(session.token, expiredTime), null);

  // Destroy session
  const session2 = manager.createSession(user);
  assert.equal(manager.destroySession(session2.token), true);
  assert.equal(manager.validateSession(session2.token), null);
});
