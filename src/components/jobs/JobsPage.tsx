import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Job } from '../../types';
import {
  Search,
  MapPin,
  Briefcase,
  Bookmark,
  Share2,
  Flag,
  CheckCircle2,
  X,
  Send,
  Building2,
  Clock,
  Sparkles
} from 'lucide-react';

export const JobsPage: React.FC = () => {
  const { jobs, isItemSaved, toggleSaveItem, applyToJob, addReport, addToast, currentUser } = useApp();

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedExp, setSelectedExp] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Application Modal state
  const [isApplying, setIsApplying] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [qualification, setQualification] = useState<'B.Sc / B.Tech' | 'M.Sc / M.Tech' | 'Ph.D / Postdoc'>('M.Sc / M.Tech');
  const [experienceYears, setExperienceYears] = useState('1 Year Postgrad Project');
  const [coverNote, setCoverNote] = useState('');
  const [cvFileName, setCvFileName] = useState('Aarav_Gautam_Biotech_CV.pdf');

  // Report Modal state
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState<'Expired' | 'Incorrect Information' | 'Spam' | 'Broken Link'>('Expired');

  // Sync initial query params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const idParam = params.get('id');
    if (qParam) setSearchTerm(qParam);
    if (idParam) {
      const match = jobs.find((j) => j.id === idParam);
      if (match) setSelectedJob(match);
    }
  }, [jobs]);

  const filteredJobs = jobs.filter((job) => {
    const matchSearch =
      !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchSector = selectedSector === 'all' || job.sector === selectedSector;
    const matchExp = selectedExp === 'all' || job.experienceLevel === selectedExp;
    const matchType = selectedType === 'all' || job.type === selectedType;

    return matchSearch && matchSector && matchExp && matchType;
  });

  const handleShare = (job: Job) => {
    const url = `${window.location.origin}/jobs?id=${job.id}`;
    navigator.clipboard?.writeText(url);
    addToast('Job link copied to clipboard!', 'info');
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

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    addReport('Job', `${selectedJob.title} (${selectedJob.company})`, reportReason);
    setIsReporting(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology &amp; Life Sciences Jobs
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Explore vetted openings in fermentation, molecular biology, bioinformatics, and regulatory affairs.
        </p>
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
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <p className="text-sm font-semibold">No job listings match your current filters.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSector('all');
                  setSelectedExp('all');
                  setSelectedType('all');
                }}
                className="mt-2 text-xs text-[#0B2A5B] dark:text-sky-400 font-semibold hover:underline"
              >
                Clear all filters
              </button>
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
                    {job.featured && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        Featured
                      </span>
                    )}
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

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <span>Posted {job.postedDate}</span>
                    <span>Deadline: {job.deadline}</span>
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
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500">
                  Application Deadline: <strong className="text-slate-900 dark:text-slate-100">{selectedJob.deadline}</strong>
                </div>
                <button
                  onClick={() => setIsApplying(true)}
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Apply Now</span>
                </button>
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
                  Source: <strong>{selectedJob.source.name}</strong>
                </span>
                <a
                  href={selectedJob.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-[#0B2A5B] dark:text-sky-400 font-medium"
                >
                  Verify Original Source &rarr;
                </a>
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

      {/* Report Modal */}
      {isReporting && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Report Job Listing
              </h3>
              <button onClick={() => setIsReporting(false)} className="text-slate-400 hover:text-slate-600">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Expired">Position has expired / Closed</option>
                  <option value="Incorrect Information">Inaccurate eligibility / salary details</option>
                  <option value="Broken Link">Application portal link is broken</option>
                  <option value="Spam">Spam or fraudulent recruiter</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReporting(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
