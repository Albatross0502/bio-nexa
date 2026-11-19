/**
 * BIO-INEXA Admin API Client
 *
 * Communicates with the protected /api/admin/* endpoints.
 * Relies strictly on server-issued HttpOnly session cookies (credentials: 'include').
 * Never stores tokens or administrator credentials in JavaScript storage.
 */

import type { AdminDashboardStats, AdminExportDataset } from './adminHelpers';

export type { AdminDashboardStats, AdminExportDataset };

export type AdminUserRole = 'super_admin' | 'moderator' | 'verifier' | 'editor' | 'admin';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: AdminUserRole;
  permissions?: string[];
}

export interface AdminJob {
  id: string;
  title: string;
  company: string;
  employer?: string;
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
  expiryDate?: string;
  publicationDate?: string;
  applicationUrl: string;
  originalJobUrl?: string;
  status: string;
  featured: boolean;
  isApproved: boolean;
  isExpired: boolean;
  sourceName?: string;
  originalSource?: string;
  sourceUrl?: string;
  postedDate?: string;
  verificationStatus?: string;
  lastVerificationDate?: string;
  verificationNotes?: string;
}

export interface AdminInternship {
  id: string;
  slug?: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  workMode: string;
  stipend: string;
  duration: string;
  deadline: string;
  category: string;
  eligibility: string;
  description: string;
  learningOutcomes?: string[];
  skillsRequired: string[];
  sourceName?: string;
  sourceUrl?: string;
  applicationUrl: string;
  verificationStatus?: string;
  verificationNotes?: string;
  lastVerificationDate?: string;
  status: string;
  isApproved: boolean;
  isActive: boolean;
  featured: boolean;
}

export interface AdminSyncLog {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  itemsFetched: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsExpired: number;
  details: string;
  createdAt: string;
}

export interface AdminWorkshop {
  id: string;
  title: string;
  name?: string;
  organizer: string;
  instructor?: string;
  category?: string;
  location: string;
  venue?: string;
  workMode: string;
  format?: 'Online' | 'Offline' | 'Hybrid';
  startDate: string;
  endDate: string;
  date?: string;
  time?: string;
  duration: string;
  fees: string;
  capacity?: number | null;
  registrationUrl: string;
  registrationLink?: string;
  registrationDeadline?: string;
  availability?: string;
  description: string;
  imageUrl?: string;
  featured?: boolean;
  skillsCovered: string[];
  status: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  isApproved: boolean;
  isExpired?: boolean;
}

export interface AdminCourse {
  id: string;
  title: string;
  name?: string;
  provider: string;
  providerType?: 'third_party' | 'bionexa';
  instructor: string;
  category: string;
  duration: string;
  level: string;
  deliveryMode: string;
  fees: string;
  price: string;
  pricingType?: 'free' | 'paid';
  eligibility: string;
  description: string;
  curriculum: string[];
  syllabus: string[];
  prerequisites?: string[];
  certificateInfo?: string;
  isCertificateAvailable: boolean;
  registrationDeadline: string;
  registrationUrl: string;
  registrationLink?: string;
  imageUrl?: string;
  status: 'available' | 'closed';
  availability?: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  isApproved?: boolean;
  isExpired?: boolean;
  featured: boolean;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  tag: string;
  date: string;
  link: string;
  active: boolean;
}

export interface WebsiteContent {
  announcements: AnnouncementItem[];
  featuredOpportunityIds: string[];
  homepageHighlights: {
    heroBadge: string;
    bannerNotice: string;
    activeVacanciesCount: string;
    participatingInstitutesCount: string;
  };
}

export interface AdminSubmittedOpportunity {
  id: string;
  title: string;
  organization: string;
  type: string;
  subCategory: string;
  description: string;
  location: string;
  workMode: string;
  experience: string;
  qualification: string;
  branches: string[];
  skills: string[];
  salaryOrStipend: string;
  salaryTier: string;
  deadline: string;
  postedDate: string;
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string;
  contactEmail: string;
  workshopDetails?: Record<string, unknown> | null;
  isApproved: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminComplianceRequest {
  id: string;
  referenceId: string;
  requestType: string;
  subCategory: string;
  requesterName: string;
  requesterEmail: string;
  organization: string;
  targetTitleOrUrl: string;
  details: string;
  status: string;
  resolutionNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminContactMessage {
  id: string;
  referenceId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface AdminCompanyAccount {
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
  defaultApplicationDestinationType: 'external_url' | 'email' | 'bionexa_portal';
  defaultApplicationUrl: string;
  defaultApplicationEmail: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  verificationStatus: 'unverified' | 'pending_review' | 'verified' | 'rejected';
  verificationSubmittedAt: string | null;
  verificationEvidenceUrl: string;
  verificationNotes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string;
  accountStatus: 'active' | 'suspended';
  suspendedAt: string | null;
  suspensionReason: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  canPublishAsVerified: boolean;
  permissions: string[];
  jobCount: number;
}

export interface AdminCompanyAuditLogEntry {
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

async function parseJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallbackMessage);
    (err as any).status = res.status;
    (err as any).code = data.code;
    throw err;
  }
  return data as T;
}

class AdminApiClient {
  private getHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(extraHeaders as Record<string, string>)
    };
  }

  public async login(
    username: string,
    password: string,
    totpCode?: string
  ): Promise<{ success: boolean; user: AdminUser; permissions?: string[]; expiresAt?: number }> {
    const payload: Record<string, string> = { username, password };
    if (totpCode && totpCode.trim()) {
      payload.totpCode = totpCode.trim();
    }

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Login failed');
      (err as any).status = res.status;
      (err as any).code = data.code;
      (err as any).remainingAttempts = data.remainingAttempts ?? data.details?.remainingAttempts;
      (err as any).retryAfterSec = data.retryAfterSec ?? data.details?.retryAfterSec;
      (err as any).requires2fa = Boolean(
        data.requires2fa ?? data.details?.requires2fa ?? (data.code === 'MFA_REQUIRED' || data.code === 'INVALID_2FA_CODE')
      );
      throw err;
    }

    return data;
  }

  public async logout(): Promise<void> {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
  }

  public async checkAuth(): Promise<{ authenticated: boolean; user?: AdminUser }> {
    try {
      const res = await fetch('/api/admin/me', {
        credentials: 'include',
        headers: this.getHeaders()
      });
      if (!res.ok) {
        return { authenticated: false };
      }
      return res.json();
    } catch {
      return { authenticated: false };
    }
  }

  public async getDashboardData(): Promise<{
    stats?: AdminDashboardStats;
    jobs: AdminJob[];
    internships?: AdminInternship[];
    workshops: AdminWorkshop[];
    courses: AdminCourse[];
    courseCategories?: string[];
    content: WebsiteContent;
    submittedOpportunities?: AdminSubmittedOpportunity[];
    contactMessages?: AdminContactMessage[];
    complianceRequests?: AdminComplianceRequest[];
    syncHistory?: AdminSyncLog[];
    databaseEngine?: string;
    persistentDbConfigured?: boolean;
  }> {
    const res = await fetch('/api/admin/data', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, `Failed to fetch dashboard data: ${res.statusText}`);
  }

  // --- Jobs CRUD ---

  public async createJob(job: Partial<AdminJob>): Promise<AdminJob> {
    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(job)
    });
    const data = await parseJsonResponse<{ job: AdminJob }>(res, 'Failed to create job');
    return data.job;
  }

  public async updateJob(id: string, updates: Partial<AdminJob>): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ job: AdminJob }>(res, 'Failed to update job');
    return data.job;
  }

  public async deleteJob(id: string): Promise<void> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete job');
  }

  public async updateJobStatus(
    id: string,
    payload: {
      status?: string;
      isApproved?: boolean;
      isExpired?: boolean;
      verificationStatus?: string;
      verificationNotes?: string;
    }
  ): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await parseJsonResponse<{ job: AdminJob }>(res, 'Failed to update job status');
    return data.job;
  }

  // --- Internships CRUD & Verification ---

  public async getInternships(): Promise<AdminInternship[]> {
    const res = await fetch('/api/admin/internships', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ internships?: AdminInternship[] }>(res, 'Failed to load internships');
    return data.internships || [];
  }

  public async createInternship(internship: Partial<AdminInternship>): Promise<AdminInternship> {
    const res = await fetch('/api/admin/internships', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(internship)
    });
    const data = await parseJsonResponse<{ internship: AdminInternship }>(res, 'Failed to create internship');
    return data.internship;
  }

  public async updateInternship(id: string, updates: Partial<AdminInternship>): Promise<AdminInternship> {
    const res = await fetch(`/api/admin/internships/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ internship: AdminInternship }>(res, 'Failed to update internship');
    return data.internship;
  }

  public async updateInternshipStatus(
    id: string,
    payload: {
      status?: string;
      isApproved?: boolean;
      isActive?: boolean;
      verificationStatus?: string;
      verificationNotes?: string;
    }
  ): Promise<AdminInternship> {
    const res = await fetch(`/api/admin/internships/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await parseJsonResponse<{ internship: AdminInternship }>(res, 'Failed to update internship status');
    return data.internship;
  }

  public async verifyInternship(
    id: string,
    status: string = 'Verified',
    notes: string = '',
    lastVerificationDate?: string
  ): Promise<AdminInternship> {
    const res = await fetch(`/api/admin/internships/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, notes, lastVerificationDate })
    });
    const data = await parseJsonResponse<{ internship: AdminInternship }>(res, 'Failed to verify internship');
    return data.internship;
  }

  public async deleteInternship(id: string): Promise<void> {
    const res = await fetch(`/api/admin/internships/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete internship');
  }

  public async scanExpiredInternships(): Promise<{
    success: boolean;
    expiredCount: number;
    expiredIds: string[];
    message: string;
  }> {
    const res = await fetch('/api/admin/internships/expire-scan', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to scan expired internships');
  }

  // --- Workshops CRUD ---

  public async uploadWorkshopImage(filename: string, dataUrl: string): Promise<string> {
    const res = await fetch('/api/admin/workshops/upload-image', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ filename, dataUrl })
    });
    const data = await parseJsonResponse<{ imageUrl?: string }>(res, 'Failed to upload workshop image');
    if (!data.imageUrl) {
      throw new Error('Failed to upload workshop image');
    }
    return data.imageUrl;
  }

  public async createWorkshop(workshop: Partial<AdminWorkshop>): Promise<AdminWorkshop> {
    const res = await fetch('/api/admin/workshops', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(workshop)
    });
    const data = await parseJsonResponse<{ workshop: AdminWorkshop }>(res, 'Failed to create workshop');
    return data.workshop;
  }

  public async updateWorkshop(id: string, updates: Partial<AdminWorkshop>): Promise<AdminWorkshop> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ workshop: AdminWorkshop }>(res, 'Failed to update workshop');
    return data.workshop;
  }

  public async quickUpdateWorkshop(id: string, updates: { status?: string; availability?: string; featured?: boolean }): Promise<AdminWorkshop> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}/quick`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ workshop: AdminWorkshop }>(res, 'Failed to quickly update workshop');
    return data.workshop;
  }

  public async updateWorkshopApproval(
    id: string,
    approvalStatus: 'approved' | 'rejected' | 'pending'
  ): Promise<AdminWorkshop> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ approvalStatus })
    });
    const data = await parseJsonResponse<{ workshop: AdminWorkshop }>(res, 'Failed to update workshop approval status');
    return data.workshop;
  }

  public async scanExpiredWorkshops(): Promise<{ expiredCount: number; expiredIds: string[]; message: string }> {
    const res = await fetch('/api/admin/workshops/expire-scan', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
    });
    const data = await parseJsonResponse<{ expiredCount: number; expiredIds: string[]; message: string }>(
      res,
      'Failed to scan expired workshops'
    );
    return {
      expiredCount: Number(data.expiredCount || 0),
      expiredIds: Array.isArray(data.expiredIds) ? data.expiredIds : [],
      message: data.message || 'Expired workshop scan complete.',
    };
  }

  public async deleteWorkshop(id: string): Promise<void> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete workshop');
  }

  // --- Courses CRUD ---

  public async uploadCourseImage(filename: string, dataUrl: string): Promise<string> {
    const res = await fetch('/api/admin/courses/upload-image', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ filename, dataUrl })
    });
    const data = await parseJsonResponse<{ imageUrl?: string }>(res, 'Failed to upload course image');
    if (!data.imageUrl) {
      throw new Error('Failed to upload course image');
    }
    return data.imageUrl;
  }

  public async createCourse(course: Partial<AdminCourse>): Promise<AdminCourse> {
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(course)
    });
    const data = await parseJsonResponse<{ course: AdminCourse }>(res, 'Failed to create course');
    return data.course;
  }

  public async updateCourse(id: string, updates: Partial<AdminCourse>): Promise<AdminCourse> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ course: AdminCourse }>(res, 'Failed to update course');
    return data.course;
  }

  public async quickUpdateCourse(
    id: string,
    updates: { status?: 'available' | 'closed'; featured?: boolean; registrationUrl?: string }
  ): Promise<AdminCourse> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}/quick`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ course: AdminCourse }>(res, 'Failed to update course');
    return data.course;
  }

  public async deleteCourse(id: string): Promise<void> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete course');
  }

  public async updateCourseApproval(
    id: string,
    approvalStatus: 'approved' | 'rejected' | 'pending'
  ): Promise<AdminCourse> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ approvalStatus })
    });
    const data = await parseJsonResponse<{ course: AdminCourse }>(
      res,
      'Failed to update course approval status'
    );
    return data.course;
  }

  public async scanExpiredCourses(): Promise<{
    expiredCount: number;
    expiredIds: string[];
    message: string;
  }> {
    const res = await fetch('/api/admin/courses/expire-scan', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{
      expiredCount: number;
      expiredIds: string[];
      message: string;
    }>(res, 'Failed to scan expired courses');
    return {
      expiredCount: Number(data.expiredCount || 0),
      expiredIds: Array.isArray(data.expiredIds) ? data.expiredIds : [],
      message: data.message || 'Expired course scan complete.'
    };
  }

  public async getCourseCategories(): Promise<{
    categories: string[];
    coreCategories: string[];
    customCategories: string[];
  }> {
    const res = await fetch('/api/admin/courses/categories', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load course categories');
  }

  public async addCourseCategory(
    name: string
  ): Promise<{ categories: string[]; customCategories: string[]; message: string }> {
    const res = await fetch('/api/admin/courses/categories', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ name })
    });
    return parseJsonResponse(res, 'Failed to add course category');
  }

  public async deleteCourseCategory(
    name: string
  ): Promise<{ categories: string[]; customCategories: string[]; message: string }> {
    const res = await fetch(`/api/admin/courses/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to remove course category');
  }

  // --- Website Content ---

  public async updateContent(content: Partial<WebsiteContent>): Promise<WebsiteContent> {
    const res = await fetch('/api/admin/content', {
      method: 'PUT',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(content)
    });
    const data = await parseJsonResponse<{ content: WebsiteContent }>(res, 'Failed to update website content');
    return data.content;
  }

  // --- Job Verification Records ---

  public async getJobVerificationHistory(id: string): Promise<{
    id: string;
    jobId: string;
    verifiedBy: string;
    verifiedAt: string;
    sourceStatus: string;
    notes: string;
  }[]> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}/verifications`, {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{
      verifications?: {
        id: string;
        jobId: string;
        verifiedBy: string;
        verifiedAt: string;
        sourceStatus: string;
        notes: string;
      }[];
    }>(res, 'Failed to fetch verification history');
    return data.verifications || [];
  }

  public async verifyJob(
    id: string,
    status: string = 'Verified',
    notes: string = '',
    lastVerificationDate?: string
  ): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, notes, lastVerificationDate })
    });
    const data = await parseJsonResponse<{ job: AdminJob }>(res, 'Failed to record job verification');
    return data.job;
  }

  // --- Database Backups ---

  public async createBackup(): Promise<{ success: boolean; filename: string; sizeBytes: number }> {
    const res = await fetch('/api/admin/backups', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ backup: { success: boolean; filename: string; sizeBytes: number } }>(
      res,
      'Failed to generate database backup'
    );
    return data.backup;
  }

  public async getBackups(): Promise<any[]> {
    const res = await fetch('/api/admin/backups', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ backups?: any[] }>(res, 'Failed to retrieve backup records');
    return data.backups || [];
  }

  // --- Automated Job Listing Management ---

  public async getAutomatedSyncStatus(): Promise<{
    success: boolean;
    lastReport: any | null;
    sources: any[];
    syncHistory?: AdminSyncLog[];
    isSyncing: boolean;
  }> {
    const res = await fetch('/api/admin/automated-sync/status', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to fetch automated sync status');
  }

  public async runAutomatedSync(): Promise<{
    success: boolean;
    message: string;
    report: any;
  }> {
    const res = await fetch('/api/admin/automated-sync/run', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Automated sync failed');
  }

  public async checkApplicationUrls(limit: number = 25): Promise<{
    success: boolean;
    message: string;
    brokenCount: number;
    broken: { jobId: string; title: string; employer: string; url: string; error: string }[];
  }> {
    const res = await fetch('/api/admin/automated-sync/check-urls', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ limit })
    });
    return parseJsonResponse(res, 'Failed to audit application URLs');
  }

  public async scanExpiredListings(): Promise<{
    success: boolean;
    message: string;
    expiredCount: number;
  }> {
    const res = await fetch('/api/admin/automated-sync/expire', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to scan expired listings');
  }

  // --- Server-Side Google Sheets Integration (Phase 09) ---

  public async getGoogleSheetsStatus(): Promise<{
    success: boolean;
    config: {
      configured: boolean;
      mode: 'service_account' | 'api_key' | 'webapp' | 'csv' | 'unconfigured';
      maskedSpreadsheetId: string;
      range: string;
      serviceAccountConfigured: boolean;
      apiKeyConfigured: boolean;
      webAppConfigured: boolean;
      csvUrlConfigured: boolean;
      requiredColumns: string[];
      allStandardColumns: string[];
      note: string;
    };
    status: {
      lastSyncAttemptAt: string | null;
      lastSuccessfulSyncAt: string | null;
      lastStatus: 'never_run' | 'success' | 'partial' | 'error';
      lastError: string | null;
      mode: string;
      columnValidation: {
        valid: boolean;
        detectedHeaders: string[];
        matchedColumns: Record<string, string>;
        missingRequired: string[];
        warnings: string[];
      } | null;
      lastReport: {
        timestamp: string;
        configured: boolean;
        mode: string;
        rowsFetched: number;
        importedCount: number;
        updatedCount: number;
        duplicatesSkippedCount: number;
        invalidRowsCount: number;
        expiredSkippedCount: number;
        deletedCount: number;
        invalidRows: Array<{ rowNumber: number; title: string; reason: string }>;
        error?: string;
      } | null;
    };
    syncHistory: AdminSyncLog[];
    isSyncing: boolean;
    persistentDbConfigured?: boolean;
  }> {
    const res = await fetch('/api/admin/google-sheets/status', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load server-side Google Sheets status');
  }

  public async runGoogleSheetsSync(): Promise<{
    success: boolean;
    message: string;
    report: {
      timestamp: string;
      configured: boolean;
      mode: string;
      rowsFetched: number;
      importedCount: number;
      updatedCount: number;
      duplicatesSkippedCount: number;
      invalidRowsCount: number;
      expiredSkippedCount: number;
      deletedCount: number;
      invalidRows: Array<{ rowNumber: number; title: string; reason: string }>;
      columnValidation: {
        valid: boolean;
        detectedHeaders: string[];
        matchedColumns: Record<string, string>;
        missingRequired: string[];
        warnings: string[];
      } | null;
      error?: string;
    };
  }> {
    const res = await fetch('/api/admin/google-sheets/sync', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Google Sheets synchronization failed');
  }

  // --- Submitted Opportunities Moderation ---

  public async getSubmittedOpportunities(params?: {
    type?: string;
    search?: string;
  }): Promise<AdminSubmittedOpportunity[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    const res = await fetch(`/api/admin/opportunities${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ opportunities?: AdminSubmittedOpportunity[] }>(
      res,
      'Failed to load submitted opportunities'
    );
    return data.opportunities || [];
  }

  public async moderateSubmittedOpportunity(
    id: string,
    updates: Partial<AdminSubmittedOpportunity> & { isApproved?: boolean; status?: string }
  ): Promise<AdminSubmittedOpportunity> {
    const res = await fetch(`/api/admin/opportunities/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse<{ opportunity: AdminSubmittedOpportunity }>(
      res,
      'Failed to update submitted opportunity'
    );
    return data.opportunity;
  }

  public async deleteSubmittedOpportunity(id: string): Promise<void> {
    const res = await fetch(`/api/admin/opportunities/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete submitted opportunity');
  }

  // --- Compliance Requests & Contact Messages ---

  public async getComplianceRequests(params?: {
    requestType?: string;
    status?: string;
  }): Promise<AdminComplianceRequest[]> {
    const query = new URLSearchParams();
    if (params?.requestType) query.set('requestType', params.requestType);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const res = await fetch(`/api/admin/compliance-requests${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ requests?: AdminComplianceRequest[] }>(
      res,
      'Failed to load compliance requests'
    );
    return data.requests || [];
  }

  public async updateComplianceRequest(
    id: string,
    payload: { status: string; resolutionNotes?: string }
  ): Promise<AdminComplianceRequest> {
    const res = await fetch(`/api/admin/compliance-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await parseJsonResponse<{ request: AdminComplianceRequest }>(
      res,
      'Failed to update compliance request'
    );
    return data.request;
  }

  public async deleteComplianceRequest(id: string): Promise<void> {
    const res = await fetch(`/api/admin/compliance-requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.getHeaders()
    });
    await parseJsonResponse(res, 'Failed to delete compliance request');
  }

  public async getContactMessages(): Promise<AdminContactMessage[]> {
    const res = await fetch('/api/admin/contact-messages', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await parseJsonResponse<{ messages?: AdminContactMessage[] }>(
      res,
      'Failed to retrieve contact messages'
    );
    return data.messages || [];
  }

  // --- Security Audit Logs, Authorized Export, Sessions & Password Rotation ---

  public async getAuditLogs(): Promise<{ logs: any[]; loginAttempts: any[] }> {
    const res = await fetch('/api/admin/audit-logs', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load administrator audit logs');
  }

  public getAllowedExportUrl(dataset: AdminExportDataset, format: 'csv' | 'json'): string {
    const params = new URLSearchParams({ dataset, format });
    return `/api/admin/export?${params.toString()}`;
  }

  public async downloadAuthorizedExport(
    dataset: AdminExportDataset,
    format: 'csv' | 'json'
  ): Promise<{ blob: Blob; filename: string; contentType: string }> {
    const effectiveFormat = dataset === 'all' ? 'json' : format;
    const url = this.getAllowedExportUrl(dataset, effectiveFormat);
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.message || errData.error || `Export failed (HTTP ${res.status})`);
      (err as any).status = res.status;
      (err as any).code = errData.code;
      throw err;
    }
    const contentDisposition = res.headers.get('content-disposition') || '';
    const match = contentDisposition.match(/filename="?([^"]+)"?/i);
    const filename =
      match?.[1] || `bio-inexa-${dataset}-${new Date().toISOString().split('T')[0]}.${effectiveFormat}`;
    const blob = await res.blob();
    return {
      blob,
      filename,
      contentType: res.headers.get('content-type') || 'application/octet-stream'
    };
  }

  public async getSessions(): Promise<{ sessions: any[] }> {
    const res = await fetch('/api/admin/sessions', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load active administrator sessions');
  }

  public async revokeAllOtherSessions(): Promise<{ success: boolean; revokedCount: number; message: string }> {
    const res = await fetch('/api/admin/sessions/revoke-all', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to revoke other administrator sessions');
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; revokedOtherSessions?: number }> {
    const res = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return parseJsonResponse(res, 'Failed to update administrator password');
  }

  // --- Phase 15: Company / Employer Verification, Suspension & Audit Logs ---

  public async getCompanies(): Promise<{
    success: boolean;
    companies: AdminCompanyAccount[];
    summary: {
      total: number;
      verified: number;
      pendingReview: number;
      unverified: number;
      rejected: number;
      suspended: number;
    };
  }> {
    const res = await fetch('/api/admin/companies', {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load registered employers');
  }

  public async getCompanyAuditLogs(companyId?: string): Promise<{
    success: boolean;
    logs: AdminCompanyAuditLogEntry[];
  }> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const res = await fetch(`/api/admin/companies/audit-logs${qs}`, {
      credentials: 'include',
      headers: this.getHeaders()
    });
    return parseJsonResponse(res, 'Failed to load employer audit logs');
  }

  public async verifyCompany(
    id: string,
    decision: 'verified' | 'rejected' | 'unverified',
    notes: string = ''
  ): Promise<{ success: boolean; company: AdminCompanyAccount; message: string }> {
    const res = await fetch(`/api/admin/companies/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ decision, notes, reason: notes })
    });
    return parseJsonResponse(res, 'Failed to update employer verification');
  }

  public async suspendCompany(
    id: string,
    reason: string
  ): Promise<{ success: boolean; company: AdminCompanyAccount; revokedSessions: number; message: string }> {
    const res = await fetch(`/api/admin/companies/${encodeURIComponent(id)}/suspend`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason })
    });
    return parseJsonResponse(res, 'Failed to suspend employer account');
  }

  public async reinstateCompany(
    id: string,
    notes: string = ''
  ): Promise<{ success: boolean; company: AdminCompanyAccount; message: string }> {
    const res = await fetch(`/api/admin/companies/${encodeURIComponent(id)}/reinstate`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes })
    });
    return parseJsonResponse(res, 'Failed to reinstate employer account');
  }
}

export const adminApi = new AdminApiClient();
