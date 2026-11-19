/**
 * Netlify Serverless Function: opportunities
 * Routes:
 * - GET  /api/opportunities (or /.netlify/functions/opportunities)
 * - POST /api/opportunities
 */

import { SEED_OPPORTUNITIES } from '../../src/services/opportunities/seedOpportunities';
import {
  errorResponse,
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
import { getSupabaseRepository } from './_shared/supabaseDb';
import { paginateArray, parsePaginationParams } from '../../src/utils/apiPagination';

const ALLOWED_METHODS = ['GET', 'POST'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  const repo = getSupabaseRepository();

  if (method === 'GET') {
    const params = event.queryStringParameters || {};
    const branch = (params.branch || '').trim().toLowerCase();
    const type = (params.type || '').trim().toLowerCase();
    const workMode = (params.workMode || '').trim().toLowerCase();
    const status = (params.status || '').trim().toLowerCase();
    const search = (params.search || '').trim().toLowerCase();

    let allOpportunities = [...SEED_OPPORTUNITIES];
    if (repo) {
      const [dbJobs, dbInternships, dbWorkshops, dbCourses, approvedSubmissions] = await Promise.all([
        repo.getJobs({ onlyActive: true, onlyApproved: true }),
        repo.getInternships({ onlyActive: true, onlyApproved: true }),
        repo.getWorkshops({ onlyApproved: true }),
        repo.getCourses({ onlyApproved: true, onlyAvailable: false }),
        repo.getSubmittedOpportunities({ onlyApproved: true }),
      ]);

      const todayStr = new Date().toISOString().split('T')[0];
      const mappedJobs = dbJobs
        .filter((j) => {
          if (!j.isApproved || !j.isActive) return false;
          if (j.verificationStatus === 'Expired' || j.verificationStatus === 'Rejected') return false;
          if (j.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(j.expiryDate) && j.expiryDate < todayStr) return false;
          return true;
        })
        .map((j) => ({
          id: j.id,
          title: j.title,
          organization: j.employer,
          type: 'biotech_job' as any,
          subCategory: j.sector || 'Biotechnology Jobs',
          description: j.description,
          location: j.location,
          workMode: (j.location?.toLowerCase().includes('remote')
            ? 'Remote'
            : j.location?.toLowerCase().includes('hybrid')
            ? 'Hybrid'
            : 'On-site') as any,
          experience: 'Mid-level (2-5 yrs)',
          qualification: j.qualification || 'M.Sc / B.Tech',
          branches: ['biotechnology'] as any[],
          skills: j.skills || [],
          salaryOrStipend: j.salary || 'Not Disclosed',
          salaryTier: 'paid' as any,
          deadline: j.expiryDate || undefined,
          postedDate: j.publicationDate,
          sourceName: j.source || 'BIO-INEXA Verified',
          sourceUrl: j.originalJobUrl || j.applicationUrl,
          sourcePortal: 'BIO-INEXA Database' as any,
          applicationUrl: j.applicationUrl,
          isVerified: j.verificationStatus === 'Verified',
          isApproved: j.isApproved,
          featured: j.featured,
          status: 'Active' as any,
          createdAt: j.createdAt,
        }));

      const mappedWorkshops = dbWorkshops.map((w) => {
        const isClosed =
          Boolean(w.isExpired) ||
          (w.status || '').toLowerCase() === 'completed' ||
          (w.availability || '').toLowerCase() === 'closed';
        const hostName = w.organizer || w.instructor || '';
        return {
          id: w.id,
          title: w.name,
          organization: hostName,
          type: 'workshop' as any,
          subCategory: w.category || 'Biotechnology Workshops',
          description: w.description,
          location: w.venue,
          workMode: (w.format === 'Offline' ? 'On-site' : w.format) as any,
          experience: 'Open to All',
          qualification: 'Life Sciences Students & Researchers',
          branches: ['biotechnology'] as any[],
          skills: w.skillsCovered || [],
          salaryOrStipend: w.fees || '',
          salaryTier: 'not_disclosed' as any,
          deadline: w.registrationDeadline || w.date,
          postedDate: (w.createdAt || '').split('T')[0],
          sourceName: hostName || 'Official Workshop Portal',
          sourceUrl: w.registrationLink,
          sourcePortal: 'Official Workshop Portal' as any,
          applicationUrl: w.registrationLink,
          isVerified: Boolean(w.isApproved),
          isApproved: Boolean(w.isApproved),
          featured: w.featured,
          status: (isClosed ? 'Closed' : 'Active') as any,
          createdAt: w.createdAt,
        };
      });

      const mappedCourses = dbCourses.map((c) => ({
        id: c.id,
        title: c.name,
        organization: c.provider || '',
        type: 'course' as any,
        subCategory: c.category || 'Biotechnology',
        description: c.description,
        location: c.deliveryMode || 'Online (Self-Paced)',
        workMode: ((c.deliveryMode || '').toLowerCase().includes('hybrid') ? 'Hybrid' : 'Remote') as any,
        experience: c.level || '',
        qualification: c.eligibility || '',
        branches: ['biotechnology'] as any[],
        skills: c.curriculum || [],
        salaryOrStipend: c.fees || '',
        salaryTier: (c.pricingType === 'free' ? 'free' : 'paid') as any,
        deadline: c.registrationDeadline || '',
        postedDate: (c.createdAt || '').split('T')[0],
        sourceName: c.providerType === 'bionexa' ? (c.provider || 'BIO-INEXA') : (c.provider || 'Third-Party Course Provider'),
        sourceUrl: c.registrationLink,
        sourcePortal: (c.providerType === 'bionexa' ? 'BIO-INEXA Course Portal' : 'Official Course Portal') as any,
        applicationUrl: c.registrationLink,
        isVerified: c.isApproved,
        isApproved: c.isApproved,
        featured: c.featured,
        status: (c.isExpired ? 'Expired' : c.status === 'closed' ? 'Closed' : 'Active') as any,
        createdAt: c.createdAt,
        courseDetails: {
          provider: c.provider,
          providerType: c.providerType,
          pricingType: c.pricingType,
          duration: c.duration,
          deliveryMode: c.deliveryMode,
          fees: c.fees,
          eligibility: c.eligibility,
          registrationDeadline: c.registrationDeadline,
          certificateAvailable: Boolean(c.certificateInfo),
          certificateInfo: c.certificateInfo,
          syllabus: c.curriculum,
        },
      }));

      const mappedSubmissions = approvedSubmissions.map((sub) => ({
        id: sub.id,
        title: sub.title,
        organization: sub.organization,
        type: (sub.type || 'job') as any,
        subCategory: sub.subCategory,
        description: sub.description,
        location: sub.location,
        workMode: (sub.workMode?.toLowerCase() === 'remote'
          ? 'remote'
          : sub.workMode?.toLowerCase() === 'hybrid'
          ? 'hybrid'
          : 'onsite') as any,
        experience: sub.experience,
        qualification: sub.qualification,
        branches: sub.branches as any[],
        skills: sub.skills,
        salaryOrStipend: sub.salaryOrStipend,
        salaryTier: (sub.salaryTier || 'not_disclosed') as any,
        deadline: sub.deadline,
        postedDate: sub.postedDate,
        sourceName: sub.sourceName,
        sourceUrl: sub.sourceUrl,
        sourcePortal: 'Approved Direct Submission' as any,
        applicationUrl: sub.applicationUrl,
        isVerified: Boolean((sub as any).isVerified),
        isApproved: true,
        status: 'active' as any,
      }));
      const mappedInternships = dbInternships.map((intern) => ({
        id: intern.id,
        title: intern.title,
        organization: intern.organization,
        type: 'internship' as any,
        subCategory: intern.category || 'Biotech Internships',
        description: intern.description,
        location: intern.location,
        workMode: (intern.workMode?.toLowerCase().includes('remote')
          ? 'remote'
          : intern.workMode?.toLowerCase().includes('hybrid')
          ? 'hybrid'
          : 'onsite') as any,
        experience: 'Students / Freshers',
        qualification: intern.eligibility,
        branches: ['Biotechnology'] as any[],
        skills: intern.skillsRequired,
        salaryOrStipend: intern.stipend,
        salaryTier: 'paid' as any,
        deadline: intern.deadline,
        postedDate: (intern.createdAt || '').split('T')[0],
        sourceName: intern.sourceName,
        sourceUrl: intern.sourceUrl,
        sourcePortal: 'Verified Host Portal' as any,
        applicationUrl: intern.applicationUrl,
        isVerified: intern.verificationStatus === 'Verified',
        isApproved: intern.isApproved,
        status: 'active' as any,
      }));
      const existingIds = new Set([
        ...mappedJobs.map((m) => m.id),
        ...mappedInternships.map((m) => m.id),
        ...mappedWorkshops.map((m) => m.id),
        ...mappedCourses.map((m) => m.id),
        ...mappedSubmissions.map((m) => m.id),
      ]);
      allOpportunities = [
        ...mappedJobs,
        ...mappedInternships,
        ...mappedWorkshops,
        ...mappedCourses,
        ...mappedSubmissions,
        ...SEED_OPPORTUNITIES.filter(
          (s) => s.isApproved && s.type !== 'workshop' && s.type !== 'internship' && !existingIds.has(s.id)
        ),
      ];
    }

    const filtered = allOpportunities
      .filter((opp) => {
        if (!opp.isApproved) return false;
        if (branch && branch !== 'all') {
          const hasBranch = opp.branches.some((b) => b.toLowerCase() === branch);
          if (!hasBranch) return false;
        }
        if (type && type !== 'all' && opp.type.toLowerCase() !== type) {
          return false;
        }
        if (workMode && workMode !== 'all' && opp.workMode.toLowerCase() !== workMode) {
          return false;
        }
        if (status && status !== 'all' && opp.status.toLowerCase() !== status) {
          return false;
        }
        if (search) {
          const hay = [
            opp.title,
            opp.organization,
            opp.description,
            opp.location,
            ...(opp.skills || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const tB = new Date(b.postedDate || b.createdAt || 0).getTime();
        const tA = new Date(a.postedDate || a.createdAt || 0).getTime();
        return tB - tA;
      });

    const { page, limit } = parsePaginationParams(params, { defaultLimit: 100, maxLimit: 100 });
    const { items: paginatedOpportunities, pagination } = paginateArray(filtered, page, limit);

    return jsonResponse(
      event,
      200,
      {
        success: true,
        status: 'success',
        count: filtered.length,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages,
        pagination,
        persistentDbConfigured: Boolean(repo),
        query: {
          branch: params.branch,
          type: params.type,
          workMode: params.workMode,
          status: params.status,
          search: params.search,
        },
        opportunities: paginatedOpportunities,
      },
      ALLOWED_METHODS
    );
  }

  if (method === 'POST') {
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, {
        code: 'INVALID_JSON',
        allowedMethods: ALLOWED_METHODS,
      });
    }

    const payload = parsed.data;
    const title = sanitizeString(payload.title);
    const organization = sanitizeString(payload.organization);
    const applicationUrl = sanitizeString(payload.applicationUrl);

    if (!title || !organization || !applicationUrl) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Missing required fields: title, organization, applicationUrl',
        { code: 'MISSING_REQUIRED_FIELDS', allowedMethods: ALLOWED_METHODS }
      );
    }

    if (!isValidHttpUrl(applicationUrl)) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'applicationUrl must be a valid URL starting with http:// or https://',
        { code: 'INVALID_URL', allowedMethods: ALLOWED_METHODS }
      );
    }

    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Opportunity submission queue persistence is not yet connected in serverless production. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before accepting live submissions.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ALLOWED_METHODS
      );
    }

    const created = await repo.createSubmittedOpportunity({
      title,
      organization,
      type: sanitizeString(payload.type) || 'job',
      subCategory: sanitizeString(payload.subCategory),
      description: sanitizeString(payload.description) || `${title} at ${organization}`,
      location: sanitizeString(payload.location) || 'India',
      workMode: sanitizeString(payload.workMode) || 'On-site',
      experience: sanitizeString(payload.experience) || 'Not Specified',
      qualification: sanitizeString(payload.qualification),
      branches: Array.isArray(payload.branches) && payload.branches.length > 0 ? payload.branches : ['Biotechnology'],
      skills: Array.isArray(payload.skills) ? payload.skills : [],
      salaryOrStipend: sanitizeString(payload.salaryOrStipend) || 'Not Disclosed',
      salaryTier: sanitizeString(payload.salaryTier) || 'not_disclosed',
      deadline: sanitizeString(payload.deadline),
      sourceName: sanitizeString(payload.sourceName) || 'Direct Employer / Organizer Submission',
      sourceUrl: sanitizeString(payload.sourceUrl) || applicationUrl,
      applicationUrl,
      contactEmail: sanitizeString(payload.contactEmail),
      workshopDetails: payload.workshopDetails || null,
    });

    return jsonResponse(
      event,
      201,
      {
        success: true,
        id: created.id,
        opportunity: created,
        message: 'Opportunity submitted for moderation review. It will appear publicly once approved by an administrator.',
      },
      ALLOWED_METHODS
    );
  }

  return methodNotAllowedResponse(event, ALLOWED_METHODS);
};
