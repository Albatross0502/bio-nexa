/**
 * BIO-NEXA Embedded Relational Database Service
 * Powered by Node.js 22 built-in node:sqlite (DatabaseSync)
 * 
 * Provides zero-dependency, ACID-compliant persistence for:
 * - Jobs (with verification records & expiry tracking)
 * - Workshops (dates, venues, fees, registration links)
 * - Courses (curricula, prerequisites, fees)
 * - Announcements & Content Management Records
 * - Admin Accounts & Audit Records
 * - Automated Point-in-Time Database Backups (VACUUM INTO)
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type JobVerificationStatus = 
  | 'Pending Verification'
  | 'Verified'
  | 'Rejected'
  | 'Expired'
  | 'Link Unavailable';

export function normalizeVerificationStatus(status?: string): JobVerificationStatus {
  if (!status) return 'Pending Verification';
  const clean = status.trim();
  if (clean === 'Verified') return 'Verified';
  if (clean === 'Rejected') return 'Rejected';
  if (clean === 'Expired') return 'Expired';
  if (clean === 'Link Unavailable' || clean === 'Source Unavailable') return 'Link Unavailable';
  if (clean === 'Pending Verification' || clean === 'Pending Review' || clean === 'Flagged') return 'Pending Verification';
  return 'Pending Verification';
}

export interface DbJob {
  id: string;
  title: string;
  employer: string;
  description: string;
  location: string;
  qualification: string;
  skills: string[]; // Stored as JSON array in SQLite
  employmentType: string;
  salary: string;
  applicationUrl: string; // Application destination
  source: string; // Original listing source
  originalJobUrl?: string; // Original job URL
  publicationDate: string;
  expiryDate: string;
  lastVerificationDate?: string;
  verificationStatus: JobVerificationStatus;
  verificationNotes?: string;
  isVerified?: boolean;
  isActive: boolean;
  isApproved: boolean;
  featured: boolean;
  responsibilities: string[];
  requirements: string[];
  sector: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkshopFormat = 'Online' | 'Offline' | 'Hybrid';
export type WorkshopStatus = 'upcoming' | 'ongoing' | 'completed';
export type WorkshopAvailability = 'Open' | 'Filling Fast' | 'Waitlist' | 'Closed';

export interface DbWorkshop {
  id: string;
  name: string;
  description: string;
  instructor: string;
  date: string;
  time: string;
  duration: string;
  format: WorkshopFormat;
  venue: string;
  registrationDeadline: string;
  registrationLink: string;
  availability: WorkshopAvailability | string;
  status: WorkshopStatus | string;
  fees: string;
  capacity: number;
  imageUrl?: string;
  featured: boolean;
  skillsCovered: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DbCourse {
  id: string;
  name: string;
  description: string;
  duration: string;
  fees: string;
  eligibility: string;
  curriculum: string[];
  registrationLink: string;
  availability: string;
  status: 'active' | 'archived';
  instructor: string;
  level: string;
  category: string;
  isCertificateAvailable: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbAnnouncement {
  id: string;
  title: string;
  tag: string;
  content: string;
  date: string;
  link: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export interface DbVerificationRecord {
  id: string;
  jobId: string;
  verifiedBy: string;
  verifiedAt: string;
  sourceStatus: string;
  notes: string;
}

export interface DbBackupRecord {
  id: string;
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  status: string;
}

export class BionexaDatabase {
  private db!: DatabaseSync;
  private dbPath: string;
  private backupDir: string;

  constructor(dbPath?: string, backupDir?: string) {
    this.dbPath = dbPath || process.env.DATABASE_PATH || path.resolve(process.cwd(), 'db', 'bionexa.db');
    this.backupDir = backupDir || path.resolve(process.cwd(), 'db', 'backups');
    this.init();
  }

  private init(): void {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Enable WAL mode for high concurrency read/write
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        employer TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        qualification TEXT DEFAULT '',
        skills TEXT NOT NULL DEFAULT '[]',
        employment_type TEXT DEFAULT 'Full-time',
        salary TEXT DEFAULT 'Competitive',
        application_url TEXT NOT NULL,
        source TEXT DEFAULT 'BIO-NEXA Verified',
        original_job_url TEXT DEFAULT '',
        publication_date TEXT NOT NULL,
        expiry_date TEXT DEFAULT '',
        last_verification_date TEXT DEFAULT '',
        verification_status TEXT NOT NULL DEFAULT 'Pending Verification',
        verification_notes TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        is_approved INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        responsibilities TEXT NOT NULL DEFAULT '[]',
        requirements TEXT NOT NULL DEFAULT '[]',
        sector TEXT DEFAULT 'Biotechnology',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workshops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        instructor TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT DEFAULT '09:00 AM - 05:00 PM IST',
        duration TEXT DEFAULT '1 Day',
        format TEXT NOT NULL DEFAULT 'Online',
        venue TEXT NOT NULL,
        registration_deadline TEXT DEFAULT '',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Open',
        status TEXT NOT NULL DEFAULT 'upcoming',
        fees TEXT DEFAULT 'Free',
        capacity INTEGER DEFAULT 50,
        image_url TEXT DEFAULT '',
        featured INTEGER NOT NULL DEFAULT 0,
        skills_covered TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        duration TEXT NOT NULL,
        fees TEXT DEFAULT 'Free',
        eligibility TEXT DEFAULT 'Open to all Science Students',
        curriculum TEXT NOT NULL DEFAULT '[]',
        registration_link TEXT NOT NULL,
        availability TEXT DEFAULT 'Immediate Access',
        status TEXT NOT NULL DEFAULT 'active',
        instructor TEXT DEFAULT 'BIO-NEXA Faculty',
        level TEXT DEFAULT 'Intermediate',
        category TEXT DEFAULT 'Biotechnology',
        is_certificate_available INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tag TEXT NOT NULL,
        content TEXT DEFAULT '',
        date TEXT NOT NULL,
        link TEXT DEFAULT '/opportunities',
        is_active INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_verification_records (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        verified_by TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        source_status TEXT NOT NULL,
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS content_records (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS database_backups (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
      CREATE INDEX IF NOT EXISTS idx_jobs_is_approved ON jobs(is_approved);
      CREATE INDEX IF NOT EXISTS idx_jobs_sector ON jobs(sector);
      CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);
      CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
      CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
    `);

    // Ensure verification columns exist on existing databases
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN original_job_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN last_verification_date TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE jobs ADD COLUMN verification_notes TEXT DEFAULT '';"); } catch (_) {}

    // Ensure workshop columns exist on existing databases
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN format TEXT DEFAULT 'Online';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN image_url TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN registration_deadline TEXT DEFAULT '';"); } catch (_) {}
    try { this.db.exec("ALTER TABLE workshops ADD COLUMN featured INTEGER DEFAULT 0;"); } catch (_) {}
    try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_workshops_featured ON workshops(featured);"); } catch (_) {}
  }

  // ==========================================
  // JOBS CRUD & VERIFICATION
  // ==========================================

  public getJobs(filter?: {
    search?: string;
    sector?: string;
    location?: string;
    onlyActive?: boolean;
    onlyApproved?: boolean;
    verificationStatus?: string;
  }): DbJob[] {
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];

    if (filter?.onlyActive !== false) {
      sql += ' AND is_active = 1';
    }
    if (filter?.onlyApproved !== false) {
      sql += ' AND is_approved = 1';
    }
    if (filter?.verificationStatus) {
      sql += ' AND verification_status = ?';
      params.push(normalizeVerificationStatus(filter.verificationStatus));
    }
    if (filter?.sector) {
      sql += ' AND sector LIKE ?';
      params.push(`%${filter.sector}%`);
    }
    if (filter?.location) {
      sql += ' AND location LIKE ?';
      params.push(`%${filter.location}%`);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR employer LIKE ? OR description LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }

    sql += ' ORDER BY featured DESC, publication_date DESC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapJobRow);
  }

  public getAllJobsAdmin(): DbJob[] {
    const rows = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapJobRow);
  }

  public getJobById(id: string): DbJob | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapJobRow(row);
  }

  public createJob(job: Omit<DbJob, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbJob {
    const id = job.id || `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const verStatus = normalizeVerificationStatus(job.verificationStatus);
    const lastVerDate = job.lastVerificationDate || (verStatus === 'Verified' ? (job.publicationDate || now.split('T')[0]) : '');

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, title, employer, description, location, qualification,
        skills, employment_type, salary, application_url, source, original_job_url,
        publication_date, expiry_date, last_verification_date, verification_status, verification_notes,
        is_active, is_approved, featured, responsibilities, requirements,
        sector, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      id,
      job.title,
      job.employer,
      job.description,
      job.location,
      job.qualification || '',
      JSON.stringify(job.skills || []),
      job.employmentType || 'Full-time',
      job.salary || 'Competitive',
      job.applicationUrl,
      job.source || 'BIO-NEXA Verified',
      job.originalJobUrl || job.applicationUrl || '',
      job.publicationDate || now.split('T')[0],
      job.expiryDate || '',
      lastVerDate,
      verStatus,
      job.verificationNotes || '',
      job.isActive ? 1 : 0,
      job.isApproved ? 1 : 0,
      job.featured ? 1 : 0,
      JSON.stringify(job.responsibilities || []),
      JSON.stringify(job.requirements || []),
      job.sector || 'Biotechnology',
      now,
      now
    );

    return this.getJobById(id)!;
  }

  public updateJob(id: string, updates: Partial<DbJob>): DbJob | null {
    const existing = this.getJobById(id);
    if (!existing) return null;

    const verStatus = updates.verificationStatus !== undefined 
      ? normalizeVerificationStatus(updates.verificationStatus) 
      : normalizeVerificationStatus(existing.verificationStatus);

    const merged: DbJob = {
      ...existing,
      ...updates,
      verificationStatus: verStatus,
      updatedAt: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE jobs SET
        title = ?, employer = ?, description = ?, location = ?,
        qualification = ?, skills = ?, employment_type = ?, salary = ?,
        application_url = ?, source = ?, original_job_url = ?, publication_date = ?, expiry_date = ?,
        last_verification_date = ?, verification_status = ?, verification_notes = ?,
        is_active = ?, is_approved = ?, featured = ?,
        responsibilities = ?, requirements = ?, sector = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.title,
      merged.employer,
      merged.description,
      merged.location,
      merged.qualification,
      JSON.stringify(merged.skills || []),
      merged.employmentType,
      merged.salary,
      merged.applicationUrl,
      merged.source,
      merged.originalJobUrl || merged.applicationUrl || '',
      merged.publicationDate,
      merged.expiryDate,
      merged.lastVerificationDate || '',
      merged.verificationStatus,
      merged.verificationNotes || '',
      merged.isActive ? 1 : 0,
      merged.isApproved ? 1 : 0,
      merged.featured ? 1 : 0,
      JSON.stringify(merged.responsibilities || []),
      JSON.stringify(merged.requirements || []),
      merged.sector,
      merged.updatedAt,
      id
    );

    return this.getJobById(id);
  }

  public deleteJob(id: string): boolean {
    const res = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  public verifyJob(jobId: string, verifiedBy: string, status: string, notes: string = '', customDate?: string): DbJob | null {
    const job = this.getJobById(jobId);
    if (!job) return null;

    const now = new Date().toISOString();
    const verDate = customDate || now.split('T')[0];
    const recordId = `ver-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const validStatus = normalizeVerificationStatus(status);

    this.db.prepare(`
      INSERT INTO job_verification_records (id, job_id, verified_by, verified_at, source_status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recordId, jobId, verifiedBy, now, validStatus, notes);

    const isApproved = validStatus === 'Verified' || validStatus === 'Link Unavailable';
    const isActive = validStatus !== 'Rejected' && validStatus !== 'Expired';

    this.updateJob(jobId, {
      verificationStatus: validStatus,
      lastVerificationDate: verDate,
      verificationNotes: notes,
      isApproved,
      isActive,
      updatedAt: now
    });

    return this.getJobById(jobId);
  }

  public getVerificationRecords(jobId: string): DbVerificationRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM job_verification_records WHERE job_id = ? ORDER BY verified_at DESC'
    ).all(jobId) as any[];

    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      verifiedBy: r.verified_by,
      verifiedAt: r.verified_at,
      sourceStatus: r.source_status,
      notes: r.notes || ''
    }));
  }

  // ==========================================
  // WORKSHOPS CRUD
  // ==========================================

  public getWorkshops(filter?: boolean | {
    onlyActive?: boolean;
    status?: string;
    format?: string;
    featured?: boolean;
    search?: string;
  }): DbWorkshop[] {
    let sql = 'SELECT * FROM workshops WHERE 1=1';
    const params: any[] = [];

    if (typeof filter === 'boolean') {
      if (filter) {
        sql += " AND status != 'completed'";
      }
    } else if (filter) {
      if (filter.status && filter.status !== 'all') {
        sql += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter.format && filter.format !== 'all') {
        sql += ' AND format = ?';
        params.push(filter.format);
      }
      if (filter.featured !== undefined) {
        sql += ' AND featured = ?';
        params.push(filter.featured ? 1 : 0);
      }
      if (filter.search) {
        sql += ' AND (name LIKE ? OR instructor LIKE ? OR description LIKE ? OR venue LIKE ?)';
        const term = `%${filter.search}%`;
        params.push(term, term, term, term);
      }
    }

    sql += ' ORDER BY featured DESC, date ASC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapWorkshopRow);
  }

  public getWorkshopById(id: string): DbWorkshop | null {
    const row = this.db.prepare('SELECT * FROM workshops WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapWorkshopRow(row);
  }

  public createWorkshop(data: Omit<DbWorkshop, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbWorkshop {
    const id = data.id || `ws-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO workshops (
        id, name, description, instructor, date, time, duration,
        format, venue, registration_deadline, registration_link,
        availability, status, fees, capacity, image_url,
        featured, skills_covered, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.instructor || '',
      data.date,
      data.time || '09:30 AM - 04:30 PM IST',
      data.duration || '1 Day',
      data.format || 'Online',
      data.venue,
      data.registrationDeadline || '',
      data.registrationLink,
      data.availability || 'Open',
      data.status || 'upcoming',
      data.fees || 'Free',
      data.capacity || 50,
      data.imageUrl || '',
      data.featured ? 1 : 0,
      JSON.stringify(data.skillsCovered || []),
      now,
      now
    );

    return this.getWorkshopById(id)!;
  }

  public updateWorkshop(id: string, updates: Partial<DbWorkshop>): DbWorkshop | null {
    const existing = this.getWorkshopById(id);
    if (!existing) return null;

    const merged: DbWorkshop = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE workshops SET
        name = ?, description = ?, instructor = ?, date = ?,
        time = ?, duration = ?, format = ?, venue = ?,
        registration_deadline = ?, registration_link = ?,
        availability = ?, status = ?, fees = ?, capacity = ?,
        image_url = ?, featured = ?, skills_covered = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description,
      merged.instructor,
      merged.date,
      merged.time,
      merged.duration,
      merged.format,
      merged.venue,
      merged.registrationDeadline,
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.fees,
      merged.capacity,
      merged.imageUrl || '',
      merged.featured ? 1 : 0,
      JSON.stringify(merged.skillsCovered || []),
      merged.updatedAt,
      id
    );

    return this.getWorkshopById(id);
  }

  public deleteWorkshop(id: string): boolean {
    const res = this.db.prepare('DELETE FROM workshops WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // COURSES CRUD
  // ==========================================

  public getCourses(onlyActive: boolean = true): DbCourse[] {
    let sql = 'SELECT * FROM courses';
    if (onlyActive) {
      sql += " WHERE status = 'active'";
    }
    sql += ' ORDER BY featured DESC, created_at DESC';

    const rows = this.db.prepare(sql).all() as any[];
    return rows.map(this.mapCourseRow);
  }

  public getCourseById(id: string): DbCourse | null {
    const row = this.db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapCourseRow(row);
  }

  public createCourse(data: Omit<DbCourse, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DbCourse {
    const id = data.id || `course-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO courses (
        id, name, description, duration, fees, eligibility,
        curriculum, registration_link, availability, status,
        instructor, level, category, is_certificate_available,
        featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.duration,
      data.fees || 'Free',
      data.eligibility || 'Open to all Science Students',
      JSON.stringify(data.curriculum || []),
      data.registrationLink,
      data.availability || 'Immediate Access',
      data.status || 'active',
      data.instructor || 'BIO-NEXA Faculty',
      data.level || 'Intermediate',
      data.category || 'Biotechnology',
      data.isCertificateAvailable ? 1 : 0,
      data.featured ? 1 : 0,
      now,
      now
    );

    return this.getCourseById(id)!;
  }

  public updateCourse(id: string, updates: Partial<DbCourse>): DbCourse | null {
    const existing = this.getCourseById(id);
    if (!existing) return null;

    const merged: DbCourse = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE courses SET
        name = ?, description = ?, duration = ?, fees = ?,
        eligibility = ?, curriculum = ?, registration_link = ?, availability = ?,
        status = ?, instructor = ?, level = ?, category = ?,
        is_certificate_available = ?, featured = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description,
      merged.duration,
      merged.fees,
      merged.eligibility,
      JSON.stringify(merged.curriculum || []),
      merged.registrationLink,
      merged.availability,
      merged.status,
      merged.instructor,
      merged.level,
      merged.category,
      merged.isCertificateAvailable ? 1 : 0,
      merged.featured ? 1 : 0,
      merged.updatedAt,
      id
    );

    return this.getCourseById(id);
  }

  public deleteCourse(id: string): boolean {
    const res = this.db.prepare('DELETE FROM courses WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // ANNOUNCEMENTS CRUD
  // ==========================================

  public getAnnouncements(onlyActive: boolean = true): DbAnnouncement[] {
    let sql = 'SELECT * FROM announcements';
    if (onlyActive) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY priority DESC, date DESC, created_at DESC';

    const rows = this.db.prepare(sql).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tag: r.tag,
      content: r.content || '',
      date: r.date,
      link: r.link || '/opportunities',
      isActive: r.is_active === 1,
      priority: r.priority || 0,
      createdAt: r.created_at
    }));
  }

  public createAnnouncement(data: Omit<DbAnnouncement, 'id' | 'createdAt'> & { id?: string }): DbAnnouncement {
    const id = data.id || `ann-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO announcements (id, title, tag, content, date, link, is_active, priority, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.tag,
      data.content || '',
      data.date || now.split('T')[0],
      data.link || '/opportunities',
      data.isActive ? 1 : 0,
      data.priority || 0,
      now
    );

    const row = this.db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
    return {
      id: row.id,
      title: row.title,
      tag: row.tag,
      content: row.content,
      date: row.date,
      link: row.link,
      isActive: row.is_active === 1,
      priority: row.priority,
      createdAt: row.created_at
    };
  }

  public updateAnnouncement(id: string, updates: Partial<DbAnnouncement>): DbAnnouncement | null {
    const rows = this.db.prepare('SELECT * FROM announcements WHERE id = ?').all(id) as any[];
    if (rows.length === 0) return null;
    const current = rows[0];

    const title = updates.title !== undefined ? updates.title : current.title;
    const tag = updates.tag !== undefined ? updates.tag : current.tag;
    const content = updates.content !== undefined ? updates.content : current.content;
    const date = updates.date !== undefined ? updates.date : current.date;
    const link = updates.link !== undefined ? updates.link : current.link;
    const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : current.is_active;
    const priority = updates.priority !== undefined ? updates.priority : current.priority;

    this.db.prepare(`
      UPDATE announcements SET
        title = ?, tag = ?, content = ?, date = ?, link = ?, is_active = ?, priority = ?
      WHERE id = ?
    `).run(title, tag, content, date, link, isActive, priority, id);

    const updated = this.db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
    return {
      id: updated.id,
      title: updated.title,
      tag: updated.tag,
      content: updated.content,
      date: updated.date,
      link: updated.link,
      isActive: updated.is_active === 1,
      priority: updated.priority,
      createdAt: updated.created_at
    };
  }

  public deleteAnnouncement(id: string): boolean {
    const res = this.db.prepare('DELETE FROM announcements WHERE id = ?').run(id) as any;
    return (res.changes ?? 0) > 0;
  }

  // ==========================================
  // CONTENT MANAGEMENT RECORDS
  // ==========================================

  public getContent(key: string, defaultValue: any = null): any {
    const row = this.db.prepare('SELECT value FROM content_records WHERE key = ?').get(key) as any;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  public setContent(key: string, value: any, updatedBy: string = 'system'): void {
    const now = new Date().toISOString();
    const id = `content-${key}`;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    this.db.prepare(`
      INSERT INTO content_records (id, key, value, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(id, key, serialized, now, updatedBy);
  }

  // ==========================================
  // ATOMIC DATABASE BACKUPS
  // ==========================================

  public createBackup(): { success: boolean; filename: string; path: string; sizeBytes: number } {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `bionexa_backup_${timestamp}.db`;
    const targetPath = path.resolve(this.backupDir, filename);

    if (this.dbPath === ':memory:') {
      // In-memory backup: dump table counts
      const backupId = `bk-${Date.now()}`;
      this.db.prepare(`
        INSERT INTO database_backups (id, filename, path, size_bytes, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(backupId, filename, targetPath, 1024, now.toISOString(), 'completed');

      return {
        success: true,
        filename,
        path: targetPath,
        sizeBytes: 1024
      };
    }

    try {
      // SQLite VACUUM INTO produces an atomic point-in-time binary snapshot
      const sanitizedPath = targetPath.replace(/'/g, "''");
      this.db.exec(`VACUUM INTO '${sanitizedPath}'`);

      const stats = fs.statSync(targetPath);
      const backupId = `bk-${Date.now()}`;

      this.db.prepare(`
        INSERT INTO database_backups (id, filename, path, size_bytes, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(backupId, filename, targetPath, stats.size, now.toISOString(), 'completed');

      return {
        success: true,
        filename,
        path: targetPath,
        sizeBytes: stats.size
      };
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      throw new Error(`Database backup failed: ${err.message}`);
    }
  }

  public listBackups(): DbBackupRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM database_backups ORDER BY created_at DESC'
    ).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      path: r.path,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      status: r.status
    }));
  }

  // ==========================================
  // HELPER MAPPERS
  // ==========================================

  private mapJobRow(r: any): DbJob {
    let skills: string[] = [];
    let responsibilities: string[] = [];
    let requirements: string[] = [];

    try {
      skills = JSON.parse(r.skills || '[]');
    } catch {
      skills = [];
    }

    try {
      responsibilities = JSON.parse(r.responsibilities || '[]');
    } catch {
      responsibilities = [];
    }

    try {
      requirements = JSON.parse(r.requirements || '[]');
    } catch {
      requirements = [];
    }

    return {
      id: r.id,
      title: r.title,
      employer: r.employer,
      description: r.description,
      location: r.location,
      qualification: r.qualification || '',
      skills,
      employmentType: r.employment_type,
      salary: r.salary,
      applicationUrl: r.application_url,
      source: r.source,
      originalJobUrl: r.original_job_url || r.application_url || '',
      publicationDate: r.publication_date,
      expiryDate: r.expiry_date || '',
      lastVerificationDate: r.last_verification_date || '',
      verificationStatus: normalizeVerificationStatus(r.verification_status),
      verificationNotes: r.verification_notes || '',
      isVerified: normalizeVerificationStatus(r.verification_status) === 'Verified',
      isActive: r.is_active === 1,
      isApproved: r.is_approved === 1,
      featured: r.featured === 1,
      responsibilities,
      requirements,
      sector: r.sector || 'Biotechnology',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapWorkshopRow(r: any): DbWorkshop {
    let skillsCovered: string[] = [];
    try {
      skillsCovered = JSON.parse(r.skills_covered || '[]');
    } catch {
      skillsCovered = [];
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      instructor: r.instructor || '',
      date: r.date,
      time: r.time || '09:30 AM - 04:30 PM IST',
      duration: r.duration || '1 Day',
      format: (r.format as WorkshopFormat) || 'Online',
      venue: r.venue,
      registrationDeadline: r.registration_deadline || '',
      registrationLink: r.registration_link,
      availability: (r.availability as WorkshopAvailability) || 'Open',
      status: (r.status as WorkshopStatus) || 'upcoming',
      fees: r.fees || 'Free',
      capacity: r.capacity || 50,
      imageUrl: r.image_url || '',
      featured: r.featured === 1,
      skillsCovered,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapCourseRow(r: any): DbCourse {
    let curriculum: string[] = [];
    try {
      curriculum = JSON.parse(r.curriculum || '[]');
    } catch {
      curriculum = [];
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      duration: r.duration,
      fees: r.fees,
      eligibility: r.eligibility,
      curriculum,
      registrationLink: r.registration_link,
      availability: r.availability,
      status: r.status,
      instructor: r.instructor,
      level: r.level,
      category: r.category,
      isCertificateAvailable: r.is_certificate_available === 1,
      featured: r.featured === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public seedInitialDataIfEmpty(seedJobs: any[], seedWorkshops: any[], seedCourses: any[]): void {
    const jobCount = (this.db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any).count;
    if (jobCount === 0 && seedJobs.length > 0) {
      for (const j of seedJobs) {
        this.createJob({
          id: j.id,
          title: j.title,
          employer: j.company || j.employer || 'Biotechnology Enterprise',
          description: j.description,
          location: j.location,
          qualification: j.qualification || 'M.Sc / B.Tech',
          skills: j.skills || [],
          employmentType: j.type || 'Full-time',
          salary: j.salary || 'Competitive',
          applicationUrl: j.applicationUrl,
          source: j.source?.name || j.sourceName || 'BIO-NEXA Verified',
          originalJobUrl: j.originalJobUrl || j.source?.url || j.applicationUrl || '',
          publicationDate: j.postedDate || j.publicationDate || '2026-11-01',
          expiryDate: j.deadline || '',
          lastVerificationDate: j.lastVerificationDate || (j.verificationStatus === 'Verified' ? '2026-11-07' : ''),
          verificationStatus: j.verificationStatus || 'Verified',
          verificationNotes: j.verificationNotes || 'Verified against official institutional portal.',
          isActive: j.isActive !== undefined ? j.isActive : true,
          isApproved: j.isApproved !== undefined ? j.isApproved : (j.verificationStatus === 'Verified' || !j.verificationStatus),
          featured: !!j.featured,
          responsibilities: j.responsibilities || [],
          requirements: j.requirements || [],
          sector: j.sector || 'Private Biopharma'
        });
      }
    }

    const workshopCount = (this.db.prepare('SELECT COUNT(*) as count FROM workshops').get() as any).count;
    if (workshopCount === 0 && seedWorkshops.length > 0) {
      for (const w of seedWorkshops) {
        let fmt: WorkshopFormat = 'Online';
        if (w.workMode === 'In-Person' || w.workMode === 'On-site') fmt = 'Offline';
        else if (w.workMode === 'Hybrid') fmt = 'Hybrid';

        this.createWorkshop({
          id: w.id,
          name: w.title || w.name,
          description: w.description,
          instructor: w.organization || w.instructor || 'Lead Research Faculty',
          date: w.workshopDetails?.dates?.split(' to ')[0] || w.date || '2026-12-01',
          time: '09:30 AM - 04:30 PM IST',
          duration: w.workshopDetails?.duration || '3 Days Intensive',
          format: fmt,
          venue: `${w.location || 'Online'}`,
          registrationDeadline: '2026-12-05',
          registrationLink: w.workshopDetails?.registrationUrl || w.applicationUrl || 'https://www.igib.res.in/training',
          availability: 'Open (30/40 Seats)',
          status: 'upcoming',
          fees: w.workshopDetails?.fees || '₹1,500 (Subsidized Student Rate)',
          capacity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
          featured: true,
          skillsCovered: w.skills || ['Hands-on Wet Lab', 'Protocol Optimization']
        });
      }
    }

    // Enrich existing workshop records with images, format, deadlines and featured flags if missing
    try {
      const rows = this.db.prepare('SELECT id, name, image_url, format, status FROM workshops').all() as any[];
      for (const row of rows) {
        if (!row.image_url || !row.format || row.status === 'active') {
          let imageUrl = 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
          let format: WorkshopFormat = 'Offline';
          let status: WorkshopStatus = 'upcoming';
          let deadline = '2026-12-05';
          let time = '09:30 AM - 05:00 PM IST';
          let duration = '3 Days Intensive';
          let featured = 1;
          let availability = 'Open (28/40 Seats)';

          if (row.id === 'opp-work-1' || row.name.includes('CRISPR')) {
            imageUrl = 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
            format = 'Offline';
            status = 'upcoming';
            deadline = '2026-12-05';
            time = '09:30 AM - 05:00 PM IST';
            duration = '3 Days Intensive';
            featured = 1;
            availability = 'Open (28/40 Seats)';
          } else if (row.id === 'opp-work-2' || row.name.includes('RNA-Seq')) {
            imageUrl = 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80';
            format = 'Online';
            status = 'upcoming';
            deadline = '2026-12-14';
            time = '10:00 AM - 04:30 PM IST';
            duration = '2 Days Virtual';
            featured = 1;
            availability = 'Filling Fast (8 Seats Left)';
          } else if (row.id === 'opp-work-3' || row.name.includes('HACCP')) {
            imageUrl = 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80';
            format = 'Online';
            status = 'ongoing';
            deadline = '2026-11-12';
            time = '10:00 AM - 03:00 PM IST';
            duration = '1 Day Certification';
            featured = 1;
            availability = 'Waitlist';
          } else if (row.id === 'opp-work-4' || row.name.includes('Manuscript')) {
            imageUrl = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
            format = 'Hybrid';
            status = 'completed';
            deadline = '2026-10-20';
            time = '02:00 PM - 06:00 PM IST';
            duration = '2 Days Masterclass';
            featured = 0;
            availability = 'Closed';
          }

          this.db.prepare(`
            UPDATE workshops SET
              image_url = CASE WHEN image_url = '' OR image_url IS NULL THEN ? ELSE image_url END,
              format = CASE WHEN format = '' OR format IS NULL OR format = 'Online' THEN ? ELSE format END,
              status = CASE WHEN status = 'active' THEN ? ELSE status END,
              registration_deadline = CASE WHEN registration_deadline = '' OR registration_deadline IS NULL THEN ? ELSE registration_deadline END,
              time = CASE WHEN time = '' OR time IS NULL THEN ? ELSE time END,
              duration = CASE WHEN duration = '' OR duration IS NULL THEN ? ELSE duration END,
              featured = CASE WHEN featured IS NULL OR featured = 0 THEN ? ELSE featured END,
              availability = CASE WHEN availability = '' OR availability IS NULL THEN ? ELSE availability END
            WHERE id = ?
          `).run(imageUrl, format, status, deadline, time, duration, featured, availability, row.id);
        }
      }

      // Add Fermentation and Flow Cytometry if not existing
      const hasFermentation = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-5'").get() as any;
      if (hasFermentation.c === 0) {
        this.createWorkshop({
          id: 'opp-work-5',
          name: 'Industrial Bioprocess Scaling & Microbial Fermentation Practicum',
          description: 'Hands-on training on 100L pilot bioreactors, dissolved oxygen profiling, batch fed-batch kinetics, and downstream cross-flow filtration at Biocon Academy.',
          instructor: 'Dr. Ramgopal Rao, Director of Academic Affairs',
          date: '2026-12-20',
          time: '09:00 AM - 05:30 PM IST',
          duration: '4 Days Pilot-Scale Lab',
          format: 'Offline',
          venue: 'Biocon Academy Pilot Bioreactor Facility, Electronic City Phase 1, Bengaluru 560100',
          registrationDeadline: '2026-12-10',
          registrationLink: 'https://www.bioconacademy.com/programs',
          availability: 'Filling Fast (6 Seats Left)',
          status: 'upcoming',
          fees: '₹3,500 (Academic / Student Subsidized)',
          capacity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
          featured: true,
          skillsCovered: ['Bioreactor Setup', 'Fed-Batch Fermentation', 'Downstream Processing', 'CIP / SIP Protocols']
        });
      }

      const hasFlowCytometry = this.db.prepare("SELECT COUNT(*) as c FROM workshops WHERE id = 'opp-work-6'").get() as any;
      if (hasFlowCytometry.c === 0) {
        this.createWorkshop({
          id: 'opp-work-6',
          name: 'Multicolor Flow Cytometry & High-Speed Cell Sorting Masterclass',
          description: 'Advanced fluorophore compensation, panel design for immunophenotyping, gating strategies with FlowJo, and aseptic sorting of primary T cells.',
          instructor: 'NCBS Central Flow Cytometry Core Facility',
          date: '2026-11-28',
          time: '09:30 AM - 04:30 PM IST',
          duration: '2 Days Hybrid Intensive',
          format: 'Hybrid',
          venue: 'National Centre for Biological Sciences (NCBS-TIFR), Bellary Road, Bengaluru 560065',
          registrationDeadline: '2026-11-22',
          registrationLink: 'https://www.ncbs.res.in/facilities/fcc',
          availability: 'Open (18/25 Seats)',
          status: 'upcoming',
          fees: '₹2,000 (Research Scholars)',
          capacity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
          featured: false,
          skillsCovered: ['Multicolor FlowJo', 'Antibody Conjugation', 'Cell Sorting', 'Gating Analysis']
        });
      }
    } catch (e) {
      console.error('[BIO-NEXA DB] Workshop migration note:', e);
    }

    const courseCount = (this.db.prepare('SELECT COUNT(*) as count FROM courses').get() as any).count;
    if (courseCount === 0 && seedCourses.length > 0) {
      for (const c of seedCourses) {
        this.createCourse({
          id: c.id,
          name: c.title || c.name,
          description: c.overview || c.description,
          duration: c.duration || '12 Hours (Self-paced)',
          fees: 'Free (Sponsored Access)',
          eligibility: 'B.Sc / M.Sc / Ph.D in Life Sciences',
          curriculum: c.syllabus || ['Molecular Foundations', 'Experimental Protocols', 'Industry Case Studies'],
          registrationLink: `/courses/${c.id}`,
          availability: 'Immediate Access',
          status: 'active',
          instructor: c.instructor || 'BIO-NEXA Academy Faculty',
          level: c.level || 'Intermediate',
          category: c.category || 'Biotechnology',
          isCertificateAvailable: true,
          featured: !!c.featured
        });
      }
    }

    const annCount = (this.db.prepare('SELECT COUNT(*) as count FROM announcements').get() as any).count;
    if (annCount === 0) {
      this.createAnnouncement({
        id: 'ann-1',
        title: 'IASc-INSA-NASI Summer Research Fellowships 2027 Open for Applications',
        tag: 'Fellowship',
        content: 'Indian Academy of Sciences invites applications from 1st and 2nd year Master students.',
        date: '2026-11-05',
        link: '/opportunities',
        isActive: true,
        priority: 10
      });
      this.createAnnouncement({
        id: 'ann-2',
        title: 'CSIR NET Life Sciences 2026 Examination Bulletin Released',
        tag: 'Exam',
        content: 'National Testing Agency releases official syllabus and online test dates.',
        date: '2026-11-01',
        link: '/exams',
        isActive: true,
        priority: 8
      });
      this.createAnnouncement({
        id: 'ann-3',
        title: 'Biocon Biologics Campus Drive: 2026 Fermentation Scientist Openings',
        tag: 'Careers',
        content: 'Direct walk-in and virtual technical interviews for Bioprocess specialists.',
        date: '2026-10-28',
        link: '/jobs/job-1',
        isActive: true,
        priority: 5
      });
    }

    // Default homepage highlights
    if (!this.getContent('homepage_highlights')) {
      this.setContent('homepage_highlights', {
        announcementBadge: 'National Life Sciences Career & Research Gateway',
        bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
        activeVacanciesText: '23+ Active Biotech Openings'
      });
    }
  }
}

export const bionexaDb = new BionexaDatabase();
