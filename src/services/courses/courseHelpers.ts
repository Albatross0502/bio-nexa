/**
 * Pure helper utilities for Phase 09 Courses Management System.
 * Keeps category definitions, URL/image validation, status normalization,
 * curriculum parsing, filtering, and mapping decoupled from React components.
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

export const COURSE_DELIVERY_MODES = [
  'Online (Self-Paced)',
  'Online (Live Cohort)',
  'Hybrid',
  'In-Person'
] as const;

export type CourseDeliveryMode = (typeof COURSE_DELIVERY_MODES)[number] | string;

export interface UnifiedCourse {
  id: string;
  title: string;
  name?: string;
  provider: string;
  instructor?: string;
  category: CourseCategory | string;
  description: string;
  duration: string;
  eligibility: string;
  curriculum: string[];
  syllabus?: string[];
  deliveryMode: string;
  fees: string;
  price?: string;
  certificateInfo?: string;
  isCertificateAvailable?: boolean;
  registrationDeadline: string;
  registrationUrl: string;
  registrationLink?: string;
  status: CourseAvailabilityStatus;
  availability?: string;
  level?: string;
  imageUrl?: string;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_COURSE_IMAGE =
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';

export function isValidCourseRegistrationUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidCourseImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  return isValidCourseRegistrationUrl(trimmed);
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

export function normalizeCourseStatus(status?: string, availability?: string): CourseAvailabilityStatus {
  const s = (status || '').trim().toLowerCase();
  const a = (availability || '').trim().toLowerCase();

  if (s === 'closed' || s === 'archived' || s === 'expired' || s === 'inactive') {
    return 'closed';
  }
  if (a === 'closed' || a.startsWith('closed')) {
    return 'closed';
  }
  return 'available';
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

export function isCourseRegistrationClosed(
  course: {
    status?: string;
    availability?: string;
    registrationDeadline?: string;
  },
  now: Date = new Date()
): boolean {
  const status = normalizeCourseStatus(course.status, course.availability);
  if (status === 'closed') return true;

  if (course.registrationDeadline && /^\d{4}-\d{2}-\d{2}$/.test(course.registrationDeadline.trim())) {
    const deadlineDate = new Date(course.registrationDeadline.trim());
    if (!Number.isNaN(deadlineDate.getTime())) {
      deadlineDate.setHours(23, 59, 59, 999);
      if (deadlineDate.getTime() < now.getTime()) return true;
    }
  }
  return false;
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
    search?: string;
    onlyFeatured?: boolean;
  }
): UnifiedCourse[] {
  return courses.filter((c) => {
    if (filters.onlyFeatured && !c.featured) {
      return false;
    }

    if (filters.category && filters.category !== 'all') {
      const targetCat = normalizeCourseCategory(filters.category);
      const itemCat = normalizeCourseCategory(c.category);
      if (itemCat !== targetCat) return false;
    }

    if (filters.status && filters.status !== 'all') {
      const targetStatus = filters.status.toLowerCase();
      const itemStatus = normalizeCourseStatus(c.status, c.availability);
      if (itemStatus !== targetStatus) return false;
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
  const title = raw.title || raw.name || 'Biotechnology Course';
  const category = normalizeCourseCategory(raw.category);
  const status = normalizeCourseStatus(raw.status, raw.availability);
  const curriculum = parseCurriculumInput(raw.curriculum || raw.syllabus);
  const certificateInfo = typeof raw.certificateInfo === 'string' ? raw.certificateInfo.trim() : '';

  return {
    id: raw.id,
    title,
    name: raw.name || title,
    provider: raw.provider || raw.instructor || 'Institutional Training Partner',
    instructor: raw.instructor || raw.provider || '',
    category,
    description: raw.description || '',
    duration: raw.duration || 'Self-Paced',
    eligibility: raw.eligibility || 'Life Sciences & Biotechnology Learners',
    curriculum,
    syllabus: curriculum,
    deliveryMode: normalizeDeliveryMode(raw.deliveryMode),
    fees: raw.fees || raw.price || 'Not Specified',
    price: raw.price || raw.fees || 'Not Specified',
    certificateInfo,
    isCertificateAvailable: Boolean(certificateInfo) || Boolean(raw.isCertificateAvailable),
    registrationDeadline: raw.registrationDeadline || 'Open / Rolling',
    registrationUrl: raw.registrationUrl || raw.registrationLink || '',
    registrationLink: raw.registrationLink || raw.registrationUrl || '',
    status,
    availability: status === 'closed' ? 'Closed' : raw.availability || 'Available',
    level: raw.level || 'Intermediate',
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
  const category = normalizeCourseCategory(c.category);
  const closed = isCourseRegistrationClosed(c);
  const modeLower = (c.deliveryMode || '').toLowerCase();
  const workMode: WorkMode = modeLower.includes('hybrid')
    ? 'Hybrid'
    : modeLower.includes('in-person')
    ? 'On-site'
    : 'Remote';
  const url = c.registrationUrl || c.registrationLink || '';

  return {
    id: c.id,
    title: c.title || c.name || 'Biotechnology Course',
    category,
    organization: c.provider || c.instructor || 'Institutional Training Partner',
    description: c.description || '',
    type: 'course',
    subCategory: category,
    branches: mapCourseCategoryToBranchIds(category),
    eligibility: c.eligibility || 'Open to Science Students',
    qualification: c.eligibility || 'Open to Science Students',
    skills: (c.curriculum || []).slice(0, 4),
    experience: c.level || 'All Levels',
    salaryOrStipend: c.fees || 'See Provider Portal',
    fees: c.fees || 'See Provider Portal',
    salaryTier: 'not_disclosed',
    duration: c.duration || 'Self-Paced',
    location: c.deliveryMode || 'Online (Self-Paced)',
    workMode,
    deadline: c.registrationDeadline || 'Open / Rolling',
    postedDate: (c.createdAt || '2026-11-01').split('T')[0],
    sourceName: c.provider || 'Verified Course Provider',
    applicationUrl: url,
    registrationUrl: url,
    status: closed ? 'Closed' : 'Open',
    isApproved: true,
    featured: Boolean(c.featured),
    courseDetails: {
      provider: c.provider || c.instructor,
      duration: c.duration,
      lessonsCount: c.curriculum.length,
      fees: c.fees,
      deliveryMode: c.deliveryMode,
      certificateAvailable: Boolean(c.certificateInfo),
      certificateInfo: c.certificateInfo || '',
      enrollmentUrl: url,
      syllabus: c.curriculum,
      level: c.level || 'Intermediate',
      eligibility: c.eligibility,
      registrationDeadline: c.registrationDeadline,
      imageUrl: c.imageUrl
    }
  };
}
