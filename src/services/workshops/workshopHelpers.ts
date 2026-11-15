/**
 * Pure helper utilities for Phase 08 Workshops Management System.
 * Keeps validation, normalization, filtering, and mapping decoupled from React components.
 */

import type { Opportunity, WorkMode } from '../../types/opportunity';
import type { UnifiedWorkshop } from '../../components/workshops/WorkshopCard';

export type WorkshopAvailabilityOption = 'Open' | 'Filling Fast' | 'Waitlist' | 'Closed';

export const DEFAULT_WORKSHOP_IMAGE =
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';

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
export function toDateInputValue(rawDate?: string, fallback: string = '2026-12-10'): string {
  if (!rawDate || typeof rawDate !== 'string') return fallback;
  const trimmed = rawDate.trim();
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

export function isWorkshopRegistrationClosed(
  workshop: {
    status?: string;
    availability?: string;
    registrationDeadline?: string;
  },
  now: Date = new Date()
): boolean {
  const status = normalizeWorkshopStatus(workshop.status);
  const avail = (workshop.availability || '').toLowerCase();
  if (status === 'completed' || avail === 'closed' || avail.startsWith('closed')) {
    return true;
  }
  if (workshop.registrationDeadline) {
    const d = new Date(workshop.registrationDeadline);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      if (d.getTime() < now.getTime()) return true;
    }
  }
  return false;
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

export function filterWorkshops(
  workshops: UnifiedWorkshop[],
  filters: {
    format?: string;
    status?: string;
    availability?: string;
    search?: string;
    onlyFeatured?: boolean;
  }
): UnifiedWorkshop[] {
  return workshops.filter((w) => {
    if (filters.onlyFeatured && !w.featured) {
      return false;
    }

    if (filters.format && filters.format !== 'all') {
      const fmt = normalizeWorkshopFormat(w.format || w.workMode);
      const targetFmt = normalizeWorkshopFormat(filters.format);
      if (fmt !== targetFmt) return false;
    }

    if (filters.status && filters.status !== 'all') {
      const curStatus = normalizeWorkshopStatus(w.status);
      if (curStatus !== filters.status.toLowerCase()) return false;
    }

    if (filters.availability && filters.availability !== 'all') {
      const curAvail = (w.availability || 'open').toLowerCase();
      if (!curAvail.includes(filters.availability.toLowerCase())) return false;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const titleMatch = (w.title || w.name || '').toLowerCase().includes(q);
      const descMatch = (w.description || '').toLowerCase().includes(q);
      const instMatch = (w.instructor || w.organizer || '').toLowerCase().includes(q);
      const venueMatch = (w.venue || w.location || '').toLowerCase().includes(q);
      const skillsMatch = (w.skillsCovered || []).some((s) => s.toLowerCase().includes(q));
      if (!titleMatch && !descMatch && !instMatch && !venueMatch && !skillsMatch) {
        return false;
      }
    }

    return true;
  });
}

export function mapApiWorkshopToUnified(raw: any): UnifiedWorkshop {
  const title = raw.title || raw.name || 'Biotechnology Workshop';
  const format = normalizeWorkshopFormat(raw.format || raw.workMode);
  const status = normalizeWorkshopStatus(raw.status);
  return {
    id: raw.id,
    title,
    name: raw.name || title,
    description: raw.description || '',
    instructor: raw.instructor || raw.organizer || 'BIO-NEXA Faculty',
    organizer: raw.organizer || raw.instructor || 'BIO-NEXA Academy',
    date: raw.date || raw.startDate || '2026-12-01',
    time: raw.time || '09:30 AM - 04:30 PM IST',
    duration: raw.duration || '1 Day',
    format,
    workMode: raw.workMode || format,
    venue: raw.venue || raw.location || 'Online Live Portal',
    location: raw.location || raw.venue || 'Online Live Portal',
    registrationDeadline: raw.registrationDeadline || '',
    registrationUrl: raw.registrationUrl || raw.registrationLink || '',
    registrationLink: raw.registrationLink || raw.registrationUrl || '',
    availability: raw.availability || 'Open',
    status,
    fees: raw.fees || 'Free',
    capacity: typeof raw.capacity === 'number' ? raw.capacity : 50,
    imageUrl: raw.imageUrl || getDefaultWorkshopImageForTitle(title),
    featured: Boolean(raw.featured),
    skillsCovered: Array.isArray(raw.skillsCovered) ? raw.skillsCovered : []
  };
}

export function mapUnifiedWorkshopToOpportunity(w: UnifiedWorkshop): Opportunity {
  const fmt = normalizeWorkshopFormat(w.format || w.workMode);
  const workMode: WorkMode = fmt === 'Offline' ? 'On-site' : fmt === 'Hybrid' ? 'Hybrid' : 'Remote';
  const closed = isWorkshopRegistrationClosed(w);

  return {
    id: w.id,
    title: w.title || w.name || 'Biotechnology Workshop',
    organization: w.organizer || w.instructor || 'BIO-NEXA Academy',
    description: w.description || '',
    type: 'workshop',
    subCategory: 'Biotechnology workshops',
    branches: ['biotechnology', 'life_sciences', 'microbiology', 'bioinformatics'],
    skills: w.skillsCovered || [],
    experience: 'Not Specified',
    salaryOrStipend: w.fees || 'Free',
    fees: w.fees || 'Free',
    salaryTier: 'not_disclosed',
    location: w.venue || w.location || 'Online',
    workMode,
    deadline: w.registrationDeadline || w.date || 'Not Specified',
    postedDate: w.date || '2026-11-01',
    sourceName: w.organizer || 'BIO-NEXA Workshops',
    applicationUrl: w.registrationUrl || w.registrationLink || '',
    registrationUrl: w.registrationUrl || w.registrationLink || '',
    status: closed ? 'Closed' : 'Active',
    isApproved: true,
    featured: Boolean(w.featured),
    workshopDetails: {
      dates: w.date,
      duration: w.duration || '1 Day',
      mode: fmt,
      fees: w.fees || 'Free',
      certificateAvailable: true,
      registrationUrl: w.registrationUrl || w.registrationLink || '',
      speakerOrTrainer: w.instructor
    }
  };
}
