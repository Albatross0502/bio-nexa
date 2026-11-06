import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  RotateCcw, 
  ExternalLink, 
  Briefcase, 
  GraduationCap, 
  Sparkles, 
  Award, 
  Layers, 
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Building,
  MapPin,
  Clock,
  BookOpen
} from 'lucide-react';
import { Opportunity, OpportunityFilterState, OpportunityType, WorkMode } from '../../types/opportunity';
import { EDUCATIONAL_BRANCHES } from '../../config/branches';
import { opportunityStore } from '../../services/opportunities/opportunityStore';
import { generateExternalSearchUrls } from '../../services/opportunities/externalSearchGenerator';
import { OpportunityCard } from './OpportunityCard';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { SubmitOpportunityModal } from './SubmitOpportunityModal';

interface OpportunitiesPortalProps {
  initialType?: OpportunityType | 'all' | 'biotech_jobs';
  initialBranch?: string;
}

export const OpportunitiesPortal: React.FC<OpportunitiesPortalProps> = ({
  initialType = 'all',
  initialBranch = 'all',
}) => {
  // State from store
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bio_nexa_bookmarked_opps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>(initialType);
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranch);
  const [workMode, setWorkMode] = useState<WorkMode | 'all'>('all');
  const [experience, setExperience] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'deadline' | 'title'>('recent');
  const [showOnlyVerified, setShowOnlyVerified] = useState(false);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [cityFilter, setCityFilter] = useState('');

  // Subscribe to store updates
  useEffect(() => {
    const unsub = opportunityStore.subscribe(setOpportunities);
    return () => unsub();
  }, []);

  // Update initial tab when props change
  useEffect(() => {
    if (initialType) setSelectedTab(initialType);
  }, [initialType]);

  // Persist bookmarks
  const toggleBookmark = (id: string) => {
    setBookmarks(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      try {
        localStorage.setItem('bio_nexa_bookmarked_opps', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Filter logic
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      // Must be approved for public view
      if (!opp.isApproved) return false;

      // Bookmarks filter
      if (showBookmarksOnly && !bookmarks.includes(opp.id)) return false;

      // Category Tab filter
      if (selectedTab === 'job') {
        if (opp.type !== 'job' && opp.type !== 'biotech_job') return false;
      } else if (selectedTab === 'biotech_jobs') {
        const isBiotech = opp.branches.some(b => b === 'biotechnology' || b === 'biotech');
        const isJob = opp.type === 'job' || opp.type === 'biotech_job';
        if (!isJob || !isBiotech) return false;
      } else if (selectedTab === 'internship') {
        if (opp.type !== 'internship') return false;
      } else if (selectedTab === 'workshop') {
        if (opp.type !== 'workshop') return false;
      } else if (selectedTab === 'course') {
        if (opp.type !== 'course') return false;
      }

      // Branch filter
      if (selectedBranch !== 'all') {
        if (!opp.branches.includes(selectedBranch)) return false;
      }

      // Work mode filter
      if (workMode !== 'all' && opp.workMode !== workMode) return false;

      // Experience filter
      if (experience !== 'all') {
        if (experience === 'freshers') {
          const expText = (opp.experience || '').toLowerCase();
          if (!expText.includes('fresh') && !expText.includes('0-') && !expText.includes('none')) return false;
        } else if (experience === 'experienced') {
          const expText = (opp.experience || '').toLowerCase();
          if (expText.includes('fresh') && !expText.includes('2') && !expText.includes('3')) return false;
        }
      }

      // Verified filter
      if (showOnlyVerified && !opp.isVerified) return false;

      // City filter
      if (cityFilter.trim() && !opp.location.toLowerCase().includes(cityFilter.toLowerCase().trim())) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = opp.title.toLowerCase().includes(query);
        const matchOrg = opp.organization.toLowerCase().includes(query);
        const matchLoc = opp.location.toLowerCase().includes(query);
        const matchDesc = opp.description.toLowerCase().includes(query);
        const matchSkills = (opp.skills || opp.requirements || []).some((r: string) => r.toLowerCase().includes(query));
        const matchBranches = opp.branches.some(b => b.toLowerCase().includes(query));

        if (!matchTitle && !matchOrg && !matchLoc && !matchDesc && !matchSkills && !matchBranches) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // default: recent
      const dateB = new Date(b.createdAt || b.postedDate || 0).getTime();
      const dateA = new Date(a.createdAt || a.postedDate || 0).getTime();
      return dateB - dateA;
    });
  }, [
    opportunities,
    bookmarks,
    showBookmarksOnly,
    selectedTab,
    selectedBranch,
    workMode,
    experience,
    showOnlyVerified,
    cityFilter,
    searchQuery,
    sortBy,
  ]);

  // Counts by tab
  const counts = useMemo(() => {
    const approved = opportunities.filter(o => o.isApproved);
    return {
      all: approved.length,
      job: approved.filter(o => o.type === 'job' || o.type === 'biotech_job').length,
      biotech_jobs: approved.filter(o => (o.type === 'job' || o.type === 'biotech_job') && o.branches.some(b => b === 'biotechnology' || b === 'biotech')).length,
      internship: approved.filter(o => o.type === 'internship').length,
      workshop: approved.filter(o => o.type === 'workshop').length,
      course: approved.filter(o => o.type === 'course').length,
      saved: bookmarks.length,
    };
  }, [opportunities, bookmarks]);

  // External search URLs for fallback
  const externalUrls = useMemo(() => {
    const branchName = selectedBranch === 'all' 
      ? 'Biotechnology & Life Sciences' 
      : EDUCATIONAL_BRANCHES.find(b => b.id === selectedBranch)?.name || 'Biotechnology';
    return generateExternalSearchUrls(branchName, cityFilter || undefined);
  }, [selectedBranch, cityFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedBranch('all');
    setWorkMode('all');
    setExperience('all');
    setCityFilter('');
    setShowOnlyVerified(false);
    setShowBookmarksOnly(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-sky-900 via-teal-900 to-slate-900 text-white p-8 md:p-12 shadow-2xl border border-sky-800/40">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold uppercase tracking-wider text-sky-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Automated Opportunities & Biotechnology Career Engine
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Connecting Science. <br />
              <span className="bg-linear-to-r from-sky-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                Creating Careers.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
              Explore authentic biotechnology vacancies, research fellowships, industrial internships, and hands-on laboratory workshops across 13 life science branches. 100% free access for students & researchers.
            </p>

            {/* Quick Metrics Bar */}
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-white">{counts.all}</div>
                <div className="text-sky-200 text-[11px] uppercase tracking-wider">Live Vacancies</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-white">13</div>
                <div className="text-teal-200 text-[11px] uppercase tracking-wider">Disciplines Covered</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-white">₹0</div>
                <div className="text-emerald-200 text-[11px] uppercase tracking-wider">Student Cost</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-white">6 hrs</div>
                <div className="text-amber-200 text-[11px] uppercase tracking-wider">Auto Sync Cycle</div>
              </div>
            </div>

            {/* CTA action buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-sky-600" />
                <span>Post Opportunity / Workshop (Free)</span>
              </button>

              <button
                onClick={() => {
                  setShowBookmarksOnly(!showBookmarksOnly);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold backdrop-blur-xs transition-all cursor-pointer ${
                  showBookmarksOnly 
                    ? 'bg-amber-400 text-slate-900 border-amber-400 font-bold'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                <span>Saved Listings ({counts.saved})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Tabs (Part 2: 5 Top Categories) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { id: 'all', label: 'All Opportunities', count: counts.all, icon: Layers },
            { id: 'job', label: 'Jobs', count: counts.job, icon: Briefcase },
            { id: 'biotech_jobs', label: 'Biotechnology Jobs', count: counts.biotech_jobs, icon: Sparkles },
            { id: 'internship', label: 'Internships', count: counts.internship, icon: GraduationCap },
            { id: 'workshop', label: 'Workshops', count: counts.workshop, icon: Award },
            { id: 'course', label: 'Courses', count: counts.course, icon: BookOpen },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedTab(tab.id);
                  setShowBookmarksOnly(false);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 13 Educational Branches Filter Chips (Horizontal Scrollable) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filter by Life Science Branch ({EDUCATIONAL_BRANCHES.length} Specializations)
            </span>
            {selectedBranch !== 'all' && (
              <button
                onClick={() => setSelectedBranch('all')}
                className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Reset Branch
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedBranch('all')}
              className={`shrink-0 text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedBranch === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              All Branches (13)
            </button>
            {EDUCATIONAL_BRANCHES.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                  selectedBranch === b.id
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-sky-400'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Fine Controls Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by job title, organization, skill, or role..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Location / City */}
            <div className="md:col-span-2 relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="City (e.g. Pune)"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Work Mode */}
            <div className="md:col-span-2">
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Work Modes</option>
                <option value="onsite">On-Site (Lab / Plant)</option>
                <option value="remote">Remote (WFH)</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            {/* Experience */}
            <div className="md:col-span-2">
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Experience Levels</option>
                <option value="freshers">Freshers / Entry Level</option>
                <option value="experienced">Experienced (2+ yrs)</option>
              </select>
            </div>

            {/* Sort */}
            <div className="md:col-span-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="recent">Recent</option>
                <option value="deadline">Deadline</option>
                <option value="title">A-Z</option>
              </select>
            </div>
          </div>

          {/* Secondary filter flags */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={showOnlyVerified}
                  onChange={(e) => setShowOnlyVerified(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Verified Sources Only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={showBookmarksOnly}
                  onChange={(e) => setShowBookmarksOnly(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Bookmarked Listings ({bookmarks.length})</span>
              </label>
            </div>

            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>

        {/* External Search Legal Fallbacks Bar (Part 6 & Part 17) */}
        <div className="p-4 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                Looking for more vacancies?
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                Direct External Search
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Launch pre-filtered searches for <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedBranch === 'all' ? 'Life Sciences' : EDUCATIONAL_BRANCHES.find(b => b.id === selectedBranch)?.name}</span> across official external job portals without violating terms of service.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={externalUrls.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1.5"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={externalUrls.naukri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Naukri</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={externalUrls.workindia}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1.5"
            >
              <span>WorkIndia</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={externalUrls.googleJobs}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Google Jobs</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Opportunity Listings Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Showing {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'Opportunity' : 'Opportunities'}
            </h2>
            <div className="text-xs text-slate-500">
              Updated from verified gazettes & organizers
            </div>
          </div>

          {filteredOpportunities.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600">
                <Briefcase className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Matching Opportunities Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No vacancies currently match all applied filters. Try selecting "All Branches", widening your search terms, or checking pre-filtered external job search portals.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl"
                >
                  Reset All Filters
                </button>
                <a
                  href={externalUrls.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl inline-flex items-center gap-1"
                >
                  <span>Search on LinkedIn</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOpportunities.map(opportunity => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onSelect={setSelectedOpportunity}
                  isBookmarked={bookmarks.includes(opportunity.id)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detailed Modal */}
        <OpportunityDetailModal
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          isBookmarked={selectedOpportunity ? bookmarks.includes(selectedOpportunity.id) : false}
          onBookmarkToggle={selectedOpportunity ? () => toggleBookmark(selectedOpportunity.id) : undefined}
        />

        {/* Submit Opportunity Modal */}
        <SubmitOpportunityModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
        />
      </div>
    </div>
  );
};
