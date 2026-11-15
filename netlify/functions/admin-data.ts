/**
 * Netlify Function: admin-data
 * Route:
 * - GET /api/admin/data
 */

import {
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import { requireServerlessAdminAuth } from './_shared/serverlessAuth';
import {
  formatServerlessJobForAdmin,
  SERVERLESS_ANNOUNCEMENTS,
  SERVERLESS_COURSES,
  SERVERLESS_HOMEPAGE_HIGHLIGHTS,
  SERVERLESS_JOBS,
  SERVERLESS_WORKSHOPS,
} from './_shared/serverlessCatalog';

const ALLOWED_METHODS = ['GET'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = requireServerlessAdminAuth(event, ALLOWED_METHODS);
  if (auth.authorized === false) return auth.response;

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

  return jsonResponse(
    event,
    200,
    {
      jobs: SERVERLESS_JOBS.map(formatServerlessJobForAdmin),
      workshops: SERVERLESS_WORKSHOPS,
      courses: SERVERLESS_COURSES,
      content,
    },
    ALLOWED_METHODS
  );
};
