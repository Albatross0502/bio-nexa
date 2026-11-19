/**
 * Pure helper utilities for Phase 13 Course Management System.
 * Keeps category definitions, strict URL/image validation, pricing classification,
 * provider provenance (third-party vs BIO-INEXA), approval/expiry status,
 * curriculum parsing, submission validation, filtering, and mapping decoupled
 * from React components.
 */

import type { Opportunity, WorkMode } from '../../types/opportunity';

export const COURSE_CATEGORIES = [
  'Biotechnology',
  'Microbiology',
  'Molecular Biology',
  'Bioinformatics',
  'Genetics',
  'Pharmaceutical Sciences',
  'Clinical Research',
  'Laboratory Techniques',
  'Research Methodology'
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export type CourseAvailabilityStatus = 'available' | 'closed';
export type CourseApprovalStatus = 'approved' | 'pending' | 'rejected';
export type CourseProviderType = 'third_party' | 'bionexa';
export type CoursePricingType = 'free' | 'paid';

export const COURSE_DELIVERY_MODES = [
  'Online (Self-Paced)',
  'Online (Live Cohort)',
  'Hybrid',
  'In-Person'
] as const;

export type CourseDeliveryMode = (typeof COURSE_DELIVERY_MODES)[number] | string;

export interface CourseUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  domain: string;
  reason?: string;
}

export interface CourseSubmissionInput {
  title?: string;
  name?: string;
  provider?: string;
  instructor?: string;
  category?: string;
  description?: string;
  duration?: string;
  eligibility?: string;
  curriculum?: string | string[];
  syllabus?: string | string[];
  deliveryMode?: string;
  fees?: string;
  price?: string;
  pricingType?: string;
  certificateInfo?: string;
  registrationDeadline?: string;
  registrationUrl?: string;
  registrationLink?: string;
  level?: string;
  imageUrl?: string;
}

export interface UnifiedCourse {
  id: string;
  title: string;
  name?: string;
  provider: string;
  providerType: CourseProviderType;
  instructor?: string;
  category: string;
  description: string;
  duration: string;
  eligibility: string;
  curriculum: string[];
  syllabus?: string[];
  deliveryMode: string;
  fees: string;
  price?: string;
  pricingType: CoursePricingType;
  certificateInfo?: string;
  isCertificateAvailable?: boolean;
  registrationDeadline: string;
  registrationUrl: string;
  registrationLink?: string;
  status: CourseAvailabilityStatus;
  availability?: string;
  approvalStatus?: CourseApprovalStatus;
  isApproved?: boolean;
  isExpired?: boolean;
  level?: string;
  imageUrl?: string;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_COURSE_IMAGE =
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';

const DISALLOWED_COURSE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'example.com',
  'www.example.com',
  'example.org',
  'www.example.org',
  'example.net',
  'www.example.net',
  'test.com',
  'www.test.com'
]);

export function validateCourseRegistrationUrl(url?: string): CourseUrlValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'An official enrollment URL starting with http:// or https:// is required.'
    };
  }

  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('/')) {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Please enter a full external enrollment URL (https://...).'
    };
  }

  if (/^(javascript|data|vbscript|mailto|tel):/i.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Enrollment URL must use http:// or https://.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Enrollment URL is not a valid web address.'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Enrollment URL must use http:// or https://.'
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Enrollment URL must point to a valid public provider domain.'
    };
  }

  if (
    DISALLOWED_COURSE_HOSTS.has(host) ||
    host.endsWith('.example.com') ||
    host.endsWith('.example.org') ||
    host.endsWith('.example.net')
  ) {
    return {
      valid: false,
      normalizedUrl: '',
      domain: '',
      reason: 'Placeholder or local URLs (such as example.com or localhost) are not permitted.'
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    domain: host
  };
}

export function isValidCourseRegistrationUrl(url?: string): boolean {
  return validateCourseRegistrationUrl(url).valid;
}

export function isValidCourseImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  return validateCourseRegistrationUrl(trimmed).valid;
}

export function normalizeCourseCategory(rawCategory?: string): CourseCategory {
  const clean = (rawCategory || '').trim().toLowerCase();
  if (!clean) return 'Biotechnology';

  const exact = COURSE_CATEGORIES.find((cat) => cat.toLowerCase() === clean);
  if (exact) return exact;

  if (clean.includes('microbiol')) return 'Microbiology';
  if (clean.includes('molecular') || clean.includes('crispr') || clean.includes('gene editing')) return 'Molecular Biology';
  if (clean.includes('bioinform') || clean.includes('ngs') || clean.includes('genomics') || clean.includes('computational')) return 'Bioinformatics';
  if (clean.includes('genetic')) return 'Genetics';
  if (clean.includes('pharma') || clean.includes('drug') || clean.includes('qc') || clean.includes('regulatory')) return 'Pharmaceutical Sciences';
  if (clean.includes('clinical') || clean.includes('trial') || clean.includes('gcp')) return 'Clinical Research';
  if (clean.includes('lab') || clean.includes('wet lab') || clean.includes('assay') || clean.includes('technique') || clean.includes('chromatography') || clean.includes('pcr')) return 'Laboratory Techniques';
  if (clean.includes('research') || clean.includes('method') || clean.includes('biostat') || clean.includes('manuscript')) return 'Research Methodology';

  return 'Biotechnology';
}

/**
 * Preserves managed/custom categories when explicitly matched, otherwise falls back
 * to canonical normalization.
 */
export function resolveCourseCategory(rawCategory?: string, customCategories: string[] = []): string {
  const trimmed = (rawCategory || '').trim();
  if (!trimmed) return 'Biotechnology';

  const canonicalMatch = COURSE_CATEGORIES.find(
    (cat) => cat.toLowerCase() === trimmed.toLowerCase()
  );
  if (canonicalMatch) return canonicalMatch;

  const customMatch = customCategories.find(
    (cat) => cat.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (customMatch) return customMatch.trim();

  // If customCategories were not passed, preserve an explicit non-empty custom category
  // only when it does not look like an alias of one of the canonical categories.
  return trimmed.length >= 2 && trimmed.length <= 64 ? trimmed : normalizeCourseCategory(trimmed);
}

export function extractCourseCategories(
  courses: Array<{ category?: string }>,
  managedCategories: string[] = []
): string[] {
  const seen = new Map<string, string>();

  for (const cat of COURSE_CATEGORIES) {
    seen.set(cat.toLowerCase(), cat);
  }
  for (const cat of managedCategories) {
    const trimmed = String(cat || '').trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.set(trimmed.toLowerCase(), trimmed);
    }
  }
  for (const c of courses) {
    const trimmed = String(c.category || '').trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.set(trimmed.toLowerCase(), trimmed);
    }
  }

  return Array.from(seen.values());
}

export function normalizeCourseStatus(status?: string, availability?: string): CourseAvailabilityStatus {
  const s = (status || '').trim().toLowerCase();
  const a = (availability || '').trim().toLowerCase();

  if (s === 'closed' || s === 'archived' || s === 'expired' || s === 'inactive') {
    return 'closed';
  }
  if (a === 'closed' || a.startsWith('closed') || a === 'expired') {
    return 'closed';
  }
  return 'available';
}

export function normalizeCourseApprovalStatus(
  approvalStatus?: string,
  isApproved?: boolean | number
): CourseApprovalStatus {
  const clean = (approvalStatus || '').trim().toLowerCase();
  if (clean === 'pending' || clean === 'pending review' || clean === 'pending approval') {
    return 'pending';
  }
  if (clean === 'rejected' || clean === 'declined') {
    return 'rejected';
  }
  if (clean === 'approved') {
    return 'approved';
  }
  if (isApproved === false || isApproved === 0) {
    return 'pending';
  }
  return 'approved';
}

export function normalizeCourseProviderType(
  providerType?: string
): CourseProviderType {
  const clean = (providerType || '').trim().toLowerCase();
  if (clean === 'bionexa' || clean === 'bio-inexa' || clean === 'first_party' || clean === 'internal') {
    return 'bionexa';
  }
  return 'third_party';
}

export function classifyCoursePricing(
  fees?: string,
  explicitPricingType?: string
): CoursePricingType {
  const explicit = (explicitPricingType || '').trim().toLowerCase();
  if (explicit === 'free') return 'free';
  if (explicit === 'paid') return 'paid';

  const text = (fees || '').trim().toLowerCase();
  if (!text) return 'paid';

  // Clearly free / open access courses (even if optional exam certification has a fee)
  if (
    /\bfree\b/.test(text) ||
    text.includes('no fee') ||
    text.includes('no cost') ||
    text.includes('₹0') ||
    text.includes('$0') ||
    text.includes('open access') ||
    text.includes('open resource') ||
    text.includes('open curriculum')
  ) {
    return 'free';
  }

  return 'paid';
}

export function normalizeDeliveryMode(mode?: string): string {
  const clean = (mode || '').trim().toLowerCase();
  if (!clean) return 'Online (Self-Paced)';
  if (clean.includes('live') || clean.includes('cohort')) return 'Online (Live Cohort)';
  if (clean.includes('hybrid')) return 'Hybrid';
  if (clean.includes('in-person') || clean.includes('offline') || clean.includes('campus') || clean.includes('on-site')) {
    return 'In-Person';
  }
  return 'Online (Self-Paced)';
}

export function parseCurriculumInput(input?: string | string[]): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Parses YYYY-MM-DD or readable date strings (e.g., "15 December 2026") to end-of-day Date.
 * Rolling / open deadlines return null (never auto-expired).
 */
export function parseCourseDate(raw?: string): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('rolling') ||
    lower.includes('open') ||
    lower.includes('self-paced') ||
    lower.includes('ongoing') ||
    lower.includes('tba') ||
    lower.includes('not specified')
  ) {
    return null;
  }

  // Exact ISO date YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const parsed = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Readable date with year, e.g. "20 December 2026" or "Dec 20, 2026"
  if (/\b20\d{2}\b/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setUTCHours(23, 59, 59, 999);
      return parsed;
    }
  }

  return null;
}

export function isCourseExpired(
  course: {
    registrationDeadline?: string;
    isExpired?: boolean;
  },
  now: Date = new Date()
): boolean {
  if (course.isExpired === true) return true;
  const deadlineDate = parseCourseDate(course.registrationDeadline);
  if (deadlineDate && deadlineDate.getTime() < now.getTime()) {
    return true;
  }
  return false;
}

export function isCourseRegistrationClosed(
  course: {
    status?: string;
    availability?: string;
    registrationDeadline?: string;
    isExpired?: boolean;
  },
  now: Date = new Date()
): boolean {
  const status = normalizeCourseStatus(course.status, course.availability);
  if (status === 'closed') return true;
  return isCourseExpired(course, now);
}

export function validateCourseSubmissionPayload(input: CourseSubmissionInput): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    name: string;
    provider: string;
    providerType: CourseProviderType;
    instructor: string;
    category: string;
    description: string;
    duration: string;
    eligibility: string;
    curriculum: string[];
    deliveryMode: string;
    fees: string;
    pricingType: CoursePricingType;
    certificateInfo: string;
    isCertificateAvailable: boolean;
    registrationDeadline: string;
    registrationUrl: string;
    registrationLink: string;
    level: string;
    imageUrl: string;
    status: CourseAvailabilityStatus;
    availability: string;
    approvalStatus: CourseApprovalStatus;
    isApproved: boolean;
    featured: boolean;
  };
} {
  const errors: string[] = [];

  const title = String(input.title || input.name || '').trim();
  const provider = String(input.provider || '').trim();
  const instructor = String(input.instructor || '').trim();
  const category = String(input.category || '').trim() || 'Biotechnology';
  const description = String(input.description || '').trim();
  const duration = String(input.duration || '').trim();
  const eligibility = String(input.eligibility || '').trim();
  const deliveryMode = normalizeDeliveryMode(input.deliveryMode);
  const fees = String(input.fees ?? input.price ?? '').trim();
  const pricingType = classifyCoursePricing(fees, input.pricingType);
  const certificateInfo = String(input.certificateInfo || '').trim();
  const registrationDeadline = String(input.registrationDeadline || '').trim();
  const rawUrl = String(input.registrationUrl || input.registrationLink || '').trim();
  const level = String(input.level || '').trim() || 'Intermediate';
  const imageUrl = String(input.imageUrl || '').trim();
  const curriculum = parseCurriculumInput(input.curriculum || input.syllabus);

  if (title.length < 4) {
    errors.push('Course title must be at least 4 characters.');
  }
  if (provider.length < 2) {
    errors.push('Course provider / institution name is required.');
  }
  if (description.length < 15) {
    errors.push('Course description must be at least 15 characters.');
  }
  if (!duration) {
    errors.push('Course duration is required (e.g., 6 Weeks or 12 Hours).');
  }
  if (!fees) {
    errors.push('Course fee information is required (e.g., Free or ₹1,500).');
  }

  const urlCheck = validateCourseRegistrationUrl(rawUrl);
  if (!urlCheck.valid) {
    errors.push(urlCheck.reason || 'A valid official enrollment URL starting with http:// or https:// is required.');
  }

  if (imageUrl && !isValidCourseImageUrl(imageUrl)) {
    errors.push('Course image URL must be a valid HTTPS/HTTP image URL.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      title,
      name: title,
      provider,
      // External/public submissions are ALWAYS third-party and require admin approval
      providerType: 'third_party',
      instructor,
      category,
      description,
      duration,
      eligibility,
      curriculum,
      deliveryMode,
      fees,
      pricingType,
      certificateInfo,
      isCertificateAvailable: Boolean(certificateInfo),
      registrationDeadline,
      registrationUrl: urlCheck.normalizedUrl,
      registrationLink: urlCheck.normalizedUrl,
      level,
      imageUrl,
      status: 'available',
      availability: 'Available',
      approvalStatus: 'pending',
      isApproved: false,
      featured: false
    }
  };
}

export function getDefaultCourseImageForCategory(category?: string): string {
  const cat = normalizeCourseCategory(category);
  switch (cat) {
    case 'Microbiology':
      return 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80';
    case 'Molecular Biology':
      return 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80';
    case 'Bioinformatics':
      return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80';
    case 'Genetics':
      return 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
    case 'Pharmaceutical Sciences':
      return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80';
    case 'Clinical Research':
      return 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80';
    case 'Laboratory Techniques':
      return 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=800&q=80';
    case 'Research Methodology':
      return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
    case 'Biotechnology':
    default:
      return 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80';
  }
}

export function filterCourses(
  courses: UnifiedCourse[],
  filters: {
    category?: string;
    status?: string;
    deliveryMode?: string;
    pricingType?: 'all' | CoursePricingType;
    providerType?: 'all' | CourseProviderType;
    includeExpired?: boolean;
    search?: string;
    onlyFeatured?: boolean;
  },
  now: Date = new Date()
): UnifiedCourse[] {
  return courses.filter((c) => {
    const expired = isCourseExpired(c, now);
    const closed = isCourseRegistrationClosed(c, now);

    if (filters.includeExpired === false && expired) {
      return false;
    }

    if (filters.onlyFeatured && !c.featured) {
      return false;
    }

    if (filters.category && filters.category !== 'all') {
      const targetRaw = filters.category.trim().toLowerCase();
      const itemRaw = (c.category || '').trim().toLowerCase();
      if (itemRaw !== targetRaw) {
        // Fallback to canonical category comparison for canonical categories
        const isCanonicalTarget = COURSE_CATEGORIES.some((cat) => cat.toLowerCase() === targetRaw);
        if (!isCanonicalTarget || normalizeCourseCategory(c.category) !== normalizeCourseCategory(filters.category)) {
          return false;
        }
      }
    }

    if (filters.status && filters.status !== 'all') {
      const targetStatus = filters.status.toLowerCase();
      if (targetStatus === 'expired') {
        if (!expired) return false;
      } else if (targetStatus === 'closed') {
        if (!closed) return false;
      } else if (targetStatus === 'available') {
        if (closed) return false;
      }
    }

    if (filters.pricingType && filters.pricingType !== 'all') {
      const itemPricing = classifyCoursePricing(c.fees, c.pricingType);
      if (itemPricing !== filters.pricingType) return false;
    }

    if (filters.providerType && filters.providerType !== 'all') {
      const itemProviderType = normalizeCourseProviderType(c.providerType);
      if (itemProviderType !== filters.providerType) return false;
    }

    if (filters.deliveryMode && filters.deliveryMode !== 'all') {
      const targetMode = filters.deliveryMode.toLowerCase();
      if (!(c.deliveryMode || '').toLowerCase().includes(targetMode)) return false;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const titleMatch = (c.title || c.name || '').toLowerCase().includes(q);
      const providerMatch = (c.provider || '').toLowerCase().includes(q);
      const instMatch = (c.instructor || '').toLowerCase().includes(q);
      const descMatch = (c.description || '').toLowerCase().includes(q);
      const catMatch = (c.category || '').toLowerCase().includes(q);
      const syllabusMatch = (c.curriculum || []).some((m) => m.toLowerCase().includes(q));
      if (!titleMatch && !providerMatch && !instMatch && !descMatch && !catMatch && !syllabusMatch) {
        return false;
      }
    }

    return true;
  });
}

export function mapApiCourseToUnified(raw: any): UnifiedCourse {
  const title = (raw.title || raw.name || '').trim();
  const rawCategory = String(raw.category || '').trim();
  const category = rawCategory || 'Biotechnology';
  const expired = isCourseExpired({
    registrationDeadline: raw.registrationDeadline,
    isExpired: raw.isExpired
  });
  const status: CourseAvailabilityStatus = expired
    ? 'closed'
    : normalizeCourseStatus(raw.status, raw.availability);
  const curriculum = parseCurriculumInput(raw.curriculum || raw.syllabus);
  const certificateInfo = typeof raw.certificateInfo === 'string' ? raw.certificateInfo.trim() : '';
  const fees = String(raw.fees ?? raw.price ?? '').trim();
  const pricingType = classifyCoursePricing(fees, raw.pricingType);
  const providerType = normalizeCourseProviderType(raw.providerType);
  const approvalStatus = normalizeCourseApprovalStatus(raw.approvalStatus, raw.isApproved);
  const isApproved = approvalStatus === 'approved';
  const registrationUrl = String(raw.registrationUrl || raw.registrationLink || '').trim();

  return {
    id: raw.id,
    title,
    name: raw.name || title,
    provider: String(raw.provider || '').trim(),
    providerType,
    instructor: String(raw.instructor || '').trim(),
    category,
    description: String(raw.description || '').trim(),
    duration: String(raw.duration || '').trim(),
    eligibility: String(raw.eligibility || '').trim(),
    curriculum,
    syllabus: curriculum,
    deliveryMode: raw.deliveryMode ? normalizeDeliveryMode(raw.deliveryMode) : '',
    fees,
    price: fees,
    pricingType,
    certificateInfo,
    isCertificateAvailable: Boolean(certificateInfo),
    registrationDeadline: String(raw.registrationDeadline || '').trim(),
    registrationUrl,
    registrationLink: registrationUrl,
    status,
    availability: expired ? 'Expired' : status === 'closed' ? 'Closed' : (raw.availability || 'Available'),
    approvalStatus,
    isApproved,
    isExpired: expired,
    level: String(raw.level || '').trim(),
    imageUrl: raw.imageUrl || getDefaultCourseImageForCategory(category),
    featured: Boolean(raw.featured),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function mapCourseCategoryToBranchIds(category: CourseCategory): string[] {
  switch (category) {
    case 'Microbiology':
      return ['microbiology', 'biotechnology', 'life_sciences'];
    case 'Molecular Biology':
      return ['biotechnology', 'biochemistry', 'life_sciences'];
    case 'Bioinformatics':
      return ['bioinformatics', 'biotechnology', 'life_sciences'];
    case 'Genetics':
      return ['biotechnology', 'life_sciences', 'zoology'];
    case 'Pharmaceutical Sciences':
      return ['pharmacy', 'biochemistry', 'biotechnology'];
    case 'Clinical Research':
      return ['pharmacy', 'medical_lab_tech', 'life_sciences'];
    case 'Laboratory Techniques':
      return ['medical_lab_tech', 'biotechnology', 'microbiology'];
    case 'Research Methodology':
      return ['biotechnology', 'life_sciences', 'bioinformatics'];
    case 'Biotechnology':
    default:
      return ['biotechnology', 'microbiology', 'biochemistry'];
  }
}

export function mapUnifiedCourseToOpportunity(c: UnifiedCourse): Opportunity {
  const canonicalCategory = normalizeCourseCategory(c.category);
  const displayCategory = (c.category || '').trim() || canonicalCategory;
  const expired = isCourseExpired(c);
  const closed = isCourseRegistrationClosed(c);
  const modeLower = (c.deliveryMode || '').toLowerCase();
  const workMode: WorkMode = modeLower.includes('hybrid')
    ? 'Hybrid'
    : modeLower.includes('in-person')
    ? 'On-site'
    : 'Remote';
  const url = c.registrationUrl || c.registrationLink || '';
  const providerType = normalizeCourseProviderType(c.providerType);
  const pricingType = classifyCoursePricing(c.fees, c.pricingType);
  const certificateInfo = (c.certificateInfo || '').trim();

  return {
    id: c.id,
    title: c.title || c.name || '',
    category: displayCategory,
    organization: c.provider || '',
    description: c.description || '',
    type: 'course',
    subCategory: displayCategory,
    branches: mapCourseCategoryToBranchIds(canonicalCategory),
    eligibility: c.eligibility || '',
    qualification: c.eligibility || '',
    skills: (c.curriculum || []).slice(0, 4),
    experience: c.level || '',
    salaryOrStipend: c.fees || '',
    fees: c.fees || '',
    salaryTier: pricingType === 'free' ? 'unpaid' : 'paid',
    duration: c.duration || '',
    location: c.deliveryMode || '',
    workMode,
    deadline: c.registrationDeadline || '',
    postedDate: (c.createdAt || '2026-11-01').split('T')[0],
    sourceName:
      providerType === 'bionexa'
        ? c.provider || 'BIO-INEXA'
        : c.provider || 'Third-Party Course Provider',
    applicationUrl: url,
    registrationUrl: url,
    status: expired ? 'Expired' : closed ? 'Closed' : 'Open',
    isApproved: c.isApproved !== false,
    featured: Boolean(c.featured),
    courseDetails: {
      provider: c.provider,
      providerType,
      pricingType,
      duration: c.duration,
      lessonsCount: c.curriculum.length,
      fees: c.fees,
      deliveryMode: c.deliveryMode,
      certificateAvailable: Boolean(certificateInfo),
      certificateInfo,
      enrollmentUrl: url,
      syllabus: c.curriculum,
      level: c.level || '',
      eligibility: c.eligibility,
      registrationDeadline: c.registrationDeadline,
      imageUrl: c.imageUrl
    }
  };
}
