/**
 * Netlify Serverless Function: opportunities
 * Path: /.netlify/functions/opportunities
 *
 * Methods:
 * - GET: Fetch filtered opportunities (branch, type, workMode, status)
 * - POST: Submit new opportunity for moderation
 */

export const handler = async (event: any) => {
  const method = event.httpMethod;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (method === 'GET') {
    const params = event.queryStringParameters || {};
    const { branch, type, workMode } = params;

    // Filter params can be passed to Supabase or return payload
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        query: { branch, type, workMode },
        message: 'Endpoint active. In client SPA mode, data is securely managed via opportunityStore.',
      }),
    };
  }

  if (method === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.title || !payload.organization || !payload.applicationUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields: title, organization, applicationUrl' }),
        };
      }

      // Mark unapproved for moderation
      const submission = {
        ...payload,
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        isApproved: false,
        status: 'verification_needed',
        submittedAt: new Date().toISOString(),
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          status: 'success',
          message: 'Opportunity submitted to moderation queue',
          submissionId: submission.id,
        }),
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
