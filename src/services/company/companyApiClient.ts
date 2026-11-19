/**
 * BIO-INEXA Company & Employer API Client (Phase 15)
 *
 * Strictly uses server-issued HttpOnly cookies (`credentials: 'include'`).
 * Never stores company session secrets in localStorage or sessionStorage.
 */

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

export interface CompanyProfile {
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
  permissions: string[];
}

export interface CompanySessionSummary {
  jti: string;
  userAgent: string;
  ipMasked: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface CompanyAuditLogEntry {
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

export interface CompanyJobRecord {
  id: string;
  slug: string;
  title: string;
  company: string;
  companyAccountId?: string;
  sector: string;
  location: string;
  type: string;
  salary: string;
  qualification: string;
  experienceLevel: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  deadline: string;
  postedDate: string;
  applicationDestinationType: ApplicationDestinationType;
  applicationUrl: string;
  applicationEmail: string;
  applicationInstructions: string;
  status: string;
  isApproved: boolean;
  isExpired: boolean;
  featured: boolean;
  verificationStatus: string;
  verificationNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRegisterPayload {
  contactName: string;
  contactTitle?: string;
  contactPhone?: string;
  email: string;
  password: string;
  organizationName: string;
  organizationType: string;
  officialWebsite: string;
  headquartersLocation: string;
  organizationSize?: string;
  foundedYear?: string;
  industryFocus?: string;
  description?: string;
  registrationIdentifier?: string;
  privacyConsentAccepted: boolean;
}

export interface CompanyProfileUpdatePayload {
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

export interface CompanyJobPayload {
  title: string;
  location: string;
  type: string;
  sector: string;
  experienceLevel: string;
  qualification: string;
  salary?: string;
  deadline: string;
  description: string;
  responsibilities: string[] | string;
  requirements: string[] | string;
  skills: string[] | string;
  applicationDestinationType: ApplicationDestinationType;
  applicationUrl?: string;
  applicationEmail?: string;
  applicationInstructions?: string;
}

async function parseCompanyJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallbackMessage);
    (err as any).status = res.status;
    (err as any).code = data.code;
    (err as any).field = data.field;
    (err as any).retryAfterSec = data.retryAfterSec;
    throw err;
  }
  return data as T;
}

class CompanyApiClient {
  private headers(): HeadersInit {
    return { 'Content-Type': 'application/json' };
  }

  public async getSession(): Promise<{ authenticated: boolean; company: CompanyProfile | null }> {
    try {
      const res = await fetch('/api/company/me', {
        credentials: 'include',
        headers: this.headers(),
      });
      if (!res.ok) return { authenticated: false, company: null };
      const data = await res.json().catch(() => ({}));
      return {
        authenticated: Boolean(data.authenticated && data.company),
        company: data.company || null,
      };
    } catch {
      return { authenticated: false, company: null };
    }
  }

  public async register(payload: CompanyRegisterPayload): Promise<{
    success: boolean;
    company: CompanyProfile;
    message: string;
    verificationRequired: boolean;
    devVerificationToken?: string;
  }> {
    const res = await fetch('/api/company/register', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return parseCompanyJson(res, 'Company registration failed.');
  }

  public async login(email: string, password: string): Promise<{
    success: boolean;
    company: CompanyProfile;
    message: string;
  }> {
    const res = await fetch('/api/company/login', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    return parseCompanyJson(res, 'Sign in failed.');
  }

  public async logout(): Promise<void> {
    await fetch('/api/company/logout', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
    });
  }

  public async verifyEmail(token: string): Promise<{
    success: boolean;
    company: CompanyProfile;
    message: string;
  }> {
    const res = await fetch('/api/company/verify-email', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ token }),
    });
    return parseCompanyJson(res, 'Email verification failed.');
  }

  public async resendVerification(): Promise<{
    success: boolean;
    message: string;
    devVerificationToken?: string;
  }> {
    const res = await fetch('/api/company/resend-verification', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to resend verification token.');
  }

  public async requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
    devResetToken?: string;
  }> {
    const res = await fetch('/api/company/password-reset/request', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ email }),
    });
    return parseCompanyJson(res, 'Unable to initiate password reset.');
  }

  public async confirmPasswordReset(token: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const res = await fetch('/api/company/password-reset/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ token, newPassword }),
    });
    return parseCompanyJson(res, 'Unable to reset password.');
  }

  public async updateProfile(payload: CompanyProfileUpdatePayload): Promise<{
    success: boolean;
    company: CompanyProfile;
    message: string;
  }> {
    const res = await fetch('/api/company/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return parseCompanyJson(res, 'Unable to update organization profile.');
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
    revokedOtherSessions?: number;
  }> {
    const res = await fetch('/api/company/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return parseCompanyJson(res, 'Unable to change password.');
  }

  public async submitVerification(payload: {
    officialWebsite: string;
    registrationIdentifier?: string;
    verificationEvidenceUrl?: string;
    verificationNotes: string;
  }): Promise<{
    success: boolean;
    company: CompanyProfile;
    message: string;
  }> {
    const res = await fetch('/api/company/verification/submit', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return parseCompanyJson(res, 'Unable to submit employer verification.');
  }

  public async listJobs(): Promise<{
    success: boolean;
    jobs: CompanyJobRecord[];
    summary: {
      total: number;
      published: number;
      pendingReview: number;
      rejected: number;
      expired: number;
      closed: number;
    };
  }> {
    const res = await fetch('/api/company/jobs', {
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to load organization openings.');
  }

  public async submitJob(payload: CompanyJobPayload): Promise<{
    success: boolean;
    job: CompanyJobRecord;
    publishedAsVerified: boolean;
    message: string;
  }> {
    const res = await fetch('/api/company/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return parseCompanyJson(res, 'Unable to submit job opening.');
  }

  public async updateJob(id: string, payload: CompanyJobPayload): Promise<{
    success: boolean;
    job: CompanyJobRecord;
    message: string;
  }> {
    const res = await fetch(`/api/company/jobs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return parseCompanyJson(res, 'Unable to update job opening.');
  }

  public async updateJobStatus(id: string, action: 'close' | 'reopen'): Promise<{
    success: boolean;
    job: CompanyJobRecord;
    message: string;
  }> {
    const res = await fetch(`/api/company/jobs/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.headers(),
      body: JSON.stringify({ action }),
    });
    return parseCompanyJson(res, 'Unable to update job status.');
  }

  public async deleteJob(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/company/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to delete job opening.');
  }

  public async listSessions(): Promise<{ success: boolean; sessions: CompanySessionSummary[] }> {
    const res = await fetch('/api/company/sessions', {
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to load active sessions.');
  }

  public async revokeSession(jti: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/company/sessions/${encodeURIComponent(jti)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to revoke session.');
  }

  public async revokeOtherSessions(): Promise<{
    success: boolean;
    revokedCount: number;
    message: string;
  }> {
    const res = await fetch('/api/company/sessions/revoke-others', {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to sign out other devices.');
  }

  public async getAuditLogs(): Promise<{ success: boolean; logs: CompanyAuditLogEntry[] }> {
    const res = await fetch('/api/company/audit-logs', {
      credentials: 'include',
      headers: this.headers(),
    });
    return parseCompanyJson(res, 'Unable to load company audit logs.');
  }
}

export const companyApi = new CompanyApiClient();
