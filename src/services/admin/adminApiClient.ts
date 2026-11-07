/**
 * BIO-NEXA Admin API Client
 * 
 * Communicates with the protected Express backend /api/admin/* endpoints.
 * Handles HttpOnly cookies and Bearer token fallback.
 * Never stores or exposes admin passwords in JavaScript.
 */

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface AdminJob {
  id: string;
  title: string;
  company: string;
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
  applicationUrl: string;
  status: string;
  featured: boolean;
  isApproved: boolean;
  isExpired: boolean;
  sourceName?: string;
}

export interface AdminWorkshop {
  id: string;
  title: string;
  organizer: string;
  location: string;
  workMode: string;
  startDate: string;
  endDate: string;
  duration: string;
  fees: string;
  capacity: number;
  registrationUrl: string;
  description: string;
  skillsCovered: string[];
  status: string;
  isApproved: boolean;
}

export interface AdminCourse {
  id: string;
  title: string;
  instructor: string;
  category: string;
  duration: string;
  level: string;
  price: string;
  description: string;
  syllabus: string[];
  prerequisites: string[];
  featured: boolean;
  isCertificateAvailable: boolean;
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

class AdminApiClient {
  private sessionToken: string | null = null;

  constructor() {
    // Check in-memory / session storage for fallback bearer token
    try {
      this.sessionToken = sessionStorage.getItem('bionexa_admin_token');
    } catch {
      this.sessionToken = null;
    }
  }

  private getHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders as Record<string, string>
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    return headers;
  }

  public async login(username: string, password: string): Promise<{ success: boolean; user: AdminUser; token: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Login failed');
      (err as any).status = res.status;
      (err as any).remainingAttempts = data.remainingAttempts;
      (err as any).retryAfterSec = data.retryAfterSec;
      throw err;
    }

    this.sessionToken = data.token;
    try {
      sessionStorage.setItem('bionexa_admin_token', data.token);
    } catch {
      // Ignore storage restrictions
    }

    return data;
  }

  public async logout(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: this.getHeaders()
      });
    } finally {
      this.sessionToken = null;
      try {
        sessionStorage.removeItem('bionexa_admin_token');
      } catch {
        // Ignore
      }
    }
  }

  public async checkAuth(): Promise<{ authenticated: boolean; user?: AdminUser }> {
    try {
      const res = await fetch('/api/admin/me', {
        headers: this.getHeaders()
      });
      if (!res.ok) {
        return { authenticated: false };
      }
      const data = await res.json();
      return data;
    } catch {
      return { authenticated: false };
    }
  }

  public async getDashboardData(): Promise<{
    jobs: AdminJob[];
    workshops: AdminWorkshop[];
    courses: AdminCourse[];
    content: WebsiteContent;
  }> {
    const res = await fetch('/api/admin/data', {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard data: ${res.statusText}`);
    }
    return res.json();
  }

  // --- Jobs CRUD ---

  public async createJob(job: Partial<AdminJob>): Promise<AdminJob> {
    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(job)
    });
    if (!res.ok) throw new Error('Failed to create job');
    const data = await res.json();
    return data.job;
  }

  public async updateJob(id: string, updates: Partial<AdminJob>): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update job');
    const data = await res.json();
    return data.job;
  }

  public async deleteJob(id: string): Promise<void> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete job');
  }

  public async updateJobStatus(id: string, payload: { status?: string; isApproved?: boolean; isExpired?: boolean }): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update job status');
    const data = await res.json();
    return data.job;
  }

  // --- Workshops CRUD ---

  public async createWorkshop(workshop: Partial<AdminWorkshop>): Promise<AdminWorkshop> {
    const res = await fetch('/api/admin/workshops', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(workshop)
    });
    if (!res.ok) throw new Error('Failed to create workshop');
    const data = await res.json();
    return data.workshop;
  }

  public async updateWorkshop(id: string, updates: Partial<AdminWorkshop>): Promise<AdminWorkshop> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update workshop');
    const data = await res.json();
    return data.workshop;
  }

  public async deleteWorkshop(id: string): Promise<void> {
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete workshop');
  }

  // --- Courses CRUD ---

  public async createCourse(course: Partial<AdminCourse>): Promise<AdminCourse> {
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(course)
    });
    if (!res.ok) throw new Error('Failed to create course');
    const data = await res.json();
    return data.course;
  }

  public async updateCourse(id: string, updates: Partial<AdminCourse>): Promise<AdminCourse> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update course');
    const data = await res.json();
    return data.course;
  }

  public async deleteCourse(id: string): Promise<void> {
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete course');
  }

  // --- Website Content ---

  public async updateContent(content: Partial<WebsiteContent>): Promise<WebsiteContent> {
    const res = await fetch('/api/admin/content', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(content)
    });
    if (!res.ok) throw new Error('Failed to update website content');
    const data = await res.json();
    return data.content;
  }

  // --- Job Verification Records ---

  public async verifyJob(id: string, status: string = 'Verified', notes: string = ''): Promise<AdminJob> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, notes })
    });
    if (!res.ok) throw new Error('Failed to record job verification');
    const data = await res.json();
    return data.job;
  }

  // --- Database Backups ---

  public async createBackup(): Promise<{ success: boolean; filename: string; sizeBytes: number }> {
    const res = await fetch('/api/admin/backups', {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to generate database backup');
    const data = await res.json();
    return data.backup;
  }

  public async getBackups(): Promise<any[]> {
    const res = await fetch('/api/admin/backups', {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to retrieve backup records');
    const data = await res.json();
    return data.backups || [];
  }

  // --- Automated Job Listing Management ---

  public async getAutomatedSyncStatus(): Promise<{
    success: boolean;
    lastReport: any | null;
    sources: any[];
    isSyncing: boolean;
  }> {
    const res = await fetch('/api/admin/automated-sync/status', {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch automated sync status');
    return res.json();
  }

  public async runAutomatedSync(): Promise<{
    success: boolean;
    message: string;
    report: any;
  }> {
    const res = await fetch('/api/admin/automated-sync/run', {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Automated sync failed');
    }
    return res.json();
  }

  public async checkApplicationUrls(limit: number = 25): Promise<{
    success: boolean;
    message: string;
    brokenCount: number;
    broken: { jobId: string; title: string; employer: string; url: string; error: string }[];
  }> {
    const res = await fetch('/api/admin/automated-sync/check-urls', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ limit })
    });
    if (!res.ok) throw new Error('Failed to audit application URLs');
    return res.json();
  }

  public async scanExpiredListings(): Promise<{
    success: boolean;
    message: string;
    expiredCount: number;
  }> {
    const res = await fetch('/api/admin/automated-sync/expire', {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to scan expired listings');
    return res.json();
  }
}

export const adminApi = new AdminApiClient();
