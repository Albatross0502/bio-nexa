/**
 * Netlify Function: admin-automation
 * Routes:
 * - GET  /api/admin/automated-sync/status
 * - POST /api/admin/automated-sync/run
 * - POST /api/admin/automated-sync/check-urls
 * - POST /api/admin/automated-sync/expire
 */

import { getRuntimeEnvironmentConfig } from '../../src/config/environment';
import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  serviceUnavailableResponse,
} from './_shared/http';
import { requireServerlessAdminAuth } from './_shared/serverlessAuth';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/admin-automation', '/api/admin/automated-sync'];

const SERVERLESS_AUTHORIZED_SOURCES = [
  {
    id: 'feed-dbt-csir',
    name: 'DBT & CSIR National Scientific Gazettes',
    category: 'Government / Autonomous Research',
    provider: 'Department of Biotechnology (Govt. of India)',
    endpointUrl: 'https://dbtindia.gov.in/vacancies',
    rateLimit: '30 requests / hour',
    termsOfServiceCompliant: true,
    notes: 'Official open government research fellowship & scientist notifications.',
  },
  {
    id: 'feed-biocon-careers',
    name: 'Biocon Biologics Authorized Employer Feed',
    category: 'Private Biopharma Enterprise',
    provider: 'Biocon Biologics Talent Acquisition',
    endpointUrl: 'https://www.biocon.com/careers/job-openings',
    rateLimit: '60 requests / hour',
    termsOfServiceCompliant: true,
    notes: 'Direct corporate career portal feed for bioprocess and fermentation roles.',
  },
  {
    id: 'feed-ncbi-pubmed',
    name: 'NCBI PubMed Literature & Fellowship Registry',
    category: 'Scientific Publication / Research Openings',
    provider: 'National Center for Biotechnology Information (NCBI)',
    endpointUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    rateLimit: '3 requests / second with API token',
    termsOfServiceCompliant: true,
    notes: 'Open access scientific E-utilities queries connecting research labs.',
  },
  {
    id: 'feed-adzuna-lifesciences',
    name: 'Adzuna Developer Life Sciences Feed',
    category: 'Licensed Job Search Index',
    provider: 'Adzuna Developer API',
    endpointUrl: 'https://api.adzuna.com/v1/api/jobs/in/search',
    rateLimit: '250 requests / day (Developer License)',
    termsOfServiceCompliant: true,
    notes: 'Authorized programmatic API search for Indian life sciences and pharma.',
  },
  {
    id: 'feed-google-sheets',
    name: 'BIO-INEXA Institutional Collaborative Google Sheet',
    category: 'Verified Partner Institutions',
    provider: 'Google Apps Script Web App Endpoint',
    endpointUrl: 'https://script.google.com/macros/s/exec',
    rateLimit: '10 requests / minute',
    termsOfServiceCompliant: true,
    notes: '19-column standardized collaborative sheet maintained by career cells.',
  },
];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = requireServerlessAdminAuth(event, ALLOWED_METHODS);
  if (auth.authorized === false) return auth.response;

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const config = getRuntimeEnvironmentConfig();

  if (subPath === 'status') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(event, ['GET']);
    }
    return jsonResponse(
      event,
      200,
      {
        success: true,
        lastReport: null,
        sources: SERVERLESS_AUTHORIZED_SOURCES,
        isSyncing: false,
        persistentDbConfigured: config.supabaseConfigured,
      },
      ['GET']
    );
  }

  if (subPath === 'run' || subPath === 'check-urls' || subPath === 'expire') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(event, ['POST']);
    }
    return serviceUnavailableResponse(
      event,
      'Automated feed synchronization and expiry persistence require cloud database storage (Phase 04) before saving updates in serverless production.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ['POST']
    );
  }

  return errorResponse(event, 404, 'Not Found', 'Automated sync endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
