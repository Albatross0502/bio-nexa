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

const ALLOWED_METHODS = ['GET', 'POST'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();

  if (method === 'GET') {
    const params = event.queryStringParameters || {};
    const branch = (params.branch || '').trim().toLowerCase();
    const type = (params.type || '').trim().toLowerCase();
    const workMode = (params.workMode || '').trim().toLowerCase();
    const status = (params.status || '').trim().toLowerCase();
    const search = (params.search || '').trim().toLowerCase();

    const filtered = SEED_OPPORTUNITIES.filter((opp) => {
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
    });

    return jsonResponse(
      event,
      200,
      {
        success: true,
        status: 'success',
        count: filtered.length,
        query: {
          branch: params.branch,
          type: params.type,
          workMode: params.workMode,
          status: params.status,
          search: params.search,
        },
        opportunities: filtered,
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

    return serviceUnavailableResponse(
      event,
      'Opportunity submission queue persistence is not yet connected in serverless production. Persistent cloud database integration is required before accepting live submissions.',
      'PERSISTENT_DB_NOT_CONFIGURED',
      ALLOWED_METHODS
    );
  }

  return methodNotAllowedResponse(event, ALLOWED_METHODS);
};
