import React, { useState, useEffect } from 'react';
import {
  Shield,
  Briefcase,
  GraduationCap,
  Calendar,
  Globe,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  Search,
  X,
  FileCheck,
  Database,
  Activity,
  Layers,
  ChevronRight,
  Eye,
  Server,
  HardDrive,
  Star,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import {
  adminApi,
  AdminUser,
  AdminJob,
  AdminWorkshop,
  AdminCourse,
  WebsiteContent,
  AnnouncementItem
} from '../../services/admin/adminApiClient';
import { useApp } from '../../context/AppContext';
import { googleSheetsSync } from '../../services/opportunities/googleSheetsSync';
import { DATA_SOURCES } from '../../services/opportunities/sourcesRegistry';
import { AutomatedJobsPanel } from './AutomatedJobsPanel';

interface AdminDashboardProps {
  adminUser: AdminUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUser, onLogout }) => {
  const { addToast, navigate } = useApp();

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<'jobs' | 'workshops' | 'courses' | 'content' | 'sheets' | 'sources' | 'backups' | 'automation'>('jobs');
  const [jobFilterTab, setJobFilterTab] = useState<'all' | 'pending' | 'verified' | 'unverified' | 'broken' | 'expired'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Loaded Entities from Backend API
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [workshops, setWorkshops] = useState<AdminWorkshop[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [content, setContent] = useState<WebsiteContent | null>(null);

  // Search & Filters within Admin Dashboard
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<AdminJob | null>(null);

  // Phase 07 Verification Modal state
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verifyingJob, setVerifyingJob] = useState<AdminJob | null>(null);

  const [isWorkshopModalOpen, setIsWorkshopModalOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<AdminWorkshop | null>(null);
  const [workshopImagePreview, setWorkshopImagePreview] = useState<string>('');
  const [workshopStatusFilter, setWorkshopStatusFilter] = useState<string>('all');
  const [workshopFormatFilter, setWorkshopFormatFilter] = useState<string>('all');

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);

  // Confirm Delete Dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'job' | 'workshop' | 'course' | 'announcement';
    id: string;
    title: string;
  } | null>(null);

  // Fetch all administrative data from server
  const loadDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminApi.getDashboardData();
      setJobs(data.jobs || []);
      setWorkshops(data.workshops || []);
      setCourses(data.courses || []);
      setContent(data.content || null);
      try {
        const backupList = await adminApi.getBackups();
        setBackups(backupList);
      } catch {
        // non-blocking
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load administrative dataset from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await adminApi.createBackup();
      addToast(`Point-in-time backup created: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
      const updatedList = await adminApi.getBackups();
      setBackups(updatedList);
    } catch (err: any) {
      addToast(err.message || 'Backup failed', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleVerifyJob = async (jobId: string, title: string) => {
    try {
      const updated = await adminApi.verifyJob(jobId, 'Verified', 'Official career page confirmed by administrator');
      setJobs(jobs.map((j) => (j.id === jobId ? updated : j)));
      addToast(`Verified & logged source audit for "${title}".`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to verify job.', 'error');
    }
  };

  const handleLogoutClick = async () => {
    try {
      await adminApi.logout();
      addToast('Logged out of admin session successfully.', 'info');
      onLogout();
    } catch {
      onLogout();
    }
  };

  // -------------------------------------------------------------
  // Jobs Handlers
  // -------------------------------------------------------------

  const handleSaveJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const jobPayload: Partial<AdminJob> = {
      title: String(formData.get('title') || '').trim(),
      company: String(formData.get('company') || '').trim(),
      sector: String(formData.get('sector') || 'Private Biopharma'),
      location: String(formData.get('location') || '').trim(),
      type: String(formData.get('type') || 'Full-time'),
      salary: String(formData.get('salary') || 'Competitive').trim(),
      qualification: String(formData.get('qualification') || 'M.Sc / M.Tech').trim(),
      experienceLevel: String(formData.get('experienceLevel') || 'Fresher (0-1 yr)').trim(),
      description: String(formData.get('description') || '').trim(),
      responsibilities: String(formData.get('responsibilities') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      requirements: String(formData.get('requirements') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      skills: String(formData.get('skills') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      deadline: String(formData.get('deadline') || '2026-12-31').trim(),
      applicationUrl: String(formData.get('applicationUrl') || '').trim(),
      originalJobUrl: String(formData.get('originalJobUrl') || formData.get('applicationUrl') || '').trim(),
      employer: String(formData.get('employer') || formData.get('company') || '').trim(),
      sourceName: String(formData.get('sourceName') || 'BIO-NEXA Portal Direct').trim(),
      verificationStatus: (formData.get('verificationStatus') as any) || 'Pending Verification',
      verificationNotes: String(formData.get('verificationNotes') || '').trim(),
      status: String(formData.get('status') || 'Active'),
      featured: formData.get('featured') === 'on'
    };

    try {
      if (editingJob) {
        const updated = await adminApi.updateJob(editingJob.id, jobPayload);
        setJobs(jobs.map((j) => (j.id === editingJob.id ? updated : j)));
        addToast(`Updated job "${updated.title}" successfully.`, 'success');
      } else {
        const created = await adminApi.createJob(jobPayload);
        setJobs([created, ...jobs]);
        addToast(`Created job listing "${created.title}".`, 'success');
      }
      setIsJobModalOpen(false);
      setEditingJob(null);
    } catch (err: any) {
      addToast(err.message || 'Error saving job.', 'error');
    }
  };

  const handleToggleJobStatus = async (id: string, newStatus: string) => {
    try {
      const isExpired = newStatus === 'Expired';
      const updated = await adminApi.updateJobStatus(id, {
        status: newStatus,
        isExpired
      });
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
      addToast(`Job status updated to ${newStatus}.`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Error updating status.', 'error');
    }
  };

  const handleToggleJobApproval = async (id: string, currentApproval: boolean) => {
    try {
      const updated = await adminApi.updateJobStatus(id, {
        isApproved: !currentApproval
      });
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
      addToast(`Job ${!currentApproval ? 'approved and published' : 'rejected'}.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Error changing approval.', 'error');
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, title } = deleteConfirm;

    try {
      if (type === 'job') {
        await adminApi.deleteJob(id);
        setJobs(jobs.filter((j) => j.id !== id));
        addToast(`Deleted job "${title}".`, 'info');
      } else if (type === 'workshop') {
        await adminApi.deleteWorkshop(id);
        setWorkshops(workshops.filter((w) => w.id !== id));
        addToast(`Deleted workshop "${title}".`, 'info');
      } else if (type === 'course') {
        await adminApi.deleteCourse(id);
        setCourses(courses.filter((c) => c.id !== id));
        addToast(`Deleted course "${title}".`, 'info');
      } else if (type === 'announcement' && content) {
        const updatedAnnouncements = content.announcements.filter((a) => a.id !== id);
        await adminApi.updateContent({ announcements: updatedAnnouncements });
        setContent({ ...content, announcements: updatedAnnouncements });
        addToast(`Removed announcement "${title}".`, 'info');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to delete item.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // -------------------------------------------------------------
  // Workshops Handlers
  // -------------------------------------------------------------

  const handleOpenCreateWorkshop = () => {
    setEditingWorkshop(null);
    setWorkshopImagePreview('https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80');
    setIsWorkshopModalOpen(true);
  };

  const handleOpenEditWorkshop = (ws: AdminWorkshop) => {
    setEditingWorkshop(ws);
    setWorkshopImagePreview(ws.imageUrl || 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80');
    setIsWorkshopModalOpen(true);
  };

  const handleToggleWorkshopFeatured = async (workshop: AdminWorkshop) => {
    try {
      const nextFeatured = !workshop.featured;
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { featured: nextFeatured });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`"${updated.title}" is now ${nextFeatured ? 'featured on homepage' : 'removed from featured'}.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Error updating featured status.', 'error');
    }
  };

  const handleChangeWorkshopStatus = async (workshop: AdminWorkshop, newStatus: string) => {
    try {
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { status: newStatus });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`Status updated to "${newStatus}".`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Error updating status.', 'error');
    }
  };

  const handleChangeWorkshopAvailability = async (workshop: AdminWorkshop, newAvail: string) => {
    try {
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { availability: newAvail });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`Availability updated to "${newAvail}".`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Error updating availability.', 'error');
    }
  };

  const handleSaveWorkshop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const format = String(formData.get('format') || formData.get('workMode') || 'Online') as 'Online' | 'Offline' | 'Hybrid';
    const status = String(formData.get('status') || 'upcoming');
    const featured = formData.get('featured') === 'on' || formData.get('featured') === 'true';

    const workshopPayload: Partial<AdminWorkshop> = {
      title: String(formData.get('title') || '').trim(),
      name: String(formData.get('title') || '').trim(),
      organizer: String(formData.get('organizer') || '').trim(),
      instructor: String(formData.get('instructor') || formData.get('organizer') || '').trim(),
      location: String(formData.get('venue') || formData.get('location') || '').trim(),
      venue: String(formData.get('venue') || formData.get('location') || '').trim(),
      workMode: format,
      format,
      startDate: String(formData.get('startDate') || '2026-12-10').trim(),
      endDate: String(formData.get('endDate') || '2026-12-15').trim(),
      date: String(formData.get('startDate') || '2026-12-10').trim(),
      time: String(formData.get('time') || '09:30 AM - 04:30 PM IST').trim(),
      duration: String(formData.get('duration') || '2 Days Intensive').trim(),
      fees: String(formData.get('fees') || 'Free').trim(),
      capacity: Number(formData.get('capacity') || 50),
      registrationUrl: String(formData.get('registrationUrl') || '').trim(),
      registrationDeadline: String(formData.get('registrationDeadline') || '').trim(),
      availability: String(formData.get('availability') || 'Open').trim(),
      description: String(formData.get('description') || '').trim(),
      imageUrl: workshopImagePreview || String(formData.get('imageUrl') || '').trim(),
      featured,
      skillsCovered: String(formData.get('skillsCovered') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status
    };

    try {
      if (editingWorkshop) {
        const updated = await adminApi.updateWorkshop(editingWorkshop.id, workshopPayload);
        setWorkshops(workshops.map((w) => (w.id === editingWorkshop.id ? updated : w)));
        addToast(`Updated workshop "${updated.title}".`, 'success');
      } else {
        const created = await adminApi.createWorkshop(workshopPayload);
        setWorkshops([created, ...workshops]);
        addToast(`Created workshop "${created.title}".`, 'success');
      }
      setIsWorkshopModalOpen(false);
      setEditingWorkshop(null);
    } catch (err: any) {
      addToast(err.message || 'Error saving workshop.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Courses Handlers
  // -------------------------------------------------------------

  const handleSaveCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const coursePayload: Partial<AdminCourse> = {
      title: String(formData.get('title') || '').trim(),
      instructor: String(formData.get('instructor') || '').trim(),
      category: String(formData.get('category') || 'Bioprocessing'),
      duration: String(formData.get('duration') || '6 Weeks (Self-paced)').trim(),
      level: String(formData.get('level') || 'Intermediate'),
      price: String(formData.get('price') || 'Free Certified Masterclass').trim(),
      description: String(formData.get('description') || '').trim(),
      syllabus: String(formData.get('syllabus') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      prerequisites: String(formData.get('prerequisites') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      featured: formData.get('featured') === 'on'
    };

    try {
      if (editingCourse) {
        const updated = await adminApi.updateCourse(editingCourse.id, coursePayload);
        setCourses(courses.map((c) => (c.id === editingCourse.id ? updated : c)));
        addToast(`Updated course "${updated.title}".`, 'success');
      } else {
        const created = await adminApi.createCourse(coursePayload);
        setCourses([created, ...courses]);
        addToast(`Created course "${created.title}".`, 'success');
      }
      setIsCourseModalOpen(false);
      setEditingCourse(null);
    } catch (err: any) {
      addToast(err.message || 'Error saving course.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Website Content Handlers
  // -------------------------------------------------------------

  const handleSaveHighlights = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content) return;
    const formData = new FormData(e.currentTarget);

    const updatedHighlights = {
      heroBadge: String(formData.get('heroBadge') || '').trim(),
      bannerNotice: String(formData.get('bannerNotice') || '').trim(),
      activeVacanciesCount: String(formData.get('activeVacanciesCount') || '').trim(),
      participatingInstitutesCount: String(formData.get('participatingInstitutesCount') || '').trim()
    };

    try {
      const updated = await adminApi.updateContent({ homepageHighlights: updatedHighlights });
      setContent(updated);
      addToast('Homepage highlights updated successfully.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Error saving highlights.', 'error');
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content) return;
    const formData = new FormData(e.currentTarget);

    const newAnnouncement: AnnouncementItem = {
      id: `ann-${Date.now()}`,
      title: String(formData.get('title') || '').trim(),
      tag: String(formData.get('tag') || 'Announcement').trim(),
      date: new Date().toISOString().split('T')[0],
      link: String(formData.get('link') || '/opportunities').trim(),
      active: true
    };

    try {
      const updatedList = [newAnnouncement, ...content.announcements];
      const updated = await adminApi.updateContent({ announcements: updatedList });
      setContent(updated);
      addToast('Announcement posted successfully.', 'success');
      e.currentTarget.reset();
    } catch (err: any) {
      addToast(err.message || 'Error posting announcement.', 'error');
    }
  };

  const handleToggleAnnouncement = async (id: string, currentActive: boolean) => {
    if (!content) return;
    const updatedAnnouncements = content.announcements.map((a) =>
      a.id === id ? { ...a, active: !currentActive } : a
    );
    try {
      const updated = await adminApi.updateContent({ announcements: updatedAnnouncements });
      setContent(updated);
      addToast(`Announcement ${!currentActive ? 'activated' : 'paused'}.`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Error updating announcement.', 'error');
    }
  };

  // Filtered views
  const filteredJobs = jobs.filter((j) => {
    if (jobFilterTab === 'pending' && j.isApproved && j.verificationStatus !== 'Pending Verification') return false;
    if (jobFilterTab === 'verified' && j.verificationStatus !== 'Verified') return false;
    if (jobFilterTab === 'unverified' && j.verificationStatus !== 'Pending Verification' && j.verificationStatus !== 'Rejected') return false;
    if (jobFilterTab === 'broken' && j.verificationStatus !== 'Link Unavailable') return false;
    if (jobFilterTab === 'expired' && !j.isExpired && j.verificationStatus !== 'Expired') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q)
    );
  });

  const filteredWorkshops = workshops.filter((w) => {
    if (workshopStatusFilter !== 'all') {
      const curStatus = (w.status || 'upcoming').toLowerCase();
      if (curStatus !== workshopStatusFilter.toLowerCase()) return false;
    }
    if (workshopFormatFilter !== 'all') {
      const curFormat = (w.format || w.workMode || 'Online').toLowerCase();
      if (curFormat !== workshopFormatFilter.toLowerCase()) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (w.title || '').toLowerCase().includes(q) ||
      (w.organizer || '').toLowerCase().includes(q) ||
      (w.instructor || '').toLowerCase().includes(q) ||
      (w.location || '').toLowerCase().includes(q) ||
      (w.venue || '').toLowerCase().includes(q)
    );
  });

  const filteredCourses = courses.filter(
    (c) =>
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.instructor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Navigation & Status Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0B2A5B] to-slate-900 rounded-2xl p-6 sm:p-7 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
            <Shield className="w-4 h-4" />
            <span>Private Master Administration Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            BIO-NEXA Portal Management
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage live jobs, workshops, academy courses, and website highlights securely without touching source code.
          </p>
        </div>

        {/* Authenticated Admin Badge & Logout */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-mono">
            <div className="text-teal-300 text-[10px]">Logged in as</div>
            <div className="font-bold text-white truncate max-w-[180px]">{adminUser.email}</div>
          </div>

          <button
            onClick={handleLogoutClick}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            ['jobs', `A. Jobs (${jobs.length})`, Briefcase],
            ['workshops', `B. Workshops (${workshops.length})`, Calendar],
            ['courses', `C. Courses (${courses.length})`, GraduationCap],
            ['content', 'D. Website Content', Globe],
            ['sheets', 'E. Google Sheets Sync', Database],
            ['sources', 'F. Sources Registry', Layers],
            ['backups', `G. Database & Backups (${backups.length})`, HardDrive],
            ['automation', `H. Automated Feeds (${jobs.filter((j) => !j.isApproved).length} pending)`, Sparkles]
          ].map(([tabKey, label, Icon]: any) => (
            <button
              key={tabKey}
              onClick={() => {
                setActiveTab(tabKey);
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === tabKey
                  ? 'bg-[#0B2A5B] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        {(activeTab === 'jobs' || activeTab === 'workshops' || activeTab === 'courses') && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#0B2A5B]" />
          <p className="text-xs font-semibold">Synchronizing with secure backend server...</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errorMsg && (
        <>
          {/* ========================================================= */}
          {/* PANEL A: JOBS MANAGEMENT                                  */}
          {/* ========================================================= */}
          {activeTab === 'jobs' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Jobs &amp; Industrial Openings Control</span>
                    {jobs.filter((j) => !j.isApproved).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {jobs.filter((j) => !j.isApproved).length} Pending Review
                      </span>
                    )}
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Add new job openings, moderate external feed submissions, review technical qualifications, and monitor deadlines.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('automation')}
                    className="px-3.5 py-2 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-bold rounded-xl transition-all border border-teal-200 dark:border-teal-800 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs"
                    title="Open Automated Job Management & Feeds"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                    <span>Automated Feeds</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingJob(null);
                      setIsJobModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Post New Job</span>
                  </button>
                </div>
              </div>

              {/* Status & Moderation Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ['all', `All (${jobs.length})`],
                  ['pending', `Pending Audit (${jobs.filter((j) => j.verificationStatus === 'Pending Verification' || !j.isApproved).length})`],
                  ['verified', `Verified (${jobs.filter((j) => j.verificationStatus === 'Verified').length})`],
                  ['unverified', `Unverified (${jobs.filter((j) => j.verificationStatus === 'Pending Verification' || j.verificationStatus === 'Rejected').length})`],
                  ['broken', `Broken Links (${jobs.filter((j) => j.verificationStatus === 'Link Unavailable').length})`],
                  ['expired', `Expired (${jobs.filter((j) => j.isExpired || j.verificationStatus === 'Expired').length})`]
                ].map(([tabKey, label]: any) => (
                  <button
                    key={tabKey}
                    onClick={() => setJobFilterTab(tabKey)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      jobFilterTab === tabKey
                        ? 'bg-[#0B2A5B] text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Jobs Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Title &amp; Company</th>
                        <th className="py-3 px-4">Sector &amp; Location</th>
                        <th className="py-3 px-4">Salary / Deadline</th>
                        <th className="py-3 px-4">Verification Audit</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredJobs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No job listings found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{job.title}</div>
                              <div className="text-[11px] text-teal-600 font-semibold">{job.company}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div>{job.sector}</div>
                              <div className="text-[11px] text-slate-400">{job.location} ({job.type})</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono text-emerald-600 font-semibold">{job.salary}</div>
                              <div className="text-[11px] text-slate-400">Deadline: {job.deadline}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {job.verificationStatus === 'Verified' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Verified</span>
                                  </span>
                                ) : job.verificationStatus === 'Pending Verification' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Pending Audit</span>
                                  </span>
                                ) : job.verificationStatus === 'Link Unavailable' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    <span>Link Broken</span>
                                  </span>
                                ) : job.verificationStatus === 'Expired' || job.isExpired ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    <span>Expired</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>{job.verificationStatus || 'Unverified'}</span>
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-400">
                                  Source: {job.sourceName || 'Direct'} · Verified: {job.lastVerificationDate || 'Never'}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Open Public Page */}
                                <button
                                  onClick={() => navigate(`/jobs/${job.id}`)}
                                  className="p-1.5 text-slate-400 hover:text-[#0B2A5B] rounded-lg hover:bg-slate-100"
                                  title="View Public Detail Page"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Live External Application Link */}
                                {job.applicationUrl && (
                                  <a
                                    href={job.applicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50"
                                    title="Test Application Link Destination"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                {/* Audit & Verify Dedicated Modal */}
                                <button
                                  onClick={() => {
                                    setVerifyingJob(job);
                                    setIsVerificationModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 rounded-lg text-[11px] font-bold border border-teal-200 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Audit Employer, Source & Destination"
                                >
                                  <FileCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                  <span>Verify</span>
                                </button>

                                {/* Status Switch */}
                                <button
                                  onClick={() => handleToggleJobStatus(job.id, job.isExpired ? 'Active' : 'Expired')}
                                  className={`px-2 py-1 rounded text-[11px] font-bold ${
                                    job.isExpired
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  }`}
                                  title={job.isExpired ? 'Reopen listing' : 'Mark expired'}
                                >
                                  {job.isExpired ? 'Reopen' : 'Expire'}
                                </button>

                                {/* Edit Job */}
                                <button
                                  onClick={() => {
                                    setEditingJob(job);
                                    setIsJobModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100"
                                  title="Edit Job Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Job with Confirmation */}
                                <button
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'job',
                                      id: job.id,
                                      title: job.title
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                  title="Permanently Delete Job"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL B: WORKSHOPS MANAGEMENT                              */}
          {/* ========================================================= */}
          {activeTab === 'workshops' && (
            <div className="space-y-4 text-xs">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Biotechnology Workshops &amp; Training Programs</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                      {workshops.length} Managed Programs
                    </span>
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Schedule hands-on lab training, update enrollment fees, registration links, format, and toggle featured programs on the homepage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenCreateWorkshop}
                    className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Workshop</span>
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Workshops</span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">{workshops.length}</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming</span>
                  <span className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400">
                    {workshops.filter(w => (w.status || 'upcoming').toLowerCase() === 'upcoming').length}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ongoing</span>
                  <span className="text-lg font-bold font-mono text-teal-600 dark:text-teal-400">
                    {workshops.filter(w => (w.status || '').toLowerCase() === 'ongoing').length}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed</span>
                  <span className="text-lg font-bold font-mono text-slate-500">
                    {workshops.filter(w => (w.status || '').toLowerCase() === 'completed').length}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Homepage Featured</span>
                  <span className="text-lg font-bold font-mono text-amber-500">
                    {workshops.filter(w => w.featured).length}
                  </span>
                </div>
              </div>

              {/* Sub-Filters: Status & Format */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-semibold text-[11px]">Status:</span>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'ongoing', label: 'Ongoing' },
                    { id: 'completed', label: 'Completed' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setWorkshopStatusFilter(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        workshopStatusFilter === s.id
                          ? 'bg-[#0B2A5B] text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-semibold text-[11px]">Format:</span>
                  {[
                    { id: 'all', label: 'All Formats' },
                    { id: 'Online', label: 'Online' },
                    { id: 'Offline', label: 'Offline' },
                    { id: 'Hybrid', label: 'Hybrid' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setWorkshopFormatFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        workshopFormatFilter === f.id
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workshops Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkshops.map((w) => (
                  <div
                    key={w.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden relative group hover:border-[#14A3A0]/60 transition-all"
                  >
                    <div>
                      {/* Thumbnail Media */}
                      <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                        <img
                          src={w.imageUrl || 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80'}
                          alt={w.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white backdrop-blur-md ${
                              (w.format || w.workMode) === 'Offline'
                                ? 'bg-emerald-600/90'
                                : (w.format || w.workMode) === 'Hybrid'
                                ? 'bg-purple-600/90'
                                : 'bg-blue-600/90'
                            }`}
                          >
                            {w.format || w.workMode || 'Online'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleWorkshopFeatured(w)}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                              w.featured
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-900/60 text-slate-300 hover:text-amber-400'
                            }`}
                            title={w.featured ? 'Featured on Homepage (Click to unfeature)' : 'Click to feature on homepage'}
                          >
                            <Star className={`w-3.5 h-3.5 ${w.featured ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        {/* Bottom Thumbnail Info */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white font-mono">
                          <span>{w.duration || '2 Days'}</span>
                          <span className="font-bold text-emerald-300">{w.fees || 'Free'}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {w.organizer} {w.instructor && `· ${w.instructor}`}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-2">
                            {w.title}
                          </h3>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Schedule:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {w.startDate || w.date} ({w.time || '09:30 AM'})
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Venue:</span>
                            <span className="truncate max-w-[150px] font-medium" title={w.venue || w.location}>
                              {w.venue || w.location || 'Online'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Deadline:</span>
                            <span className="font-mono text-slate-700 dark:text-slate-200">
                              {w.registrationDeadline || 'Open'}
                            </span>
                          </div>
                        </div>

                        {/* Status & Availability Quick Selectors */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">Status</label>
                            <select
                              value={(w.status || 'upcoming').toLowerCase()}
                              onChange={(e) => handleChangeWorkshopStatus(w, e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="upcoming">Upcoming</option>
                              <option value="ongoing">Ongoing</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">Availability</label>
                            <select
                              value={w.availability || 'Open'}
                              onChange={(e) => handleChangeWorkshopAvailability(w, e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="Open">Open</option>
                              <option value="Filling Fast">Filling Fast</option>
                              <option value="Waitlist">Waitlist</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {w.registrationUrl ? (
                          <a
                            href={w.registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            title="Open Registration Destination in New Tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-amber-500">No URL</span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {w.featured ? '★ Featured' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditWorkshop(w)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg font-bold border border-slate-200 dark:border-slate-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'workshop',
                              id: w.id,
                              title: w.title
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Workshop"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL C: COURSES MANAGEMENT                                */}
          {/* ========================================================= */}
          {activeTab === 'courses' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    BIO-NEXA Academy Masterclasses &amp; Certification
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Manage self-paced courses, certified training tracks, module syllabi, and enrollment fees.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingCourse(null);
                    setIsCourseModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Academy Course</span>
                </button>
              </div>

              {/* Courses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCourses.map((c) => (
                  <div key={c.id} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#1F6FB2] uppercase text-[10px]">{c.category}</span>
                        <span className="font-mono text-[10px] text-emerald-600 font-bold">{c.price}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{c.title}</h3>
                      <div className="text-slate-500 text-[11px] mt-1">{c.instructor} · {c.duration} ({c.level})</div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs mt-2 line-clamp-2">{c.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Modules: <strong>{c.syllabus.length} sections</strong></span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCourse(c);
                            setIsCourseModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-slate-600 hover:text-sky-600 rounded-lg hover:bg-slate-100 font-bold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'course',
                              id: c.id,
                              title: c.title
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          title="Delete Course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL D: WEBSITE CONTENT & HOMEPAGE HIGHLIGHTS             */}
          {/* ========================================================= */}
          {activeTab === 'content' && content && (
            <div className="space-y-6 text-xs">
              {/* Homepage Highlights Form */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Homepage Opportunity Highlights &amp; Hero Metrics
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Instantly update the hero banner tagline, national announcement badge, and live metric counters on the homepage.
                  </p>
                </div>

                <form onSubmit={handleSaveHighlights} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Hero Announcement Badge
                      </label>
                      <input
                        type="text"
                        name="heroBadge"
                        defaultValue={content.homepageHighlights?.heroBadge}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Active Vacancies Metric Text
                      </label>
                      <input
                        type="text"
                        name="activeVacanciesCount"
                        defaultValue={content.homepageHighlights?.activeVacanciesCount}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      National Banner Notice
                    </label>
                    <textarea
                      rows={2}
                      name="bannerNotice"
                      defaultValue={content.homepageHighlights?.bannerNotice}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      Save Homepage Highlights
                    </button>
                  </div>
                </form>
              </div>

              {/* National Announcements Manager */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      National Science Announcements &amp; Breaking Bulletins
                    </h3>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Published across the homepage alert ticker and opportunities dispatch.
                    </p>
                  </div>
                </div>

                {/* Add Announcement Form */}
                <form onSubmit={handleAddAnnouncement} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Announcement Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="e.g. DBT-JRF Biotechnology Fellowship Exam 2026 Announced"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Category Tag
                    </label>
                    <input
                      type="text"
                      name="tag"
                      defaultValue="Fellowship"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post Notice</span>
                    </button>
                  </div>
                </form>

                {/* Announcements List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {content.announcements.map((ann) => (
                    <div key={ann.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#0B2A5B]">
                            {ann.tag}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{ann.title}</span>
                          {!ann.active && (
                            <span className="text-[10px] text-slate-400 font-semibold">(Paused)</span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">Published on {ann.date} · Link: {ann.link}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleAnnouncement(ann.id, ann.active)}
                          className={`px-2.5 py-1 rounded text-xs font-bold ${
                            ann.active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {ann.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'announcement',
                              id: ann.id,
                              title: ann.title
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL E: GOOGLE SHEETS REAL-TIME SYNC CONSOLE             */}
          {/* ========================================================= */}
          {activeTab === 'sheets' && (
            <div className="space-y-4 text-xs">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-teal-600" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Google Sheets &amp; Apps Script Real-Time Data Pipeline
                  </h2>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Synchronize your 19-column Google Sheet directly with BIO-NEXA without redeploying code.
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  Endpoint: {googleSheetsSync.getConfig().scriptUrl || 'Default Embedded Endpoint Active'}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL F: SOURCES REGISTRY                                 */}
          {/* ========================================================= */}
          {activeTab === 'sources' && (
            <div className="space-y-4 text-xs">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Data Sources &amp; Compliance Registry ({DATA_SOURCES.length})
                </h2>
                <p className="text-slate-500 text-[11px]">
                  BIO-NEXA operates strictly under Section 6 &amp; 11 legal standards: no unauthorized web scraping, no bypass of authentication walls, and 100% adherence to platform terms of service.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                {DATA_SOURCES.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{s.name}</div>
                      <div className="text-[11px] text-slate-400">{s.type} · Sync cadence: every {s.syncCadenceHours}h</div>
                    </div>
                    {s.baseUrl && (
                      <a
                        href={s.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* G. DATABASE ENGINE & POINT-IN-TIME BACKUPS TAB */}
          {activeTab === 'backups' && (
            <div className="space-y-6 text-xs">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-teal-600" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Relational Database Engine &amp; Point-in-Time Backups
                      </h2>
                    </div>
                    <p className="text-slate-500 mt-1">
                      BIO-NEXA utilizes an embedded, ACID-compliant SQLite engine (<code className="font-mono text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-1 py-0.5 rounded">bionexa.db</code>) with WAL journal mode, parameterized SQL queries, foreign-key relational integrity, and zero external network latency.
                    </p>
                  </div>

                  <button
                    disabled={isBackingUp}
                    onClick={handleCreateBackup}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-700 hover:from-teal-500 hover:to-sky-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isBackingUp ? 'animate-spin' : ''}`} />
                    <span>{isBackingUp ? 'Generating Snapshot...' : 'Create Instant Backup (VACUUM INTO)'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 text-[11px] font-medium">Database Engine</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">SQLite 3 / Node.js 22</div>
                    <div className="text-[10px] text-teal-600 mt-0.5">WAL Mode Active · Full ACID Compliance</div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 text-[11px] font-medium">Stored Records</div>
                    <div className="text-sm font-bold text-[#0B2A5B] dark:text-sky-400 mt-0.5">
                      {jobs.length} Jobs · {workshops.length} Workshops · {courses.length} Courses
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Full relational integrity &amp; audit trails</div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 text-[11px] font-medium">Archived Snapshots</div>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">{backups.length} Point-in-Time Backups</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Stored safely under db/backups/</div>
                  </div>
                </div>
              </div>

              {/* Backups List */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                    Snapshot Recovery History ({backups.length})
                  </h3>
                  <span className="text-slate-400 text-[11px]">Atomic, non-blocking binary SQLite snapshots</span>
                </div>

                {backups.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">No snapshots taken yet</p>
                    <p className="text-xs text-slate-400">Click &ldquo;Create Instant Backup&rdquo; above to generate a point-in-time snapshot.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {backups.map((bk, i) => (
                      <div key={bk.id || i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{bk.filename}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {bk.status || 'Verified'}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Created at: {new Date(bk.createdAt).toLocaleString()} · Size: {(bk.sizeBytes / 1024).toFixed(1)} KB · Location: {bk.path}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL H: AUTOMATED JOB LISTING MANAGEMENT & FEEDS         */}
          {/* ========================================================= */}
          {activeTab === 'automation' && (
            <AutomatedJobsPanel
              jobs={jobs}
              onRefreshAll={loadDashboardData}
              onApproveJob={async (id) => {
                await handleToggleJobApproval(id, false);
              }}
            />
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT JOB MODAL                                      */}
      {/* ========================================================= */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingJob ? `Edit Job: ${editingJob.title}` : 'Post New Job Vacancy'}
              </h3>
              <button onClick={() => setIsJobModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Job Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={editingJob?.title}
                    placeholder="e.g. Senior Bioprocess Scientist"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Hiring Organization / Company *</label>
                  <input
                    type="text"
                    name="company"
                    required
                    defaultValue={editingJob?.company}
                    placeholder="e.g. Biocon Biologics"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Sector</label>
                  <select
                    name="sector"
                    defaultValue={editingJob?.sector || 'Private Biopharma'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Private Biopharma">Private Biopharma</option>
                    <option value="Government / Autonomous">Government / CSIR / ICMR</option>
                    <option value="Academic Research">Academic Research</option>
                    <option value="Diagnostics & CRO">Diagnostics &amp; CRO</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editingJob?.location || 'Bengaluru, Karnataka'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Employment Type</label>
                  <select
                    name="type"
                    defaultValue={editingJob?.type || 'Full-time'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Project Contract</option>
                    <option value="Project-based">Project-based</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Salary / Stipend</label>
                  <input
                    type="text"
                    name="salary"
                    defaultValue={editingJob?.salary || '₹10,50,000 - ₹14,00,000 / yr'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Minimum Qualification</label>
                  <input
                    type="text"
                    name="qualification"
                    defaultValue={editingJob?.qualification || 'M.Sc / M.Tech in Biotechnology'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Application Deadline</label>
                  <input
                    type="date"
                    name="deadline"
                    defaultValue={editingJob?.deadline || '2026-12-15'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Official Application Destination URL * (Employer Portal)
                  </label>
                  <input
                    type="url"
                    name="applicationUrl"
                    required
                    defaultValue={editingJob?.applicationUrl}
                    placeholder="https://company.com/careers/job-opening"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Original Job Source URL (Notification / Feed)
                  </label>
                  <input
                    type="url"
                    name="originalJobUrl"
                    defaultValue={editingJob?.originalJobUrl || editingJob?.applicationUrl}
                    placeholder="https://csir.res.in/notifications/advt-01-2026.pdf"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Original Source Name
                  </label>
                  <input
                    type="text"
                    name="sourceName"
                    defaultValue={editingJob?.sourceName || 'Direct Employer Careers Portal'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Verification Audit Status
                  </label>
                  <select
                    name="verificationStatus"
                    defaultValue={editingJob?.verificationStatus || 'Pending Verification'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-bold"
                  >
                    <option value="Pending Verification">Pending Verification (Audit Required)</option>
                    <option value="Verified">Verified (Employer &amp; URL Confirmed)</option>
                    <option value="Rejected">Rejected (Unverified / Non-compliant)</option>
                    <option value="Expired">Expired (Application Deadline Passed)</option>
                    <option value="Link Unavailable">Link Unavailable (Broken / 404)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Role Overview / Summary</label>
                <textarea
                  rows={2}
                  name="description"
                  defaultValue={editingJob?.description}
                  placeholder="Overview of the research position and lab context..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Responsibilities (One per line)
                  </label>
                  <textarea
                    rows={3}
                    name="responsibilities"
                    defaultValue={editingJob?.responsibilities?.join('\n')}
                    placeholder="Scale-up fermentation in 500L bioreactors&#10;Optimize fed-batch feed strategy"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Skills / Competencies (Comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    name="skills"
                    defaultValue={editingJob?.skills?.join(', ')}
                    placeholder="Bioreactors, Fermentation, DoE, cGMP, HPLC"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Verification Notes / Audit Log
                </label>
                <input
                  type="text"
                  name="verificationNotes"
                  defaultValue={editingJob?.verificationNotes || ''}
                  placeholder="e.g. Cross-checked with official HR notification on March 2026."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={editingJob?.featured}
                    className="rounded text-[#0B2A5B]"
                  />
                  <span>Feature on Homepage &amp; Top of Portal</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJobModalOpen(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingJob ? 'Save Changes' : 'Create Job Listing'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 07 — DEDICATED JOB VERIFICATION & AUDIT MODAL        */}
      {/* ========================================================= */}
      {isVerificationModalOpen && verifyingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Job Verification &amp; Application Destination Audit
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Verify employer credentials and test application destination before publishing as Verified.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsVerificationModalOpen(false);
                  setVerifyingJob(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const status = (form.elements.namedItem('verificationStatus') as HTMLSelectElement).value;
                const notes = (form.elements.namedItem('verificationNotes') as HTMLTextAreaElement).value;
                const lastVerificationDate = (form.elements.namedItem('lastVerificationDate') as HTMLInputElement).value;

                try {
                  const updated = await adminApi.verifyJob(verifyingJob.id, status, notes, lastVerificationDate);
                  setJobs(jobs.map((j) => (j.id === verifyingJob.id ? updated : j)));
                  addToast(`Audit decision saved for "${verifyingJob.title}": Status set to ${status}.`, 'success');
                  setIsVerificationModalOpen(false);
                  setVerifyingJob(null);
                } catch (err: any) {
                  addToast(err.message || 'Failed to update verification status.', 'error');
                }
              }}
              className="space-y-4"
            >
              {/* Job Summary Banner */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {verifyingJob.title}
                </div>
                <div className="text-xs text-teal-600 font-semibold mt-0.5">
                  {verifyingJob.company} · {verifyingJob.location} · {verifyingJob.salary}
                </div>
              </div>

              {/* 8 Verification Attributes Review Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    1. Employer Identity
                  </label>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.employer || verifyingJob.company}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    2. Original Listing Source
                  </label>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.sourceName || 'Direct Submission'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* URLs Review & Interactive Test */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      3. Application Destination URL
                    </label>
                    {verifyingJob.applicationUrl && (
                      <a
                        href={verifyingJob.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-teal-600 hover:underline flex items-center gap-1"
                      >
                        <span>Test Destination in New Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.applicationUrl || 'No application URL specified'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      4. Original Listing / Notification Source URL
                    </label>
                    {(verifyingJob.originalJobUrl || verifyingJob.sourceUrl) && (
                      <a
                        href={verifyingJob.originalJobUrl || verifyingJob.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-[#0B2A5B] dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <span>Verify Original Source Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.originalJobUrl || verifyingJob.sourceUrl || verifyingJob.applicationUrl}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Dates & Status Decisions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    5. Publication Date
                  </label>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.publicationDate || verifyingJob.postedDate || 'Active'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    6. Application Expiry Date
                  </label>
                  <input
                    type="text"
                    disabled
                    value={verifyingJob.expiryDate || verifyingJob.deadline}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    7. Last Verification Date *
                  </label>
                  <input
                    type="date"
                    name="lastVerificationDate"
                    required
                    defaultValue={verifyingJob.lastVerificationDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Decision Picker */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  8. Verification Status Decision *
                </label>
                <select
                  name="verificationStatus"
                  defaultValue={verifyingJob.verificationStatus || 'Verified'}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-xs focus:outline-none"
                >
                  <option value="Verified">Verified — Legitimate employer identity &amp; application destination confirmed</option>
                  <option value="Pending Verification">Pending Verification — Needs additional review or candidate verification</option>
                  <option value="Rejected">Rejected — Inaccurate, fraudulent, fee-charging, or unauthorized listing</option>
                  <option value="Expired">Expired — Applications closed or deadline exceeded</option>
                  <option value="Link Unavailable">Link Unavailable — Destination URL is broken, 404, or unreachable</option>
                </select>
              </div>

              {/* Verification Audit Notes */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Audit Notes &amp; Verification Evidence
                </label>
                <textarea
                  rows={2}
                  name="verificationNotes"
                  defaultValue={verifyingJob.verificationNotes || 'Official career page confirmed by administrator. Zero candidate fees required.'}
                  placeholder="Record your verification steps (e.g. checked CSIR careers website; confirmed recruitment portal is operational without charging fees)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Candidate Protection Warning */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Legal &amp; Trust Requirement:</strong> Only mark as "Verified" if the employer identity and application destination have actually been tested. Never mark an opportunity as verified without auditing.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsVerificationModalOpen(false);
                    setVerifyingJob(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Verification Audit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT WORKSHOP MODAL                                 */}
      {/* ========================================================= */}
      {isWorkshopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                  Workshop Management
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingWorkshop ? `Edit Workshop: ${editingWorkshop.title}` : 'Schedule New Hands-on Workshop'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsWorkshopModalOpen(false);
                  setEditingWorkshop(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkshop} className="space-y-4">
              {/* Workshop Title */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingWorkshop?.title}
                  placeholder="e.g. National Hands-on Bootcamp on CRISPR-Cas9 & Base Editing"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Image Selection: URL, Presets & File Upload */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                    <span>Workshop Banner Image</span>
                  </label>
                  <label className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3 h-3 text-teal-500" />
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setWorkshopImagePreview(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Direct URL input */}
                <input
                  type="url"
                  name="imageUrl"
                  value={workshopImagePreview}
                  onChange={(e) => setWorkshopImagePreview(e.target.value)}
                  placeholder="Paste banner image URL or select a preset below..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none"
                />

                {/* Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-medium block">Or choose a biotech training preset:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'CRISPR Gene Editing', url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80' },
                      { name: 'NGS Bioinformatics', url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Fermentation Bioprocess', url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Flow Cytometry', url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80' },
                      { name: 'GMP Cleanroom', url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Drug Discovery', url: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80' }
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => setWorkshopImagePreview(preset.url)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                          workshopImagePreview === preset.url
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Thumbnail */}
                {workshopImagePreview && (
                  <div className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900">
                    <img src={workshopImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-2 text-[9px] bg-slate-950/80 px-2 py-0.5 rounded text-white font-mono">
                      Image Preview
                    </span>
                  </div>
                )}
              </div>

              {/* Organizer Institute & Instructor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Organizer Institute *</label>
                  <input
                    type="text"
                    name="organizer"
                    required
                    defaultValue={editingWorkshop?.organizer || 'CSIR-IGIB'}
                    placeholder="e.g. CSIR-IGIB, IISc, Biocon Academy"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Lead Instructor / Faculty *</label>
                  <input
                    type="text"
                    name="instructor"
                    required
                    defaultValue={editingWorkshop?.instructor || editingWorkshop?.organizer || 'Lead Research Scientist'}
                    placeholder="e.g. Dr. Debojyoti Chakraborty, Senior Principal Scientist"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Format & Venue / Meeting Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Format *</label>
                  <select
                    name="format"
                    defaultValue={editingWorkshop?.format || editingWorkshop?.workMode || 'Online'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-semibold"
                  >
                    <option value="Online">Online Live Virtual</option>
                    <option value="Offline">Offline Hands-on Lab</option>
                    <option value="Hybrid">Hybrid (Lab &amp; Streaming)</option>
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Venue or Meeting Logistics *</label>
                  <input
                    type="text"
                    name="venue"
                    required
                    defaultValue={editingWorkshop?.venue || editingWorkshop?.location || 'CSIR-IGIB South Campus, Mathura Road, New Delhi'}
                    placeholder="e.g. IISc Campus, Bengaluru or Virtual Live Gateway"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Schedule: Date, Time & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Date *</label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue={editingWorkshop?.startDate || editingWorkshop?.date || '2026-12-10'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Session Time</label>
                  <input
                    type="text"
                    name="time"
                    defaultValue={editingWorkshop?.time || '09:30 AM - 04:30 PM IST'}
                    placeholder="09:30 AM - 04:30 PM IST"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Duration</label>
                  <input
                    type="text"
                    name="duration"
                    defaultValue={editingWorkshop?.duration || '3 Days Intensive'}
                    placeholder="e.g. 3 Days Intensive Lab"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Registration Deadline & Registration Destination URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Registration Deadline
                  </label>
                  <input
                    type="date"
                    name="registrationDeadline"
                    defaultValue={editingWorkshop?.registrationDeadline || '2026-12-05'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Registration URL * (Original Portal / Destination)
                  </label>
                  <input
                    type="url"
                    name="registrationUrl"
                    required
                    defaultValue={editingWorkshop?.registrationUrl || editingWorkshop?.registrationLink}
                    placeholder="https://www.igib.res.in/training"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none text-[11px]"
                  />
                </div>
              </div>

              {/* Status, Availability, Fees & Capacity */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Program Status *</label>
                  <select
                    name="status"
                    defaultValue={(editingWorkshop?.status || 'upcoming').toLowerCase()}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Availability *</label>
                  <select
                    name="availability"
                    defaultValue={editingWorkshop?.availability || 'Open'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="Filling Fast">Filling Fast</option>
                    <option value="Waitlist">Waitlist</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Fees</label>
                  <input
                    type="text"
                    name="fees"
                    defaultValue={editingWorkshop?.fees || 'Free / Subsidized'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Capacity (Seats)</label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue={editingWorkshop?.capacity || 40}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Featured on Homepage Checkbox */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Feature on Homepage</div>
                    <div className="text-[10px] text-slate-500">
                      Promote this workshop prominently in Section 04 of the homepage directory.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={editingWorkshop?.featured || false}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Description &amp; Scope *</label>
                <textarea
                  rows={3}
                  name="description"
                  required
                  defaultValue={editingWorkshop?.description}
                  placeholder="Comprehensive hands-on training details, practical equipment used, and prerequisites..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Skills Covered */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Skills Covered (comma separated)
                </label>
                <input
                  type="text"
                  name="skillsCovered"
                  defaultValue={editingWorkshop?.skillsCovered?.join(', ') || 'CRISPR-Cas9, Guide RNA Design, Transfection, Off-target Analysis'}
                  placeholder="e.g. RNA-Seq, Python, FastQC, Differential Expression"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none text-[11px]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsWorkshopModalOpen(false);
                    setEditingWorkshop(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingWorkshop ? 'Save Workshop Changes' : 'Schedule Workshop'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT COURSE MODAL                                   */}
      {/* ========================================================= */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingCourse ? `Edit Course: ${editingCourse.title}` : 'Add Academy Course'}
              </h3>
              <button onClick={() => setIsCourseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Course Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingCourse?.title}
                  placeholder="e.g. Industrial Fermentation & Bioprocess Masterclass"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Instructor / Lead *</label>
                  <input
                    type="text"
                    name="instructor"
                    required
                    defaultValue={editingCourse?.instructor}
                    placeholder="e.g. Dr. Kavita Nair (Biocon Academy)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    name="category"
                    defaultValue={editingCourse?.category || 'Bioprocessing'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Bioprocessing">Bioprocessing</option>
                    <option value="Bioinformatics">Bioinformatics</option>
                    <option value="Gene Editing">Gene Editing</option>
                    <option value="QC & Regulatory">QC &amp; Regulatory</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Duration</label>
                  <input
                    type="text"
                    name="duration"
                    defaultValue={editingCourse?.duration || '6 Weeks (Self-paced)'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Difficulty Level</label>
                  <select
                    name="level"
                    defaultValue={editingCourse?.level || 'Intermediate'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Fees / Access</label>
                  <input
                    type="text"
                    name="price"
                    defaultValue={editingCourse?.price || 'Free Certified Masterclass'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Course Description</label>
                <textarea
                  rows={2}
                  name="description"
                  defaultValue={editingCourse?.description}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESTRUCTIVE ACTION CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Confirm Permanent Deletion
                </h3>
                <span className="text-rose-600 font-semibold uppercase text-[10px]">
                  Irreversible Administrative Action
                </span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete the {deleteConfirm.type}:
              <br />
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block mt-1">
                &ldquo;{deleteConfirm.title}&rdquo;
              </strong>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
