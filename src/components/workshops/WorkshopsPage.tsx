import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Layers,
  GraduationCap,
  Briefcase,
  BookOpen
} from 'lucide-react';
import { WorkshopCard, UnifiedWorkshop } from './WorkshopCard';
import { WorkshopDetailModal } from './WorkshopDetailModal';
import { useApp } from '../../context/AppContext';
import { opportunityStore } from '../../services/opportunities/opportunityStore';
import {
  filterWorkshops,
  getDefaultWorkshopImageForTitle,
  mapApiWorkshopToUnified,
  normalizeWorkshopFormat,
  normalizeWorkshopStatus
} from '../../services/workshops/workshopHelpers';
import type { Opportunity } from '../../types/opportunity';

export const WorkshopsPage: React.FC = () => {
  const { navigate, isItemSaved, toggleSaveItem } = useApp();

  const [workshops, setWorkshops] = useState<UnifiedWorkshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'Online' | 'Offline' | 'Hybrid'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [selectedWorkshop, setSelectedWorkshop] = useState<UnifiedWorkshop | null>(null);

  // Load workshops from API / SQLite database with fallback to opportunity store
  useEffect(() => {
    let isMounted = true;

    async function loadWorkshops() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/workshops');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.workshops)) {
            if (isMounted) {
              setWorkshops(data.workshops.map(mapApiWorkshopToUnified));
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Backend workshops fetch failed, using reactive store fallback:', err);
      }

      // Fallback to OpportunityStore
      const oppWorkshops = opportunityStore
        .getAllOpportunities()
        .filter((o: Opportunity) => o.type === 'workshop');
      if (isMounted) {
        const mapped: UnifiedWorkshop[] = oppWorkshops.map((w: Opportunity) => ({
          id: w.id,
          title: w.title,
          description: w.description,
          instructor: w.workshopDetails?.speakerOrTrainer || w.organization || 'Senior Faculty Lead',
          organizer: w.organization,
          date: w.workshopDetails?.dates?.split(' to ')[0] || w.postedDate || '2026-12-01',
          time: '09:30 AM - 04:30 PM IST',
          duration: w.workshopDetails?.duration || '3 Days Intensive',
          format: normalizeWorkshopFormat(w.workshopDetails?.mode || w.workMode),
          venue: w.location || 'Online Live Portal',
          registrationDeadline: w.deadline || '2026-12-05',
          registrationUrl: w.workshopDetails?.registrationUrl || w.applicationUrl,
          availability: w.status === 'Closed' ? 'Closed' : 'Open',
          status: w.status === 'Closed' ? 'completed' : 'upcoming',
          fees: w.workshopDetails?.fees || w.fees || '₹1,500 Subsidized',
          imageUrl: getDefaultWorkshopImageForTitle(w.title),
          featured: Boolean(w.featured),
          skillsCovered: w.skills || ['Hands-on Wet Lab', 'Protocol Optimization']
        }));
        setWorkshops(mapped);
        setIsLoading(false);
      }
    }

    loadWorkshops();

    return () => {
      isMounted = false;
    };
  }, []);

  // Support deep link ?id=<workshopId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && workshops.length > 0) {
      const match = workshops.find((w) => w.id.toLowerCase() === idParam.toLowerCase());
      if (match) {
        setSelectedWorkshop(match);
      }
    }
  }, [workshops]);

  // Filtered workshops
  const filteredWorkshops = useMemo(() => {
    return filterWorkshops(workshops, {
      format: formatFilter,
      status: statusFilter,
      availability: availabilityFilter,
      search: searchQuery
    });
  }, [workshops, formatFilter, statusFilter, availabilityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const upcoming = workshops.filter((w) => normalizeWorkshopStatus(w.status) === 'upcoming').length;
    const online = workshops.filter((w) => normalizeWorkshopFormat(w.format || w.workMode) === 'Online').length;
    const offline = workshops.filter((w) => normalizeWorkshopFormat(w.format || w.workMode) === 'Offline').length;
    return { total: workshops.length, upcoming, online, offline };
  }, [workshops]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb / Opportunity Categories Switcher */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          {[
            { label: 'All Opportunities', path: '/opportunities', icon: Layers },
            { label: 'Biotechnology Jobs', path: '/jobs', icon: Briefcase },
            { label: 'Internships', path: '/internships', icon: GraduationCap },
            { label: 'Workshops', path: '/workshops', active: true, icon: Calendar },
            { label: 'Courses', path: '/courses', icon: BookOpen }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  item.active
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B2A5B] via-[#12427b] to-[#14A3A0] text-white p-8 sm:p-10 shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-teal-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>National Biotechnology Skill Bootcamps &amp; Hands-on Training</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Biotech Workshops &amp; Laboratory Training
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Accelerate your research career with verified practical wet-lab and computational biology training programs organized by India&apos;s premier institutions (CSIR-IGIB, IISc, Biocon Academy, DBT-BIRAC, NCBS, RGCB).
            </p>

            {/* Quick Metrics */}
            <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-teal-100">
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.total}</strong>
                <span>Curated Programs</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.upcoming}</strong>
                <span>Upcoming Sessions</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.offline}</strong>
                <span>In-Person Wet Labs</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.online}</strong>
                <span>Live Virtual Bootcamps</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          {/* Top Row: Search Input */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                aria-label="Search workshops"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic (CRISPR, RNA-Seq, HACCP), instructor, or institution..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick reset */}
            {(formatFilter !== 'all' || statusFilter !== 'all' || availabilityFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFormatFilter('all');
                  setStatusFilter('all');
                  setAvailabilityFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 whitespace-nowrap px-3 py-2 cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>

          {/* Bottom Row: Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {/* Format Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Format:</span>
              </span>
              {[
                { id: 'all', label: 'All Formats' },
                { id: 'Online', label: 'Online Live' },
                { id: 'Offline', label: 'Offline Wet Lab' },
                { id: 'Hybrid', label: 'Hybrid' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatFilter(f.id as 'all' | 'Online' | 'Offline' | 'Hybrid')}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                    formatFilter === f.id
                      ? 'bg-[#0B2A5B] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-semibold mr-1">Status:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'ongoing', label: 'Ongoing' },
                { id: 'completed', label: 'Completed' }
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id as 'all' | 'upcoming' | 'ongoing' | 'completed')}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                    statusFilter === s.id
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Availability dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="workshop-availability-filter" className="text-slate-400 font-semibold">
                Seats:
              </label>
              <select
                id="workshop-availability-filter"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none font-medium focus:outline-none"
              >
                <option value="all">All Availability</option>
                <option value="open">Open Registration</option>
                <option value="fast">Filling Fast</option>
                <option value="waitlist">Waitlist Available</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Counter & Credibility Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredWorkshops.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{workshops.length}</strong> biotechnology workshops
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 px-3 py-1 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>BIO-INEXA verified: All registrations link directly to authentic organizers.</span>
          </div>
        </div>

        {/* Workshops Cards Grid */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 mx-auto border-3 border-[#0B2A5B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading verified workshop sessions...</p>
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-slate-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Workshops Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No workshop matches your active search or filters. Try adjusting your query or resetting your criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setFormatFilter('all');
                setStatusFilter('all');
                setAvailabilityFilter('all');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-2 bg-[#0B2A5B] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkshops.map((ws) => (
              <WorkshopCard
                key={ws.id}
                workshop={ws}
                onSelectDetails={(selected) => setSelectedWorkshop(selected)}
                isBookmarked={isItemSaved(ws.id)}
                onToggleBookmark={(id, title) => toggleSaveItem(id, title)}
              />
            ))}
          </div>
        )}

        {/* Shared Detailed Workshop Modal */}
        <WorkshopDetailModal
          workshop={selectedWorkshop}
          onClose={() => setSelectedWorkshop(null)}
        />
      </div>
    </div>
  );
};
