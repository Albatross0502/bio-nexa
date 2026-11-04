import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Internship } from '../../types';
import {
  Search,
  MapPin,
  GraduationCap,
  Bookmark,
  Share2,
  Calendar,
  CheckCircle2,
  Building2,
  X,
  Send
} from 'lucide-react';

export const InternshipsPage: React.FC = () => {
  const { internships, isItemSaved, toggleSaveItem, applyToJob, addToast, currentUser } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [selectedIntern, setSelectedIntern] = useState<Internship | null>(null);

  // Application Modal state
  const [isApplying, setIsApplying] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [coverNote, setCoverNote] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const idParam = params.get('id');
    if (qParam) setSearchTerm(qParam);
    if (idParam) {
      const match = internships.find((i) => i.id === idParam);
      if (match) setSelectedIntern(match);
    }
  }, [internships]);

  const filteredInternships = internships.filter((intern) => {
    const matchSearch =
      !searchTerm ||
      intern.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.skillsRequired.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchCategory = selectedCategory === 'all' || intern.category === selectedCategory;
    const matchMode = selectedMode === 'all' || intern.mode === selectedMode;

    return matchSearch && matchCategory && matchMode;
  });

  const handleShare = (intern: Internship) => {
    const url = `${window.location.origin}/internships?id=${intern.id}`;
    navigator.clipboard?.writeText(url);
    addToast('Internship link copied to clipboard!', 'info');
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntern) return;

    applyToJob({
      jobId: selectedIntern.id,
      jobTitle: `Internship: ${selectedIntern.title}`,
      company: selectedIntern.organization,
      applicantName,
      applicantEmail,
      phone,
      qualification: 'M.Sc / M.Tech',
      experienceYears: 'Student Trainee',
      coverNote: coverNote || 'I am applying for this research fellowship training position.',
    });

    setIsApplying(false);
    setCoverNote('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Internships &amp; Research Fellowships
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Funded summer research programs, national academy projects, and biopharma industrial training.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by program, institution (e.g. IISc, NCBS, Biocon), or technique..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Fellowship Types</option>
              <option value="Summer Fellowship">Summer Fellowship</option>
              <option value="Industrial R&D">Industrial R&amp;D</option>
              <option value="Academic Dissertation">Academic Dissertation</option>
              <option value="Clinical Research">Clinical Research</option>
            </select>

            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Modes</option>
              <option value="On-site Lab">On-site Wet Lab</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote / Dry Lab">Remote / Dry Lab</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Listings column */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
            <span>Showing <strong className="text-slate-900 dark:text-slate-100 font-mono">{filteredInternships.length}</strong> opportunities</span>
            <span>Sorted by Upcoming Deadline</span>
          </div>

          {filteredInternships.map((intern) => {
            const isSelected = selectedIntern?.id === intern.id;
            return (
              <div
                key={intern.id}
                onClick={() => setSelectedIntern(intern)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/40 dark:bg-slate-800/90 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                      {intern.organization}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug mt-0.5">
                      {intern.title}
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                    {intern.mode}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-2 mt-2">
                  <span>{intern.duration}</span>
                  <span>·</span>
                  <span className="font-mono text-emerald-600 font-bold">{intern.stipend}</span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-2 leading-relaxed">
                  {intern.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                  <span>Deadline: <strong className="text-slate-700 dark:text-slate-300">{intern.deadline}</strong></span>
                  <span className="text-teal-600 font-semibold">View Details &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail column */}
        <div className="lg:col-span-7 sticky top-20">
          {selectedIntern ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-600">
                    <Building2 className="w-4 h-4" />
                    <span>{selectedIntern.organization}</span>
                    <span>·</span>
                    <span className="text-slate-500">{selectedIntern.category}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {selectedIntern.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedIntern.location}
                    </span>
                    <span>·</span>
                    <span>Duration: {selectedIntern.duration}</span>
                    <span>·</span>
                    <span className="font-mono text-emerald-600 font-bold">{selectedIntern.stipend}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleSaveItem(selectedIntern.id, selectedIntern.title)}
                    className={`p-2 rounded-lg border transition-colors ${
                      isItemSaved(selectedIntern.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'text-slate-500 hover:text-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                    title="Save Internship"
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(selectedIntern.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => handleShare(selectedIntern)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Banner */}
              <div className="flex items-center justify-between p-3.5 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800">
                <div className="text-xs text-teal-900 dark:text-teal-200">
                  Deadline: <strong className="font-mono">{selectedIntern.deadline}</strong>
                </div>
                <button
                  onClick={() => setIsApplying(true)}
                  className="px-5 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Fellowship Application</span>
                </button>
              </div>

              {/* Eligibility */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Eligibility Criteria
                </h3>
                <p className="text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  {selectedIntern.eligibility}
                </p>
              </div>

              {/* Overview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Program Description &amp; Scope
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedIntern.description}
                </p>
              </div>

              {/* Learning Outcomes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Hands-on Learning Outcomes
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {selectedIntern.learningOutcomes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skills required */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Preferred Foundation
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedIntern.skillsRequired.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Source: <strong>{selectedIntern.source.name}</strong></span>
                <a
                  href={selectedIntern.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-teal-600 font-medium"
                >
                  Official Fellowship Portal &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Select an internship or summer fellowship to review syllabus and submission instructions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Application Modal */}
      {isApplying && selectedIntern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-600">Fellowship Application</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedIntern.title}
                </h3>
                <p className="text-xs text-slate-500">{selectedIntern.organization}</p>
              </div>
              <button onClick={() => setIsApplying(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Candidate Name
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
                    Email
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
                    Phone
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

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Statement of Research Interest &amp; Lab Background
                </label>
                <textarea
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Explain why you wish to join this lab and what techniques you look forward to mastering..."
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
                  className="px-5 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold rounded-lg shadow-xs"
                >
                  Send Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
