/**
 * Phase 14: Student Authentication Domain Service
 * Pure, unit-testable security, validation, RBAC, password hashing, token hashing,
 * privacy masking, and rate-limiting primitives for BIO-INEXA Student Accounts.
 */

import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  hashResetToken,
  AdminPermission,
} from '../admin/adminAuthService';

export type StudentRole = 'student';

export type StudentAccountStatus = 'active' | 'deletion_pending' | 'suspended';

export type StudentPermission =
  | 'student:profile:read'
  | 'student:profile:write'
  | 'student:sessions:manage'
  | 'student:account:delete_request'
  | 'student:saved:manage'
  | 'student:applications:read';

export const STUDENT_PERMISSIONS: readonly StudentPermission[] = [
  'student:profile:read',
  'student:profile:write',
  'student:sessions:manage',
  'student:account:delete_request',
  'student:saved:manage',
  'student:applications:read',
];

export const STUDENT_SESSION_COOKIE = 'bionexa_student_session';
export const STUDENT_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const STUDENT_PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const STUDENT_MAX_AUTH_ATTEMPTS = 5;
export const STUDENT_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const STUDENT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface DbStudentAccount {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: StudentRole;
  degreeTitle: string;
  institution: string;
  specialization: string;
  graduationYear: string;
  location: string;
  skills: string[];
  bio: string;
  linkedinUrl: string;
  orcidId: string;
  profileVisibility: 'private';
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  verificationTokenHash: string | null;
  verificationExpiresAt: string | null;
  resetTokenHash: string | null;
  resetExpiresAt: string | null;
  privacyConsentAt: string;
  accountStatus: StudentAccountStatus;
  deletionRequestedAt: string | null;
  deletionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Privacy-safe student profile exposed ONLY to the authenticated student themselves.
 * Never includes passwordHash, verification/reset token hashes, or internal security fields.
 */
export interface SafeStudentProfile {
  id: string;
  email: string;
  fullName: string;
  role: StudentRole;
  permissions: StudentPermission[];
  degreeTitle: string;
  institution: string;
  specialization: string;
  graduationYear: string;
  location: string;
  skills: string[];
  bio: string;
  linkedinUrl: string;
  orcidId: string;
  profileVisibility: 'private';
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  privacyConsentAt: string;
  accountStatus: StudentAccountStatus;
  deletionRequestedAt: string | null;
  deletionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbStudentSession {
  jti: string;
  studentId: string;
  tokenHash: string;
  userAgent: string;
  ipAddressMasked: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface SafeStudentSession {
  jti: string;
  userAgent: string;
  ipAddressMasked: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface StudentDeletionRequestRecord {
  id: string;
  studentId: string;
  emailHash: string;
  reason: string;
  status: 'pending' | 'completed' | 'cancelled';
  requestedAt: string;
  processedAt: string | null;
}

export interface ValidationResult<T = undefined> {
  valid: boolean;
  error?: string;
  data?: T;
}

// -------------------------------------------------------------------------
// Password Hashing & Strength Verification
// -------------------------------------------------------------------------

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'biotech123',
  'student123',
  'admin123',
  'welcome123',
  'letmein123',
]);

export function hashStudentPassword(password: string, salt?: string): string {
  return hashPassword(password, salt);
}

export function verifyStudentPassword(password: string, storedHash: string): boolean {
  return verifyPassword(password, storedHash);
}

export function validateStudentPasswordStrength(
  password: string,
  email?: string
): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one number (0-9).' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one special character (e.g. !@#$%).' };
  }
  const lower = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password.' };
  }
  if (email) {
    const emailLocal = email.trim().toLowerCase().split('@')[0];
    if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) {
      return { valid: false, error: 'Password should not contain your email address username.' };
    }
  }
  return { valid: true };
}

// -------------------------------------------------------------------------
// Token Generation & Hashing (CSPRNG + SHA-256)
// -------------------------------------------------------------------------

export function hashOpaqueToken(rawToken: string): string {
  return hashResetToken(rawToken.trim());
}

export function createStudentSessionToken(now: number = Date.now()): {
  jti: string;
  rawToken: string;
  tokenHash: string;
  expiresAtIso: string;
  expiresAtMs: number;
} {
  const jti = crypto.randomBytes(16).toString('hex');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAtMs = now + STUDENT_SESSION_DURATION_MS;
  return {
    jti,
    rawToken,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAtIso: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
  };
}

export function createEmailVerificationToken(now: number = Date.now()): {
  rawToken: string;
  tokenHash: string;
  expiresAtIso: string;
} {
  const rawToken = crypto.randomBytes(24).toString('hex');
  return {
    rawToken,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAtIso: new Date(now + EMAIL_VERIFICATION_TTL_MS).toISOString(),
  };
}

export function createStudentPasswordResetToken(now: number = Date.now()): {
  rawToken: string;
  tokenHash: string;
  expiresAtIso: string;
} {
  const rawToken = crypto.randomBytes(24).toString('hex');
  return {
    rawToken,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAtIso: new Date(now + STUDENT_PASSWORD_RESET_TTL_MS).toISOString(),
  };
}

// -------------------------------------------------------------------------
// RBAC Helpers (Strict Student / Admin Isolation)
// -------------------------------------------------------------------------

export function hasStudentPermission(
  student: Pick<SafeStudentProfile, 'role' | 'accountStatus' | 'permissions'> | null | undefined,
  permission: StudentPermission
): boolean {
  if (!student || student.role !== 'student') return false;
  if (student.accountStatus === 'suspended') return false;
  const perms = Array.isArray(student.permissions) && student.permissions.length > 0
    ? student.permissions
    : STUDENT_PERMISSIONS;
  return perms.includes(permission);
}

/**
 * Students must NEVER be allowed to access administrator APIs or hold admin permissions.
 */
export function isStudentAllowedAdminPermission(
  _role: StudentRole | string,
  _permission?: AdminPermission
): boolean {
  return false;
}

// -------------------------------------------------------------------------
// Privacy-Conscious Utilities & Sanitization
// -------------------------------------------------------------------------

export function maskIpAddress(ip?: string): string {
  const raw = String(ip || '').trim();
  if (!raw) return 'unknown';
  const cleaned = raw.replace(/^::ffff:/i, '');
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
  }
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').filter(Boolean);
    return `${parts.slice(0, 2).join(':')}:xxxx`;
  }
  return 'masked';
}

export function hashEmailForAudit(email: string): string {
  return crypto.createHash('sha256').update(normalizeStudentEmail(email)).digest('hex');
}

export function toSafeStudentProfile(account: DbStudentAccount): SafeStudentProfile {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: 'student',
    permissions: [...STUDENT_PERMISSIONS],
    degreeTitle: account.degreeTitle || '',
    institution: account.institution || '',
    specialization: account.specialization || '',
    graduationYear: account.graduationYear || '',
    location: account.location || '',
    skills: Array.isArray(account.skills) ? account.skills : [],
    bio: account.bio || '',
    linkedinUrl: account.linkedinUrl || '',
    orcidId: account.orcidId || '',
    profileVisibility: 'private',
    emailVerified: Boolean(account.emailVerified),
    emailVerifiedAt: account.emailVerifiedAt || null,
    privacyConsentAt: account.privacyConsentAt,
    accountStatus: account.accountStatus || 'active',
    deletionRequestedAt: account.deletionRequestedAt || null,
    deletionReason: account.deletionReason || null,
    lastLoginAt: account.lastLoginAt || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

// -------------------------------------------------------------------------
// Input Validation & Normalization
// -------------------------------------------------------------------------

export function normalizeStudentEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidStudentEmail(email: string): boolean {
  if (!email || email.length > 160) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

export function parseStudentSkills(input: unknown): string[] {
  const rawList = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? input.split(/[\n,]/)
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawList) {
    const clean = sanitizeText(String(item || ''), 48);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
    if (out.length >= 20) break;
  }
  return out;
}

export function validateOptionalLinkedInUrl(rawUrl: unknown): ValidationResult<string> {
  const clean = sanitizeText(rawUrl, 240);
  if (!clean) return { valid: true, data: '' };
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'LinkedIn URL must start with https:// or http://.' };
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) {
      return { valid: false, error: 'Please provide a valid linkedin.com profile URL.' };
    }
    return { valid: true, data: parsed.toString() };
  } catch {
    return { valid: false, error: 'Please enter a valid LinkedIn profile URL.' };
  }
}

export function validateOptionalOrcidId(rawOrcid: unknown): ValidationResult<string> {
  const clean = sanitizeText(rawOrcid, 64).replace(/^https?:\/\/orcid\.org\//i, '');
  if (!clean) return { valid: true, data: '' };
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(clean)) {
    return { valid: false, error: 'ORCID iD must match format 0000-0000-0000-0000.' };
  }
  return { valid: true, data: clean.toUpperCase() };
}

export interface ValidatedStudentRegistration {
  fullName: string;
  email: string;
  password: string;
  degreeTitle: string;
  institution: string;
  specialization: string;
  graduationYear: string;
  privacyConsent: true;
}

export function validateStudentRegistrationInput(
  payload: Record<string, unknown>
): ValidationResult<ValidatedStudentRegistration> {
  const fullName = sanitizeText(payload?.fullName ?? payload?.name, 100);
  if (fullName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters long.' };
  }

  const email = normalizeStudentEmail(payload?.email);
  if (!isValidStudentEmail(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const password = typeof payload?.password === 'string' ? payload.password : '';
  const pwCheck = validateStudentPasswordStrength(password, email);
  if (!pwCheck.valid) {
    return { valid: false, error: pwCheck.error };
  }

  const privacyConsent = payload?.privacyConsent === true;
  if (!privacyConsent) {
    return {
      valid: false,
      error: 'You must review and accept the Privacy Policy and data processing notice to register.',
    };
  }

  const graduationYear = sanitizeText(payload?.graduationYear, 12);
  if (graduationYear && !/^(19|20)\d{2}$/.test(graduationYear)) {
    return { valid: false, error: 'Graduation year must be a 4-digit year (e.g., 2027).' };
  }

  return {
    valid: true,
    data: {
      fullName,
      email,
      password,
      degreeTitle: sanitizeText(payload?.degreeTitle ?? payload?.title, 100),
      institution: sanitizeText(payload?.institution, 140),
      specialization: sanitizeText(payload?.specialization, 100),
      graduationYear,
      privacyConsent: true,
    },
  };
}

export interface ValidatedStudentProfileUpdate {
  fullName?: string;
  degreeTitle?: string;
  institution?: string;
  specialization?: string;
  graduationYear?: string;
  location?: string;
  skills?: string[];
  bio?: string;
  linkedinUrl?: string;
  orcidId?: string;
}

export function validateStudentProfileUpdateInput(
  payload: Record<string, unknown>
): ValidationResult<ValidatedStudentProfileUpdate> {
  const updates: ValidatedStudentProfileUpdate = {};

  if (payload.fullName !== undefined || payload.name !== undefined) {
    const fullName = sanitizeText(payload.fullName ?? payload.name, 100);
    if (fullName.length < 2) {
      return { valid: false, error: 'Full name must be at least 2 characters long.' };
    }
    updates.fullName = fullName;
  }

  if (payload.degreeTitle !== undefined || payload.title !== undefined) {
    updates.degreeTitle = sanitizeText(payload.degreeTitle ?? payload.title, 100);
  }

  if (payload.institution !== undefined) {
    updates.institution = sanitizeText(payload.institution, 140);
  }

  if (payload.specialization !== undefined) {
    updates.specialization = sanitizeText(payload.specialization, 100);
  }

  if (payload.graduationYear !== undefined) {
    const yr = sanitizeText(payload.graduationYear, 12);
    if (yr && !/^(19|20)\d{2}$/.test(yr)) {
      return { valid: false, error: 'Graduation year must be a 4-digit year (e.g., 2027).' };
    }
    updates.graduationYear = yr;
  }

  if (payload.location !== undefined) {
    updates.location = sanitizeText(payload.location, 100);
  }

  if (payload.skills !== undefined) {
    updates.skills = parseStudentSkills(payload.skills);
  }

  if (payload.bio !== undefined) {
    updates.bio = sanitizeText(payload.bio, 600);
  }

  if (payload.linkedinUrl !== undefined) {
    const check = validateOptionalLinkedInUrl(payload.linkedinUrl);
    if (!check.valid) return { valid: false, error: check.error };
    updates.linkedinUrl = check.data || '';
  }

  if (payload.orcidId !== undefined) {
    const check = validateOptionalOrcidId(payload.orcidId);
    if (!check.valid) return { valid: false, error: check.error };
    updates.orcidId = check.data || '';
  }

  return { valid: true, data: updates };
}

export function validateDeletionRequestInput(payload: Record<string, unknown>): ValidationResult<{
  password: string;
  reason: string;
  mode: 'request' | 'delete_now';
}> {
  const password = typeof payload?.password === 'string' ? payload.password : '';
  if (!password) {
    return { valid: false, error: 'Please enter your current password to confirm this request.' };
  }
  const confirmation = sanitizeText(payload?.confirmation, 20).toUpperCase();
  if (confirmation !== 'DELETE') {
    return { valid: false, error: 'Please type DELETE to confirm your account deletion request.' };
  }
  const mode = payload?.mode === 'delete_now' ? 'delete_now' : 'request';
  const reason = sanitizeText(payload?.reason, 400);
  return { valid: true, data: { password, reason, mode } };
}

// -------------------------------------------------------------------------
// Dedicated Student Auth Rate Limiter
// -------------------------------------------------------------------------

interface RateBucket {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

export class StudentAuthRateLimiter {
  private buckets = new Map<string, RateBucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(
    maxAttempts: number = STUDENT_MAX_AUTH_ATTEMPTS,
    windowMs: number = STUDENT_RATE_WINDOW_MS,
    lockoutMs: number = STUDENT_LOCKOUT_MS
  ) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
  }

  public check(
    key: string,
    now: number = Date.now()
  ): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }
    if (bucket.lockedUntil && bucket.lockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000),
      };
    }
    if (now - bucket.windowStart > this.windowMs) {
      this.buckets.delete(key);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }
    const remaining = Math.max(0, this.maxAttempts - bucket.count);
    return { allowed: remaining > 0, remainingAttempts: remaining };
  }

  public consume(
    key: string,
    now: number = Date.now()
  ): { allowed: boolean; remainingAttempts: number; isLocked: boolean; retryAfterSec?: number } {
    const current = this.check(key, now);
    if (!current.allowed) {
      return {
        allowed: false,
        remainingAttempts: 0,
        isLocked: true,
        retryAfterSec: current.retryAfterSec,
      };
    }

    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart > this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now, lockedUntil: null });
      return {
        allowed: true,
        remainingAttempts: Math.max(0, this.maxAttempts - 1),
        isLocked: false,
      };
    }

    bucket.count += 1;
    if (bucket.count >= this.maxAttempts) {
      bucket.lockedUntil = now + this.lockoutMs;
      return {
        allowed: false,
        remainingAttempts: 0,
        isLocked: true,
        retryAfterSec: Math.ceil(this.lockoutMs / 1000),
      };
    }

    return {
      allowed: true,
      remainingAttempts: Math.max(0, this.maxAttempts - bucket.count),
      isLocked: false,
    };
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }

  public clear(): void {
    this.buckets.clear();
  }
}
