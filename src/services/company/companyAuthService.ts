/**
 * BIO-INEXA Company & Employer Authentication Domain Service (Phase 15)
 *
 * Pure, server-compatible security, validation, RBAC permission, verification policy,
 * privacy, and rate-limiting utilities for genuine company/employer accounts.
 *
 * Key invariants:
 * - Passwords use salted Node scrypt + timingSafeEqual.
 * - Registered companies are NEVER automatically treated as verified employers.
 * - Unverified employers CANNOT publish opportunities as verified.
 * - Company accounts are strictly isolated from administrator permissions/APIs.
 */

import crypto from 'node:crypto';
import {
  hashEmailForAudit,
  hashOpaqueToken,
  hashStudentPassword,
  maskIpAddress,
  StudentAuthRateLimiter,
  validateStudentPasswordStrength,
  verifyStudentPassword,
} from '../student/studentAuthService';

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
}

export function evaluatePasswordStrength(
  password: string,
  email?: string
): PasswordStrengthResult {
  const res = validateStudentPasswordStrength(password, email);
  return {
    valid: res.valid,
    errors: res.valid ? [] : [res.error || 'Password does not meet security requirements.'],
  };
}

export function generateOpaqueToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export {
  hashEmailForAudit,
  hashOpaqueToken,
  maskIpAddress,
};

export const COMPANY_SESSION_COOKIE = 'bionexa_company_session';
export const COMPANY_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const COMPANY_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COMPANY_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type CompanyVerificationStatus =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'rejected';

export type CompanyAccountStatus = 'active' | 'suspended';

export type ApplicationDestinationType =
  | 'external_url'
  | 'email'
  | 'bionexa_portal';

export type CompanyOrganizationType =
  | 'Private Biopharma'
  | 'Biotech Startup'
  | 'Academic / Research Institute'
  | 'Government / Autonomous'
  | 'Diagnostics & CRO'
  | 'Agritech / Industrial Biotech'
  | 'Non-Profit / Foundation';

export const ALLOWED_COMPANY_ORGANIZATION_TYPES: readonly CompanyOrganizationType[] = [
  'Private Biopharma',
  'Biotech Startup',
  'Academic / Research Institute',
  'Government / Autonomous',
  'Diagnostics & CRO',
  'Agritech / Industrial Biotech',
  'Non-Profit / Foundation',
] as const;

export const ALLOWED_APPLICATION_DESTINATION_TYPES: readonly ApplicationDestinationType[] = [
  'external_url',
  'email',
  'bionexa_portal',
] as const;

export type CompanyPermission =
  | 'company:profile:read'
  | 'company:profile:write'
  | 'company:verification:submit'
  | 'company:jobs:read'
  | 'company:jobs:submit'
  | 'company:jobs:edit'
  | 'company:jobs:delete'
  | 'company:jobs:publish_verified'
  | 'company:sessions:manage'
  | 'company:audit:read';

export const ALL_COMPANY_PERMISSIONS: readonly CompanyPermission[] = [
  'company:profile:read',
  'company:profile:write',
  'company:verification:submit',
  'company:jobs:read',
  'company:jobs:submit',
  'company:jobs:edit',
  'company:jobs:delete',
  'company:jobs:publish_verified',
  'company:sessions:manage',
  'company:audit:read',
] as const;

export interface CompanyAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  organizationName: string;
  organizationType: string;
  officialWebsite: string;
  headquartersLocation: string;
  organizationSize: string;
  foundedYear: string;
  industryFocus: string;
  description: string;
  registrationIdentifier: string;
  linkedinUrl: string;
  defaultApplicationDestinationType: ApplicationDestinationType;
  defaultApplicationUrl: string;
  defaultApplicationEmail: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  verificationStatus: CompanyVerificationStatus;
  verificationSubmittedAt: string | null;
  verificationEvidenceUrl: string;
  verificationNotes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string;
  accountStatus: CompanyAccountStatus;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string;
  privacyConsentAccepted: boolean;
  privacyConsentAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafeCompanyProfile {
  id: string;
  role: 'company';
  email: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  organizationName: string;
  organizationType: string;
  officialWebsite: string;
  headquartersLocation: string;
  organizationSize: string;
  foundedYear: string;
  industryFocus: string;
  description: string;
  registrationIdentifier: string;
  linkedinUrl: string;
  defaultApplicationDestinationType: ApplicationDestinationType;
  defaultApplicationUrl: string;
  defaultApplicationEmail: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  verificationStatus: CompanyVerificationStatus;
  verificationSubmittedAt: string | null;
  verificationEvidenceUrl: string;
  verificationNotes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string;
  accountStatus: CompanyAccountStatus;
  suspendedAt: string | null;
  suspensionReason: string;
  privacyConsentAccepted: boolean;
  privacyConsentAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  canPublishAsVerified: boolean;
  permissions: CompanyPermission[];
}

export interface CompanySessionRecord {
  jti: string;
  companyId: string;
  userAgent: string;
  ipMasked: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent?: boolean;
}

export interface CompanyAuditLogRecord {
  id: string;
  companyId: string;
  organizationName?: string;
  actorType: 'company' | 'admin' | 'system';
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  status: 'success' | 'denied' | 'failure';
  ipMasked: string;
  details: string;
  createdAt: string;
}

export interface CompanyRegistrationInput {
  contactName: string;
  contactTitle?: string;
  contactPhone?: string;
  email: string;
  password: string;
  organizationName: string;
  organizationType?: string;
  officialWebsite: string;
  headquartersLocation: string;
  organizationSize?: string;
  foundedYear?: string;
  industryFocus?: string;
  description?: string;
  registrationIdentifier?: string;
  privacyConsentAccepted: boolean;
}

export interface CompanyProfileUpdateInput {
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  organizationName?: string;
  organizationType?: string;
  officialWebsite?: string;
  headquartersLocation?: string;
  organizationSize?: string;
  foundedYear?: string;
  industryFocus?: string;
  description?: string;
  registrationIdentifier?: string;
  linkedinUrl?: string;
  defaultApplicationDestinationType?: ApplicationDestinationType;
  defaultApplicationUrl?: string;
  defaultApplicationEmail?: string;
}

export interface EmployerVerificationSubmissionInput {
  officialWebsite?: string;
  registrationIdentifier?: string;
  verificationEvidenceUrl?: string;
  verificationNotes: string;
}

export interface CompanyJobInput {
  title: string;
  location: string;
  type: string;
  sector: string;
  experienceLevel: string;
  qualification: string;
  salary?: string;
  deadline: string;
  description: string;
  responsibilities?: string[] | string;
  requirements?: string[] | string;
  skills?: string[] | string;
  applicationDestinationType: ApplicationDestinationType;
  applicationUrl?: string;
  applicationEmail?: string;
  applicationInstructions?: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  error?: string;
  field?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'placeholder.com',
]);

// Reuse salted scrypt hashing & constant-time verification
export function hashCompanyPassword(password: string): string {
  return hashStudentPassword(password);
}

export function verifyCompanyPassword(password: string, storedHash: string): boolean {
  return verifyStudentPassword(password, storedHash);
}

export function normalizeCompanyEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function normalizeVerificationStatus(raw?: string | null): CompanyVerificationStatus {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'verified') return 'verified';
  if (val === 'pending_review' || val === 'pending') return 'pending_review';
  if (val === 'rejected') return 'rejected';
  return 'unverified';
}

export function normalizeAccountStatus(raw?: string | null): CompanyAccountStatus {
  return String(raw || '').trim().toLowerCase() === 'suspended' ? 'suspended' : 'active';
}

export function normalizeApplicationDestinationType(raw?: string | null): ApplicationDestinationType {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'email' || val === 'direct_email') return 'email';
  if (val === 'bionexa_portal' || val === 'internal' || val === 'portal') return 'bionexa_portal';
  return 'external_url';
}

export function isValidCompanyHttpUrl(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes('.') || DISALLOWED_HOSTNAMES.has(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isValidCompanyLinkedInUrl(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

function cleanText(input: unknown, maxLen: number): string {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function normalizeStringList(input: unknown, delimiter: RegExp, maxItems: number, maxItemLen: number): string[] {
  const rawList = Array.isArray(input)
    ? input.map((v) => String(v ?? ''))
    : typeof input === 'string'
    ? input.split(delimiter)
    : [];
  const dedup = new Set<string>();
  const out: string[] = [];
  for (const raw of rawList) {
    const item = cleanText(raw, maxItemLen);
    if (!item) continue;
    const key = item.toLowerCase();
    if (dedup.has(key)) continue;
    dedup.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

// --- RBAC & Employer Publishing Policy ---

export function getCompanyPermissions(account: {
  accountStatus: CompanyAccountStatus | string;
  emailVerified: boolean;
  verificationStatus: CompanyVerificationStatus | string;
}): CompanyPermission[] {
  if (normalizeAccountStatus(account.accountStatus) === 'suspended') {
    return [];
  }

  const perms: CompanyPermission[] = [
    'company:profile:read',
    'company:profile:write',
    'company:verification:submit',
    'company:jobs:read',
    'company:sessions:manage',
    'company:audit:read',
  ];

  if (account.emailVerified) {
    perms.push('company:jobs:submit', 'company:jobs:edit', 'company:jobs:delete');
  }

  if (account.emailVerified && normalizeVerificationStatus(account.verificationStatus) === 'verified') {
    perms.push('company:jobs:publish_verified');
  }

  return perms;
}

export function hasCompanyPermission(
  account: {
    accountStatus: CompanyAccountStatus | string;
    emailVerified: boolean;
    verificationStatus: CompanyVerificationStatus | string;
  },
  permission: CompanyPermission
): boolean {
  return getCompanyPermissions(account).includes(permission);
}

/**
 * Strict role isolation: company accounts are NEVER permitted to hold or invoke any admin permission.
 */
export function isCompanyAllowedAdminPermission(_adminPermission: string): boolean {
  return false;
}

export interface EmployerJobPublishPolicy {
  isApproved: boolean;
  status: 'Published' | 'Pending Review';
  verificationStatus: 'Verified' | 'Pending Verification';
  verificationNotes: string;
  featured: boolean;
  publishedAsVerified: boolean;
}

/**
 * Enforces the critical Phase 15 invariant:
 * - A registered company is NOT automatically treated as a verified employer.
 * - Unverified employers CANNOT publish opportunities as verified.
 */
export function resolveEmployerJobSubmissionPolicy(account: {
  organizationName: string;
  emailVerified: boolean;
  verificationStatus: CompanyVerificationStatus | string;
  accountStatus: CompanyAccountStatus | string;
}): EmployerJobPublishPolicy {
  const isVerifiedEmployer =
    normalizeAccountStatus(account.accountStatus) === 'active' &&
    Boolean(account.emailVerified) &&
    normalizeVerificationStatus(account.verificationStatus) === 'verified';

  if (isVerifiedEmployer) {
    return {
      isApproved: true,
      status: 'Published',
      verificationStatus: 'Verified',
      verificationNotes: `Published by BIO-INEXA verified employer (${account.organizationName}).`,
      featured: false,
      publishedAsVerified: true,
    };
  }

  return {
    isApproved: false,
    status: 'Pending Review',
    verificationStatus: 'Pending Verification',
    verificationNotes:
      'Submitted by an unverified employer account. Held for administrator employer-identity & listing review; cannot be published as verified until employer verification is approved.',
    featured: false,
    publishedAsVerified: false,
  };
}

export function toSafeCompanyProfile(account: CompanyAccountRecord): SafeCompanyProfile {
  const verificationStatus = normalizeVerificationStatus(account.verificationStatus);
  const accountStatus = normalizeAccountStatus(account.accountStatus);
  const permissions = getCompanyPermissions({
    accountStatus,
    emailVerified: Boolean(account.emailVerified),
    verificationStatus,
  });

  return {
    id: account.id,
    role: 'company',
    email: account.email,
    contactName: account.contactName,
    contactTitle: account.contactTitle || '',
    contactPhone: account.contactPhone || '',
    organizationName: account.organizationName,
    organizationType: account.organizationType || 'Private Biopharma',
    officialWebsite: account.officialWebsite || '',
    headquartersLocation: account.headquartersLocation || '',
    organizationSize: account.organizationSize || '',
    foundedYear: account.foundedYear || '',
    industryFocus: account.industryFocus || '',
    description: account.description || '',
    registrationIdentifier: account.registrationIdentifier || '',
    linkedinUrl: account.linkedinUrl || '',
    defaultApplicationDestinationType: normalizeApplicationDestinationType(
      account.defaultApplicationDestinationType
    ),
    defaultApplicationUrl: account.defaultApplicationUrl || '',
    defaultApplicationEmail: account.defaultApplicationEmail || '',
    emailVerified: Boolean(account.emailVerified),
    emailVerifiedAt: account.emailVerifiedAt || null,
    verificationStatus,
    verificationSubmittedAt: account.verificationSubmittedAt || null,
    verificationEvidenceUrl: account.verificationEvidenceUrl || '',
    verificationNotes: account.verificationNotes || '',
    verifiedBy: account.verifiedBy || null,
    verifiedAt: account.verifiedAt || null,
    rejectionReason: account.rejectionReason || '',
    accountStatus,
    suspendedAt: account.suspendedAt || null,
    suspensionReason: account.suspensionReason || '',
    privacyConsentAccepted: Boolean(account.privacyConsentAccepted),
    privacyConsentAt: account.privacyConsentAt || null,
    lastLoginAt: account.lastLoginAt || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    canPublishAsVerified: permissions.includes('company:jobs:publish_verified'),
    permissions,
  };
}

// --- Input Validators ---

export function validateCompanyRegistrationInput(
  raw: Partial<CompanyRegistrationInput>
): ValidationResult<CompanyRegistrationInput> {
  const contactName = cleanText(raw.contactName, 100);
  if (contactName.length < 2) {
    return { valid: false, field: 'contactName', error: 'Representative full name must be at least 2 characters.' };
  }

  const email = normalizeCompanyEmail(raw.email || '');
  if (!EMAIL_REGEX.test(email) || email.length > 160) {
    return { valid: false, field: 'email', error: 'Please provide a valid work email address.' };
  }

  const organizationName = cleanText(raw.organizationName, 140);
  if (organizationName.length < 2) {
    return { valid: false, field: 'organizationName', error: 'Organization name must be at least 2 characters.' };
  }

  const officialWebsite = cleanText(raw.officialWebsite, 300);
  if (!isValidCompanyHttpUrl(officialWebsite)) {
    return {
      valid: false,
      field: 'officialWebsite',
      error: 'Please enter a valid official organization website URL (https://...).',
    };
  }

  const headquartersLocation = cleanText(raw.headquartersLocation, 140);
  if (headquartersLocation.length < 2) {
    return { valid: false, field: 'headquartersLocation', error: 'Headquarters city/location is required.' };
  }

  const password = String(raw.password || '');
  const strength = evaluatePasswordStrength(password, email);
  if (!strength.valid) {
    return {
      valid: false,
      field: 'password',
      error: strength.errors[0] || 'Password does not meet security requirements.',
    };
  }

  if (raw.privacyConsentAccepted !== true) {
    return {
      valid: false,
      field: 'privacyConsentAccepted',
      error: 'You must accept the BIO-INEXA Employer Terms and Privacy Policy to register.',
    };
  }

  const orgTypeRaw = cleanText(raw.organizationType, 80);
  const organizationType = ALLOWED_COMPANY_ORGANIZATION_TYPES.includes(orgTypeRaw as CompanyOrganizationType)
    ? orgTypeRaw
    : 'Private Biopharma';

  const foundedYear = cleanText(raw.foundedYear, 4);
  if (foundedYear && !/^(18|19|20)\d{2}$/.test(foundedYear)) {
    return { valid: false, field: 'foundedYear', error: 'Founded year must be a valid 4-digit year.' };
  }

  return {
    valid: true,
    value: {
      contactName,
      contactTitle: cleanText(raw.contactTitle, 100),
      contactPhone: cleanText(raw.contactPhone, 30),
      email,
      password,
      organizationName,
      organizationType,
      officialWebsite,
      headquartersLocation,
      organizationSize: cleanText(raw.organizationSize, 60),
      foundedYear,
      industryFocus: cleanText(raw.industryFocus, 160),
      description: cleanText(raw.description, 1200),
      registrationIdentifier: cleanText(raw.registrationIdentifier, 100),
      privacyConsentAccepted: true,
    },
  };
}

export function validateCompanyProfileUpdateInput(
  raw: Partial<CompanyProfileUpdateInput>
): ValidationResult<CompanyProfileUpdateInput> {
  const out: CompanyProfileUpdateInput = {};

  if (raw.contactName !== undefined) {
    const contactName = cleanText(raw.contactName, 100);
    if (contactName.length < 2) {
      return { valid: false, field: 'contactName', error: 'Representative name must be at least 2 characters.' };
    }
    out.contactName = contactName;
  }

  if (raw.contactTitle !== undefined) out.contactTitle = cleanText(raw.contactTitle, 100);
  if (raw.contactPhone !== undefined) out.contactPhone = cleanText(raw.contactPhone, 30);

  if (raw.organizationName !== undefined) {
    const organizationName = cleanText(raw.organizationName, 140);
    if (organizationName.length < 2) {
      return { valid: false, field: 'organizationName', error: 'Organization name must be at least 2 characters.' };
    }
    out.organizationName = organizationName;
  }

  if (raw.organizationType !== undefined) {
    const orgType = cleanText(raw.organizationType, 80);
    if (orgType && !ALLOWED_COMPANY_ORGANIZATION_TYPES.includes(orgType as CompanyOrganizationType)) {
      return { valid: false, field: 'organizationType', error: 'Unsupported organization type selected.' };
    }
    out.organizationType = orgType || 'Private Biopharma';
  }

  if (raw.officialWebsite !== undefined) {
    const url = cleanText(raw.officialWebsite, 300);
    if (!isValidCompanyHttpUrl(url)) {
      return { valid: false, field: 'officialWebsite', error: 'Official website must be a valid public HTTP(S) URL.' };
    }
    out.officialWebsite = url;
  }

  if (raw.headquartersLocation !== undefined) {
    const loc = cleanText(raw.headquartersLocation, 140);
    if (loc.length < 2) {
      return { valid: false, field: 'headquartersLocation', error: 'Headquarters location must be at least 2 characters.' };
    }
    out.headquartersLocation = loc;
  }

  if (raw.organizationSize !== undefined) out.organizationSize = cleanText(raw.organizationSize, 60);

  if (raw.foundedYear !== undefined) {
    const fy = cleanText(raw.foundedYear, 4);
    if (fy && !/^(18|19|20)\d{2}$/.test(fy)) {
      return { valid: false, field: 'foundedYear', error: 'Founded year must be a valid 4-digit year.' };
    }
    out.foundedYear = fy;
  }

  if (raw.industryFocus !== undefined) out.industryFocus = cleanText(raw.industryFocus, 160);
  if (raw.description !== undefined) out.description = cleanText(raw.description, 1500);
  if (raw.registrationIdentifier !== undefined) out.registrationIdentifier = cleanText(raw.registrationIdentifier, 100);

  if (raw.linkedinUrl !== undefined) {
    const li = cleanText(raw.linkedinUrl, 300);
    if (li && !isValidCompanyLinkedInUrl(li)) {
      return { valid: false, field: 'linkedinUrl', error: 'LinkedIn URL must point to linkedin.com.' };
    }
    out.linkedinUrl = li;
  }

  if (raw.defaultApplicationDestinationType !== undefined) {
    out.defaultApplicationDestinationType = normalizeApplicationDestinationType(
      raw.defaultApplicationDestinationType
    );
  }

  if (raw.defaultApplicationUrl !== undefined) {
    const appUrl = cleanText(raw.defaultApplicationUrl, 500);
    if (appUrl && !isValidCompanyHttpUrl(appUrl)) {
      return {
        valid: false,
        field: 'defaultApplicationUrl',
        error: 'Default application portal URL must be a valid public HTTP(S) URL.',
      };
    }
    out.defaultApplicationUrl = appUrl;
  }

  if (raw.defaultApplicationEmail !== undefined) {
    const appEmail = normalizeCompanyEmail(raw.defaultApplicationEmail);
    if (appEmail && !EMAIL_REGEX.test(appEmail)) {
      return {
        valid: false,
        field: 'defaultApplicationEmail',
        error: 'Default application email must be a valid email address.',
      };
    }
    out.defaultApplicationEmail = appEmail;
  }

  return { valid: true, value: out };
}

export function validateEmployerVerificationSubmission(
  raw: Partial<EmployerVerificationSubmissionInput>,
  fallbackWebsite?: string
): ValidationResult<{
  officialWebsite: string;
  registrationIdentifier: string;
  verificationEvidenceUrl: string;
  verificationNotes: string;
}> {
  const officialWebsite = cleanText(raw.officialWebsite || fallbackWebsite || '', 300);
  if (!isValidCompanyHttpUrl(officialWebsite)) {
    return {
      valid: false,
      field: 'officialWebsite',
      error: 'A valid official organization website is required for employer verification.',
    };
  }

  const registrationIdentifier = cleanText(raw.registrationIdentifier, 100);
  const verificationEvidenceUrl = cleanText(raw.verificationEvidenceUrl, 500);
  if (verificationEvidenceUrl && !isValidCompanyHttpUrl(verificationEvidenceUrl)) {
    return {
      valid: false,
      field: 'verificationEvidenceUrl',
      error: 'Verification evidence URL (e.g., official careers page or institutional registry) must be a valid HTTP(S) URL.',
    };
  }

  const verificationNotes = cleanText(raw.verificationNotes, 1500);
  if (verificationNotes.length < 15) {
    return {
      valid: false,
      field: 'verificationNotes',
      error: 'Please provide at least 15 characters explaining your organization identity and hiring authority.',
    };
  }

  if (!registrationIdentifier && !verificationEvidenceUrl) {
    return {
      valid: false,
      field: 'registrationIdentifier',
      error: 'Please provide either an official Registration/CIN/AISHE Identifier or an official Careers/Registry URL.',
    };
  }

  return {
    valid: true,
    value: {
      officialWebsite,
      registrationIdentifier,
      verificationEvidenceUrl,
      verificationNotes,
    },
  };
}

export function validateCompanyJobInput(
  raw: Partial<CompanyJobInput>
): ValidationResult<{
  title: string;
  location: string;
  type: string;
  sector: string;
  experienceLevel: string;
  qualification: string;
  salary: string;
  deadline: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  applicationDestinationType: ApplicationDestinationType;
  applicationUrl: string;
  applicationEmail: string;
  applicationInstructions: string;
}> {
  const title = cleanText(raw.title, 160);
  if (title.length < 4) {
    return { valid: false, field: 'title', error: 'Job title must be at least 4 characters.' };
  }

  const location = cleanText(raw.location, 140);
  if (location.length < 2) {
    return { valid: false, field: 'location', error: 'Work location is required.' };
  }

  const description = cleanText(raw.description, 5000);
  if (description.length < 25) {
    return { valid: false, field: 'description', error: 'Role description must be at least 25 characters.' };
  }

  const deadline = cleanText(raw.deadline, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return { valid: false, field: 'deadline', error: 'Application deadline must be a valid YYYY-MM-DD date.' };
  }

  const applicationDestinationType = normalizeApplicationDestinationType(raw.applicationDestinationType);
  let applicationUrl = cleanText(raw.applicationUrl, 500);
  let applicationEmail = normalizeCompanyEmail(raw.applicationEmail || '');
  const applicationInstructions = cleanText(raw.applicationInstructions, 500);

  if (applicationDestinationType === 'external_url') {
    if (!isValidCompanyHttpUrl(applicationUrl)) {
      return {
        valid: false,
        field: 'applicationUrl',
        error: 'External Application Destination requires a valid official careers URL (https://...).',
      };
    }
    applicationEmail = '';
  } else if (applicationDestinationType === 'email') {
    if (!EMAIL_REGEX.test(applicationEmail)) {
      return {
        valid: false,
        field: 'applicationEmail',
        error: 'Direct Email Destination requires a valid recruiter email address.',
      };
    }
    applicationUrl = `mailto:${applicationEmail}`;
  } else {
    // bionexa_portal
    applicationUrl = '';
    applicationEmail = '';
  }

  return {
    valid: true,
    value: {
      title,
      location,
      type: cleanText(raw.type, 50) || 'Full-time',
      sector: cleanText(raw.sector, 80) || 'Private Biopharma',
      experienceLevel: cleanText(raw.experienceLevel, 60) || 'Mid-level (2-5 yrs)',
      qualification: cleanText(raw.qualification, 80) || 'M.Sc / M.Tech',
      salary: cleanText(raw.salary, 120) || 'Competitive / As per institutional norms',
      deadline,
      description,
      responsibilities: normalizeStringList(raw.responsibilities, /\r?\n/, 20, 240),
      requirements: normalizeStringList(raw.requirements, /\r?\n/, 20, 240),
      skills: normalizeStringList(raw.skills, /[,;\n]/, 25, 60),
      applicationDestinationType,
      applicationUrl,
      applicationEmail,
      applicationInstructions,
    },
  };
}

export class CompanyAuthRateLimiter extends StudentAuthRateLimiter {}

export function generateCompanyAuditId(): string {
  return `caudit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
