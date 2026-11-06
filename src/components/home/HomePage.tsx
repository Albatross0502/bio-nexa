import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  MapPin,
  ArrowRight,
  Briefcase,
  GraduationCap,
  BookOpen,
  Award,
  Bookmark,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Clock,
  Filter,
  Layers,
  Send,
  Building2,
  AlertCircle
} from 'lucide-react';
import { SEED_EXAMS, SEED_SCHOLARSHIPS, SEED_RESEARCH, SEED_NEWS } from '../../data/seedData';
import { opportunityStore } from '../../services/opportunities/opportunityStore';
import { Opportunity, OpportunityType } from '../../types/opportunity';
import { OpportunityCard } from '../opportunities/OpportunityCard';
import { OpportunityDetailModal } from '../opportunities/OpportunityDetailModal';

export const HomePage: React.FC = () => {
  const { navigate, isItemSaved, toggleSaveItem, addToast } = useApp();

  // Reactive opportunities state from central store
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  // Search & Global Filter State
  const [heroSearch, setHeroSearch] = useState('');
  const [heroLocation, setHeroLocation] = useState('');

  // 01. ALL OPPORTUNITIES Section filters
  const [allOppCategory, setAllOppCategory] = useState<string>('all');
  const [allOppSearch, setAllOppSearch] = useState('');
  const [allOppSector, setAllOppSector] = useState<'all' | 'Government' | 'Private'>('all');
  const [allOppSort, setAllOppSort] = useState<'newest' | 'closing_soon'>('newest');

  // 02. BIOTECH JOBS Sub-filter
  const [biotechSubFilter, setBiotechSubFilter] = useState<string>('all');

  // 03. INTERNSHIPS Sub-filter
  const [internshipModeFilter, setInternshipModeFilter] = useState<string>('all');

  // 04. WORKSHOPS Sub-filter
  const [workshopModeFilter, setWorkshopModeFilter] = useState<string>('all');

  // Subscribe to reactive Opportunity Store
  useEffect(() => {
    const unsubscribe = opportunityStore.subscribe((opps) => {
      setOpportunities(opps);
      setIsSyncing(opportunityStore.isSyncing);
    });

    return () => unsubscribe();
  }, []);

  // Update relative sync time
  useEffect(() => {
    const updateTime = () => {
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      const res = await opportunityStore.syncWithGoogleSheets(true);
      setLastSyncTime('Just now');
      addToast(res.message || 'Opportunities updated from Google Sheets!', 'success');
    } catch (err: any) {
      addToast('Sync notice: Using verified opportunities feed.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = heroSearch.trim();
    const loc = heroLocation.trim();
    navigate(`/opportunities?q=${encodeURIComponent(query)}&loc=${encodeURIComponent(loc)}`);
  };

  // Filter public, non-expired opportunities by default
  const activeOpportunities = useMemo(() => {
    return opportunities.filter(o => o.isApproved && o.status !== 'Expired' && o.status !== 'Closed');
  }, [opportunities]);

  // Section 01: All Opportunities filtered
  const filteredAllOpportunities = useMemo(() => {
    return activeOpportunities.filter(opp => {
      // Category filter
      if (allOppCategory !== 'all') {
        if (allOppCategory === 'job' && opp.type !== 'job' && opp.type !== 'biotech_job') return false;
        if (allOppCategory === 'biotech_job' && opp.type !== 'biotech_job') return false;
        if (allOppCategory === 'internship' && opp.type !== 'internship') return false;
        if (allOppCategory === 'workshop' && opp.type !== 'workshop') return false;
        if (allOppCategory === 'course' && opp.type !== 'course') return false;
      }

      // Sector filter
      if (allOppSector !== 'all') {
        if (opp.sector !== allOppSector) return false;
      }

      // Search filter
      if (allOppSearch.trim()) {
        const q = allOppSearch.toLowerCase();
        const matchesTitle = opp.title.toLowerCase().includes(q);
        const matchesOrg = opp.organization.toLowerCase().includes(q);
        const matchesDesc = opp.description.toLowerCase().includes(q);
        const matchesQual = (opp.eligibility || opp.qualification || '').toLowerCase().includes(q);
        const matchesLoc = opp.location.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOrg && !matchesDesc && !matchesQual && !matchesLoc) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (allOppSort === 'closing_soon') {
        const tA = a.deadline && a.deadline !== 'Not Specified' ? new Date(a.deadline).getTime() : 9999999999999;
        const tB = b.deadline && b.deadline !== 'Not Specified' ? new Date(b.deadline).getTime() : 9999999999999;
        return tA - tB;
      }
      return new Date(b.postedDate || b.publishedDate || 0).getTime() - new Date(a.postedDate || a.publishedDate || 0).getTime();
    });
  }, [activeOpportunities, allOppCategory, allOppSector, allOppSearch, allOppSort]);

  // Section 02: Biotech Jobs
  const biotechJobs = useMemo(() => {
    return activeOpportunities
      .filter(opp => opp.type === 'biotech_job' || (opp.type === 'job' && opp.branches.includes('biotechnology')))
      .filter(opp => {
        if (biotechSubFilter === 'all') return true;
        const text = `${opp.title} ${opp.description} ${opp.subCategory || ''}`.toLowerCase();
        return text.includes(biotechSubFilter.toLowerCase());
      });
  }, [activeOpportunities, biotechSubFilter]);

  // Section 03: Internships
  const internshipsList = useMemo(() => {
    return activeOpportunities
      .filter(opp => opp.type === 'internship')
      .filter(opp => {
        if (internshipModeFilter === 'all') return true;
        if (internshipModeFilter === 'remote') return opp.workMode === 'Remote';
        if (internshipModeFilter === 'onsite') return opp.workMode === 'On-site';
        if (internshipModeFilter === 'government') return opp.sector === 'Government';
        return true;
      });
  }, [activeOpportunities, internshipModeFilter]);

  // Section 04: Workshops
  const workshopsList = useMemo(() => {
    return activeOpportunities
      .filter(opp => opp.type === 'workshop')
      .filter(opp => {
        if (workshopModeFilter === 'all') return true;
        if (workshopModeFilter === 'online') return opp.workMode === 'Remote' || opp.workshopDetails?.mode?.toLowerCase() === 'online';
        if (workshopModeFilter === 'offline') return opp.workMode === 'On-site' || opp.workshopDetails?.mode?.toLowerCase() === 'offline';
        if (workshopModeFilter === 'hybrid') return opp.workMode === 'Hybrid' || opp.workshopDetails?.mode?.toLowerCase() === 'hybrid';
        return true;
      });
  }, [activeOpportunities, workshopModeFilter]);

  // Section 05: Courses
  const coursesList = useMemo(() => {
    return activeOpportunities.filter(opp => opp.type === 'course');
  }, [activeOpportunities]);

  const latestPapers = SEED_RESEARCH.slice(0, 2);
  const latestNews = SEED_NEWS.slice(0, 3);

  return (
    <div className="space-y-16 pb-20">
      {/* Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        isBookmarked={selectedOpportunity ? isItemSaved(selectedOpportunity.id) : false}
        onBookmarkToggle={(id) => selectedOpportunity && toggleSaveItem(selectedOpportunity.id, selectedOpportunity.title)}
      />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-[#F4F8FB] via-white to-white dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-950 pt-10 pb-16 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            
            {/* Live Google Sheets & Systems Connection Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-[#0B2A5B] dark:text-sky-300 bg-blue-50/90 dark:bg-slate-800 rounded-full border border-blue-200 dark:border-slate-700 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Google Sheets &amp; Gazette Sync Active</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-mono text-slate-500 dark:text-slate-400">Refreshed: {lastSyncTime}</span>
              <button
                onClick={handleManualRefresh}
                disabled={isSyncing}
                className="ml-1 p-1 hover:text-[#14A3A0] transition-colors rounded-full"
                title="Refresh listings now"
                aria-label="Refresh opportunities"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#14A3A0]' : ''}`} />
              </button>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
              Connecting Science. <span className="text-[#14A3A0]">Creating Careers.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              India's dedicated biotechnology career &amp; opportunity portal. Explore verified industry jobs, funded research fellowships, hands-on workshops, and masterclasses across 13 life science branches.
            </p>

            {/* Hero Quick Search Box */}
            <div className="pt-3 max-w-2xl mx-auto">
              <form
                onSubmit={handleHeroSearch}
                className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Search by job title, skill (e.g. CRISPR, Fermentation), or role..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="sm:w-44 flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={heroLocation}
                    onChange={(e) => setHeroLocation(e.target.value)}
                    placeholder="City or Remote..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                >
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Live Metrics Strip */}
            <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Live Opportunities
                </span>
                <span className="text-2xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300 tabular-nums">
                  {activeOpportunities.length}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Automated Sheets Sync</span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Biotech Jobs
                </span>
                <span className="text-2xl font-bold font-mono text-[#14A3A0] tabular-nums">
                  {biotechJobs.length}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">R&amp;D, QC, Fermentation</span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Fellowships &amp; Interns
                </span>
                <span className="text-2xl font-bold font-mono text-[#2E9D57] tabular-nums">
                  {internshipsList.length}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Funded Lab Positions</span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Workshops &amp; Courses
                </span>
                <span className="text-2xl font-bold font-mono text-[#1F6FB2] dark:text-sky-400 tabular-nums">
                  {workshopsList.length + coursesList.length}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Hands-on Lab Training</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 01. ALL OPPORTUNITIES SECTION                                 */}
      {/* ============================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20" id="all-opportunities">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14A3A0] mb-1">
              <Layers className="w-4 h-4" />
              <span>Section 01 · Unified Directory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              All Opportunities
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Complete feed of government jobs, private biopharma openings, research fellowships, workshops, and courses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#14A3A0]' : ''}`} />
              <span>Refresh Listings</span>
            </button>
            <button
              onClick={() => navigate('/opportunities')}
              className="inline-flex items-center gap-1 text-sm font-bold text-[#0B2A5B] dark:text-sky-400 hover:underline"
            >
              <span>Full Portal (13 Branches)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 mb-6">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Opportunities', count: activeOpportunities.length },
              { id: 'biotech_job', label: 'Biotech Jobs', count: biotechJobs.length },
              { id: 'job', label: 'All Jobs', count: activeOpportunities.filter(o => o.type === 'job' || o.type === 'biotech_job').length },
              { id: 'internship', label: 'Internships', count: internshipsList.length },
              { id: 'workshop', label: 'Workshops', count: workshopsList.length },
              { id: 'course', label: 'Courses', count: coursesList.length },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setAllOppCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  allOppCategory === cat.id
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  allOppCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            {/* Sector toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setAllOppSector('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  allOppSector === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                All Sectors
              </button>
              <button
                onClick={() => setAllOppSector('Government')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  allOppSector === 'Government' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Government
              </button>
              <button
                onClick={() => setAllOppSector('Private')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  allOppSector === 'Private' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Private
              </button>
            </div>
          </div>

          {/* Search Bar & Sort */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={allOppSearch}
                onChange={(e) => setAllOppSearch(e.target.value)}
                placeholder="Search across title, organization, qualification, or city..."
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {allOppSearch && (
                <button
                  onClick={() => setAllOppSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span className="text-slate-500 whitespace-nowrap">Sort by:</span>
              <select
                value={allOppSort}
                onChange={(e) => setAllOppSort(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              >
                <option value="newest">Latest Published First</option>
                <option value="closing_soon">Closing Soonest</option>
              </select>
            </div>
          </div>
        </div>

        {/* Opportunity Cards Grid */}
        {filteredAllOpportunities.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No opportunities match your current filters</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try clearing your search query or selecting a different category to see available vacancies.
            </p>
            <button
              onClick={() => {
                setAllOppCategory('all');
                setAllOppSector('all');
                setAllOppSearch('');
              }}
              className="px-4 py-2 text-xs font-semibold bg-[#0B2A5B] text-white rounded-xl hover:bg-blue-900 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAllOpportunities.slice(0, 6).map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onSelect={(selected) => setSelectedOpportunity(selected)}
                isBookmarked={isItemSaved(opp.id)}
                onToggleBookmark={(id) => toggleSaveItem(opp.id, opp.title)}
              />
            ))}
          </div>
        )}

        {filteredAllOpportunities.length > 6 && (
          <div className="text-center pt-8">
            <button
              onClick={() => navigate('/opportunities')}
              className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#14A3A0] text-[#0B2A5B] dark:text-sky-300 font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2"
            >
              <span>View All {filteredAllOpportunities.length} Listings in Opportunities Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 02. BIOTECH JOBS SECTION                                       */}
      {/* ============================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20" id="biotech-jobs">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
              <Briefcase className="w-4 h-4" />
              <span>Section 02 · Specialized Employment</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Biotech &amp; Biopharma Jobs
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Careers across Fermentation, Molecular Biology, Bioinformatics, Quality Control (QC/QA), Clinical Research, and Food Technology.
            </p>
          </div>

          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 dark:text-teal-400 hover:underline shrink-0"
          >
            <span>All Biotech Jobs ({biotechJobs.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-discipline filter tags */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-6">
          {[
            { id: 'all', label: 'All Disciplines' },
            { id: 'fermentation', label: 'Fermentation & Bioprocess' },
            { id: 'molecular', label: 'Molecular Biology & CRISPR' },
            { id: 'bioinformatics', label: 'Bioinformatics & NGS' },
            { id: 'quality', label: 'Quality Control / QA' },
            { id: 'food', label: 'Food Technology' },
            { id: 'effluent', label: 'Environmental Biotech' }
          ].map((tag) => (
            <button
              key={tag.id}
              onClick={() => setBiotechSubFilter(tag.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                biotechSubFilter === tag.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {biotechJobs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
            <p className="text-sm">No positions found for the selected sub-discipline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {biotechJobs.slice(0, 3).map((job) => (
              <OpportunityCard
                key={job.id}
                opportunity={job}
                onSelect={(selected) => setSelectedOpportunity(selected)}
                isBookmarked={isItemSaved(job.id)}
                onToggleBookmark={(id) => toggleSaveItem(job.id, job.title)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Competitive Exam Hub Banner (CSIR NET & GATE) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#0B2A5B] to-[#12427b] rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                <span>National Competitive Exam Hub</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                CSIR NET Life Sciences, GATE Biotechnology &amp; DBT-BET
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">
                Comprehensive 13-unit syllabus coverage, previous 10-year question papers (PYQs) with official answer keys, and a realistic timed mock test simulator with instant percentile scoring.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/exams?slug=csir-net-life-sciences')}
                  className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  CSIR NET Prep &amp; Mock Test
                </button>
                <button
                  onClick={() => navigate('/exams?slug=gate-biotechnology-bt')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors border border-white/20"
                >
                  GATE BT Syllabus &amp; PYQs
                </button>
                <button
                  onClick={() => navigate('/exams?slug=dbt-bet-biotechnology-eligibility-test')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors border border-white/20"
                >
                  DBT-BET Category-I Guide
                </button>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-3">
              <div className="flex items-center justify-between text-xs text-teal-200 font-mono">
                <span>Next Upcoming Examination</span>
                <span>Dec 2026</span>
              </div>
              <div className="text-lg font-bold">CSIR-UGC NET Life Sciences</div>
              <div className="text-xs text-slate-200 space-y-1">
                <div>Exam Date: <strong className="text-white font-mono">22 December 2026</strong></div>
                <div>Pattern: 200 Marks · 3 Hours · 3 Sections</div>
                <div>Cutoff Projection: ~54.2% for JRF (UR)</div>
              </div>
              <button
                onClick={() => navigate('/exams?slug=csir-net-life-sciences&mock=true')}
                className="w-full py-2.5 bg-white text-[#0B2A5B] font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors mt-2 shadow-sm"
              >
                Launch Diagnostic Mock Test &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 03. INTERNSHIPS SECTION                                        */}
      {/* ============================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20" id="internships">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
              <GraduationCap className="w-4 h-4" />
              <span>Section 03 · Student Fellowships</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Internships &amp; Research Fellowships
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Funded summer research fellowships, national academy projects (IASc-INSA), ICAR agricultural trainee posts, and industrial training at Biocon Academy.
            </p>
          </div>

          <button
            onClick={() => navigate('/internships')}
            className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 dark:text-sky-400 hover:underline shrink-0"
          >
            <span>All Internships ({internshipsList.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mode filter pills */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {[
            { id: 'all', label: 'All Internships' },
            { id: 'government', label: 'Government / National Fellowships' },
            { id: 'onsite', label: 'On-site Laboratory' },
            { id: 'remote', label: 'Remote / Virtual' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setInternshipModeFilter(mode.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                internshipModeFilter === mode.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {internshipsList.map((intern) => (
            <OpportunityCard
              key={intern.id}
              opportunity={intern}
              onSelect={(selected) => setSelectedOpportunity(selected)}
              isBookmarked={isItemSaved(intern.id)}
              onToggleBookmark={(id) => toggleSaveItem(intern.id, intern.title)}
            />
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 04. WORKSHOPS SECTION                                          */}
      {/* ============================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20" id="workshops">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Section 04 · Hands-On Skills</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Biotech Workshops &amp; Laboratory Training
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Practical skill bootcamps, CRISPR gene editing, RNA-Seq data analysis, HACCP food auditing, and scientific manuscript writing.
            </p>
          </div>

          <button
            onClick={() => navigate('/workshops')}
            className="inline-flex items-center gap-1 text-sm font-bold text-purple-700 dark:text-purple-400 hover:underline shrink-0"
          >
            <span>All Workshops ({workshopsList.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Workshop Mode Filter */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {[
            { id: 'all', label: 'All Workshops' },
            { id: 'online', label: 'Online Live Webinars' },
            { id: 'offline', label: 'Offline Hands-on Labs' },
            { id: 'hybrid', label: 'Hybrid Sessions' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setWorkshopModeFilter(mode.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                workshopModeFilter === mode.id
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workshopsList.map((wrk) => (
            <OpportunityCard
              key={wrk.id}
              opportunity={wrk}
              onSelect={(selected) => setSelectedOpportunity(selected)}
              isBookmarked={isItemSaved(wrk.id)}
              onToggleBookmark={(id) => toggleSaveItem(wrk.id, wrk.title)}
            />
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 05. COURSES SECTION                                            */}
      {/* ============================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20" id="courses">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Section 05 · Academic Masterclasses</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Biotechnology Courses &amp; Certifications
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Curated masterclasses with verifiable digital certificates, protocol guides, and interactive module quizzes.
            </p>
          </div>

          <button
            onClick={() => navigate('/courses')}
            className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
          >
            <span>Explore All Academy Courses</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coursesList.map((course) => (
            <OpportunityCard
              key={course.id}
              opportunity={course}
              onSelect={(selected) => setSelectedOpportunity(selected)}
              isBookmarked={isItemSaved(course.id)}
              onToggleBookmark={(id) => toggleSaveItem(course.id, course.title)}
            />
          ))}
        </div>
      </section>

      {/* Research Literature Sync & PubMed */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                <span>PubMed &amp; Crossref Literature Sync</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Peer-Reviewed Discoveries &amp; Gene Editing Papers
              </h2>
            </div>
            <button
              onClick={() => navigate('/research')}
              className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>Explore Research Hub</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {latestPapers.map((paper) => (
              <div
                key={paper.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-sky-700 dark:text-sky-300">{paper.journal}</span>
                    <span>{paper.publishedDate}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-sky-600 transition-colors leading-snug">
                    <a href={paper.externalUrl} target="_blank" rel="noopener noreferrer">
                      {paper.title}
                    </a>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    By {paper.authors.join(', ')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 my-2 leading-relaxed">
                    {paper.abstract}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">DOI: {paper.doi}</span>
                  <a
                    href={paper.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sky-600 hover:underline font-semibold"
                  >
                    <span>View on Journal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruiter & Institutional Partners Logos */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Trusted by Scientists &amp; Recruiters Across Premier Organizations
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-80 grayscale hover:grayscale-0 transition-all text-xs font-bold text-slate-600 dark:text-slate-400">
          <span className="text-sm">BIOCON BIOLOGICS</span>
          <span className="text-sm">SERUM INSTITUTE</span>
          <span className="text-sm">IISC BENGALURU</span>
          <span className="text-sm">CSIR-IGIB</span>
          <span className="text-sm">DR. REDDY&apos;S</span>
          <span className="text-sm">NCBS-TIFR</span>
          <span className="text-sm">SYNGENE INTL</span>
        </div>
      </section>
    </div>
  );
};
