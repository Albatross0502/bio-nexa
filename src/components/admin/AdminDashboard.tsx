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
  Image as ImageIcon,
  Download,
  Check,
  Inbox,
  MessageSquare,
  History
} from 'lucide-react';
import {
  adminApi,
  AdminUser,
  AdminJob,
  AdminInternship,
  AdminWorkshop,
  AdminCourse,
  AdminSubmittedOpportunity,
  AdminComplianceRequest,
  AdminContactMessage,
  AdminDashboardStats,
  AdminSyncLog,
  AdminExportDataset,
  WebsiteContent,
  AnnouncementItem
} from '../../services/admin/adminApiClient';
import { ADMIN_EXPORT_DATASETS, hasExportDatasetPermission } from '../../services/admin/adminHelpers';
import { useApp } from '../../context/AppContext';
import { DATA_SOURCES } from '../../services/opportunities/sourcesRegistry';
import { AutomatedJobsPanel } from './AutomatedJobsPanel';
import { GoogleSheetsSyncPanel } from './GoogleSheetsSyncPanel';
import { validateApplicationUrl } from '../../services/jobs/jobVerification';
import {
  DEFAULT_WORKSHOP_IMAGE,
  isValidWorkshopImageUrl,
  isValidWorkshopRegistrationUrl,
  normalizeAvailabilityOption,
  normalizeWorkshopFormat,
  normalizeWorkshopStatus,
  toDateInputValue
} from '../../services/workshops/workshopHelpers';
import {
  COURSE_CATEGORIES,
  COURSE_DELIVERY_MODES,
  DEFAULT_COURSE_IMAGE,
  getDefaultCourseImageForCategory,
  isValidCourseImageUrl,
  isValidCourseRegistrationUrl,
  normalizeCourseCategory,
  normalizeCourseStatus,
  normalizeDeliveryMode,
  parseCurriculumInput
} from '../../services/courses/courseHelpers';

interface AdminDashboardProps {
  adminUser: AdminUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUser, onLogout }) => {
  const { addToast, navigate } = useApp();

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<
    | 'jobs'
    | 'internships'
    | 'workshops'
    | 'courses'
    | 'submissions'
    | 'content'
    | 'sheets'
    | 'sources'
    | 'backups'
    | 'automation'
    | 'audit'
  >('jobs');
  const [jobFilterTab, setJobFilterTab] = useState<'all' | 'pending' | 'verified' | 'unverified' | 'broken' | 'expired'>('all');
  const [internshipFilterTab, setInternshipFilterTab] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'expired'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [databaseEngine, setDatabaseEngine] = useState<string>('SQLite 3 (Node.js)');

  // Loaded Entities from Backend API
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [internships, setInternships] = useState<AdminInternship[]>([]);
  const [workshops, setWorkshops] = useState<AdminWorkshop[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [submittedOpportunities, setSubmittedOpportunities] = useState<AdminSubmittedOpportunity[]>([]);
  const [complianceRequests, setComplianceRequests] = useState<AdminComplianceRequest[]>([]);
  const [contactMessages, setContactMessages] = useState<AdminContactMessage[]>([]);
  const [syncHistory, setSyncHistory] = useState<AdminSyncLog[]>([]);
  const [content, setContent] = useState<WebsiteContent | null>(null);

  // Search & Filters within Admin Dashboard
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<AdminJob | null>(null);

  // Internship Modals state
  const [isInternshipModalOpen, setIsInternshipModalOpen] = useState(false);
  const [editingInternship, setEditingInternship] = useState<AdminInternship | null>(null);
  const [isInternshipVerificationModalOpen, setIsInternshipVerificationModalOpen] = useState(false);
  const [verifyingInternship, setVerifyingInternship] = useState<AdminInternship | null>(null);

  // Phase 07 Verification Modal state
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verifyingJob, setVerifyingJob] = useState<AdminJob | null>(null);
  const [verifyingJobHistory, setVerifyingJobHistory] = useState<
    Array<{ id: string; jobId: string; verifiedBy: string; verifiedAt: string; sourceStatus: string; notes: string }>
  >([]);
  const [isLoadingJobHistory, setIsLoadingJobHistory] = useState(false);
  const [verifyModalStatus, setVerifyModalStatus] = useState<string>('Pending Verification');
  const [verifyModalDate, setVerifyModalDate] = useState<string>('');

  const [isWorkshopModalOpen, setIsWorkshopModalOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<AdminWorkshop | null>(null);
  const [workshopImagePreview, setWorkshopImagePreview] = useState<string>('');
  const [workshopRegUrlDraft, setWorkshopRegUrlDraft] = useState<string>('');
  const [isUploadingWorkshopImage, setIsUploadingWorkshopImage] = useState(false);
  const [workshopStatusFilter, setWorkshopStatusFilter] = useState<string>('all');
  const [workshopFormatFilter, setWorkshopFormatFilter] = useState<string>('all');

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [courseImagePreview, setCourseImagePreview] = useState<string>('');
  const [courseRegUrlDraft, setCourseRegUrlDraft] = useState<string>('');
  const [isUploadingCourseImage, setIsUploadingCourseImage] = useState(false);
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<string>('all');
  const [courseStatusFilter, setCourseStatusFilter] = useState<'all' | 'available' | 'closed'>('all');

  // Submissions & Compliance Management state
  const [submissionFilterTab, setSubmissionFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isSubmissionEditModalOpen, setIsSubmissionEditModalOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<AdminSubmittedOpportunity | null>(null);
  const [complianceTypeFilter, setComplianceTypeFilter] = useState<string>('all');
  const [complianceNotesDrafts, setComplianceNotesDrafts] = useState<Record<string, string>>({});
  const [complianceStatusDrafts, setComplianceStatusDrafts] = useState<Record<string, string>>({});

  // Announcement Edit state
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);

  // Audit Logs & Export state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditLogsForbidden, setAuditLogsForbidden] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [exportDataset, setExportDataset] = useState<AdminExportDataset>('jobs');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  // Confirm Delete Dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'job' | 'internship' | 'workshop' | 'course' | 'announcement' | 'submission' | 'compliance';
    id: string;
    title: string;
  } | null>(null);

  // Fetch all administrative data from server
  const loadDashboardData = async (silent: boolean = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);
    try {
      const data = await adminApi.getDashboardData();
      setStats(data.stats || null);
      setJobs(data.jobs || []);
      setInternships(data.internships || []);
      setWorkshops(data.workshops || []);
      setCourses(data.courses || []);
      setSubmittedOpportunities(data.submittedOpportunities || []);
      setComplianceRequests(data.complianceRequests || []);
      setContactMessages(data.contactMessages || []);
      setSyncHistory(data.syncHistory || []);
      setContent(data.content || null);
      if (data.databaseEngine) {
        setDatabaseEngine(data.databaseEngine);
      }
      setLastRefreshedAt(new Date().toISOString());
      try {
        const backupList = await adminApi.getBackups();
        setBackups(backupList);
      } catch {
        // non-blocking for roles without backups:manage
      }
    } catch (err: any) {
      if (silent) {
        addToast(err.message || 'Failed to refresh administrative dataset.', 'error');
      } else {
        setErrorMsg(err.message || 'Failed to load administrative dataset from server.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    setAuditLogsForbidden(false);
    setAuditLogsError(null);
    try {
      const res = await adminApi.getAuditLogs();
      setAuditLogs(res.logs || []);
      setLoginAttempts(res.loginAttempts || []);
    } catch (err: any) {
      if (err?.status === 403) {
        setAuditLogsForbidden(true);
      } else {
        setAuditLogsError(err?.message || 'Unable to load activity logs.');
      }
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    loadDashboardData(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await adminApi.createBackup();
      addToast(`Point-in-time backup created: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
      const updatedList = await adminApi.getBackups();
      setBackups(updatedList);
      await loadDashboardData(true);
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
      await loadDashboardData(true);
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
      sourceName: String(formData.get('sourceName') || 'BIO-INEXA Portal Direct').trim(),
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
      await loadDashboardData(true);
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
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating status.', 'error');
    }
  };

  const handleToggleJobApproval = async (id: string, currentApproval: boolean) => {
    try {
      const updated = await adminApi.updateJobStatus(id, {
        isApproved: !currentApproval,
        status: !currentApproval ? 'Approved' : 'Rejected'
      });
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
      addToast(`Job ${!currentApproval ? 'approved and published' : 'rejected'}.`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error changing approval.', 'error');
    }
  };

  const handleApproveJobDirect = async (id: string, title: string) => {
    try {
      const updated = await adminApi.updateJobStatus(id, {
        isApproved: true,
        isExpired: false,
        status: 'Approved',
        verificationStatus: 'Verified'
      });
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
      addToast(`Approved & published "${title}".`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error approving job.', 'error');
    }
  };

  const handleRejectJob = async (id: string, title: string) => {
    try {
      const updated = await adminApi.updateJobStatus(id, {
        isApproved: false,
        isExpired: true,
        status: 'Rejected',
        verificationStatus: 'Rejected'
      });
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
      addToast(`Rejected job listing "${title}".`, 'info');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error rejecting job.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Internships Handlers
  // -------------------------------------------------------------

  const handleSaveInternship = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const payload: Partial<AdminInternship> = {
      title: String(formData.get('title') || '').trim(),
      organization: String(formData.get('organization') || '').trim(),
      category: String(formData.get('category') || 'Industrial R&D').trim(),
      location: String(formData.get('location') || 'India').trim(),
      mode: String(formData.get('workMode') || 'On-site Lab').trim(),
      workMode: String(formData.get('workMode') || 'On-site Lab').trim(),
      stipend: String(formData.get('stipend') || 'Competitive Stipend').trim(),
      duration: String(formData.get('duration') || '3 Months').trim(),
      deadline: String(formData.get('deadline') || '').trim(),
      eligibility: String(formData.get('eligibility') || '').trim(),
      sourceName: String(formData.get('sourceName') || 'BIO-INEXA Admin Portal').trim(),
      sourceUrl: String(formData.get('sourceUrl') || formData.get('applicationUrl') || '').trim(),
      applicationUrl: String(formData.get('applicationUrl') || '').trim(),
      verificationStatus: String(formData.get('verificationStatus') || 'Verified'),
      verificationNotes: String(formData.get('verificationNotes') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      learningOutcomes: String(formData.get('learningOutcomes') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      skillsRequired: String(formData.get('skillsRequired') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      featured: formData.get('featured') === 'on'
    };

    try {
      if (editingInternship) {
        const updated = await adminApi.updateInternship(editingInternship.id, payload);
        setInternships(internships.map((i) => (i.id === editingInternship.id ? updated : i)));
        addToast(`Updated internship "${updated.title}".`, 'success');
      } else {
        const created = await adminApi.createInternship(payload);
        setInternships([created, ...internships]);
        addToast(`Created internship "${created.title}".`, 'success');
      }
      setIsInternshipModalOpen(false);
      setEditingInternship(null);
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error saving internship.', 'error');
    }
  };

  const handleApproveInternship = async (id: string, title: string) => {
    try {
      const updated = await adminApi.updateInternshipStatus(id, {
        status: 'Approved',
        isApproved: true,
        isActive: true,
        verificationStatus: 'Verified'
      });
      setInternships(internships.map((i) => (i.id === id ? updated : i)));
      addToast(`Approved & published internship "${title}".`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to approve internship.', 'error');
    }
  };

  const handleRejectInternship = async (id: string, title: string) => {
    try {
      const updated = await adminApi.updateInternshipStatus(id, {
        status: 'Rejected',
        isApproved: false,
        isActive: false,
        verificationStatus: 'Rejected'
      });
      setInternships(internships.map((i) => (i.id === id ? updated : i)));
      addToast(`Rejected internship "${title}".`, 'info');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to reject internship.', 'error');
    }
  };

  const handleToggleInternshipActive = async (intern: AdminInternship) => {
    try {
      const nextStatus = intern.isActive ? 'Expired' : 'Active';
      const updated = await adminApi.updateInternshipStatus(intern.id, {
        status: nextStatus,
        isActive: !intern.isActive
      });
      setInternships(internships.map((i) => (i.id === intern.id ? updated : i)));
      addToast(`Internship "${intern.title}" marked as ${nextStatus}.`, 'info');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to update internship status.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Submissions & Compliance Handlers
  // -------------------------------------------------------------

  const handleApproveSubmittedOpportunity = async (id: string) => {
    try {
      const updated = await adminApi.moderateSubmittedOpportunity(id, {
        isApproved: true,
        status: 'Active'
      });
      setSubmittedOpportunities((prev) => prev.map((o) => (o.id === id ? updated : o)));
      addToast(`Approved & published "${updated.title}" to Opportunities portal.`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to approve submitted opportunity.', 'error');
    }
  };

  const handleRejectSubmittedOpportunity = async (id: string, title: string) => {
    try {
      const updated = await adminApi.moderateSubmittedOpportunity(id, {
        isApproved: false,
        status: 'Rejected'
      });
      setSubmittedOpportunities((prev) => prev.map((o) => (o.id === id ? updated : o)));
      addToast(`Marked submission "${title}" as Rejected.`, 'info');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to reject submitted opportunity.', 'error');
    }
  };

  const handleSaveEditedSubmission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSubmission) return;
    const formData = new FormData(e.currentTarget);

    const statusVal = String(formData.get('status') || editingSubmission.status || 'Pending Verification');
    const updates: Partial<AdminSubmittedOpportunity> = {
      title: String(formData.get('title') || '').trim(),
      organization: String(formData.get('organization') || '').trim(),
      type: String(formData.get('type') || editingSubmission.type).trim(),
      location: String(formData.get('location') || '').trim(),
      workMode: String(formData.get('workMode') || '').trim(),
      deadline: String(formData.get('deadline') || '').trim(),
      salaryOrStipend: String(formData.get('salaryOrStipend') || '').trim(),
      applicationUrl: String(formData.get('applicationUrl') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      skills: String(formData.get('skills') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status: statusVal,
      isApproved: statusVal === 'Active' || statusVal === 'Approved'
    };

    try {
      const updated = await adminApi.moderateSubmittedOpportunity(editingSubmission.id, updates);
      setSubmittedOpportunities((prev) => prev.map((o) => (o.id === editingSubmission.id ? updated : o)));
      addToast(`Updated submission "${updated.title}".`, 'success');
      setIsSubmissionEditModalOpen(false);
      setEditingSubmission(null);
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to update submitted opportunity.', 'error');
    }
  };

  const handleDeleteSubmittedOpportunity = async (id: string, title: string) => {
    try {
      await adminApi.deleteSubmittedOpportunity(id);
      setSubmittedOpportunities((prev) => prev.filter((o) => o.id !== id));
      addToast(`Removed submission "${title}".`, 'info');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to remove submitted opportunity.', 'error');
    }
  };

  const handleSaveComplianceUpdate = async (reqItem: AdminComplianceRequest) => {
    const nextStatus = complianceStatusDrafts[reqItem.id] || reqItem.status || 'Pending';
    const nextNotes =
      complianceNotesDrafts[reqItem.id] !== undefined
        ? complianceNotesDrafts[reqItem.id]
        : reqItem.resolutionNotes || '';

    try {
      const updated = await adminApi.updateComplianceRequest(reqItem.id, {
        status: nextStatus,
        resolutionNotes: nextNotes
      });
      setComplianceRequests((prev) => prev.map((r) => (r.id === reqItem.id ? updated : r)));
      addToast(`Updated ${reqItem.referenceId} to "${updated.status}".`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to update compliance request.', 'error');
    }
  };

  const handleDownloadExport = async () => {
    setIsExporting(true);
    try {
      const effectiveFormat = exportDataset === 'all' ? 'json' : exportFormat;
      const { blob, filename } = await adminApi.downloadAuthorizedExport(exportDataset, effectiveFormat);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      addToast(`Exported ${filename} successfully.`, 'success');
      if (activeTab === 'audit') {
        await loadAuditLogs();
      }
    } catch (err: any) {
      addToast(err.message || 'Authorized export failed.', 'error');
    } finally {
      setIsExporting(false);
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
      } else if (type === 'internship') {
        await adminApi.deleteInternship(id);
        setInternships(internships.filter((i) => i.id !== id));
        addToast(`Deleted internship "${title}".`, 'info');
      } else if (type === 'workshop') {
        await adminApi.deleteWorkshop(id);
        setWorkshops(workshops.filter((w) => w.id !== id));
        addToast(`Deleted workshop "${title}".`, 'info');
      } else if (type === 'course') {
        await adminApi.deleteCourse(id);
        setCourses(courses.filter((c) => c.id !== id));
        addToast(`Deleted course "${title}".`, 'info');
      } else if (type === 'submission') {
        await adminApi.deleteSubmittedOpportunity(id);
        setSubmittedOpportunities(submittedOpportunities.filter((o) => o.id !== id));
        addToast(`Deleted submission "${title}".`, 'info');
      } else if (type === 'compliance') {
        await adminApi.deleteComplianceRequest(id);
        setComplianceRequests(complianceRequests.filter((r) => r.id !== id));
        addToast(`Deleted compliance record "${title}".`, 'info');
      } else if (type === 'announcement' && content) {
        const updatedAnnouncements = content.announcements.filter((a) => a.id !== id);
        await adminApi.updateContent({ announcements: updatedAnnouncements });
        setContent({ ...content, announcements: updatedAnnouncements });
        addToast(`Removed announcement "${title}".`, 'info');
      }
      await loadDashboardData(true);
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
    setWorkshopImagePreview(DEFAULT_WORKSHOP_IMAGE);
    setWorkshopRegUrlDraft('');
    setIsWorkshopModalOpen(true);
  };

  const handleOpenEditWorkshop = (ws: AdminWorkshop) => {
    setEditingWorkshop(ws);
    setWorkshopImagePreview(ws.imageUrl || DEFAULT_WORKSHOP_IMAGE);
    setWorkshopRegUrlDraft(ws.registrationUrl || ws.registrationLink || '');
    setIsWorkshopModalOpen(true);
  };

  const handleToggleWorkshopFeatured = async (workshop: AdminWorkshop) => {
    try {
      const nextFeatured = !workshop.featured;
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { featured: nextFeatured });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`"${updated.title}" is now ${nextFeatured ? 'featured on homepage' : 'removed from featured'}.`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating featured status.', 'error');
    }
  };

  const handleChangeWorkshopStatus = async (workshop: AdminWorkshop, newStatus: string) => {
    try {
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { status: newStatus });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`Status updated to "${newStatus}".`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating status.', 'error');
    }
  };

  const handleChangeWorkshopAvailability = async (workshop: AdminWorkshop, newAvail: string) => {
    try {
      const updated = await adminApi.quickUpdateWorkshop(workshop.id, { availability: newAvail });
      setWorkshops(workshops.map((w) => (w.id === workshop.id ? updated : w)));
      addToast(`Availability updated to "${newAvail}".`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating availability.', 'error');
    }
  };

  const handleSaveWorkshop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const registrationUrl = String(formData.get('registrationUrl') || workshopRegUrlDraft || '').trim();
    if (!isValidWorkshopRegistrationUrl(registrationUrl)) {
      addToast('Please provide a valid Registration URL starting with http:// or https://.', 'error');
      return;
    }

    const imageUrl = (workshopImagePreview || String(formData.get('imageUrl') || '').trim()).trim();
    if (imageUrl && !isValidWorkshopImageUrl(imageUrl)) {
      addToast('Workshop banner image must be a valid URL or uploaded image.', 'error');
      return;
    }

    const format = normalizeWorkshopFormat(String(formData.get('format') || formData.get('workMode') || 'Online'));
    const status = normalizeWorkshopStatus(String(formData.get('status') || 'upcoming'));
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
      registrationUrl,
      registrationDeadline: String(formData.get('registrationDeadline') || '').trim(),
      availability: String(formData.get('availability') || 'Open').trim(),
      description: String(formData.get('description') || '').trim(),
      imageUrl,
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
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error saving workshop.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Courses Handlers (Phase 09)
  // -------------------------------------------------------------

  const handleOpenCreateCourse = () => {
    setEditingCourse(null);
    setCourseImagePreview(DEFAULT_COURSE_IMAGE);
    setCourseRegUrlDraft('');
    setIsCourseModalOpen(true);
  };

  const handleOpenEditCourse = (c: AdminCourse) => {
    setEditingCourse(c);
    setCourseImagePreview(c.imageUrl || getDefaultCourseImageForCategory(c.category));
    setCourseRegUrlDraft(c.registrationUrl || c.registrationLink || '');
    setIsCourseModalOpen(true);
  };

  const handleToggleCourseFeatured = async (course: AdminCourse) => {
    try {
      const nextFeatured = !course.featured;
      const updated = await adminApi.quickUpdateCourse(course.id, { featured: nextFeatured });
      setCourses(courses.map((c) => (c.id === course.id ? updated : c)));
      addToast(`"${updated.title}" is now ${nextFeatured ? 'featured on homepage' : 'removed from featured'}.`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating course featured status.', 'error');
    }
  };

  const handleChangeCourseStatus = async (course: AdminCourse, newStatus: 'available' | 'closed') => {
    try {
      const updated = await adminApi.quickUpdateCourse(course.id, { status: newStatus });
      setCourses(courses.map((c) => (c.id === course.id ? updated : c)));
      addToast(`"${updated.title}" marked as ${newStatus === 'closed' ? 'Closed' : 'Available'}.`, 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating course status.', 'error');
    }
  };

  const handleSaveCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const title = String(formData.get('title') || '').trim();
    const provider = String(formData.get('provider') || '').trim();
    const registrationUrl = String(formData.get('registrationUrl') || courseRegUrlDraft || '').trim();
    const imageUrl = (courseImagePreview || String(formData.get('imageUrl') || '').trim()).trim();

    if (!title) {
      addToast('Course title is required.', 'error');
      return;
    }
    if (!provider) {
      addToast('Provider or institution name is required.', 'error');
      return;
    }
    if (!isValidCourseRegistrationUrl(registrationUrl)) {
      addToast('Please provide a valid official registration URL starting with http:// or https://.', 'error');
      return;
    }
    if (imageUrl && !isValidCourseImageUrl(imageUrl)) {
      addToast('Course image must be a valid URL or uploaded image.', 'error');
      return;
    }

    const category = normalizeCourseCategory(String(formData.get('category') || 'Biotechnology'));
    const deliveryMode = normalizeDeliveryMode(String(formData.get('deliveryMode') || 'Online (Self-Paced)'));
    const status = normalizeCourseStatus(String(formData.get('status') || 'available'));
    const curriculum = parseCurriculumInput(String(formData.get('curriculum') || ''));
    const certificateInfo = String(formData.get('certificateInfo') || '').trim();
    const fees = String(formData.get('fees') || 'Free').trim() || 'Free';
    const featured = formData.get('featured') === 'on' || formData.get('featured') === 'true';

    const coursePayload: Partial<AdminCourse> = {
      title,
      name: title,
      provider,
      instructor: String(formData.get('instructor') || provider).trim(),
      category,
      duration: String(formData.get('duration') || '6 Weeks').trim(),
      level: String(formData.get('level') || 'Intermediate').trim(),
      deliveryMode,
      fees,
      price: fees,
      eligibility: String(formData.get('eligibility') || 'Life Sciences & Biotechnology Students').trim(),
      description: String(formData.get('description') || '').trim(),
      curriculum,
      syllabus: curriculum,
      certificateInfo,
      isCertificateAvailable: Boolean(certificateInfo),
      registrationDeadline: String(formData.get('registrationDeadline') || 'Open / Rolling').trim(),
      registrationUrl,
      registrationLink: registrationUrl,
      imageUrl: imageUrl || getDefaultCourseImageForCategory(category),
      status,
      availability: status === 'closed' ? 'Closed' : 'Available',
      featured
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
      await loadDashboardData(true);
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
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error saving highlights.', 'error');
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content) return;
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

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
      formEl.reset();
      await loadDashboardData(true);
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
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating announcement.', 'error');
    }
  };

  const handleSaveEditedAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content || !editingAnnouncement) return;
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') || '').trim();
    const tag = String(formData.get('tag') || 'Announcement').trim();
    const link = String(formData.get('link') || '/opportunities').trim() || '/opportunities';
    const date = String(formData.get('date') || editingAnnouncement.date).trim();
    const active = formData.get('active') === 'on';

    if (!title) {
      addToast('Announcement title is required.', 'error');
      return;
    }

    const updatedAnnouncements = content.announcements.map((a) =>
      a.id === editingAnnouncement.id ? { ...a, title, tag, link, date, active } : a
    );

    try {
      const updated = await adminApi.updateContent({ announcements: updatedAnnouncements });
      setContent(updated);
      setEditingAnnouncement(null);
      addToast('Announcement updated successfully.', 'success');
      await loadDashboardData(true);
    } catch (err: any) {
      addToast(err.message || 'Error updating announcement.', 'error');
    }
  };

  const isPendingJob = (j: AdminJob) =>
    j.verificationStatus === 'Pending Verification' || (!j.isApproved && j.verificationStatus !== 'Rejected');

  // Filtered views
  const filteredJobs = jobs.filter((j) => {
    if (jobFilterTab === 'pending' && !isPendingJob(j)) return false;
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

  const filteredCourses = courses.filter((c) => {
    if (courseCategoryFilter !== 'all') {
      if (normalizeCourseCategory(c.category) !== courseCategoryFilter) return false;
    }
    if (courseStatusFilter !== 'all') {
      if (normalizeCourseStatus(c.status, c.availability) !== courseStatusFilter) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.title || '').toLowerCase().includes(q) ||
      (c.provider || '').toLowerCase().includes(q) ||
      (c.instructor || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  });

  const isPendingInternship = (intern: AdminInternship) =>
    intern.verificationStatus === 'Pending Verification' ||
    (!intern.isApproved && intern.verificationStatus !== 'Rejected');

  const filteredInternships = internships.filter((intern) => {
    if (internshipFilterTab === 'pending' && !isPendingInternship(intern)) return false;
    if (internshipFilterTab === 'verified' && intern.verificationStatus !== 'Verified') return false;
    if (internshipFilterTab === 'rejected' && intern.verificationStatus !== 'Rejected') return false;
    if (internshipFilterTab === 'expired' && intern.isActive && intern.verificationStatus !== 'Expired') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      intern.title.toLowerCase().includes(q) ||
      intern.organization.toLowerCase().includes(q) ||
      intern.location.toLowerCase().includes(q) ||
      intern.category.toLowerCase().includes(q)
    );
  });

  const filteredSubmissions = submittedOpportunities.filter((opp) => {
    if (submissionFilterTab === 'pending' && (opp.isApproved || opp.status === 'Rejected')) return false;
    if (submissionFilterTab === 'approved' && !opp.isApproved) return false;
    if (submissionFilterTab === 'rejected' && opp.status !== 'Rejected') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      opp.title.toLowerCase().includes(q) ||
      opp.organization.toLowerCase().includes(q) ||
      opp.type.toLowerCase().includes(q) ||
      opp.location.toLowerCase().includes(q)
    );
  });

  const filteredComplianceRequests = complianceRequests.filter((reqItem) => {
    if (complianceTypeFilter !== 'all' && reqItem.requestType !== complianceTypeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      reqItem.referenceId.toLowerCase().includes(q) ||
      reqItem.requesterName.toLowerCase().includes(q) ||
      reqItem.requesterEmail.toLowerCase().includes(q) ||
      reqItem.targetTitleOrUrl.toLowerCase().includes(q) ||
      reqItem.details.toLowerCase().includes(q)
    );
  });

  const filteredContactMessages = contactMessages.filter((msg) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      msg.name.toLowerCase().includes(q) ||
      msg.email.toLowerCase().includes(q) ||
      msg.subject.toLowerCase().includes(q) ||
      msg.message.toLowerCase().includes(q)
    );
  });

  const pendingApprovalsCount =
    jobs.filter((j) => !j.isApproved && j.verificationStatus !== 'Rejected').length +
    submittedOpportunities.filter((o) => !o.isApproved && o.status !== 'Rejected').length;

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
            BIO-INEXA Portal Management
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage live jobs, internships, workshops, academy courses, moderation queues, and website highlights from the relational database.
          </p>
        </div>

        {/* Authenticated Admin Badge, Live Refresh & Logout */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh live statistics and database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-mono">
            <div className="text-teal-300 text-[10px]">
              Logged in as {lastRefreshedAt ? `· Synced ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
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

      {/* Live Database KPI Summary Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Jobs</div>
            <div className="text-xl font-bold font-mono text-[#0B2A5B] dark:text-sky-400 mt-1">{stats.activeJobs}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.totalJobs} total · <span className="text-amber-600 font-semibold">{stats.pendingJobs} pending</span>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Internships</div>
            <div className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">{stats.activeInternships}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.totalInternships} total · {stats.verifiedInternships} verified
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Academy Catalog</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {stats.totalWorkshops + stats.totalCourses}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.totalWorkshops} workshops · {stats.totalCourses} courses
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Moderation &amp; Reports</div>
            <div className="text-xl font-bold font-mono text-amber-600 mt-1">
              {stats.pendingSubmissions + stats.openComplianceRequests}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.pendingSubmissions} submissions · {stats.openJobReportsCount} open reports
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inbox &amp; Sync Logs</div>
            <div className="text-xl font-bold font-mono text-emerald-600 mt-1">{stats.syncRunsCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.contactMessagesCount} messages · {stats.auditLogsCount} audit events
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            ['jobs', `Jobs (${jobs.length})`, Briefcase],
            ['internships', `Internships (${internships.length})`, Star],
            ['workshops', `Workshops (${workshops.length})`, Calendar],
            ['courses', `Courses (${courses.length})`, GraduationCap],
            ['submissions', `Submissions & Reports (${submittedOpportunities.length + complianceRequests.length})`, Inbox],
            ['content', 'Website Content', Globe],
            ['sheets', 'Sheets Sync', Database],
            ['sources', 'Sources Registry', Layers],
            ['backups', `Backups (${backups.length})`, HardDrive],
            ['automation', `Feeds (${pendingApprovalsCount} pending)`, Sparkles],
            ['audit', 'Logs & Export', History]
          ].map(([tabKey, label, Icon]: any) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => {
                setActiveTab(tabKey);
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all cursor-pointer ${
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
        {(activeTab === 'jobs' || activeTab === 'internships' || activeTab === 'workshops' || activeTab === 'courses' || activeTab === 'submissions') && (
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
              <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
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
            type="button"
            onClick={() => loadDashboardData(false)}
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
                  ['pending', `Pending Audit (${jobs.filter(isPendingJob).length})`],
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

                                {/* Approve / Reject Inline Controls */}
                                {(!job.isApproved || job.verificationStatus === 'Pending Verification' || job.verificationStatus === 'Rejected') && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveJobDirect(job.id, job.title)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Approve & Publish Job"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {job.verificationStatus !== 'Rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectJob(job.id, job.title)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold border border-rose-200 cursor-pointer"
                                    title="Reject Job Listing"
                                  >
                                    Reject
                                  </button>
                                )}

                                {/* Audit & Verify Dedicated Modal */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const initialStatus = job.verificationStatus || 'Pending Verification';
                                    setVerifyingJob(job);
                                    setVerifyModalStatus(initialStatus);
                                    setVerifyModalDate(
                                      initialStatus === 'Pending Verification' ? '' : (job.lastVerificationDate || '')
                                    );
                                    setVerifyingJobHistory([]);
                                    setIsVerificationModalOpen(true);
                                    setIsLoadingJobHistory(true);
                                    adminApi
                                      .getJobVerificationHistory(job.id)
                                      .then((records) => setVerifyingJobHistory(records))
                                      .catch(() => setVerifyingJobHistory([]))
                                      .finally(() => setIsLoadingJobHistory(false));
                                  }}
                                  className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 rounded-lg text-[11px] font-bold border border-teal-200 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Audit Employer, Source & Destination"
                                >
                                  <FileCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                  <span>Verify</span>
                                </button>

                                {/* Status Switch */}
                                <button
                                  type="button"
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
                                  type="button"
                                  onClick={() => {
                                    setEditingJob(job);
                                    setIsJobModalOpen(true);
                                  }}
                                  aria-label={`Edit job ${job.title}`}
                                  className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100"
                                  title="Edit Job Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Job with Confirmation */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'job',
                                      id: job.id,
                                      title: job.title
                                    })
                                  }
                                  aria-label={`Delete job ${job.title}`}
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
          {/* PANEL A2: INTERNSHIPS MANAGEMENT                          */}
          {/* ========================================================= */}
          {activeTab === 'internships' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Biotechnology Internships &amp; Fellowships Control</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                      {internships.length} Listings
                    </span>
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Manage summer research fellowships, industrial biotech internships, stipends, and host portal verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingInternship(null);
                    setIsInternshipModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Internship</span>
                </button>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ['all', `All (${internships.length})`],
                  ['pending', `Pending (${internships.filter(isPendingInternship).length})`],
                  ['verified', `Verified (${internships.filter((i) => i.verificationStatus === 'Verified').length})`],
                  ['rejected', `Rejected (${internships.filter((i) => i.verificationStatus === 'Rejected').length})`],
                  ['expired', `Closed / Expired (${internships.filter((i) => !i.isActive || i.verificationStatus === 'Expired').length})`]
                ].map(([tabKey, label]: any) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setInternshipFilterTab(tabKey)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      internshipFilterTab === tabKey
                        ? 'bg-[#0B2A5B] text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Title &amp; Host Organization</th>
                        <th className="py-3 px-4">Category &amp; Mode</th>
                        <th className="py-3 px-4">Stipend / Deadline</th>
                        <th className="py-3 px-4">Verification Audit</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredInternships.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No internships found matching your current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredInternships.map((intern) => (
                          <tr key={intern.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{intern.title}</div>
                              <div className="text-[11px] text-teal-600 font-semibold">{intern.organization}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div>{intern.category}</div>
                              <div className="text-[11px] text-slate-400">{intern.location} ({intern.workMode})</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono text-emerald-600 font-semibold">{intern.stipend}</div>
                              <div className="text-[11px] text-slate-400">{intern.duration} · Deadline: {intern.deadline || 'Rolling'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {intern.verificationStatus === 'Verified' && intern.isApproved ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Verified</span>
                                  </span>
                                ) : intern.verificationStatus === 'Rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full border border-rose-300">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Rejected</span>
                                  </span>
                                ) : !intern.isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                                    <Clock className="w-3 h-3" />
                                    <span>Closed</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>{intern.verificationStatus || 'Pending Verification'}</span>
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-400">
                                  Source: {intern.sourceName || 'Verified Partner'}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {intern.applicationUrl && (
                                  <a
                                    href={intern.applicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50"
                                    title="Open Official Portal"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {(!intern.isApproved || intern.verificationStatus !== 'Verified') && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveInternship(intern.id, intern.title)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                )}
                                {intern.verificationStatus !== 'Rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectInternship(intern.id, intern.title)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold border border-rose-200 cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerifyingInternship(intern);
                                    setIsInternshipVerificationModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 rounded-lg text-[11px] font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  <span>Verify</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleInternshipActive(intern)}
                                  className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                                    intern.isActive
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {intern.isActive ? 'Expire' : 'Reopen'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingInternship(intern);
                                    setIsInternshipModalOpen(true);
                                  }}
                                  aria-label={`Edit internship ${intern.title}`}
                                  className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'internship',
                                      id: intern.id,
                                      title: intern.title
                                    })
                                  }
                                  aria-label={`Delete internship ${intern.title}`}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
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
                            aria-label={w.featured ? `Unfeature ${w.title} from homepage` : `Feature ${w.title} on homepage`}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
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
                            {w.organizer} {w.instructor && w.instructor !== w.organizer && `· ${w.instructor}`}
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
                              aria-label={`Status for ${w.title}`}
                              value={normalizeWorkshopStatus(w.status)}
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
                              aria-label={`Availability for ${w.title}`}
                              value={normalizeAvailabilityOption(w.availability)}
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
                            aria-label={`Open registration portal for ${w.title}`}
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
                          type="button"
                          onClick={() => handleOpenEditWorkshop(w)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg font-bold border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'workshop',
                              id: w.id,
                              title: w.title
                            })
                          }
                          aria-label={`Delete ${w.title}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
          {/* PANEL C: COURSES MANAGEMENT (PHASE 09)                    */}
          {/* ========================================================= */}
          {activeTab === 'courses' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Biotechnology Courses &amp; Educational Programs</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                      {courses.length} Courses
                    </span>
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Add, edit, or remove educational courses across 9 disciplines, upload course images, manage official registration links, availability, and homepage features.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateCourse}
                  className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Course</span>
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Courses</span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">{courses.length}</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available</span>
                  <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {courses.filter((c) => normalizeCourseStatus(c.status, c.availability) === 'available').length}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closed</span>
                  <span className="text-lg font-bold font-mono text-slate-500">
                    {courses.filter((c) => normalizeCourseStatus(c.status, c.availability) === 'closed').length}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Homepage Featured</span>
                  <span className="text-lg font-bold font-mono text-amber-500">
                    {courses.filter((c) => c.featured).length}
                  </span>
                </div>
              </div>

              {/* Filter Toolbar: 9 Categories + Availability Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <label htmlFor="admin-course-category-filter" className="text-slate-400 font-semibold text-[11px]">
                    Category:
                  </label>
                  <select
                    id="admin-course-category-filter"
                    value={courseCategoryFilter}
                    onChange={(e) => setCourseCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-[11px] focus:outline-none"
                  >
                    <option value="all">All 9 Categories</option>
                    {COURSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-semibold text-[11px]">Status:</span>
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'available', label: 'Available' },
                      { id: 'closed', label: 'Closed' }
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCourseStatusFilter(st.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        courseStatusFilter === st.id
                          ? 'bg-[#0B2A5B] text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Courses Cards Grid */}
              {filteredCourses.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                  No courses match the current category or status filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCourses.map((c) => {
                    const normalizedStatus = normalizeCourseStatus(c.status, c.availability);
                    const curriculumList = c.curriculum || c.syllabus || [];
                    const regUrl = c.registrationUrl || c.registrationLink || '';

                    return (
                      <div
                        key={c.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden hover:border-[#14A3A0]/60 transition-all"
                      >
                        <div>
                          {/* Course Banner Thumbnail */}
                          <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                            <img
                              src={c.imageUrl || getDefaultCourseImageForCategory(c.category)}
                              alt={c.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

                            <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-[#0B2A5B]/90 backdrop-blur-md truncate max-w-[170px]">
                                {normalizeCourseCategory(c.category)}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleToggleCourseFeatured(c)}
                                aria-label={
                                  c.featured
                                    ? `Unfeature course ${c.title} from homepage`
                                    : `Feature course ${c.title} on homepage`
                                }
                                className={`p-1.5 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
                                  c.featured
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-slate-900/60 text-slate-300 hover:text-amber-400'
                                }`}
                                title={c.featured ? 'Featured on Homepage (Click to unfeature)' : 'Feature on Homepage'}
                              >
                                <Star className={`w-3.5 h-3.5 ${c.featured ? 'fill-current' : ''}`} />
                              </button>
                            </div>

                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white font-mono">
                              <span>{c.duration || 'Self-Paced'}</span>
                              <span className="font-bold text-emerald-300 truncate max-w-[130px]">
                                {c.fees || c.price || 'See Provider'}
                              </span>
                            </div>
                          </div>

                          {/* Course Info Body */}
                          <div className="p-4 space-y-2.5">
                            <div>
                              <div className="text-[10px] font-semibold text-[#14A3A0] truncate">
                                {c.provider || c.instructor || 'Course Provider'}
                              </div>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-2">
                                {c.title}
                              </h3>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                              {c.description}
                            </p>

                            <div className="space-y-1 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <span>Mode:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                  {c.deliveryMode || 'Online (Self-Paced)'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span>Deadline:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">
                                  {c.registrationDeadline || 'Open / Rolling'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span>Curriculum:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {curriculumList.length} module{curriculumList.length === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>

                            {/* Quick Status Toggle */}
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">
                                Course Availability
                              </label>
                              <select
                                aria-label={`Availability status for ${c.title}`}
                                value={normalizedStatus}
                                onChange={(e) =>
                                  handleChangeCourseStatus(c, e.target.value as 'available' | 'closed')
                                }
                                className={`w-full px-2.5 py-1 rounded-lg border font-bold text-[11px] focus:outline-none ${
                                  normalizedStatus === 'closed'
                                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                <option value="available">Available (Registration Open)</option>
                                <option value="closed">Closed (Registration Closed)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {isValidCourseRegistrationUrl(regUrl) ? (
                              <a
                                href={regUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open official registration link for ${c.title}`}
                                className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                title="Verify Official Registration URL in New Tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-amber-500">No URL</span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {c.featured ? '★ Featured' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCourse(c)}
                              aria-label={`Edit course ${c.title}`}
                              className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg font-bold border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: 'course',
                                  id: c.id,
                                  title: c.title
                                })
                              }
                              aria-label={`Delete course ${c.title}`}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Course"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

                <form key={JSON.stringify(content.homepageHighlights || {})} onSubmit={handleSaveHighlights} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Participating Institutes Metric Text
                      </label>
                      <input
                        type="text"
                        name="participatingInstitutesCount"
                        defaultValue={content.homepageHighlights?.participatingInstitutesCount}
                        placeholder="e.g. 45+ CSIR, DBT & Biopharma Centers"
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
                  <div className="sm:col-span-5 space-y-1">
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
                  <div className="sm:col-span-2 space-y-1">
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
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Destination Link / Route
                    </label>
                    <input
                      type="text"
                      name="link"
                      defaultValue="/opportunities"
                      placeholder="/opportunities or https://..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post Notice</span>
                    </button>
                  </div>
                </form>

                {/* Inline Edit Announcement Form */}
                {editingAnnouncement && (
                  <form
                    onSubmit={handleSaveEditedAnnouncement}
                    className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                        Edit Announcement Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        required
                        defaultValue={editingAnnouncement.title}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block font-bold text-amber-900 dark:text-amber-200 text-[11px]">Tag</label>
                      <input
                        type="text"
                        name="tag"
                        defaultValue={editingAnnouncement.tag}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block font-bold text-amber-900 dark:text-amber-200 text-[11px]">Link</label>
                      <input
                        type="text"
                        name="link"
                        defaultValue={editingAnnouncement.link}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 space-y-1">
                      <label className="block font-bold text-amber-900 dark:text-amber-200 text-[11px]">Active</label>
                      <label className="flex items-center gap-1.5 h-8 cursor-pointer">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={editingAnnouncement.active}
                          className="rounded text-[#0B2A5B]"
                        />
                        <span className="text-[11px]">Live</span>
                      </label>
                    </div>
                    <input type="hidden" name="date" value={editingAnnouncement.date} />
                    <div className="sm:col-span-2 flex items-center gap-1.5">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAnnouncement(null)}
                        className="px-2.5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

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
                          type="button"
                          onClick={() => setEditingAnnouncement(ann)}
                          aria-label={`Edit announcement ${ann.title}`}
                          className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="Edit Announcement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncement(ann.id, ann.active)}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                            ann.active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {ann.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'announcement',
                              id: ann.id,
                              title: ann.title
                            })
                          }
                          aria-label={`Delete announcement ${ann.title}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
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
          {/* PANEL D2: USER SUBMISSIONS, REPORTS & COMPLIANCE INBOX    */}
          {/* ========================================================= */}
          {activeTab === 'submissions' && (
            <div className="space-y-6 text-xs">
              {/* Section 1: User-Submitted Opportunities */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      User-Submitted Opportunities Moderation ({filteredSubmissions.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Approve, edit, reject (preserved in database with Rejected status), or permanently remove organizer submissions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((statusKey) => (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setSubmissionFilterTab(statusKey)}
                        className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[10px] cursor-pointer transition-colors ${
                          submissionFilterTab === statusKey
                            ? 'bg-[#0B2A5B] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {statusKey}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No submitted opportunities match your current filter.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSubmissions.map((opp) => (
                      <div key={opp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <div className="space-y-1 max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                opp.status === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : opp.isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {opp.type} · {opp.status === 'Rejected' ? 'Rejected' : opp.isApproved ? 'Approved' : 'Pending Review'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{opp.id}</span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{opp.title}</div>
                          <div className="text-teal-600 font-semibold text-[11px]">
                            {opp.organization} · {opp.location} ({opp.workMode}) · Deadline: {opp.deadline || 'Not specified'}
                          </div>
                          <p className="text-slate-500 text-[11px] line-clamp-2">{opp.description}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {opp.applicationUrl && (
                            <a
                              href={opp.applicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg border border-slate-200 dark:border-slate-700"
                              title="Verify Submission Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!opp.isApproved && (
                            <button
                              type="button"
                              onClick={() => handleApproveSubmittedOpportunity(opp.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                          {opp.status !== 'Rejected' && (
                            <button
                              type="button"
                              onClick={() => handleRejectSubmittedOpportunity(opp.id, opp.title)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-200 cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubmission(opp);
                              setIsSubmissionEditModalOpen(true);
                            }}
                            aria-label={`Edit submission ${opp.title}`}
                            className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'submission',
                                id: opp.id,
                                title: opp.title
                              })
                            }
                            aria-label={`Delete submission ${opp.title}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Reported Opportunities & Compliance / Takedown Requests */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Reported Opportunities &amp; Compliance Queue ({filteredComplianceRequests.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Triage candidate job reports, content removal requests, DPDP privacy notices, and grievances.
                    </p>
                  </div>
                  <select
                    value={complianceTypeFilter}
                    onChange={(e) => setComplianceTypeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs focus:outline-none"
                  >
                    <option value="all">All Request Types ({complianceRequests.length})</option>
                    <option value="job_report">Reported Opportunities</option>
                    <option value="content_removal">Content Takedowns</option>
                    <option value="privacy_request">DPDP Privacy Requests</option>
                    <option value="grievance">Grievances</option>
                  </select>
                </div>

                {filteredComplianceRequests.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No compliance or opportunity report records found.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredComplianceRequests.map((reqItem) => {
                      const currentStatus = complianceStatusDrafts[reqItem.id] ?? reqItem.status;
                      const currentNotes = complianceNotesDrafts[reqItem.id] ?? reqItem.resolutionNotes ?? '';
                      return (
                        <div key={reqItem.id} className="p-4 space-y-3 hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-[#0B2A5B] dark:text-sky-400">{reqItem.referenceId}</span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                                  {reqItem.requestType.replace('_', ' ')} · {reqItem.subCategory || 'General'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    reqItem.status === 'Resolved' || reqItem.status === 'Action Taken'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : reqItem.status === 'In Review'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {reqItem.status}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                Target: {reqItem.targetTitleOrUrl || 'N/A'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                From: <strong>{reqItem.requesterName}</strong> ({reqItem.requesterEmail})
                                {reqItem.organization ? ` · ${reqItem.organization}` : ''} · {new Date(reqItem.createdAt).toLocaleString()}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{reqItem.details}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: 'compliance',
                                  id: reqItem.id,
                                  title: `${reqItem.referenceId} (${reqItem.requestType})`
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 self-start cursor-pointer"
                              title="Delete Compliance Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="sm:col-span-3">
                              <select
                                aria-label={`Status for ${reqItem.referenceId}`}
                                value={currentStatus}
                                onChange={(e) =>
                                  setComplianceStatusDrafts((prev) => ({ ...prev, [reqItem.id]: e.target.value }))
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs focus:outline-none"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Review">In Review</option>
                                <option value="Action Taken">Action Taken</option>
                                <option value="Resolved">Resolved</option>
                              </select>
                            </div>
                            <div className="sm:col-span-7">
                              <input
                                type="text"
                                aria-label={`Resolution notes for ${reqItem.referenceId}`}
                                value={currentNotes}
                                onChange={(e) =>
                                  setComplianceNotesDrafts((prev) => ({ ...prev, [reqItem.id]: e.target.value }))
                                }
                                placeholder="Enter moderation action or resolution notes..."
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                onClick={() => handleSaveComplianceUpdate(reqItem)}
                                className="w-full py-1.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                Update Status
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Contact Messages Inbox */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-teal-600" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Institutional &amp; Candidate Inquiries ({filteredContactMessages.length})
                    </h2>
                  </div>
                </div>
                {filteredContactMessages.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No contact inquiries found.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredContactMessages.map((msg) => (
                      <div key={msg.id} className="p-4 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-teal-600">{msg.referenceId}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{msg.subject}</span>
                          </div>
                          <span className="text-[11px] text-slate-400">{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {msg.name} &lt;{msg.email}&gt;
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PANEL E: SERVER-SIDE GOOGLE SHEETS SYNC CONSOLE           */}
          {/* ========================================================= */}
          {activeTab === 'sheets' && (
            <GoogleSheetsSyncPanel
              pendingReviewCount={jobs.filter((j) => !j.isApproved).length}
              pendingSheetsJobs={jobs.filter(
                (j) =>
                  !j.isApproved &&
                  String(j.sourceName || j.originalSource || '')
                    .toLowerCase()
                    .includes('google sheets')
              )}
              onApproveJob={handleApproveJobDirect}
              onRejectJob={handleRejectJob}
              onRefreshDashboard={() => loadDashboardData(true)}
              onNavigateToReview={() => setActiveTab('automation')}
            />
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
                  BIO-INEXA operates strictly under Section 6 &amp; 11 legal standards: no unauthorized web scraping, no bypass of authentication walls, and 100% adherence to platform terms of service.
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
                      BIO-INEXA utilizes an embedded, ACID-compliant SQLite engine (<code className="font-mono text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-1 py-0.5 rounded">bionexa.db</code>) with WAL journal mode, parameterized SQL queries, foreign-key relational integrity, and zero external network latency.
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
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{databaseEngine}</div>
                    <div className="text-[10px] text-teal-600 mt-0.5">Live Persistent Relational Storage</div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 text-[11px] font-medium">Stored Records</div>
                    <div className="text-sm font-bold text-[#0B2A5B] dark:text-sky-400 mt-0.5">
                      {jobs.length} Jobs · {internships.length} Internships · {workshops.length} Workshops · {courses.length} Courses
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
              submittedOpportunities={submittedOpportunities}
              syncHistory={syncHistory}
              onRefreshAll={() => loadDashboardData(true)}
              onApproveJob={async (id) => {
                await handleApproveJobDirect(id, jobs.find((j) => j.id === id)?.title || id);
              }}
              onRejectJob={handleRejectJob}
              onApproveSubmittedOpportunity={handleApproveSubmittedOpportunity}
              onRejectSubmittedOpportunity={handleRejectSubmittedOpportunity}
              onEditSubmittedOpportunity={(opp) => {
                setEditingSubmission(opp);
                setIsSubmissionEditModalOpen(true);
              }}
              onDeleteSubmittedOpportunity={async (id, title) => {
                setDeleteConfirm({ type: 'submission', id, title });
              }}
            />
          )}

          {/* ========================================================= */}
          {/* PANEL K: ADMINISTRATOR ACTIVITY LOGS & AUTHORIZED EXPORT  */}
          {/* ========================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6 text-xs">
              {/* Authorized Record Export Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Download className="w-4 h-4 text-teal-600" />
                      <span>Authorized Database Record Export</span>
                    </h2>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Export authorized records in CSV (formula-safe) or structured JSON. Every export is audited and RBAC-verified.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="sm:col-span-5 space-y-1">
                    <label htmlFor="admin-export-dataset" className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Authorized Dataset
                    </label>
                    <select
                      id="admin-export-dataset"
                      value={exportDataset}
                      onChange={(e) => {
                        const val = e.target.value as AdminExportDataset;
                        setExportDataset(val);
                        if (val === 'all') setExportFormat('json');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold text-xs focus:outline-none"
                    >
                      {ADMIN_EXPORT_DATASETS.map((ds) => {
                        const permitted = hasExportDatasetPermission(adminUser.permissions, ds);
                        return (
                          <option key={ds} value={ds} disabled={!permitted}>
                            {ds.replace('_', ' ').toUpperCase()}{!permitted ? ' (Requires Higher Role)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label htmlFor="admin-export-format" className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      File Format
                    </label>
                    <select
                      id="admin-export-format"
                      value={exportDataset === 'all' ? 'json' : exportFormat}
                      disabled={exportDataset === 'all'}
                      onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold text-xs focus:outline-none disabled:opacity-60"
                    >
                      <option value="csv">CSV Spreadsheet</option>
                      <option value="json">JSON Archive</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={handleDownloadExport}
                      disabled={isExporting || !hasExportDatasetPermission(adminUser.permissions, exportDataset)}
                      className="w-full py-2 px-4 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting ? 'Preparing Export...' : 'Download Authorized Export'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrator Activity Logs */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Administrator Activity &amp; Security Audit Trail ({auditLogs.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Immutable record of administrative mutations, moderation decisions, backups, and exports.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    disabled={isLoadingAuditLogs}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {auditLogsForbidden ? (
                  <div className="p-6 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Your current role ({adminUser.role}) does not include the <code>audit:read</code> permission required to inspect administrator security logs.
                    </span>
                  </div>
                ) : auditLogsError ? (
                  <div className="p-6 text-rose-600 text-xs">{auditLogsError}</div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    {isLoadingAuditLogs ? 'Loading activity logs...' : 'No administrator activity logs recorded yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Target</th>
                          <th className="py-2.5 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {auditLogs.map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(log.createdAt || log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{log.actorEmail || log.actorUsername || 'admin'}</div>
                              <div className="text-[10px] text-slate-400 uppercase">{log.actorRole || 'admin'}</div>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-teal-700 dark:text-teal-400 font-bold">
                              {log.action}
                            </td>
                            <td className="py-2.5 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                              {log.targetType || '-'}{log.targetId ? `: ${log.targetId}` : ''}
                            </td>
                            <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {loginAttempts.length > 0 && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Recent Authentication Events ({loginAttempts.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {loginAttempts.slice(0, 8).map((att, idx) => (
                        <span
                          key={att.id || idx}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border ${
                            att.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          {att.username || 'unknown'} · {att.success ? 'OK' : 'DENIED'} ·{' '}
                          {new Date(att.createdAt || att.timestamp).toLocaleTimeString()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                const status = verifyModalStatus;
                const notes = (form.elements.namedItem('verificationNotes') as HTMLTextAreaElement).value.trim();
                const lastVerificationDate =
                  status === 'Pending Verification' ? '' : (verifyModalDate || new Date().toISOString().split('T')[0]);

                try {
                  const updated = await adminApi.verifyJob(verifyingJob.id, status, notes, lastVerificationDate);
                  setJobs(jobs.map((j) => (j.id === verifyingJob.id ? updated : j)));
                  addToast(`Audit decision saved for "${verifyingJob.title}": Status set to ${status}.`, 'success');
                  setIsVerificationModalOpen(false);
                  setVerifyingJob(null);
                  await loadDashboardData(true);
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
              {(() => {
                const urlCheck = validateApplicationUrl(verifyingJob.applicationUrl);
                return (
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
                      <div
                        className={`px-3 py-2 rounded-xl border text-[11px] flex items-center gap-2 ${
                          urlCheck.valid
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {urlCheck.valid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span>
                          {urlCheck.valid
                            ? `URL Validation Passed (${urlCheck.domain})${urlCheck.isOfficialDomain ? ' — Recognized official/academic domain' : ''}`
                            : urlCheck.reason}
                        </span>
                      </div>
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
                );
              })()}

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
                    7. Last Verification Date {verifyModalStatus !== 'Pending Verification' ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    name="lastVerificationDate"
                    required={verifyModalStatus !== 'Pending Verification'}
                    disabled={verifyModalStatus === 'Pending Verification'}
                    value={verifyModalDate}
                    onChange={(e) => setVerifyModalDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold focus:outline-none disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
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
                  value={verifyModalStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setVerifyModalStatus(nextStatus);
                    if (nextStatus === 'Pending Verification') {
                      setVerifyModalDate('');
                    } else if (!verifyModalDate) {
                      setVerifyModalDate(new Date().toISOString().split('T')[0]);
                    }
                  }}
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
                  defaultValue={verifyingJob.verificationNotes || ''}
                  placeholder="Record your verification steps (e.g. checked CSIR careers website; confirmed recruitment portal is operational without charging fees)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Recorded Verification History Timeline */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-teal-600" />
                    <span>Recorded Verification History</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {verifyingJobHistory.length} {verifyingJobHistory.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                {isLoadingJobHistory ? (
                  <p className="text-[11px] text-slate-400">Loading audit history...</p>
                ) : verifyingJobHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No prior verification decisions have been logged for this job yet.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {verifyingJobHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{rec.sourceStatus}</span>
                          <span className="text-[10px] text-slate-400">
                            {rec.verifiedBy} · {new Date(rec.verifiedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {rec.notes && <p className="text-slate-600 dark:text-slate-400 mt-0.5">{rec.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Candidate Protection Warning */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Legal &amp; Trust Requirement:</strong> Only mark as &ldquo;Verified&rdquo; if the employer identity and application destination have actually been tested. Never mark an opportunity as verified without auditing.
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
                type="button"
                aria-label="Close workshop modal"
                onClick={() => {
                  setIsWorkshopModalOpen(false);
                  setEditingWorkshop(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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

              {/* Image Selection: URL, Presets & Server File Upload */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                    <span>Workshop Banner Image</span>
                  </label>
                  <label className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3 h-3 text-teal-500" />
                    <span>{isUploadingWorkshopImage ? 'Uploading...' : 'Upload Image File'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={isUploadingWorkshopImage}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          addToast('Image must be 5 MB or smaller.', 'error');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const dataUrl = event.target?.result;
                          if (typeof dataUrl !== 'string') return;
                          setIsUploadingWorkshopImage(true);
                          try {
                            const uploadedPath = await adminApi.uploadWorkshopImage(file.name, dataUrl);
                            setWorkshopImagePreview(uploadedPath);
                            addToast('Workshop banner image uploaded to server.', 'success');
                          } catch (err: any) {
                            addToast(err.message || 'Failed to upload workshop image.', 'error');
                          } finally {
                            setIsUploadingWorkshopImage(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>

                {/* Direct URL or Uploaded Path input */}
                <input
                  type="text"
                  name="imageUrl"
                  value={workshopImagePreview}
                  onChange={(e) => setWorkshopImagePreview(e.target.value)}
                  placeholder="Paste banner image URL, upload a file, or select a preset below..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none"
                />

                {/* Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-medium block">Or choose a biotech training preset:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'CRISPR Gene Editing', url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80' },
                      { name: 'NGS Bioinformatics', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Fermentation Bioprocess', url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Flow Cytometry', url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Food Safety & QA Lab', url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80' },
                      { name: 'Drug Discovery', url: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80' }
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => setWorkshopImagePreview(preset.url)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
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
                    defaultValue={normalizeWorkshopFormat(editingWorkshop?.format || editingWorkshop?.workMode)}
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
                    defaultValue={toDateInputValue(editingWorkshop?.startDate || editingWorkshop?.date, '2026-12-10')}
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
                    defaultValue={toDateInputValue(editingWorkshop?.registrationDeadline, '2026-12-05')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Registration URL * (Official Destination)
                    </label>
                    {isValidWorkshopRegistrationUrl(workshopRegUrlDraft) && (
                      <a
                        href={workshopRegUrlDraft.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline"
                      >
                        <span>Test URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    name="registrationUrl"
                    required
                    value={workshopRegUrlDraft}
                    onChange={(e) => setWorkshopRegUrlDraft(e.target.value)}
                    placeholder="https://www.igib.res.in/"
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
                    defaultValue={normalizeWorkshopStatus(editingWorkshop?.status)}
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
                    defaultValue={normalizeAvailabilityOption(editingWorkshop?.availability)}
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
      {/* ADD / EDIT COURSE MODAL (PHASE 09)                        */}
      {/* ========================================================= */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                  Course Management
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingCourse ? `Edit Course: ${editingCourse.title}` : 'Add Biotechnology Course'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close course modal"
                onClick={() => {
                  setIsCourseModalOpen(false);
                  setEditingCourse(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              {/* Course Name */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Course Name / Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingCourse?.title}
                  placeholder="e.g. Industrial Biotechnology & Bioprocess Engineering"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Course Image Selection & Server Upload */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                    <span>Course Banner Image</span>
                  </label>
                  <label className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3 h-3 text-teal-500" />
                    <span>{isUploadingCourseImage ? 'Uploading...' : 'Upload Course Image'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={isUploadingCourseImage}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          addToast('Image must be 5 MB or smaller.', 'error');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const dataUrl = event.target?.result;
                          if (typeof dataUrl !== 'string') return;
                          setIsUploadingCourseImage(true);
                          try {
                            const uploadedPath = await adminApi.uploadCourseImage(file.name, dataUrl);
                            setCourseImagePreview(uploadedPath);
                            addToast('Course image uploaded to server.', 'success');
                          } catch (err: any) {
                            addToast(err.message || 'Failed to upload course image.', 'error');
                          } finally {
                            setIsUploadingCourseImage(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>

                <input
                  type="text"
                  name="imageUrl"
                  value={courseImagePreview}
                  onChange={(e) => setCourseImagePreview(e.target.value)}
                  placeholder="Paste course image URL, upload a file, or select a category preset..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {COURSE_CATEGORIES.slice(0, 6).map((catPreset) => {
                    const presetUrl = getDefaultCourseImageForCategory(catPreset);
                    return (
                      <button
                        type="button"
                        key={catPreset}
                        onClick={() => setCourseImagePreview(presetUrl)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                          courseImagePreview === presetUrl
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {catPreset}
                      </button>
                    );
                  })}
                </div>

                {courseImagePreview && (
                  <div className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900">
                    <img src={courseImagePreview} alt="Course Preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-2 text-[9px] bg-slate-950/80 px-2 py-0.5 rounded text-white font-mono">
                      Image Preview
                    </span>
                  </div>
                )}
              </div>

              {/* Provider & Instructor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Provider / Institution *</label>
                  <input
                    type="text"
                    name="provider"
                    required
                    defaultValue={editingCourse?.provider || ''}
                    placeholder="e.g. NPTEL / SWAYAM, EMBL-EBI, Biocon Academy"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Lead Instructor (Optional)</label>
                  <input
                    type="text"
                    name="instructor"
                    defaultValue={editingCourse?.instructor || ''}
                    placeholder="e.g. Faculty / Coordinator Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category, Delivery Mode & Level */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Course Category *</label>
                  <select
                    name="category"
                    defaultValue={editingCourse ? normalizeCourseCategory(editingCourse.category) : 'Biotechnology'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  >
                    {COURSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Delivery Mode *</label>
                  <select
                    name="deliveryMode"
                    defaultValue={editingCourse ? normalizeDeliveryMode(editingCourse.deliveryMode) : 'Online (Self-Paced)'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  >
                    {COURSE_DELIVERY_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
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
              </div>

              {/* Duration, Fees & Registration Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Duration *</label>
                  <input
                    type="text"
                    name="duration"
                    required
                    defaultValue={editingCourse?.duration || '8 Weeks'}
                    placeholder="e.g. 8 Weeks / Self-Paced"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Fees (if applicable)</label>
                  <input
                    type="text"
                    name="fees"
                    defaultValue={editingCourse?.fees || editingCourse?.price || 'Free enrollment'}
                    placeholder="e.g. Free / Program Fee applies"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Registration Deadline</label>
                  <input
                    type="text"
                    name="registrationDeadline"
                    defaultValue={editingCourse?.registrationDeadline || 'Open / Rolling'}
                    placeholder="YYYY-MM-DD or Open / Rolling"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Eligibility & Official Registration Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Eligibility *</label>
                  <input
                    type="text"
                    name="eligibility"
                    required
                    defaultValue={editingCourse?.eligibility || 'B.Sc / M.Sc / B.Tech Biotechnology & Life Sciences Students'}
                    placeholder="e.g. B.Sc / M.Sc / Ph.D in Life Sciences"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Official Registration Link *
                    </label>
                    {isValidCourseRegistrationUrl(courseRegUrlDraft) && (
                      <a
                        href={courseRegUrlDraft.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline"
                      >
                        <span>Test URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    name="registrationUrl"
                    required
                    value={courseRegUrlDraft}
                    onChange={(e) => setCourseRegUrlDraft(e.target.value)}
                    placeholder="https://onlinecourses.nptel.ac.in/"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Course Description *</label>
                <textarea
                  rows={3}
                  name="description"
                  required
                  defaultValue={editingCourse?.description}
                  placeholder="Describe what learners will study and practical competencies covered..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Curriculum Modules */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Curriculum (One module or topic per line)
                </label>
                <textarea
                  rows={4}
                  name="curriculum"
                  defaultValue={(editingCourse?.curriculum || editingCourse?.syllabus || []).join('\n')}
                  placeholder="Module 1: Core Theoretical Foundations&#10;Module 2: Experimental & Quantitative Analysis&#10;Module 3: Applied Case Studies"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Certificate Information (Strictly optional, no invented claims) */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Certificate Information (Optional — only enter verified provider details)
                </label>
                <input
                  type="text"
                  name="certificateInfo"
                  defaultValue={editingCourse?.certificateInfo || ''}
                  placeholder="Leave blank if not offered; do not invent accreditations or affiliations"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Status & Feature on Homepage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Availability Status *</label>
                  <select
                    name="status"
                    defaultValue={editingCourse ? normalizeCourseStatus(editingCourse.status, editingCourse.availability) : 'available'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  >
                    <option value="available">Available (Open for Registration)</option>
                    <option value="closed">Closed (Registration Closed)</option>
                  </select>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Feature on Homepage</div>
                      <div className="text-[10px] text-slate-500">Show in Section 05 Courses</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={editingCourse?.featured || false}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCourseModalOpen(false);
                    setEditingCourse(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingCourse ? 'Save Course Changes' : 'Add Course'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT INTERNSHIP MODAL                               */}
      {/* ========================================================= */}
      {isInternshipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingInternship ? `Edit Internship: ${editingInternship.title}` : 'Add Biotechnology Internship'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsInternshipModalOpen(false);
                  setEditingInternship(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInternship} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Program Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={editingInternship?.title}
                    placeholder="e.g. Summer Research Fellowship in Structural Biology"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Host Organization / Institute *</label>
                  <input
                    type="text"
                    name="organization"
                    required
                    defaultValue={editingInternship?.organization}
                    placeholder="e.g. NCBS-TIFR / Biocon Academy"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    name="category"
                    defaultValue={editingInternship?.category || 'Summer Fellowship'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Summer Fellowship">Summer Fellowship</option>
                    <option value="Industrial R&D">Industrial R&amp;D</option>
                    <option value="Academic Dissertation">Academic Dissertation</option>
                    <option value="Clinical Research">Clinical Research</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Work Mode</label>
                  <select
                    name="workMode"
                    defaultValue={editingInternship?.workMode || 'On-site Lab'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="On-site Lab">On-site Lab</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote / Dry Lab">Remote / Dry Lab</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editingInternship?.location || 'Bengaluru, Karnataka'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Stipend</label>
                  <input
                    type="text"
                    name="stipend"
                    defaultValue={editingInternship?.stipend || '₹15,000 / month'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Duration</label>
                  <input
                    type="text"
                    name="duration"
                    defaultValue={editingInternship?.duration || '8 Weeks'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Deadline</label>
                  <input
                    type="date"
                    name="deadline"
                    defaultValue={editingInternship?.deadline || '2026-12-20'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Official Application URL *</label>
                  <input
                    type="url"
                    name="applicationUrl"
                    required
                    defaultValue={editingInternship?.applicationUrl}
                    placeholder="https://institute.res.in/fellowship"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Eligibility</label>
                  <input
                    type="text"
                    name="eligibility"
                    defaultValue={editingInternship?.eligibility || 'B.Sc / M.Sc / B.Tech in Life Sciences'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Source Name</label>
                  <input
                    type="text"
                    name="sourceName"
                    defaultValue={editingInternship?.sourceName || 'Verified Academic Portal'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Verification Status</label>
                  <select
                    name="verificationStatus"
                    defaultValue={editingInternship?.verificationStatus || 'Verified'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Program Description *</label>
                <textarea
                  rows={2}
                  name="description"
                  required
                  defaultValue={editingInternship?.description}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Learning Outcomes (one per line)</label>
                  <textarea
                    rows={2}
                    name="learningOutcomes"
                    defaultValue={editingInternship?.learningOutcomes?.join('\n')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Skills Required (comma-separated)</label>
                  <textarea
                    rows={2}
                    name="skillsRequired"
                    defaultValue={editingInternship?.skillsRequired?.join(', ')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" name="featured" defaultChecked={editingInternship?.featured} className="rounded text-[#0B2A5B]" />
                  <span>Feature Internship</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInternshipModalOpen(false);
                      setEditingInternship(null);
                    }}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingInternship ? 'Save Internship' : 'Create Internship'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERNSHIP VERIFICATION MODAL                             */}
      {/* ========================================================= */}
      {isInternshipVerificationModalOpen && verifyingInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Verify Internship: {verifyingInternship.title}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsInternshipVerificationModalOpen(false);
                  setVerifyingInternship(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const status = String(formData.get('verificationStatus') || 'Verified');
                const notes = String(formData.get('verificationNotes') || '');
                const dateVal = String(formData.get('lastVerificationDate') || new Date().toISOString().split('T')[0]);
                try {
                  const updated = await adminApi.verifyInternship(verifyingInternship.id, status, notes, dateVal);
                  setInternships(internships.map((i) => (i.id === verifyingInternship.id ? updated : i)));
                  addToast(`Internship "${verifyingInternship.title}" marked as ${status}.`, 'success');
                  setIsInternshipVerificationModalOpen(false);
                  setVerifyingInternship(null);
                  await loadDashboardData(true);
                } catch (err: any) {
                  addToast(err.message || 'Failed to verify internship.', 'error');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Verification Status *</label>
                <select
                  name="verificationStatus"
                  defaultValue={verifyingInternship.verificationStatus || 'Verified'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="Verified">Verified</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Verification Date *</label>
                <input
                  type="date"
                  name="lastVerificationDate"
                  required
                  defaultValue={verifyingInternship.lastVerificationDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Audit Notes</label>
                <textarea
                  rows={2}
                  name="verificationNotes"
                  defaultValue={verifyingInternship.verificationNotes || 'Confirmed official fellowship portal link.'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInternshipVerificationModalOpen(false);
                    setVerifyingInternship(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] text-white font-bold rounded-xl cursor-pointer"
                >
                  Save Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT SUBMITTED OPPORTUNITY MODAL                          */}
      {/* ========================================================= */}
      {isSubmissionEditModalOpen && editingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Submitted Opportunity
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsSubmissionEditModalOpen(false);
                  setEditingSubmission(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedSubmission} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={editingSubmission.title}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Organization *</label>
                  <input
                    type="text"
                    name="organization"
                    required
                    defaultValue={editingSubmission.organization}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Type</label>
                  <input
                    type="text"
                    name="type"
                    defaultValue={editingSubmission.type}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editingSubmission.location}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Moderation Status</label>
                  <select
                    name="status"
                    defaultValue={editingSubmission.status || 'Pending Verification'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Active">Approved / Active</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Work Mode</label>
                  <input
                    type="text"
                    name="workMode"
                    defaultValue={editingSubmission.workMode}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Deadline</label>
                  <input
                    type="text"
                    name="deadline"
                    defaultValue={editingSubmission.deadline}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Application URL *</label>
                <input
                  type="url"
                  name="applicationUrl"
                  required
                  defaultValue={editingSubmission.applicationUrl}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={3}
                  name="description"
                  defaultValue={editingSubmission.description}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Skills (comma-separated)</label>
                <input
                  type="text"
                  name="skills"
                  defaultValue={(editingSubmission.skills || []).join(', ')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmissionEditModalOpen(false);
                    setEditingSubmission(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#0B2A5B] text-white font-bold rounded-xl cursor-pointer">
                  Save Submission
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
