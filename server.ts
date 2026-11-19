/**
 * BIO-NEXA Full-Stack Enterprise Express Server
 * Handles secure database APIs, admin authentication, session management,
 * input validation, and Vite development middleware.
 */

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  verifyPassword,
  validateAdminPasswordStrength,
  verifyTotpCode,
  createPasswordResetToken,
  hashResetToken,
  normalizeAdminRole,
  getPermissionsForRole,
  hasAdminPermission,
  LoginRateLimiter,
  AdminSessionManager,
  AdminPermission,
  AdminUser
} from './src/services/admin/adminAuthService.js';
import {
  SEED_JOBS,
  SEED_INTERNSHIPS,
  SEED_COURSES,
  SEED_DISCUSSIONS,
  SEED_CERTIFICATE
} from './src/data/seedData.js';
import { SEED_OPPORTUNITIES } from './src/services/opportunities/seedOpportunities.js';
import { bionexaDb, DbJob, DbInternship, DbWorkshop, DbCourse } from './src/db/bionexaDatabase.js';
import { automatedJobManager, SyncInProgressError } from './src/services/jobs/automatedJobManager.js';
import {
  isValidExportDataset,
  hasExportDatasetPermission,
  formatRecordsAsCsv,
  ADMIN_EXPORT_DATASETS,
  AdminExportDataset,
} from './src/services/admin/adminHelpers.js';
import {
  normalizeCourseCategory,
  normalizeCourseStatus,
  normalizeDeliveryMode,
  parseCurriculumInput
} from './src/services/courses/courseHelpers.js';
import {
  normalizeComplianceRequestType,
  validateComplianceRequest
} from './src/services/legal/legalCompliance.js';
import {
  parsePaginationParams,
  paginateArray,
  isValidEmailAddress,
  isValidHttpUrlStrict
} from './src/utils/apiPagination.js';
import { matchBranchesForOpportunity } from './src/config/branches.js';
import {
  VALID_JOB_VERIFICATION_STATUSES,
  normalizeJobVerificationStatus,
  validateApplicationUrl,
  isJobExpiredByDeadline,
} from './src/services/jobs/jobVerification.js';

import {
  getRuntimeEnvironmentConfig,
  resolveCorsOrigin,
} from './src/config/environment.js';

import crypto from 'node:crypto';

const PORT = 3000;
const app = express();
const runtimeEnv = getRuntimeEnvironmentConfig();

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Environment-aware CORS, preflight handling, and safe request logging for /api/* routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const allowedOrigin = resolveCorsOrigin(origin, runtimeEnv);

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');

  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    // Never log Authorization headers, cookies, credentials, or PII query payloads
    console.info(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${elapsedMs}ms)`);
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Serve uploaded workshop and course images safely
const workshopUploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'workshops');
const courseUploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'courses');
if (!fs.existsSync(workshopUploadsDir)) {
  fs.mkdirSync(workshopUploadsDir, { recursive: true });
}
if (!fs.existsSync(courseUploadsDir)) {
  fs.mkdirSync(courseUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

// Initialize Rate Limiter & Session Manager
const rateLimiter = new LoginRateLimiter();
const sessionManager = new AdminSessionManager();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getEnvAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || '').trim();
}

function syncEnvAdminUserOnBoot(): void {
  const envUsername = getEnvAdminUsername();
  const envPasswordHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const envRole = normalizeAdminRole(process.env.ADMIN_ROLE || 'super_admin');
  const envTotpSecret = (process.env.ADMIN_TOTP_SECRET || '').trim();

  if (!envUsername || (!envPasswordHash && !envPassword)) {
    return;
  }

  const existing = bionexaDb.getAdminUserByUsername(envUsername);
  // Respect passwords rotated via DB if no explicit env password hash override was updated
  const hashToPersist = existing?.passwordUpdatedAt
    ? undefined
    : (envPasswordHash || hashPassword(envPassword));

  bionexaDb.upsertAdminUser({
    id: existing?.id || 'admin-master-001',
    username: envUsername,
    email: envUsername.includes('@') ? envUsername : `${envUsername}@bionexa.org`,
    displayName: existing?.displayName || 'BIO-INEXA Operations Admin',
    role: envRole,
    passwordHash: hashToPersist,
    totpSecret: envTotpSecret || undefined,
    totpEnabled: Boolean(envTotpSecret),
  });
}

function isAdminAuthConfigured(): boolean {
  const envUsername = getEnvAdminUsername();
  const envPassOk = Boolean((process.env.ADMIN_PASSWORD_HASH || '').trim() || (process.env.ADMIN_PASSWORD || '').trim());
  if (runtimeEnv.isProduction) {
    const secret = (process.env.ADMIN_SESSION_SECRET || '').trim();
    if (!secret || secret.length < 16 || (process.env.ADMIN_PASSWORD && secret === process.env.ADMIN_PASSWORD)) {
      return false;
    }
  }
  if (envUsername && envPassOk) {
    return true;
  }
  const dbAdmins = bionexaDb.listAdminUsers();
  return dbAdmins.some((u) => {
    const full = bionexaDb.getAdminUserByUsername(u.username);
    return Boolean(full?.isActive && full?.passwordHash);
  });
}

// Seed relational database with verified biotechnology data if empty
try {
  bionexaDb.seedInitialDataIfEmpty(
    SEED_JOBS,
    SEED_OPPORTUNITIES.filter((o) => o.type === 'workshop'),
    SEED_COURSES,
    SEED_DISCUSSIONS,
    SEED_CERTIFICATE,
    SEED_INTERNSHIPS
  );
  syncEnvAdminUserOnBoot();
  console.log('[BIO-INEXA DB] Database initialized and verified.');
} catch (err) {
  console.error('[BIO-INEXA DB] Seeding error:', err);
}

// -------------------------------------------------------------
// Input Validation Helpers
// -------------------------------------------------------------

function isValidHttpUrl(value: string): boolean {
  return isValidHttpUrlStrict(value);
}

function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function sendApiError(
  res: Response,
  status: number,
  error: string,
  code: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  res.status(status).json({
    success: false,
    error,
    code,
    message,
    ...(extra || {})
  });
}

// -------------------------------------------------------------
// Authentication & Authorization Helper Middleware
// -------------------------------------------------------------

function extractSessionToken(req: Request): string | null {
  if (req.cookies && req.cookies.bionexa_admin_session) {
    return req.cookies.bionexa_admin_session;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function isAdminCsrfOriginValid(req: Request): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  if (!req.cookies || !req.cookies.bionexa_admin_session) {
    return true;
  }
  const rawOrigin =
    (typeof req.headers.origin === 'string' && req.headers.origin) ||
    (typeof req.headers.referer === 'string' && req.headers.referer) ||
    '';
  if (!rawOrigin) {
    return true;
  }
  try {
    const parsedOrigin = new URL(rawOrigin).origin;
    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : '';
    if (hostHeader && parsedOrigin.endsWith(`://${hostHeader}`)) {
      return true;
    }
    return resolveCorsOrigin(parsedOrigin, runtimeEnv) === parsedOrigin;
  } catch {
    return false;
  }
}

function resolveAuthenticatedAdminSession(token: string): {
  user: AdminUser;
  jti: string;
  expiresAt: number;
} | null {
  // Always validate durable SQLite session record so revocations/expiries hold across restarts
  const dbRecord = bionexaDb.validateAdminSessionRecord(token);
  const memSession = sessionManager.validateSession(token);

  if (!dbRecord) {
    if (memSession) {
      sessionManager.destroySession(token);
    }
    return null;
  }

  if (memSession) {
    return {
      user: memSession.user,
      jti: dbRecord.jti,
      expiresAt: dbRecord.expiresAt,
    };
  }

  const dbUser = bionexaDb.getAdminUserByUsername(dbRecord.actorUsername);
  const role = normalizeAdminRole(dbUser?.role || dbRecord.role);
  return {
    user: {
      id: dbRecord.adminUserId,
      username: dbRecord.actorUsername,
      email: dbUser?.email || `${dbRecord.actorUsername}@bionexa.org`,
      name: dbUser?.displayName || 'BIO-INEXA Operations Admin',
      role,
      permissions: getPermissionsForRole(role),
    },
    jti: dbRecord.jti,
    expiresAt: dbRecord.expiresAt,
  };
}

function auditAdminAction(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
): void {
  const adminUser = (req as any).adminUser as AdminUser | undefined;
  try {
    bionexaDb.recordAdminAuditLog({
      adminUserId: adminUser?.id || '',
      actorUsername: adminUser?.username || 'system',
      action,
      entityType,
      entityId: entityId || '',
      ipAddress: getClientIp(req),
      details,
    });
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err);
  }
}

function requireAdminPermission(permission?: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isAdminCsrfOriginValid(req)) {
      sendApiError(
        res,
        403,
        'Forbidden',
        'CSRF_ORIGIN_DENIED',
        'Cross-origin state-changing request rejected by CSRF protection.'
      );
      return;
    }

    const token = extractSessionToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Authentication Required',
        code: 'AUTH_REQUIRED',
        message: 'Admin credentials required to perform this action.'
      });
      return;
    }

    const session = resolveAuthenticatedAdminSession(token);
    if (!session) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'INVALID_SESSION',
        message: 'Invalid, revoked, or expired administrative session.'
      });
      return;
    }

    if (permission && !hasAdminPermission(session.user, permission)) {
      sendApiError(
        res,
        403,
        'Forbidden',
        'INSUFFICIENT_PERMISSIONS',
        `Insufficient permissions: '${permission}' is required for this action.`
      );
      return;
    }

    (req as any).adminUser = session.user;
    (req as any).adminSessionJti = session.jti;
    (req as any).adminSessionExpiresAt = session.expiresAt;
    (req as any).adminSessionToken = token;
    next();
  };
}

const requireAdminAuth = requireAdminPermission();

// -------------------------------------------------------------
// PUBLIC REST API ENDPOINTS
// -------------------------------------------------------------

// GET /api/health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ok: true,
    service: 'bio-inexa-api',
    runtime: runtimeEnv.runtimeMode,
    environment: runtimeEnv.nodeEnv,
    persistentDbConfigured: true,
    supabaseConfigured: runtimeEnv.supabaseConfigured,
    databaseEngine: runtimeEnv.supabaseConfigured ? 'sqlite+supabase' : 'sqlite-local',
    adzunaConfigured: runtimeEnv.adzunaConfigured,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/jobs (supports search, sector, location, verificationStatus, page, limit)
app.get('/api/jobs', (req: Request, res: Response) => {
  try {
    const { search, sector, location, verificationStatus } = req.query;
    const allMatchingJobs = bionexaDb.getJobs({
      search: search ? String(search) : undefined,
      sector: sector && sector !== 'all' ? String(sector) : undefined,
      location: location && location !== 'all' ? String(location) : undefined,
      verificationStatus: verificationStatus && verificationStatus !== 'all' ? String(verificationStatus) : undefined,
      onlyActive: true,
      onlyApproved: true
    });

    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, {
      defaultLimit: 100,
      maxLimit: 100
    });
    const paginated = paginateArray(allMatchingJobs, page, limit);

    res.json({
      success: true,
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      jobs: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'JOBS_FETCH_FAILED', err.message || 'Failed to retrieve jobs.');
  }
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = bionexaDb.getJobById(id);

    if (!job) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    const verificationRecords = bionexaDb.getVerificationRecords(id);
    res.json({ success: true, job, verifications: verificationRecords });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/jobs/submit (Public Submission for Moderation)
app.post('/api/jobs/submit', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const title = sanitizeString(body.title);
    const employer = sanitizeString(body.employer || body.company);
    const applicationUrl = sanitizeString(body.applicationUrl);
    const description = sanitizeString(body.description);
    const location = sanitizeString(body.location);

    if (!title || !employer || !applicationUrl || !description || !location) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Required fields missing: title, employer/company, applicationUrl, description, location.'
      });
      return;
    }

    const urlCheck = validateApplicationUrl(applicationUrl);
    if (!urlCheck.valid) {
      res.status(400).json({
        error: 'Validation Error',
        code: 'INVALID_APPLICATION_URL',
        message: urlCheck.reason || 'Invalid applicationUrl: Must be a valid URL starting with http:// or https://'
      });
      return;
    }

    const duplicate = bionexaDb.findDuplicateJob({ title, employer, applicationUrl });
    if (duplicate) {
      res.status(409).json({
        error: 'Duplicate Listing',
        code: 'DUPLICATE_JOB_LISTING',
        message: `A similar opening already exists (${duplicate.title} at ${duplicate.employer}).`,
        duplicateJobId: duplicate.id
      });
      return;
    }

    const newJob = bionexaDb.createJob({
      title,
      employer,
      description,
      location,
      qualification: sanitizeString(body.qualification || 'Life Sciences Degree'),
      skills: Array.isArray(body.skills) ? body.skills : [],
      employmentType: sanitizeString(body.employmentType || 'Full-time'),
      salary: sanitizeString(body.salary || 'Competitive / Disclosed on Interview'),
      applicationUrl,
      source: sanitizeString(body.source || 'Direct Employer Submission'),
      originalJobUrl: sanitizeString(body.originalJobUrl || body.applicationUrl),
      publicationDate: new Date().toISOString().split('T')[0],
      expiryDate: sanitizeString(body.expiryDate || body.deadline || ''),
      lastVerificationDate: '',
      verificationStatus: 'Pending Verification',
      verificationNotes: 'Submitted for administrator verification.',
      isActive: true,
      isApproved: false, // Requires Admin Verification before publishing as verified
      featured: false,
      responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      sector: sanitizeString(body.sector || 'Private Biopharma')
    });

    res.status(201).json({
      success: true,
      message: 'Job submitted successfully for administrative verification and moderation.',
      jobId: newJob.id
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/jobs/:id/report (Public Report This Job)
app.post('/api/jobs/:id/report', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const reason = sanitizeString(body.reason);
    const details = sanitizeString(body.details);
    const reportedBy = sanitizeString(body.reportedBy || body.reporterEmail || 'Candidate Visitor');

    if (!reason) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_REPORT_REASON', 'Please provide a reason for reporting this listing.');
      return;
    }

    const job = bionexaDb.getJobById(id);
    if (!job) {
      sendApiError(res, 404, 'Not Found', 'JOB_NOT_FOUND', 'Job listing not found.');
      return;
    }

    const reportId = `rep-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const reportRecord = {
      id: reportId,
      jobId: id,
      jobTitle: job.title,
      employer: job.employer,
      reason,
      details,
      reportedBy,
      date: new Date().toISOString()
    };

    const existingReports = bionexaDb.getContent('candidate_job_reports', []);
    bionexaDb.setContent('candidate_job_reports', [reportRecord, ...(Array.isArray(existingReports) ? existingReports : [])]);

    // Also mirror into structured compliance_requests table when requester email is valid
    const normalizedEmail = isValidEmailAddress(reportedBy) ? reportedBy : 'visitor-report@bio-inexa.org';
    bionexaDb.createComplianceRequest({
      requestType: 'job_report',
      subCategory: reason,
      requesterName: isValidEmailAddress(reportedBy) ? reportedBy.split('@')[0] : reportedBy,
      requesterEmail: normalizedEmail,
      organization: job.employer,
      targetTitleOrUrl: `${job.title} (${job.applicationUrl})`,
      details: details || `Candidate reported listing ${job.id} (${job.title}) for reason: ${reason}.`,
      consentAccepted: true
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reporting. BIO-INEXA moderators will review this listing and destination URL within 24 hours.',
      reportId,
      report: reportRecord
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'JOB_REPORT_FAILED', err.message || 'Failed to log job report.');
  }
});

// POST /api/compliance/request (DPDP Privacy Requests, Grievances, Job Reports & Content Takedowns)
app.post('/api/compliance/request', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const requestType = normalizeComplianceRequestType(body.requestType);
    const input = {
      requestType,
      subCategory: sanitizeString(body.subCategory),
      requesterName: sanitizeString(body.requesterName),
      requesterEmail: sanitizeString(body.requesterEmail),
      organization: sanitizeString(body.organization),
      targetTitleOrUrl: sanitizeString(body.targetTitleOrUrl),
      details: sanitizeString(body.details),
      consentAccepted: Boolean(body.consentAccepted)
    };

    const validation = validateComplianceRequest(input);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: validation.error || 'Invalid compliance request submission.'
      });
      return;
    }

    const record = bionexaDb.createComplianceRequest(input);
    res.status(201).json({
      success: true,
      referenceId: record.referenceId,
      request: record,
      message:
        requestType === 'privacy_request' || requestType === 'grievance'
          ? 'Your DPDP / Grievance submission has been logged with tracking reference ' + record.referenceId + '.'
          : 'Your listing report / content removal request has been logged with reference ' + record.referenceId + ' for priority moderation review.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/internships (public verified & active internships from DB)
app.get('/api/internships', (req: Request, res: Response) => {
  try {
    const { search, category, mode } = req.query;
    const rows = bionexaDb.getInternships({
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' && category !== 'all' ? category : undefined,
      mode: typeof mode === 'string' && mode !== 'all' ? mode : undefined,
      onlyActive: true,
      onlyApproved: true,
    });
    const formatted = rows.map(formatInternshipForPublic);
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, {
      defaultLimit: 100,
      maxLimit: 100,
    });
    const paginated = paginateArray(formatted, page, limit);
    res.json({
      success: true,
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      internships: paginated.items,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'INTERNSHIPS_FETCH_FAILED', err.message || 'Failed to load internships.');
  }
});

// GET /api/internships/:id
app.get('/api/internships/:id', (req: Request, res: Response) => {
  try {
    const row = bionexaDb.getInternshipById(req.params.id);
    if (!row || !row.isApproved || !row.isActive) {
      sendApiError(res, 404, 'Not Found', 'INTERNSHIP_NOT_FOUND', 'Internship listing not found.');
      return;
    }
    res.json({ success: true, internship: formatInternshipForPublic(row) });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'INTERNSHIP_FETCH_FAILED', err.message || 'Failed to load internship.');
  }
});

// GET /api/workshops (supports status, format, featured, search, page, limit)
app.get('/api/workshops', (req: Request, res: Response) => {
  try {
    const { status, format, featured, search } = req.query;
    const allWorkshops = bionexaDb.getWorkshops({
      status: typeof status === 'string' && status !== 'all' ? status : undefined,
      format: typeof format === 'string' && format !== 'all' ? format : undefined,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    const formatted = allWorkshops.map(formatWorkshopForAdmin);
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, {
      defaultLimit: 100,
      maxLimit: 100
    });
    const paginated = paginateArray(formatted, page, limit);

    res.json({
      success: true,
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      workshops: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'WORKSHOPS_FETCH_FAILED', err.message || 'Failed to retrieve workshops.');
  }
});

// GET /api/workshops/:id
app.get('/api/workshops/:id', (req: Request, res: Response) => {
  try {
    const workshop = bionexaDb.getWorkshopById(req.params.id);
    if (!workshop) {
      sendApiError(res, 404, 'Not Found', 'WORKSHOP_NOT_FOUND', 'Workshop not found.');
      return;
    }
    res.json({ success: true, workshop: formatWorkshopForAdmin(workshop) });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'WORKSHOP_FETCH_FAILED', err.message || 'Failed to retrieve workshop.');
  }
});

// GET /api/courses (supports category, status, featured, search, onlyAvailable, page, limit)
app.get('/api/courses', (req: Request, res: Response) => {
  try {
    const { category, status, featured, search, onlyAvailable } = req.query;
    const allCourses = bionexaDb.getCourses({
      onlyAvailable: onlyAvailable === 'true',
      category: typeof category === 'string' && category !== 'all' ? category : undefined,
      status: typeof status === 'string' && status !== 'all' ? status : undefined,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      search: typeof search === 'string' ? search : undefined
    });
    const formatted = allCourses.map(formatCourseForAdmin);
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, {
      defaultLimit: 100,
      maxLimit: 100
    });
    const paginated = paginateArray(formatted, page, limit);

    res.json({
      success: true,
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      courses: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'COURSES_FETCH_FAILED', err.message || 'Failed to retrieve courses.');
  }
});

// GET /api/courses/:id
app.get('/api/courses/:id', (req: Request, res: Response) => {
  try {
    const course = bionexaDb.getCourseById(req.params.id);
    if (!course) {
      sendApiError(res, 404, 'Not Found', 'COURSE_NOT_FOUND', 'Course not found.');
      return;
    }
    res.json({ success: true, course: formatCourseForAdmin(course) });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'COURSE_FETCH_FAILED', err.message || 'Failed to retrieve course.');
  }
});

// GET /api/opportunities (Unified verified feed across Jobs, Workshops, Courses, Internships & Approved Submissions)
app.get('/api/opportunities', (req: Request, res: Response) => {
  try {
    const branch = sanitizeString(req.query.branch).toLowerCase();
    const typeFilter = sanitizeString(req.query.type).toLowerCase();
    const workModeFilter = sanitizeString(req.query.workMode).toLowerCase();
    const statusFilter = sanitizeString(req.query.status).toLowerCase();
    const search = sanitizeString(req.query.search).toLowerCase();
    const verifiedOnly = req.query.verifiedOnly === 'true';

    // 1. Approved DB Jobs
    const dbJobs = bionexaDb.getJobs({ onlyActive: true, onlyApproved: true }).map((j) => {
      const locLower = (j.location || '').toLowerCase();
      const workMode = locLower.includes('remote') ? 'Remote' : locLower.includes('hybrid') ? 'Hybrid' : 'On-site';
      const branches = matchBranchesForOpportunity({
        title: j.title,
        description: j.description,
        qualifications: [j.qualification],
        skills: j.skills
      });
      return {
        id: j.id,
        title: j.title,
        organization: j.employer,
        type: 'biotech_job',
        subCategory: j.sector || 'Biotechnology Jobs',
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: [j.qualification || 'M.Sc / B.Tech'],
        qualification: j.qualification || 'M.Sc / B.Tech',
        skills: j.skills || [],
        experience: 'Mid-level (2-5 yrs)',
        salaryOrStipend: j.salary || 'Not Disclosed',
        salaryTier: 'paid',
        location: j.location,
        workMode,
        deadline: j.expiryDate || undefined,
        postedDate: j.publicationDate,
        sourceName: j.source || 'BIO-INEXA Verified',
        sourceUrl: j.originalJobUrl || j.applicationUrl,
        sourceId: 'bionexa-db-jobs',
        lastVerifiedDate: j.lastVerificationDate || '',
        status: j.isActive ? 'Active' : 'Expired',
        isApproved: j.isApproved,
        isVerified: j.verificationStatus === 'Verified',
        dataCollectionTimestamp: j.updatedAt,
        attributionRequirements: `Official portal: ${j.source}`,
        description: j.description,
        responsibilities: j.responsibilities,
        requirements: j.requirements,
        applicationUrl: j.applicationUrl,
        featured: j.featured,
        createdAt: j.createdAt
      };
    });

    // 2. DB Workshops
    const dbWorkshops = bionexaDb.getWorkshops().map((w) => {
      const isClosed = (w.status || '').toLowerCase() === 'completed' || (w.availability || '').toLowerCase() === 'closed';
      const branches = matchBranchesForOpportunity({
        title: w.name,
        description: w.description,
        skills: w.skillsCovered
      });
      return {
        id: w.id,
        title: w.name,
        organization: w.instructor || 'BIO-INEXA Training Partner',
        type: 'workshop',
        subCategory: 'Biotechnology workshops',
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: ['Life Sciences Students & Researchers'],
        skills: w.skillsCovered || [],
        experience: 'Open to All',
        salaryOrStipend: w.fees || 'Free',
        salaryTier: 'not_disclosed',
        location: w.venue,
        workMode: w.format === 'Offline' ? 'On-site' : w.format,
        deadline: w.registrationDeadline || w.date,
        postedDate: w.createdAt.split('T')[0],
        sourceName: w.instructor || 'Official Training Portal',
        sourceUrl: w.registrationLink,
        sourceId: 'bionexa-db-workshops',
        lastVerifiedDate: w.updatedAt.split('T')[0],
        status: isClosed ? 'Closed' : 'Active',
        isApproved: true,
        isVerified: true,
        dataCollectionTimestamp: w.updatedAt,
        attributionRequirements: 'Official Workshop Registration Portal',
        description: w.description,
        applicationUrl: w.registrationLink,
        featured: w.featured,
        createdAt: w.createdAt,
        workshopDetails: {
          mode: w.format.toLowerCase(),
          registrationFee: w.fees,
          fees: w.fees,
          dates: w.date,
          certificateProvided: true,
          certificateAvailable: true,
          speakerOrTrainer: w.instructor
        }
      };
    });

    // 3. DB Courses
    const dbCourses = bionexaDb.getCourses().map((c) => {
      const branches = matchBranchesForOpportunity({
        title: c.name,
        description: `${c.description} ${c.category}`,
        skills: c.curriculum
      });
      return {
        id: c.id,
        title: c.name,
        organization: c.provider || c.instructor || 'BIO-INEXA Academy Partner',
        type: 'course',
        subCategory: c.category || 'Biotechnology',
        category: c.category,
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: [c.eligibility || 'Science Students'],
        eligibility: c.eligibility,
        skills: c.curriculum || [],
        experience: c.level || 'Intermediate',
        salaryOrStipend: c.fees || 'Free',
        fees: c.fees,
        duration: c.duration,
        salaryTier: 'not_disclosed',
        location: c.deliveryMode || 'Online (Self-Paced)',
        workMode: (c.deliveryMode || '').toLowerCase().includes('hybrid') ? 'Hybrid' : 'Online',
        deadline: c.registrationDeadline || 'Open / Rolling',
        postedDate: c.createdAt.split('T')[0],
        sourceName: c.provider || 'Official Course Provider',
        sourceUrl: c.registrationLink,
        sourceId: 'bionexa-db-courses',
        lastVerifiedDate: c.updatedAt.split('T')[0],
        status: c.status === 'closed' ? 'Closed' : 'Active',
        isApproved: true,
        isVerified: true,
        dataCollectionTimestamp: c.updatedAt,
        attributionRequirements: 'Official Course Provider Portal',
        description: c.description,
        applicationUrl: c.registrationLink,
        featured: c.featured,
        createdAt: c.createdAt,
        courseDetails: {
          provider: c.provider,
          duration: c.duration,
          deliveryMode: c.deliveryMode,
          fees: c.fees,
          eligibility: c.eligibility,
          registrationDeadline: c.registrationDeadline,
          certificateInfo: c.certificateInfo,
          syllabus: c.curriculum
        }
      };
    });

    // 4. DB Internships
    const dbInternships = bionexaDb.getInternships({ onlyActive: true, onlyApproved: true }).map((intern) => {
      const branches = matchBranchesForOpportunity({
        title: intern.title,
        description: intern.description,
        qualifications: [intern.eligibility],
        skills: intern.skillsRequired,
      });
      return {
        id: intern.id,
        title: intern.title,
        organization: intern.organization,
        type: 'internship',
        subCategory: intern.category || 'Biotech Internships',
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: [intern.eligibility || 'Life Sciences Students'],
        qualification: intern.eligibility,
        skills: intern.skillsRequired || [],
        experience: 'Students / Freshers',
        salaryOrStipend: intern.stipend || 'Competitive Stipend',
        salaryTier: 'paid',
        location: intern.location,
        workMode: intern.workMode,
        deadline: intern.deadline || undefined,
        postedDate: intern.createdAt.split('T')[0],
        sourceName: intern.sourceName || 'Verified Partner Program',
        sourceUrl: intern.sourceUrl || intern.applicationUrl,
        sourceId: 'bionexa-db-internships',
        lastVerifiedDate: intern.lastVerificationDate || intern.updatedAt.split('T')[0],
        status: intern.isActive ? 'Active' : 'Closed',
        isApproved: intern.isApproved,
        isVerified: intern.verificationStatus === 'Verified',
        dataCollectionTimestamp: intern.updatedAt,
        attributionRequirements: `Official host program: ${intern.organization}`,
        description: intern.description,
        applicationUrl: intern.applicationUrl,
        featured: intern.featured,
        createdAt: intern.createdAt,
      };
    });

    // 5. Approved Submitted Opportunities
    const dbSubmitted = bionexaDb.getSubmittedOpportunities({ onlyApproved: true }).map((s) => ({
      ...s,
      isVerified: s.isApproved,
      sourceId: 'bionexa-direct-submissions',
      lastVerifiedDate: s.updatedAt.split('T')[0],
      dataCollectionTimestamp: s.updatedAt,
      attributionRequirements: 'Verified direct submission to BIO-INEXA'
    }));

    // 6. Remaining curated seed opportunities (non-workshop/internship extras not yet in DB)
    const seenIds = new Set<string>([
      ...dbJobs.map((j) => j.id),
      ...dbInternships.map((i) => i.id),
      ...dbWorkshops.map((w) => w.id),
      ...dbCourses.map((c) => c.id),
      ...dbSubmitted.map((s) => s.id)
    ]);
    const curatedExtras = SEED_OPPORTUNITIES.filter(
      (opp) => opp.isApproved && opp.type !== 'workshop' && opp.type !== 'internship' && !seenIds.has(opp.id)
    );

    const unified = [...dbJobs, ...dbInternships, ...dbWorkshops, ...dbCourses, ...dbSubmitted, ...curatedExtras];

    const filtered = unified.filter((opp: any) => {
      if (!opp.isApproved) return false;
      if (opp.status === 'Rejected' || opp.verificationStatus === 'Rejected') return false;
      if (
        statusFilter !== 'expired' &&
        statusFilter !== 'closed' &&
        isJobExpiredByDeadline(opp.deadline, opp.verificationStatus || opp.status)
      ) {
        return false;
      }
      if (verifiedOnly && !opp.isVerified) return false;
      if (branch && branch !== 'all') {
        const hasBranch = Array.isArray(opp.branches) && opp.branches.some((b: string) => b.toLowerCase() === branch);
        if (!hasBranch) return false;
      }
      if (typeFilter && typeFilter !== 'all') {
        if (typeFilter === 'job') {
          if (opp.type !== 'job' && opp.type !== 'biotech_job') return false;
        } else if (String(opp.type).toLowerCase() !== typeFilter) {
          return false;
        }
      }
      if (workModeFilter && workModeFilter !== 'all') {
        const normOpp = String(opp.workMode || '').toLowerCase().replace(/[^a-z]/g, '');
        const normReq = workModeFilter.replace(/[^a-z]/g, '');
        if (normOpp !== normReq) return false;
      }
      if (statusFilter && statusFilter !== 'all') {
        if (String(opp.status || '').toLowerCase() !== statusFilter) return false;
      }
      if (search) {
        const hay = [
          opp.title,
          opp.organization,
          opp.description,
          opp.location,
          ...(opp.skills || [])
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    filtered.sort((a: any, b: any) => {
      const timeB = new Date(b.postedDate || b.createdAt || 0).getTime() || 0;
      const timeA = new Date(a.postedDate || a.createdAt || 0).getTime() || 0;
      return timeB - timeA;
    });

    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, {
      defaultLimit: 100,
      maxLimit: 100
    });
    const paginated = paginateArray(filtered, page, limit);

    res.json({
      success: true,
      status: 'success',
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      opportunities: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'OPPORTUNITIES_FETCH_FAILED', err.message || 'Failed to load opportunities.');
  }
});

// POST /api/opportunities (Public Opportunity / Workshop Submission to Moderation Queue)
app.post('/api/opportunities', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const title = sanitizeString(body.title);
    const organization = sanitizeString(body.organization || body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);
    const location = sanitizeString(body.location) || 'All India';
    const description = sanitizeString(body.description) || 'No detailed description provided by organizer.';
    const contactEmail = sanitizeString(body.contactEmail);

    if (!title || !organization || !applicationUrl) {
      sendApiError(
        res,
        400,
        'Validation Error',
        'MISSING_REQUIRED_FIELDS',
        'Missing required fields: title, organization, and applicationUrl are required.'
      );
      return;
    }

    if (!isValidHttpUrl(applicationUrl)) {
      sendApiError(
        res,
        400,
        'Validation Error',
        'INVALID_URL',
        'Invalid applicationUrl: Must be a valid URL starting with http:// or https://'
      );
      return;
    }

    if (contactEmail && !isValidEmailAddress(contactEmail)) {
      sendApiError(
        res,
        400,
        'Validation Error',
        'INVALID_EMAIL',
        'Contact email must be a valid email address.'
      );
      return;
    }

    const type = sanitizeString(body.type) || 'job';
    const allowedTypes = ['job', 'biotech_job', 'internship', 'workshop', 'course', 'fellowship'];
    if (!allowedTypes.includes(type)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_OPPORTUNITY_TYPE', 'Invalid opportunity type.');
      return;
    }

    const branches = Array.isArray(body.branches) && body.branches.length > 0
      ? body.branches.map((b: unknown) => sanitizeString(b)).filter(Boolean)
      : matchBranchesForOpportunity({ title, description });

    const created = bionexaDb.createSubmittedOpportunity({
      title,
      organization,
      type,
      subCategory: sanitizeString(body.subCategory) || (type === 'workshop' ? 'Biotechnology workshops' : 'Biotechnology openings'),
      description,
      location,
      workMode: sanitizeString(body.workMode) || 'On-site',
      experience: sanitizeString(body.experience) || 'Not Specified',
      qualification: sanitizeString(body.qualification) || '',
      branches: branches.length > 0 ? branches : ['biotech'],
      skills: Array.isArray(body.skills) ? body.skills.map((s: unknown) => sanitizeString(s)).filter(Boolean) : [],
      salaryOrStipend: sanitizeString(body.salaryOrStipend) || 'Not Disclosed',
      salaryTier: sanitizeString(body.salaryTier) || 'not_disclosed',
      deadline: sanitizeString(body.deadline) || '',
      sourceName: sanitizeString(body.sourceName || body.source?.name) || 'Direct Employer / Organizer Submission',
      sourceUrl: sanitizeString(body.sourceUrl || body.source?.originalUrl) || applicationUrl,
      applicationUrl,
      contactEmail,
      workshopDetails: body.workshopDetails && typeof body.workshopDetails === 'object' ? body.workshopDetails : null,
      isApproved: false,
      status: 'Pending Verification'
    });

    res.status(201).json({
      success: true,
      id: created.id,
      opportunity: created,
      message: 'Opportunity submitted successfully and queued for BIO-INEXA administrator verification.'
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'OPPORTUNITY_SUBMIT_FAILED', err.message || 'Failed to save opportunity submission.');
  }
});

// POST /api/contact (Public Council Contact & Institutional Inquiry Form)
app.post('/api/contact', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const name = sanitizeString(body.name);
    const email = sanitizeString(body.email);
    const subject = sanitizeString(body.subject) || 'General Inquiry';
    const message = sanitizeString(body.message);

    if (!name || name.length < 2) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_NAME', 'Please enter your full name.');
      return;
    }
    if (!isValidEmailAddress(email)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_EMAIL', 'Please provide a valid email address.');
      return;
    }
    if (!message || message.length < 10) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_MESSAGE', 'Message content must be at least 10 characters.');
      return;
    }

    const saved = bionexaDb.createContactMessage({ name, email, subject, message });
    res.status(201).json({
      success: true,
      referenceId: saved.referenceId,
      entry: saved,
      message: `Your inquiry (${saved.referenceId}) has been received. Our team will respond within 24 hours.`
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'CONTACT_SUBMIT_FAILED', err.message || 'Failed to save contact message.');
  }
});

// POST /api/newsletter (Biotech Career & Research Dispatch Subscription)
app.post('/api/newsletter', (req: Request, res: Response) => {
  try {
    const email = sanitizeString(req.body?.email);
    if (!isValidEmailAddress(email)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_EMAIL', 'Please provide a valid email address.');
      return;
    }

    const result = bionexaDb.subscribeNewsletter(email);
    res.status(result.alreadySubscribed ? 200 : 201).json({
      success: true,
      alreadySubscribed: result.alreadySubscribed,
      subscriber: result.subscriber,
      message: result.alreadySubscribed
        ? 'You are already subscribed to BIO-INEXA weekly dispatches!'
        : 'Subscribed! Welcome to the BIO-INEXA scientific career briefing.'
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'NEWSLETTER_SUBSCRIBE_FAILED', err.message || 'Failed to process newsletter subscription.');
  }
});

// GET /api/certificates/verify (Public Academy Credential Registry Verification)
app.get('/api/certificates/verify', (req: Request, res: Response) => {
  try {
    const certNumber = sanitizeString(req.query.id || req.query.certificateNumber);
    if (!certNumber) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_CERTIFICATE_NUMBER', 'Please enter a certificate number to verify.');
      return;
    }

    const cert = bionexaDb.verifyCertificate(certNumber);
    if (!cert) {
      res.status(404).json({
        success: false,
        found: false,
        error: 'Not Found',
        code: 'CERTIFICATE_NOT_FOUND',
        message: `No certificate was located matching "${certNumber}".`
      });
      return;
    }

    res.json({
      success: true,
      found: true,
      certificate: cert
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'CERTIFICATE_VERIFY_FAILED', err.message || 'Failed to verify certificate.');
  }
});

// POST /api/certificates (Issue & Persist Academy Certificate)
app.post('/api/certificates', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const recipientName = sanitizeString(body.recipientName);
    const courseTitle = sanitizeString(body.courseTitle);
    const score = Number(body.score);

    if (!recipientName || !courseTitle || !Number.isFinite(score) || score < 0 || score > 100) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_CERTIFICATE_PAYLOAD', 'Valid recipientName, courseTitle, and numeric score (0-100) are required.');
      return;
    }

    const cert = bionexaDb.createCertificate({
      recipientName,
      courseTitle,
      score,
      certificateNumber: sanitizeString(body.certificateNumber) || undefined,
      issueDate: sanitizeString(body.issueDate) || undefined,
      verificationCode: sanitizeString(body.verificationCode) || undefined
    });

    res.status(201).json({
      success: true,
      certificate: cert,
      message: `Certificate #${cert.certificateNumber} issued and recorded.`
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'CERTIFICATE_ISSUE_FAILED', err.message || 'Failed to issue certificate.');
  }
});

// GET/POST /api/applications & PATCH /api/applications/:id/status
app.get('/api/applications', (req: Request, res: Response) => {
  try {
    const allApps = bionexaDb.getJobApplications();
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>, { defaultLimit: 100, maxLimit: 100 });
    const paginated = paginateArray(allApps, page, limit);
    res.json({
      success: true,
      count: paginated.items.length,
      total: paginated.pagination.total,
      pagination: paginated.pagination,
      applications: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'APPLICATIONS_FETCH_FAILED', err.message || 'Failed to load applications.');
  }
});

app.post('/api/applications', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const jobId = sanitizeString(body.jobId);
    const jobTitle = sanitizeString(body.jobTitle);
    const company = sanitizeString(body.company);
    const applicantName = sanitizeString(body.applicantName);
    const applicantEmail = sanitizeString(body.applicantEmail);

    if (!jobId || !jobTitle || !company || !applicantName || !isValidEmailAddress(applicantEmail)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_APPLICATION', 'Job info, applicant name, and valid email are required.');
      return;
    }

    const created = bionexaDb.createJobApplication({
      jobId,
      jobTitle,
      company,
      applicantName,
      applicantEmail,
      phone: sanitizeString(body.phone),
      qualification: sanitizeString(body.qualification),
      experienceYears: sanitizeString(body.experienceYears),
      coverNote: sanitizeString(body.coverNote)
    });

    res.status(201).json({
      success: true,
      application: created,
      message: `Application for "${created.jobTitle}" submitted successfully!`
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'APPLICATION_SUBMIT_FAILED', err.message || 'Failed to submit application.');
  }
});

app.patch('/api/applications/:id/status', (req: Request, res: Response) => {
  try {
    const status = sanitizeString(req.body?.status) as any;
    const allowed = ['Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected'];
    if (!allowed.includes(status)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_STATUS', 'Invalid application status value.');
      return;
    }

    const updated = bionexaDb.updateJobApplicationStatus(req.params.id, status);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'APPLICATION_NOT_FOUND', 'Application not found.');
      return;
    }

    res.json({ success: true, application: updated });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'APPLICATION_UPDATE_FAILED', err.message || 'Failed to update application status.');
  }
});

// Community Discussions API
app.get('/api/discussions', (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const topics = bionexaDb.getDiscussions(category);
    res.json({ success: true, count: topics.length, discussions: topics });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'DISCUSSIONS_FETCH_FAILED', err.message || 'Failed to load discussions.');
  }
});

app.post('/api/discussions', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const title = sanitizeString(body.title);
    const authorName = sanitizeString(body.authorName) || 'BIO-INEXA Member';
    const authorRole = sanitizeString(body.authorRole) || 'BIO-INEXA Member';
    const category = sanitizeString(body.category) || 'Wet Lab Protocols';
    const content = sanitizeString(body.content);

    if (!title || !content) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_FIELDS', 'Title and content are required.');
      return;
    }

    const topic = bionexaDb.createDiscussion({ title, authorName, authorRole, category, content });
    res.status(201).json({ success: true, discussion: topic });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'DISCUSSION_CREATE_FAILED', err.message || 'Failed to create discussion.');
  }
});

app.post('/api/discussions/:id/replies', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const content = sanitizeString(body.content);
    const authorName = sanitizeString(body.authorName) || 'BIO-INEXA Member';
    const authorRole = sanitizeString(body.authorRole) || 'BIO-INEXA Member';

    if (!content) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_REPLY_CONTENT', 'Reply content cannot be empty.');
      return;
    }

    const reply = bionexaDb.addDiscussionReply(req.params.id, { authorName, authorRole, content });
    if (!reply) {
      sendApiError(res, 404, 'Not Found', 'DISCUSSION_NOT_FOUND', 'Discussion topic not found.');
      return;
    }

    res.status(201).json({ success: true, reply });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'REPLY_CREATE_FAILED', err.message || 'Failed to post reply.');
  }
});

app.post('/api/discussions/:id/upvote', (req: Request, res: Response) => {
  try {
    const updated = bionexaDb.upvoteDiscussion(req.params.id);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'DISCUSSION_NOT_FOUND', 'Discussion topic not found.');
      return;
    }
    res.json({ success: true, discussion: updated });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'UPVOTE_FAILED', err.message || 'Failed to upvote discussion.');
  }
});

// POST /api/sync-opportunities (Protected sync trigger matching serverless sync endpoint)
app.post('/api/sync-opportunities', requireAdminPermission('sync:run'), async (req: Request, res: Response) => {
  try {
    const report = await automatedJobManager.runAutomatedSync();
    const schedule = automatedJobManager.getScheduleConfig();
    auditAdminAction(req, 'ADMIN_SYNC_OPPORTUNITIES', 'sync', undefined, {
      newImportedCount: report.newImportedCount,
      updatedCount: report.updatedCount,
      expiredMarkedCount: report.expiredMarkedCount,
    });
    res.json({
      success: true,
      message: `Synchronized ${report.sourcesSuccessful}/${report.sourcesAttempted} configured feed(s): ${report.newImportedCount} new (Pending Verification), ${report.updatedCount} updated, ${report.duplicatesSkippedCount} duplicates skipped, ${report.expiredMarkedCount} expired.`,
      schedule,
      report
    });
  } catch (err: any) {
    if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
      sendApiError(res, 409, 'Conflict', 'SYNC_IN_PROGRESS', err.message || 'Opportunity synchronization is already running.');
      return;
    }
    sendApiError(res, 500, 'Sync Error', 'SYNC_FAILED', err.message || 'Synchronization failed.');
  }
});

// GET /api/announcements
app.get('/api/announcements', (_req: Request, res: Response) => {
  try {
    const announcements = bionexaDb.getAnnouncements(true);
    res.json({ success: true, count: announcements.length, announcements });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'ANNOUNCEMENTS_FETCH_FAILED', err.message || 'Failed to load announcements.');
  }
});

// GET /api/content/homepage
app.get('/api/content/homepage', (_req: Request, res: Response) => {
  try {
    const highlights = bionexaDb.getContent('homepage_highlights', {
      heroBadge: 'National Life Sciences Career & Research Gateway',
      bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
      activeVacanciesCount: '23+ Active Biotech Openings',
      participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers'
    });
    res.json({ success: true, highlights });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'HOMEPAGE_CONTENT_FAILED', err.message || 'Failed to load homepage content.');
  }
});

// -------------------------------------------------------------
// ADMIN AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/admin/login
app.post('/api/admin/login', (req: Request, res: Response) => {
  if (!isAdminAuthConfigured()) {
    sendApiError(
      res,
      503,
      'Service Unavailable',
      'ADMIN_AUTH_NOT_CONFIGURED',
      'Administrator authentication is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) environment variables, or run scripts/admin-password-reset.ts.'
    );
    return;
  }

  const ip = getClientIp(req);
  const { username, password, totpCode } = req.body || {};

  const check = rateLimiter.check(ip);
  if (!check.allowed) {
    const remainingSeconds = check.retryAfterSec || 900;
    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      code: 'RATE_LIMITED',
      message: `Account locked due to consecutive failed attempts. Retry in ${remainingSeconds} seconds.`,
      retryAfterSec: remainingSeconds
    });
    return;
  }

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      code: 'MISSING_CREDENTIALS',
      message: 'Username and password required.'
    });
    return;
  }

  const cleanUsername = username.trim();
  const normalizedInput = cleanUsername.toLowerCase();

  let matchedUser: AdminUser | null = null;
  let activeTotpSecret = (process.env.ADMIN_TOTP_SECRET || '').trim();

  // 1. Check DB-stored admin user accounts (exact username or email match, no 'admin' bypass)
  const dbAdmin = bionexaDb.getAdminUserByUsername(cleanUsername);
  if (dbAdmin && dbAdmin.isActive && dbAdmin.passwordHash && verifyPassword(password, dbAdmin.passwordHash)) {
    const role = normalizeAdminRole(dbAdmin.role);
    matchedUser = {
      id: dbAdmin.id,
      username: dbAdmin.username,
      email: dbAdmin.email,
      name: dbAdmin.displayName,
      role,
      permissions: getPermissionsForRole(role),
    };
    if (dbAdmin.totpEnabled && dbAdmin.totpSecret) {
      activeTotpSecret = dbAdmin.totpSecret;
    }
  }

  // 2. Also check explicit env-configured ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_PASSWORD
  if (!matchedUser) {
    const envUsername = getEnvAdminUsername();
    const envPasswordHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    if (envUsername && normalizedInput === envUsername.toLowerCase()) {
      const hashOk = envPasswordHash ? verifyPassword(password, envPasswordHash) : false;
      const plainOk = !envPasswordHash && envPassword ? crypto.timingSafeEqual(
        crypto.createHash('sha256').update(password).digest(),
        crypto.createHash('sha256').update(envPassword).digest()
      ) : false;
      if (hashOk || plainOk) {
        const role = normalizeAdminRole(process.env.ADMIN_ROLE || 'super_admin');
        matchedUser = {
          id: dbAdmin?.id || 'admin-master-001',
          username: envUsername,
          email: envUsername.includes('@') ? envUsername : `${envUsername}@bionexa.org`,
          name: dbAdmin?.displayName || 'BIO-INEXA Operations Admin',
          role,
          permissions: getPermissionsForRole(role),
        };
      }
    }
  }

  if (!matchedUser) {
    const failure = rateLimiter.recordFailure(ip, Date.now(), {
      usernameAttempted: cleanUsername,
      reason: 'INVALID_CREDENTIALS',
    });
    const postCheck = rateLimiter.check(ip);
    bionexaDb.recordLoginAttempt({
      identifier: ip,
      ipAddress: ip,
      attemptedUsername: cleanUsername,
      success: false,
      failureReason: 'INVALID_CREDENTIALS',
      lockedUntil: failure.isLocked && failure.retryAfterSec
        ? new Date(Date.now() + failure.retryAfterSec * 1000).toISOString()
        : undefined,
    });
    bionexaDb.recordAdminAuditLog({
      actorUsername: cleanUsername,
      action: failure.isLocked ? 'ADMIN_LOGIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
      entityType: 'admin_auth',
      ipAddress: ip,
      details: { remainingAttempts: postCheck.remainingAttempts, isLocked: failure.isLocked },
    });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid administrator credentials.',
      remainingAttempts: postCheck.remainingAttempts,
      isLocked: failure.isLocked
    });
    return;
  }

  // Optional RFC 6238 TOTP 2FA verification when configured
  if (activeTotpSecret) {
    const cleanTotp = typeof totpCode === 'string' ? totpCode.trim() : '';
    if (!cleanTotp) {
      res.status(401).json({
        success: false,
        error: 'MFA Required',
        code: 'MFA_REQUIRED',
        requires2fa: true,
        message: 'Enter your 6-digit authenticator verification code to continue.'
      });
      return;
    }

    if (!verifyTotpCode(activeTotpSecret, cleanTotp)) {
      const failure = rateLimiter.recordFailure(ip, Date.now(), {
        usernameAttempted: cleanUsername,
        reason: 'INVALID_2FA_CODE',
      });
      const postCheck = rateLimiter.check(ip);
      bionexaDb.recordLoginAttempt({
        identifier: ip,
        ipAddress: ip,
        attemptedUsername: cleanUsername,
        success: false,
        failureReason: 'INVALID_2FA_CODE',
      });
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_2FA_CODE',
        requires2fa: true,
        message: 'Invalid two-factor authentication code.',
        remainingAttempts: postCheck.remainingAttempts,
        isLocked: failure.isLocked
      });
      return;
    }
  }

  rateLimiter.reset(ip);
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  const session = sessionManager.createSession(matchedUser, Date.now(), { ipAddress: ip, userAgent });

  bionexaDb.createAdminSessionRecord({
    jti: session.jti,
    token: session.token,
    adminUserId: matchedUser.id,
    actorUsername: matchedUser.username,
    role: matchedUser.role,
    ipAddress: ip,
    userAgent,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  });
  bionexaDb.updateAdminLastLogin(matchedUser.id);
  bionexaDb.recordLoginAttempt({
    identifier: ip,
    ipAddress: ip,
    attemptedUsername: matchedUser.username,
    success: true,
  });
  bionexaDb.recordAdminAuditLog({
    adminUserId: matchedUser.id,
    actorUsername: matchedUser.username,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'admin_session',
    entityId: session.jti,
    ipAddress: ip,
    details: { role: matchedUser.role },
  });

  res.cookie('bionexa_admin_session', session.token, {
    httpOnly: true,
    secure: runtimeEnv.cookieSecure,
    sameSite: runtimeEnv.cookieSameSite,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  // Never leak session token into frontend JSON body — HttpOnly cookie carries the session
  res.json({
    success: true,
    message: 'Administrative session authenticated successfully.',
    user: session.user,
    permissions: session.user.permissions,
    expiresAt: session.expiresAt
  });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  if (!isAdminCsrfOriginValid(req)) {
    sendApiError(res, 403, 'Forbidden', 'CSRF_ORIGIN_DENIED', 'Cross-origin logout rejected.');
    return;
  }

  const token = extractSessionToken(req);
  if (token) {
    const resolved = resolveAuthenticatedAdminSession(token);
    sessionManager.destroySession(token);
    bionexaDb.revokeAdminSessionRecord(token);
    if (resolved) {
      bionexaDb.recordAdminAuditLog({
        adminUserId: resolved.user.id,
        actorUsername: resolved.user.username,
        action: 'ADMIN_LOGOUT',
        entityType: 'admin_session',
        entityId: resolved.jti,
        ipAddress: getClientIp(req),
      });
    }
  }

  res.clearCookie('bionexa_admin_session', { path: '/' });
  res.json({
    success: true,
    message: 'Administrative session terminated.'
  });
});

// GET /api/admin/me
app.get('/api/admin/me', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ authenticated: false });
    return;
  }

  const session = resolveAuthenticatedAdminSession(token);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    user: session.user,
    permissions: session.user.permissions || getPermissionsForRole(session.user.role),
    expiresAt: session.expiresAt
  });
});

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', requireAdminPermission('audit:read'), (_req: Request, res: Response) => {
  try {
    const logs = bionexaDb.getAdminAuditLogs(100);
    const loginAttempts = bionexaDb.getRecentLoginAttempts(50);
    const activeSessions = bionexaDb.listActiveAdminSessions();
    res.json({
      success: true,
      logs,
      loginAttempts,
      activeSessionsCount: activeSessions.length,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'AUDIT_LOG_FETCH_FAILED', err.message || 'Failed to load audit logs.');
  }
});

// GET /api/admin/sessions
app.get('/api/admin/sessions', requireAdminPermission('dashboard:read'), (req: Request, res: Response) => {
  try {
    const currentJti = (req as any).adminSessionJti;
    const sessions = bionexaDb.listActiveAdminSessions().map((s) => ({
      ...s,
      current: s.jti === currentJti,
    }));
    res.json({ success: true, sessions });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'SESSIONS_FETCH_FAILED', err.message || 'Failed to list active sessions.');
  }
});

// POST /api/admin/sessions/revoke-all
app.post('/api/admin/sessions/revoke-all', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser as AdminUser;
    const currentJti = (req as any).adminSessionJti as string;
    const currentToken = (req as any).adminSessionToken as string;
    const memRevoked = sessionManager.revokeAllForUser(adminUser.id, currentToken);
    const dbRevoked = bionexaDb.revokeAllAdminSessions(adminUser.id, currentJti);
    const revokedCount = Math.max(memRevoked, dbRevoked);

    auditAdminAction(req, 'ADMIN_SESSIONS_REVOKED_OTHERS', 'admin_session', currentJti, { revokedCount });
    res.json({
      success: true,
      revokedCount,
      message: 'All other administrative sessions for this account have been revoked.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'SESSION_REVOKE_FAILED', err.message || 'Failed to revoke sessions.');
  }
});

// POST /api/admin/auth/change-password
app.post('/api/admin/auth/change-password', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser as AdminUser;
    const currentJti = (req as any).adminSessionJti as string;
    const currentToken = (req as any).adminSessionToken as string;
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      sendApiError(res, 400, 'Validation Error', 'MISSING_PASSWORD_FIELDS', 'currentPassword and newPassword are required.');
      return;
    }

    const strength = validateAdminPasswordStrength(newPassword);
    if (!strength.valid) {
      sendApiError(res, 400, 'Validation Error', 'WEAK_PASSWORD', strength.error || 'Password does not meet complexity requirements.');
      return;
    }

    const dbUser = bionexaDb.getAdminUserByUsername(adminUser.username);
    if (!dbUser || !dbUser.passwordHash) {
      sendApiError(res, 404, 'Not Found', 'ADMIN_USER_NOT_FOUND', 'Administrator account not found in database.');
      return;
    }

    if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
      sendApiError(res, 401, 'Unauthorized', 'INVALID_CURRENT_PASSWORD', 'Current administrator password is incorrect.');
      return;
    }

    const newHash = hashPassword(newPassword);
    bionexaDb.updateAdminPasswordHash(dbUser.id, newHash);
    sessionManager.revokeAllForUser(dbUser.id, currentToken);
    const revokedCount = bionexaDb.revokeAllAdminSessions(dbUser.id, currentJti);

    auditAdminAction(req, 'ADMIN_PASSWORD_CHANGED', 'admin_user', dbUser.id, { revokedOtherSessions: revokedCount });
    res.json({
      success: true,
      revokedOtherSessions: revokedCount,
      message: 'Administrator password rotated cleanly and other active sessions revoked.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Server Error', 'PASSWORD_CHANGE_FAILED', err.message || 'Failed to update password.');
  }
});

// POST /api/admin/password-reset/request
app.post('/api/admin/password-reset/request', (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const rateCheck = rateLimiter.check(`reset:${ip}`);
    if (!rateCheck.allowed) {
      sendApiError(res, 429, 'Too Many Requests', 'RATE_LIMITED', 'Too many password reset attempts. Try again later.');
      return;
    }
    rateLimiter.recordFailure(`reset:${ip}`, Date.now(), { reason: 'PASSWORD_RESET_REQUEST' });

    const username = sanitizeString(req.body?.username);
    if (!username) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_USERNAME', 'Administrator username or email is required.');
      return;
    }

    const dbUser = bionexaDb.getAdminUserByUsername(username);
    if (dbUser) {
      const reset = createPasswordResetToken();
      bionexaDb.createPasswordResetRecord({
        adminUserId: dbUser.id,
        actorUsername: dbUser.username,
        tokenHash: reset.tokenHash,
        expiresAtIso: reset.expiresAtIso,
      });
      bionexaDb.recordAdminAuditLog({
        adminUserId: dbUser.id,
        actorUsername: dbUser.username,
        action: 'ADMIN_PASSWORD_RESET_REQUESTED',
        entityType: 'admin_password_reset',
        ipAddress: ip,
        details: { expiresAt: reset.expiresAtIso },
      });
    }

    // Never return the raw token over HTTP or leak whether a username exists
    res.json({
      success: true,
      message: 'If an active administrator account matches, a time-limited reset request has been logged. Use operator CLI scripts/admin-password-reset.ts to issue an out-of-band reset token.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Server Error', 'RESET_REQUEST_FAILED', err.message || 'Failed to record password reset request.');
  }
});

// POST /api/admin/password-reset/confirm
app.post('/api/admin/password-reset/confirm', (req: Request, res: Response) => {
  try {
    const rawToken = sanitizeString(req.body?.token);
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!rawToken) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_TOKEN', 'Password reset token is required.');
      return;
    }

    const strength = validateAdminPasswordStrength(newPassword);
    if (!strength.valid) {
      sendApiError(res, 400, 'Validation Error', 'WEAK_PASSWORD', strength.error || 'Password does not meet complexity rules.');
      return;
    }

    const newHash = hashPassword(newPassword);
    const consumed = bionexaDb.consumePasswordResetToken(rawToken, newHash);
    if (!consumed.ok) {
      sendApiError(res, 400, 'Invalid Token', 'INVALID_RESET_TOKEN', consumed.error || 'Invalid or expired reset token.');
      return;
    }

    if (consumed.adminUserId) {
      sessionManager.revokeAllForUser(consumed.adminUserId);
    }
    bionexaDb.recordAdminAuditLog({
      adminUserId: consumed.adminUserId,
      actorUsername: consumed.actorUsername || 'admin',
      action: 'ADMIN_PASSWORD_RESET_COMPLETED',
      entityType: 'admin_user',
      entityId: consumed.adminUserId,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      message: 'Administrator password reset successfully. All active sessions have been revoked.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Server Error', 'RESET_CONFIRM_FAILED', err.message || 'Failed to confirm password reset.');
  }
});

// -------------------------------------------------------------
// PROTECTED ADMIN DATABASE ENDPOINTS
// -------------------------------------------------------------

// Helper to format DbJob for Admin Dashboard UI compatibility
function formatJobForAdmin(j: DbJob) {
  return {
    id: j.id,
    title: j.title,
    company: j.employer,
    employer: j.employer,
    sector: j.sector,
    location: j.location,
    type: j.employmentType,
    salary: j.salary,
    qualification: j.qualification,
    experienceLevel: 'Experienced (3+ yrs)',
    description: j.description,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    skills: j.skills,
    deadline: j.expiryDate,
    expiryDate: j.expiryDate,
    publicationDate: j.publicationDate,
    applicationUrl: j.applicationUrl,
    originalJobUrl: j.originalJobUrl || j.applicationUrl,
    status: j.isActive ? 'Active' : 'Expired',
    featured: j.featured,
    isApproved: j.isApproved,
    isExpired: !j.isActive,
    sourceName: j.source,
    originalSource: j.source,
    verificationStatus: j.verificationStatus,
    lastVerificationDate: j.lastVerificationDate,
    verificationNotes: j.verificationNotes
  };
}

function formatWorkshopForAdmin(w: DbWorkshop) {
  return {
    id: w.id,
    title: w.name,
    name: w.name,
    organizer: w.instructor,
    instructor: w.instructor,
    location: w.venue,
    venue: w.venue,
    workMode: w.format,
    format: w.format,
    startDate: w.date,
    endDate: w.date,
    date: w.date,
    time: w.time || '09:30 AM - 04:30 PM IST',
    duration: w.duration || '1 Day',
    fees: w.fees || 'Free',
    capacity: w.capacity || 50,
    registrationUrl: w.registrationLink,
    registrationLink: w.registrationLink,
    registrationDeadline: w.registrationDeadline || '',
    availability: w.availability || 'Open',
    description: w.description,
    imageUrl: w.imageUrl || '',
    featured: Boolean(w.featured),
    skillsCovered: w.skillsCovered || [],
    status: w.status || 'upcoming',
    isApproved: true
  };
}

function formatCourseForAdmin(c: DbCourse) {
  const status = normalizeCourseStatus(c.status, c.availability);
  const category = normalizeCourseCategory(c.category);
  return {
    id: c.id,
    title: c.name,
    name: c.name,
    provider: c.provider || c.instructor || 'Institutional Training Partner',
    instructor: c.instructor || c.provider || '',
    category,
    duration: c.duration,
    level: c.level || 'Intermediate',
    deliveryMode: c.deliveryMode || 'Online (Self-Paced)',
    fees: c.fees || 'Free',
    price: c.fees || 'Free',
    eligibility: c.eligibility || 'Open to Science Students',
    description: c.description,
    curriculum: c.curriculum || [],
    syllabus: c.curriculum || [],
    certificateInfo: c.certificateInfo || '',
    isCertificateAvailable: Boolean(c.certificateInfo) || Boolean(c.isCertificateAvailable),
    registrationDeadline: c.registrationDeadline || 'Open / Rolling',
    registrationUrl: c.registrationLink || '',
    registrationLink: c.registrationLink || '',
    imageUrl: c.imageUrl || '',
    status,
    availability: status === 'closed' ? 'Closed' : 'Available',
    featured: Boolean(c.featured),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

function formatInternshipForPublic(intern: DbInternship) {
  return {
    id: intern.id,
    slug: intern.slug || intern.id,
    title: intern.title,
    organization: intern.organization,
    location: intern.location,
    mode: intern.workMode,
    workMode: intern.workMode,
    stipend: intern.stipend,
    duration: intern.duration,
    deadline: intern.deadline,
    category: intern.category,
    eligibility: intern.eligibility,
    description: intern.description,
    learningOutcomes: intern.learningOutcomes || [],
    skillsRequired: intern.skillsRequired || [],
    source: {
      name: intern.sourceName || 'Verified Partner Program',
      url: intern.sourceUrl || intern.applicationUrl,
      isExternal: true,
    },
    sourceName: intern.sourceName,
    sourceUrl: intern.sourceUrl,
    applicationUrl: intern.applicationUrl,
    verificationStatus: intern.verificationStatus,
    verificationNotes: intern.verificationNotes,
    lastVerificationDate: intern.lastVerificationDate,
    isVerified: intern.isVerified,
    isApproved: intern.isApproved,
    isActive: intern.isActive,
    featured: intern.featured,
    createdAt: intern.createdAt,
    updatedAt: intern.updatedAt,
  };
}

function formatInternshipForAdmin(intern: DbInternship) {
  return {
    ...formatInternshipForPublic(intern),
    status:
      intern.verificationStatus === 'Rejected'
        ? 'Rejected'
        : !intern.isActive
        ? 'Expired'
        : 'Active',
  };
}

function buildAdminWebsiteContent() {
  const rawJobs = bionexaDb.getAllJobsAdmin();
  const rawAnnouncements = bionexaDb.getAnnouncements(false);
  const highlights = bionexaDb.getContent('homepage_highlights', {
    heroBadge: 'National Life Sciences Career & Research Gateway',
    bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
    activeVacanciesCount: '23+ Active Biotech Openings',
    participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers'
  });

  return {
    announcements: rawAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      tag: a.tag,
      date: a.date,
      link: a.link,
      active: a.isActive
    })),
    featuredOpportunityIds: rawJobs.filter((j) => j.featured).map((j) => j.id),
    homepageHighlights: highlights
  };
}

// GET /api/admin/data
app.get('/api/admin/data', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const rawJobs = bionexaDb.getAllJobsAdmin();
    const rawInternships = bionexaDb.getAllInternshipsAdmin();
    const rawWorkshops = bionexaDb.getWorkshops(false);
    const rawCourses = bionexaDb.getCourses(false);
    const submittedOpportunities = bionexaDb.getSubmittedOpportunities();
    const contactMessages = bionexaDb.getContactMessages();
    const complianceRequests = bionexaDb.getComplianceRequests();
    const syncHistory = bionexaDb.getSyncLogs(50);
    const stats = bionexaDb.getDashboardStats();
    const content = buildAdminWebsiteContent();

    res.json({
      success: true,
      stats,
      jobs: rawJobs.map(formatJobForAdmin),
      internships: rawInternships.map(formatInternshipForAdmin),
      workshops: rawWorkshops.map(formatWorkshopForAdmin),
      courses: rawCourses.map(formatCourseForAdmin),
      submittedOpportunities,
      contactMessages,
      complianceRequests,
      syncHistory,
      content,
      databaseEngine: 'SQLite 3 (Node.js 22)',
      persistentDbConfigured: true
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'ADMIN_DATA_FAILED', err.message || 'Failed to load admin data.');
  }
});

// POST /api/admin/jobs (Add Job)
app.post('/api/admin/jobs', requireAdminPermission('jobs:write'), (req: Request, res: Response) => {
  try {
    const body = req.body;
    const title = sanitizeString(body.title);
    const employer = sanitizeString(body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);

    if (!title || !employer || !applicationUrl) {
      res.status(400).json({ error: 'Validation Error', message: 'Title, company/employer, and applicationUrl are required.' });
      return;
    }

    const urlCheck = validateApplicationUrl(applicationUrl);
    if (!urlCheck.valid) {
      res.status(400).json({ error: 'Validation Error', message: urlCheck.reason || 'Application URL must start with http:// or https://' });
      return;
    }

    const duplicate = bionexaDb.findDuplicateJob({ title, employer, applicationUrl });
    if (duplicate) {
      res.status(409).json({
        error: 'Duplicate Listing',
        code: 'DUPLICATE_JOB_LISTING',
        message: `A duplicate job listing already exists (${duplicate.title} at ${duplicate.employer}).`
      });
      return;
    }

    const verificationStatus = normalizeJobVerificationStatus(body.verificationStatus || 'Pending Verification');
    const isApproved = verificationStatus === 'Verified' || verificationStatus === 'Link Unavailable';
    const isActive = verificationStatus !== 'Expired' && verificationStatus !== 'Rejected';
    const lastVerificationDate =
      verificationStatus === 'Pending Verification'
        ? ''
        : sanitizeString(body.lastVerificationDate || (verificationStatus === 'Verified' ? new Date().toISOString().split('T')[0] : ''));

    const job = bionexaDb.createJob({
      title,
      employer,
      sector: sanitizeString(body.sector || 'Private Biopharma'),
      location: sanitizeString(body.location || 'Bengaluru, Karnataka'),
      employmentType: sanitizeString(body.type || 'Full-time'),
      salary: sanitizeString(body.salary || 'Competitive / Disclosed on Interview'),
      qualification: sanitizeString(body.qualification || 'M.Sc in Life Sciences'),
      description: sanitizeString(body.description || 'Biotechnology professional opening.'),
      responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      skills: Array.isArray(body.skills) ? body.skills : [],
      expiryDate: sanitizeString(body.deadline || body.expiryDate || '2026-12-31'),
      applicationUrl,
      originalJobUrl: sanitizeString(body.originalJobUrl || body.sourceUrl || applicationUrl),
      publicationDate: sanitizeString(body.publicationDate || new Date().toISOString().split('T')[0]),
      lastVerificationDate,
      verificationStatus,
      verificationNotes: sanitizeString(body.verificationNotes || ''),
      isActive,
      isApproved,
      featured: Boolean(body.featured),
      source: sanitizeString(body.sourceName || body.originalSource || 'BIO-INEXA Admin Portal')
    });

    auditAdminAction(req, 'ADMIN_JOB_CREATED', 'job', job.id, { title: job.title, employer: job.employer });
    res.status(201).json({ success: true, job: formatJobForAdmin(job) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/jobs/:id (Edit Job)
app.put('/api/admin/jobs/:id', requireAdminPermission('jobs:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Partial<DbJob> = {};
    if (body.title) updates.title = sanitizeString(body.title);
    if (body.company || body.employer) updates.employer = sanitizeString(body.company || body.employer);
    if (body.sector) updates.sector = sanitizeString(body.sector);
    if (body.location) updates.location = sanitizeString(body.location);
    if (body.type || body.employmentType) updates.employmentType = sanitizeString(body.type || body.employmentType);
    if (body.salary) updates.salary = sanitizeString(body.salary);
    if (body.qualification) updates.qualification = sanitizeString(body.qualification);
    if (body.description) updates.description = sanitizeString(body.description);
    if (Array.isArray(body.responsibilities)) updates.responsibilities = body.responsibilities;
    if (Array.isArray(body.requirements)) updates.requirements = body.requirements;
    if (Array.isArray(body.skills)) updates.skills = body.skills;
    if (body.deadline || body.expiryDate) updates.expiryDate = sanitizeString(body.deadline || body.expiryDate);
    if (body.publicationDate) updates.publicationDate = sanitizeString(body.publicationDate);
    if (body.originalJobUrl) updates.originalJobUrl = sanitizeString(body.originalJobUrl);
    if (body.source || body.sourceName) updates.source = sanitizeString(body.source || body.sourceName);
    if (body.verificationStatus) updates.verificationStatus = body.verificationStatus;
    if (body.lastVerificationDate !== undefined) updates.lastVerificationDate = sanitizeString(body.lastVerificationDate);
    if (body.verificationNotes !== undefined) updates.verificationNotes = sanitizeString(body.verificationNotes);
    if (body.applicationUrl) {
      const url = sanitizeString(body.applicationUrl);
      if (!isValidHttpUrl(url)) {
        res.status(400).json({ error: 'Validation Error', message: 'Application URL must start with http:// or https://' });
        return;
      }
      updates.applicationUrl = url;
    }
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);
    if (body.isApproved !== undefined) updates.isApproved = Boolean(body.isApproved);
    if (body.isExpired !== undefined) updates.isActive = !body.isExpired;

    const updated = bionexaDb.updateJob(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_JOB_UPDATED', 'job', id);
    res.json({ success: true, job: formatJobForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/jobs/:id (Delete Job)
app.delete('/api/admin/jobs/:id', requireAdminPermission('jobs:delete'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteJob(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_JOB_DELETED', 'job', id);
    res.json({ success: true, message: `Job ${id} permanently deleted from database.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PATCH & PUT /api/admin/jobs/:id/status (Update Status/Expiry/Approval/Rejection)
const handleJobStatusUpdate = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isApproved, isExpired, verificationStatus, verificationNotes } = req.body || {};

    const updates: Partial<DbJob> = {};
    if (isApproved !== undefined) updates.isApproved = Boolean(isApproved);
    if (isExpired !== undefined) updates.isActive = !isExpired;
    if (verificationStatus !== undefined) updates.verificationStatus = verificationStatus;
    if (verificationNotes !== undefined) updates.verificationNotes = sanitizeString(verificationNotes);

    const normStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    if (normStatus === 'rejected') {
      updates.isActive = false;
      updates.isApproved = false;
      updates.verificationStatus = 'Rejected';
    } else if (normStatus === 'expired') {
      updates.isActive = false;
      updates.verificationStatus = 'Expired';
    } else if (normStatus === 'inactive') {
      updates.isActive = false;
    } else if (normStatus === 'active' || normStatus === 'approved') {
      updates.isActive = true;
      if (isApproved === true || normStatus === 'approved') {
        updates.isApproved = true;
        if (!verificationStatus) {
          updates.verificationStatus = 'Verified';
          updates.lastVerificationDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    const updated = bionexaDb.updateJob(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_JOB_STATUS_UPDATED', 'job', id, { status, isApproved, isExpired });
    res.json({ success: true, job: formatJobForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
};

app.patch('/api/admin/jobs/:id/status', requireAdminPermission('jobs:write'), handleJobStatusUpdate);
app.put('/api/admin/jobs/:id/status', requireAdminPermission('jobs:write'), handleJobStatusUpdate);

// GET /api/admin/jobs/:id/verifications (Verification Audit History)
app.get('/api/admin/jobs/:id/verifications', requireAdminPermission('dashboard:read'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = bionexaDb.getJobById(id);
    if (!job) {
      res.status(404).json({ error: 'Not Found', message: 'Job not found.' });
      return;
    }
    const verifications = bionexaDb.getVerificationRecords(id);
    res.json({ success: true, jobId: id, verifications });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/jobs/:id/verify (Audit Verification)
app.post('/api/admin/jobs/:id/verify', requireAdminPermission('jobs:verify'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, lastVerificationDate } = req.body || {};
    const adminUser = (req as any).adminUser;

    const existing = bionexaDb.getJobById(id);
    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Job not found.' });
      return;
    }

    const requestedStatus = sanitizeString(status) || 'Verified';
    if (!VALID_JOB_VERIFICATION_STATUSES.includes(requestedStatus as any)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid verification status. Must be one of: ${VALID_JOB_VERIFICATION_STATUSES.join(', ')}.`
      });
      return;
    }

    if (requestedStatus === 'Verified') {
      const urlCheck = validateApplicationUrl(existing.applicationUrl);
      if (!urlCheck.valid) {
        res.status(400).json({
          error: 'Validation Error',
          code: 'INVALID_APPLICATION_URL',
          message: `Cannot mark job as Verified: ${urlCheck.reason}`
        });
        return;
      }
    }

    const verified = bionexaDb.verifyJob(
      id,
      adminUser?.email || adminUser?.username || 'admin@bionexa.org',
      requestedStatus,
      sanitizeString(notes),
      requestedStatus === 'Pending Verification' ? '' : sanitizeString(lastVerificationDate) || undefined
    );

    if (!verified) {
      res.status(404).json({ error: 'Not Found', message: 'Job not found.' });
      return;
    }

    const updated = bionexaDb.getJobById(id)!;
    const verifications = bionexaDb.getVerificationRecords(id);
    auditAdminAction(req, 'ADMIN_JOB_VERIFIED', 'job', id, { verificationStatus: updated.verificationStatus });
    res.json({
      success: true,
      job: formatJobForAdmin(updated),
      verifications,
      message: `Job marked as "${updated.verificationStatus}" and recorded in audit log.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// A2. Internships Management Endpoints
// -------------------------------------------------------------

app.get('/api/admin/internships', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const items = bionexaDb.getAllInternshipsAdmin();
    res.json({ success: true, count: items.length, internships: items.map(formatInternshipForAdmin) });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'ADMIN_INTERNSHIPS_FAILED', err.message || 'Failed to load internships.');
  }
});

app.post('/api/admin/internships', requireAdminPermission('jobs:write'), (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const title = sanitizeString(body.title);
    const organization = sanitizeString(body.organization || body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);

    if (!title || !organization || !applicationUrl) {
      res.status(400).json({ error: 'Validation Error', message: 'Title, organization, and applicationUrl are required.' });
      return;
    }
    if (!isValidHttpUrl(applicationUrl)) {
      res.status(400).json({ error: 'Validation Error', message: 'Application URL must start with http:// or https://' });
      return;
    }

    const verificationStatus = body.verificationStatus || 'Verified';
    const isApproved = verificationStatus === 'Verified' || verificationStatus === 'Link Unavailable' ? true : Boolean(body.isApproved);
    const isActive = verificationStatus !== 'Expired' && verificationStatus !== 'Rejected';

    const created = bionexaDb.createInternship({
      title,
      organization,
      location: sanitizeString(body.location || 'India'),
      workMode: sanitizeString(body.mode || body.workMode || 'On-site Lab'),
      stipend: sanitizeString(body.stipend || 'Competitive Stipend'),
      duration: sanitizeString(body.duration || '3 Months'),
      deadline: sanitizeString(body.deadline || ''),
      category: sanitizeString(body.category || 'Industrial R&D'),
      eligibility: sanitizeString(body.eligibility || 'B.Sc / M.Sc / B.Tech in Life Sciences'),
      description: sanitizeString(body.description || `${title} internship at ${organization}.`),
      learningOutcomes: Array.isArray(body.learningOutcomes) ? body.learningOutcomes : [],
      skillsRequired: Array.isArray(body.skillsRequired) ? body.skillsRequired : [],
      sourceName: sanitizeString(body.sourceName || 'BIO-INEXA Admin Portal'),
      sourceUrl: sanitizeString(body.sourceUrl || applicationUrl),
      applicationUrl,
      verificationStatus,
      verificationNotes: sanitizeString(body.verificationNotes || 'Added via BIO-INEXA Admin Portal.'),
      lastVerificationDate: sanitizeString(body.lastVerificationDate || (verificationStatus === 'Verified' ? new Date().toISOString().split('T')[0] : '')),
      isApproved,
      isActive,
      featured: Boolean(body.featured),
    });

    auditAdminAction(req, 'ADMIN_INTERNSHIP_CREATED', 'internship', created.id, { title: created.title, organization: created.organization });
    res.status(201).json({ success: true, internship: formatInternshipForAdmin(created) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

app.put('/api/admin/internships/:id', requireAdminPermission('jobs:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updates: Partial<DbInternship> = {};

    if (body.title) updates.title = sanitizeString(body.title);
    if (body.organization || body.company) updates.organization = sanitizeString(body.organization || body.company);
    if (body.location) updates.location = sanitizeString(body.location);
    if (body.mode || body.workMode) updates.workMode = sanitizeString(body.mode || body.workMode);
    if (body.stipend !== undefined) updates.stipend = sanitizeString(body.stipend);
    if (body.duration !== undefined) updates.duration = sanitizeString(body.duration);
    if (body.deadline !== undefined) updates.deadline = sanitizeString(body.deadline);
    if (body.category !== undefined) updates.category = sanitizeString(body.category);
    if (body.eligibility !== undefined) updates.eligibility = sanitizeString(body.eligibility);
    if (body.description !== undefined) updates.description = sanitizeString(body.description);
    if (Array.isArray(body.learningOutcomes)) updates.learningOutcomes = body.learningOutcomes;
    if (Array.isArray(body.skillsRequired)) updates.skillsRequired = body.skillsRequired;
    if (body.sourceName !== undefined) updates.sourceName = sanitizeString(body.sourceName);
    if (body.sourceUrl !== undefined) updates.sourceUrl = sanitizeString(body.sourceUrl);
    if (body.verificationStatus !== undefined) updates.verificationStatus = body.verificationStatus;
    if (body.verificationNotes !== undefined) updates.verificationNotes = sanitizeString(body.verificationNotes);
    if (body.lastVerificationDate !== undefined) updates.lastVerificationDate = sanitizeString(body.lastVerificationDate);
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);
    if (body.isApproved !== undefined) updates.isApproved = Boolean(body.isApproved);
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.applicationUrl) {
      const url = sanitizeString(body.applicationUrl);
      if (!isValidHttpUrl(url)) {
        res.status(400).json({ error: 'Validation Error', message: 'Application URL must start with http:// or https://' });
        return;
      }
      updates.applicationUrl = url;
    }

    const updated = bionexaDb.updateInternship(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Internship not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_INTERNSHIP_UPDATED', 'internship', id);
    res.json({ success: true, internship: formatInternshipForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

const handleInternshipStatusUpdate = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isApproved, isActive, verificationStatus, verificationNotes } = req.body || {};
    const updates: Partial<DbInternship> = {};
    if (isApproved !== undefined) updates.isApproved = Boolean(isApproved);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (verificationStatus !== undefined) updates.verificationStatus = verificationStatus;
    if (verificationNotes !== undefined) updates.verificationNotes = sanitizeString(verificationNotes);

    const norm = typeof status === 'string' ? status.trim().toLowerCase() : '';
    if (norm === 'rejected') {
      updates.isApproved = false;
      updates.isActive = false;
      updates.verificationStatus = 'Rejected';
    } else if (norm === 'expired') {
      updates.isActive = false;
      updates.verificationStatus = 'Expired';
    } else if (norm === 'active' || norm === 'approved') {
      updates.isActive = true;
      if (isApproved === true || norm === 'approved') {
        updates.isApproved = true;
        if (!verificationStatus) {
          updates.verificationStatus = 'Verified';
          updates.lastVerificationDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    const updated = bionexaDb.updateInternship(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Internship not found.' });
      return;
    }
    auditAdminAction(req, 'ADMIN_INTERNSHIP_STATUS_UPDATED', 'internship', id, { status, isApproved });
    res.json({ success: true, internship: formatInternshipForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
};

app.patch('/api/admin/internships/:id/status', requireAdminPermission('jobs:write'), handleInternshipStatusUpdate);
app.put('/api/admin/internships/:id/status', requireAdminPermission('jobs:write'), handleInternshipStatusUpdate);

app.post('/api/admin/internships/:id/verify', requireAdminPermission('jobs:verify'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, lastVerificationDate } = req.body || {};
    const adminUser = (req as any).adminUser;

    const updated = bionexaDb.verifyInternship(
      id,
      adminUser?.email || adminUser?.username || 'admin@bionexa.org',
      status || 'Verified',
      notes || 'Verified through official institutional portal check',
      lastVerificationDate
    );
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Internship not found.' });
      return;
    }
    auditAdminAction(req, 'ADMIN_INTERNSHIP_VERIFIED', 'internship', id, { verificationStatus: updated.verificationStatus });
    res.json({ success: true, internship: formatInternshipForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

app.delete('/api/admin/internships/:id', requireAdminPermission('jobs:delete'), (req: Request, res: Response) => {
  try {
    const deleted = bionexaDb.deleteInternship(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Internship not found.' });
      return;
    }
    auditAdminAction(req, 'ADMIN_INTERNSHIP_DELETED', 'internship', req.params.id);
    res.json({ success: true, message: 'Internship deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// B. Workshops Management Endpoints
// -------------------------------------------------------------

// POST /api/admin/workshops/upload-image (Upload Workshop Banner Image)
app.post('/api/admin/workshops/upload-image', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Validation Error', message: 'Image data is required.' });
      return;
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Unsupported image format. Please upload PNG, JPG, WEBP, or GIF.'
      });
      return;
    }

    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Validation Error', message: 'Image must be 5 MB or smaller.' });
      return;
    }

    const safeBase = sanitizeString(filename || 'workshop')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40) || 'workshop';
    const storedName = `${safeBase}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    const targetFile = path.resolve(workshopUploadsDir, storedName);

    fs.writeFileSync(targetFile, buffer);

    res.status(201).json({
      success: true,
      imageUrl: `/uploads/workshops/${storedName}`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Upload Error', message: err.message });
  }
});

// POST /api/admin/workshops (Add Workshop)
app.post('/api/admin/workshops', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const body = req.body;
    const name = sanitizeString(body.title || body.name);
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !registrationLink) {
      res.status(400).json({ error: 'Validation Error', message: 'Workshop title and registrationUrl are required.' });
      return;
    }

    if (!isValidHttpUrl(registrationLink)) {
      res.status(400).json({ error: 'Validation Error', message: 'Registration URL must start with http:// or https://' });
      return;
    }

    let format: 'Online' | 'Offline' | 'Hybrid' = 'Online';
    if (body.format === 'Offline' || body.workMode === 'Offline' || body.workMode === 'In-Person') format = 'Offline';
    else if (body.format === 'Hybrid' || body.workMode === 'Hybrid') format = 'Hybrid';

    let status = 'upcoming';
    if (body.status === 'ongoing' || body.status === 'completed' || body.status === 'upcoming') {
      status = body.status;
    }

    const ws = bionexaDb.createWorkshop({
      name,
      description: sanitizeString(body.description || 'Hands-on scientific workshop.'),
      instructor: sanitizeString(body.instructor || body.organizer || 'BIO-INEXA Faculty'),
      date: sanitizeString(body.startDate || body.date || '2026-12-01'),
      time: sanitizeString(body.time || '09:30 AM - 04:30 PM IST'),
      duration: sanitizeString(body.duration || '2 Days Intensive'),
      format,
      venue: sanitizeString(body.venue || body.location || (format === 'Online' ? 'Online Live Portal' : 'Main Biotechnology Lab')),
      registrationDeadline: sanitizeString(body.registrationDeadline || body.deadline || ''),
      registrationLink,
      availability: sanitizeString(body.availability || 'Open'),
      status,
      fees: sanitizeString(body.fees || 'Free / Subsidized'),
      capacity: Number(body.capacity) || 50,
      imageUrl: sanitizeString(body.imageUrl || ''),
      featured: Boolean(body.featured),
      skillsCovered: Array.isArray(body.skillsCovered) ? body.skillsCovered : []
    });

    auditAdminAction(req, 'ADMIN_WORKSHOP_CREATED', 'workshop', ws.id, { name: ws.name });
    res.status(201).json({ success: true, workshop: formatWorkshopForAdmin(ws) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/workshops/:id (Edit Workshop)
app.put('/api/admin/workshops/:id', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Partial<DbWorkshop> = {};
    if (body.title || body.name) updates.name = sanitizeString(body.title || body.name);
    if (body.description) updates.description = sanitizeString(body.description);
    if (body.organizer || body.instructor) updates.instructor = sanitizeString(body.instructor || body.organizer);
    if (body.startDate || body.date) updates.date = sanitizeString(body.startDate || body.date);
    if (body.time) updates.time = sanitizeString(body.time);
    if (body.location || body.venue) updates.venue = sanitizeString(body.venue || body.location);
    if (body.format || body.workMode) {
      const mode = body.format || body.workMode;
      if (mode === 'Offline' || mode === 'In-Person') updates.format = 'Offline';
      else if (mode === 'Hybrid') updates.format = 'Hybrid';
      else updates.format = 'Online';
    }
    if (body.registrationDeadline !== undefined) updates.registrationDeadline = sanitizeString(body.registrationDeadline);
    if (body.registrationUrl || body.registrationLink) {
      const url = sanitizeString(body.registrationUrl || body.registrationLink);
      if (!isValidHttpUrl(url)) {
        res.status(400).json({ error: 'Validation Error', message: 'Registration URL must start with http:// or https://' });
        return;
      }
      updates.registrationLink = url;
    }
    if (body.duration) updates.duration = sanitizeString(body.duration);
    if (body.fees) updates.fees = sanitizeString(body.fees);
    if (body.capacity !== undefined) updates.capacity = Number(body.capacity);
    if (Array.isArray(body.skillsCovered)) updates.skillsCovered = body.skillsCovered;
    if (body.status) updates.status = body.status;
    if (body.availability) updates.availability = sanitizeString(body.availability);
    if (body.imageUrl !== undefined) updates.imageUrl = sanitizeString(body.imageUrl);
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);

    const updated = bionexaDb.updateWorkshop(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_WORKSHOP_UPDATED', 'workshop', id);
    res.json({ success: true, workshop: formatWorkshopForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PATCH /api/admin/workshops/:id/quick (Quick Toggle Featured / Status / Availability)
app.patch('/api/admin/workshops/:id/quick', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const updates: Partial<DbWorkshop> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.availability !== undefined) updates.availability = body.availability;
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);

    const updated = bionexaDb.updateWorkshop(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }
    auditAdminAction(req, 'ADMIN_WORKSHOP_QUICK_UPDATED', 'workshop', id);
    res.json({ success: true, workshop: formatWorkshopForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/workshops/:id (Delete Workshop)
app.delete('/api/admin/workshops/:id', requireAdminPermission('workshops:delete'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteWorkshop(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_WORKSHOP_DELETED', 'workshop', id);
    res.json({ success: true, message: `Workshop ${id} permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// C. Courses Management Endpoints
// -------------------------------------------------------------

// POST /api/admin/courses/upload-image (Upload Course Banner Image)
app.post('/api/admin/courses/upload-image', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Validation Error', message: 'Image data is required.' });
      return;
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Unsupported image format. Please upload PNG, JPG, WEBP, or GIF.'
      });
      return;
    }

    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Validation Error', message: 'Image must be 5 MB or smaller.' });
      return;
    }

    const safeBase = sanitizeString(filename || 'course')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40) || 'course';
    const storedName = `${safeBase}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    const targetFile = path.resolve(courseUploadsDir, storedName);

    fs.writeFileSync(targetFile, buffer);

    res.status(201).json({
      success: true,
      imageUrl: `/uploads/courses/${storedName}`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Upload Error', message: err.message });
  }
});

// POST /api/admin/courses (Add Course)
app.post('/api/admin/courses', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const body = req.body;
    const name = sanitizeString(body.title || body.name);
    const provider = sanitizeString(body.provider || body.instructor);
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !provider || !registrationLink) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Course title, provider/institution, and official registration URL are required.'
      });
      return;
    }

    if (!isValidHttpUrl(registrationLink)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Official registration URL must start with http:// or https://'
      });
      return;
    }

    const status = normalizeCourseStatus(body.status, body.availability);
    const certificateInfo = sanitizeString(body.certificateInfo || '');
    const curriculum = parseCurriculumInput(body.curriculum || body.syllabus);

    const course = bionexaDb.createCourse({
      name,
      provider,
      instructor: sanitizeString(body.instructor || provider),
      category: normalizeCourseCategory(body.category),
      description: sanitizeString(body.description || 'Structured biotechnology and life sciences curriculum.'),
      duration: sanitizeString(body.duration || 'Self-Paced'),
      eligibility: sanitizeString(body.eligibility || 'Life Sciences & Biotechnology Students'),
      curriculum: curriculum.length > 0 ? curriculum : ['Module 1: Core Foundations', 'Module 2: Applied Protocols'],
      deliveryMode: normalizeDeliveryMode(body.deliveryMode),
      fees: sanitizeString(body.fees || body.price || 'See Provider Portal'),
      certificateInfo,
      registrationDeadline: sanitizeString(body.registrationDeadline || 'Open / Rolling'),
      registrationLink,
      availability: status === 'closed' ? 'Closed' : 'Available',
      status,
      level: sanitizeString(body.level || 'Intermediate'),
      imageUrl: sanitizeString(body.imageUrl || ''),
      isCertificateAvailable: Boolean(certificateInfo),
      featured: Boolean(body.featured)
    });

    auditAdminAction(req, 'ADMIN_COURSE_CREATED', 'course', course.id, { name: course.name });
    res.status(201).json({ success: true, course: formatCourseForAdmin(course) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/courses/:id (Edit Course)
app.put('/api/admin/courses/:id', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Partial<DbCourse> = {};
    if (body.title || body.name) updates.name = sanitizeString(body.title || body.name);
    if (body.provider) updates.provider = sanitizeString(body.provider);
    if (body.instructor !== undefined) updates.instructor = sanitizeString(body.instructor);
    if (body.category) updates.category = normalizeCourseCategory(body.category);
    if (body.duration) updates.duration = sanitizeString(body.duration);
    if (body.level) updates.level = sanitizeString(body.level);
    if (body.deliveryMode) updates.deliveryMode = normalizeDeliveryMode(body.deliveryMode);
    if (body.eligibility !== undefined) updates.eligibility = sanitizeString(body.eligibility);
    if (body.price !== undefined || body.fees !== undefined) {
      updates.fees = sanitizeString(body.fees !== undefined ? body.fees : body.price);
    }
    if (body.description !== undefined) updates.description = sanitizeString(body.description);
    if (body.curriculum !== undefined || body.syllabus !== undefined) {
      updates.curriculum = parseCurriculumInput(body.curriculum !== undefined ? body.curriculum : body.syllabus);
    }
    if (body.certificateInfo !== undefined) {
      updates.certificateInfo = sanitizeString(body.certificateInfo);
      updates.isCertificateAvailable = Boolean(updates.certificateInfo);
    }
    if (body.registrationDeadline !== undefined) {
      updates.registrationDeadline = sanitizeString(body.registrationDeadline);
    }
    if (body.registrationUrl !== undefined || body.registrationLink !== undefined) {
      const regUrl = sanitizeString(body.registrationUrl || body.registrationLink);
      if (!isValidHttpUrl(regUrl)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Official registration URL must start with http:// or https://'
        });
        return;
      }
      updates.registrationLink = regUrl;
    }
    if (body.imageUrl !== undefined) updates.imageUrl = sanitizeString(body.imageUrl);
    if (body.status !== undefined || body.availability !== undefined) {
      const nextStatus = normalizeCourseStatus(body.status, body.availability);
      updates.status = nextStatus;
      updates.availability = nextStatus === 'closed' ? 'Closed' : 'Available';
    }
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);

    const updated = bionexaDb.updateCourse(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_COURSE_UPDATED', 'course', id);
    res.json({ success: true, course: formatCourseForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PATCH /api/admin/courses/:id/quick (Quick Toggle Featured / Status / Registration Link)
app.patch('/api/admin/courses/:id/quick', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const updates: Partial<DbCourse> = {};

    if (body.status !== undefined || body.availability !== undefined) {
      const nextStatus = normalizeCourseStatus(body.status, body.availability);
      updates.status = nextStatus;
      updates.availability = nextStatus === 'closed' ? 'Closed' : 'Available';
    }
    if (body.featured !== undefined) {
      updates.featured = Boolean(body.featured);
    }
    if (body.registrationUrl !== undefined || body.registrationLink !== undefined) {
      const url = sanitizeString(body.registrationUrl || body.registrationLink);
      if (!isValidHttpUrl(url)) {
        res.status(400).json({ error: 'Validation Error', message: 'Registration URL must start with http:// or https://' });
        return;
      }
      updates.registrationLink = url;
    }

    const updated = bionexaDb.updateCourse(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_COURSE_QUICK_UPDATED', 'course', id);
    res.json({ success: true, course: formatCourseForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/courses/:id (Delete Course)
app.delete('/api/admin/courses/:id', requireAdminPermission('courses:delete'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteCourse(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_COURSE_DELETED', 'course', id);
    res.json({ success: true, message: `Course ${id} permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// D. Website Content & Announcements
// -------------------------------------------------------------

// GET /api/admin/content
app.get('/api/admin/content', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const content = buildAdminWebsiteContent();
    res.json({
      success: true,
      ...content
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'CONTENT_FETCH_FAILED', err.message || 'Failed to load website content.');
  }
});

// PUT /api/admin/content
app.put('/api/admin/content', requireAdminPermission('content:write'), (req: Request, res: Response) => {
  try {
    const { announcements, homepageHighlights } = req.body || {};
    const adminUser = (req as any).adminUser;

    if (homepageHighlights !== undefined && typeof homepageHighlights === 'object') {
      const existing = bionexaDb.getContent('homepage_highlights', {});
      bionexaDb.setContent(
        'homepage_highlights',
        { ...existing, ...homepageHighlights },
        adminUser?.email || adminUser?.username || 'admin@bionexa.org'
      );
    }

    if (Array.isArray(announcements)) {
      const existingList = bionexaDb.getAnnouncements(false);
      const existingIds = new Set(existingList.map((a) => a.id));
      const incomingIds = new Set<string>();

      for (const ann of announcements) {
        if (!ann || typeof ann !== 'object' || !sanitizeString(ann.title)) continue;
        const cleanId = sanitizeString(ann.id);
        if (cleanId && existingIds.has(cleanId)) {
          incomingIds.add(cleanId);
          bionexaDb.updateAnnouncement(cleanId, {
            title: sanitizeString(ann.title),
            tag: sanitizeString(ann.tag) || 'Announcement',
            link: sanitizeString(ann.link) || '/opportunities',
            isActive: ann.active !== undefined ? Boolean(ann.active) : true
          });
        } else {
          const created = bionexaDb.createAnnouncement({
            id: cleanId || undefined,
            title: sanitizeString(ann.title),
            tag: sanitizeString(ann.tag) || 'Announcement',
            content: sanitizeString(ann.content) || '',
            date: sanitizeString(ann.date) || new Date().toISOString().split('T')[0],
            link: sanitizeString(ann.link) || '/opportunities',
            isActive: ann.active !== undefined ? Boolean(ann.active) : true,
            priority: Number(ann.priority) || 5
          });
          incomingIds.add(created.id);
        }
      }

      // Remove announcements explicitly deleted from the admin dashboard list
      for (const existingAnn of existingList) {
        if (!incomingIds.has(existingAnn.id)) {
          bionexaDb.deleteAnnouncement(existingAnn.id);
        }
      }
    }

    const updatedContent = buildAdminWebsiteContent();
    auditAdminAction(req, 'ADMIN_CONTENT_UPDATED', 'website_content');
    res.json({
      success: true,
      message: 'Content updated successfully in database.',
      content: updatedContent
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'CONTENT_UPDATE_FAILED', err.message || 'Failed to update content.');
  }
});

// -------------------------------------------------------------
// E. Database Backup Endpoints
// -------------------------------------------------------------

// POST /api/admin/backups (Create Point-in-Time Database Backup)
app.post('/api/admin/backups', requireAdminPermission('backups:manage'), (req: Request, res: Response) => {
  try {
    const backup = bionexaDb.createBackup();
    auditAdminAction(req, 'ADMIN_BACKUP_CREATED', 'database_backup', backup.filename, { sizeBytes: backup.sizeBytes });
    res.status(201).json({
      success: true,
      message: 'Atomic database backup generated successfully.',
      backup
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Backup Error', message: err.message });
  }
});

// GET /api/admin/backups (List Database Backups)
app.get('/api/admin/backups', requireAdminPermission('backups:manage'), (_req: Request, res: Response) => {
  try {
    const backups = bionexaDb.listBackups();
    res.json({ success: true, count: backups.length, backups });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// F. Automated Job Listing Management Endpoints
// -------------------------------------------------------------

// GET /api/admin/automated-sync/status
app.get('/api/admin/automated-sync/status', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const report = automatedJobManager.getLastReport();
    const syncHistory = automatedJobManager.getSyncHistory(50);
    res.json({
      success: true,
      lastReport: report,
      sources: automatedJobManager.getAuthorizedSources(),
      schedule: automatedJobManager.getScheduleConfig(),
      syncHistory,
      isSyncing: automatedJobManager.isSyncInProgress()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Sync Status Error', message: err.message });
  }
});

// POST /api/admin/automated-sync/run (Trigger automated ingestion across authorized feeds)
app.post('/api/admin/automated-sync/run', requireAdminPermission('sync:run'), async (req: Request, res: Response) => {
  try {
    const report = await automatedJobManager.runAutomatedSync();
    auditAdminAction(req, 'ADMIN_AUTOMATED_SYNC_RUN', 'sync', undefined, {
      newImportedCount: report.newImportedCount,
      updatedCount: report.updatedCount,
      expiredMarkedCount: report.expiredMarkedCount,
    });
    res.json({
      success: true,
      message:
        report.sourcesAttempted === 0
          ? `Deadline scan complete (${report.expiredMarkedCount} expired). No external feed credentials configured in environment.`
          : `Automated sync completed (${report.sourcesSuccessful}/${report.sourcesAttempted} sources): ${report.newImportedCount} new jobs imported (Pending Verification), ${report.updatedCount} updated, ${report.duplicatesSkippedCount} duplicates skipped, ${report.expiredMarkedCount} expired flagged.`,
      report
    });
  } catch (err: any) {
    if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
      res.status(409).json({
        error: 'Sync Already In Progress',
        code: 'SYNC_IN_PROGRESS',
        message: err.message || 'Automated ingestion is already running.'
      });
      return;
    }
    res.status(500).json({ error: 'Automated Sync Failed', message: err.message });
  }
});

// POST /api/admin/automated-sync/check-urls (Audit external application URLs for broken 404 links)
app.post('/api/admin/automated-sync/check-urls', requireAdminPermission('sync:run'), async (req: Request, res: Response) => {
  try {
    const limit = typeof req.body?.limit === 'number' ? req.body.limit : 25;
    const broken = await automatedJobManager.auditApplicationUrls(limit);
    auditAdminAction(req, 'ADMIN_URL_AUDIT_RUN', 'sync', undefined, { brokenCount: broken.length });
    res.json({
      success: true,
      message: `Application URL audit completed: found ${broken.length} broken/unreachable links.`,
      brokenCount: broken.length,
      broken
    });
  } catch (err: any) {
    res.status(500).json({ error: 'URL Audit Error', message: err.message });
  }
});

// POST /api/admin/automated-sync/expire (Force re-eval of all vacancy expiry deadlines)
app.post('/api/admin/automated-sync/expire', requireAdminPermission('sync:run'), (req: Request, res: Response) => {
  try {
    const count = automatedJobManager.markExpiredListings(true);
    auditAdminAction(req, 'ADMIN_EXPIRY_SCAN_RUN', 'job', undefined, { expiredCount: count });
    res.json({
      success: true,
      message: `Scanned all listings: ${count} expired listings updated.`,
      expiredCount: count
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Expiry Scan Error', message: err.message });
  }
});

// GET /api/admin/google-sheets/status (Server-side Google Sheets configuration & sync diagnostics)
app.get('/api/admin/google-sheets/status', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const config = automatedJobManager.getGoogleSheetsConfig();
    const status = automatedJobManager.getGoogleSheetsStatus();
    const syncHistory = automatedJobManager
      .getSyncHistory(50)
      .filter((entry) => entry.sourceId === 'feed-google-sheets');
    res.json({
      success: true,
      config,
      status,
      syncHistory,
      isSyncing: automatedJobManager.isSyncInProgress(),
      persistentDbConfigured: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Google Sheets Status Error', message: err.message });
  }
});

// POST /api/admin/google-sheets/sync (Trigger server-side Google Sheets sync into Pending Verification queue)
app.post('/api/admin/google-sheets/sync', requireAdminPermission('sync:run'), async (req: Request, res: Response) => {
  try {
    const report = await automatedJobManager.runGoogleSheetsSync();
    auditAdminAction(req, 'ADMIN_GOOGLE_SHEETS_SYNC', 'sync', undefined, {
      mode: report.mode,
      rowsFetched: report.rowsFetched,
      importedCount: report.importedCount,
      updatedCount: report.updatedCount,
      duplicatesSkippedCount: report.duplicatesSkippedCount,
      invalidRowsCount: report.invalidRowsCount,
      error: report.error || null,
    });

    const message = !report.configured
      ? 'Google Sheets API credentials or endpoint are not configured on the server. Existing approved database records remain accessible.'
      : report.error && report.rowsFetched === 0
      ? `Google Sheets sync error: ${report.error}. Existing database records remain intact.`
      : `Google Sheets sync complete (${report.mode}): fetched ${report.rowsFetched} row(s), imported ${report.importedCount} (Pending Verification), updated ${report.updatedCount}, skipped ${report.duplicatesSkippedCount} duplicate(s), rejected ${report.invalidRowsCount} invalid row(s).`;

    res.json({
      success: !report.error || report.importedCount > 0 || report.updatedCount > 0,
      message,
      report,
    });
  } catch (err: any) {
    if (err instanceof SyncInProgressError || err?.code === 'SYNC_IN_PROGRESS') {
      res.status(409).json({
        error: 'Sync Already In Progress',
        code: 'SYNC_IN_PROGRESS',
        message: err.message || 'Synchronization is already running.'
      });
      return;
    }
    res.status(500).json({ error: 'Google Sheets Sync Failed', message: err.message });
  }
});

// -------------------------------------------------------------
// G. Admin Compliance, Privacy & Takedown Request Endpoints
// -------------------------------------------------------------

app.get('/api/admin/compliance-requests', requireAdminPermission('compliance:manage'), (req: Request, res: Response) => {
  try {
    const requestType = typeof req.query.requestType === 'string' ? req.query.requestType : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const requests = bionexaDb.getComplianceRequests({ requestType, status });
    res.json({ success: true, count: requests.length, requests });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

app.patch('/api/admin/compliance-requests/:id', requireAdminPermission('compliance:manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = sanitizeString(req.body?.status) as any;
    const resolutionNotes =
      req.body?.resolutionNotes !== undefined ? sanitizeString(req.body.resolutionNotes) : undefined;
    const allowedStatuses = ['Pending', 'In Review', 'Resolved', 'Action Taken'];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'Validation Error', message: 'Invalid status value.' });
      return;
    }
    const updated = bionexaDb.updateComplianceRequestStatus(id, status, resolutionNotes);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Compliance request not found.' });
      return;
    }
    auditAdminAction(req, 'ADMIN_COMPLIANCE_UPDATED', 'compliance_request', id, { status });
    res.json({ success: true, request: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

app.delete('/api/admin/compliance-requests/:id', requireAdminPermission('compliance:manage'), (req: Request, res: Response) => {
  try {
    const deleted = bionexaDb.deleteComplianceRequest(req.params.id);
    if (!deleted) {
      sendApiError(res, 404, 'Not Found', 'COMPLIANCE_REQUEST_NOT_FOUND', 'Compliance request not found.');
      return;
    }
    auditAdminAction(req, 'ADMIN_COMPLIANCE_DELETED', 'compliance_request', req.params.id);
    res.json({ success: true, message: 'Compliance request deleted.' });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'COMPLIANCE_DELETE_FAILED', err.message || 'Failed to delete compliance request.');
  }
});

// -------------------------------------------------------------
// H. Admin Submitted Opportunities Moderation & Contact Inbox
// -------------------------------------------------------------

app.get('/api/admin/opportunities', requireAdminPermission('opportunities:moderate'), (req: Request, res: Response) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const items = bionexaDb.getSubmittedOpportunities({ type, search });
    res.json({ success: true, count: items.length, opportunities: items });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'ADMIN_OPPS_FAILED', err.message || 'Failed to retrieve submitted opportunities.');
  }
});

app.patch('/api/admin/opportunities/:id', requireAdminPermission('opportunities:moderate'), (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updates: any = {};

    if (body.title !== undefined && sanitizeString(body.title)) updates.title = sanitizeString(body.title);
    if (body.organization !== undefined && sanitizeString(body.organization)) updates.organization = sanitizeString(body.organization);
    if (body.type !== undefined && sanitizeString(body.type)) updates.type = sanitizeString(body.type);
    if (body.subCategory !== undefined) updates.subCategory = sanitizeString(body.subCategory);
    if (body.description !== undefined) updates.description = sanitizeString(body.description);
    if (body.location !== undefined) updates.location = sanitizeString(body.location);
    if (body.workMode !== undefined) updates.workMode = sanitizeString(body.workMode);
    if (body.experience !== undefined) updates.experience = sanitizeString(body.experience);
    if (body.qualification !== undefined) updates.qualification = sanitizeString(body.qualification);
    if (Array.isArray(body.branches)) updates.branches = body.branches;
    if (Array.isArray(body.skills)) updates.skills = body.skills;
    if (body.salaryOrStipend !== undefined) updates.salaryOrStipend = sanitizeString(body.salaryOrStipend);
    if (body.deadline !== undefined) updates.deadline = sanitizeString(body.deadline);
    if (body.sourceName !== undefined) updates.sourceName = sanitizeString(body.sourceName);
    if (body.sourceUrl !== undefined) updates.sourceUrl = sanitizeString(body.sourceUrl);
    if (body.contactEmail !== undefined) updates.contactEmail = sanitizeString(body.contactEmail);
    if (body.applicationUrl !== undefined) {
      const url = sanitizeString(body.applicationUrl);
      if (!isValidHttpUrl(url)) {
        sendApiError(res, 400, 'Validation Error', 'INVALID_URL', 'Application URL must start with http:// or https://');
        return;
      }
      updates.applicationUrl = url;
    }

    if (body.isApproved !== undefined) updates.isApproved = Boolean(body.isApproved);
    if (typeof body.status === 'string' && body.status.trim()) {
      updates.status = body.status.trim();
      if (updates.status === 'Rejected') updates.isApproved = false;
      else if (updates.status === 'Active' || updates.status === 'Approved') updates.isApproved = true;
    }

    const updated = bionexaDb.updateSubmittedOpportunity(req.params.id, updates);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'OPPORTUNITY_NOT_FOUND', 'Submitted opportunity not found.');
      return;
    }
    auditAdminAction(req, 'ADMIN_OPPORTUNITY_MODERATED', 'submitted_opportunity', req.params.id, {
      status: updated.status,
      isApproved: updated.isApproved,
    });
    res.json({ success: true, opportunity: updated });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'ADMIN_OPP_UPDATE_FAILED', err.message || 'Failed to moderate submitted opportunity.');
  }
});

app.delete('/api/admin/opportunities/:id', requireAdminPermission('opportunities:moderate'), (req: Request, res: Response) => {
  try {
    const deleted = bionexaDb.deleteSubmittedOpportunity(req.params.id);
    if (!deleted) {
      sendApiError(res, 404, 'Not Found', 'OPPORTUNITY_NOT_FOUND', 'Submitted opportunity not found.');
      return;
    }
    auditAdminAction(req, 'ADMIN_OPPORTUNITY_DELETED', 'submitted_opportunity', req.params.id);
    res.json({ success: true, message: 'Submitted opportunity deleted.' });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'ADMIN_OPP_DELETE_FAILED', err.message || 'Failed to delete submitted opportunity.');
  }
});

app.get('/api/admin/contact-messages', requireAdminPermission('inbox:read'), (_req: Request, res: Response) => {
  try {
    const messages = bionexaDb.getContactMessages();
    res.json({ success: true, count: messages.length, messages });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'CONTACT_INBOX_FAILED', err.message || 'Failed to retrieve contact messages.');
  }
});

// -------------------------------------------------------------
// I. Authorized Record Export Endpoint (CSV / JSON)
// -------------------------------------------------------------

app.get('/api/admin/export', requireAdminPermission('dashboard:read'), (req: Request, res: Response) => {
  try {
    const datasetRaw = typeof req.query.dataset === 'string' ? req.query.dataset.trim().toLowerCase() : 'jobs';
    const formatRaw = typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'csv';

    if (!isValidExportDataset(datasetRaw)) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_EXPORT_DATASET', `Allowed datasets: ${ADMIN_EXPORT_DATASETS.join(', ')}`);
      return;
    }
    if (formatRaw !== 'csv' && formatRaw !== 'json') {
      sendApiError(res, 400, 'Validation Error', 'INVALID_EXPORT_FORMAT', 'Export format must be csv or json.');
      return;
    }

    const adminUser = (req as any).adminUser as AdminUser | undefined;
    const perms = adminUser?.permissions || [];
    if (!hasExportDatasetPermission(perms, datasetRaw)) {
      sendApiError(res, 403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS', `You do not have authorization to export '${datasetRaw}'.`);
      return;
    }

    const dataset: AdminExportDataset = datasetRaw;
    const dateStamp = new Date().toISOString().split('T')[0];

    const buildPayloadForDataset = (ds: Exclude<AdminExportDataset, 'all'>) => {
      switch (ds) {
        case 'jobs': {
          const rows = bionexaDb.getAllJobsAdmin().map((j) => ({
            id: j.id,
            title: j.title,
            employer: j.employer,
            sector: j.sector,
            location: j.location,
            employmentType: j.employmentType,
            salary: j.salary,
            verificationStatus: j.verificationStatus,
            isApproved: j.isApproved ? 'Yes' : 'No',
            isActive: j.isActive ? 'Active' : 'Inactive',
            expiryDate: j.expiryDate,
            applicationUrl: j.applicationUrl,
            source: j.source,
            updatedAt: j.updatedAt,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'title', header: 'Title' },
              { key: 'employer', header: 'Employer' },
              { key: 'sector', header: 'Sector' },
              { key: 'location', header: 'Location' },
              { key: 'employmentType', header: 'Type' },
              { key: 'salary', header: 'Compensation' },
              { key: 'verificationStatus', header: 'Verification Status' },
              { key: 'isApproved', header: 'Approved' },
              { key: 'isActive', header: 'Active' },
              { key: 'expiryDate', header: 'Deadline' },
              { key: 'applicationUrl', header: 'Application URL' },
              { key: 'source', header: 'Source' },
              { key: 'updatedAt', header: 'Updated At' },
            ],
          };
        }
        case 'internships': {
          const rows = bionexaDb.getAllInternshipsAdmin().map((i) => ({
            id: i.id,
            title: i.title,
            organization: i.organization,
            category: i.category,
            location: i.location,
            workMode: i.workMode,
            stipend: i.stipend,
            duration: i.duration,
            deadline: i.deadline,
            verificationStatus: i.verificationStatus,
            isApproved: i.isApproved ? 'Yes' : 'No',
            applicationUrl: i.applicationUrl,
            updatedAt: i.updatedAt,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'title', header: 'Title' },
              { key: 'organization', header: 'Organization' },
              { key: 'category', header: 'Category' },
              { key: 'location', header: 'Location' },
              { key: 'workMode', header: 'Mode' },
              { key: 'stipend', header: 'Stipend' },
              { key: 'duration', header: 'Duration' },
              { key: 'deadline', header: 'Deadline' },
              { key: 'verificationStatus', header: 'Verification Status' },
              { key: 'isApproved', header: 'Approved' },
              { key: 'applicationUrl', header: 'Application URL' },
              { key: 'updatedAt', header: 'Updated At' },
            ],
          };
        }
        case 'workshops': {
          const rows = bionexaDb.getWorkshops(false).map((w) => ({
            id: w.id,
            name: w.name,
            instructor: w.instructor,
            date: w.date,
            format: w.format,
            venue: w.venue,
            fees: w.fees,
            status: w.status,
            availability: w.availability,
            registrationDeadline: w.registrationDeadline,
            registrationLink: w.registrationLink,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'name', header: 'Title' },
              { key: 'instructor', header: 'Organizer' },
              { key: 'date', header: 'Date' },
              { key: 'format', header: 'Format' },
              { key: 'venue', header: 'Venue' },
              { key: 'fees', header: 'Fees' },
              { key: 'status', header: 'Status' },
              { key: 'availability', header: 'Availability' },
              { key: 'registrationDeadline', header: 'Deadline' },
              { key: 'registrationLink', header: 'Registration URL' },
            ],
          };
        }
        case 'courses': {
          const rows = bionexaDb.getCourses(false).map((c) => ({
            id: c.id,
            name: c.name,
            provider: c.provider,
            category: c.category,
            deliveryMode: c.deliveryMode,
            duration: c.duration,
            level: c.level,
            fees: c.fees,
            status: c.status,
            registrationLink: c.registrationLink,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'name', header: 'Course Title' },
              { key: 'provider', header: 'Provider' },
              { key: 'category', header: 'Category' },
              { key: 'deliveryMode', header: 'Delivery Mode' },
              { key: 'duration', header: 'Duration' },
              { key: 'level', header: 'Level' },
              { key: 'fees', header: 'Fees' },
              { key: 'status', header: 'Status' },
              { key: 'registrationLink', header: 'Registration URL' },
            ],
          };
        }
        case 'submissions': {
          const rows = bionexaDb.getSubmittedOpportunities({ onlyApproved: false }).map((s) => ({
            id: s.id,
            title: s.title,
            organization: s.organization,
            type: s.type,
            location: s.location,
            workMode: s.workMode,
            status: s.status,
            isApproved: s.isApproved ? 'Yes' : 'No',
            deadline: s.deadline,
            contactEmail: s.contactEmail,
            applicationUrl: s.applicationUrl,
            createdAt: s.createdAt,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'title', header: 'Title' },
              { key: 'organization', header: 'Organization' },
              { key: 'type', header: 'Type' },
              { key: 'location', header: 'Location' },
              { key: 'workMode', header: 'Work Mode' },
              { key: 'status', header: 'Moderation Status' },
              { key: 'isApproved', header: 'Approved' },
              { key: 'deadline', header: 'Deadline' },
              { key: 'contactEmail', header: 'Contact Email' },
              { key: 'applicationUrl', header: 'Application URL' },
              { key: 'createdAt', header: 'Submitted At' },
            ],
          };
        }
        case 'reports': {
          const rows = bionexaDb.getComplianceRequests().map((r) => ({
            referenceId: r.referenceId,
            requestType: r.requestType,
            subCategory: r.subCategory,
            requesterName: r.requesterName,
            requesterEmail: r.requesterEmail,
            targetTitleOrUrl: r.targetTitleOrUrl,
            status: r.status,
            resolutionNotes: r.resolutionNotes,
            createdAt: r.createdAt,
          }));
          return {
            rows,
            columns: [
              { key: 'referenceId', header: 'Reference ID' },
              { key: 'requestType', header: 'Type' },
              { key: 'subCategory', header: 'Category' },
              { key: 'requesterName', header: 'Requester' },
              { key: 'requesterEmail', header: 'Email' },
              { key: 'targetTitleOrUrl', header: 'Target Listing / URL' },
              { key: 'status', header: 'Status' },
              { key: 'resolutionNotes', header: 'Resolution Notes' },
              { key: 'createdAt', header: 'Submitted At' },
            ],
          };
        }
        case 'audit_logs': {
          const rows = bionexaDb.getAdminAuditLogs(500).map((a) => ({
            id: a.id,
            actorUsername: a.actorUsername,
            action: a.action,
            entityType: a.entityType,
            entityId: a.entityId,
            ipAddress: a.ipAddress,
            details: JSON.stringify(a.details || {}),
            createdAt: a.createdAt,
          }));
          return {
            rows,
            columns: [
              { key: 'id', header: 'Log ID' },
              { key: 'actorUsername', header: 'Administrator' },
              { key: 'action', header: 'Action' },
              { key: 'entityType', header: 'Entity Type' },
              { key: 'entityId', header: 'Entity ID' },
              { key: 'ipAddress', header: 'IP Address' },
              { key: 'details', header: 'Details' },
              { key: 'createdAt', header: 'Timestamp' },
            ],
          };
        }
      }
    };

    if (dataset === 'all') {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        exportedBy: adminUser?.username || 'admin',
        jobs: buildPayloadForDataset('jobs').rows,
        internships: buildPayloadForDataset('internships').rows,
        workshops: buildPayloadForDataset('workshops').rows,
        courses: buildPayloadForDataset('courses').rows,
        submissions: buildPayloadForDataset('submissions').rows,
        reports: buildPayloadForDataset('reports').rows,
        auditLogs: buildPayloadForDataset('audit_logs').rows,
      };
      auditAdminAction(req, 'ADMIN_RECORDS_EXPORTED', 'export', 'all', { format: 'json' });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bio-inexa-export-all-${dateStamp}.json"`);
      res.send(JSON.stringify(snapshot, null, 2));
      return;
    }

    const { rows, columns } = buildPayloadForDataset(dataset);
    auditAdminAction(req, 'ADMIN_RECORDS_EXPORTED', 'export', dataset, { format: formatRaw, count: rows.length });

    if (formatRaw === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bio-inexa-${dataset}-${dateStamp}.json"`);
      res.send(JSON.stringify({ dataset, count: rows.length, exportedAt: new Date().toISOString(), records: rows }, null, 2));
      return;
    }

    const csvContent = formatRecordsAsCsv(columns, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bio-inexa-${dataset}-${dateStamp}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    sendApiError(res, 500, 'Export Error', 'ADMIN_EXPORT_FAILED', err.message || 'Failed to export records.');
  }
});

// JSON 404 catch-all for unrecognized /api/* endpoints (must precede SPA fallback)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    code: 'API_ROUTE_NOT_FOUND',
    message: `API endpoint '${req.originalUrl}' does not exist.`,
    path: req.originalUrl,
  });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BIO-INEXA] Secure Server running at http://0.0.0.0:${PORT}`);
    console.log(`[BIO-INEXA] Admin authentication status: ${isAdminAuthConfigured() ? 'Configured (Scrypt + HttpOnly Cookie)' : 'Not configured — set ADMIN_USERNAME & ADMIN_PASSWORD/ADMIN_PASSWORD_HASH or run scripts/admin-password-reset.ts'}`);
    console.log(`[BIO-INEXA] Database engine active with WAL journaling and atomic backups.`);
    
    // Initial expiry audit on server boot
    try {
      const expiredCount = automatedJobManager.markExpiredListings();
      if (expiredCount > 0) {
        console.log(`[AUTOMATED-SYNC] Initial scan marked ${expiredCount} expired jobs.`);
      }
    } catch (err) {
      console.error('[AUTOMATED-SYNC] Initial expiry scan failed:', err);
    }

    // Schedule automated source checks every 6 hours by default (configurable via SYNC_INTERVAL_HOURS)
    const schedule = automatedJobManager.getScheduleConfig();
    setInterval(() => {
      if (automatedJobManager.isSyncInProgress()) {
        console.log('[AUTOMATED-SYNC] Skipping scheduled trigger because a sync job is already active.');
        return;
      }
      console.log(`[AUTOMATED-SYNC] Executing scheduled ${schedule.intervalHours}-hour background ingestion check...`);
      automatedJobManager.runAutomatedSync()
        .then(r => console.log(`[AUTOMATED-SYNC] Scheduled sync completed. Sources: ${r.sourcesSuccessful}/${r.sourcesAttempted}, New: ${r.newImportedCount}, Updated: ${r.updatedCount}, Expired: ${r.expiredMarkedCount}`))
        .catch(err => console.error('[AUTOMATED-SYNC] Scheduled sync error:', err));
    }, schedule.intervalMs);
  });
}

startServer();
