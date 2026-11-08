import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  getJobByIdOrSlug, 
  getAllUnifiedJobs, 
  isApplicationLinkActionable, 
  parseApplicationDestination,
  UnifiedJob 
} from '../../services/jobs/jobService';
import { NotFoundPage } from '../pages/NotFoundPage';
import {
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Bookmark,
  Share2,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  Send,
  X,
  ShieldCheck,
  ChevronRight,
  Info,
  Compass,
  ShieldAlert,
  Link2,
  XCircle,
  ArrowUpRight,
  Lock,
  FileText,
  Globe
} from 'lucide-react';

interface JobDetailPageProps {
  jobId: string;
}

export const JobDetailPage: React.FC<JobDetailPageProps> = ({ jobId }) => {
  const { jobs, isItemSaved, toggleSaveItem, applyToJob, addReport, addToast, currentUser, navigate } = useApp();

  // Resolve job from state and seed sources
  const job = useMemo<UnifiedJob | null>(() => {
    return getJobByIdOrSlug(jobId, jobs);
  }, [jobId, jobs]);

  // Destination intelligence
  const destinationInfo = useMemo(() => {
    return job ? parseApplicationDestination(job) : null;
  }, [job]);

  // Modals state
  const [isQuickApplying, setIsQuickApplying] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [qualification, setQualification] = useState<'B.Sc / B.Tech' | 'M.Sc / M.Tech' | 'Ph.D / Postdoc'>('M.Sc / M.Tech');
  const [experienceYears, setExperienceYears] = useState('1 Year Postgrad Wet-Lab Project');
  const [coverNote, setCoverNote] = useState('');
  const [cvFileName, setCvFileName] = useState('Aarav_Gautam_Biotech_CV.pdf');

  // External Destination Safety Guard Modal
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);

  // Report Modal state
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState<
    'Demanded Application Fee / Fraudulent Recruiter' |
    'Suspicious / Unofficial Application URL' |
    'Broken / 404 Destination Link' |
    'Expired Vacancy / Deadline Passed' |
    'Incorrect Employer / Misleading Description' |
    'Other Suspicious Activity'
  >('Demanded Application Fee / Fraudulent Recruiter');
  const [reportDetails, setReportDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState(currentUser.email || '');

  // Related jobs
  const relatedJobs = useMemo(() => {
    if (!job) return [];
    return getAllUnifiedJobs(jobs)
      .filter(j => j.id !== job.id)
      .slice(0, 3);
  }, [job, jobs]);

  // If job was not found in any source -> render dedicated 404
  if (!job) {
    return (
      <NotFoundPage 
        title="Job Opening Not Found"
        message={`The job listing with identifier "${jobId}" could not be located. It may have expired, been filled, or removed by the hiring organization.`}
        requestedResource={jobId}
      />
    );
  }

  const isSaved = isItemSaved(job.id);
  const isApplyActionable = isApplicationLinkActionable(job);

  const handleShare = () => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        addToast('Direct job link copied to clipboard!', 'info');
      });
    } else {
      addToast('Job link ready: ' + url, 'info');
    }
  };

  const handleProceedToExternal = () => {
    if (!job.applicationUrl) return;
    setIsRedirectModalOpen(false);
    // Proceed to authentic external employer portal in fresh secure tab
    window.open(job.applicationUrl, '_blank', 'noopener,noreferrer');
    addToast(`Navigating to ${destinationInfo?.domain || 'external portal'}...`, 'info');
  };

  const handleQuickApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyToJob({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      applicantName,
      applicantEmail,
      phone,
      qualification,
      experienceYears,
      coverNote: coverNote || 'I am keenly interested in contributing to this bioprocess / scientific opening.',
    });
    setIsQuickApplying(false);
    setCoverNote('');
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`/api/jobs/${encodeURIComponent(job.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails,
          reportedBy: reporterEmail
        })
      });
    } catch {
      // Non-blocking fallback
    }

    // Map to AppContext reason category
    const appReason = 
      reportReason.includes('Expired') ? 'Expired' :
      reportReason.includes('Broken') ? 'Broken Link' :
      reportReason.includes('Fee') ? 'Spam' : 'Incorrect Information';

    addReport('Job', `${job.title} (${job.company}) - ${reportReason}`, appReason);
    setIsReporting(false);
    setReportDetails('');
    addToast('Report logged. BIO-NEXA Trust & Safety team will audit this vacancy within 24 hours.', 'info');
  };

  // Status Badge Rendering Helper
  const renderVerificationBadge = () => {
    switch (job.verificationStatus) {
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified Listing</span>
          </span>
        );
      case 'Pending Verification':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Pending Verification</span>
          </span>
        );
      case 'Link Unavailable':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Link Unavailable</span>
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Expired Vacancy</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
            <XCircle className="w-3.5 h-3.5" />
            <span>Listing Rejected</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb & Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <button 
              onClick={() => navigate('/')} 
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <button 
              onClick={() => navigate('/jobs')} 
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Jobs
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md">
              {job.title}
            </span>
          </nav>

          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Jobs</span>
          </button>
        </div>

        {/* Hero Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            
            {/* Title & Company info */}
            <div className="space-y-4 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {job.type}
                </span>

                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {job.sector}
                </span>

                {/* Primary Verification Badge */}
                {renderVerificationBadge()}

                {/* Expiry urgency tag */}
                {job.isExpired ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Applications Closed
                  </span>
                ) : job.isClosingSoon ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    Closing Soon ({job.daysLeft !== null && job.daysLeft >= 0 ? `${job.daysLeft} days remaining` : 'Apply promptly'})
                  </span>
                ) : null}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {job.title}
                </h1>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-3 text-slate-600 dark:text-slate-300 text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-base">
                    <Building2 className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400 shrink-0" />
                    <span>{job.employer}</span>
                  </div>

                  <span className="text-slate-300 dark:text-slate-700">·</span>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{job.location} ({job.workMode})</span>
                  </div>

                  <span className="text-slate-300 dark:text-slate-700">·</span>

                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{job.salary}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions (Bookmark, Share, Report) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleSaveItem(job.id, job.title)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSaved
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-300 dark:border-amber-700'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isSaved ? 'Job Bookmarked' : 'Save Job'}
                aria-label="Save Job"
              >
                <Bookmark className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Share Job"
                aria-label="Share Job"
              >
                <Share2 className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsReporting(true)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Report This Job"
                aria-label="Report This Job"
              >
                <Flag className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
              <span className="text-slate-400 block font-medium">Experience Level</span>
              <strong className="text-slate-900 dark:text-white text-sm block mt-0.5">
                {job.experienceLevel}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
              <span className="text-slate-400 block font-medium">Qualification</span>
              <strong className="text-slate-900 dark:text-white text-sm block mt-0.5 truncate">
                {job.qualification}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
              <span className="text-slate-400 block font-medium">Application Deadline</span>
              <strong className={`text-sm block mt-0.5 ${
                job.isExpired ? 'text-rose-600' : job.isClosingSoon ? 'text-amber-600' : 'text-slate-900 dark:text-white'
              }`}>
                {job.deadline}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
              <span className="text-slate-400 block font-medium">Original Source</span>
              <strong className="text-slate-900 dark:text-white text-sm block mt-0.5 truncate">
                {job.sourceName}
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION: Comprehensive Verification & Audit Ledger Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Job Verification &amp; Application Integrity Audit
                </h2>
                <p className="text-xs text-slate-500">
                  Verified transparency records to protect life science scholars and job seekers.
                </p>
              </div>
            </div>
            <div>
              {renderVerificationBadge()}
            </div>
          </div>

          {/* 8-Point Verification Matrix Required by Phase 07 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">1. Employer Identity</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                {job.employer}
              </div>
              <span className="text-[11px] text-slate-500 block truncate">
                Sector: {job.sector}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">2. Original Listing Source</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                {job.sourceName}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Primary Publication Feed
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">3. Original Job URL</span>
              {job.originalJobUrl ? (
                <a
                  href={job.originalJobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 truncate text-xs pt-0.5"
                >
                  <span className="truncate">View Original Notice</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                </a>
              ) : (
                <span className="text-slate-400">Not Disclosed</span>
              )}
              <span className="text-[11px] text-slate-500 block">Official Announcement</span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">4. Application Destination</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{destinationInfo?.domain || 'Direct Employer'}</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                External Employer Portal
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">5. Publication Date</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {job.publicationDate || job.postedDate || 'Recent'}
              </div>
              <span className="text-[11px] text-slate-500 block">First Indexed Date</span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">6. Expiry Date</span>
              <div className={`font-bold text-sm ${job.isExpired ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
                {job.expiryDate || job.deadline || 'Open / Not Specified'}
              </div>
              <span className="text-[11px] text-slate-500 block">Application Deadline</span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">7. Last Verification Date</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {job.lastVerificationDate || (job.isVerified ? '2026-11-07' : 'Pending Verification')}
              </div>
              <span className="text-[11px] text-slate-500 block">
                {job.isVerified ? 'Audited by BIO-NEXA Operations' : 'Awaiting Administrative Audit'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-medium block">8. Verification Status</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {job.verificationStatus}
              </div>
              <span className="text-[11px] text-slate-500 block truncate">
                {job.verificationNotes || 'Status audited and validated'}
              </span>
            </div>
          </div>

          {/* Verification Warning Notice if unverified or suspicious */}
          {!job.isVerified && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-amber-900 dark:text-amber-200">
                  Notice: This listing is currently Pending Administrative Verification
                </h4>
                <p className="text-amber-800 dark:text-amber-300">
                  BIO-NEXA adheres to strict verification transparency. This vacancy was aggregated from public career bulletins but has not yet completed full editorial verification of employer identity and application destination. Always exercise caution and verify credentials directly on the employer website.
                </p>
              </div>
            </div>
          )}

          {job.verificationStatus === 'Link Unavailable' && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-start gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Destination Link Offline / Temporarily Unavailable
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  The employer application portal for this listing is currently unreachable. Direct application links have been disabled until the hiring organization restores portal access.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main Grid: Details on Left, Sticky Sidebar on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Full Content & Transparency Disclaimers */}
          <div className="lg:col-span-8 space-y-6">

            {/* Expired / Closed Notice */}
            {job.isExpired && (
              <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-3xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h3 className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                    This vacancy has expired — applications closed
                  </h3>
                  <p className="text-rose-700 dark:text-rose-300">
                    The deadline for &ldquo;{job.title}&rdquo; closed on {job.deadline}. External application links are disabled to prevent stale candidate submissions. This record remains visible for candidate salary benchmarking and historical research.
                  </p>
                </div>
              </div>
            )}

            {/* Description & Overview */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-sky-600" />
                <span>Job Overview &amp; Role Context</span>
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>

            {/* Key Technical Responsibilities */}
            {job.responsibilities.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  <span>Key Responsibilities &amp; Daily Tasks</span>
                </h2>
                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  {job.responsibilities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Qualifications & Requirements */}
            {job.requirements.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-sky-600" />
                  <span>Educational Qualifications &amp; Prerequisites</span>
                </h2>
                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  {job.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Target Skills & Competencies */}
            {job.skills.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>Required Laboratory &amp; Computational Skills</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION: Important Trust, Safety & Legal Disclaimers Card */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <ShieldAlert className="w-5 h-5 text-sky-600" />
                <span>BIO-NEXA Candidate Protection &amp; Legal Disclaimers</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-600 dark:text-slate-300">
                <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Independent Opportunity Platform</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    BIO-NEXA is an independent biotechnology career resource. Unless an explicit recruitment partnership is stated, BIO-NEXA is not affiliated with the hiring organization.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                    <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Strict Zero-Fee Policy</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    BIO-NEXA never collects application fees on behalf of employers. Genuine life science employers do not charge applicants for interviews, tests, or placement.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>No Employment Guarantee</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    BIO-NEXA never promises employment, test clearance, or interview selection. All candidate evaluations rest entirely with the prospective employer.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Honest Verification Claim</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    We never claim every vacancy is verified. Only positions audited by our administrative team carry the Verified badge; unverified records are marked transparently.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800">
                <span>Suspect fraudulent or incorrect details on this listing?</span>
                <button
                  onClick={() => setIsReporting(true)}
                  className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report This Job to BIO-NEXA Trust Team</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Action & Summary Box */}
          <div className="lg:col-span-4 sticky top-24 space-y-6">
            
            {/* Primary Action Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-lg">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Position Application
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  Ready to apply?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Apply directly on the employer&apos;s authentic candidate portal.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-500">Verification Status:</span>
                <span className="font-bold">
                  {renderVerificationBadge()}
                </span>
              </div>

              {/* External Destination Info */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 block font-medium">Application Destination:</span>
                <div className="font-mono text-slate-800 dark:text-slate-200 text-[11px] truncate flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="truncate">{destinationInfo?.domain || 'External Portal'}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {destinationInfo?.isOfficialDomain ? 'Verified Official Domain' : 'External Website'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {isApplyActionable ? (
                  <button
                    onClick={() => setIsRedirectModalOpen(true)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Apply Now on Employer Portal</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>
                      {job.isExpired || job.verificationStatus === 'Expired'
                        ? 'Applications Closed / Expired' 
                        : job.verificationStatus === 'Link Unavailable'
                          ? 'Application Link Unavailable'
                          : job.verificationStatus === 'Rejected'
                            ? 'Listing Rejected / Inactive'
                            : 'Application Link Unavailable'}
                    </span>
                  </button>
                )}

                {/* Quick Apply Button (Native submission modal) */}
                {!job.isExpired && job.verificationStatus !== 'Expired' && job.verificationStatus !== 'Rejected' && (
                  <button
                    onClick={() => setIsQuickApplying(true)}
                    className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>Quick Apply with BIO-NEXA CV</span>
                  </button>
                )}
              </div>

              {/* Fee Warning */}
              <div className="pt-2 text-[11px] text-slate-400 text-center leading-normal">
                Never pay any fee for job applications or tests. Legitimate opportunities are always free for candidates.
              </div>
            </div>

            {/* Similar / Related Jobs Card */}
            {relatedJobs.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Similar Biotech Positions</span>
                  <button 
                    onClick={() => navigate('/jobs')} 
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-normal cursor-pointer"
                  >
                    View All
                  </button>
                </h3>

                <div className="space-y-3">
                  {relatedJobs.map((relJob) => (
                    <div
                      key={relJob.id}
                      onClick={() => navigate(`/jobs/${relJob.id}`)}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer group"
                    >
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {relJob.title}
                      </h4>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span className="truncate">{relJob.employer || relJob.company}</span>
                        <span className="font-semibold text-emerald-600">{relJob.salary}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Jobs Discovery Card */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-slate-800 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Compass className="w-4 h-4 text-teal-600" />
                <span>Search Wider Industry on Google Jobs</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Looking for more vacancies matching &ldquo;{job.title}&rdquo;? Search real-time listings aggregated across company career pages on Google Jobs.
              </p>
              <button
                onClick={() => navigate('/jobs?tab=google')}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Google Jobs Discovery</span>
                <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
              </button>
            </div>
          </div>
        </div>

        {/* MODAL 1: External Application Redirection Guard Modal */}
        {isRedirectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      External Application Destination
                    </h3>
                    <p className="text-xs text-slate-500">
                      You are navigating to an external employer portal
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRedirectModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Destination Details Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Employer:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{job.employer}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Destination Domain:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">{destinationInfo?.domain}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Listing Source:</span>
                  <span className="text-slate-700 dark:text-slate-300">{job.sourceName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Verification Status:</span>
                  <span>{renderVerificationBadge()}</span>
                </div>
              </div>

              {/* Suspicious / Unverified Warning */}
              {destinationInfo?.warningMessage && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-amber-800 dark:text-amber-300">
                    {destinationInfo.warningMessage}
                  </span>
                </div>
              )}

              {/* Safety Disclaimers */}
              <div className="p-4 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl text-xs space-y-2 text-rose-800 dark:text-rose-300">
                <div className="font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Candidate Security Reminder</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-[11px] text-rose-700 dark:text-rose-300">
                  <li>NEVER pay application fees, registration fees, or training costs.</li>
                  <li>BIO-NEXA never collects funds on behalf of employers or guarantees selection.</li>
                  <li>Confirm the browser address bar matches the employer&apos;s verified domain.</li>
                </ul>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRedirectModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Stay on BIO-NEXA
                </button>
                <button
                  type="button"
                  onClick={handleProceedToExternal}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Employer Application</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Report This Job Modal */}
        {isReporting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Report This Job Listing
                    </h3>
                    <p className="text-xs text-slate-500">
                      Help maintain trust and security for the scientific community
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsReporting(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white truncate">{job.title}</div>
                <div className="text-slate-500 truncate">{job.employer} · {destinationInfo?.domain}</div>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Reason for Report *
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Demanded Application Fee / Fraudulent Recruiter">Demanded Application Fee / Fraudulent Recruiter</option>
                    <option value="Suspicious / Unofficial Application URL">Suspicious / Unofficial Application URL</option>
                    <option value="Broken / 404 Destination Link">Broken / 404 Destination Link</option>
                    <option value="Expired Vacancy / Deadline Passed">Expired Vacancy / Deadline Passed</option>
                    <option value="Incorrect Employer / Misleading Description">Incorrect Employer / Misleading Description</option>
                    <option value="Other Suspicious Activity">Other Suspicious Activity</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Specific Details / Observed URL or Demands
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide specific notes (e.g. asked for registration money via UPI, link redirecting to scam site, or deadline was last month)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Contact Email (for moderation updates)
                  </label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReporting(false)}
                    className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Submit Report for Audit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Quick Apply Modal */}
        {isQuickApplying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-teal-600">Direct Application Dispatch</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-500">{job.employer} · {job.location}</p>
                </div>
                <button onClick={() => setIsQuickApplying(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuickApplySubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Highest Qualification
                    </label>
                    <select
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="B.Sc / B.Tech">B.Sc / B.Tech</option>
                      <option value="M.Sc / M.Tech">M.Sc / M.Tech</option>
                      <option value="Ph.D / Postdoc">Ph.D / Postdoc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Experience
                    </label>
                    <input
                      type="text"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="e.g. 2 years fermentation"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Curriculum Vitae (PDF)
                  </label>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-mono text-slate-600 dark:text-slate-300">{cvFileName}</span>
                    <label className="cursor-pointer text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">
                      Replace
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setCvFileName(e.target.files[0].name);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statement of Technical Fit
                  </label>
                  <textarea
                    rows={3}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Summarize your relevant wet lab or computational skills..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickApplying(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs"
                  >
                    Submit Application
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
