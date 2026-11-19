/**
 * Pure helper utilities for Phase 08 & Phase 12 Workshops Management System.
 * Keeps validation, normalization, expiry detection, filtering, and mapping decoupled from React components.
 */

import type { Opportunity, WorkMode } from '../../types/opportunity';
import type { UnifiedWorkshop } from '../../components/workshops/WorkshopCard';

export type WorkshopAvailabilityOption = 'Open' | 'Filling Fast' | 'Waitlist' | 'Closed';
export type WorkshopApprovalStatus = 'approved' | 'pending' | 'rejected';

export const WORKSHOP_CATEGORIES = [
  'Molecular Biology & CRISPR',
  'Bioinformatics & NGS',
  'Bioprocess & Fermentation',
  'Cell Culture & Flow Cytometry',
  'Quality Control & Regulatory',
  'Scientific Writing & Career',
  'General Biotechnology'
] as const;

export type WorkshopCategory = (typeof WORKSHOP_CATEGORIES)[number];

export interface WorkshopUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  domain?: string;
  reason?: string;
}

export interface WorkshopSubmissionInput {
  title: string;
  organizer: string;
  instructor?: string;
  category: string;
  description: string;
  format: string;
  venue: string;
  date: string;
  time?: string;
  duration?: string;
  registrationDeadline?: string;
  registrationUrl: string;
  fees?: string;
  capacity?: number | string | null;
  skillsCovered?: string[];
  imageUrl?: string;
}

const BLOCKED_WORKSHOP_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'example.net',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'test.com',
  'invalid'
]);

export const DEFAULT_WORKSHOP_IMAGE =
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';

/**
 * Basic HTTP(S) syntax check retained for backward compatibility.
 */
export function isValidWorkshopRegistrationUrl(url?: string): boolean {
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

/**
 * Strict Phase 12 Registration URL validator.
 * Rejects unsafe schemes, malformed URLs, and localhost/example placeholder domains.
 */
export function validateWorkshopRegistrationUrl(url?: string): WorkshopUrlValidationResult {
  const trimmed = String(url || '').trim();
  if (!trimmed || trimmed === '#') {
    return { valid: false, normalizedUrl: '', reason: 'Official registration URL is required.' };
  }
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, normalizedUrl: '', reason: 'Unsafe URL scheme is not permitted.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalizedUrl: '',
        reason: 'Registration URL must start with https:// or http://.'
      };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes('.') || BLOCKED_WORKSHOP_HOSTS.has(host)) {
      return {
        valid: false,
        normalizedUrl: '',
        reason: 'Please enter a valid official organizer or institutional domain.'
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      domain: host
    };
  } catch {
    return { valid: false, normalizedUrl: '', reason: 'Malformed registration URL.' };
  }
}

export function isValidWorkshopImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  return isValidWorkshopRegistrationUrl(trimmed);
}

export function normalizeWorkshopFormat(formatOrMode?: string): 'Online' | 'Offline' | 'Hybrid' {
  const clean = (formatOrMode || '').trim().toLowerCase();
  if (clean === 'offline' || clean === 'in-person' || clean === 'on-site' || clean === 'onsite') {
    return 'Offline';
  }
  if (clean === 'hybrid') return 'Hybrid';
  return 'Online';
}

export function normalizeWorkshopStatus(status?: string): 'upcoming' | 'ongoing' | 'completed' {
  const clean = (status || '').trim().toLowerCase();
  if (clean === 'ongoing' || clean === 'active') return 'ongoing';
  if (clean === 'completed' || clean === 'closed' || clean === 'expired') return 'completed';
  return 'upcoming';
}

export function normalizeWorkshopApprovalStatus(status?: string, isApproved?: boolean): WorkshopApprovalStatus {
  const clean = (status || '').trim().toLowerCase();
  if (clean === 'rejected') return 'rejected';
  if (clean === 'pending' || clean === 'pending_review' || clean === 'pending review') return 'pending';
  if (clean === 'approved') return 'approved';
  return isApproved === false ? 'pending' : 'approved';
}

export function normalizeAvailabilityOption(availability?: string): WorkshopAvailabilityOption {
  const clean = (availability || '').trim().toLowerCase();
  if (clean.includes('closed') || clean === 'full') return 'Closed';
  if (clean.includes('waitlist')) return 'Waitlist';
  if (clean.includes('fast') || clean.includes('limited') || clean.includes('few')) return 'Filling Fast';
  return 'Open';
}

/**
 * Converts common human-readable or ISO dates into YYYY-MM-DD for <input type="date">
 */
export function toDateInputValue(rawDate?: string, fallback: string = ''): string {
  if (!rawDate || typeof rawDate !== 'string') return fallback;
  const trimmed = rawDate.trim();
  if (!trimmed) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Handle "10 - 13 December 2026" -> "10 December 2026"
  const rangeMatch = trimmed.match(/^(\d{1,2})\s*[-–]\s*\d{1,2}\s+([A-Za-z]+\s+\d{4})$/);
  const candidate = rangeMatch ? `${rangeMatch[1]} ${rangeMatch[2]}` : trimmed;

  const parsed = new Date(candidate);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return fallback;
}

/**
 * Parses an ISO YYYY-MM-DD or readable workshop date into end-of-day UTC Date.
 */
export function parseWorkshopDate(rawDate?: string): Date | null {
  const raw = String(rawDate || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('rolling') || lower.includes('tba') || lower.includes('open') || lower.includes('not specified')) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Handle ranges like "10 - 13 December 2026" -> check end date "13 December 2026"
  const rangeMatch = raw.match(/^\d{1,2}\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+\s+\d{4})$/);
  const candidate = rangeMatch ? `${rangeMatch[1]} ${rangeMatch[2]}` : raw;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

/**
 * Automatically identifies whether a workshop is expired based on status, availability,
 * registrationDeadline, or workshop date having passed.
 */
export function isWorkshopExpired(
  workshop: {
    status?: string;
    availability?: string;
    registrationDeadline?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    isExpired?: boolean;
  },
  now: Date = new Date()
): boolean {
  if (workshop.isExpired) return true;
  const status = normalizeWorkshopStatus(workshop.status);
  const avail = (workshop.availability || '').toLowerCase();
  if (status === 'completed' || avail === 'closed' || avail.startsWith('closed')) {
    return true;
  }

  const deadlineDate = parseWorkshopDate(workshop.registrationDeadline);
  if (deadlineDate && deadlineDate.getTime() < now.getTime()) {
    return true;
  }

  const eventDate = parseWorkshopDate(workshop.endDate || workshop.date || workshop.startDate);
  if (eventDate && eventDate.getTime() < now.getTime()) {
    return true;
  }

  return false;
}

export function isWorkshopRegistrationClosed(
  workshop: {
    status?: string;
    availability?: string;
    registrationDeadline?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    isExpired?: boolean;
  },
  now: Date = new Date()
): boolean {
  return isWorkshopExpired(workshop, now);
}

export function getDefaultWorkshopImageForTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('rna') || lower.includes('python') || lower.includes('bioinformatics')) {
    return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80';
  }
  if (lower.includes('bioprocess') || lower.includes('fermentation')) {
    return 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80';
  }
  if (lower.includes('flow cytometry') || lower.includes('cell')) {
    return 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80';
  }
  if (lower.includes('haccp') || lower.includes('gmp') || lower.includes('food')) {
    return 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80';
  }
  if (lower.includes('manuscript') || lower.includes('writing') || lower.includes('journal')) {
    return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
  }
  return DEFAULT_WORKSHOP_IMAGE;
}

export function extractWorkshopCategories(workshops: Array<{ category?: string }>): string[] {
  const seen = new Map<string, string>();
  for (const ws of workshops) {
    const raw = String(ws.category || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, raw);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export function filterWorkshops(
  workshops: UnifiedWorkshop[],
  filters: {
    format?: string;
    status?: string;
    category?: string;
    availability?: string;
    search?: string;
    onlyFeatured?: boolean;
    includeExpired?: boolean;
  },
  now: Date = new Date()
): UnifiedWorkshop[] {
  const includeExpired = filters.includeExpired !== false;

  return workshops.filter((w) => {
    const expired = isWorkshopExpired(w, now);
    if (!includeExpired && expired) {
      return false;
    }

    if (filters.onlyFeatured && !w.featured) {
      return false;
    }

    if (filters.category && filters.category !== 'all') {
      if ((w.category || '').trim().toLowerCase() !== filters.category.trim().toLowerCase()) {
        return false;
      }
    }

    if (filters.format && filters.format !== 'all') {
      const fmt = normalizeWorkshopFormat(w.format || w.workMode);
      const targetFmt = normalizeWorkshopFormat(filters.format);
      if (fmt !== targetFmt) return false;
    }

    if (filters.status && filters.status !== 'all') {
      const curStatus = expired ? 'completed' : normalizeWorkshopStatus(w.status);
      if (curStatus !== filters.status.toLowerCase()) return false;
    }

    if (filters.availability && filters.availability !== 'all') {
      const curAvail = (expired ? 'closed' : w.availability || 'open').toLowerCase();
      if (!curAvail.includes(filters.availability.toLowerCase())) return false;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const titleMatch = (w.title || w.name || '').toLowerCase().includes(q);
      const descMatch = (w.description || '').toLowerCase().includes(q);
      const orgMatch = (w.organizer || '').toLowerCase().includes(q);
      const instMatch = (w.instructor || '').toLowerCase().includes(q);
      const catMatch = (w.category || '').toLowerCase().includes(q);
      const venueMatch = (w.venue || w.location || '').toLowerCase().includes(q);
      const skillsMatch = (w.skillsCovered || []).some((s) => s.toLowerCase().includes(q));
      if (!titleMatch && !descMatch && !orgMatch && !instMatch && !catMatch && !venueMatch && !skillsMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Maps an API workshop payload to UnifiedWorkshop preserving ONLY actually saved data.
 * Never fabricates organizer names, fees, schedules, or seat capacities when omitted.
 */
export function mapApiWorkshopToUnified(raw: any): UnifiedWorkshop {
  const title = String(raw.title || raw.name || '').trim();
  const format = normalizeWorkshopFormat(raw.format || raw.workMode);
  const rawStatus = normalizeWorkshopStatus(raw.status);
  const expired = isWorkshopExpired({
    status: rawStatus,
    availability: raw.availability,
    registrationDeadline: raw.registrationDeadline,
    date: raw.date || raw.startDate,
    endDate: raw.endDate,
    isExpired: raw.isExpired
  });

  const parsedCapacity =
    raw.capacity !== undefined && raw.capacity !== null && Number(raw.capacity) > 0
      ? Number(raw.capacity)
      : null;

  return {
    id: raw.id,
    title,
    name: raw.name || title,
    description: String(raw.description || '').trim(),
    organizer: String(raw.organizer || '').trim(),
    instructor: String(raw.instructor || '').trim(),
    category: String(raw.category || '').trim(),
    date: String(raw.date || raw.startDate || '').trim(),
    time: String(raw.time || '').trim(),
    duration: String(raw.duration || '').trim(),
    format,
    workMode: raw.workMode || format,
    venue: String(raw.venue || raw.location || '').trim(),
    location: String(raw.location || raw.venue || '').trim(),
    registrationDeadline: String(raw.registrationDeadline || '').trim(),
    registrationUrl: String(raw.registrationUrl || raw.registrationLink || '').trim(),
    registrationLink: String(raw.registrationLink || raw.registrationUrl || '').trim(),
    availability: expired ? 'Closed' : String(raw.availability || 'Open').trim(),
    status: expired ? 'completed' : rawStatus,
    fees: String(raw.fees || '').trim(),
    capacity: parsedCapacity,
    imageUrl: String(raw.imageUrl || '').trim(),
    featured: Boolean(raw.featured),
    skillsCovered: Array.isArray(raw.skillsCovered) ? raw.skillsCovered : [],
    approvalStatus: normalizeWorkshopApprovalStatus(raw.approvalStatus, raw.isApproved),
    isApproved: raw.isApproved !== false && normalizeWorkshopApprovalStatus(raw.approvalStatus, raw.isApproved) === 'approved',
    isExpired: expired
  };
}

export function mapUnifiedWorkshopToOpportunity(w: UnifiedWorkshop): Opportunity {
  const fmt = normalizeWorkshopFormat(w.format || w.workMode);
  const workMode: WorkMode = fmt === 'Offline' ? 'On-site' : fmt === 'Hybrid' ? 'Hybrid' : 'Remote';
  const closed = isWorkshopRegistrationClosed(w);
  const displayOrg = w.organizer || w.instructor || '';

  return {
    id: w.id,
    title: w.title || w.name || '',
    organization: displayOrg,
    description: w.description || '',
    type: 'workshop',
    subCategory: w.category || 'Biotechnology workshops',
    branches: ['biotechnology', 'life_sciences', 'microbiology', 'bioinformatics'],
    skills: w.skillsCovered || [],
    experience: 'Not Specified',
    salaryOrStipend: w.fees || '',
    fees: w.fees || '',
    salaryTier: 'not_disclosed',
    location: w.venue || w.location || '',
    workMode,
    deadline: w.registrationDeadline || w.date || 'Not Specified',
    postedDate: w.date || '',
    sourceName: displayOrg || 'Official Workshop Portal',
    applicationUrl: w.registrationUrl || w.registrationLink || '',
    registrationUrl: w.registrationUrl || w.registrationLink || '',
    status: closed ? 'Closed' : 'Active',
    isApproved: w.isApproved !== false,
    featured: Boolean(w.featured),
    workshopDetails: {
      dates: w.date,
      duration: w.duration || '',
      mode: fmt,
      fees: w.fees || '',
      // Never invent certification claims unless explicitly verified
      certificateAvailable: false,
      registrationUrl: w.registrationUrl || w.registrationLink || '',
      speakerOrTrainer: w.instructor || undefined
    }
  };
}

/**
 * Validates and sanitizes a public workshop submission payload.
 * Governance invariant: ALWAYS forces approvalStatus='pending', isApproved=false, featured=false.
 */
export function validateWorkshopSubmissionPayload(
  input: Partial<WorkshopSubmissionInput>,
  now: Date = new Date()
): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    name: string;
    organizer: string;
    instructor: string;
    category: string;
    description: string;
    format: 'Online' | 'Offline' | 'Hybrid';
    venue: string;
    date: string;
    time: string;
    duration: string;
    registrationDeadline: string;
    registrationUrl: string;
    registrationLink: string;
    fees: string;
    capacity: number | null;
    skillsCovered: string[];
    imageUrl: string;
    availability: 'Open';
    status: 'upcoming';
    approvalStatus: 'pending';
    isApproved: false;
    featured: false;
  };
} {
  const errors: string[] = [];
  const name = String(input.title || '').trim();
  const organizer = String(input.organizer || '').trim();
  const instructor = String(input.instructor || '').trim();
  const description = String(input.description || '').trim();
  const venue = String(input.venue || '').trim();
  const date = String(input.date || '').trim();
  const time = String(input.time || '').trim();
  const duration = String(input.duration || '').trim();
  const registrationDeadline = String(input.registrationDeadline || '').trim();
  const fees = String(input.fees || '').trim();
  const imageUrl = String(input.imageUrl || '').trim();

  if (name.length < 4) errors.push('Workshop title must be at least 4 characters.');
  if (organizer.length < 2) errors.push('Organizer / hosting institution name is required.');
  if (description.length < 15) errors.push('Workshop description must be at least 15 characters.');
  if (venue.length < 2) errors.push('Venue or online meeting platform is required.');
  if (!date) errors.push('Workshop date is required.');

  const parsedDate = date ? parseWorkshopDate(date) : null;
  if (date && !parsedDate) {
    errors.push('Please enter a valid workshop date.');
  } else if (parsedDate && parsedDate.getTime() < now.getTime()) {
    errors.push('Workshop date cannot be in the past.');
  }

  if (registrationDeadline) {
    const parsedDeadline = parseWorkshopDate(registrationDeadline);
    if (!parsedDeadline) {
      errors.push('Please enter a valid registration deadline date.');
    } else if (parsedDeadline.getTime() < now.getTime()) {
      errors.push('Registration deadline cannot be in the past.');
    }
  }

  const urlCheck = validateWorkshopRegistrationUrl(input.registrationUrl);
  if (!urlCheck.valid) {
    errors.push(urlCheck.reason || 'Valid official registration URL is required.');
  }

  if (imageUrl && !isValidWorkshopImageUrl(imageUrl)) {
    errors.push('Banner image URL must be a valid https:// or uploaded image path.');
  }

  let capacity: number | null = null;
  if (input.capacity !== undefined && input.capacity !== null && String(input.capacity).trim() !== '') {
    const parsedCap = Number(input.capacity);
    if (!Number.isFinite(parsedCap) || parsedCap < 1 || parsedCap > 100000) {
      errors.push('Capacity must be a positive number when specified.');
    } else {
      capacity = Math.floor(parsedCap);
    }
  }

  const rawCategory = String(input.category || '').trim();
  const category = (WORKSHOP_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory
    : rawCategory || 'General Biotechnology';

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const skillsCovered = Array.isArray(input.skillsCovered)
    ? input.skillsCovered.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
    : [];

  return {
    valid: true,
    errors: [],
    sanitized: {
      title: name,
      name,
      organizer,
      instructor,
      category,
      description,
      format: normalizeWorkshopFormat(input.format),
      venue,
      date,
      time,
      duration,
      registrationDeadline,
      registrationUrl: urlCheck.normalizedUrl,
      registrationLink: urlCheck.normalizedUrl,
      fees,
      capacity,
      skillsCovered,
      imageUrl,
      availability: 'Open',
      status: 'upcoming',
      approvalStatus: 'pending',
      isApproved: false,
      featured: false
    }
  };
}
