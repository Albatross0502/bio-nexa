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
  LoginRateLimiter,
  AdminSessionManager,
  AdminUser
} from './src/services/admin/adminAuthService.js';
import { SEED_JOBS, SEED_COURSES } from './src/data/seedData.js';
import { SEED_OPPORTUNITIES } from './src/services/opportunities/seedOpportunities.js';
import { bionexaDb, DbJob, DbWorkshop, DbCourse } from './src/db/bionexaDatabase.js';
import { automatedJobManager, AUTHORIZED_SOURCES } from './src/services/jobs/automatedJobManager.js';

const PORT = 3000;
const app = express();

app.use(express.json());
app.use(cookieParser());

// Initialize Rate Limiter & Session Manager
const rateLimiter = new LoginRateLimiter();
const sessionManager = new AdminSessionManager();

// Configure master administrator credentials via environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@bionexa.org';
const DEFAULT_RAW_PASSWORD = process.env.ADMIN_PASSWORD || 'BioNexa@2026!Admin';
const ADMIN_PASSWORD_HASH = hashPassword(DEFAULT_RAW_PASSWORD);

const MASTER_ADMIN: AdminUser = {
  id: 'admin-master-001',
  username: ADMIN_USERNAME,
  email: 'admin@bionexa.org',
  name: 'BIO-NEXA Operations Admin',
  role: 'admin'
};

// Seed relational database with verified biotechnology data if empty
try {
  bionexaDb.seedInitialDataIfEmpty(
    SEED_JOBS,
    SEED_OPPORTUNITIES.filter((o) => o.type === 'workshop'),
    SEED_COURSES
  );
  console.log('[BIO-NEXA DB] Database initialized and verified.');
} catch (err) {
  console.error('[BIO-NEXA DB] Seeding error:', err);
}

// -------------------------------------------------------------
// Input Validation Helpers
// -------------------------------------------------------------

function isValidHttpUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function sanitizeString(str: any): string {
  if (typeof str !== 'string') return '';
  return str.trim();
}

// -------------------------------------------------------------
// Authentication Helper Middleware
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

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Authentication Required',
      message: 'Admin credentials required to perform this action.'
    });
    return;
  }

  const session = sessionManager.validateSession(token);
  if (!session) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired administrative session.'
    });
    return;
  }

  (req as any).adminUser = session.user;
  next();
}

// -------------------------------------------------------------
// PUBLIC REST API ENDPOINTS
// -------------------------------------------------------------

// GET /api/jobs
app.get('/api/jobs', (req: Request, res: Response) => {
  try {
    const { search, sector, location } = req.query;
    const jobs = bionexaDb.getJobs({
      search: search ? String(search) : undefined,
      sector: sector ? String(sector) : undefined,
      location: location ? String(location) : undefined,
      onlyActive: true,
      onlyApproved: true
    });

    res.json({ success: true, count: jobs.length, jobs });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
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

    if (!isValidHttpUrl(applicationUrl)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid applicationUrl: Must be a valid URL starting with http:// or https://'
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
      publicationDate: new Date().toISOString().split('T')[0],
      expiryDate: sanitizeString(body.expiryDate || body.deadline || ''),
      verificationStatus: 'Pending Review',
      isActive: true,
      isApproved: false, // Requires Admin Moderation
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

// GET /api/workshops
app.get('/api/workshops', (_req: Request, res: Response) => {
  try {
    const workshops = bionexaDb.getWorkshops(true);
    res.json({ success: true, count: workshops.length, workshops });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/workshops/:id
app.get('/api/workshops/:id', (req: Request, res: Response) => {
  try {
    const workshop = bionexaDb.getWorkshopById(req.params.id);
    if (!workshop) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }
    res.json({ success: true, workshop });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/courses
app.get('/api/courses', (_req: Request, res: Response) => {
  try {
    const courses = bionexaDb.getCourses(true);
    res.json({ success: true, count: courses.length, courses });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/courses/:id
app.get('/api/courses/:id', (req: Request, res: Response) => {
  try {
    const course = bionexaDb.getCourseById(req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }
    res.json({ success: true, course });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/announcements
app.get('/api/announcements', (_req: Request, res: Response) => {
  try {
    const announcements = bionexaDb.getAnnouncements(true);
    res.json({ success: true, count: announcements.length, announcements });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
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
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/admin/login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body;

  const check = rateLimiter.check(ip);
  if (!check.allowed) {
    const remainingSeconds = check.retryAfterSec || 900;
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Account locked due to consecutive failed attempts. Retry in ${remainingSeconds} seconds.`,
      retryAfterSec: remainingSeconds
    });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: 'Bad Request', message: 'Username and password required.' });
    return;
  }

  const normalizedInput = username.trim().toLowerCase();
  const validUser = normalizedInput === ADMIN_USERNAME.toLowerCase() || normalizedInput === 'admin';
  const validPass = verifyPassword(password, ADMIN_PASSWORD_HASH);

  if (!validUser || !validPass) {
    const failure = rateLimiter.recordFailure(ip);
    const postCheck = rateLimiter.check(ip);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid administrator credentials.',
      remainingAttempts: postCheck.remainingAttempts,
      isLocked: failure.isLocked
    });
    return;
  }

  rateLimiter.reset(ip);
  const session = sessionManager.createSession(MASTER_ADMIN);

  res.cookie('bionexa_admin_session', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  res.json({
    success: true,
    message: 'Administrative session authenticated successfully.',
    token: session.token,
    user: session.user,
    expiresAt: session.expiresAt
  });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    sessionManager.destroySession(token);
  }

  res.clearCookie('bionexa_admin_session');
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

  const session = sessionManager.validateSession(token);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt
  });
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
    applicationUrl: j.applicationUrl,
    status: j.isActive ? 'Active' : 'Expired',
    featured: j.featured,
    isApproved: j.isApproved,
    isExpired: !j.isActive,
    sourceName: j.source,
    verificationStatus: j.verificationStatus
  };
}

function formatWorkshopForAdmin(w: DbWorkshop) {
  return {
    id: w.id,
    title: w.name,
    organizer: w.instructor,
    location: w.venue,
    workMode: 'Hybrid',
    startDate: w.date,
    endDate: w.date,
    duration: w.duration,
    fees: w.fees,
    capacity: w.capacity,
    registrationUrl: w.registrationLink,
    description: w.description,
    skillsCovered: w.skillsCovered,
    status: w.status,
    isApproved: true
  };
}

function formatCourseForAdmin(c: DbCourse) {
  return {
    id: c.id,
    title: c.name,
    instructor: c.instructor,
    category: c.category,
    duration: c.duration,
    level: c.level,
    price: c.fees,
    description: c.description,
    syllabus: c.curriculum,
    prerequisites: ['Basic Biology knowledge', 'Enthusiasm for Biotechnology'],
    featured: c.featured,
    isCertificateAvailable: c.isCertificateAvailable
  };
}

// GET /api/admin/data
app.get('/api/admin/data', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const rawJobs = bionexaDb.getAllJobsAdmin();
    const rawWorkshops = bionexaDb.getWorkshops(false);
    const rawCourses = bionexaDb.getCourses(false);
    const rawAnnouncements = bionexaDb.getAnnouncements(false);
    const highlights = bionexaDb.getContent('homepage_highlights', {
      heroBadge: 'National Life Sciences Career & Research Gateway',
      bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
      activeVacanciesCount: '23+ Active Biotech Openings',
      participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers'
    });

    const content = {
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

    res.json({
      jobs: rawJobs.map(formatJobForAdmin),
      workshops: rawWorkshops.map(formatWorkshopForAdmin),
      courses: rawCourses.map(formatCourseForAdmin),
      content
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// POST /api/admin/jobs (Add Job)
app.post('/api/admin/jobs', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const body = req.body;
    const title = sanitizeString(body.title);
    const employer = sanitizeString(body.company || body.employer);
    const applicationUrl = sanitizeString(body.applicationUrl);

    if (!title || !employer || !applicationUrl) {
      res.status(400).json({ error: 'Validation Error', message: 'Title, company/employer, and applicationUrl are required.' });
      return;
    }

    if (!isValidHttpUrl(applicationUrl)) {
      res.status(400).json({ error: 'Validation Error', message: 'Application URL must start with http:// or https://' });
      return;
    }

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
      expiryDate: sanitizeString(body.deadline || '2026-12-31'),
      applicationUrl,
      publicationDate: new Date().toISOString().split('T')[0],
      verificationStatus: 'Verified',
      isActive: true,
      isApproved: true,
      featured: Boolean(body.featured),
      source: sanitizeString(body.sourceName || 'BIO-NEXA Verified Listing')
    });

    res.status(201).json({ success: true, job: formatJobForAdmin(job) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/jobs/:id (Edit Job)
app.put('/api/admin/jobs/:id', requireAdminAuth, (req: Request, res: Response) => {
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

    res.json({ success: true, job: formatJobForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/jobs/:id (Delete Job)
app.delete('/api/admin/jobs/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteJob(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    res.json({ success: true, message: `Job ${id} permanently deleted from database.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PATCH & PUT /api/admin/jobs/:id/status (Update Status/Expiry/Approval)
const handleJobStatusUpdate = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isApproved, isExpired } = req.body;

    const updates: Partial<DbJob> = {};
    if (isApproved !== undefined) updates.isApproved = Boolean(isApproved);
    if (isExpired !== undefined) updates.isActive = !isExpired;
    if (status === 'Expired' || status === 'expired') updates.isActive = false;
    if (status === 'Active' || status === 'active') updates.isActive = true;

    const updated = bionexaDb.updateJob(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Job opening not found.' });
      return;
    }

    res.json({ success: true, job: formatJobForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
};

app.patch('/api/admin/jobs/:id/status', requireAdminAuth, handleJobStatusUpdate);
app.put('/api/admin/jobs/:id/status', requireAdminAuth, handleJobStatusUpdate);

// POST /api/admin/jobs/:id/verify (Audit Verification)
app.post('/api/admin/jobs/:id/verify', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminUser = (req as any).adminUser;

    const verified = bionexaDb.verifyJob(
      id,
      adminUser?.email || 'admin@bionexa.org',
      status || 'Verified',
      notes || 'Verified through official portal check'
    );

    if (!verified) {
      res.status(404).json({ error: 'Not Found', message: 'Job not found.' });
      return;
    }

    const updated = bionexaDb.getJobById(id)!;
    res.json({ success: true, job: formatJobForAdmin(updated), message: 'Job verified and recorded in audit log.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// B. Workshops Management Endpoints
// -------------------------------------------------------------

// POST /api/admin/workshops (Add Workshop)
app.post('/api/admin/workshops', requireAdminAuth, (req: Request, res: Response) => {
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

    const ws = bionexaDb.createWorkshop({
      name,
      description: sanitizeString(body.description || 'Hands-on scientific workshop.'),
      instructor: sanitizeString(body.organizer || body.instructor || 'BIO-NEXA Faculty'),
      date: sanitizeString(body.startDate || body.date || '2026-12-01'),
      time: '09:00 AM - 05:00 PM IST',
      venue: sanitizeString(body.location || body.venue || 'Hybrid / Online'),
      registrationLink,
      availability: 'Open',
      status: 'active',
      fees: sanitizeString(body.fees || 'Free / Subsidized'),
      duration: sanitizeString(body.duration || '2 Days'),
      capacity: Number(body.capacity) || 50,
      skillsCovered: Array.isArray(body.skillsCovered) ? body.skillsCovered : []
    });

    res.status(201).json({ success: true, workshop: formatWorkshopForAdmin(ws) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/workshops/:id (Edit Workshop)
app.put('/api/admin/workshops/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Partial<DbWorkshop> = {};
    if (body.title || body.name) updates.name = sanitizeString(body.title || body.name);
    if (body.description) updates.description = sanitizeString(body.description);
    if (body.organizer || body.instructor) updates.instructor = sanitizeString(body.organizer || body.instructor);
    if (body.startDate || body.date) updates.date = sanitizeString(body.startDate || body.date);
    if (body.location || body.venue) updates.venue = sanitizeString(body.location || body.venue);
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
    if (body.capacity) updates.capacity = Number(body.capacity);
    if (Array.isArray(body.skillsCovered)) updates.skillsCovered = body.skillsCovered;
    if (body.status) updates.status = body.status;

    const updated = bionexaDb.updateWorkshop(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }

    res.json({ success: true, workshop: formatWorkshopForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/workshops/:id (Delete Workshop)
app.delete('/api/admin/workshops/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteWorkshop(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Workshop not found.' });
      return;
    }

    res.json({ success: true, message: `Workshop ${id} permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// C. Courses Management Endpoints
// -------------------------------------------------------------

// POST /api/admin/courses (Add Course)
app.post('/api/admin/courses', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const body = req.body;
    const name = sanitizeString(body.title || body.name);

    if (!name) {
      res.status(400).json({ error: 'Validation Error', message: 'Course title is required.' });
      return;
    }

    const course = bionexaDb.createCourse({
      name,
      description: sanitizeString(body.description || 'Self-paced biotechnology curriculum.'),
      duration: sanitizeString(body.duration || '10 Hours'),
      fees: sanitizeString(body.price || body.fees || 'Free'),
      eligibility: 'Open to all Science Students',
      curriculum: Array.isArray(body.syllabus) ? body.syllabus : ['Module 1: Principles', 'Module 2: Practical Lab'],
      registrationLink: `/courses/enroll`,
      availability: 'Immediate Access',
      status: 'active',
      instructor: sanitizeString(body.instructor || 'BIO-NEXA Faculty'),
      level: sanitizeString(body.level || 'Intermediate'),
      category: sanitizeString(body.category || 'Biotechnology'),
      isCertificateAvailable: true,
      featured: Boolean(body.featured)
    });

    res.status(201).json({ success: true, course: formatCourseForAdmin(course) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/courses/:id (Edit Course)
app.put('/api/admin/courses/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Partial<DbCourse> = {};
    if (body.title || body.name) updates.name = sanitizeString(body.title || body.name);
    if (body.instructor) updates.instructor = sanitizeString(body.instructor);
    if (body.category) updates.category = sanitizeString(body.category);
    if (body.duration) updates.duration = sanitizeString(body.duration);
    if (body.level) updates.level = sanitizeString(body.level);
    if (body.price || body.fees) updates.fees = sanitizeString(body.price || body.fees);
    if (body.description) updates.description = sanitizeString(body.description);
    if (Array.isArray(body.syllabus)) updates.curriculum = body.syllabus;
    if (body.featured !== undefined) updates.featured = Boolean(body.featured);

    const updated = bionexaDb.updateCourse(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    res.json({ success: true, course: formatCourseForAdmin(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// DELETE /api/admin/courses/:id (Delete Course)
app.delete('/api/admin/courses/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = bionexaDb.deleteCourse(id);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Course not found.' });
      return;
    }

    res.json({ success: true, message: `Course ${id} permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// D. Website Content & Announcements
// -------------------------------------------------------------

// GET /api/admin/content
app.get('/api/admin/content', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const rawAnnouncements = bionexaDb.getAnnouncements(false);
    const highlights = bionexaDb.getContent('homepage_highlights', {
      heroBadge: 'National Life Sciences Career & Research Gateway',
      bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
      activeVacanciesCount: '23+ Active Biotech Openings',
      participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers'
    });

    res.json({
      announcements: rawAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        tag: a.tag,
        date: a.date,
        link: a.link,
        active: a.isActive
      })),
      homepageHighlights: highlights
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// PUT /api/admin/content
app.put('/api/admin/content', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { announcements, homepageHighlights } = req.body;
    const adminUser = (req as any).adminUser;

    if (homepageHighlights !== undefined) {
      const existing = bionexaDb.getContent('homepage_highlights', {});
      bionexaDb.setContent(
        'homepage_highlights',
        { ...existing, ...homepageHighlights },
        adminUser?.email || 'admin@bionexa.org'
      );
    }

    if (Array.isArray(announcements)) {
      for (const ann of announcements) {
        if (ann.id && ann.id.startsWith('ann-')) {
          bionexaDb.updateAnnouncement(ann.id, {
            title: ann.title,
            tag: ann.tag,
            link: ann.link,
            isActive: ann.active
          });
        }
      }
    }

    res.json({ success: true, message: 'Content updated successfully in database.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Database Error', message: err.message });
  }
});

// -------------------------------------------------------------
// E. Database Backup Endpoints
// -------------------------------------------------------------

// POST /api/admin/backups (Create Point-in-Time Database Backup)
app.post('/api/admin/backups', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const backup = bionexaDb.createBackup();
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
app.get('/api/admin/backups', requireAdminAuth, (_req: Request, res: Response) => {
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
app.get('/api/admin/automated-sync/status', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const report = automatedJobManager.getLastReport();
    res.json({
      success: true,
      lastReport: report,
      sources: AUTHORIZED_SOURCES,
      isSyncing: automatedJobManager.isSyncInProgress()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Sync Status Error', message: err.message });
  }
});

// POST /api/admin/automated-sync/run (Trigger automated ingestion across authorized feeds)
app.post('/api/admin/automated-sync/run', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const report = await automatedJobManager.runAutomatedSync();
    res.json({
      success: true,
      message: `Automated sync completed: ${report.newImportedCount} new jobs imported (pending approval), ${report.duplicatesSkippedCount} duplicates skipped, ${report.expiredMarkedCount} expired flagged.`,
      report
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Automated Sync Failed', message: err.message });
  }
});

// POST /api/admin/automated-sync/check-urls (Audit external application URLs for broken 404 links)
app.post('/api/admin/automated-sync/check-urls', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const limit = typeof req.body?.limit === 'number' ? req.body.limit : 25;
    const broken = await automatedJobManager.auditApplicationUrls(limit);
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
app.post('/api/admin/automated-sync/expire', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const count = automatedJobManager.markExpiredListings();
    res.json({
      success: true,
      message: `Scanned all listings: ${count} expired listings updated.`,
      expiredCount: count
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Expiry Scan Error', message: err.message });
  }
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
    console.log(`[BIO-NEXA] Secure Server running at http://0.0.0.0:${PORT}`);
    console.log(`[BIO-NEXA] Admin credentials configured for: ${ADMIN_USERNAME}`);
    console.log(`[BIO-NEXA] Database engine active with WAL journaling and atomic backups.`);
    
    // Initial expiry audit on server boot
    try {
      const expiredCount = automatedJobManager.markExpiredListings();
      if (expiredCount > 0) {
        console.log(`[AUTOMATED-SYNC] Initial scan marked ${expiredCount} expired jobs.`);
      }
    } catch (err) {
      console.error('[AUTOMATED-SYNC] Initial expiry scan failed:', err);
    }

    // Schedule automated source checks at 6-hour intervals
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    setInterval(() => {
      console.log('[AUTOMATED-SYNC] Executing scheduled 6-hour background ingestion check...');
      automatedJobManager.runAutomatedSync()
        .then(r => console.log(`[AUTOMATED-SYNC] Scheduled sync completed. New: ${r.newImportedCount}, Expired: ${r.expiredMarkedCount}`))
        .catch(err => console.error('[AUTOMATED-SYNC] Scheduled sync error:', err));
    }, SIX_HOURS_MS);
  });
}

startServer();
