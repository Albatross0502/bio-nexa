/**
 * Netlify Function: admin-data
 * Route:
 * - GET /api/admin/data
 */

import { computeAdminDashboardStats } from '../../src/services/admin/adminHelpers';
import {
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import {
  formatServerlessInternshipForAdmin,
  formatServerlessJobForAdmin,
  SERVERLESS_ANNOUNCEMENTS,
  SERVERLESS_COURSES,
  SERVERLESS_HOMEPAGE_HIGHLIGHTS,
  SERVERLESS_INTERNSHIPS,
  SERVERLESS_JOBS,
  SERVERLESS_WORKSHOPS,
} from './_shared/serverlessCatalog';
import { formatAdminInternship, formatAdminJob, getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission: 'dashboard:read',
  });
  if (auth.authorized === false) return auth.response;

  const repo = getSupabaseRepository();
  if (repo) {
    const [
      jobsRaw,
      internshipsRaw,
      workshops,
      courses,
      announcements,
      homepageHighlights,
      submittedOpportunities,
      complianceRequests,
      contactMessages,
      syncHistory,
    ] = await Promise.all([
      repo.getAllJobsAdmin(),
      repo.getAllInternshipsAdmin(),
      repo.getWorkshops(),
      repo.getCourses(),
      repo.getAnnouncements(false),
      repo.getHomepageHighlights(),
      repo.getSubmittedOpportunities({ onlyApproved: false }),
      repo.getComplianceRequests(),
      repo.getContactMessages(),
      repo.getSyncLogs(50),
    ]);

    const jobs = jobsRaw.map(formatAdminJob);
    const internships = internshipsRaw.map(formatAdminInternship);
    const stats = computeAdminDashboardStats({
      jobs: jobsRaw,
      internships: internshipsRaw,
      workshops,
      courses,
      submissions: submittedOpportunities,
      complianceRequests,
      contactMessagesCount: contactMessages.length,
      syncRunsCount: syncHistory.length,
      backupsCount: 0,
      auditLogsCount: 0,
      announcementsCount: announcements.length,
    });

    return jsonResponse(
      event,
      200,
      {
        success: true,
        stats,
        jobs,
        internships,
        workshops,
        courses,
        submittedOpportunities,
        complianceRequests,
        contactMessages,
        syncHistory,
        persistentDbConfigured: true,
        databaseEngine: 'Supabase PostgreSQL',
        content: {
          announcements,
          featuredOpportunityIds: jobs.filter((j) => j.featured).map((j) => j.id),
          homepageHighlights,
        },
      },
      ALLOWED_METHODS
    );
  }

  const content = {
    announcements: SERVERLESS_ANNOUNCEMENTS.map((a) => ({
      id: a.id,
      title: a.title,
      tag: a.tag,
      date: a.date,
      link: a.link,
      active: a.isActive,
    })),
    featuredOpportunityIds: SERVERLESS_JOBS.filter((j) => j.featured).map((j) => j.id),
    homepageHighlights: SERVERLESS_HOMEPAGE_HIGHLIGHTS,
  };

  const jobs = SERVERLESS_JOBS.map(formatServerlessJobForAdmin);
  const internships = SERVERLESS_INTERNSHIPS.map(formatServerlessInternshipForAdmin);
  const stats = computeAdminDashboardStats({
    jobs: SERVERLESS_JOBS,
    internships: SERVERLESS_INTERNSHIPS,
    workshops: SERVERLESS_WORKSHOPS,
    courses: SERVERLESS_COURSES,
    submissions: [],
    complianceRequests: [],
    contactMessagesCount: 0,
    syncRunsCount: 0,
    backupsCount: 0,
    auditLogsCount: 0,
    announcementsCount: content.announcements.length,
  });

  return jsonResponse(
    event,
    200,
    {
      success: true,
      stats,
      jobs,
      internships,
      workshops: SERVERLESS_WORKSHOPS,
      courses: SERVERLESS_COURSES,
      submittedOpportunities: [],
      complianceRequests: [],
      contactMessages: [],
      syncHistory: [],
      persistentDbConfigured: false,
      databaseEngine: 'Serverless Catalog (Read-Only)',
      content,
    },
    ALLOWED_METHODS
  );
};
