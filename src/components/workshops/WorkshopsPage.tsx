import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Sparkles,
  Building,
  Globe,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Layers,
  GraduationCap,
  Briefcase,
  BookOpen,
  X,
  AlertCircle
} from 'lucide-react';
import { WorkshopCard, UnifiedWorkshop } from './WorkshopCard';
import { useApp } from '../../context/AppContext';
import { opportunityStore } from '../../services/opportunities/opportunityStore';

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
          if (data.success && Array.isArray(data.workshops) && data.workshops.length > 0) {
            if (isMounted) {
              setWorkshops(data.workshops);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Backend workshops fetch failed, using reactive store fallback:', err);
      }

      // Fallback to OpportunityStore
      const oppWorkshops = opportunityStore.getAll().filter(o => o.type === 'workshop');
      if (isMounted) {
        const mapped: UnifiedWorkshop[] = oppWorkshops.map(w => ({
          id: w.id,
          title: w.title,
          description: w.description,
          instructor: w.organization || 'Senior Faculty Lead',
          organizer: w.organization,
          date: w.workshopDetails?.dates?.split(' to ')[0] || w.postedDate || '2026-12-01',
          time: '09:30 AM - 04:30 PM IST',
          duration: w.workshopDetails?.duration || '3 Days Intensive',
          format: (w.workMode === 'In-Person' || w.workMode === 'On-site' ? 'Offline' :
                  w.workMode === 'Hybrid' ? 'Hybrid' : 'Online'),
          venue: w.location || 'Online Live Portal',
          registrationDeadline: w.deadline || '2026-12-05',
          registrationUrl: w.workshopDetails?.registrationUrl || w.applicationUrl,
          availability: 'Open (30/40 Seats)',
          status: 'upcoming',
          fees: w.workshopDetails?.fees || '₹1,500 Subsidized',
          imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
          featured: true,
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

  // Filtered workshops
  const filteredWorkshops = useMemo(() => {
    return workshops.filter((w) => {
      // Format filter
      if (formatFilter !== 'all') {
        const currentFormat = w.format || (w.workMode === 'In-Person' || w.workMode === 'Offline' ? 'Offline' : w.workMode === 'Hybrid' ? 'Hybrid' : 'Online');
        if (currentFormat !== formatFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const currentStatus = (w.status?.toLowerCase() || 'upcoming');
        if (currentStatus !== statusFilter) return false;
      }

      // Availability filter
      if (availabilityFilter !== 'all') {
        const currentAvail = (w.availability?.toLowerCase() || 'open');
        if (!currentAvail.includes(availabilityFilter.toLowerCase())) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (w.title || w.name || '').toLowerCase().includes(q);
        const matchesDesc = (w.description || '').toLowerCase().includes(q);
        const matchesInstructor = (w.instructor || w.organizer || '').toLowerCase().includes(q);
        const matchesVenue = (w.venue || w.location || '').toLowerCase().includes(q);
        const matchesSkills = (w.skillsCovered || []).some(s => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesInstructor && !matchesVenue && !matchesSkills) {
          return false;
        }
      }

      return true;
    });
  }, [workshops, formatFilter, statusFilter, availabilityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const upcoming = workshops.filter(w => (w.status?.toLowerCase() || 'upcoming') === 'upcoming').length;
    const online = workshops.filter(w => (w.format || w.workMode) === 'Online').length;
    const offline = workshops.filter(w => (w.format || w.workMode) === 'Offline' || (w.workMode === 'In-Person')).length;
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
            { label: 'Courses', path: '/courses', icon: BookOpen },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
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
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-teal-100">
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.total}</strong>
                <span>Curated Programs</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.upcoming}</strong>
                <span>Open for Registration</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.offline}</strong>
                <span>In-Person Wet Labs</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-teal-300/60" />
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic (CRISPR, RNA-Seq, HACCP), instructor, or institution..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
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
                onClick={() => {
                  setFormatFilter('all');
                  setStatusFilter('all');
                  setAvailabilityFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 whitespace-nowrap px-3 py-2"
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
                { id: 'Hybrid', label: 'Hybrid' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormatFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
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
                { id: 'completed', label: 'Completed' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
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
              <span className="text-slate-400 font-semibold">Seats:</span>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none font-medium focus:outline-none"
              >
                <option value="all">All Availability</option>
                <option value="open">Open Registration</option>
                <option value="fast">Filling Fast</option>
                <option value="waitlist">Waitlist Available</option>
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
            <span>BIO-NEXA verified: All registrations link directly to authentic organizers.</span>
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
              onClick={() => {
                setFormatFilter('all');
                setStatusFilter('all');
                setAvailabilityFilter('all');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-2 bg-[#0B2A5B] text-white rounded-xl text-xs font-bold"
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

        {/* Detailed Workshop Modal */}
        {selectedWorkshop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto text-xs">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
                    {selectedWorkshop.format || 'Online'} Workshop · {selectedWorkshop.organizer || 'BIO-NEXA Academy'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                    {selectedWorkshop.title || selectedWorkshop.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedWorkshop(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Key Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Date</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{selectedWorkshop.date}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Session Time</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{selectedWorkshop.time || '09:30 AM - 04:30 PM'}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{selectedWorkshop.duration || '2 Days'}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Registration Fee</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{selectedWorkshop.fees || 'Free'}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Curriculum &amp; Program Scope</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                  {selectedWorkshop.description}
                </p>
              </div>

              {/* Instructor & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#14A3A0]" />
                    <span>Lead Instructor / Faculty</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs">{selectedWorkshop.instructor}</p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-rose-500" />
                    <span>Venue &amp; Meeting Logistics</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs">{selectedWorkshop.venue}</p>
                </div>
              </div>

              {/* Skills Covered */}
              {selectedWorkshop.skillsCovered && selectedWorkshop.skillsCovered.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Hands-on Competencies Taught</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorkshop.skillsCovered.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Registration Deadline Warning */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    Registration Deadline: {selectedWorkshop.registrationDeadline || 'Batch closes once filled'}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">
                    Registrations are handled directly by the hosting institution. BIO-NEXA provides independent discovery and does not charge intermediary fees.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedWorkshop(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold"
                >
                  Close
                </button>
                <a
                  href={selectedWorkshop.registrationUrl || selectedWorkshop.registrationLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#0B2A5B] to-[#1F6FB2] hover:from-blue-900 hover:to-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <span>Go to Official Registration Portal</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
