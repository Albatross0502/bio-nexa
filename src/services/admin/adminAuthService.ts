import crypto from 'node:crypto';

export type AdminRole = 'super_admin' | 'moderator' | 'verifier' | 'editor' | 'admin';

export type AdminPermission =
  | 'dashboard:read'
  | 'jobs:write'
  | 'jobs:verify'
  | 'jobs:delete'
  | 'workshops:write'
  | 'workshops:delete'
  | 'courses:write'
  | 'courses:delete'
  | 'content:write'
  | 'opportunities:moderate'
  | 'compliance:manage'
  | 'inbox:read'
  | 'sync:run'
  | 'backups:manage'
  | 'admins:manage'
  | 'audit:read';

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  'dashboard:read',
  'jobs:write',
  'jobs:verify',
  'jobs:delete',
  'workshops:write',
  'workshops:delete',
  'courses:write',
  'courses:delete',
  'content:write',
  'opportunities:moderate',
  'compliance:manage',
  'inbox:read',
  'sync:run',
  'backups:manage',
  'admins:manage',
  'audit:read',
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ALL_ADMIN_PERMISSIONS,
  admin: ALL_ADMIN_PERMISSIONS,
  moderator: [
    'dashboard:read',
    'jobs:write',
    'jobs:verify',
    'workshops:write',
    'courses:write',
    'content:write',
    'opportunities:moderate',
    'compliance:manage',
    'inbox:read',
    'sync:run',
    'audit:read',
  ],
  verifier: [
    'dashboard:read',
    'jobs:verify',
    'opportunities:moderate',
    'sync:run',
  ],
  editor: [
    'dashboard:read',
    'jobs:write',
    'workshops:write',
    'courses:write',
    'content:write',
  ],
};

export function normalizeAdminRole(role?: string): AdminRole {
  const clean = (role || '').trim().toLowerCase();
  if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
  if (clean === 'moderator') return 'moderator';
  if (clean === 'verifier') return 'verifier';
  if (clean === 'editor') return 'editor';
  if (clean === 'admin') return 'admin';
  return 'moderator';
}

export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  const normalized = normalizeAdminRole(role);
  return [...(ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS.moderator)];
}

export function hasAdminPermission(
  user: Pick<AdminUser, 'role' | 'permissions'> | null | undefined,
  permission: AdminPermission
): boolean {
  if (!user) return false;
  const effective = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : getPermissionsForRole(user.role);
  return effective.includes(permission);
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions?: AdminPermission[];
}

export interface AdminSession {
  jti: string;
  token: string;
  user: AdminUser;
  createdAt: number;
  expiresAt: number;
  lastActive: number;
  revokedAt?: number | null;
  ipAddress?: string;
  userAgent?: string;
}

export interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

export interface FailedLoginAttemptEvent {
  identifier: string;
  usernameAttempted: string;
  reason: string;
  timestamp: number;
  isLocked: boolean;
}

// 8 hour session lifespan
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Rate limiting: 5 failed attempts per 15 minutes leads to a 15-minute lockout
export const MAX_FAILED_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Strong scrypt work factor (N=32768, r=8, p=1 -> 32 MiB RAM, safe under maxmem 64 MiB)
export const SCRYPT_N = 32768;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_KEYLEN = 64;
export const SCRYPT_MAXMEM = 64 * 1024 * 1024;
export const MIN_SCRYPT_N = 16384;

/**
 * Password complexity validation for admin credential creation/rotation.
 */
export function validateAdminPasswordStrength(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 12) {
    return { valid: false, error: 'Administrator password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Administrator password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Administrator password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Administrator password must include at least one digit.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Administrator password must include at least one special character.' };
  }
  return { valid: true };
}

/**
 * Cryptographic password hashing using securely configured Node scrypt
 * Encodes explicit RFC 7914 cost parameters: scrypt$N=32768,r=8,p=1$<saltHex>$<keyHex>
 */
export function hashPassword(password: string, salt?: string): string {
  const currentSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, currentSalt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${currentSalt}$${derivedKey.toString('hex')}`;
}

/**
 * Timing-safe password verification supporting versioned scrypt$ hashes
 * as well as legacy <saltHex>:<keyHex> hashes.
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!password || !combinedHash) {
    return false;
  }

  try {
    if (combinedHash.startsWith('scrypt$')) {
      const parts = combinedHash.split('$');
      if (parts.length !== 4) return false;
      const [, paramStr, salt, keyHex] = parts;
      if (!salt || !keyHex) return false;

      const params: Record<string, number> = {};
      for (const pair of paramStr.split(',')) {
        const [k, v] = pair.split('=');
        const num = Number(v);
        if (k && Number.isFinite(num)) params[k] = num;
      }

      const N = params.N;
      const r = params.r;
      const p = params.p;
      if (!N || !r || !p || N < MIN_SCRYPT_N || r < 8 || p < 1) {
        return false;
      }

      const keyBuffer = Buffer.from(keyHex, 'hex');
      if (keyBuffer.length === 0) return false;

      const derivedBuffer = crypto.scryptSync(password, salt, keyBuffer.length, {
        N,
        r,
        p,
        maxmem: Math.max(SCRYPT_MAXMEM, 256 * N * r),
      });

      if (keyBuffer.length !== derivedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
    }

    if (combinedHash.includes(':')) {
      const [salt, key] = combinedHash.split(':');
      if (!salt || !key) return false;
      const keyBuffer = Buffer.from(key, 'hex');
      if (keyBuffer.length === 0) return false;
      const derivedBuffer = crypto.scryptSync(password, salt, keyBuffer.length);
      if (keyBuffer.length !== derivedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
    }

    return false;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------
// Optional Two-Factor Authentication (RFC 6238 TOTP)
// -------------------------------------------------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength: number = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function computeTotpCode(secretBase32: string, timestampMs: number = Date.now(), stepSec: number = 30): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSec);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(
  secretBase32: string,
  candidateCode: string,
  timestampMs: number = Date.now(),
  windowSteps: number = 1
): boolean {
  const cleanCode = (candidateCode || '').trim();
  if (!secretBase32 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const expected = computeTotpCode(secretBase32, timestampMs + delta * 30_000);
    const a = Buffer.from(cleanCode, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

export function buildTotpOtpAuthUri(accountName: string, secretBase32: string, issuer: string = 'BIO-INEXA Admin'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${encodeURIComponent(secretBase32)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// -------------------------------------------------------------------------
// Password Reset Token Helpers (CSPRNG + SHA-256 hash storage)
// -------------------------------------------------------------------------

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createPasswordResetToken(now: number = Date.now()): {
  rawToken: string;
  tokenHash: string;
  expiresAtIso: string;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAtIso: new Date(now + PASSWORD_RESET_TTL_MS).toISOString(),
  };
}

/**
 * Rate Limiter & Failed-Login Monitor for Login Protection
 */
export class LoginRateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private failureLog: FailedLoginAttemptEvent[] = [];

  public check(identifier: string, now: number = Date.now()): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
    const entry = this.attempts.get(identifier);

    if (!entry) {
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfterSec = Math.ceil((entry.lockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSec };
    }

    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.attempts.delete(identifier);
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - entry.attempts);
    return { allowed: remaining > 0, remainingAttempts: remaining };
  }

  public recordFailure(
    identifier: string,
    now: number = Date.now(),
    meta?: { usernameAttempted?: string; reason?: string }
  ): { isLocked: boolean; retryAfterSec?: number } {
    const entry = this.attempts.get(identifier);
    let isLocked = false;
    let retryAfterSec: number | undefined;

    if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.attempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        lockedUntil: null,
      });
    } else {
      entry.attempts += 1;
      if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_DURATION_MS;
        retryAfterSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        isLocked = true;
      }
    }

    this.failureLog.unshift({
      identifier,
      usernameAttempted: meta?.usernameAttempted || 'unknown',
      reason: meta?.reason || 'INVALID_CREDENTIALS',
      timestamp: now,
      isLocked,
    });
    if (this.failureLog.length > 200) {
      this.failureLog.length = 200;
    }

    return isLocked ? { isLocked: true, retryAfterSec } : { isLocked: false };
  }

  public getFailureEvents(limit: number = 50): FailedLoginAttemptEvent[] {
    return this.failureLog.slice(0, limit);
  }

  public reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  public clear(): void {
    this.attempts.clear();
    this.failureLog = [];
  }
}

/**
 * Secure In-Memory Session Store with Expiration & Immediate Revocation
 */
export class AdminSessionManager {
  private sessions = new Map<string, AdminSession>();

  public createSession(
    user: AdminUser,
    now: number = Date.now(),
    meta?: { ipAddress?: string; userAgent?: string }
  ): AdminSession {
    const token = crypto.randomBytes(32).toString('hex');
    const jti = crypto.randomBytes(16).toString('hex');
    const normalizedUser: AdminUser = {
      ...user,
      role: normalizeAdminRole(user.role),
      permissions: getPermissionsForRole(user.role),
    };
    const session: AdminSession = {
      jti,
      token,
      user: normalizedUser,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastActive: now,
      revokedAt: null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    };
    this.sessions.set(token, session);
    return session;
  }

  public validateSession(token: string, now: number = Date.now()): AdminSession | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.revokedAt) {
      this.sessions.delete(token);
      return null;
    }

    if (now > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    session.lastActive = now;
    return session;
  }

  public destroySession(token: string): boolean {
    return this.sessions.delete(token);
  }

  public revokeAllForUser(userId: string, exceptToken?: string): number {
    let revoked = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.user.id === userId && token !== exceptToken) {
        this.sessions.delete(token);
        revoked++;
      }
    }
    return revoked;
  }

  public listActiveSessions(now: number = Date.now()): Array<Omit<AdminSession, 'token'>> {
    this.purgeExpired(now);
    return Array.from(this.sessions.values()).map(({ token: _omit, ...rest }) => rest);
  }

  public purgeExpired(now: number = Date.now()): number {
    let purged = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt || session.revokedAt) {
        this.sessions.delete(token);
        purged++;
      }
    }
    return purged;
  }

  public clear(): void {
    this.sessions.clear();
  }
}
