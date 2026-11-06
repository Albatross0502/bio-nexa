/**
 * BIO-NEXA Duplicate Detection Engine
 * 
 * Accurately prevents duplicate vacancies across multiple ingestion feeds
 * without mistakenly merging distinct opportunities with similar titles.
 */

import { Opportunity } from '../../types/opportunity';

/**
 * Normalizes a URL by stripping tracking parameters, trailing slashes, and protocol
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Strip common tracking query params
    const cleanParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      if (!key.startsWith('utm_') && key !== 'ref' && key !== 'source' && key !== 'fbclid') {
        cleanParams.append(key, val);
      }
    });
    parsed.search = cleanParams.toString();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

/**
 * Normalizes text for comparison (removes punctuation, extra spaces, lowercases)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a candidate opportunity is a duplicate of any existing opportunity in the repository.
 * Returns the matching opportunity if a duplicate is found, or null otherwise.
 */
export function findDuplicateOpportunity(
  candidate: Partial<Opportunity>,
  existingOpportunities: Opportunity[]
): Opportunity | null {
  if (!candidate || !existingOpportunities || existingOpportunities.length === 0) {
    return null;
  }

  const candidateId = candidate.id;
  const candidateSourceId = candidate.sourceId;
  const candidateSourceName = candidate.sourceName;
  const candidateNormUrl = normalizeUrl(candidate.applicationUrl || candidate.sourceUrl || '');
  const candidateNormTitle = normalizeText(candidate.title || '');
  const candidateNormOrg = normalizeText(candidate.organization || '');
  const candidateNormLoc = normalizeText(candidate.location || '');

  for (const existing of existingOpportunities) {
    // 0. Skip self
    if (candidateId && existing.id === candidateId) {
      continue;
    }

    // 1. Direct Source ID match from same source
    if (
      candidateSourceId &&
      candidateSourceName &&
      existing.sourceId === candidateSourceId &&
      existing.sourceName === candidateSourceName
    ) {
      return existing;
    }

    // 2. Canonical Application URL match
    const existingNormUrl = normalizeUrl(existing.applicationUrl || existing.sourceUrl || '');
    if (candidateNormUrl && existingNormUrl && candidateNormUrl === existingNormUrl) {
      return existing;
    }

    // 3. Organization + Title + Location exact normalized match
    const existingNormTitle = normalizeText(existing.title || '');
    const existingNormOrg = normalizeText(existing.organization || '');
    const existingNormLoc = normalizeText(existing.location || '');

    if (
      candidateNormOrg &&
      existingNormOrg &&
      candidateNormOrg === existingNormOrg &&
      candidateNormTitle === existingNormTitle
    ) {
      // Check if location or category matches
      if (
        !candidateNormLoc ||
        !existingNormLoc ||
        candidateNormLoc === existingNormLoc ||
        candidateNormLoc.includes(existingNormLoc) ||
        existingNormLoc.includes(candidateNormLoc)
      ) {
        return existing;
      }
    }
  }

  return null;
}

export const isDuplicateOpportunity = findDuplicateOpportunity;
export const detectDuplicates = findDuplicateOpportunity;
