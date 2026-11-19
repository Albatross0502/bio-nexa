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
  COURSE_CATEGORIES,
  classifyCoursePricing,
  isCourseExpired,
  normalizeCourseApprovalStatus,
  normalizeCourseCategory,
  normalizeCourseProviderType,
  normalizeCourseStatus,
  normalizeDeliveryMode,
  parseCurriculumInput,
  resolveCourseCategory,
  validateCourseRegistrationUrl,
  validateCourseSubmissionPayload
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
  classifyInternshipCompensation,
  isInternshipDeadlineExpired,
  validateInternshipApplicationUrl,
  validateInternshipSubmissionPayload,
} from './src/services/internships/internshipHelpers.js';
import {
  isWorkshopExpired,
  normalizeWorkshopApprovalStatus,
  validateWorkshopRegistrationUrl,
  validateWorkshopSubmissionPayload,
} from './src/services/workshops/workshopHelpers.js';

import {
  getRuntimeEnvironmentConfig,
  resolveCorsOrigin,
} from './src/config/environment.js';
import {
  STUDENT_SESSION_COOKIE,
  STUDENT_SESSION_DURATION_MS,
  StudentAuthRateLimiter,
  createEmailVerificationToken,
  createStudentPasswordResetToken,
  createStudentSessionToken,
  hasStudentPermission,
  hashStudentPassword,
  maskIpAddress,
  normalizeStudentEmail,
  toSafeStudentProfile,
  validateDeletionRequestInput,
  validateStudentPasswordStrength,
  validateStudentProfileUpdateInput,
  validateStudentRegistrationInput,
  verifyStudentPassword,
  type StudentPermission,
} from './src/services/student/studentAuthService.js';
import {
  COMPANY_RESET_TOKEN_TTL_MS,
  COMPANY_SESSION_COOKIE,
  COMPANY_SESSION_TTL_MS,
  COMPANY_VERIFY_TOKEN_TTL_MS,
  CompanyAuthRateLimiter,
  evaluatePasswordStrength as evaluateCompanyPasswordStrength,
  generateOpaqueToken as generateCompanyOpaqueToken,
  hasCompanyPermission,
  hashCompanyPassword,
  hashOpaqueToken as hashCompanyOpaqueToken,
  normalizeCompanyEmail,
  resolveEmployerJobSubmissionPolicy,
  toSafeCompanyProfile,
  validateCompanyJobInput,
  validateCompanyProfileUpdateInput,
  validateCompanyRegistrationInput,
  validateEmployerVerificationSubmission,
  verifyCompanyPassword,
  type CompanyPermission,
} from './src/services/company/companyAuthService.js';

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
      if (req.cookies?.[STUDENT_SESSION_COOKIE]) {
        sendApiError(
          res,
          403,
          'Forbidden',
          'ROLE_FORBIDDEN',
          'Student accounts are not permitted to access administrator APIs.'
        );
        return;
      }
      if (req.cookies?.[COMPANY_SESSION_COOKIE]) {
        sendApiError(
          res,
          403,
          'Forbidden',
          'ROLE_FORBIDDEN',
          'Company accounts are not permitted to access administrator APIs.'
        );
        return;
      }
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

// GET /api/internships (public verified & active internships from DB with full Phase 11 filtering)
app.get('/api/internships', (req: Request, res: Response) => {
  try {
    // Keep past-deadline internships accurately marked Expired without deleting records
    bionexaDb.expirePastDeadlineInternships();

    const { search, category, location, mode, compensation, paid, includeExpired } = req.query;
    const compParam =
      typeof compensation === 'string' && compensation !== 'all'
        ? compensation
        : paid === 'true'
        ? 'paid'
        : paid === 'false'
        ? 'unpaid'
        : undefined;
    const showExpired = includeExpired === 'true' || includeExpired === '1';

    const rows = bionexaDb.getInternships({
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' && category !== 'all' ? category : undefined,
      location: typeof location === 'string' && location !== 'all' ? location : undefined,
      mode: typeof mode === 'string' && mode !== 'all' ? mode : undefined,
      compensation: compParam,
      includeExpired: showExpired,
      onlyActive: !showExpired,
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

// POST /api/internships/submit (Public internship submission -> strictly Pending Verification in DB)
app.post('/api/internships/submit', (req: Request, res: Response) => {
  try {
    const validation = validateInternshipSubmissionPayload(req.body || {});
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({
        error: 'Validation Error',
        code: 'INVALID_INTERNSHIP_SUBMISSION',
        message: validation.errors.join(' '),
        errors: validation.errors,
      });
      return;
    }

    const s = validation.sanitized;
    const created = bionexaDb.createInternship({
      title: sanitizeString(s.title),
      organization: sanitizeString(s.organization),
      location: sanitizeString(s.location),
      workMode: s.workMode,
      stipend: sanitizeString(s.stipend),
      duration: sanitizeString(s.duration),
      deadline: sanitizeString(s.deadline),
      category: s.category,
      eligibility: sanitizeString(s.eligibility),
      description: sanitizeString(s.description),
      learningOutcomes: s.learningOutcomes.map((o) => sanitizeString(o)),
      skillsRequired: s.skillsRequired.map((k) => sanitizeString(k)),
      sourceName: sanitizeString(s.sourceName),
      sourceUrl: s.sourceUrl,
      applicationUrl: s.applicationUrl,
      verificationStatus: 'Pending Verification',
      verificationNotes: 'Submitted via public Internship Portal — awaiting administrator URL & institution audit.',
      lastVerificationDate: '',
      isApproved: false,
      isActive: true,
      featured: false,
    });

    res.status(201).json({
      success: true,
      message: 'Internship submitted for administrator verification. It will appear publicly only after official URL and eligibility review.',
      internship: formatInternshipForPublic(created),
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'INTERNSHIP_SUBMIT_FAILED', err.message || 'Failed to submit internship.');
  }
});

// GET /api/internships/:id
app.get('/api/internships/:id', (req: Request, res: Response) => {
  try {
    const row = bionexaDb.getInternshipById(req.params.id);
    if (!row || !row.isApproved) {
      sendApiError(res, 404, 'Not Found', 'INTERNSHIP_NOT_FOUND', 'Internship listing not found.');
      return;
    }
    res.json({ success: true, internship: formatInternshipForPublic(row) });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'INTERNSHIP_FETCH_FAILED', err.message || 'Failed to load internship.');
  }
});

// GET /api/workshops (supports status, format, category, featured, search, includeExpired, page, limit)
app.get('/api/workshops', (req: Request, res: Response) => {
  try {
    bionexaDb.expirePastWorkshops();
    const { status, format, category, featured, search, includeExpired } = req.query;
    const allWorkshops = bionexaDb.getWorkshops({
      onlyApproved: true,
      status: typeof status === 'string' && status !== 'all' ? status : undefined,
      format: typeof format === 'string' && format !== 'all' ? format : undefined,
      category: typeof category === 'string' && category !== 'all' ? category : undefined,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      search: typeof search === 'string' ? search : undefined,
      includeExpired: includeExpired === 'false' ? false : true,
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

// POST /api/workshops/submit (Public workshop submission — queued as pending for admin approval)
app.post('/api/workshops/submit', (req: Request, res: Response) => {
  try {
    const validation = validateWorkshopSubmissionPayload(req.body || {});
    if (!validation.valid || !validation.sanitized) {
      sendApiError(
        res,
        400,
        'Validation Error',
        'INVALID_WORKSHOP_SUBMISSION',
        validation.errors.join(' ')
      );
      return;
    }

    const s = validation.sanitized;
    const created = bionexaDb.createWorkshop({
      name: s.title,
      description: s.description,
      organizer: s.organizer,
      instructor: s.instructor,
      category: s.category,
      date: s.date,
      time: s.time,
      duration: s.duration,
      format: s.format,
      venue: s.venue,
      registrationDeadline: s.registrationDeadline,
      registrationLink: s.registrationUrl,
      availability: 'Open',
      status: 'upcoming',
      fees: s.fees,
      capacity: s.capacity ?? 0,
      imageUrl: s.imageUrl,
      featured: false,
      skillsCovered: s.skillsCovered,
      approvalStatus: 'pending',
      isApproved: false,
    });

    res.status(201).json({
      success: true,
      status: 'pending',
      message: 'Workshop submitted for editorial review. It will appear publicly only after administrator approval.',
      workshop: formatWorkshopForAdmin(created),
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Database Error', 'WORKSHOP_SUBMIT_FAILED', err.message || 'Failed to submit workshop.');
  }
});

// GET /api/workshops/:id
app.get('/api/workshops/:id', (req: Request, res: Response) => {
  try {
    bionexaDb.expirePastWorkshops();
    const workshop = bionexaDb.getWorkshopById(req.params.id);
    if (!workshop || !workshop.isApproved) {
      sendApiError(res, 404, 'Not Found', 'WORKSHOP_NOT_FOUND', 'Workshop not found.');
      return;
    }
    res.json({ success: true, workshop: formatWorkshopForAdmin(workshop) });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'WORKSHOP_FETCH_FAILED', err.message || 'Failed to retrieve workshop.');
  }
});

// GET /api/courses/categories
app.get('/api/courses/categories', (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      categories: bionexaDb.getCourseCategories()
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'COURSE_CATEGORIES_FETCH_FAILED', err.message || 'Failed to retrieve course categories.');
  }
});

// POST /api/courses/submit (Public third-party course submission -> pending administrator approval)
app.post('/api/courses/submit', (req: Request, res: Response) => {
  try {
    const validation = validateCourseSubmissionPayload(req.body || {});
    if (!validation.valid || !validation.sanitized) {
      sendApiError(
        res,
        400,
        'Validation Error',
        'INVALID_COURSE_SUBMISSION',
        validation.errors.join(' ')
      );
      return;
    }

    const s = validation.sanitized;
    const managedCategories = bionexaDb.getCourseCategories();
    const created = bionexaDb.createCourse({
      name: s.name,
      provider: s.provider,
      providerType: 'third_party',
      instructor: s.instructor,
      category: resolveCourseCategory(s.category, managedCategories),
      description: s.description,
      duration: s.duration,
      eligibility: s.eligibility,
      curriculum: s.curriculum,
      deliveryMode: s.deliveryMode,
      fees: s.fees,
      pricingType: s.pricingType,
      certificateInfo: s.certificateInfo,
      registrationDeadline: s.registrationDeadline,
      registrationLink: s.registrationLink,
      availability: 'Available',
      status: 'available',
      approvalStatus: 'pending',
      isApproved: false,
      level: s.level,
      imageUrl: s.imageUrl,
      isCertificateAvailable: s.isCertificateAvailable,
      featured: false
    });

    res.status(201).json({
      success: true,
      status: 'pending',
      message: 'Course submitted for editorial review. It will appear publicly only after administrator approval.',
      course: formatCourseForAdmin(created)
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'COURSE_SUBMIT_FAILED', err.message || 'Failed to submit course.');
  }
});

// GET /api/courses (supports category, status, pricingType, providerType, includeExpired, featured, search, onlyAvailable, page, limit)
app.get('/api/courses', (req: Request, res: Response) => {
  try {
    bionexaDb.expirePastCourses();
    const { category, status, pricingType, providerType, includeExpired, featured, search, onlyAvailable } = req.query;
    const allCourses = bionexaDb.getCourses({
      onlyApproved: true,
      onlyAvailable: onlyAvailable === 'true',
      category: typeof category === 'string' && category !== 'all' ? category : undefined,
      status: typeof status === 'string' && status !== 'all' ? status : undefined,
      pricingType: typeof pricingType === 'string' && pricingType !== 'all' ? pricingType : undefined,
      providerType: typeof providerType === 'string' && providerType !== 'all' ? providerType : undefined,
      includeExpired: includeExpired === 'false' ? false : true,
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
      categories: bionexaDb.getCourseCategories(),
      courses: paginated.items
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Internal Server Error', 'COURSES_FETCH_FAILED', err.message || 'Failed to retrieve courses.');
  }
});

// GET /api/courses/:id
app.get('/api/courses/:id', (req: Request, res: Response) => {
  try {
    bionexaDb.expirePastCourses();
    const course = bionexaDb.getCourseById(req.params.id);
    if (!course || !course.isApproved || course.approvalStatus !== 'approved') {
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

    // 2. Approved DB Workshops
    bionexaDb.expirePastWorkshops();
    const dbWorkshops = bionexaDb.getWorkshops({ onlyApproved: true }).map((w) => {
      const isClosed = isWorkshopExpired({
        status: w.status,
        availability: w.availability,
        date: w.date,
        registrationDeadline: w.registrationDeadline,
      });
      const branches = matchBranchesForOpportunity({
        title: w.name,
        description: `${w.description} ${w.category || ''}`,
        skills: w.skillsCovered
      });
      const hostName = w.organizer || w.instructor || '';
      return {
        id: w.id,
        title: w.name,
        organization: hostName,
        type: 'workshop',
        subCategory: w.category || 'Biotechnology Workshops',
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: ['Life Sciences Students & Researchers'],
        skills: w.skillsCovered || [],
        experience: 'Open to All',
        salaryOrStipend: w.fees || '',
        salaryTier: 'not_disclosed',
        location: w.venue,
        workMode: w.format === 'Offline' ? 'On-site' : w.format,
        deadline: w.registrationDeadline || w.date,
        postedDate: w.createdAt.split('T')[0],
        sourceName: hostName || 'Official Workshop Portal',
        sourceUrl: w.registrationLink,
        sourceId: 'bionexa-db-workshops',
        lastVerifiedDate: w.updatedAt.split('T')[0],
        status: isClosed ? 'Closed' : 'Active',
        isApproved: w.isApproved,
        isVerified: w.isApproved,
        dataCollectionTimestamp: w.updatedAt,
        attributionRequirements: 'Official Workshop Registration Portal',
        description: w.description,
        applicationUrl: w.registrationLink,
        featured: w.featured,
        createdAt: w.createdAt,
        workshopDetails: {
          mode: w.format.toLowerCase(),
          registrationFee: w.fees || '',
          fees: w.fees || '',
          dates: w.date || '',
          certificateProvided: false,
          certificateAvailable: false,
          speakerOrTrainer: w.instructor || ''
        }
      };
    });

    // 3. Approved DB Courses
    bionexaDb.expirePastCourses();
    const dbCourses = bionexaDb.getCourses({ onlyApproved: true }).map((c) => {
      const expired = isCourseExpired({ registrationDeadline: c.registrationDeadline });
      const branches = matchBranchesForOpportunity({
        title: c.name,
        description: `${c.description} ${c.category}`,
        skills: c.curriculum
      });
      return {
        id: c.id,
        title: c.name,
        organization: c.provider || '',
        type: 'course',
        subCategory: c.category || 'Biotechnology',
        category: c.category,
        branches: branches.length > 0 ? branches : ['biotech'],
        qualifications: c.eligibility ? [c.eligibility] : [],
        eligibility: c.eligibility || '',
        skills: c.curriculum || [],
        experience: c.level || '',
        salaryOrStipend: c.fees || '',
        fees: c.fees || '',
        duration: c.duration || '',
        salaryTier: c.pricingType === 'free' ? 'free' : 'paid',
        location: c.deliveryMode || 'Online (Self-Paced)',
        workMode: (c.deliveryMode || '').toLowerCase().includes('hybrid') ? 'Hybrid' : 'Online',
        deadline: c.registrationDeadline || '',
        postedDate: c.createdAt.split('T')[0],
        sourceName: c.providerType === 'bionexa' ? (c.provider || 'BIO-INEXA') : (c.provider || 'Third-Party Course Provider'),
        sourceUrl: c.registrationLink,
        sourceId: 'bionexa-db-courses',
        lastVerifiedDate: c.updatedAt.split('T')[0],
        status: expired ? 'Expired' : c.status === 'closed' ? 'Closed' : 'Active',
        isApproved: c.isApproved,
        isVerified: c.isApproved,
        dataCollectionTimestamp: c.updatedAt,
        attributionRequirements: c.providerType === 'bionexa' ? 'BIO-INEXA Course Portal' : 'Official Third-Party Course Provider Portal',
        description: c.description,
        applicationUrl: c.registrationLink,
        featured: c.featured,
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
  const approvalStatus = normalizeWorkshopApprovalStatus(w.approvalStatus, w.isApproved);
  const expired = isWorkshopExpired({
    status: w.status,
    availability: w.availability,
    date: w.date,
    registrationDeadline: w.registrationDeadline,
  });
  return {
    id: w.id,
    title: w.name,
    name: w.name,
    organizer: w.organizer || '',
    instructor: w.instructor || '',
    category: w.category || '',
    location: w.venue || '',
    venue: w.venue || '',
    workMode: w.format,
    format: w.format,
    startDate: w.date || '',
    endDate: w.date || '',
    date: w.date || '',
    time: w.time || '',
    duration: w.duration || '',
    fees: w.fees || '',
    capacity: typeof w.capacity === 'number' && w.capacity > 0 ? w.capacity : null,
    registrationUrl: w.registrationLink,
    registrationLink: w.registrationLink,
    registrationDeadline: w.registrationDeadline || '',
    availability: w.availability || (expired ? 'Closed' : 'Open'),
    description: w.description || '',
    imageUrl: w.imageUrl || '',
    featured: Boolean(w.featured),
    skillsCovered: w.skillsCovered || [],
    status: expired ? 'completed' : (w.status || 'upcoming'),
    approvalStatus,
    isApproved: approvalStatus === 'approved',
    isExpired: expired,
  };
}

function formatCourseForAdmin(c: DbCourse) {
  const expired = isCourseExpired({ registrationDeadline: c.registrationDeadline });
  const status = expired ? 'closed' : normalizeCourseStatus(c.status, c.availability);
  const category = (c.category || '').trim() || normalizeCourseCategory(c.category);
  const pricingType = classifyCoursePricing(c.fees, c.pricingType);
  const providerType = normalizeCourseProviderType(c.providerType);
  const approvalStatus = normalizeCourseApprovalStatus(c.approvalStatus, c.isApproved);
  const certInfo = (c.certificateInfo || '').trim();
  return {
    id: c.id,
    title: c.name,
    name: c.name,
    provider: c.provider || '',
    providerType,
    instructor: c.instructor || '',
    category,
    duration: c.duration || '',
    level: c.level || '',
    deliveryMode: c.deliveryMode || 'Online (Self-Paced)',
    fees: c.fees || '',
    price: c.fees || '',
    pricingType,
    eligibility: c.eligibility || '',
    description: c.description || '',
    curriculum: c.curriculum || [],
    syllabus: c.curriculum || [],
    certificateInfo: certInfo,
    isCertificateAvailable: Boolean(certInfo),
    registrationDeadline: c.registrationDeadline || '',
    registrationUrl: c.registrationLink || '',
    registrationLink: c.registrationLink || '',
    imageUrl: c.imageUrl || '',
    status,
    availability: expired ? 'Expired' : status === 'closed' ? 'Closed' : 'Available',
    approvalStatus,
    isApproved: approvalStatus === 'approved',
    isExpired: expired,
    featured: Boolean(c.featured),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

function formatInternshipForPublic(intern: DbInternship) {
  const compensationType = classifyInternshipCompensation(intern.stipend);
  const expired =
    intern.verificationStatus === 'Expired' ||
    !intern.isActive ||
    isInternshipDeadlineExpired(intern.deadline);
  return {
    id: intern.id,
    slug: intern.slug || intern.id,
    title: intern.title,
    organization: intern.organization,
    location: intern.location,
    mode: intern.workMode,
    workMode: intern.workMode,
    stipend: intern.stipend,
    compensationType,
    isPaid: compensationType === 'paid',
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
    verificationStatus: expired && intern.verificationStatus !== 'Rejected' ? 'Expired' : intern.verificationStatus,
    verificationNotes: intern.verificationNotes,
    lastVerificationDate: intern.lastVerificationDate,
    isVerified: intern.isVerified && !expired,
    isApproved: intern.isApproved,
    isActive: intern.isActive && !expired,
    isExpired: expired,
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
    bionexaDb.expirePastWorkshops();
    bionexaDb.expirePastCourses();
    const rawJobs = bionexaDb.getAllJobsAdmin();
    const rawInternships = bionexaDb.getAllInternshipsAdmin();
    const rawWorkshops = bionexaDb.getWorkshops(false);
    const rawCourses = bionexaDb.getCourses(false);
    const courseCategories = bionexaDb.getCourseCategories();
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
      courseCategories,
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
    const urlCheck = validateInternshipApplicationUrl(applicationUrl);
    if (!urlCheck.valid) {
      res.status(400).json({ error: 'Validation Error', message: urlCheck.reason || 'Application URL must be a valid http:// or https:// official link.' });
      return;
    }

    // Do not mark internships as verified automatically unless explicitly verified by admin
    const verificationStatus = body.verificationStatus || 'Pending Verification';
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
      sourceUrl: sanitizeString(body.sourceUrl || urlCheck.normalizedUrl),
      applicationUrl: urlCheck.normalizedUrl,
      verificationStatus,
      verificationNotes: sanitizeString(body.verificationNotes || 'Added via BIO-INEXA Admin Portal.'),
      lastVerificationDate: sanitizeString(body.lastVerificationDate || (verificationStatus === 'Verified' ? new Date().toISOString().split('T')[0] : '')),
      isApproved,
      isActive,
      featured: Boolean(body.featured),
    });

    auditAdminAction(req, 'ADMIN_INTERNSHIP_CREATED', 'internship', created.id, { title: created.title, organization: created.organization, verificationStatus: created.verificationStatus });
    res.status(201).json({ success: true, internship: formatInternshipForAdmin(created) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

app.post('/api/admin/internships/expire-scan', requireAdminPermission('jobs:write'), (req: Request, res: Response) => {
  try {
    const result = bionexaDb.expirePastDeadlineInternships();
    auditAdminAction(req, 'ADMIN_INTERNSHIP_EXPIRE_SCAN', 'internship', undefined, result);
    res.json({
      success: true,
      ...result,
      message:
        result.expiredCount > 0
          ? `Marked ${result.expiredCount} past-deadline internship(s) as Expired.`
          : 'All active internships have valid upcoming or rolling deadlines.',
    });
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
    const body = req.body || {};
    const name = sanitizeString(body.title || body.name);
    const organizer = sanitizeString(body.organizer || '');
    const instructor = sanitizeString(body.instructor || '');
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !registrationLink) {
      res.status(400).json({ error: 'Validation Error', message: 'Workshop title and registrationUrl are required.' });
      return;
    }

    if (!organizer && !instructor) {
      res.status(400).json({ error: 'Validation Error', message: 'Organizer or instructor information is required.' });
      return;
    }

    const urlCheck = validateWorkshopRegistrationUrl(registrationLink);
    if (!urlCheck.valid) {
      res.status(400).json({ error: 'Validation Error', message: urlCheck.reason || 'Invalid registration URL.' });
      return;
    }

    let format: 'Online' | 'Offline' | 'Hybrid' = 'Online';
    if (body.format === 'Offline' || body.workMode === 'Offline' || body.workMode === 'In-Person') format = 'Offline';
    else if (body.format === 'Hybrid' || body.workMode === 'Hybrid') format = 'Hybrid';

    let status = 'upcoming';
    if (body.status === 'ongoing' || body.status === 'completed' || body.status === 'upcoming') {
      status = body.status;
    }

    let capacity = 0;
    if (body.capacity !== undefined && body.capacity !== null && body.capacity !== '') {
      const parsedCap = Number(body.capacity);
      if (!Number.isFinite(parsedCap) || parsedCap < 0) {
        res.status(400).json({ error: 'Validation Error', message: 'Capacity must be a positive number when provided.' });
        return;
      }
      capacity = Math.floor(parsedCap);
    }

    const approvalStatus = body.approvalStatus !== undefined
      ? normalizeWorkshopApprovalStatus(body.approvalStatus, body.isApproved)
      : 'approved';

    const ws = bionexaDb.createWorkshop({
      name,
      description: sanitizeString(body.description || ''),
      organizer,
      instructor,
      category: sanitizeString(body.category || ''),
      date: sanitizeString(body.startDate || body.date || ''),
      time: sanitizeString(body.time || ''),
      duration: sanitizeString(body.duration || ''),
      format,
      venue: sanitizeString(body.venue || body.location || ''),
      registrationDeadline: sanitizeString(body.registrationDeadline || body.deadline || ''),
      registrationLink: urlCheck.normalizedUrl || registrationLink,
      availability: sanitizeString(body.availability || 'Open'),
      status,
      fees: sanitizeString(body.fees || ''),
      capacity,
      imageUrl: sanitizeString(body.imageUrl || ''),
      featured: approvalStatus === 'approved' ? Boolean(body.featured) : false,
      skillsCovered: Array.isArray(body.skillsCovered) ? body.skillsCovered : [],
      approvalStatus,
      isApproved: approvalStatus === 'approved',
    });

    auditAdminAction(req, 'ADMIN_WORKSHOP_CREATED', 'workshop', ws.id, { name: ws.name, approvalStatus });
    res.status(201).json({ success: true, workshop: formatWorkshopForAdmin(ws) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/workshops/expire-scan (Automatically identify & mark expired workshops)
app.post('/api/admin/workshops/expire-scan', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const result = bionexaDb.expirePastWorkshops();
    auditAdminAction(req, 'ADMIN_WORKSHOPS_EXPIRE_SCAN', 'workshop', 'batch', {
      expiredCount: result.expiredCount,
      expiredIds: result.expiredIds,
    });
    res.json({
      success: true,
      expiredCount: result.expiredCount,
      expiredIds: result.expiredIds,
      message:
        result.expiredCount > 0
          ? `Marked ${result.expiredCount} past-date or past-deadline workshop(s) as expired/completed.`
          : 'All workshops are already up to date; no newly expired workshops found.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/workshops/:id (Edit Workshop)
app.put('/api/admin/workshops/:id', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updates: Partial<DbWorkshop> = {};
    if (body.title !== undefined || body.name !== undefined) updates.name = sanitizeString(body.title ?? body.name);
    if (body.description !== undefined) updates.description = sanitizeString(body.description);
    if (body.organizer !== undefined) updates.organizer = sanitizeString(body.organizer);
    if (body.instructor !== undefined) updates.instructor = sanitizeString(body.instructor);
    if (body.category !== undefined) updates.category = sanitizeString(body.category);
    if (body.startDate !== undefined || body.date !== undefined) updates.date = sanitizeString(body.startDate ?? body.date);
    if (body.time !== undefined) updates.time = sanitizeString(body.time);
    if (body.location !== undefined || body.venue !== undefined) updates.venue = sanitizeString(body.venue ?? body.location);
    if (body.format || body.workMode) {
      const mode = body.format || body.workMode;
      if (mode === 'Offline' || mode === 'In-Person') updates.format = 'Offline';
      else if (mode === 'Hybrid') updates.format = 'Hybrid';
      else updates.format = 'Online';
    }
    if (body.registrationDeadline !== undefined) updates.registrationDeadline = sanitizeString(body.registrationDeadline);
    if (body.registrationUrl !== undefined || body.registrationLink !== undefined) {
      const url = sanitizeString(body.registrationUrl ?? body.registrationLink);
      const urlCheck = validateWorkshopRegistrationUrl(url);
      if (!urlCheck.valid) {
        res.status(400).json({ error: 'Validation Error', message: urlCheck.reason || 'Invalid registration URL.' });
        return;
      }
      updates.registrationLink = urlCheck.normalizedUrl || url;
    }
    if (body.duration !== undefined) updates.duration = sanitizeString(body.duration);
    if (body.fees !== undefined) updates.fees = sanitizeString(body.fees);
    if (body.capacity !== undefined) {
      if (body.capacity === null || body.capacity === '') {
        updates.capacity = 0;
      } else {
        const parsedCap = Number(body.capacity);
        if (!Number.isFinite(parsedCap) || parsedCap < 0) {
          res.status(400).json({ error: 'Validation Error', message: 'Capacity must be a positive number when provided.' });
          return;
        }
        updates.capacity = Math.floor(parsedCap);
      }
    }
    if (Array.isArray(body.skillsCovered)) updates.skillsCovered = body.skillsCovered;
    if (body.status) updates.status = body.status;
    if (body.availability !== undefined) updates.availability = sanitizeString(body.availability);
    if (body.imageUrl !== undefined) updates.imageUrl = sanitizeString(body.imageUrl);
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);
    if (body.approvalStatus !== undefined) {
      const nextStatus = normalizeWorkshopApprovalStatus(body.approvalStatus);
      updates.approvalStatus = nextStatus;
      updates.isApproved = nextStatus === 'approved';
      if (nextStatus !== 'approved') updates.featured = false;
    }

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

// PATCH /api/admin/workshops/:id/status (Approve or Reject workshop submission)
app.patch('/api/admin/workshops/:id/status', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawStatus = sanitizeString(req.body?.approvalStatus || req.body?.status).toLowerCase();
    if (rawStatus !== 'approved' && rawStatus !== 'rejected' && rawStatus !== 'pending') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'approvalStatus must be one of: approved, rejected, pending.',
      });
      return;
    }

    const updates: Partial<DbWorkshop> = {
      approvalStatus: rawStatus,
      isApproved: rawStatus === 'approved',
    };
    if (rawStatus !== 'approved') {
      updates.featured = false;
    }

    const updated = bionexaDb.updateWorkshop(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_WORKSHOP_APPROVAL_UPDATED', 'workshop', id, { approvalStatus: rawStatus });
    res.json({ success: true, workshop: formatWorkshopForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PATCH /api/admin/workshops/:id/quick (Quick Toggle Featured / Status / Availability)
app.patch('/api/admin/workshops/:id/quick', requireAdminPermission('workshops:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
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

// GET /api/admin/courses/categories
app.get('/api/admin/courses/categories', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const categories = bionexaDb.getCourseCategories();
    const coreSet = new Set<string>(COURSE_CATEGORIES as readonly string[]);
    const customCategories = categories.filter((c) => !coreSet.has(c));
    res.json({
      success: true,
      categories,
      coreCategories: [...COURSE_CATEGORIES],
      customCategories
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/courses/categories (Add Custom Course Category)
app.post('/api/admin/courses/categories', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name || req.body?.category);
    if (name.length < 2 || name.length > 64) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Category name must be between 2 and 64 characters.'
      });
      return;
    }
    const actor = (req as any).adminUser?.username || 'admin';
    const categories = bionexaDb.addCourseCategory(name, actor);
    const coreSet = new Set<string>(COURSE_CATEGORIES as readonly string[]);
    const customCategories = categories.filter((c) => !coreSet.has(c));
    auditAdminAction(req, 'ADMIN_COURSE_CATEGORY_ADDED', 'course_category', name);
    res.status(201).json({
      success: true,
      categories,
      coreCategories: [...COURSE_CATEGORIES],
      customCategories,
      message: `Added course category "${name}".`
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Validation Error', message: err.message });
  }
});

// DELETE /api/admin/courses/categories/:name (Remove Custom Course Category)
app.delete('/api/admin/courses/categories/:name', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const name = sanitizeString(decodeURIComponent(req.params.name || ''));
    const actor = (req as any).adminUser?.username || 'admin';
    const result = bionexaDb.removeCourseCategory(name, actor);
    if (!result.removed) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Core default course categories cannot be removed, or the category was not found.'
      });
      return;
    }
    const coreSet = new Set<string>(COURSE_CATEGORIES as readonly string[]);
    const customCategories = result.categories.filter((c) => !coreSet.has(c));
    auditAdminAction(req, 'ADMIN_COURSE_CATEGORY_REMOVED', 'course_category', name);
    res.json({
      success: true,
      categories: result.categories,
      coreCategories: [...COURSE_CATEGORIES],
      customCategories,
      message: `Removed custom course category "${name}".`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/courses/expire-scan (Scan and Close Expired Courses)
app.post('/api/admin/courses/expire-scan', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const result = bionexaDb.expirePastCourses();
    auditAdminAction(req, 'ADMIN_COURSE_EXPIRE_SCAN', 'course', 'batch', {
      expiredCount: result.expiredCount,
      expiredIds: result.expiredIds
    });
    res.json({
      success: true,
      expiredCount: result.expiredCount,
      expiredIds: result.expiredIds,
      message:
        result.expiredCount > 0
          ? `Marked ${result.expiredCount} expired course${result.expiredCount === 1 ? '' : 's'} as closed.`
          : 'All open courses have valid or rolling deadlines.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/courses (Add Course)
app.post('/api/admin/courses', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const body = req.body;
    const name = sanitizeString(body.title || body.name);
    const provider = sanitizeString(body.provider);
    const description = sanitizeString(body.description);
    const duration = sanitizeString(body.duration);
    const fees = sanitizeString(body.fees ?? body.price);
    const registrationLink = sanitizeString(body.registrationUrl || body.registrationLink);

    if (!name || !provider || !description || !duration || !fees || !registrationLink) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Course title, provider/institution, description, duration, fees, and official enrollment URL are required.'
      });
      return;
    }

    const urlCheck = validateCourseRegistrationUrl(registrationLink);
    if (!urlCheck.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: urlCheck.reason || 'Official registration URL must start with http:// or https://'
      });
      return;
    }

    const managedCategories = bionexaDb.getCourseCategories();
    const category = resolveCourseCategory(body.category, managedCategories);
    const status = normalizeCourseStatus(body.status, body.availability);
    const providerType = normalizeCourseProviderType(body.providerType);
    const pricingType = classifyCoursePricing(fees, body.pricingType);
    const approvalStatus = normalizeCourseApprovalStatus(body.approvalStatus || 'approved', body.isApproved);
    const isApproved = approvalStatus === 'approved';
    const certificateInfo = sanitizeString(body.certificateInfo || '');
    const curriculum = parseCurriculumInput(body.curriculum || body.syllabus);

    const course = bionexaDb.createCourse({
      name,
      provider,
      providerType,
      instructor: sanitizeString(body.instructor || ''),
      category,
      description,
      duration,
      eligibility: sanitizeString(body.eligibility || ''),
      curriculum,
      deliveryMode: normalizeDeliveryMode(body.deliveryMode),
      fees,
      pricingType,
      certificateInfo,
      registrationDeadline: sanitizeString(body.registrationDeadline || ''),
      registrationLink: urlCheck.normalizedUrl,
      availability: status === 'closed' ? 'Closed' : 'Available',
      status,
      approvalStatus,
      isApproved,
      level: sanitizeString(body.level || 'Intermediate'),
      imageUrl: sanitizeString(body.imageUrl || ''),
      isCertificateAvailable: Boolean(certificateInfo),
      featured: isApproved && Boolean(body.featured)
    });

    auditAdminAction(req, 'ADMIN_COURSE_CREATED', 'course', course.id, {
      name: course.name,
      providerType: course.providerType,
      pricingType: course.pricingType,
      approvalStatus: course.approvalStatus
    });
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
    const managedCategories = bionexaDb.getCourseCategories();

    const updates: Partial<DbCourse> = {};
    if (body.title !== undefined || body.name !== undefined) {
      const nextName = sanitizeString(body.title ?? body.name);
      if (!nextName) {
        res.status(400).json({ error: 'Validation Error', message: 'Course title cannot be empty.' });
        return;
      }
      updates.name = nextName;
    }
    if (body.provider !== undefined) {
      const nextProvider = sanitizeString(body.provider);
      if (!nextProvider) {
        res.status(400).json({ error: 'Validation Error', message: 'Course provider cannot be empty.' });
        return;
      }
      updates.provider = nextProvider;
    }
    if (body.providerType !== undefined) {
      updates.providerType = normalizeCourseProviderType(body.providerType);
    }
    if (body.instructor !== undefined) updates.instructor = sanitizeString(body.instructor);
    if (body.category !== undefined) updates.category = resolveCourseCategory(body.category, managedCategories);
    if (body.duration !== undefined) updates.duration = sanitizeString(body.duration);
    if (body.level !== undefined) updates.level = sanitizeString(body.level);
    if (body.deliveryMode !== undefined) updates.deliveryMode = normalizeDeliveryMode(body.deliveryMode);
    if (body.eligibility !== undefined) updates.eligibility = sanitizeString(body.eligibility);
    if (body.price !== undefined || body.fees !== undefined) {
      updates.fees = sanitizeString(body.fees !== undefined ? body.fees : body.price);
    }
    if (body.pricingType !== undefined) {
      updates.pricingType = classifyCoursePricing(updates.fees ?? body.fees, body.pricingType);
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
      const regUrl = sanitizeString(body.registrationUrl ?? body.registrationLink);
      const urlCheck = validateCourseRegistrationUrl(regUrl);
      if (!urlCheck.valid) {
        res.status(400).json({
          error: 'Validation Error',
          message: urlCheck.reason || 'Official registration URL must start with http:// or https://'
        });
        return;
      }
      updates.registrationLink = urlCheck.normalizedUrl;
    }
    if (body.imageUrl !== undefined) updates.imageUrl = sanitizeString(body.imageUrl);
    if (body.status !== undefined || body.availability !== undefined) {
      const nextStatus = normalizeCourseStatus(body.status, body.availability);
      updates.status = nextStatus;
      updates.availability = nextStatus === 'closed' ? 'Closed' : 'Available';
    }
    if (body.approvalStatus !== undefined || body.isApproved !== undefined) {
      const nextApproval = normalizeCourseApprovalStatus(body.approvalStatus, body.isApproved);
      updates.approvalStatus = nextApproval;
      updates.isApproved = nextApproval === 'approved';
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

// PATCH /api/admin/courses/:id/status (Approve or Reject Course Submission)
app.patch('/api/admin/courses/:id/status', requireAdminPermission('courses:write'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawStatus = sanitizeString(req.body?.approvalStatus || req.body?.status).toLowerCase();
    if (!['approved', 'rejected', 'pending'].includes(rawStatus)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'approvalStatus must be one of: approved, rejected, pending.'
      });
      return;
    }

    const nextApproval = normalizeCourseApprovalStatus(rawStatus);
    const updated = bionexaDb.updateCourse(id, {
      approvalStatus: nextApproval,
      isApproved: nextApproval === 'approved',
      ...(nextApproval !== 'approved' ? { featured: false } : {})
    });

    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    auditAdminAction(req, 'ADMIN_COURSE_APPROVAL_UPDATED', 'course', id, {
      approvalStatus: nextApproval
    });
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
    if (body.approvalStatus !== undefined) {
      const nextApproval = normalizeCourseApprovalStatus(body.approvalStatus);
      updates.approvalStatus = nextApproval;
      updates.isApproved = nextApproval === 'approved';
    }
    if (body.featured !== undefined) {
      updates.featured = Boolean(body.featured);
    }
    if (body.registrationUrl !== undefined || body.registrationLink !== undefined) {
      const url = sanitizeString(body.registrationUrl || body.registrationLink);
      const urlCheck = validateCourseRegistrationUrl(url);
      if (!urlCheck.valid) {
        res.status(400).json({
          error: 'Validation Error',
          message: urlCheck.reason || 'Registration URL must start with http:// or https://'
        });
        return;
      }
      updates.registrationLink = urlCheck.normalizedUrl;
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

// =============================================================
// PHASE 14: STUDENT AUTHENTICATION, PROFILES, SESSIONS & PRIVACY
// =============================================================

const studentLoginRateLimiter = new StudentAuthRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
const studentRegisterRateLimiter = new StudentAuthRateLimiter(8, 15 * 60 * 1000, 15 * 60 * 1000);
const studentResetRateLimiter = new StudentAuthRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
const studentVerifyResendLimiter = new StudentAuthRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);

function extractStudentSessionToken(req: Request): string {
  const cookieToken = req.cookies?.[STUDENT_SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.trim().length >= 16) {
    return cookieToken.trim();
  }
  return '';
}

function setStudentSessionCookie(res: Response, rawToken: string): void {
  res.cookie(STUDENT_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STUDENT_SESSION_DURATION_MS,
  });
}

function clearStudentSessionCookie(res: Response): void {
  res.clearCookie(STUDENT_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function requireStudentPermission(permission?: StudentPermission) {
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

    const rawToken = extractStudentSessionToken(req);
    if (!rawToken) {
      sendApiError(
        res,
        401,
        'Authentication Required',
        'STUDENT_AUTH_REQUIRED',
        'Please sign in with your student account to continue.'
      );
      return;
    }

    const validated = bionexaDb.validateStudentSessionToken(rawToken);
    if (!validated) {
      clearStudentSessionCookie(res);
      sendApiError(
        res,
        401,
        'Session Expired',
        'STUDENT_SESSION_INVALID',
        'Your student session has expired or been revoked. Please sign in again.'
      );
      return;
    }

    const safeProfile = toSafeStudentProfile(validated.student);
    if (permission && !hasStudentPermission(safeProfile, permission)) {
      sendApiError(
        res,
        403,
        'Forbidden',
        'STUDENT_PERMISSION_DENIED',
        'Your account does not have permission to perform this action.'
      );
      return;
    }

    (req as any).studentAccount = validated.student;
    (req as any).studentProfile = safeProfile;
    (req as any).studentSession = validated.session;
    next();
  };
}

// POST /api/student/register
app.post('/api/student/register', (req: Request, res: Response) => {
  try {
    if (!isAdminCsrfOriginValid(req)) {
      sendApiError(res, 403, 'Forbidden', 'CSRF_ORIGIN_DENIED', 'Cross-origin request rejected.');
      return;
    }

    const ip = getClientIp(req);
    const rateKey = `register:${ip}`;
    const rateCheck = studentRegisterRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: 'Too many registration attempts. Please try again shortly.',
        retryAfterSec: rateCheck.retryAfterSec,
      });
      return;
    }

    const validation = validateStudentRegistrationInput(req.body || {});
    if (!validation.valid || !validation.data) {
      studentRegisterRateLimiter.consume(rateKey);
      sendApiError(res, 400, 'Validation Error', 'INVALID_REGISTRATION', validation.error || 'Invalid registration data.');
      return;
    }

    const existing = bionexaDb.getStudentByEmail(validation.data.email);
    if (existing) {
      studentRegisterRateLimiter.consume(rateKey);
      sendApiError(
        res,
        409,
        'Account Exists',
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email address already exists. Please sign in or reset your password.'
      );
      return;
    }

    const passwordHash = hashStudentPassword(validation.data.password);
    const verification = createEmailVerificationToken();

    const account = bionexaDb.createStudentAccount({
      email: validation.data.email,
      passwordHash,
      fullName: validation.data.fullName,
      degreeTitle: validation.data.degreeTitle,
      institution: validation.data.institution,
      specialization: validation.data.specialization,
      graduationYear: validation.data.graduationYear,
      verificationTokenHash: verification.tokenHash,
      verificationExpiresAt: verification.expiresAtIso,
      privacyConsentAt: new Date().toISOString(),
    });

    const sessionToken = createStudentSessionToken();
    bionexaDb.createStudentSession({
      jti: sessionToken.jti,
      studentId: account.id,
      tokenHash: sessionToken.tokenHash,
      userAgent: String(req.headers['user-agent'] || 'Web Browser'),
      ipAddressMasked: maskIpAddress(ip),
      expiresAt: sessionToken.expiresAtIso,
    });
    bionexaDb.updateStudentLastLogin(account.id);
    setStudentSessionCookie(res, sessionToken.rawToken);

    const isProd = process.env.NODE_ENV === 'production';
    const updatedAccount = bionexaDb.getStudentById(account.id) || account;

    res.status(201).json({
      success: true,
      student: toSafeStudentProfile(updatedAccount),
      verificationRequired: true,
      message: 'Student account created. Please verify your email address to complete setup.',
      ...(!isProd
        ? {
            devVerificationToken: verification.rawToken,
            devVerificationUrl: `/student/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
          }
        : {}),
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Registration Error', 'STUDENT_REGISTER_FAILED', err.message || 'Unable to register student account.');
  }
});

// POST /api/student/login
app.post('/api/student/login', (req: Request, res: Response) => {
  try {
    if (!isAdminCsrfOriginValid(req)) {
      sendApiError(res, 403, 'Forbidden', 'CSRF_ORIGIN_DENIED', 'Cross-origin request rejected.');
      return;
    }

    const email = normalizeStudentEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const ip = getClientIp(req);
    const rateKey = `login:${ip}:${email || 'unknown'}`;

    const rateCheck = studentLoginRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: 'Too many failed login attempts. Please wait before trying again.',
        remainingAttempts: 0,
        retryAfterSec: rateCheck.retryAfterSec,
      });
      return;
    }

    if (!email || !password) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_CREDENTIALS', 'Email address and password are required.');
      return;
    }

    const account = bionexaDb.getStudentByEmail(email);
    const valid = account ? verifyStudentPassword(password, account.passwordHash) : false;

    if (!account || !valid) {
      const consumed = studentLoginRateLimiter.consume(rateKey);
      res.status(consumed.isLocked ? 429 : 401).json({
        success: false,
        error: consumed.isLocked ? 'Account Temporarily Locked' : 'Invalid Credentials',
        code: consumed.isLocked ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
        message: consumed.isLocked
          ? 'Too many failed attempts. Login temporarily locked for 15 minutes.'
          : 'Invalid email address or password.',
        remainingAttempts: consumed.remainingAttempts,
        ...(consumed.retryAfterSec ? { retryAfterSec: consumed.retryAfterSec } : {}),
      });
      return;
    }

    if (account.accountStatus === 'suspended') {
      sendApiError(
        res,
        403,
        'Account Suspended',
        'ACCOUNT_SUSPENDED',
        'This student account is currently suspended. Contact grievance support if you believe this is an error.'
      );
      return;
    }

    studentLoginRateLimiter.reset(rateKey);
    const sessionToken = createStudentSessionToken();
    bionexaDb.createStudentSession({
      jti: sessionToken.jti,
      studentId: account.id,
      tokenHash: sessionToken.tokenHash,
      userAgent: String(req.headers['user-agent'] || 'Web Browser'),
      ipAddressMasked: maskIpAddress(ip),
      expiresAt: sessionToken.expiresAtIso,
    });
    bionexaDb.updateStudentLastLogin(account.id);
    setStudentSessionCookie(res, sessionToken.rawToken);

    const freshAccount = bionexaDb.getStudentById(account.id) || account;
    res.json({
      success: true,
      student: toSafeStudentProfile(freshAccount),
      message: `Signed in as ${freshAccount.fullName}.`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Login Error', 'STUDENT_LOGIN_FAILED', err.message || 'Unable to sign in.');
  }
});

// POST /api/student/logout
app.post('/api/student/logout', (req: Request, res: Response) => {
  try {
    const rawToken = extractStudentSessionToken(req);
    if (rawToken) {
      const validated = bionexaDb.validateStudentSessionToken(rawToken);
      if (validated) {
        bionexaDb.revokeStudentSessionByJti(validated.session.jti, validated.student.id);
      }
    }
    clearStudentSessionCookie(res);
    res.json({ success: true, message: 'Signed out cleanly.' });
  } catch (err: any) {
    clearStudentSessionCookie(res);
    sendApiError(res, 500, 'Logout Error', 'STUDENT_LOGOUT_FAILED', err.message || 'Unable to sign out.');
  }
});

// GET /api/student/me
app.get('/api/student/me', (req: Request, res: Response) => {
  const rawToken = extractStudentSessionToken(req);
  if (!rawToken) {
    res.json({ authenticated: false, student: null, session: null });
    return;
  }
  const validated = bionexaDb.validateStudentSessionToken(rawToken);
  if (!validated) {
    clearStudentSessionCookie(res);
    res.json({ authenticated: false, student: null, session: null });
    return;
  }
  res.json({
    authenticated: true,
    student: toSafeStudentProfile(validated.student),
    session: {
      jti: validated.session.jti,
      expiresAt: validated.session.expiresAt,
    },
  });
});

// POST /api/student/verify-email
app.post('/api/student/verify-email', (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length < 16) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_TOKEN', 'A valid verification token is required.');
      return;
    }

    const verified = bionexaDb.verifyStudentEmailByToken(token);
    if (!verified) {
      sendApiError(
        res,
        400,
        'Verification Failed',
        'EXPIRED_OR_INVALID_TOKEN',
        'This verification link or token is invalid or has expired. Please request a new one.'
      );
      return;
    }

    res.json({
      success: true,
      student: toSafeStudentProfile(verified),
      message: 'Your email address has been verified.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Verification Error', 'VERIFY_EMAIL_FAILED', err.message || 'Unable to verify email.');
  }
});

// POST /api/student/resend-verification
app.post('/api/student/resend-verification', requireStudentPermission('student:profile:read'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    if (account.emailVerified) {
      res.json({ success: true, message: 'Your email address is already verified.' });
      return;
    }

    const rateKey = `verify:${account.id}:${getClientIp(req)}`;
    const rate = studentVerifyResendLimiter.consume(rateKey);
    if (!rate.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: 'Too many verification requests. Please wait before trying again.',
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const verification = createEmailVerificationToken();
    bionexaDb.setStudentVerificationToken(account.id, verification.tokenHash, verification.expiresAtIso);

    const isProd = process.env.NODE_ENV === 'production';
    res.json({
      success: true,
      message: 'A new email verification token has been generated.',
      ...(!isProd
        ? {
            devVerificationToken: verification.rawToken,
            devVerificationUrl: `/student/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
          }
        : {}),
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Verification Error', 'RESEND_VERIFICATION_FAILED', err.message || 'Unable to resend verification.');
  }
});

// POST /api/student/password-reset/request
app.post('/api/student/password-reset/request', (req: Request, res: Response) => {
  try {
    const email = normalizeStudentEmail(req.body?.email);
    const ip = getClientIp(req);
    const rateKey = `reset:${ip}:${email || 'unknown'}`;
    const rate = studentResetRateLimiter.consume(rateKey);
    if (!rate.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: 'Too many password reset requests. Please wait before trying again.',
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const account = email ? bionexaDb.getStudentByEmail(email) : null;
    const isProd = process.env.NODE_ENV === 'production';
    let devExtras: Record<string, string> = {};

    if (account && account.accountStatus !== 'suspended') {
      const reset = createStudentPasswordResetToken();
      bionexaDb.setStudentPasswordResetToken(account.id, reset.tokenHash, reset.expiresAtIso);
      if (!isProd) {
        devExtras = {
          devResetToken: reset.rawToken,
          devResetUrl: `/student/reset-password?token=${encodeURIComponent(reset.rawToken)}`,
        };
      }
    }

    // Generic anti-enumeration message
    res.json({
      success: true,
      message: 'If an active student account exists for that email, password reset instructions have been issued.',
      ...devExtras,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Reset Error', 'RESET_REQUEST_FAILED', err.message || 'Unable to process password reset request.');
  }
});

// POST /api/student/password-reset/confirm
app.post('/api/student/password-reset/confirm', (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!token || token.length < 16) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_TOKEN', 'A valid password reset token is required.');
      return;
    }

    const pwCheck = validateStudentPasswordStrength(newPassword);
    if (!pwCheck.valid) {
      sendApiError(res, 400, 'Validation Error', 'WEAK_PASSWORD', pwCheck.error || 'Password does not meet security requirements.');
      return;
    }

    const newHash = hashStudentPassword(newPassword);
    const updated = bionexaDb.consumeStudentPasswordResetToken(token, newHash);
    if (!updated) {
      sendApiError(
        res,
        400,
        'Reset Failed',
        'EXPIRED_OR_INVALID_TOKEN',
        'This password reset token is invalid or has expired. Please request a new reset link.'
      );
      return;
    }

    clearStudentSessionCookie(res);
    res.json({
      success: true,
      message: 'Your password has been reset and all prior sessions have been signed out. Please log in with your new password.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Reset Error', 'RESET_CONFIRM_FAILED', err.message || 'Unable to reset password.');
  }
});

// PATCH /api/student/profile
app.patch('/api/student/profile', requireStudentPermission('student:profile:write'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const validation = validateStudentProfileUpdateInput(req.body || {});
    if (!validation.valid || !validation.data) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_PROFILE_DATA', validation.error || 'Invalid profile fields.');
      return;
    }

    // Strictly update ONLY the authenticated student's own ID from verified session (prevents IDOR)
    const updated = bionexaDb.updateStudentProfile(account.id, validation.data);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'STUDENT_NOT_FOUND', 'Student account could not be found.');
      return;
    }

    res.json({
      success: true,
      student: toSafeStudentProfile(updated),
      message: 'Student profile updated in database.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Profile Error', 'PROFILE_UPDATE_FAILED', err.message || 'Unable to update student profile.');
  }
});

// POST /api/student/change-password
app.post('/api/student/change-password', requireStudentPermission('student:profile:write'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const session = (req as any).studentSession;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!verifyStudentPassword(currentPassword, account.passwordHash)) {
      sendApiError(res, 401, 'Invalid Password', 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
      return;
    }

    const pwCheck = validateStudentPasswordStrength(newPassword, account.email);
    if (!pwCheck.valid) {
      sendApiError(res, 400, 'Validation Error', 'WEAK_PASSWORD', pwCheck.error || 'New password is too weak.');
      return;
    }

    const newHash = hashStudentPassword(newPassword);
    bionexaDb.updateStudentPasswordHash(account.id, newHash);
    bionexaDb.revokeAllStudentSessions(account.id, session.jti);

    res.json({
      success: true,
      message: 'Password updated successfully. Other active sessions were signed out.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Security Error', 'CHANGE_PASSWORD_FAILED', err.message || 'Unable to change password.');
  }
});

// GET /api/student/sessions
app.get('/api/student/sessions', requireStudentPermission('student:sessions:manage'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const session = (req as any).studentSession;
    const sessions = bionexaDb.listStudentSessions(account.id, session.jti);
    res.json({ success: true, sessions });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'LIST_SESSIONS_FAILED', err.message || 'Unable to load active sessions.');
  }
});

// DELETE /api/student/sessions/:jti
app.delete('/api/student/sessions/:jti', requireStudentPermission('student:sessions:manage'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const currentSession = (req as any).studentSession;
    const targetJti = String(req.params.jti || '').trim();
    if (!targetJti) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_SESSION_ID', 'Session ID is required.');
      return;
    }

    const revoked = bionexaDb.revokeStudentSessionByJti(targetJti, account.id);
    if (!revoked) {
      sendApiError(res, 404, 'Not Found', 'SESSION_NOT_FOUND', 'Active session not found for your account.');
      return;
    }

    const revokedCurrent = targetJti === currentSession.jti;
    if (revokedCurrent) {
      clearStudentSessionCookie(res);
    }

    res.json({
      success: true,
      revokedCurrent,
      message: revokedCurrent ? 'Current session revoked. You have been signed out.' : 'Session revoked successfully.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'REVOKE_SESSION_FAILED', err.message || 'Unable to revoke session.');
  }
});

// POST /api/student/sessions/revoke-others
app.post('/api/student/sessions/revoke-others', requireStudentPermission('student:sessions:manage'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const currentSession = (req as any).studentSession;
    const revokedCount = bionexaDb.revokeAllStudentSessions(account.id, currentSession.jti);
    res.json({
      success: true,
      revokedCount,
      message:
        revokedCount > 0
          ? `Signed out ${revokedCount} other active session${revokedCount === 1 ? '' : 's'}.`
          : 'No other active sessions were found.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'REVOKE_OTHERS_FAILED', err.message || 'Unable to revoke other sessions.');
  }
});

// POST /api/student/deletion-request
app.post('/api/student/deletion-request', requireStudentPermission('student:account:delete_request'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const validation = validateDeletionRequestInput(req.body || {});
    if (!validation.valid || !validation.data) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_DELETION_REQUEST', validation.error || 'Invalid deletion request.');
      return;
    }

    if (!verifyStudentPassword(validation.data.password, account.passwordHash)) {
      sendApiError(res, 401, 'Invalid Password', 'CURRENT_PASSWORD_INCORRECT', 'Current password verification failed.');
      return;
    }

    const result = bionexaDb.createStudentDeletionRequest(
      account.id,
      validation.data.reason,
      validation.data.mode
    );

    // Also record privacy compliance reference for DPDP auditability (without exposing password/private data)
    try {
      bionexaDb.createComplianceRequest({
        requestType: 'privacy_request',
        subCategory: result.deletedImmediately
          ? `Self-Service Student Account Erasure (${result.request.id})`
          : `Student Account Deletion Request (${result.request.id})`,
        requesterName: result.deletedImmediately ? 'Erased Student Account' : account.fullName,
        requesterEmail: result.deletedImmediately ? `erased+${result.request.id}@redacted.local` : account.email,
        details: validation.data.reason || 'Student submitted an account deletion request under DPDP data erasure rights.',
        consentAccepted: true,
      });
    } catch {
      // Do not fail student deletion if optional compliance mirror fails
    }

    if (result.deletedImmediately) {
      clearStudentSessionCookie(res);
      res.json({
        success: true,
        deletedImmediately: true,
        requestId: result.request.id,
        student: null,
        message: 'Your student account and active sessions have been permanently deleted.',
      });
      return;
    }

    const updated = bionexaDb.getStudentById(account.id);
    res.json({
      success: true,
      deletedImmediately: false,
      requestId: result.request.id,
      student: updated ? toSafeStudentProfile(updated) : null,
      message: 'Account deletion request recorded. You may cancel this request before final processing or delete immediately.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Deletion Error', 'DELETION_REQUEST_FAILED', err.message || 'Unable to submit deletion request.');
  }
});

// DELETE /api/student/deletion-request (Cancel pending deletion)
app.delete('/api/student/deletion-request', requireStudentPermission('student:account:delete_request'), (req: Request, res: Response) => {
  try {
    const account = (req as any).studentAccount;
    const updated = bionexaDb.cancelStudentDeletionRequest(account.id);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'STUDENT_NOT_FOUND', 'Student account not found.');
      return;
    }
    res.json({
      success: true,
      student: toSafeStudentProfile(updated),
      message: 'Pending account deletion request has been cancelled.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Deletion Error', 'CANCEL_DELETION_FAILED', err.message || 'Unable to cancel deletion request.');
  }
});

// =========================================================================
// PHASE 15: COMPANY & EMPLOYER AUTHENTICATION, VERIFICATION & JOB WORKFLOW
// =========================================================================

const companyLoginRateLimiter = new CompanyAuthRateLimiter(8, 15 * 60 * 1000, 15 * 60 * 1000);
const companyRegisterRateLimiter = new CompanyAuthRateLimiter(10, 60 * 60 * 1000, 30 * 60 * 1000);
const companyResetRateLimiter = new CompanyAuthRateLimiter(6, 30 * 60 * 1000, 30 * 60 * 1000);

function setCompanySessionCookie(res: Response, rawToken: string): void {
  res.cookie(COMPANY_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: runtimeEnv.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: COMPANY_SESSION_TTL_MS,
  });
}

function clearCompanySessionCookie(res: Response): void {
  res.clearCookie(COMPANY_SESSION_COOKIE, {
    httpOnly: true,
    secure: runtimeEnv.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
}

function formatCompanyJob(job: any) {
  const today = new Date().toISOString().split('T')[0];
  const isExpired =
    job.verificationStatus === 'Expired' ||
    (Boolean(job.expiryDate) && job.expiryDate < today);
  let status = 'Pending Review';
  if (job.verificationStatus === 'Rejected') {
    status = 'Rejected';
  } else if (isExpired) {
    status = 'Expired';
  } else if (!job.isActive) {
    status = 'Closed';
  } else if (job.isApproved && job.verificationStatus === 'Verified') {
    status = 'Published';
  } else if (job.isApproved) {
    status = 'Published';
  }

  return {
    id: job.id,
    slug: job.id,
    title: job.title,
    company: job.employer,
    companyAccountId: job.companyAccountId || '',
    sector: job.sector || 'Private Biopharma',
    location: job.location,
    type: job.employmentType || 'Full-time',
    salary: job.salary || 'Competitive',
    qualification: job.qualification || '',
    experienceLevel: 'All Experience Levels',
    description: job.description,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    deadline: job.expiryDate || '',
    postedDate: job.publicationDate || '',
    applicationDestinationType: job.applicationDestinationType || 'external_url',
    applicationUrl: job.applicationUrl || '',
    applicationEmail: job.applicationEmail || '',
    applicationInstructions: job.applicationInstructions || '',
    status,
    isApproved: Boolean(job.isApproved),
    isExpired,
    featured: Boolean(job.featured),
    verificationStatus: job.verificationStatus || 'Pending Verification',
    verificationNotes: job.verificationNotes || '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function isCompanyCsrfOriginValid(req: Request): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (!req.cookies?.[COMPANY_SESSION_COOKIE]) return true;
  const originHeader = req.get('origin') || req.get('referer');
  if (!originHeader) return true;
  try {
    const parsedOrigin = new URL(originHeader).origin;
    const hostHeader = req.get('host');
    if (hostHeader && parsedOrigin.endsWith(`://${hostHeader}`)) return true;
    return resolveCorsOrigin(parsedOrigin, runtimeEnv) === parsedOrigin;
  } catch {
    return false;
  }
}

function requireCompanyPermission(permission?: CompanyPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isCompanyCsrfOriginValid(req)) {
      sendApiError(res, 403, 'Forbidden', 'CSRF_ORIGIN_DENIED', 'Cross-origin state-changing request rejected.');
      return;
    }

    const rawToken = req.cookies?.[COMPANY_SESSION_COOKIE];
    if (!rawToken || typeof rawToken !== 'string') {
      sendApiError(res, 401, 'Authentication Required', 'COMPANY_AUTH_REQUIRED', 'Please sign in with your company account.');
      return;
    }

    const verified = bionexaDb.validateCompanySessionToken(rawToken);
    if (!verified) {
      clearCompanySessionCookie(res);
      sendApiError(res, 401, 'Session Expired', 'INVALID_COMPANY_SESSION', 'Your company session has expired or been revoked. Please sign in again.');
      return;
    }

    if (verified.company.accountStatus === 'suspended') {
      clearCompanySessionCookie(res);
      sendApiError(
        res,
        403,
        'Account Suspended',
        'ACCOUNT_SUSPENDED',
        verified.company.suspensionReason
          ? `Your employer account has been suspended: ${verified.company.suspensionReason}`
          : 'Your employer account has been suspended by an administrator.'
      );
      return;
    }

    if (permission && !hasCompanyPermission(verified.company, permission)) {
      const reasonMsg = !verified.company.emailVerified && permission.startsWith('company:jobs:')
        ? 'Please verify your work email address before submitting or editing job openings.'
        : `Permission '${permission}' is not granted for this company account.`;
      sendApiError(res, 403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS', reasonMsg);
      return;
    }

    (req as any).companyAccount = verified.company;
    (req as any).companySession = verified.session;
    next();
  };
}

// POST /api/company/register
app.post('/api/company/register', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const maskedIp = maskIpAddress(clientIp);
    const rateCheck = companyRegisterRateLimiter.consume(`register:${clientIp}`);
    if (!rateCheck.allowed) {
      sendApiError(res, 429, 'Too Many Requests', 'RATE_LIMITED', `Too many registration attempts. Please try again in ${rateCheck.retryAfterSec || 1800}s.`);
      return;
    }

    const validated = validateCompanyRegistrationInput(req.body || {});
    if (!validated.valid || !validated.value) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        field: validated.field,
        message: validated.error,
      });
      return;
    }

    const input = validated.value;
    const existing = bionexaDb.getCompanyByEmail(input.email);
    if (existing) {
      sendApiError(res, 409, 'Conflict', 'EMAIL_ALREADY_REGISTERED', 'An employer account with this work email already exists. Please sign in instead.');
      return;
    }

    const passwordHash = hashCompanyPassword(input.password);
    const rawVerifyToken = generateCompanyOpaqueToken(32);
    const verifyTokenHash = hashCompanyOpaqueToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + COMPANY_VERIFY_TOKEN_TTL_MS).toISOString();

    const company = bionexaDb.createCompanyAccount({
      email: input.email,
      passwordHash,
      contactName: input.contactName,
      contactTitle: input.contactTitle,
      contactPhone: input.contactPhone,
      organizationName: input.organizationName,
      organizationType: input.organizationType,
      officialWebsite: input.officialWebsite,
      headquartersLocation: input.headquartersLocation,
      organizationSize: input.organizationSize,
      foundedYear: input.foundedYear,
      industryFocus: input.industryFocus,
      description: input.description,
      registrationIdentifier: input.registrationIdentifier,
      verificationTokenHash: verifyTokenHash,
      verificationTokenExpiresAt: verifyExpiresAt,
    });

    const rawSessionToken = generateCompanyOpaqueToken(32);
    const jti = `csess-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString();
    bionexaDb.createCompanySession({
      jti,
      companyId: company.id,
      rawToken: rawSessionToken,
      userAgent: req.get('user-agent') || 'Browser',
      ipMasked: maskedIp,
      expiresAt,
    });
    bionexaDb.updateCompanyLastLogin(company.id);
    setCompanySessionCookie(res, rawSessionToken);

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_REGISTERED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Registered organization '${company.organizationName}' (unverified pending email & employer review).`,
    });

    const payload: Record<string, any> = {
      success: true,
      company: toSafeCompanyProfile(company),
      verificationRequired: true,
      message: 'Company account registered. Verify your work email and complete employer verification before publishing verified openings.',
    };
    if (process.env.NODE_ENV !== 'production') {
      payload.devVerificationToken = rawVerifyToken;
    }
    res.status(201).json(payload);
  } catch (err: any) {
    sendApiError(res, 500, 'Registration Error', 'COMPANY_REGISTER_FAILED', err.message || 'Unable to register company account.');
  }
});

// POST /api/company/login
app.post('/api/company/login', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const maskedIp = maskIpAddress(clientIp);
    const email = normalizeCompanyEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    const rateKey = `login:${clientIp}:${email || 'anon'}`;
    const rateCheck = companyLoginRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      sendApiError(res, 429, 'Too Many Requests', 'RATE_LIMITED', `Too many login attempts. Try again in ${rateCheck.retryAfterSec || 900}s.`);
      return;
    }

    if (!email || !password) {
      sendApiError(res, 400, 'Validation Error', 'MISSING_CREDENTIALS', 'Work email and password are required.');
      return;
    }

    const company = bionexaDb.getCompanyByEmail(email);
    if (!company || !verifyCompanyPassword(password, company.passwordHash)) {
      companyLoginRateLimiter.consume(rateKey);
      if (company) {
        bionexaDb.createCompanyAuditLog({
          companyId: company.id,
          actorType: 'company',
          actorId: company.id,
          actorEmail: company.email,
          action: 'COMPANY_LOGIN_FAILED',
          targetType: 'session',
          targetId: company.id,
          status: 'failure',
          ipMasked: maskedIp,
          details: 'Invalid password attempt.',
        });
      }
      sendApiError(res, 401, 'Authentication Failed', 'INVALID_CREDENTIALS', 'Invalid work email or password.');
      return;
    }

    if (company.accountStatus === 'suspended') {
      bionexaDb.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'COMPANY_LOGIN_BLOCKED_SUSPENDED',
        targetType: 'session',
        targetId: company.id,
        status: 'denied',
        ipMasked: maskedIp,
        details: company.suspensionReason || 'Account suspended by administrator.',
      });
      sendApiError(
        res,
        403,
        'Account Suspended',
        'ACCOUNT_SUSPENDED',
        company.suspensionReason
          ? `This employer account is suspended: ${company.suspensionReason}`
          : 'This employer account has been suspended by an administrator.'
      );
      return;
    }

    companyLoginRateLimiter.reset(rateKey);

    const rawSessionToken = generateCompanyOpaqueToken(32);
    const jti = `csess-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + COMPANY_SESSION_TTL_MS).toISOString();
    bionexaDb.createCompanySession({
      jti,
      companyId: company.id,
      rawToken: rawSessionToken,
      userAgent: req.get('user-agent') || 'Browser',
      ipMasked: maskedIp,
      expiresAt,
    });
    bionexaDb.updateCompanyLastLogin(company.id);
    setCompanySessionCookie(res, rawSessionToken);

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_LOGIN_SUCCESS',
      targetType: 'session',
      targetId: jti,
      status: 'success',
      ipMasked: maskedIp,
      details: 'Employer signed in.',
    });

    const refreshed = bionexaDb.getCompanyById(company.id) || company;
    res.json({
      success: true,
      company: toSafeCompanyProfile(refreshed),
      message: `Signed in to ${refreshed.organizationName}.`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Login Error', 'COMPANY_LOGIN_FAILED', err.message || 'Unable to sign in.');
  }
});

// POST /api/company/logout
app.post('/api/company/logout', (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[COMPANY_SESSION_COOKIE];
    if (rawToken && typeof rawToken === 'string') {
      const verified = bionexaDb.validateCompanySessionToken(rawToken);
      if (verified) {
        bionexaDb.revokeCompanySessionByJti(verified.session.jti, verified.company.id);
        bionexaDb.createCompanyAuditLog({
          companyId: verified.company.id,
          actorType: 'company',
          actorId: verified.company.id,
          actorEmail: verified.company.email,
          action: 'COMPANY_LOGOUT',
          targetType: 'session',
          targetId: verified.session.jti,
          status: 'success',
          ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
          details: 'Signed out current session.',
        });
      }
    }
    clearCompanySessionCookie(res);
    res.json({ success: true, message: 'Signed out successfully.' });
  } catch (err: any) {
    clearCompanySessionCookie(res);
    sendApiError(res, 500, 'Logout Error', 'COMPANY_LOGOUT_FAILED', err.message || 'Unable to sign out.');
  }
});

// GET /api/company/me
app.get('/api/company/me', (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[COMPANY_SESSION_COOKIE];
    if (!rawToken || typeof rawToken !== 'string') {
      res.json({ authenticated: false, company: null });
      return;
    }
    const verified = bionexaDb.validateCompanySessionToken(rawToken);
    if (!verified || verified.company.accountStatus === 'suspended') {
      clearCompanySessionCookie(res);
      res.json({ authenticated: false, company: null });
      return;
    }
    res.json({
      authenticated: true,
      company: toSafeCompanyProfile(verified.company),
    });
  } catch {
    res.json({ authenticated: false, company: null });
  }
});

// POST /api/company/verify-email
app.post('/api/company/verify-email', (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length < 16) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_TOKEN', 'A valid verification token is required.');
      return;
    }
    const verified = bionexaDb.verifyCompanyEmailByToken(token);
    if (!verified) {
      sendApiError(res, 400, 'Verification Failed', 'EXPIRED_OR_INVALID_TOKEN', 'This verification token is invalid or has expired.');
      return;
    }
    bionexaDb.createCompanyAuditLog({
      companyId: verified.id,
      actorType: 'company',
      actorId: verified.id,
      actorEmail: verified.email,
      action: 'COMPANY_EMAIL_VERIFIED',
      targetType: 'company',
      targetId: verified.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: 'Company work email verified.',
    });
    res.json({
      success: true,
      company: toSafeCompanyProfile(verified),
      message: 'Company work email verified. You can now submit openings and request employer verification.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Verification Error', 'COMPANY_VERIFY_EMAIL_FAILED', err.message || 'Unable to verify company email.');
  }
});

// POST /api/company/resend-verification
app.post('/api/company/resend-verification', requireCompanyPermission('company:profile:read'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    if (company.emailVerified) {
      res.json({ success: true, message: 'Your company work email is already verified.' });
      return;
    }
    const rawVerifyToken = generateCompanyOpaqueToken(32);
    const verifyTokenHash = hashCompanyOpaqueToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + COMPANY_VERIFY_TOKEN_TTL_MS).toISOString();
    bionexaDb.setCompanyVerificationToken(company.id, verifyTokenHash, expiresAt);

    const payload: Record<string, any> = {
      success: true,
      message: 'A new company email verification token has been generated.',
    };
    if (process.env.NODE_ENV !== 'production') {
      payload.devVerificationToken = rawVerifyToken;
    }
    res.json(payload);
  } catch (err: any) {
    sendApiError(res, 500, 'Verification Error', 'RESEND_VERIFICATION_FAILED', err.message || 'Unable to resend verification token.');
  }
});

// POST /api/company/password-reset/request
app.post('/api/company/password-reset/request', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = companyResetRateLimiter.consume(`reset:${clientIp}`);
    if (!rateCheck.allowed) {
      sendApiError(res, 429, 'Too Many Requests', 'RATE_LIMITED', `Too many password reset requests. Try again in ${rateCheck.retryAfterSec || 1800}s.`);
      return;
    }

    const email = normalizeCompanyEmail(req.body?.email || '');
    if (!email || !email.includes('@')) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_EMAIL', 'Please enter a valid work email address.');
      return;
    }

    const company = bionexaDb.getCompanyByEmail(email);
    const payload: Record<string, any> = {
      success: true,
      message: 'If an employer account exists for that email, a password reset token has been issued.',
    };
    if (company && company.accountStatus !== 'suspended') {
      const rawResetToken = generateCompanyOpaqueToken(32);
      const resetTokenHash = hashCompanyOpaqueToken(rawResetToken);
      const expiresAt = new Date(Date.now() + COMPANY_RESET_TOKEN_TTL_MS).toISOString();
      bionexaDb.setCompanyPasswordResetToken(company.id, resetTokenHash, expiresAt);
      bionexaDb.createCompanyAuditLog({
        companyId: company.id,
        actorType: 'company',
        actorId: company.id,
        actorEmail: company.email,
        action: 'COMPANY_PASSWORD_RESET_REQUESTED',
        targetType: 'company',
        targetId: company.id,
        status: 'success',
        ipMasked: maskIpAddress(clientIp),
        details: 'Password reset token generated.',
      });
      if (process.env.NODE_ENV !== 'production') {
        payload.devResetToken = rawResetToken;
      }
    }
    res.json(payload);
  } catch (err: any) {
    sendApiError(res, 500, 'Reset Error', 'PASSWORD_RESET_REQUEST_FAILED', err.message || 'Unable to process reset request.');
  }
});

// POST /api/company/password-reset/confirm
app.post('/api/company/password-reset/confirm', (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = String(req.body?.newPassword || '');
    if (!token || token.length < 16) {
      sendApiError(res, 400, 'Validation Error', 'INVALID_TOKEN', 'A valid password reset token is required.');
      return;
    }
    const strength = evaluateCompanyPasswordStrength(newPassword);
    if (!strength.valid) {
      sendApiError(res, 400, 'Validation Error', 'WEAK_PASSWORD', strength.errors[0] || 'Password does not meet security requirements.');
      return;
    }

    const updated = bionexaDb.consumeCompanyPasswordResetToken(token, hashCompanyPassword(newPassword));
    if (!updated) {
      sendApiError(res, 400, 'Reset Failed', 'EXPIRED_OR_INVALID_TOKEN', 'Reset token is invalid or has expired.');
      return;
    }
    clearCompanySessionCookie(res);
    bionexaDb.createCompanyAuditLog({
      companyId: updated.id,
      actorType: 'company',
      actorId: updated.id,
      actorEmail: updated.email,
      action: 'COMPANY_PASSWORD_RESET_COMPLETED',
      targetType: 'company',
      targetId: updated.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: 'Password reset completed and all existing sessions revoked.',
    });
    res.json({
      success: true,
      message: 'Your employer password has been updated. All prior sessions were signed out.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Reset Error', 'PASSWORD_RESET_CONFIRM_FAILED', err.message || 'Unable to confirm password reset.');
  }
});

// PATCH /api/company/profile
app.patch('/api/company/profile', requireCompanyPermission('company:profile:write'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const validated = validateCompanyProfileUpdateInput(req.body || {});
    if (!validated.valid || !validated.value) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        field: validated.field,
        message: validated.error,
      });
      return;
    }

    const updated = bionexaDb.updateCompanyProfile(company.id, validated.value);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'COMPANY_NOT_FOUND', 'Company account not found.');
      return;
    }

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_PROFILE_UPDATED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Updated organization profile fields: ${Object.keys(validated.value).join(', ') || 'none'}.`,
    });

    res.json({
      success: true,
      company: toSafeCompanyProfile(updated),
      message: 'Organization profile and default application settings updated.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Profile Update Error', 'COMPANY_PROFILE_UPDATE_FAILED', err.message || 'Unable to update company profile.');
  }
});

// POST /api/company/change-password
app.post('/api/company/change-password', requireCompanyPermission('company:profile:write'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const session = (req as any).companySession;
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!verifyCompanyPassword(currentPassword, company.passwordHash)) {
      sendApiError(res, 401, 'Invalid Password', 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
      return;
    }
    const strength = evaluateCompanyPasswordStrength(newPassword, company.email);
    if (!strength.valid) {
      sendApiError(res, 400, 'Weak Password', 'WEAK_PASSWORD', strength.errors[0] || 'New password is too weak.');
      return;
    }

    bionexaDb.updateCompanyPassword(company.id, hashCompanyPassword(newPassword));
    const revokedOtherSessions = bionexaDb.revokeAllCompanySessions(company.id, session?.jti);
    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_PASSWORD_CHANGED',
      targetType: 'company',
      targetId: company.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Password rotated; revoked ${revokedOtherSessions} other active session(s).`,
    });

    res.json({
      success: true,
      revokedOtherSessions,
      message: 'Password updated successfully.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Password Error', 'COMPANY_CHANGE_PASSWORD_FAILED', err.message || 'Unable to change password.');
  }
});

// POST /api/company/verification/submit
app.post('/api/company/verification/submit', requireCompanyPermission('company:verification:submit'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    if (!company.emailVerified) {
      sendApiError(
        res,
        403,
        'Email Verification Required',
        'EMAIL_NOT_VERIFIED',
        'Please verify your company work email before submitting an employer verification request.'
      );
      return;
    }

    if (company.verificationStatus === 'verified') {
      res.json({
        success: true,
        company: toSafeCompanyProfile(company),
        message: 'Your organization is already a verified BIO-INEXA employer.',
      });
      return;
    }

    const validated = validateEmployerVerificationSubmission(req.body || {}, company.officialWebsite);
    if (!validated.valid || !validated.value) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        field: validated.field,
        message: validated.error,
      });
      return;
    }

    const updated = bionexaDb.submitCompanyEmployerVerification(company.id, validated.value);
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'COMPANY_NOT_FOUND', 'Company account not found.');
      return;
    }

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'EMPLOYER_VERIFICATION_SUBMITTED',
      targetType: 'verification',
      targetId: company.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Submitted employer verification for '${updated.organizationName}' (${validated.value.officialWebsite}).`,
    });

    res.json({
      success: true,
      company: toSafeCompanyProfile(updated),
      message: 'Employer verification dossier submitted for administrator review.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Verification Error', 'VERIFICATION_SUBMIT_FAILED', err.message || 'Unable to submit employer verification.');
  }
});

// GET /api/company/jobs
app.get('/api/company/jobs', requireCompanyPermission('company:jobs:read'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const jobs = bionexaDb.getJobsByCompanyAccountId(company.id).map(formatCompanyJob);
    const summary = {
      total: jobs.length,
      published: jobs.filter((j) => j.status === 'Published').length,
      pendingReview: jobs.filter((j) => j.status === 'Pending Review').length,
      rejected: jobs.filter((j) => j.status === 'Rejected').length,
      expired: jobs.filter((j) => j.status === 'Expired').length,
      closed: jobs.filter((j) => j.status === 'Closed').length,
    };
    res.json({ success: true, jobs, summary });
  } catch (err: any) {
    sendApiError(res, 500, 'Jobs Error', 'COMPANY_JOBS_LIST_FAILED', err.message || 'Unable to load company jobs.');
  }
});

// POST /api/company/jobs
app.post('/api/company/jobs', requireCompanyPermission('company:jobs:submit'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const validated = validateCompanyJobInput(req.body || {});
    if (!validated.valid || !validated.value) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        field: validated.field,
        message: validated.error,
      });
      return;
    }

    const input = validated.value;
    const policy = resolveEmployerJobSubmissionPolicy(company);
    const nowDate = new Date().toISOString().split('T')[0];

    const created = bionexaDb.createJob({
      title: input.title,
      employer: company.organizationName,
      description: input.description,
      location: input.location,
      qualification: input.qualification,
      skills: input.skills,
      employmentType: input.type,
      salary: input.salary,
      applicationUrl: input.applicationUrl || company.officialWebsite,
      source: policy.publishedAsVerified
        ? `${company.organizationName} (Verified Employer Portal)`
        : `${company.organizationName} (Employer Submission — Pending Verification)`,
      originalJobUrl: input.applicationUrl || company.officialWebsite,
      publicationDate: nowDate,
      expiryDate: input.deadline,
      lastVerificationDate: policy.publishedAsVerified ? nowDate : '',
      verificationStatus: policy.publishedAsVerified ? 'Verified' : 'Pending Verification',
      verificationNotes: policy.verificationNotes,
      isActive: true,
      isApproved: policy.isApproved,
      featured: false,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      sector: input.sector,
      companyAccountId: company.id,
      applicationDestinationType: input.applicationDestinationType,
      applicationEmail: input.applicationEmail,
      applicationInstructions: input.applicationInstructions,
    });

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: policy.publishedAsVerified ? 'JOB_PUBLISHED_VERIFIED' : 'JOB_SUBMITTED_PENDING_REVIEW',
      targetType: 'job',
      targetId: created.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Submitted '${created.title}' (${input.applicationDestinationType}) — ${policy.status}.`,
    });

    res.status(201).json({
      success: true,
      job: formatCompanyJob(created),
      publishedAsVerified: policy.publishedAsVerified,
      message: policy.publishedAsVerified
        ? 'Opening published as a verified employer listing.'
        : 'Opening submitted for administrator review. Unverified employers cannot publish verified listings until employer verification is approved.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Job Submission Error', 'COMPANY_JOB_SUBMIT_FAILED', err.message || 'Unable to submit job opening.');
  }
});

// PUT /api/company/jobs/:id
app.put('/api/company/jobs/:id', requireCompanyPermission('company:jobs:edit'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const existing = bionexaDb.getJobById(req.params.id);
    if (!existing || existing.companyAccountId !== company.id) {
      sendApiError(res, 404, 'Not Found', 'JOB_NOT_FOUND', 'Job opening not found under your organization account.');
      return;
    }

    const validated = validateCompanyJobInput(req.body || {});
    if (!validated.valid || !validated.value) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        field: validated.field,
        message: validated.error,
      });
      return;
    }

    const input = validated.value;
    const policy = resolveEmployerJobSubmissionPolicy(company);
    const nowDate = new Date().toISOString().split('T')[0];

    // Unverified employers can never self-approve or become Verified by editing
    const updated = bionexaDb.updateJob(existing.id, {
      title: input.title,
      employer: company.organizationName,
      description: input.description,
      location: input.location,
      qualification: input.qualification,
      skills: input.skills,
      employmentType: input.type,
      salary: input.salary,
      applicationUrl: input.applicationUrl || company.officialWebsite,
      originalJobUrl: input.applicationUrl || company.officialWebsite,
      expiryDate: input.deadline,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      sector: input.sector,
      applicationDestinationType: input.applicationDestinationType,
      applicationEmail: input.applicationEmail,
      applicationInstructions: input.applicationInstructions,
      isApproved: policy.publishedAsVerified ? existing.isApproved : false,
      verificationStatus: policy.publishedAsVerified ? existing.verificationStatus : 'Pending Verification',
      lastVerificationDate: policy.publishedAsVerified ? (existing.lastVerificationDate || nowDate) : '',
      verificationNotes: policy.publishedAsVerified ? existing.verificationNotes : policy.verificationNotes,
    });

    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'JOB_EDITED',
      targetType: 'job',
      targetId: existing.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Updated opening '${input.title}' (destination: ${input.applicationDestinationType}).`,
    });

    res.json({
      success: true,
      job: formatCompanyJob(updated),
      message: 'Job opening updated successfully.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Job Edit Error', 'COMPANY_JOB_UPDATE_FAILED', err.message || 'Unable to update job opening.');
  }
});

// PATCH /api/company/jobs/:id/status (Close or reopen own job; never self-verify)
app.patch('/api/company/jobs/:id/status', requireCompanyPermission('company:jobs:edit'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const existing = bionexaDb.getJobById(req.params.id);
    if (!existing || existing.companyAccountId !== company.id) {
      sendApiError(res, 404, 'Not Found', 'JOB_NOT_FOUND', 'Job opening not found under your organization account.');
      return;
    }

    const action = String(req.body?.action || '').trim().toLowerCase();
    if (action !== 'close' && action !== 'reopen') {
      sendApiError(res, 400, 'Validation Error', 'INVALID_ACTION', 'Action must be either "close" or "reopen".');
      return;
    }

    const isActive = action === 'reopen';
    const updated = bionexaDb.updateJob(existing.id, { isActive });
    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: isActive ? 'JOB_REOPENED' : 'JOB_CLOSED',
      targetType: 'job',
      targetId: existing.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `${isActive ? 'Reopened' : 'Closed'} '${existing.title}'.`,
    });

    res.json({
      success: true,
      job: formatCompanyJob(updated),
      message: isActive ? 'Job opening reopened.' : 'Job opening closed.',
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Job Status Error', 'COMPANY_JOB_STATUS_FAILED', err.message || 'Unable to update job status.');
  }
});

// DELETE /api/company/jobs/:id
app.delete('/api/company/jobs/:id', requireCompanyPermission('company:jobs:delete'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const existing = bionexaDb.getJobById(req.params.id);
    if (!existing || existing.companyAccountId !== company.id) {
      sendApiError(res, 404, 'Not Found', 'JOB_NOT_FOUND', 'Job opening not found under your organization account.');
      return;
    }

    bionexaDb.deleteJob(existing.id);
    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'JOB_DELETED',
      targetType: 'job',
      targetId: existing.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Deleted opening '${existing.title}'.`,
    });

    res.json({ success: true, message: 'Job opening deleted.' });
  } catch (err: any) {
    sendApiError(res, 500, 'Job Delete Error', 'COMPANY_JOB_DELETE_FAILED', err.message || 'Unable to delete job opening.');
  }
});

// GET /api/company/sessions
app.get('/api/company/sessions', requireCompanyPermission('company:sessions:manage'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const currentSession = (req as any).companySession;
    const sessions = bionexaDb.listActiveCompanySessions(company.id, currentSession?.jti);
    res.json({ success: true, sessions });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'COMPANY_SESSIONS_FAILED', err.message || 'Unable to load active sessions.');
  }
});

// DELETE /api/company/sessions/:jti
app.delete('/api/company/sessions/:jti', requireCompanyPermission('company:sessions:manage'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const currentSession = (req as any).companySession;
    const targetJti = req.params.jti;
    const revoked = bionexaDb.revokeCompanySessionByJti(targetJti, company.id);
    if (!revoked) {
      sendApiError(res, 404, 'Not Found', 'SESSION_NOT_FOUND', 'Session not found.');
      return;
    }
    if (currentSession?.jti === targetJti) {
      clearCompanySessionCookie(res);
    }
    res.json({ success: true, message: 'Session revoked successfully.' });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'COMPANY_SESSION_REVOKE_FAILED', err.message || 'Unable to revoke session.');
  }
});

// POST /api/company/sessions/revoke-others
app.post('/api/company/sessions/revoke-others', requireCompanyPermission('company:sessions:manage'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const currentSession = (req as any).companySession;
    const revokedCount = bionexaDb.revokeAllCompanySessions(company.id, currentSession?.jti);
    bionexaDb.createCompanyAuditLog({
      companyId: company.id,
      actorType: 'company',
      actorId: company.id,
      actorEmail: company.email,
      action: 'COMPANY_SESSIONS_REVOKED_OTHERS',
      targetType: 'session',
      targetId: company.id,
      status: 'success',
      ipMasked: maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown'),
      details: `Signed out ${revokedCount} other active device session(s).`,
    });
    res.json({
      success: true,
      revokedCount,
      message: `Signed out ${revokedCount} other active device(s).`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Session Error', 'COMPANY_REVOKE_OTHERS_FAILED', err.message || 'Unable to revoke other sessions.');
  }
});

// GET /api/company/audit-logs
app.get('/api/company/audit-logs', requireCompanyPermission('company:audit:read'), (req: Request, res: Response) => {
  try {
    const company = (req as any).companyAccount;
    const logs = bionexaDb.getCompanyAuditLogs(company.id, 100);
    res.json({ success: true, logs });
  } catch (err: any) {
    sendApiError(res, 500, 'Audit Log Error', 'COMPANY_AUDIT_LOGS_FAILED', err.message || 'Unable to load company audit logs.');
  }
});

// =========================================================================
// PHASE 15: ADMIN EMPLOYER APPROVAL, SUSPENSION & AUDIT ENDPOINTS
// =========================================================================

// GET /api/admin/companies
app.get('/api/admin/companies', requireAdminPermission('dashboard:read'), (_req: Request, res: Response) => {
  try {
    const rows = bionexaDb.listAllCompaniesAdmin();
    const companies = rows.map((row) => ({
      ...toSafeCompanyProfile(row),
      jobCount: row.jobCount,
    }));
    const summary = {
      total: companies.length,
      verified: companies.filter((c) => c.verificationStatus === 'verified').length,
      pendingReview: companies.filter((c) => c.verificationStatus === 'pending_review').length,
      unverified: companies.filter((c) => c.verificationStatus === 'unverified').length,
      rejected: companies.filter((c) => c.verificationStatus === 'rejected').length,
      suspended: companies.filter((c) => c.accountStatus === 'suspended').length,
    };
    res.json({ success: true, companies, summary });
  } catch (err: any) {
    sendApiError(res, 500, 'Admin Companies Error', 'ADMIN_COMPANIES_LIST_FAILED', err.message || 'Unable to load registered employers.');
  }
});

// GET /api/admin/companies/audit-logs
app.get('/api/admin/companies/audit-logs', requireAdminPermission('audit:read'), (req: Request, res: Response) => {
  try {
    const companyId = typeof req.query.companyId === 'string' && req.query.companyId.trim()
      ? req.query.companyId.trim()
      : undefined;
    const logs = bionexaDb.getCompanyAuditLogs(companyId, 150);
    res.json({ success: true, logs });
  } catch (err: any) {
    sendApiError(res, 500, 'Admin Audit Error', 'ADMIN_COMPANY_AUDIT_FAILED', err.message || 'Unable to load employer audit logs.');
  }
});

// POST /api/admin/companies/:id/verify (Approve / Reject / Revoke Verification)
app.post('/api/admin/companies/:id/verify', requireAdminPermission('jobs:verify'), (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;
    const decisionRaw = String(req.body?.decision || '').trim().toLowerCase();
    const notesOrReason = String(req.body?.notes || req.body?.reason || '').trim().slice(0, 500);
    if (decisionRaw !== 'verified' && decisionRaw !== 'rejected' && decisionRaw !== 'unverified') {
      sendApiError(res, 400, 'Validation Error', 'INVALID_DECISION', 'Decision must be "verified", "rejected", or "unverified".');
      return;
    }

    const updated = bionexaDb.setCompanyVerificationDecisionAdmin(
      req.params.id,
      decisionRaw,
      adminUser?.username || adminUser?.email || 'admin',
      notesOrReason
    );
    if (!updated) {
      sendApiError(res, 404, 'Not Found', 'COMPANY_NOT_FOUND', 'Company account not found.');
      return;
    }

    const maskedIp = maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown');
    const actionName =
      decisionRaw === 'verified'
        ? 'ADMIN_EMPLOYER_APPROVED'
        : decisionRaw === 'rejected'
        ? 'ADMIN_EMPLOYER_REJECTED'
        : 'ADMIN_EMPLOYER_VERIFICATION_REVOKED';

    bionexaDb.createCompanyAuditLog({
      companyId: updated.id,
      actorType: 'admin',
      actorId: adminUser?.id || 'admin',
      actorEmail: adminUser?.email || adminUser?.username || 'admin',
      action: actionName,
      targetType: 'verification',
      targetId: updated.id,
      status: 'success',
      ipMasked: maskedIp,
      details: notesOrReason || `Verification status set to '${decisionRaw}' for ${updated.organizationName}.`,
    });

    auditAdminAction(req, actionName, 'company_accounts', updated.id, {
      organizationName: updated.organizationName,
      decision: decisionRaw,
      notes: notesOrReason || undefined,
    });

    res.json({
      success: true,
      company: toSafeCompanyProfile(updated),
      message:
        decisionRaw === 'verified'
          ? `${updated.organizationName} is now a Verified Employer.`
          : decisionRaw === 'rejected'
          ? `Employer verification rejected for ${updated.organizationName}.`
          : `Employer verification status reset to Unverified for ${updated.organizationName}.`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Admin Verify Error', 'ADMIN_COMPANY_VERIFY_FAILED', err.message || 'Unable to update employer verification.');
  }
});

// POST /api/admin/companies/:id/suspend
app.post('/api/admin/companies/:id/suspend', requireAdminPermission('jobs:verify'), (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (reason.length < 5) {
      sendApiError(res, 400, 'Validation Error', 'REASON_REQUIRED', 'Please provide a suspension reason (at least 5 characters).');
      return;
    }

    const result = bionexaDb.setCompanyAccountStatusAdmin(
      req.params.id,
      'suspended',
      adminUser?.username || adminUser?.email || 'admin',
      reason
    );
    if (!result.company) {
      sendApiError(res, 404, 'Not Found', 'COMPANY_NOT_FOUND', 'Company account not found.');
      return;
    }

    const maskedIp = maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown');
    bionexaDb.createCompanyAuditLog({
      companyId: result.company.id,
      actorType: 'admin',
      actorId: adminUser?.id || 'admin',
      actorEmail: adminUser?.email || adminUser?.username || 'admin',
      action: 'ADMIN_COMPANY_SUSPENDED',
      targetType: 'company',
      targetId: result.company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: `Suspended account (${result.revokedSessions} session(s) revoked). Reason: ${reason}`,
    });

    auditAdminAction(req, 'ADMIN_COMPANY_SUSPENDED', 'company_accounts', result.company.id, {
      organizationName: result.company.organizationName,
      reason,
      revokedSessions: result.revokedSessions,
    });

    res.json({
      success: true,
      company: toSafeCompanyProfile(result.company),
      revokedSessions: result.revokedSessions,
      message: `${result.company.organizationName} has been suspended and ${result.revokedSessions} active session(s) were revoked.`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Admin Suspend Error', 'ADMIN_COMPANY_SUSPEND_FAILED', err.message || 'Unable to suspend company account.');
  }
});

// POST /api/admin/companies/:id/reinstate
app.post('/api/admin/companies/:id/reinstate', requireAdminPermission('jobs:verify'), (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;
    const notes = String(req.body?.notes || '').trim().slice(0, 500);

    const result = bionexaDb.setCompanyAccountStatusAdmin(
      req.params.id,
      'active',
      adminUser?.username || adminUser?.email || 'admin',
      ''
    );
    if (!result.company) {
      sendApiError(res, 404, 'Not Found', 'COMPANY_NOT_FOUND', 'Company account not found.');
      return;
    }

    const maskedIp = maskIpAddress(req.ip || req.socket.remoteAddress || 'unknown');
    bionexaDb.createCompanyAuditLog({
      companyId: result.company.id,
      actorType: 'admin',
      actorId: adminUser?.id || 'admin',
      actorEmail: adminUser?.email || adminUser?.username || 'admin',
      action: 'ADMIN_COMPANY_REINSTATED',
      targetType: 'company',
      targetId: result.company.id,
      status: 'success',
      ipMasked: maskedIp,
      details: notes || `Reinstated employer account for ${result.company.organizationName}.`,
    });

    auditAdminAction(req, 'ADMIN_COMPANY_REINSTATED', 'company_accounts', result.company.id, {
      organizationName: result.company.organizationName,
      notes: notes || undefined,
    });

    res.json({
      success: true,
      company: toSafeCompanyProfile(result.company),
      message: `${result.company.organizationName} account has been reinstated.`,
    });
  } catch (err: any) {
    sendApiError(res, 500, 'Admin Reinstate Error', 'ADMIN_COMPANY_REINSTATE_FAILED', err.message || 'Unable to reinstate company account.');
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
