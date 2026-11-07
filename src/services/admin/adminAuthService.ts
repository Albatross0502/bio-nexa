import crypto from 'node:crypto';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface AdminSession {
  token: string;
  user: AdminUser;
  createdAt: number;
  expiresAt: number;
  lastActive: number;
}

export interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

// 8 hour session lifespan
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Rate limiting: 5 failed attempts per 15 minutes leads to a 15-minute lockout
export const MAX_FAILED_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Pure cryptographic password hashing using Node scrypt
 */
export function hashPassword(password: string, salt?: string): string {
  const currentSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, currentSalt, 64);
  return `${currentSalt}:${derivedKey.toString('hex')}`;
}

/**
 * Timing-safe password verification
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!password || !combinedHash || !combinedHash.includes(':')) {
    return false;
  }
  const [salt, key] = combinedHash.split(':');
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

/**
 * Rate Limiter for Login Protection
 */
export class LoginRateLimiter {
  private attempts = new Map<string, RateLimitEntry>();

  public check(identifier: string, now: number = Date.now()): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
    const entry = this.attempts.get(identifier);

    if (!entry) {
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    // Check if currently locked
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfterSec = Math.ceil((entry.lockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSec };
    }

    // Reset if window has passed
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.attempts.delete(identifier);
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - entry.attempts);
    return { allowed: remaining > 0, remainingAttempts: remaining };
  }

  public recordFailure(identifier: string, now: number = Date.now()): { isLocked: boolean; retryAfterSec?: number } {
    const entry = this.attempts.get(identifier);

    if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.attempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        lockedUntil: null
      });
      return { isLocked: false };
    }

    entry.attempts += 1;
    if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
      const retryAfterSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return { isLocked: true, retryAfterSec };
    }

    return { isLocked: false };
  }

  public reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  public clear(): void {
    this.attempts.clear();
  }
}

/**
 * Secure In-Memory Session Store
 */
export class AdminSessionManager {
  private sessions = new Map<string, AdminSession>();

  public createSession(user: AdminUser, now: number = Date.now()): AdminSession {
    const token = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      token,
      user,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastActive: now
    };
    this.sessions.set(token, session);
    return session;
  }

  public validateSession(token: string, now: number = Date.now()): AdminSession | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

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

  public purgeExpired(now: number = Date.now()): number {
    let purged = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
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
