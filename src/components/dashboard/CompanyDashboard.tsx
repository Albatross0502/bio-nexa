import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Job } from '../../types';
import {
  Building2,
  PlusCircle,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  Trash2,
  FileText,
  TrendingUp,
  MapPin
} from 'lucide-react';

export const CompanyDashboard: React.FC = () => {
  const {
    currentUser,
    jobs,
    addJob,
    deleteJob,
    applications,
    updateApplicationStatus,
    navigate
  } = useApp();

  const [activeTab, setActiveTab] = useState<'applicants' | 'post-job' | 'my-jobs'>('applicants');

  // New Job Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Bengaluru, Karnataka');
  const [type, setType] = useState<Job['type']>('Full-time');
  const [sector, setSector] = useState<Job['sector']>('Private Biopharma');
  const [experienceLevel, setExperienceLevel] = useState<Job['experienceLevel']>('Mid-level (2-5 yrs)');
  const [qualification, setQualification] = useState<Job['qualification']>('M.Sc / M.Tech');
  const [salary, setSalary] = useState('₹8,00,000 - ₹12,00,000 / yr');
  const [deadline, setDeadline] = useState('2026-12-30');
  const [description, setDescription] = useState('');
  const [responsibilitiesText, setResponsibilitiesText] = useState('Operate 50L bioreactors\nEnsure cGMP compliance\nDesign DoE matrix');
  const [requirementsText, setRequirementsText] = useState('M.Sc in Biotechnology or Biochemical Engineering\n2+ years wet lab experience\nStrong data integrity acumen');
  const [skillsText, setSkillsText] = useState('Fermentation, Bioreactors, cGMP, HPLC');

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    addJob({
      title,
      company: currentUser.institution || 'Biocon Biologics',
      location,
      type,
      sector,
      experienceLevel,
      qualification,
      salary,
      deadline,
      description,
      responsibilities: responsibilitiesText.split('\n').filter((l) => l.trim().length > 0),
      requirements: requirementsText.split('\n').filter((l) => l.trim().length > 0),
      skills: skillsText.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
      benefits: ['Medical Insurance', 'Provident Fund', 'Annual Bonus'],
      source: {
        name: `${currentUser.institution || 'Company'} Recruiter Portal`,
        url: window.location.href,
        isExternal: false
      },
      featured: true
    });

    setTitle('');
    setDescription('');
    setActiveTab('my-jobs');
  };

  const companyJobs = jobs.filter(
    (j) => j.company.toLowerCase().includes('biocon') || !j.source.isExternal
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-600 font-bold text-xl">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {currentUser.institution || 'Biocon Biologics'} Recruitment Portal
              </h1>
              <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                Verified Recruiter
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Recruiter Lead: <strong>{currentUser.name}</strong> ({currentUser.email})
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Active Campus Hiring: Bioprocess, Downstream, and Bio-Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 text-center text-xs">
          <div>
            <div className="text-xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300">
              {companyJobs.length}
            </div>
            <div className="text-slate-500 mt-0.5">Active Vacancies</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-teal-600">
              {applications.length}
            </div>
            <div className="text-slate-500 mt-0.5">Applicants</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600">
              {applications.filter((a) => a.status === 'Shortlisted').length}
            </div>
            <div className="text-slate-500 mt-0.5">Shortlisted</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {(
          [
            ['applicants', `Received Applications (${applications.length})`, Users],
            ['post-job', 'Post New Job / Internship', PlusCircle],
            ['my-jobs', `Manage Posted Openings (${companyJobs.length})`, Briefcase]
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === tabKey
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: APPLICANTS */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Candidate Pipeline &amp; Scientific Review
          </h2>

          {applications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
              No applicant dossiers received yet.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {applications.map((app) => (
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
                    <div className="text-slate-500">Contact: {app.applicantEmail} · {app.phone}</div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 mt-2 italic">
                      &ldquo;{app.coverNote}&rdquo;
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
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

      {/* TAB 2: POST NEW JOB */}
      {activeTab === 'post-job' && (
        <div className="max-w-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Create a New Biotechnology Opening
            </h2>
            <p className="text-slate-500 mt-0.5">
              Publish directly to the BIO-NEXA career network visible to thousands of vetted scholars.
            </p>
          </div>

          <form onSubmit={handleCreateJob} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Associate Scientist - Upstream Fermentation & Scale-Up"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Project Contract</option>
                  <option value="Project-based">Project-based</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sector Classification
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Private Biopharma">Private Biopharma</option>
                  <option value="Government / Autonomous">Government / CSIR / ICMR</option>
                  <option value="Academic Research">Academic Research</option>
                  <option value="Diagnostics & CRO">Diagnostics &amp; CRO</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Experience Required
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Fresher (0-1 yr)">Fresher (0-1 yr)</option>
                  <option value="Mid-level (2-5 yrs)">Mid-level (2-5 yrs)</option>
                  <option value="Senior (5+ yrs)">Senior (5+ yrs)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Required Qualification
                </label>
                <select
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="B.Sc / B.Tech">B.Sc / B.Tech</option>
                  <option value="M.Sc / M.Tech">M.Sc / M.Tech</option>
                  <option value="Ph.D / Postdoc">Ph.D / Postdoc</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Salary Band (Annual)
                </label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. ₹9,00,000 - ₹12,00,000 / yr"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of the research laboratory, project targets, and scientific domain..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsibilities (One per line)
              </label>
              <textarea
                rows={3}
                value={responsibilitiesText}
                onChange={(e) => setResponsibilitiesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Candidate Requirements (One per line)
              </label>
              <textarea
                rows={3}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Required Laboratory Techniques / Skills (Comma-separated)
              </label>
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. Fermentation, Bioreactors, cGMP, HPLC"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                Publish Opening Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MANAGE POSTINGS */}
      {activeTab === 'my-jobs' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Active Openings from Your Organization
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companyJobs.map((job) => (
              <div
                key={job.id}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-blue-600">{job.sector}</span>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                      {job.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    title="Remove Job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-slate-500 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.location}</span>
                  <span>·</span>
                  <span className="font-mono text-emerald-600 font-bold">{job.salary}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-400">
                  <span>Deadline: {job.deadline}</span>
                  <button
                    onClick={() => navigate(`/jobs?id=${job.id}`)}
                    className="font-bold text-[#0B2A5B] dark:text-sky-300 hover:underline"
                  >
                    View Listing Page &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
