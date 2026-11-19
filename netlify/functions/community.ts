/**
 * Netlify Function: community
 * Routes:
 * - POST  /api/contact
 * - POST  /api/newsletter
 * - GET   /api/certificates/verify
 * - POST  /api/certificates
 * - GET   /api/applications
 * - POST  /api/applications
 * - PATCH /api/applications/:id/status
 * - GET   /api/discussions
 * - POST  /api/discussions
 * - POST  /api/discussions/:id/replies
 * - POST  /api/discussions/:id/upvote
 */

import {
  errorResponse,
  extractSubPath,
  handleCorsPreflight,
  jsonResponse,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
  parseJsonBody,
  sanitizeString,
  serviceUnavailableResponse,
} from './_shared/http';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH'];
const BASE_PREFIXES = ['/.netlify/functions/community', '/api'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const subPath = extractSubPath(event, BASE_PREFIXES);
  const repo = getSupabaseRepository();

  // --- /api/contact ---
  if (subPath === 'contact') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const name = sanitizeString(parsed.data.name);
    const email = sanitizeString(parsed.data.email).toLowerCase();
    const subject = sanitizeString(parsed.data.subject) || 'General Platform Inquiry';
    const message = sanitizeString(parsed.data.message);
    if (!name || name.length < 2 || !EMAIL_RE.test(email) || !message || message.length < 10) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Valid name, email address, and message (at least 10 characters) are required.',
        { code: 'VALIDATION_ERROR', allowedMethods: ['POST'] }
      );
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Contact inquiry storage requires Supabase PostgreSQL credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const created = await repo.createContactMessage({ name, email, subject, message });
    return jsonResponse(
      event,
      201,
      {
        success: true,
        referenceId: created.referenceId,
        contactMessage: created,
        message: `Your inquiry (${created.referenceId}) has been saved securely.`,
      },
      ['POST']
    );
  }

  // --- /api/newsletter ---
  if (subPath === 'newsletter') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const email = sanitizeString(parsed.data.email).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return errorResponse(event, 400, 'Validation Error', 'Please provide a valid email address.', {
        code: 'VALIDATION_ERROR',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Newsletter subscription persistence requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const result = await repo.subscribeNewsletter(email);
    return jsonResponse(
      event,
      result.alreadySubscribed ? 200 : 201,
      {
        success: true,
        alreadySubscribed: result.alreadySubscribed,
        subscriber: result.subscriber,
        message: result.alreadySubscribed
          ? 'This email address is already subscribed to BIO-INEXA bulletins.'
          : 'Subscribed cleanly to verified BIO-INEXA research and career digests.',
      },
      ['POST']
    );
  }

  // --- /api/certificates/verify & /api/certificates ---
  if (subPath === 'certificates/verify') {
    if (method !== 'GET') return methodNotAllowedResponse(event, ['GET']);
    const certNumber = sanitizeString(event.queryStringParameters?.id || event.queryStringParameters?.certificateNumber);
    if (!certNumber) {
      return errorResponse(event, 400, 'Validation Error', 'Certificate number parameter `id` is required.', {
        code: 'MISSING_CERTIFICATE_ID',
        allowedMethods: ['GET'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Certificate registry verification requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['GET']
      );
    }
    const certificate = await repo.verifyCertificate(certNumber);
    if (!certificate) {
      return errorResponse(event, 404, 'Not Found', 'Certificate number not found in verified registry.', {
        code: 'CERTIFICATE_NOT_FOUND',
        allowedMethods: ['GET'],
      });
    }
    return jsonResponse(event, 200, { success: true, found: true, certificate }, ['GET']);
  }

  if (subPath === 'certificates') {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const recipientName = sanitizeString(parsed.data.recipientName);
    const courseTitle = sanitizeString(parsed.data.courseTitle);
    const score = Number(parsed.data.score);
    if (!recipientName || !courseTitle || Number.isNaN(score) || score < 0 || score > 100) {
      return errorResponse(
        event,
        400,
        'Validation Error',
        'Valid recipientName, courseTitle, and numeric score (0–100) are required.',
        { code: 'VALIDATION_ERROR', allowedMethods: ['POST'] }
      );
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Certificate issuance persistence requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const certificate = await repo.createCertificate({
      recipientName,
      courseTitle,
      score,
      certificateNumber: sanitizeString(parsed.data.certificateNumber) || undefined,
      issueDate: sanitizeString(parsed.data.issueDate) || undefined,
      verificationCode: sanitizeString(parsed.data.verificationCode) || undefined,
    });
    return jsonResponse(event, 201, { success: true, certificate }, ['POST']);
  }

  // --- /api/applications* ---
  if (subPath === 'applications') {
    if (method === 'GET') {
      if (!repo) {
        return jsonResponse(event, 200, { success: true, count: 0, applications: [], persistentDbConfigured: false }, ['GET', 'POST']);
      }
      const applications = await repo.getJobApplications();
      return jsonResponse(event, 200, { success: true, count: applications.length, applications }, ['GET', 'POST']);
    }
    if (method === 'POST') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
      }
      const b = parsed.data;
      const jobTitle = sanitizeString(b.jobTitle);
      const company = sanitizeString(b.company);
      const applicantName = sanitizeString(b.applicantName);
      const applicantEmail = sanitizeString(b.applicantEmail).toLowerCase();
      if (!jobTitle || !company || !applicantName || !EMAIL_RE.test(applicantEmail)) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Valid jobTitle, company, applicantName, and applicantEmail are required.',
          { code: 'VALIDATION_ERROR', allowedMethods: ['GET', 'POST'] }
        );
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Application persistence requires Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['GET', 'POST']
        );
      }
      const application = await repo.createJobApplication({
        jobId: sanitizeString(b.jobId),
        jobTitle,
        company,
        applicantName,
        applicantEmail,
        phone: sanitizeString(b.phone),
        qualification: sanitizeString(b.qualification),
        experienceYears: sanitizeString(b.experienceYears),
        coverNote: sanitizeString(b.coverNote),
      });
      return jsonResponse(event, 201, { success: true, application }, ['GET', 'POST']);
    }
    return methodNotAllowedResponse(event, ['GET', 'POST']);
  }

  if (subPath.startsWith('applications/') && subPath.endsWith('/status')) {
    if (method !== 'PATCH') return methodNotAllowedResponse(event, ['PATCH']);
    const id = decodeURIComponent(subPath.slice('applications/'.length, -'/status'.length));
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const status = sanitizeString(parsed.data.status);
    if (!['Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected'].includes(status)) {
      return errorResponse(event, 400, 'Validation Error', 'Invalid application status value.', {
        code: 'VALIDATION_ERROR',
        allowedMethods: ['PATCH'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Application status updates require Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['PATCH']
      );
    }
    const updated = await repo.updateJobApplicationStatus(id, status);
    if (!updated) {
      return errorResponse(event, 404, 'Not Found', 'Application not found.', {
        code: 'APPLICATION_NOT_FOUND',
        allowedMethods: ['PATCH'],
      });
    }
    return jsonResponse(event, 200, { success: true, application: updated }, ['PATCH']);
  }

  // --- /api/discussions* ---
  if (subPath === 'discussions') {
    if (method === 'GET') {
      if (!repo) {
        return jsonResponse(event, 200, { success: true, count: 0, discussions: [], persistentDbConfigured: false }, ['GET', 'POST']);
      }
      const category = event.queryStringParameters?.category;
      const discussions = await repo.getDiscussions(category);
      return jsonResponse(event, 200, { success: true, count: discussions.length, discussions }, ['GET', 'POST']);
    }
    if (method === 'POST') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
      }
      const b = parsed.data;
      const title = sanitizeString(b.title);
      const authorName = sanitizeString(b.authorName);
      const content = sanitizeString(b.content);
      const category = sanitizeString(b.category) || 'Career Advice';
      if (!title || title.length < 4 || !authorName || !content || content.length < 8) {
        return errorResponse(
          event,
          400,
          'Validation Error',
          'Discussion title, authorName, and content are required.',
          { code: 'VALIDATION_ERROR', allowedMethods: ['GET', 'POST'] }
        );
      }
      if (!repo) {
        return serviceUnavailableResponse(
          event,
          'Community discussion persistence requires Supabase PostgreSQL configuration.',
          'PERSISTENT_DB_NOT_CONFIGURED',
          ['GET', 'POST']
        );
      }
      const discussion = await repo.createDiscussion({
        title,
        authorName,
        authorRole: sanitizeString(b.authorRole) || 'BIO-INEXA Member',
        category,
        content,
      });
      return jsonResponse(event, 201, { success: true, discussion }, ['GET', 'POST']);
    }
    return methodNotAllowedResponse(event, ['GET', 'POST']);
  }

  if (subPath.startsWith('discussions/') && subPath.endsWith('/replies')) {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const topicId = decodeURIComponent(subPath.slice('discussions/'.length, -'/replies'.length));
    const parsed = parseJsonBody(event);
    if (!parsed.ok) {
      return errorResponse(event, 400, 'Validation Error', parsed.message, { code: 'INVALID_JSON' });
    }
    const authorName = sanitizeString(parsed.data.authorName);
    const content = sanitizeString(parsed.data.content);
    if (!authorName || !content) {
      return errorResponse(event, 400, 'Validation Error', 'Reply authorName and content are required.', {
        code: 'VALIDATION_ERROR',
        allowedMethods: ['POST'],
      });
    }
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Community reply persistence requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const reply = await repo.addDiscussionReply(topicId, {
      authorName,
      authorRole: sanitizeString(parsed.data.authorRole) || 'BIO-INEXA Member',
      content,
    });
    if (!reply) {
      return errorResponse(event, 404, 'Not Found', 'Discussion topic not found.', {
        code: 'TOPIC_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    return jsonResponse(event, 201, { success: true, reply }, ['POST']);
  }

  if (subPath.startsWith('discussions/') && subPath.endsWith('/upvote')) {
    if (method !== 'POST') return methodNotAllowedResponse(event, ['POST']);
    const topicId = decodeURIComponent(subPath.slice('discussions/'.length, -'/upvote'.length));
    if (!repo) {
      return serviceUnavailableResponse(
        event,
        'Community upvote persistence requires Supabase PostgreSQL configuration.',
        'PERSISTENT_DB_NOT_CONFIGURED',
        ['POST']
      );
    }
    const discussion = await repo.upvoteDiscussion(topicId);
    if (!discussion) {
      return errorResponse(event, 404, 'Not Found', 'Discussion topic not found.', {
        code: 'TOPIC_NOT_FOUND',
        allowedMethods: ['POST'],
      });
    }
    return jsonResponse(event, 200, { success: true, discussion }, ['POST']);
  }

  return errorResponse(event, 404, 'Not Found', 'Community endpoint not found.', {
    code: 'API_ROUTE_NOT_FOUND',
    allowedMethods: ALLOWED_METHODS,
  });
};
