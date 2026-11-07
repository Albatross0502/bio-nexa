/**
 * BIO-NEXA Public API Client
 * 
 * Provides client-side methods to communicate with the secure /api/* endpoints.
 * Includes graceful offline/fallback handling to preserve seamless UX.
 */

import { DbJob, DbWorkshop, DbCourse, DbAnnouncement } from '../../db/bionexaDatabase';

export interface PublicJob {
  id: string;
  title: string;
  employer: string;
  description: string;
  location: string;
  qualification: string;
  skills: string[];
  employmentType: string;
  salary: string;
  applicationUrl: string;
  source: string;
  publicationDate: string;
  expiryDate: string;
  verificationStatus: string;
  isActive: boolean;
  featured: boolean;
  sector: string;
}

export interface PublicWorkshop {
  id: string;
  name: string;
  description: string;
  instructor: string;
  date: string;
  time: string;
  venue: string;
  registrationLink: string;
  availability: string;
  fees: string;
  duration: string;
  capacity: number;
  skillsCovered: string[];
}

export interface PublicCourse {
  id: string;
  name: string;
  description: string;
  duration: string;
  fees: string;
  eligibility: string;
  curriculum: string[];
  registrationLink: string;
  availability: string;
  instructor: string;
  level: string;
  category: string;
  isCertificateAvailable: boolean;
  featured: boolean;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  tag: string;
  content: string;
  date: string;
  link: string;
}

export interface HomepageHighlights {
  heroBadge: string;
  bannerNotice: string;
  activeVacanciesCount: string;
  participatingInstitutesCount: string;
}

class BionexaApiClient {
  private baseUrl: string = '/api';

  public async getJobs(params?: { search?: string; sector?: string; location?: string }): Promise<PublicJob[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.sector) query.set('sector', params.sector);
      if (params?.location) query.set('location', params.location);

      const res = await fetch(`${this.baseUrl}/jobs?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.jobs || [];
    } catch (e) {
      console.warn('API getJobs notice: Falling back to local data store.', e);
      return [];
    }
  }

  public async getJobById(id: string): Promise<{ job: PublicJob; verifications: any[] } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { job: data.job, verifications: data.verifications || [] };
    } catch {
      return null;
    }
  }

  public async submitJob(jobData: {
    title: string;
    company: string;
    applicationUrl: string;
    description: string;
    location: string;
    qualification?: string;
    skills?: string[];
    employmentType?: string;
    salary?: string;
    deadline?: string;
    sector?: string;
  }): Promise<{ success: boolean; message: string; jobId?: string }> {
    const res = await fetch(`${this.baseUrl}/jobs/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Submission failed');
    }

    return data;
  }

  public async getWorkshops(): Promise<PublicWorkshop[]> {
    try {
      const res = await fetch(`${this.baseUrl}/workshops`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.workshops || [];
    } catch (e) {
      console.warn('API getWorkshops notice:', e);
      return [];
    }
  }

  public async getCourses(): Promise<PublicCourse[]> {
    try {
      const res = await fetch(`${this.baseUrl}/courses`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.courses || [];
    } catch (e) {
      console.warn('API getCourses notice:', e);
      return [];
    }
  }

  public async getAnnouncements(): Promise<PublicAnnouncement[]> {
    try {
      const res = await fetch(`${this.baseUrl}/announcements`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.announcements || [];
    } catch (e) {
      console.warn('API getAnnouncements notice:', e);
      return [];
    }
  }

  public async getHomepageHighlights(): Promise<HomepageHighlights | null> {
    try {
      const res = await fetch(`${this.baseUrl}/content/homepage`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.highlights || null;
    } catch (e) {
      console.warn('API getHomepageHighlights notice:', e);
      return null;
    }
  }
}

export const bionexaApi = new BionexaApiClient();
