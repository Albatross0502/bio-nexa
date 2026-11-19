/**
 * BIO-INEXA Public API Client
 *
 * Provides typed client-side methods communicating directly with the real
 * Express/SQLite backend endpoints (/api/*) with strict error propagation.
 */

import type { Certificate, DiscussionTopic, JobApplication } from '../../types';
import type { Opportunity } from '../../types/opportunity';

export interface ApiRequestError extends Error {
  status?: number;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

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
  originalJobUrl?: string;
  publicationDate: string;
  expiryDate: string;
  verificationStatus: string;
  lastVerificationDate?: string;
  verificationNotes?: string;
  responsibilities?: string[];
  requirements?: string[];
  isActive: boolean;
  featured: boolean;
  sector: string;
}

export interface PublicInternship {
  id: string;
  slug?: string;
  title: string;
  organization: string;
  location: string;
  mode?: string;
  workMode?: string;
  stipend: string;
  duration: string;
  deadline: string;
  category: string;
  eligibility: string;
  description: string;
  learningOutcomes?: string[];
  skillsRequired: string[];
  source?: { name: string; url: string; isExternal: boolean };
  sourceName?: string;
  sourceUrl?: string;
  applicationUrl: string;
  verificationStatus?: string;
  verificationNotes?: string;
  lastVerificationDate?: string;
  isVerified?: boolean;
  isApproved?: boolean;
  isActive?: boolean;
  isExpired?: boolean;
  compensationType?: 'paid' | 'unpaid';
  isPaid?: boolean;
  featured?: boolean;
}

export interface PublicWorkshop {
  id: string;
  name: string;
  title?: string;
  description: string;
  organizer?: string;
  instructor?: string;
  category?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  venue: string;
  location?: string;
  format?: string;
  workMode?: string;
  registrationLink: string;
  registrationUrl?: string;
  registrationDeadline?: string;
  availability: string;
  status?: string;
  fees?: string;
  duration?: string;
  capacity?: number | null;
  imageUrl?: string;
  featured?: boolean;
  skillsCovered: string[];
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  isApproved?: boolean;
  isExpired?: boolean;
}

export interface SubmitWorkshopPayload {
  title: string;
  organizer: string;
  instructor?: string;
  category: string;
  description: string;
  format: 'Online' | 'Offline' | 'Hybrid';
  venue?: string;
  date: string;
  time?: string;
  duration?: string;
  registrationDeadline?: string;
  registrationUrl: string;
  fees?: string;
  capacity?: number | null;
  skillsCovered?: string[];
  imageUrl?: string;
}

export interface PublicCourse {
  id: string;
  name: string;
  title?: string;
  provider?: string;
  providerType?: 'third_party' | 'bionexa';
  description: string;
  duration: string;
  fees: string;
  pricingType?: 'free' | 'paid';
  eligibility: string;
  curriculum: string[];
  deliveryMode?: string;
  certificateInfo?: string;
  registrationDeadline?: string;
  registrationLink: string;
  registrationUrl?: string;
  availability: string;
  status?: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  isApproved?: boolean;
  isExpired?: boolean;
  instructor: string;
  level: string;
  category: string;
  imageUrl?: string;
  isCertificateAvailable: boolean;
  featured: boolean;
}

export interface SubmitCoursePayload {
  title: string;
  provider: string;
  instructor?: string;
  category: string;
  description: string;
  duration: string;
  eligibility?: string;
  curriculum?: string[];
  deliveryMode?: string;
  fees: string;
  pricingType?: 'free' | 'paid';
  certificateInfo?: string;
  registrationDeadline?: string;
  registrationUrl: string;
  level?: string;
  imageUrl?: string;
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

export interface SubmitOpportunityPayload {
  title: string;
  organization: string;
  type: string;
  subCategory?: string;
  description: string;
  location: string;
  workMode: string;
  experience?: string;
  qualification?: string;
  branches: string[];
  skills?: string[];
  salaryOrStipend?: string;
  salaryTier?: string;
  deadline?: string;
  sourceName?: string;
  sourceUrl?: string;
  applicationUrl: string;
  contactEmail?: string;
  workshopDetails?: Record<string, unknown>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`) as ApiRequestError;
    err.status = res.status;
    err.code = data.code;
    throw err;
  }

  return data as T;
}

class BionexaApiClient {
  private baseUrl: string = '/api';

  // --- Jobs ---

  public async getJobs(params?: {
    search?: string;
    sector?: string;
    location?: string;
    verificationStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<PublicJob[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sector) query.set('sector', params.sector);
    if (params?.location) query.set('location', params.location);
    if (params?.verificationStatus) query.set('verificationStatus', params.verificationStatus);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const data = await requestJson<{ jobs?: PublicJob[] }>(`${this.baseUrl}/jobs${qs ? `?${qs}` : ''}`);
    return data.jobs || [];
  }

  public async getJobById(id: string): Promise<{ job: PublicJob; verifications: any[] } | null> {
    try {
      const data = await requestJson<{ job: PublicJob; verifications?: any[] }>(
        `${this.baseUrl}/jobs/${encodeURIComponent(id)}`
      );
      return { job: data.job, verifications: data.verifications || [] };
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
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
    responsibilities?: string[];
    requirements?: string[];
  }): Promise<{ success: boolean; message: string; jobId?: string }> {
    return requestJson<{ success: boolean; message: string; jobId?: string }>(
      `${this.baseUrl}/jobs/submit`,
      {
        method: 'POST',
        body: JSON.stringify(jobData)
      }
    );
  }

  public async reportJob(
    jobId: string,
    payload: { reason: string; details?: string; reportedBy?: string; reporterEmail?: string }
  ): Promise<{ success: boolean; message: string; reportId: string }> {
    return requestJson<{ success: boolean; message: string; reportId: string }>(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/report`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  // --- Internships ---

  public async getInternships(params?: {
    search?: string;
    category?: string;
    location?: string;
    mode?: string;
    compensation?: 'all' | 'paid' | 'unpaid' | string;
    includeExpired?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PublicInternship[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.location && params.location !== 'all') query.set('location', params.location);
    if (params?.mode && params.mode !== 'all') query.set('mode', params.mode);
    if (params?.compensation && params.compensation !== 'all') query.set('compensation', params.compensation);
    if (params?.includeExpired) query.set('includeExpired', 'true');
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const data = await requestJson<{ internships?: PublicInternship[] }>(
      `${this.baseUrl}/internships${qs ? `?${qs}` : ''}`
    );
    return data.internships || [];
  }

  public async submitInternship(payload: {
    title: string;
    organization: string;
    location: string;
    mode: string;
    stipend: string;
    duration: string;
    deadline?: string;
    category: string;
    eligibility: string;
    description: string;
    applicationUrl: string;
    sourceName?: string;
    skillsRequired?: string[];
    learningOutcomes?: string[];
  }): Promise<{ success: boolean; message: string; internship: PublicInternship }> {
    return requestJson<{ success: boolean; message: string; internship: PublicInternship }>(
      `${this.baseUrl}/internships/submit`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  // --- Workshops, Courses & Content ---

  public async getWorkshops(params?: {
    status?: string;
    format?: string;
    category?: string;
    featured?: boolean;
    includeExpired?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PublicWorkshop[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.format) query.set('format', params.format);
    if (params?.category) query.set('category', params.category);
    if (params?.featured !== undefined) query.set('featured', String(params.featured));
    if (params?.includeExpired !== undefined) query.set('includeExpired', String(params.includeExpired));
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const data = await requestJson<{ workshops?: PublicWorkshop[] }>(
      `${this.baseUrl}/workshops${qs ? `?${qs}` : ''}`
    );
    return data.workshops || [];
  }

  public async submitWorkshop(
    payload: SubmitWorkshopPayload
  ): Promise<{ success: boolean; status: string; message: string; workshop?: PublicWorkshop }> {
    return requestJson<{ success: boolean; status: string; message: string; workshop?: PublicWorkshop }>(
      `${this.baseUrl}/workshops/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  }

  public async getCourses(params?: {
    category?: string;
    status?: string;
    pricingType?: 'free' | 'paid' | 'all' | string;
    providerType?: 'third_party' | 'bionexa' | 'all' | string;
    featured?: boolean;
    onlyAvailable?: boolean;
    includeExpired?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PublicCourse[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    if (params?.pricingType && params.pricingType !== 'all') query.set('pricingType', params.pricingType);
    if (params?.providerType && params.providerType !== 'all') query.set('providerType', params.providerType);
    if (params?.featured !== undefined) query.set('featured', String(params.featured));
    if (params?.onlyAvailable !== undefined) query.set('onlyAvailable', String(params.onlyAvailable));
    if (params?.includeExpired !== undefined) query.set('includeExpired', String(params.includeExpired));
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const data = await requestJson<{ courses?: PublicCourse[] }>(
      `${this.baseUrl}/courses${qs ? `?${qs}` : ''}`
    );
    return data.courses || [];
  }

  public async getCourseCategories(): Promise<string[]> {
    const data = await requestJson<{ categories?: string[] }>(`${this.baseUrl}/courses/categories`);
    return Array.isArray(data.categories) ? data.categories : [];
  }

  public async submitCourse(
    payload: SubmitCoursePayload
  ): Promise<{ success: boolean; status: string; message: string; course?: PublicCourse }> {
    return requestJson<{ success: boolean; status: string; message: string; course?: PublicCourse }>(
      `${this.baseUrl}/courses/submit`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  public async getAnnouncements(): Promise<PublicAnnouncement[]> {
    const data = await requestJson<{ announcements?: PublicAnnouncement[] }>(
      `${this.baseUrl}/announcements`
    );
    return data.announcements || [];
  }

  public async getHomepageHighlights(): Promise<HomepageHighlights | null> {
    const data = await requestJson<{ highlights?: HomepageHighlights }>(
      `${this.baseUrl}/content/homepage`
    );
    return data.highlights || null;
  }

  // --- Unified Opportunities & Direct Submissions ---

  public async getOpportunities(params?: {
    branch?: string;
    type?: string;
    workMode?: string;
    status?: string;
    search?: string;
    verifiedOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ opportunities: Opportunity[]; total: number; pagination?: PaginationMeta }> {
    const query = new URLSearchParams();
    if (params?.branch) query.set('branch', params.branch);
    if (params?.type) query.set('type', params.type);
    if (params?.workMode) query.set('workMode', params.workMode);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.verifiedOnly !== undefined) query.set('verifiedOnly', String(params.verifiedOnly));
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const data = await requestJson<{
      opportunities?: Opportunity[];
      total?: number;
      pagination?: PaginationMeta;
    }>(`${this.baseUrl}/opportunities${qs ? `?${qs}` : ''}`);

    return {
      opportunities: data.opportunities || [],
      total: data.total ?? (data.opportunities?.length || 0),
      pagination: data.pagination
    };
  }

  public async submitOpportunity(
    payload: SubmitOpportunityPayload
  ): Promise<{ success: boolean; id: string; opportunity: Opportunity; message: string }> {
    return requestJson<{ success: boolean; id: string; opportunity: Opportunity; message: string }>(
      `${this.baseUrl}/opportunities`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  // --- Contact & Newsletter ---

  public async submitContact(payload: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; referenceId: string; message: string }> {
    return requestJson<{ success: boolean; referenceId: string; message: string }>(
      `${this.baseUrl}/contact`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  public async subscribeNewsletter(email: string): Promise<{
    success: boolean;
    alreadySubscribed: boolean;
    message: string;
  }> {
    return requestJson<{ success: boolean; alreadySubscribed: boolean; message: string }>(
      `${this.baseUrl}/newsletter`,
      {
        method: 'POST',
        body: JSON.stringify({ email })
      }
    );
  }

  // --- Certificates ---

  public async verifyCertificate(certificateNumber: string): Promise<Certificate | null> {
    try {
      const data = await requestJson<{ found: boolean; certificate?: Certificate }>(
        `${this.baseUrl}/certificates/verify?id=${encodeURIComponent(certificateNumber)}`
      );
      return data.certificate || null;
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  }

  public async issueCertificate(payload: {
    recipientName: string;
    courseTitle: string;
    score: number;
    certificateNumber?: string;
    issueDate?: string;
    verificationCode?: string;
  }): Promise<Certificate> {
    const data = await requestJson<{ certificate: Certificate }>(`${this.baseUrl}/certificates`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data.certificate;
  }

  // --- Job Applications ---

  public async getApplications(): Promise<JobApplication[]> {
    const data = await requestJson<{ applications?: JobApplication[] }>(
      `${this.baseUrl}/applications`
    );
    return data.applications || [];
  }

  public async createApplication(
    payload: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>
  ): Promise<JobApplication> {
    const data = await requestJson<{ application: JobApplication }>(
      `${this.baseUrl}/applications`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    return data.application;
  }

  public async updateApplicationStatus(
    id: string,
    status: JobApplication['status']
  ): Promise<JobApplication> {
    const data = await requestJson<{ application: JobApplication }>(
      `${this.baseUrl}/applications/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );
    return data.application;
  }

  // --- Community Discussions ---

  public async getDiscussions(category?: string): Promise<DiscussionTopic[]> {
    const qs = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    const data = await requestJson<{ discussions?: DiscussionTopic[] }>(
      `${this.baseUrl}/discussions${qs}`
    );
    return data.discussions || [];
  }

  public async createDiscussion(payload: {
    title: string;
    authorName: string;
    authorRole?: string;
    category: string;
    content: string;
  }): Promise<DiscussionTopic> {
    const data = await requestJson<{ discussion: DiscussionTopic }>(
      `${this.baseUrl}/discussions`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    return data.discussion;
  }

  public async addDiscussionReply(
    topicId: string,
    payload: { authorName: string; authorRole?: string; content: string }
  ): Promise<DiscussionTopic['replies'][number]> {
    const data = await requestJson<{ reply: DiscussionTopic['replies'][number] }>(
      `${this.baseUrl}/discussions/${encodeURIComponent(topicId)}/replies`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    return data.reply;
  }

  public async upvoteDiscussion(topicId: string): Promise<DiscussionTopic> {
    const data = await requestJson<{ discussion: DiscussionTopic }>(
      `${this.baseUrl}/discussions/${encodeURIComponent(topicId)}/upvote`,
      {
        method: 'POST'
      }
    );
    return data.discussion;
  }
}

export const bionexaApi = new BionexaApiClient();
