import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getAllUnifiedJobs,
  UnifiedJob,
  isApplicationLinkActionable,
  parseApplicationDestination,
} from '../../services/jobs/jobService';
import {
  Search,
  MapPin,
  Briefcase,
  Bookmark,
  Share2,
  Flag,
  CheckCircle2,
  AlertTriangle,
  X,
  Send,
  Building2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Compass,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { GoogleJobsSearchSection } from './GoogleJobsSearchSection';

export const JobsPage: React.FC = () => {
  const { jobs, isItemSaved, toggleSaveItem, applyToJob, addReport, addToast, currentUser, navigate } = useApp();

  // Combine state jobs and verified opportunities
  const allJobs = useMemo(() => getAllUnifiedJobs(jobs), [jobs]);

  // View mode tab state ('verified' direct listings vs 'google-search' discovery)
  const [activeTab, setActiveTab] = useState<'verified' | 'google-search'>('verified');

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedExp, setSelectedExp] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<UnifiedJob | null>(null);

  // Application Modal state
  const [isApplying, setIsApplying] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [qualification, setQualification] = useState<'B.Sc / B.Tech' | 'M.Sc / M.Tech' | 'Ph.D / Postdoc'>('M.Sc / M.Tech');
  const [experienceYears, setExperienceYears] = useState('1 Year Postgrad Project');
  const [coverNote, setCoverNote] = useState('');
  const [cvFileName, setCvFileName] = useState('Aarav_Gautam_Biotech_CV.pdf');

  // External Destination Safety Guard Modal state
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);
  const [targetRedirectJob, setTargetRedirectJob] = useState<UnifiedJob | null>(null);

  // Report Modal state
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState<'Expired' | 'Incorrect Information' | 'Spam' | 'Broken Link' | 'Demanded Application Fee'>('Expired');
  const [reportNote, setReportNote] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Sync initial query params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const idParam = params.get('id');
    const tabParam = params.get('tab') || params.get('source') || params.get('discovery');

    if (tabParam === 'google' || tabParam === 'google-search') {
      setActiveTab('google-search');
    }
    if (qParam) setSearchTerm(qParam);
    if (idParam) {
      const match = allJobs.find((j) => j.id.toLowerCase() === idParam.toLowerCase());
      if (match) setSelectedJob(match);
    } else if (allJobs.length > 0 && !selectedJob) {
      setSelectedJob(allJobs[0]);
    }
  }, [allJobs]);

  const filteredJobs = allJobs.filter((job) => {
    const matchSearch =
      !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchSector = selectedSector === 'all' || job.sector === selectedSector;
    const matchExp = selectedExp === 'all' || job.experienceLevel.toLowerCase().includes(selectedExp.toLowerCase());
    const matchType = selectedType === 'all' || job.type.toLowerCase().includes(selectedType.toLowerCase());

    const matchVerification =
      selectedVerification === 'all' ||
      (selectedVerification === 'Verified' && job.verificationStatus === 'Verified') ||
      (selectedVerification === 'Pending Verification' && job.verificationStatus === 'Pending Verification') ||
      (selectedVerification === 'Expired' && (job.verificationStatus === 'Expired' || job.isExpired)) ||
      (selectedVerification === 'Link Unavailable' && (job.verificationStatus === 'Link Unavailable' || job.isClosed));

    return matchSearch && matchSector && matchExp && matchType && matchVerification;
  });

  const handleShare = (job: UnifiedJob) => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    navigator.clipboard?.writeText(url);
    addToast('Job link copied to clipboard!', 'info');
  };

  const handleOpenExternalApply = (job: UnifiedJob) => {
    setTargetRedirectJob(job);
    setIsRedirectModalOpen(true);
  };

  const handleConfirmRedirect = () => {
    if (targetRedirectJob?.applicationUrl) {
      window.open(targetRedirectJob.applicationUrl, '_blank', 'noopener,noreferrer');
      setIsRedirectModalOpen(false);
    }
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    applyToJob({
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      company: selectedJob.company,
      applicantName,
      applicantEmail,
      phone,
      qualification,
      experienceYears,
      coverNote: coverNote || 'I am keenly interested in contributing to this bioprocess / scientific opening.',
    });

    setIsApplying(false);
    setCoverNote('');
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setIsSubmittingReport(true);
    try {
      await fetch(`/api/jobs/${selectedJob.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: reportNote,
          reporterEmail: currentUser.email,
        }),
      });
      const mappedReason = reportReason === 'Demanded Application Fee' ? 'Spam' : reportReason;
      addReport('Job', `${selectedJob.title} (${selectedJob.company})`, mappedReason);
      addToast('Thank you for reporting. Our verification team will review this listing.', 'success');
      setIsReporting(false);
      setReportNote('');
    } catch {
      const mappedReason = reportReason === 'Demanded Application Fee' ? 'Spam' : reportReason;
      addReport('Job', `${selectedJob.title} (${selectedJob.company})`, mappedReason);
      setIsReporting(false);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Biotechnology &amp; Life Sciences Jobs
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Explore vetted openings in fermentation, molecular biology, bioinformatics, and regulatory affairs.
          </p>
        </div>

        {/* Search Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs self-start sm:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('verified')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'verified'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Direct Listings ({allJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('google-search')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'google-search'
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0B2A5B] dark:hover:text-sky-300'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-teal-400" />
            <span>Google Jobs Search</span>
          </button>
        </div>
      </div>

      {/* Conditional Content: Google Jobs Discovery Console or Direct Listings */}
      {activeTab === 'google-search' ? (
        <GoogleJobsSearchSection onClose={() => setActiveTab('verified')} />
      ) : (
        <>
          {/* Prominent Google Jobs Search Discovery Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-teal-50/90 dark:from-slate-800/80 dark:to-slate-800/50 rounded-xl border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0B2A5B] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Compass className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Discover Real Biotechnology Jobs via Google Jobs</span>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-100/60 dark:bg-teal-900/40 px-2 py-0.5 rounded">
                    Google Search
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                  Search live vacancies across Microbiology, Molecular Biology, Clinical Research, Internships &amp; Research Assistant posts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('google-search')}
              className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer text-xs"
            >
              <span>Search on Google Jobs</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-300" />
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by job title, lab technique (e.g. CRISPR, HPLC, PCR), or company..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Sector filter */}
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Sectors</option>
              <option value="Private Biopharma">Private Biopharma</option>
              <option value="Government / Autonomous">Government / CSIR / ICMR</option>
              <option value="Academic Research">Academic Research</option>
              <option value="Diagnostics & CRO">Diagnostics &amp; CRO</option>
            </select>

            {/* Experience level */}
            <select
              value={selectedExp}
              onChange={(e) => setSelectedExp(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Experience</option>
              <option value="Fresher (0-1 yr)">Fresher (0-1 yr)</option>
              <option value="Mid-level (2-5 yrs)">Mid-level (2-5 yrs)</option>
              <option value="Senior (5+ yrs)">Senior (5+ yrs)</option>
            </select>

            {/* Job Type */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="Full-time">Full-time</option>
              <option value="Contract">Project Contract</option>
              <option value="Project-based">Project-based</option>
            </select>

            {/* Verification Status Filter */}
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none font-medium"
            >
              <option value="all">All Verification</option>
              <option value="Verified">Verified Only</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Expired">Expired</option>
              <option value="Link Unavailable">Link Unavailable</option>
            </select>
          </div>
        </div>

        {/* Quick filter badges */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
          <span className="text-slate-400 whitespace-nowrap">Popular searches:</span>
          {['CRISPR', 'Fermentation', 'HPLC', 'CSIR', 'Biocon', 'Serum Institute'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchTerm(tag)}
              className="text-slate-600 dark:text-slate-300 hover:text-[#0B2A5B] dark:hover:text-sky-300 underline underline-offset-4 decoration-slate-300 whitespace-nowrap"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Jobs Layout: Listing & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Job Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
            <span>Showing <strong className="text-slate-900 dark:text-slate-100 font-mono">{filteredJobs.length}</strong> positions</span>
            <span>Sorted by Latest</span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-3">
              <p className="text-sm font-semibold">No direct listings match your current filters.</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSector('all');
                    setSelectedExp('all');
                    setSelectedType('all');
                  }}
                  className="text-xs text-[#0B2A5B] dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => setActiveTab('google-search')}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Search on Google Jobs</span>
                </button>
              </div>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#0B2A5B] bg-blue-50/40 dark:bg-slate-800/90 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-[#1F6FB2] dark:text-sky-400">
                        {job.company}
                      </span>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug mt-0.5">
                        {job.title}
                      </h2>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {job.verificationStatus === 'Verified' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Verified</span>
                        </span>
                      ) : job.verificationStatus === 'Pending Verification' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>Pending Audit</span>
                        </span>
                      ) : job.verificationStatus === 'Link Unavailable' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                          <AlertCircle className="w-3 h-3 text-slate-500" />
                          <span>Link Broken</span>
                        </span>
                      ) : job.verificationStatus === 'Expired' || job.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Expired</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                          <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>{job.verificationStatus}</span>
                        </span>
                      )}
                      {job.featured && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{job.location}</span>
                    </span>
                    <span>·</span>
                    <span>{job.experienceLevel}</span>
                  </div>

                  <div className="text-xs font-mono font-semibold text-emerald-600 mt-2">
                    {job.salary}
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500 mt-3">
                    {job.skills.slice(0, 3).map((s, idx) => (
                      <span key={s}>
                        {s}
                        {idx < 2 && <span className="ml-1 text-slate-300">·</span>}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <span>Deadline: <strong className="text-slate-700 dark:text-slate-300">{job.deadline}</strong></span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0B2A5B] dark:hover:text-sky-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                      {isApplicationLinkActionable(job) ? (
                        <button
                          onClick={() => handleOpenExternalApply(job)}
                          className="px-3 py-1 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <span>Apply</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold rounded-lg cursor-not-allowed border border-slate-300 dark:border-slate-700"
                        >
                          <span>{job.isExpired || job.verificationStatus === 'Expired' ? 'Expired' : job.isClosed ? 'Closed' : 'Unavailable'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Job Detail View */}
        <div className="lg:col-span-7 sticky top-20">
          {selectedJob ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs">
              {/* Top Banner */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1F6FB2] dark:text-sky-400">
                    <Building2 className="w-4 h-4" />
                    <span>{selectedJob.company}</span>
                    <span>·</span>
                    <span className="text-slate-500">{selectedJob.sector}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {selectedJob.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedJob.location}
                    </span>
                    <span>·</span>
                    <span>{selectedJob.type}</span>
                    <span>·</span>
                    <span className="font-mono text-emerald-600 font-bold">{selectedJob.salary}</span>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleSaveItem(selectedJob.id, selectedJob.title)}
                    className={`p-2 rounded-lg border transition-colors ${
                      isItemSaved(selectedJob.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'text-slate-500 hover:text-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                    title="Save Job"
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(selectedJob.id) ? 'currentColor' : 'none'} />
                  </button>

                  <button
                    onClick={() => handleShare(selectedJob)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 transition-colors"
                    title="Share Job"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsReporting(true)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Report Listing"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Primary Call to Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500">
                  Application Deadline: <strong className={selectedJob.isExpired ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}>{selectedJob.deadline}</strong>
                  {selectedJob.isExpired ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Applications Closed
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Open for Applications
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate(`/jobs/${selectedJob.id}`)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    title="Open Dedicated Full Page"
                  >
                    <span>Full Page</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  {!selectedJob.isExpired && !selectedJob.isClosed && selectedJob.verificationStatus !== 'Expired' && selectedJob.verificationStatus !== 'Rejected' && (
                    <button
                      onClick={() => setIsApplying(true)}
                      className="px-3.5 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Quick Apply</span>
                    </button>
                  )}
                  {isApplicationLinkActionable(selectedJob) ? (
                    <button
                      onClick={() => handleOpenExternalApply(selectedJob)}
                      className="px-5 py-2 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Apply on Official Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-5 py-2 bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed border border-slate-300 dark:border-slate-700"
                    >
                      <span>{selectedJob.isExpired || selectedJob.verificationStatus === 'Expired' ? 'Applications Closed' : 'Link Unavailable'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 8-Point Verification Summary Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Listing Verification &amp; Application Audit</span>
                  </span>
                  {selectedJob.verificationStatus === 'Verified' ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                      Verified
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                      {selectedJob.verificationStatus}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <div>
                    <span className="text-slate-400 block">Employer:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedJob.employer || selectedJob.company}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Destination Domain:</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">
                      {parseApplicationDestination(selectedJob).domain || 'Internal Portal'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Original Source:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedJob.sourceName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Verification:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedJob.lastVerificationDate || selectedJob.postedDate}</strong>
                  </div>
                </div>
              </div>

              {/* Role Overview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Role Overview
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedJob.description}
                </p>
              </div>

              {/* Responsibilities */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Key Technical Responsibilities
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {selectedJob.responsibilities.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#14A3A0] font-bold">&bull;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Requirements & Qualification */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Qualifications &amp; Requirements
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {selectedJob.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lab Techniques & Skills */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Target Laboratory Competencies
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedJob.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Source & Transparency Note */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Source: <strong>{selectedJob.sourceName}</strong>
                </span>
                {selectedJob.sourceUrl && (
                  <a
                    href={selectedJob.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-[#0B2A5B] dark:text-sky-400 font-medium"
                  >
                    Verify Original Source &rarr;
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
              <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Select a job from the listing to review responsibilities and submit an application.</p>
            </div>
          )}
        </div>
      </div>

      {/* PHASE 07 — Independent Platform & Transparency Disclaimer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
          <HelpCircle className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Independent Platform Disclaimer &amp; Candidate Protection Guidelines</span>
        </div>
        <p className="leading-relaxed">
          <strong>BIO-NEXA</strong> is an independent career-opportunity and academic directory. Unless explicitly indicated with an official partnership seal, BIO-NEXA does not act as a hiring agency or formal recruitment partner for listed entities. All job titles, employer logos, and trademarks belong to their respective registered owners.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">Zero Application Fees</strong>
            BIO-NEXA and legitimate biotechnology employers never demand payment or processing fees for job applications or interviews.
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">Original Employer Portals</strong>
            External application links lead directly to the official employer careers destination. We never route traffic through intermediate ad walls.
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">Audited Verification</strong>
            Only opportunities audited by BIO-NEXA administrators display the "Verified" seal. Unaudited listings show "Pending Audit".
          </div>
        </div>
      </div>
        </>
      )}

      {/* Application Modal */}
      {isApplying && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-600">Native Application Submission</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedJob.title}
                </h3>
                <p className="text-xs text-slate-500">{selectedJob.company} · {selectedJob.location}</p>
              </div>
              <button onClick={() => setIsApplying(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="B.Sc / B.Tech">B.Sc / B.Tech</option>
                    <option value="M.Sc / M.Tech">M.Sc / M.Tech</option>
                    <option value="Ph.D / Postdoc">Ph.D / Postdoc</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relevant Experience
                  </label>
                  <input
                    type="text"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 2 years fermentation"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Attached Scientific Curriculum Vitae (PDF)
                </label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-mono text-slate-600 dark:text-slate-300">{cvFileName}</span>
                  <label className="cursor-pointer text-xs font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline">
                    Change
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
                  Brief Statement of Research &amp; Technical Fit
                </label>
                <textarea
                  rows={3}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Summarize your relevant wet lab or computational skills (e.g. bioreactor scale-up, Western blotting, molecular cloning)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplying(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg shadow-xs"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Redirection Guard Modal */}
      {isRedirectModalOpen && targetRedirectJob && (() => {
        const destination = parseApplicationDestination(targetRedirectJob);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      External Application Notice
                    </h3>
                    <p className="text-xs text-slate-500">Leaving BIO-NEXA for Employer Portal</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRedirectModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Destination Preview Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Employer Destination:</span>
                  <span className="font-mono text-[11px] font-bold text-[#0B2A5B] dark:text-sky-300">
                    {destination.domain}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Full Destination URL:</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[260px]">
                    {targetRedirectJob.applicationUrl}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification Status:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    targetRedirectJob.verificationStatus === 'Verified'
                      ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300'
                      : 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 border border-amber-300'
                  }`}>
                    {targetRedirectJob.verificationStatus}
                  </span>
                </div>
              </div>

              {/* Security Warning If Suspicious */}
              {destination.isSuspicious && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Caution: Destination Advisory</strong>
                    <span>{destination.warning}</span>
                  </div>
                </div>
              )}

              {/* Legal & Anti-Fraud Notice */}
              <div className="p-3 bg-blue-50/60 dark:bg-slate-800/80 rounded-xl border border-blue-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Applicant Protection Guarantee</span>
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside">
                  <li>Never pay fees for applications, exams, or interview scheduling. BIO-NEXA never collects hiring charges.</li>
                  <li>BIO-NEXA is an independent platform and does not guarantee interview selection or hiring outcomes.</li>
                  <li>Verify all communications match the official employer domain ({destination.domain}).</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRedirectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRedirect}
                  className="px-5 py-2 text-xs font-bold bg-[#0B2A5B] hover:bg-blue-900 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Proceed to Employer Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Report Modal */}
      {isReporting && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Report Job Listing
              </h3>
              <button onClick={() => setIsReporting(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Reporting: <strong>{selectedJob.title}</strong> at {selectedJob.company}
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Report
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="Expired">Position has expired / Closed</option>
                  <option value="Broken Link">Application portal link is broken or unavailable</option>
                  <option value="Demanded Application Fee">Demanded application or interview fee (Illegal)</option>
                  <option value="Incorrect Information">Inaccurate eligibility / salary details</option>
                  <option value="Spam">Spam or fraudulent recruiter identity</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Context (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Provide any details (e.g. error message encountered, email demanding payment)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReporting(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded cursor-pointer"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
