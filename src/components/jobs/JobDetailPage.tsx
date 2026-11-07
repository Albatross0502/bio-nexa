import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  getJobByIdOrSlug, 
  getAllUnifiedJobs, 
  isApplicationLinkActionable, 
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
  Compass
} from 'lucide-react';

interface JobDetailPageProps {
  jobId: string;
}

export const JobDetailPage: React.FC<JobDetailPageProps> = ({ jobId }) => {
  const { jobs, isItemSaved, toggleSaveItem, applyToJob, addReport, addToast, currentUser, navigate } = useApp();

  // Resolve job from both state & seed sources
  const job = useMemo<UnifiedJob | null>(() => {
    return getJobByIdOrSlug(jobId, jobs);
  }, [jobId, jobs]);

  // Modals state
  const [isQuickApplying, setIsQuickApplying] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [qualification, setQualification] = useState<'B.Sc / B.Tech' | 'M.Sc / M.Tech' | 'Ph.D / Postdoc'>('M.Sc / M.Tech');
  const [experienceYears, setExperienceYears] = useState('1 Year Postgrad Wet-Lab Project');
  const [coverNote, setCoverNote] = useState('');
  const [cvFileName, setCvFileName] = useState('Aarav_Gautam_Biotech_CV.pdf');

  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState<'Expired' | 'Incorrect Information' | 'Spam' | 'Broken Link'>('Expired');

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

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addReport('Job', `${job.title} (${job.company})`, reportReason);
    setIsReporting(false);
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
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

                {job.isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Recruiter
                  </span>
                )}

                {/* Expiry / Urgency status */}
                {job.isExpired ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Application Closed / Expired
                  </span>
                ) : job.isClosed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Position Filled
                  </span>
                ) : job.isClosingSoon ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    Closing Soon ({job.daysLeft !== null && job.daysLeft >= 0 ? `${job.daysLeft} days remaining` : 'Apply promptly'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Actively Hiring
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {job.title}
                </h1>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-3 text-slate-600 dark:text-slate-300 text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-base">
                    <Building2 className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400 shrink-0" />
                    <span>{job.company}</span>
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

            {/* Quick Actions (Bookmark, Share, Report) */}
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
                title="Report Listing"
                aria-label="Report Listing"
              >
                <Flag className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
              <span className="text-slate-400 block font-medium">Experience Needed</span>
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
              <span className="text-slate-400 block font-medium">Source / Employer</span>
              <strong className="text-slate-900 dark:text-white text-sm block mt-0.5 truncate">
                {job.sourceName}
              </strong>
            </div>
          </div>
        </div>

        {/* Main Grid: Details on Left, Sticky Sidebar on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Full Content */}
          <div className="lg:col-span-8 space-y-6">

            {/* Expired / Closed Notice (if applicable) */}
            {job.isExpired && (
              <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-3xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h3 className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                    This position deadline has expired
                  </h3>
                  <p className="text-rose-700 dark:text-rose-300">
                    The application period for &ldquo;{job.title}&rdquo; closed on {job.deadline}. We have archived this record for candidate salary benchmarking and historical research.
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

            {/* Benefits & Perks (if present) */}
            {job.benefits && job.benefits.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Benefits &amp; Institutional Perks</span>
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                  {job.benefits.map((b, idx) => (
                    <li key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Transparency & Candidate Safety Banner */}
            <div className="p-6 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <Info className="w-4 h-4 text-sky-600" />
                  <span>Official Source Transparency &amp; Candidate Safety</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">ID: {job.id}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Indexed from verified employer portal: <strong className="text-slate-800 dark:text-slate-200">{job.sourceName}</strong>. 
                BIO-NEXA strictly prohibits collecting application or processing fees from candidates.
              </p>
              {job.sourceUrl && (
                <div className="pt-1">
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                  >
                    <span>Inspect official gazette / source announcement</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
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
                  Follow employer instructions on their official candidate portal.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold capitalize ${
                  job.isExpired ? 'text-rose-600' : job.isClosingSoon ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {job.status}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {isApplyActionable ? (
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Apply on Official Portal</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>
                      {job.isExpired 
                        ? 'Applications Closed' 
                        : job.isClosed 
                          ? 'Position Closed' 
                          : 'Application Link Unavailable'}
                    </span>
                  </button>
                )}

                {/* Quick Apply Button (Native submission modal) */}
                {!job.isExpired && !job.isClosed && (
                  <button
                    onClick={() => setIsQuickApplying(true)}
                    className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>Quick Apply with BIO-NEXA CV</span>
                  </button>
                )}
              </div>

              {/* Safe Application Guarantee */}
              <div className="pt-2 text-[11px] text-slate-400 text-center">
                Always review required eligibility criteria on the employer website before submitting documents.
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
                        <span className="truncate">{relJob.company}</span>
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
                Looking for more openings matching &ldquo;{job.title}&rdquo;? Search real-time listings aggregated across company career pages on Google Jobs.
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

        {/* Quick Apply Modal */}
        {isQuickApplying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-teal-600">Quick Application Dispatch</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-500">{job.company} · {job.location}</p>
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
                    Brief Statement of Technical Fit
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

        {/* Report Listing Modal */}
        {isReporting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Report Job Listing
                </h3>
                <button onClick={() => setIsReporting(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Reporting: <strong>{job.title}</strong> at {job.company}
              </p>
              <form onSubmit={handleReportSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Report
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Expired">Position has expired / Deadline passed</option>
                    <option value="Incorrect Information">Inaccurate eligibility or salary details</option>
                    <option value="Broken Link">Application portal link is broken / 404</option>
                    <option value="Spam">Spam or fraudulent recruiter</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReporting(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
                  >
                    Submit Report
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
