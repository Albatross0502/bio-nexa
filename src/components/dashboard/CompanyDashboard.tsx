import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  companyApi,
  CompanyAuditLogEntry,
  CompanyJobRecord,
  CompanySessionSummary,
  ApplicationDestinationType,
} from '../../services/company/companyApiClient';
import { CompanyAuthPage } from '../company/CompanyAuthPage';
import {
  Building2,
  PlusCircle,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  Trash2,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Edit3,
  ExternalLink,
  Mail,
  Lock,
  LogOut,
  History,
  Globe,
  RefreshCw,
  XCircle,
  Check,
  Laptop,
  Send,
} from 'lucide-react';

const ORGANIZATION_TYPES = [
  'Private Biopharma',
  'Biotech Startup',
  'Academic / Research Institute',
  'Government / Autonomous',
  'Diagnostics & CRO',
  'Agritech / Industrial Biotech',
  'Non-Profit / Foundation',
];

type DashboardTab = 'my-jobs' | 'post-job' | 'organization' | 'security' | 'applicants';

export const CompanyDashboard: React.FC = () => {
  const {
    companyUser,
    isCompanyAuthenticated,
    companyAuthLoading,
    setCompanySessionUser,
    refreshCompanySession,
    logoutCompany,
    applications,
    updateApplicationStatus,
    navigate,
    addToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<DashboardTab>('my-jobs');

  // Jobs state (real DB-backed company jobs)
  const [companyJobs, setCompanyJobs] = useState<CompanyJobRecord[]>([]);
  const [jobSummary, setJobSummary] = useState({
    total: 0,
    published: 0,
    pendingReview: 0,
    rejected: 0,
    expired: 0,
    closed: 0,
  });
  const [jobsLoading, setJobsLoading] = useState(false);

  // Email verification banner state
  const [devVerifyToken, setDevVerifyToken] = useState<string>('');
  const [manualVerifyToken, setManualVerifyToken] = useState<string>('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  // Post / Edit Job Form State
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Full-time');
  const [sector, setSector] = useState('Private Biopharma');
  const [experienceLevel, setExperienceLevel] = useState('Mid-level (2-5 yrs)');
  const [qualification, setQualification] = useState('M.Sc / M.Tech');
  const [salary, setSalary] = useState('');
  const [deadline, setDeadline] = useState('2026-12-30');
  const [description, setDescription] = useState('');
  const [responsibilitiesText, setResponsibilitiesText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [applicationDestinationType, setApplicationDestinationType] =
    useState<ApplicationDestinationType>('external_url');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [applicationEmail, setApplicationEmail] = useState('');
  const [applicationInstructions, setApplicationInstructions] = useState('');
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [jobFormError, setJobFormError] = useState<string | null>(null);

  // Organization Profile State
  const [orgContactName, setOrgContactName] = useState('');
  const [orgContactTitle, setOrgContactTitle] = useState('');
  const [orgContactPhone, setOrgContactPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('Private Biopharma');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgHq, setOrgHq] = useState('');
  const [orgSize, setOrgSize] = useState('');
  const [orgFoundedYear, setOrgFoundedYear] = useState('');
  const [orgIndustryFocus, setOrgIndustryFocus] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgRegId, setOrgRegId] = useState('');
  const [orgLinkedin, setOrgLinkedin] = useState('');
  const [defaultDestType, setDefaultDestType] =
    useState<ApplicationDestinationType>('external_url');
  const [defaultAppUrl, setDefaultAppUrl] = useState('');
  const [defaultAppEmail, setDefaultAppEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Employer Verification Workflow State
  const [verWebsite, setVerWebsite] = useState('');
  const [verRegId, setVerRegId] = useState('');
  const [verEvidenceUrl, setVerEvidenceUrl] = useState('');
  const [verNotes, setVerNotes] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  // Security, Sessions & Audit Logs State
  const [sessions, setSessions] = useState<CompanySessionSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<CompanyAuditLogEntry[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync form defaults & dev verify token whenever companyUser changes
  useEffect(() => {
    if (!companyUser) return;
    setOrgContactName(companyUser.contactName || '');
    setOrgContactTitle(companyUser.contactTitle || '');
    setOrgContactPhone(companyUser.contactPhone || '');
    setOrgName(companyUser.organizationName || '');
    setOrgType(companyUser.organizationType || 'Private Biopharma');
    setOrgWebsite(companyUser.officialWebsite || '');
    setOrgHq(companyUser.headquartersLocation || '');
    setOrgSize(companyUser.organizationSize || '');
    setOrgFoundedYear(companyUser.foundedYear || '');
    setOrgIndustryFocus(companyUser.industryFocus || '');
    setOrgDescription(companyUser.description || '');
    setOrgRegId(companyUser.registrationIdentifier || '');
    setOrgLinkedin(companyUser.linkedinUrl || '');
    setDefaultDestType(companyUser.defaultApplicationDestinationType || 'external_url');
    setDefaultAppUrl(companyUser.defaultApplicationUrl || companyUser.officialWebsite || '');
    setDefaultAppEmail(companyUser.defaultApplicationEmail || companyUser.email || '');

    setVerWebsite(companyUser.officialWebsite || '');
    setVerRegId(companyUser.registrationIdentifier || '');
    setVerEvidenceUrl(companyUser.verificationEvidenceUrl || '');
    setVerNotes(companyUser.verificationNotes || '');

    if (!editingJobId) {
      setLocation((prev) => prev || companyUser.headquartersLocation || '');
      setApplicationDestinationType(companyUser.defaultApplicationDestinationType || 'external_url');
      setApplicationUrl((prev) => prev || companyUser.defaultApplicationUrl || companyUser.officialWebsite || '');
      setApplicationEmail((prev) => prev || companyUser.defaultApplicationEmail || companyUser.email || '');
    }

    try {
      const storedToken = sessionStorage.getItem('bionexa_dev_company_verify_token') || '';
      if (storedToken && !companyUser.emailVerified) {
        setDevVerifyToken(storedToken);
        setManualVerifyToken(storedToken);
      } else if (companyUser.emailVerified) {
        setDevVerifyToken('');
        sessionStorage.removeItem('bionexa_dev_company_verify_token');
      }
    } catch {
      // ignore storage restrictions
    }
  }, [companyUser]);

  const loadCompanyJobs = async () => {
    if (!isCompanyAuthenticated) return;
    setJobsLoading(true);
    try {
      const res = await companyApi.listJobs();
      setCompanyJobs(res.jobs || []);
      if (res.summary) setJobSummary(res.summary);
    } catch (err: any) {
      addToast(err?.message || 'Unable to load organization openings.', 'error');
    } finally {
      setJobsLoading(false);
    }
  };

  const loadSecurityAndAudit = async () => {
    if (!isCompanyAuthenticated) return;
    setSecurityLoading(true);
    try {
      const [sessRes, auditRes] = await Promise.all([
        companyApi.listSessions(),
        companyApi.getAuditLogs(),
      ]);
      setSessions(sessRes.sessions || []);
      setAuditLogs(auditRes.logs || []);
    } catch (err: any) {
      addToast(err?.message || 'Unable to load sessions and audit logs.', 'error');
    } finally {
      setSecurityLoading(false);
    }
  };

  useEffect(() => {
    if (isCompanyAuthenticated) {
      loadCompanyJobs();
    }
  }, [isCompanyAuthenticated]);

  useEffect(() => {
    if (isCompanyAuthenticated && activeTab === 'security') {
      loadSecurityAndAudit();
    }
  }, [isCompanyAuthenticated, activeTab]);

  const scopedApplications = useMemo(() => {
    if (!companyUser) return [];
    const ownJobIds = new Set(companyJobs.map((j) => j.id));
    const orgLower = companyUser.organizationName.trim().toLowerCase();
    return applications.filter(
      (app) =>
        (app.jobId && ownJobIds.has(app.jobId)) ||
        (orgLower && app.company.trim().toLowerCase() === orgLower)
    );
  }, [applications, companyJobs, companyUser]);

  if (companyAuthLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-500 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#0B2A5B]" />
        <span>Loading employer workspace...</span>
      </div>
    );
  }

  if (!isCompanyAuthenticated || !companyUser) {
    return <CompanyAuthPage initialMode="login" embeddedInDashboard />;
  }

  const handleVerifyEmailNow = async (tokenOverride?: string) => {
    const tokenToUse = (tokenOverride || manualVerifyToken || devVerifyToken).trim();
    if (!tokenToUse) {
      addToast('Please paste your email verification token or request a new one.', 'warning');
      return;
    }
    setIsVerifyingEmail(true);
    try {
      const res = await companyApi.verifyEmail(tokenToUse);
      setCompanySessionUser(res.company);
      setDevVerifyToken('');
      setManualVerifyToken('');
      try {
        sessionStorage.removeItem('bionexa_dev_company_verify_token');
      } catch {
        // ignore
      }
      addToast(res.message || 'Work email verified!', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Email verification failed.', 'error');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleResendVerification = async () => {
    setIsVerifyingEmail(true);
    try {
      const res = await companyApi.resendVerification();
      if (res.devVerificationToken) {
        setDevVerifyToken(res.devVerificationToken);
        setManualVerifyToken(res.devVerificationToken);
        try {
          sessionStorage.setItem('bionexa_dev_company_verify_token', res.devVerificationToken);
        } catch {
          // ignore
        }
      }
      addToast(res.message || 'Fresh verification token issued.', 'info');
    } catch (err: any) {
      addToast(err?.message || 'Unable to resend verification token.', 'error');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const resetJobForm = () => {
    setEditingJobId(null);
    setTitle('');
    setLocation(companyUser.headquartersLocation || '');
    setType('Full-time');
    setSector(companyUser.organizationType || 'Private Biopharma');
    setExperienceLevel('Mid-level (2-5 yrs)');
    setQualification('M.Sc / M.Tech');
    setSalary('');
    setDeadline('2026-12-30');
    setDescription('');
    setResponsibilitiesText('');
    setRequirementsText('');
    setSkillsText('');
    setApplicationDestinationType(companyUser.defaultApplicationDestinationType || 'external_url');
    setApplicationUrl(companyUser.defaultApplicationUrl || companyUser.officialWebsite || '');
    setApplicationEmail(companyUser.defaultApplicationEmail || companyUser.email || '');
    setApplicationInstructions('');
    setJobFormError(null);
  };

  const startEditJob = (job: CompanyJobRecord) => {
    setEditingJobId(job.id);
    setTitle(job.title);
    setLocation(job.location);
    setType(job.type || 'Full-time');
    setSector(job.sector || 'Private Biopharma');
    setExperienceLevel(job.experienceLevel || 'Mid-level (2-5 yrs)');
    setQualification(job.qualification || 'M.Sc / M.Tech');
    setSalary(job.salary || '');
    setDeadline(job.deadline || '2026-12-30');
    setDescription(job.description || '');
    setResponsibilitiesText((job.responsibilities || []).join('\n'));
    setRequirementsText((job.requirements || []).join('\n'));
    setSkillsText((job.skills || []).join(', '));
    setApplicationDestinationType(job.applicationDestinationType || 'external_url');
    setApplicationUrl(job.applicationDestinationType === 'external_url' ? job.applicationUrl || '' : '');
    setApplicationEmail(job.applicationEmail || '');
    setApplicationInstructions(job.applicationInstructions || '');
    setJobFormError(null);
    setActiveTab('post-job');
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobFormError(null);

    if (!companyUser.emailVerified) {
      setJobFormError('Please verify your organization work email before submitting or editing job openings.');
      return;
    }

    setIsSubmittingJob(true);
    try {
      const payload = {
        title: title.trim(),
        location: location.trim(),
        type,
        sector,
        experienceLevel,
        qualification,
        salary: salary.trim(),
        deadline,
        description: description.trim(),
        responsibilities: responsibilitiesText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        requirements: requirementsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        skills: skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        applicationDestinationType,
        applicationUrl: applicationDestinationType === 'external_url' ? applicationUrl.trim() : '',
        applicationEmail: applicationDestinationType === 'email' ? applicationEmail.trim() : '',
        applicationInstructions: applicationInstructions.trim(),
      };

      if (editingJobId) {
        const res = await companyApi.updateJob(editingJobId, payload);
        addToast(res.message || 'Job opening updated.', 'success');
      } else {
        const res = await companyApi.submitJob(payload);
        addToast(res.message || 'Job opening submitted.', res.publishedAsVerified ? 'success' : 'info');
      }

      resetJobForm();
      await loadCompanyJobs();
      setActiveTab('my-jobs');
    } catch (err: any) {
      setJobFormError(err?.message || 'Unable to save job opening.');
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleToggleJobStatus = async (job: CompanyJobRecord) => {
    const action = job.status === 'Closed' ? 'reopen' : 'close';
    try {
      const res = await companyApi.updateJobStatus(job.id, action);
      addToast(res.message, 'info');
      await loadCompanyJobs();
    } catch (err: any) {
      addToast(err?.message || 'Unable to update job status.', 'error');
    }
  };

  const handleDeleteJob = async (job: CompanyJobRecord) => {
    try {
      const res = await companyApi.deleteJob(job.id);
      addToast(res.message || 'Opening deleted.', 'info');
      await loadCompanyJobs();
    } catch (err: any) {
      addToast(err?.message || 'Unable to delete opening.', 'error');
    }
  };

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await companyApi.updateProfile({
        contactName: orgContactName.trim(),
        contactTitle: orgContactTitle.trim(),
        contactPhone: orgContactPhone.trim(),
        organizationName: orgName.trim(),
        organizationType: orgType,
        officialWebsite: orgWebsite.trim(),
        headquartersLocation: orgHq.trim(),
        organizationSize: orgSize.trim(),
        foundedYear: orgFoundedYear.trim(),
        industryFocus: orgIndustryFocus.trim(),
        description: orgDescription.trim(),
        registrationIdentifier: orgRegId.trim(),
        linkedinUrl: orgLinkedin.trim(),
        defaultApplicationDestinationType: defaultDestType,
        defaultApplicationUrl: defaultAppUrl.trim(),
        defaultApplicationEmail: defaultAppEmail.trim(),
      });
      setCompanySessionUser(res.company);
      addToast(res.message || 'Organization profile saved.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Unable to update organization profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVerification(true);
    try {
      const res = await companyApi.submitVerification({
        officialWebsite: verWebsite.trim(),
        registrationIdentifier: verRegId.trim(),
        verificationEvidenceUrl: verEvidenceUrl.trim(),
        verificationNotes: verNotes.trim(),
      });
      setCompanySessionUser(res.company);
      addToast(res.message || 'Employer verification submitted for review.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Unable to submit verification request.', 'error');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      addToast('New password confirmation does not match.', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await companyApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      addToast(res.message || 'Password updated.', 'success');
      await loadSecurityAndAudit();
    } catch (err: any) {
      addToast(err?.message || 'Unable to change password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (jti: string, isCurrent: boolean) => {
    try {
      await companyApi.revokeSession(jti);
      addToast('Session revoked.', 'info');
      if (isCurrent) {
        setCompanySessionUser(null);
        navigate('/company/login');
      } else {
        await loadSecurityAndAudit();
      }
    } catch (err: any) {
      addToast(err?.message || 'Unable to revoke session.', 'error');
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const res = await companyApi.revokeOtherSessions();
      addToast(res.message, 'info');
      await loadSecurityAndAudit();
    } catch (err: any) {
      addToast(err?.message || 'Unable to sign out other devices.', 'error');
    }
  };

  const renderVerificationBadge = () => {
    if (companyUser.verificationStatus === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3 h-3" /> Verified Employer
        </span>
      );
    }
    if (companyUser.verificationStatus === 'pending_review') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
          <Clock className="w-3 h-3" /> Verification Under Review
        </span>
      );
    }
    if (companyUser.verificationStatus === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
          <ShieldAlert className="w-3 h-3" /> Verification Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-3 h-3" /> Unverified Employer
      </span>
    );
  };

  const renderJobStatusBadge = (status: string) => {
    if (status === 'Published') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" /> Published
        </span>
      );
    }
    if (status === 'Pending Review') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
          <Clock className="w-3 h-3" /> Pending Review
        </span>
      );
    }
    if (status === 'Rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      );
    }
    if (status === 'Expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Closed
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Card (Preserving Existing CompanyDashboard Design Language) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {companyUser.organizationName}
              </h1>
              {renderVerificationBadge()}
              {companyUser.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                  <CheckCircle2 className="w-3 h-3" /> Email Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  <Mail className="w-3 h-3" /> Email Unverified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {companyUser.organizationType} · {companyUser.headquartersLocation} · Signed in as{' '}
              <strong>{companyUser.contactName}</strong> ({companyUser.email})
            </p>
            {companyUser.officialWebsite && (
              <a
                href={companyUser.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{companyUser.officialWebsite}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6 text-center text-xs">
          <div>
            <div className="text-xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300">
              {jobSummary.total}
            </div>
            <div className="text-slate-500 mt-0.5">Total Listings</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600">
              {jobSummary.published}
            </div>
            <div className="text-slate-500 mt-0.5">Published</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-600">
              {jobSummary.pendingReview}
            </div>
            <div className="text-slate-500 mt-0.5">Pending Review</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logoutCompany();
              navigate('/company/login');
            }}
            className="ml-auto lg:ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Email Verification Action Banner */}
      {!companyUser.emailVerified && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900 dark:text-amber-200">
                  Verify Your Organization Work Email ({companyUser.email})
                </div>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                  Work email verification is required before you can submit job openings or request Verified Employer status.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {devVerifyToken && (
                <button
                  type="button"
                  disabled={isVerifyingEmail}
                  onClick={() => handleVerifyEmailNow(devVerifyToken)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold cursor-pointer"
                >
                  {isVerifyingEmail ? 'Verifying...' : 'Verify Email Now'}
                </button>
              )}
              <button
                type="button"
                disabled={isVerifyingEmail}
                onClick={handleResendVerification}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100/60 cursor-pointer"
              >
                Resend Verification Token
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualVerifyToken}
              onChange={(e) => setManualVerifyToken(e.target.value)}
              placeholder="Paste verification token..."
              className="flex-1 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
            />
            <button
              type="button"
              disabled={isVerifyingEmail || !manualVerifyToken.trim()}
              onClick={() => handleVerifyEmailNow()}
              className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold cursor-pointer"
            >
              Confirm Token
            </button>
          </div>
        </div>
      )}

      {/* Unverified Employer Notice */}
      {companyUser.emailVerified && companyUser.verificationStatus !== 'verified' && (
        <div className="p-4 rounded-2xl bg-sky-50/90 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {companyUser.verificationStatus === 'pending_review'
                  ? 'Employer Identity Verification Under Administrator Review'
                  : companyUser.verificationStatus === 'rejected'
                  ? 'Employer Verification Requires Updated Evidence'
                  : 'Complete Employer Identity Verification to Publish Verified Listings'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                {companyUser.verificationStatus === 'pending_review'
                  ? 'Your organization dossier has been submitted. Until administrator approval is granted, new job submissions remain in Pending Review.'
                  : companyUser.verificationStatus === 'rejected' && companyUser.rejectionReason
                  ? `Administrator feedback: ${companyUser.rejectionReason}`
                  : 'Registered employers are not automatically verified. Submit your organization registry ID or official careers URL for administrator approval.'}
              </p>
            </div>
          </div>
          {companyUser.verificationStatus !== 'pending_review' && (
            <button
              type="button"
              onClick={() => setActiveTab('organization')}
              className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold shrink-0 cursor-pointer"
            >
              Submit Verification &rarr;
            </button>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {(
          [
            ['my-jobs', `Manage Posted Openings (${companyJobs.length})`, Briefcase],
            ['post-job', editingJobId ? 'Edit Job Opening' : 'Post New Job', PlusCircle],
            ['organization', 'Organization Profile & Verification', Building2],
            ['security', 'Security, Sessions & Audit Logs', Lock],
            ['applicants', `Received Applications (${scopedApplications.length})`, Users],
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => {
              if (tabKey !== 'post-job' && editingJobId) {
                resetJobForm();
              }
              setActiveTab(tabKey);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === tabKey
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MANAGE POSTED OPENINGS */}
      {activeTab === 'my-jobs' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Organization Openings &amp; Job Status Tracking
              </h2>
              <p className="text-slate-500">
                Track verification status, application destinations, and lifecycle for every opening submitted under {companyUser.organizationName}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadCompanyJobs}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${jobsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetJobForm();
                  setActiveTab('post-job');
                }}
                className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Post New Job</span>
              </button>
            </div>
          </div>

          {jobsLoading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              Loading your submitted openings...
            </div>
          ) : companyJobs.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                No job openings submitted yet
              </div>
              <p className="text-slate-500 max-w-md mx-auto">
                Submit your first biotechnology or life sciences opening with your preferred application destination (Official Careers URL, Direct Recruiter Email, or BIO-INEXA Portal).
              </p>
              <button
                type="button"
                onClick={() => {
                  resetJobForm();
                  setActiveTab('post-job');
                }}
                className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold cursor-pointer"
              >
                Create First Job Opening
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderJobStatusBadge(job.status)}
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {job.verificationStatus}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {job.title}
                      </h3>
                      <div className="text-slate-500 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {job.location}
                        </span>
                        <span>·</span>
                        <span>{job.type}</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                          {job.salary}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Application Destination Summary */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                    <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Send className="w-3 h-3 text-teal-600" />
                      <span>
                        Application Destination:{' '}
                        {job.applicationDestinationType === 'external_url'
                          ? 'External Careers URL'
                          : job.applicationDestinationType === 'email'
                          ? 'Direct Recruiter Email'
                          : 'BIO-INEXA Application Portal'}
                      </span>
                    </div>
                    {job.applicationDestinationType === 'external_url' && job.applicationUrl && (
                      <div className="text-slate-500 truncate">{job.applicationUrl}</div>
                    )}
                    {job.applicationDestinationType === 'email' && job.applicationEmail && (
                      <div className="text-slate-500">{job.applicationEmail}</div>
                    )}
                    {job.applicationInstructions && (
                      <div className="text-slate-500 italic">{job.applicationInstructions}</div>
                    )}
                  </div>

                  {job.verificationNotes && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Note: {job.verificationNotes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Deadline: {job.deadline}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditJob(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleJobStatus(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        {job.status === 'Closed' ? 'Reopen' : 'Close'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(job)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Delete Job"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POST / EDIT JOB + APPLICATION DESTINATION MANAGEMENT */}
      {activeTab === 'post-job' && (
        <div className="max-w-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingJobId ? 'Edit Job Opening' : 'Submit Authorized Biotechnology Opening'}
              </h2>
              <p className="text-slate-500 mt-0.5">
                {companyUser.canPublishAsVerified
                  ? 'Your organization is a Verified Employer. Submitted openings publish directly as Verified listings.'
                  : 'Your organization is currently Unverified. Submitted openings enter Pending Review and cannot be published as Verified until administrator verification is approved.'}
              </p>
            </div>
            {editingJobId && (
              <button
                type="button"
                onClick={() => {
                  resetJobForm();
                  setActiveTab('my-jobs');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {!companyUser.emailVerified && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium">
              Work email verification is required before submitting or editing job openings. Complete email verification using the banner above.
            </div>
          )}

          {jobFormError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold"
            >
              {jobFormError}
            </div>
          )}

          <form onSubmit={handleSaveJob} className="space-y-4">
            <div>
              <label htmlFor="company-job-title" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                id="company-job-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Senior Genomics Scientist - Clinical Sequencing"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="company-job-type" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employment Type
                </label>
                <select
                  id="company-job-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Project Contract</option>
                  <option value="Project-based">Project-based</option>
                  <option value="Fellowship">Research Fellowship</option>
                </select>
              </div>

              <div>
                <label htmlFor="company-job-sector" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sector Classification
                </label>
                <select
                  id="company-job-sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {ORGANIZATION_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="company-job-exp" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Experience Level
                </label>
                <select
                  id="company-job-exp"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Fresher (0-1 yr)">Fresher (0-1 yr)</option>
                  <option value="Mid-level (2-5 yrs)">Mid-level (2-5 yrs)</option>
                  <option value="Senior (5+ yrs)">Senior (5+ yrs)</option>
                </select>
              </div>

              <div>
                <label htmlFor="company-job-qual" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Required Qualification
                </label>
                <select
                  id="company-job-qual"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="B.Sc / B.Tech">B.Sc / B.Tech</option>
                  <option value="M.Sc / M.Tech">M.Sc / M.Tech</option>
                  <option value="Ph.D / Postdoc">Ph.D / Postdoc</option>
                </select>
              </div>

              <div>
                <label htmlFor="company-job-salary" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Compensation / Stipend
                </label>
                <input
                  id="company-job-salary"
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g., ₹10,00,000 - ₹14,00,000 / yr"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="company-job-location" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work Location *
                </label>
                <input
                  id="company-job-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Bengaluru, Karnataka"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="company-job-deadline" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Deadline *
                </label>
                <input
                  id="company-job-deadline"
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Application Destination Management Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-teal-600" />
                <span>Application Destination Management</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    ['external_url', 'External Careers URL'],
                    ['email', 'Direct Recruiter Email'],
                    ['bionexa_portal', 'BIO-INEXA Portal'],
                  ] as const
                ).map(([destKey, destLabel]) => (
                  <button
                    key={destKey}
                    type="button"
                    onClick={() => setApplicationDestinationType(destKey)}
                    className={`py-2 px-3 rounded-xl font-bold border text-center cursor-pointer transition-all ${
                      applicationDestinationType === destKey
                        ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {destLabel}
                  </button>
                ))}
              </div>

              {applicationDestinationType === 'external_url' && (
                <div>
                  <label htmlFor="company-job-appurl" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Careers / Application URL *
                  </label>
                  <input
                    id="company-job-appurl"
                    type="url"
                    required
                    value={applicationUrl}
                    onChange={(e) => setApplicationUrl(e.target.value)}
                    placeholder="https://organization.in/careers/role-id"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {applicationDestinationType === 'email' && (
                <div>
                  <label htmlFor="company-job-appemail" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recruiter Application Email *
                  </label>
                  <input
                    id="company-job-appemail"
                    type="email"
                    required
                    value={applicationEmail}
                    onChange={(e) => setApplicationEmail(e.target.value)}
                    placeholder="careers@organization.in"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <label htmlFor="company-job-instructions" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Instructions (Optional)
                </label>
                <input
                  id="company-job-instructions"
                  type="text"
                  value={applicationInstructions}
                  onChange={(e) => setApplicationInstructions(e.target.value)}
                  placeholder="e.g., Include publication list and reference code GEN-2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company-job-desc" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Description * (min 25 chars)
              </label>
              <textarea
                id="company-job-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the research laboratory, clinical or bioprocess goals, and team context..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="company-job-resp" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsibilities (One per line)
                </label>
                <textarea
                  id="company-job-resp"
                  rows={3}
                  value={responsibilitiesText}
                  onChange={(e) => setResponsibilitiesText(e.target.value)}
                  placeholder="Design NGS library prep assays&#10;Maintain ISO 15189 lab QA logs"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="company-job-req" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requirements (One per line)
                </label>
                <textarea
                  id="company-job-req"
                  rows={3}
                  value={requirementsText}
                  onChange={(e) => setRequirementsText(e.target.value)}
                  placeholder="M.Sc / Ph.D in Molecular Biology&#10;2+ years Illumina NGS workflow experience"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company-job-skills" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Required Laboratory / Technical Skills (Comma-separated)
              </label>
              <input
                id="company-job-skills"
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g., NGS, Bioinformatics, PCR, cGMP"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              {editingJobId && (
                <button
                  type="button"
                  onClick={() => {
                    resetJobForm();
                    setActiveTab('my-jobs');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmittingJob || !companyUser.emailVerified}
                className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                {isSubmittingJob
                  ? 'Saving...'
                  : editingJobId
                  ? 'Save Job Changes'
                  : companyUser.canPublishAsVerified
                  ? 'Publish Verified Opening'
                  : 'Submit Opening for Review'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ORGANIZATION PROFILE & EMPLOYER VERIFICATION WORKFLOW */}
      {activeTab === 'organization' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          {/* Organization Information & Default Destination Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Organization Information &amp; Company Profile
              </h2>
              <p className="text-slate-500 mt-0.5">
                Maintain accurate institutional details, hiring contact metadata, and default application destination preferences.
              </p>
            </div>

            <form onSubmit={handleSaveOrgProfile} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Organization Type
                  </label>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {ORGANIZATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Website *
                  </label>
                  <input
                    type="url"
                    required
                    value={orgWebsite}
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Headquarters Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={orgHq}
                    onChange={(e) => setOrgHq(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Representative Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={orgContactName}
                    onChange={(e) => setOrgContactName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={orgContactTitle}
                    onChange={(e) => setOrgContactTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={orgContactPhone}
                    onChange={(e) => setOrgContactPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Team Size
                  </label>
                  <input
                    type="text"
                    value={orgSize}
                    onChange={(e) => setOrgSize(e.target.value)}
                    placeholder="e.g., 51-200 employees"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Founded Year
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={orgFoundedYear}
                    onChange={(e) => setOrgFoundedYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g., 2019"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    CIN / GSTIN / Registry ID
                  </label>
                  <input
                    type="text"
                    value={orgRegId}
                    onChange={(e) => setOrgRegId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scientific / Industry Focus
                  </label>
                  <input
                    type="text"
                    value={orgIndustryFocus}
                    onChange={(e) => setOrgIndustryFocus(e.target.value)}
                    placeholder="e.g., Clinical Genomics, Biologics"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    LinkedIn Company Page
                  </label>
                  <input
                    type="url"
                    value={orgLinkedin}
                    onChange={(e) => setOrgLinkedin(e.target.value)}
                    placeholder="https://www.linkedin.com/company/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Organization Overview
                </label>
                <textarea
                  rows={3}
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Brief overview of your biotechnology organization, labs, and mission..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Default Application Destination
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={defaultDestType}
                    onChange={(e) => setDefaultDestType(e.target.value as ApplicationDestinationType)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="external_url">External Careers URL</option>
                    <option value="email">Direct Recruiter Email</option>
                    <option value="bionexa_portal">BIO-INEXA Portal</option>
                  </select>
                  <input
                    type="url"
                    value={defaultAppUrl}
                    onChange={(e) => setDefaultAppUrl(e.target.value)}
                    placeholder="Default careers URL"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="email"
                    value={defaultAppEmail}
                    onChange={(e) => setDefaultAppEmail(e.target.value)}
                    placeholder="Default hiring email"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSavingProfile ? 'Saving Profile...' : 'Save Organization Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Employer Identity Verification Workflow Card */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Employer Verification Workflow
              </h2>
              {renderVerificationBadge()}
            </div>

            <p className="text-slate-500 leading-relaxed">
              BIO-INEXA verifies employer identity through an administrator review process before granting Verified Employer publishing privileges.
            </p>

            {companyUser.verificationStatus === 'verified' ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-emerald-900 dark:text-emerald-200">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified BIO-INEXA Employer</span>
                </div>
                <p className="text-[11px]">
                  Approved by {companyUser.verifiedBy || 'BIO-INEXA Admin'}
                  {companyUser.verifiedAt
                    ? ` on ${new Date(companyUser.verifiedAt).toLocaleDateString()}`
                    : ''}
                  . Your organization is authorized to publish verified biotechnology opportunities.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitVerification} className="space-y-3.5">
                {companyUser.verificationStatus === 'rejected' && companyUser.rejectionReason && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px]">
                    <strong>Previous Review Feedback:</strong> {companyUser.rejectionReason}
                  </div>
                )}

                <div>
                  <label htmlFor="ver-website" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Organization Website *
                  </label>
                  <input
                    id="ver-website"
                    type="url"
                    required
                    value={verWebsite}
                    onChange={(e) => setVerWebsite(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="ver-regid" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Corporate Registration / CIN / GSTIN / AISHE ID
                  </label>
                  <input
                    id="ver-regid"
                    type="text"
                    value={verRegId}
                    onChange={(e) => setVerRegId(e.target.value)}
                    placeholder="e.g., U73100KA2022PTC159001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="ver-evidence-url" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Careers / Institutional Registry URL
                  </label>
                  <input
                    id="ver-evidence-url"
                    type="url"
                    value={verEvidenceUrl}
                    onChange={(e) => setVerEvidenceUrl(e.target.value)}
                    placeholder="https://organization.in/careers"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="ver-notes" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hiring Authority &amp; Identity Verification Notes *
                  </label>
                  <textarea
                    id="ver-notes"
                    rows={3}
                    required
                    value={verNotes}
                    onChange={(e) => setVerNotes(e.target.value)}
                    placeholder="Explain your role in the organization, hiring authority, and official domain verification details..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingVerification || !companyUser.emailVerified}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSubmittingVerification
                    ? 'Submitting Dossier...'
                    : companyUser.verificationStatus === 'pending_review'
                    ? 'Update Verification Dossier'
                    : 'Submit for Employer Verification'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY, PERMISSIONS, SESSIONS & AUDIT LOGS */}
      {activeTab === 'security' && (
        <div className="space-y-6 text-xs">
          {/* Account Permissions Summary */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Company Account Permissions &amp; Role Isolation
                </h2>
                <p className="text-slate-500 mt-0.5">
                  Permissions are enforced server-side from your email verification, employer approval, and account status. Employer accounts are strictly isolated from platform administrator controls.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await refreshCompanySession();
                  await loadSecurityAndAudit();
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(companyUser.permissions || []).map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-[11px]"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  {perm}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Sessions */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-teal-600" />
                  <span>Active Employer Sessions ({sessions.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={handleRevokeOthers}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Sign Out Other Devices
                </button>
              </div>

              {sessions.length === 0 ? (
                <p className="text-slate-500">No active sessions found.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((s) => (
                    <div key={s.jti} className="py-3 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {s.userAgent || 'Browser Session'}
                          {s.isCurrent && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          IP: <span className="font-mono">{s.ipMasked}</span> · Active:{' '}
                          {new Date(s.lastActiveAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.jti, s.isCurrent)}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold shrink-0 cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rotate Password */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400" />
                <span>Change Account Password</span>
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New strong password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

          {/* Company Audit Logs Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400" />
              <span>Employer Activity &amp; Security Audit Log ({auditLogs.length})</span>
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-slate-500">No audit events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">IP (Masked)</th>
                      <th className="py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                          {log.actorType}: {log.actorEmail}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              log.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-500">{log.ipMasked}</td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: RECEIVED APPLICATIONS (SCOPED TO THIS ORGANIZATION) */}
      {activeTab === 'applicants' && (
        <div className="space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Candidate Pipeline for {companyUser.organizationName}
          </h2>

          {scopedApplications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No portal applications received for your organization openings yet.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
              {scopedApplications.map((app) => (
                <div key={app.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {app.applicantName}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-blue-600">{app.qualification}</span>
                      <span>·</span>
                      <span className="text-slate-500">{app.experienceYears}</span>
                    </div>
                    <div className="text-slate-500">
                      Applied for: <strong className="text-slate-700 dark:text-slate-300">{app.jobTitle}</strong> ({app.appliedDate})
                    </div>
                    <div className="text-slate-500">
                      Contact: {app.applicantEmail} · {app.phone}
                    </div>
                    {app.coverNote && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 mt-2 italic">
                        &ldquo;{app.coverNote}&rdquo;
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Application Status
                      </span>
                      <select
                        value={app.status}
                        onChange={(e) => updateApplicationStatus(app.id, e.target.value as any)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="Under Review">Under Review</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Interview Scheduled">Interview Scheduled</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
