/**
 * Netlify Function: jobs
 * Routes:
 * - GET  /api/jobs
 * - GET  /api/jobs/:id
 * - POST /api/jobs/submit
 * - POST /api/jobs/:id/report
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  isValidHttpUrl,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { SERVERLESS_JOBS } from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';
import { findDuplicateJob, validateApplicationUrl } from '../../src/services/jobs/jobVerification';

const ALLOWED_METHODS = ['GET', 'POST'];
const BASE_PREFIXES = ['/.netlify/functions/jobs', '/api/jobs'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  if (method === 'GET') {
    if (!subPath) {
      const params = event.queryStringParameters || {};
      const search = (params.search || '').trim();
      const sector = (params.sector || '').trim();
      const location = (params.location || '').trim();
      const verificationStatus = (params.verificationStatus || '').trim();

      const filtered = repo
        ? await repo.getJobs({
            search: search || undefined,
            sector: sector && sector !== 'all' ? sector : undefined,
            location: location && location !== 'all' ? location : undefined,
            verificationStatus: verificationStatus && verificationStatus !== 'all' ? verificationStatus : undefined,
            onlyActive: true,
            onlyApproved: true,
          })
        : SERVERLESS_JOBS.filter((job) => {
            if (!job.isActive || !job.isApproved) return false;
            if (sector && sector.toLowerCase() !== 'all' && !job.sector.toLowerCase().includes(sector.toLowerCase())) {
              return false;
            }
            if (location && location.toLowerCase() !== 'all' && !job.location.toLowerCase().includes(location.toLowerCase())) {
              return false;
            }
            if (search) {
              const hay = [
                job.title,
                job.employer,
                job.description,
                job.location,
                job.sector,
                ...job.skills,
              ]
                .join(' ')
                .toLowerCase();
              if (!hay.includes(search.toLowerCase())) return false;
            }
            return true;
          });

      const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
      const { items: paginatedJobs, pagination } = paginateArray(filtered, page, limit);

      return jsonResponse(
        event,
        200,
        {
          success: true,
          count: filtered.length,
          total: pagination.total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: pagination.totalPages,
          pagination,
          persistentDbConfigured: Boolean(repo),
          jobs: paginatedJobs,
        },
        ALLOWED_METHODS
      );
    }

    if (!subPath.includes('/')) {
      const id = decodeURIComponent(subPath);
      const job = repo ? await repo.getJobById(id) : SERVERLESS_JOBS.find((j) => j.id === id) || null;
      if (!job) {
        return errorResponse(event, 404, 'Not Found', 'Job opening not found.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      const verifications = repo
        ? await repo.getJobVerificationRecords(job.id)
        : job.lastVerificationDate
        ? [
            {
              id: `ver-${job.id}`,
              jobId: job.id,
              verifiedBy: 'BIO-INEXA Operations Audit',
              verifiedAt: job.lastVerificationDate,
              sourceStatus: job.verificationStatus,
              notes: job.verificationNotes || 'Verified against official source portal.',
            },
          ]
        : [];

      return jsonResponse(
        event,
        200,
        {
          success: true,
          job,
          verifications,
        },
        ALLOWED_METHODS
      );
    }

    return errorResponse(event, 404, 'Not Found', 'Job endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (method === 'POST') {
    if (subPath === 'submit') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      const body = parsed.data;
      const title = sanitizeString(body.title);
      const employer = sanitizeString(body.employer || body.company);
      const applicationUrl = sanitizeString(body.applicationUrl);
      const description = sanitizeString(body.description);
      const location = sanitizeString(body.location);

      if (!title || !employer || !applicationUrl || !description || !location) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Required fields missing: title, employer/company, applicationUrl, description, location.',
          { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ALLOWED_METHODS }
        );
      }

      const urlCheck = validateApplicationUrl(applicationUrl);
      if (!urlCheck.valid) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          urlCheck.reason || 'Invalid applicationUrl: Must be a valid URL starting with http:// or https://',
          { code: 'INVALID_URL', allowedMethods: ALLOWED_METHODS }
        );
      }

      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Public job submission persistence is not yet connected in serverless production. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before accepting live submissions.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ALLOWED_METHODS
        );
      }

      const existingJobs = await repo.getJobs({ onlyActive: false, onlyApproved: false });
      const duplicate = findDuplicateJob({ title, employer, applicationUrl }, existingJobs);
      if (duplicate) {
        return errorResponse(
          event,
          409,
          'Duplicate Listing',
          `A similar opening already exists (${duplicate.title} at ${duplicate.employer}).`,
          { code: 'DUPLICATE_JOB_LISTING', allowedMethods: ALLOWED_METHODS }
        );
      }

      const createdJob = await repo.createJob({
        title,
        employer,
        applicationUrl,
        description,
        location,
        qualification: sanitizeString(body.qualification) || 'Life Sciences Graduate',
        skills: Array.isArray(body.skills) ? body.skills : [],
        employmentType: sanitizeString(body.employmentType) || 'Full-time',
        salary: sanitizeString(body.salary) || 'Competitive / Disclosed on Employer Portal',
        source: 'Employer Portal Submission (Pending Review)',
        originalJobUrl: applicationUrl,
        expiryDate: sanitizeString(body.deadline),
        verificationStatus: 'Pending Verification',
        isActive: true,
        isApproved: false,
        featured: false,
        responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
        requirements: Array.isArray(body.requirements) ? body.requirements : [],
        sector: sanitizeString(body.sector) || 'Biotechnology',
      });

      return jsonResponse(
        event,
        201,
        {
          success: true,
          jobId: createdJob.id,
          job: createdJob,
          message: 'Job submitted successfully and queued for admin verification before public listing.',
        },
        ALLOWED_METHODS
      );
    }

    if (subPath.endsWith('/report') && subPath.length > '/report'.length) {
      const jobId = decodeURIComponent(subPath.slice(0, -'/report'.length));
      const job = repo ? await repo.getJobById(jobId) : SERVERLESS_JOBS.find((j) => j.id === jobId) || null;
      if (!job) {
        return errorResponse(event, 404, 'Not Found', 'Job listing not found.', {
          code: 'JOB_NOT_FOUND',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, {
          code: 'INVALID_JSON',
          allowedMethods: ALLOWED_METHODS,
        });
      }

      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Listing report persistence is not yet connected in serverless production. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or check Grievance & Contact details.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ALLOWED_METHODS
        );
      }

      const reason = sanitizeString(parsed.data.reason) || 'Listing Concern';
      const details = sanitizeString(parsed.data.details) || `Reported job ${job.title} (${job.id}).`;
      const created = await repo.createComplianceRequest({
        requestType: 'job_report',
        subCategory: reason,
        requesterName: sanitizeString(parsed.data.reportedBy) || 'Platform Visitor',
        requesterEmail: sanitizeString(parsed.data.reporterEmail) || 'visitor-report@bio-inexa.org',
        organization: job.employer,
        targetTitleOrUrl: `${job.title} (${job.id})`,
        details,
        consentAccepted: true,
      });

      return jsonResponse(
        event,
        201,
        {
          success: true,
          reportId: created.referenceId,
          message: `Report ${created.referenceId} logged for compliance review.`,
        },
        ALLOWED_METHODS
      );
    }

    return errorResponse(event, 404, 'Not Found', 'Job POST endpoint not found.', {
      code: 'API_ROUTE_NOT_FOUND',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  return methodNotAllowedResponse(event, ALLOWED_METHODS);
};
