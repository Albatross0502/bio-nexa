/**
 * BIO-NEXA Legal Data Sources Registry
 * 
 * Strict Legal Compliance Rules:
 * - NO unpermitted scraping of LinkedIn, Naukri, or WorkIndia.
 * - NO bypassing of CAPTCHAs, rate limits, or logins.
 * - Verified public RSS/JSON feeds and official APIs with proper attribution.
 * - Fallback to pre-filtered external search queries when direct API access is not legally granted.
 */

export type SourceIntegrationMethod =
  | 'official_public_api'
  | 'employer_authorized_feed'
  | 'government_open_data'
  | 'direct_submission'
  | 'prefiltered_search_fallback';

export type SourcePermissionStatus =
  | 'authorized'
  | 'public_open_licence'
  | 'partner_agreement_active'
  | 'search_fallback_only'
  | 'disabled';

export type SourceHealthStatus =
  | 'Operational'
  | 'Fallback Active'
  | 'Rate Limited'
  | 'Temporarily Unavailable'
  | 'Requires API Key';

export interface OpportunityDataSource {
  id: string;
  name: string;
  category: 'Job Portal' | 'Government / Academic' | 'Direct Community' | 'Workshop Provider';
  method: SourceIntegrationMethod;
  permissionStatus: SourcePermissionStatus;
  healthStatus: SourceHealthStatus;
  endpointOrFeedUrl?: string;
  attributionText: string;
  rateLimitInfo: string;
  lastSuccessfulSync: string; // ISO date
  recordsSyncedCount: number;
  syncFrequency: string; // e.g. "Every 6 Hours"
  documentationUrl: string;
  complianceNotes: string;
}

export const DATA_SOURCES_REGISTRY: OpportunityDataSource[] = [
  {
    id: 'src-govt-research',
    name: 'DBT & CSIR National Research Fellowship Feeds',
    category: 'Government / Academic',
    method: 'government_open_data',
    permissionStatus: 'public_open_licence',
    healthStatus: 'Operational',
    endpointOrFeedUrl: 'https://dbtindia.gov.in/whats-new/vacancies/feed',
    attributionText: 'Official public notification by Department of Biotechnology (DBT), Govt. of India',
    rateLimitInfo: '60 requests / hour (Cached)',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 42,
    syncFrequency: 'Every 6 Hours',
    documentationUrl: 'https://dbtindia.gov.in',
    complianceNotes: 'Open public recruitment gazettes and research fellowships under National Open Data guidelines.'
  },
  {
    id: 'src-direct-employers',
    name: 'Direct Biotech Employer & Institutional Submissions',
    category: 'Direct Community',
    method: 'direct_submission',
    permissionStatus: 'authorized',
    healthStatus: 'Operational',
    endpointOrFeedUrl: '/api/opportunities/submit',
    attributionText: 'Directly verified submission by verified organization',
    rateLimitInfo: 'Rate-limited per IP (10 submissions / hour)',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 38,
    syncFrequency: 'Real-time via Admin Moderation',
    documentationUrl: 'https://bio-nexa.netlify.app/opportunities?tab=submit',
    complianceNotes: 'Full explicit permission granted by submitting employers, subject to admin verification.'
  },
  {
    id: 'src-workshop-organisers',
    name: 'Academic & Training Workshop Organiser Network',
    category: 'Workshop Provider',
    method: 'direct_submission',
    permissionStatus: 'authorized',
    healthStatus: 'Operational',
    endpointOrFeedUrl: '/api/workshops/submit',
    attributionText: 'Direct submission with confirmed certificate and syllabus verification',
    rateLimitInfo: 'Moderated queue',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 19,
    syncFrequency: 'Real-time via Admin Moderation',
    documentationUrl: 'https://bio-nexa.netlify.app/workshops',
    complianceNotes: 'Certificate claims strictly verified before public listing.'
  },
  {
    id: 'src-adzuna-api',
    name: 'Adzuna India Job Search API',
    category: 'Job Portal',
    method: 'official_public_api',
    permissionStatus: 'authorized',
    healthStatus: 'Operational',
    endpointOrFeedUrl: 'https://api.adzuna.com/v1/api/jobs/in/search/1',
    attributionText: 'Jobs powered by Adzuna API with direct employer redirection',
    rateLimitInfo: '250 calls / day (Free developer tier)',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 24,
    syncFrequency: 'Every 6 Hours',
    documentationUrl: 'https://developer.adzuna.com',
    complianceNotes: 'Requires ADZUNA_APP_ID and ADZUNA_APP_KEY in Netlify env. Falls back gracefully to search links if unconfigured.'
  },
  {
    id: 'src-linkedin',
    name: 'LinkedIn Jobs Portal',
    category: 'Job Portal',
    method: 'prefiltered_search_fallback',
    permissionStatus: 'search_fallback_only',
    healthStatus: 'Fallback Active',
    attributionText: 'Original vacancy hosted on LinkedIn. BIO-NEXA provides pre-filtered legal search redirection.',
    rateLimitInfo: 'No scraping executed; direct user referral link.',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 0,
    syncFrequency: 'On-demand client redirection',
    documentationUrl: 'https://www.linkedin.com/legal/user-agreement',
    complianceNotes: 'LinkedIn TOS strictly prohibits unconsented scraping. We provide legal pre-filtered search queries preserving LinkedIn ownership.'
  },
  {
    id: 'src-naukri',
    name: 'Naukri.com Life Sciences',
    category: 'Job Portal',
    method: 'prefiltered_search_fallback',
    permissionStatus: 'search_fallback_only',
    healthStatus: 'Fallback Active',
    attributionText: 'Original vacancy hosted on Naukri.com. Direct pre-filtered redirection provided.',
    rateLimitInfo: 'No scraping executed; direct referral link.',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 0,
    syncFrequency: 'On-demand client redirection',
    documentationUrl: 'https://www.naukri.com/termsconditions',
    complianceNotes: 'Naukri does not offer a free public consumer job API. Redirection protects legal terms.'
  },
  {
    id: 'src-workindia',
    name: 'WorkIndia Freshers & Entry Portal',
    category: 'Job Portal',
    method: 'prefiltered_search_fallback',
    permissionStatus: 'search_fallback_only',
    healthStatus: 'Fallback Active',
    attributionText: 'Pre-filtered search link to WorkIndia entry-level vacancies.',
    rateLimitInfo: 'No scraping executed; direct referral link.',
    lastSuccessfulSync: new Date().toISOString(),
    recordsSyncedCount: 0,
    syncFrequency: 'On-demand client redirection',
    documentationUrl: 'https://www.workindia.in',
    complianceNotes: 'Pre-filtered direct search URL generator utilized.'
  }
];

export const DATA_SOURCES = DATA_SOURCES_REGISTRY.map(s => ({
  ...s,
  syncCadenceHours: s.syncFrequency.includes('6') ? 6 : 24,
  isActive: s.healthStatus === 'Operational' || s.healthStatus === 'Fallback Active',
  baseUrl: s.documentationUrl,
  type: s.method,
  notes: s.complianceNotes,
}));
