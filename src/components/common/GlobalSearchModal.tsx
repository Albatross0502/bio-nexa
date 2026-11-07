import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, X, Briefcase, GraduationCap, FileText, Award, BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import { SEED_EXAMS, SEED_SCHOLARSHIPS, SEED_RESEARCH } from '../../data/seedData';
import { opportunityStore } from '../../services/opportunities/opportunityStore';
import { Opportunity } from '../../types/opportunity';

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, jobs, internships, courses, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'jobs' | 'internships' | 'courses' | 'exams' | 'scholarships' | 'research'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const q = query.toLowerCase().trim();

  const matchedJobs = jobs
    .filter((j) => !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.skills.some((s) => s.toLowerCase().includes(q)))
    .slice(0, 4);

  const matchedInternships = internships
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.organization.toLowerCase().includes(q))
    .slice(0, 3);

  const matchedCourses = courses
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
    .slice(0, 3);

  const matchedExams = SEED_EXAMS
    .filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.shortName.toLowerCase().includes(q))
    .slice(0, 3);

  const matchedScholarships = SEED_SCHOLARSHIPS
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q))
    .slice(0, 3);

  const matchedResearch = SEED_RESEARCH
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)))
    .slice(0, 3);

  const matchedOpportunities = React.useMemo(() => {
    try {
      const opps: Opportunity[] = opportunityStore.getAllOpportunities();
      return opps
        .filter((o: Opportunity) => o.isApproved && (!q || o.title.toLowerCase().includes(q) || o.organization.toLowerCase().includes(q) || o.branches.some((b: string) => b.toLowerCase().includes(q))))
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [q, isSearchOpen]);

  const handleSelect = (path: string) => {
    setIsSearchOpen(false);
    navigate(path);
  };

  const showAll = filterType === 'all';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, internships, courses, exams, scholarships, CRISPR research..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto text-xs">
          {(
            [
              ['all', 'All Modules'],
              ['jobs', 'Jobs'],
              ['internships', 'Internships'],
              ['courses', 'Courses'],
              ['exams', 'Exams'],
              ['scholarships', 'Scholarships'],
              ['research', 'Research']
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterType(val)}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                filterType === val
                  ? 'bg-[#0B2A5B] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Live Opportunities Portal listings */}
          {(showAll || filterType === 'jobs' || filterType === 'internships') && matchedOpportunities.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Verified Opportunities & Workshops</span>
                </div>
                <button
                  onClick={() => handleSelect(`/opportunities${query ? `?q=${encodeURIComponent(query)}` : ''}`)}
                  className="text-[11px] font-medium text-sky-600 hover:underline cursor-pointer"
                >
                  View in Portal →
                </button>
              </div>
              <div className="space-y-1">
                {matchedOpportunities.map((opp: Opportunity) => (
                  <div
                    key={opp.id}
                    onClick={() => handleSelect(`/opportunities?id=${opp.id}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                        {opp.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{opp.organization}</span>
                        <span>·</span>
                        <span className="capitalize">{opp.type.replace('_', ' ')}</span>
                        <span>·</span>
                        <span>{opp.location}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jobs */}
          {(showAll || filterType === 'jobs') && matchedJobs.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                <span>Biotech Openings</span>
              </div>
              <div className="space-y-1">
                {matchedJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => handleSelect(`/jobs/${job.id}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{job.company}</span>
                        <span>·</span>
                        <span>{job.location}</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-600">{job.salary}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internships */}
          {(showAll || filterType === 'internships') && matchedInternships.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                <span>Internships & Fellowships</span>
              </div>
              <div className="space-y-1">
                {matchedInternships.map((intern) => (
                  <div
                    key={intern.id}
                    onClick={() => handleSelect(`/internships?id=${intern.id}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                        {intern.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{intern.organization}</span>
                        <span>·</span>
                        <span>{intern.duration}</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-600">{intern.stipend}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Courses */}
          {(showAll || filterType === 'courses') && matchedCourses.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Academy Courses</span>
              </div>
              <div className="space-y-1">
                {matchedCourses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(`/courses?id=${c.id}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                        {c.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{c.instructor}</span>
                        <span>·</span>
                        <span>{c.level}</span>
                        <span>·</span>
                        <span>★ {c.rating}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exams */}
          {(showAll || filterType === 'exams') && matchedExams.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>National Biotech Exams</span>
              </div>
              <div className="space-y-1">
                {matchedExams.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => handleSelect(`/exams?slug=${e.slug}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                        {e.fullName} ({e.shortName})
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{e.conductingBody}</span>
                        <span>·</span>
                        <span>Next Date: {e.upcomingDate}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scholarships */}
          {(showAll || filterType === 'scholarships') && matchedScholarships.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fellowships & Grants</span>
              </div>
              <div className="space-y-1">
                {matchedScholarships.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(`/scholarships?id=${s.id}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                        {s.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{s.provider}</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-600">{s.amount}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research */}
          {(showAll || filterType === 'research') && matchedResearch.length > 0 && (
            <div className="py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>PubMed & Literature Discoveries</span>
              </div>
              <div className="space-y-1">
                {matchedResearch.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSelect(`/research?doi=${r.doi}`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-sky-600 transition-colors line-clamp-1">
                        {r.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{r.journal}</span>
                        <span>·</span>
                        <span>DOI: {r.doi}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty search state */}
          {matchedOpportunities.length === 0 &&
            matchedJobs.length === 0 &&
            matchedInternships.length === 0 &&
            matchedCourses.length === 0 &&
            matchedExams.length === 0 &&
            matchedScholarships.length === 0 &&
            matchedResearch.length === 0 && (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <p className="text-sm">No matches found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-slate-400">Try searching for &quot;Fermentation&quot;, &quot;CRISPR&quot;, &quot;CSIR NET&quot;, or &quot;Biocon&quot;</p>
                {query.trim() && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigate(`/jobs?tab=google&q=${encodeURIComponent(query)}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0B2A5B] text-white rounded-xl text-xs font-bold hover:bg-blue-900 transition-colors cursor-pointer shadow-xs"
                    >
                      <span>Search &ldquo;{query}&rdquo; on Google Jobs</span>
                      <ChevronRight className="w-3.5 h-3.5 text-teal-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
