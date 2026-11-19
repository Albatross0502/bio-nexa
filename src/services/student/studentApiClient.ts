/**
 * Phase 14: Student Authentication & Profile API Client
 * Communicates with /api/student/* endpoints using HttpOnly session cookies.
 */

export interface StudentProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'student';
  permissions: string[];
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
  accountStatus: 'active' | 'deletion_pending' | 'suspended';
  deletionRequestedAt: string | null;
  deletionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSessionSummary {
  jti: string;
  userAgent: string;
  ipAddressMasked: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface StudentRegisterPayload {
  fullName: string;
  email: string;
  password: string;
  degreeTitle?: string;
  institution?: string;
  specialization?: string;
  graduationYear?: string;
  privacyConsent: boolean;
}

export interface StudentProfileUpdatePayload {
  fullName?: string;
  degreeTitle?: string;
  institution?: string;
  specialization?: string;
  graduationYear?: string;
  location?: string;
  skills?: string[] | string;
  bio?: string;
  linkedinUrl?: string;
  orcidId?: string;
}

class StudentApiError extends Error {
  status: number;
  code?: string;
  remainingAttempts?: number;
  retryAfterSec?: number;

  constructor(
    message: string,
    status: number,
    extra?: { code?: string; remainingAttempts?: number; retryAfterSec?: number }
  ) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
    this.code = extra?.code;
    this.remainingAttempts = extra?.remainingAttempts;
    this.retryAfterSec = extra?.retryAfterSec;
  }
}

async function studentRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new StudentApiError(
      data?.message || data?.error || `Request failed (${response.status})`,
      response.status,
      {
        code: data?.code,
        remainingAttempts: data?.remainingAttempts,
        retryAfterSec: data?.retryAfterSec,
      }
    );
  }
  return data as T;
}

export const studentApi = {
  async getSession(): Promise<{
    authenticated: boolean;
    student: StudentProfile | null;
    session?: { jti: string; expiresAt: string } | null;
  }> {
    return studentRequest('/api/student/me', { method: 'GET' });
  },

  async register(payload: StudentRegisterPayload): Promise<{
    success: boolean;
    student: StudentProfile;
    message: string;
    verificationRequired: boolean;
    devVerificationToken?: string;
    devVerificationUrl?: string;
  }> {
    return studentRequest('/api/student/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    student: StudentProfile;
    message: string;
  }> {
    return studentRequest('/api/student/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ success: boolean; message: string }> {
    return studentRequest('/api/student/logout', { method: 'POST' });
  },

  async verifyEmail(token: string): Promise<{
    success: boolean;
    message: string;
    student?: StudentProfile;
  }> {
    return studentRequest('/api/student/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async resendVerification(): Promise<{
    success: boolean;
    message: string;
    devVerificationToken?: string;
    devVerificationUrl?: string;
  }> {
    return studentRequest('/api/student/resend-verification', { method: 'POST' });
  },

  async requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
    devResetToken?: string;
    devResetUrl?: string;
  }> {
    return studentRequest('/api/student/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(
    token: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return studentRequest('/api/student/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  async updateProfile(payload: StudentProfileUpdatePayload): Promise<{
    success: boolean;
    student: StudentProfile;
    message: string;
  }> {
    return studentRequest('/api/student/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return studentRequest('/api/student/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async listSessions(): Promise<{
    success: boolean;
    sessions: StudentSessionSummary[];
  }> {
    return studentRequest('/api/student/sessions', { method: 'GET' });
  },

  async revokeSession(jti: string): Promise<{
    success: boolean;
    message: string;
    revokedCurrent?: boolean;
  }> {
    return studentRequest(`/api/student/sessions/${encodeURIComponent(jti)}`, {
      method: 'DELETE',
    });
  },

  async revokeOtherSessions(): Promise<{
    success: boolean;
    revokedCount: number;
    message: string;
  }> {
    return studentRequest('/api/student/sessions/revoke-others', {
      method: 'POST',
    });
  },

  async requestAccountDeletion(payload: {
    password: string;
    confirmation: string;
    reason?: string;
    mode?: 'request' | 'delete_now';
  }): Promise<{
    success: boolean;
    deletedImmediately: boolean;
    requestId?: string;
    student?: StudentProfile | null;
    message: string;
  }> {
    return studentRequest('/api/student/deletion-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelAccountDeletion(): Promise<{
    success: boolean;
    student: StudentProfile;
    message: string;
  }> {
    return studentRequest('/api/student/deletion-request', {
      method: 'DELETE',
    });
  },
};
