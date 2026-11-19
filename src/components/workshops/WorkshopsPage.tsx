import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  Layers,
  GraduationCap,
  Briefcase,
  BookOpen,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { WorkshopCard, UnifiedWorkshop } from './WorkshopCard';
import { WorkshopDetailModal } from './WorkshopDetailModal';
import { useApp } from '../../context/AppContext';
import { bionexaApi } from '../../services/api/bionexaApiClient';
import {
  WORKSHOP_CATEGORIES,
  extractWorkshopCategories,
  filterWorkshops,
  isWorkshopExpired,
  mapApiWorkshopToUnified,
  normalizeWorkshopFormat,
  normalizeWorkshopStatus,
  validateWorkshopRegistrationUrl
} from '../../services/workshops/workshopHelpers';

export const WorkshopsPage: React.FC = () => {
  const { navigate, isItemSaved, toggleSaveItem, addToast } = useApp();

  const [workshops, setWorkshops] = useState<UnifiedWorkshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'Online' | 'Offline' | 'Hybrid'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [includeExpired, setIncludeExpired] = useState<boolean>(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState<UnifiedWorkshop | null>(null);

  // Submit Workshop modal state (queues as pending for admin approval)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [submitUrlDraft, setSubmitUrlDraft] = useState('');

  const loadWorkshops = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const apiWorkshops = await bionexaApi.getWorkshops({ limit: 100 });
      setWorkshops(apiWorkshops.map(mapApiWorkshopToUnified));
    } catch (err: any) {
      setWorkshops([]);
      setLoadError(err?.message || 'Unable to retrieve workshops from the database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkshops();
  }, [loadWorkshops]);

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

  const availableCategories = useMemo(() => extractWorkshopCategories(workshops), [workshops]);

  // Filtered workshops
  const filteredWorkshops = useMemo(() => {
    return filterWorkshops(workshops, {
      format: formatFilter,
      status: statusFilter,
      availability: availabilityFilter,
      category: categoryFilter,
      includeExpired,
      search: searchQuery
    });
  }, [workshops, formatFilter, statusFilter, availabilityFilter, categoryFilter, includeExpired, searchQuery]);

  // Statistics derived strictly from saved database records
  const stats = useMemo(() => {
    const active = workshops.filter((w) => !isWorkshopExpired(w)).length;
    const online = workshops.filter((w) => normalizeWorkshopFormat(w.format || w.workMode) === 'Online').length;
    const offline = workshops.filter((w) => normalizeWorkshopFormat(w.format || w.workMode) === 'Offline').length;
    const expired = workshops.filter((w) => isWorkshopExpired(w) || normalizeWorkshopStatus(w.status) === 'completed').length;
    return { total: workshops.length, active, online, offline, expired };
  }, [workshops]);

  const hasActiveFilters =
    formatFilter !== 'all' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    availabilityFilter !== 'all' ||
    !includeExpired ||
    Boolean(searchQuery);

  const resetAllFilters = () => {
    setFormatFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setAvailabilityFilter('all');
    setIncludeExpired(true);
    setSearchQuery('');
  };

  const handleWorkshopSubmission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccessMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const title = String(formData.get('title') || '').trim();
    const organizer = String(formData.get('organizer') || '').trim();
    const instructor = String(formData.get('instructor') || '').trim();
    const category = String(formData.get('category') || '').trim();
    const format = normalizeWorkshopFormat(String(formData.get('format') || 'Online'));
    const venue = String(formData.get('venue') || '').trim();
    const date = String(formData.get('date') || '').trim();
    const time = String(formData.get('time') || '').trim();
    const duration = String(formData.get('duration') || '').trim();
    const registrationDeadline = String(formData.get('registrationDeadline') || '').trim();
    const registrationUrl = String(formData.get('registrationUrl') || '').trim();
    const fees = String(formData.get('fees') || '').trim();
    const capacityRaw = String(formData.get('capacity') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const skillsRaw = String(formData.get('skillsCovered') || '').trim();

    const urlCheck = validateWorkshopRegistrationUrl(registrationUrl);
    if (!urlCheck.valid) {
      setSubmitError(urlCheck.reason || 'Please provide a valid official registration URL.');
      return;
    }

    let capacity: number | null = null;
    if (capacityRaw) {
      const parsedCap = Number(capacityRaw);
      if (!Number.isFinite(parsedCap) || parsedCap <= 0) {
        setSubmitError('Capacity must be a positive whole number when provided.');
        return;
      }
      capacity = Math.floor(parsedCap);
    }

    setIsSubmitting(true);
    try {
      const res = await bionexaApi.submitWorkshop({
        title,
        organizer,
        instructor,
        category,
        format,
        venue,
        date,
        time,
        duration,
        registrationDeadline,
        registrationUrl: urlCheck.normalizedUrl || registrationUrl,
        fees,
        capacity,
        description,
        skillsCovered: skillsRaw
          ? skillsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      });
      setSubmitSuccessMsg(
        res.message ||
          'Workshop submitted for editorial review. It will appear publicly only after administrator approval.'
      );
      addToast('Workshop submitted for administrator review.', 'success');
      form.reset();
      setSubmitUrlDraft('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to submit workshop. Please check all required fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const urlDraftCheck = submitUrlDraft.trim() ? validateWorkshopRegistrationUrl(submitUrlDraft) : null;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb / Opportunity Categories Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setSubmitSuccessMsg(null);
              setSubmitUrlDraft('');
              setIsSubmitModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#14A3A0] hover:bg-teal-600 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Workshop</span>
          </button>
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
                <span>Verified Programs</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-teal-300/60" />
              <div>
                <strong className="text-white text-base font-mono font-bold mr-1">{stats.active}</strong>
                <span>Active Sessions</span>
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
                placeholder="Search by topic (CRISPR, RNA-Seq, HACCP), organizer, category, or venue..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick reset */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 whitespace-nowrap px-3 py-2 cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>

          {/* Bottom Row: Filter Pills & Category/Seats Controls */}
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

            {/* Category, Availability & Expired toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {availableCategories.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="workshop-category-filter" className="text-slate-400 font-semibold">
                    Category:
                  </label>
                  <select
                    id="workshop-category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none font-medium focus:outline-none max-w-[210px]"
                  >
                    <option value="all">All Categories</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#0B2A5B] cursor-pointer"
                />
                <span>Show expired ({stats.expired})</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results Counter & Credibility Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredWorkshops.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{workshops.length}</strong> verified biotechnology workshops
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 px-3 py-1 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>All workshop registrations redirect directly to validated organizer portals.</span>
          </div>
        </div>

        {/* Workshops Cards Grid */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 mx-auto border-3 border-[#0B2A5B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading verified workshop sessions from database...</p>
          </div>
        ) : loadError ? (
          <div className="p-14 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Unable to Load Workshops</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={loadWorkshops}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B2A5B] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Database Sync</span>
            </button>
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-slate-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Workshops Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No saved workshop matches your active search or filters. Try adjusting your query or resetting your criteria.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 px-4 py-2 bg-[#0B2A5B] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
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

        {/* Submit Workshop Modal */}
        {isSubmitModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setIsSubmitModalOpen(false)}
          >
            <div
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-h-[92vh] overflow-y-auto space-y-4 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                    Institutional Submission
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Submit a Biotechnology Workshop for Review
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close submit workshop modal"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submitSuccessMsg ? (
                <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3 text-center">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Submission Received — Pending Editorial Approval
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed max-w-md mx-auto">
                    {submitSuccessMsg}
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-xl">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Status: Pending Verification by BIO-INEXA Administrators</span>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="px-5 py-2 bg-[#0B2A5B] text-white rounded-xl font-bold cursor-pointer"
                    >
                      Return to Workshops
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWorkshopSubmission} className="space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    All submitted workshops are saved in <strong>Pending Review</strong> status and will only appear on the public directory after administrator verification of the organizer and official registration portal.
                  </div>

                  {submitError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Title *</label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="e.g. National Workshop on Single-Cell RNA-Seq Data Analysis"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Organizer / Host Institution *</label>
                      <input
                        type="text"
                        name="organizer"
                        required
                        placeholder="e.g. CSIR-IGIB, IISc Bengaluru, NCBS-TIFR"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Lead Instructor (Optional)</label>
                      <input
                        type="text"
                        name="instructor"
                        placeholder="e.g. Dr. Ananya Sen, Principal Scientist"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Category *</label>
                      <select
                        name="category"
                        required
                        defaultValue=""
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        <option value="" disabled>
                          Select category...
                        </option>
                        {WORKSHOP_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Delivery Format *</label>
                      <select
                        name="format"
                        defaultValue="Online"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-semibold"
                      >
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Date *</label>
                      <input
                        type="date"
                        name="date"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Registration Deadline</label>
                      <input
                        type="date"
                        name="registrationDeadline"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Capacity (Optional)</label>
                      <input
                        type="number"
                        name="capacity"
                        min={1}
                        placeholder="Leave blank if open"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Session Time</label>
                      <input
                        type="text"
                        name="time"
                        placeholder="e.g. 10:00 AM - 04:00 PM IST"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Duration</label>
                      <input
                        type="text"
                        name="duration"
                        placeholder="e.g. 2 Days"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Registration Fee</label>
                      <input
                        type="text"
                        name="fees"
                        placeholder="e.g. Free or ₹1,000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">Venue / Platform</label>
                    <input
                      type="text"
                      name="venue"
                      placeholder="e.g. IISc Campus, Bengaluru or Live Zoom Gateway"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Official Registration URL *
                    </label>
                    <input
                      type="url"
                      name="registrationUrl"
                      required
                      value={submitUrlDraft}
                      onChange={(e) => setSubmitUrlDraft(e.target.value)}
                      placeholder="https://institute.edu/workshops/register"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none"
                    />
                    {urlDraftCheck && !urlDraftCheck.valid && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{urlDraftCheck.reason}</p>
                    )}
                    {urlDraftCheck && urlDraftCheck.valid && urlDraftCheck.domain && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Validated destination host: {urlDraftCheck.domain}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">Workshop Description *</label>
                    <textarea
                      name="description"
                      required
                      rows={3}
                      placeholder="Describe the curriculum, hands-on techniques, and target participants..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">Key Skills Covered (Comma-separated)</label>
                    <input
                      type="text"
                      name="skillsCovered"
                      placeholder="e.g. RNA-Seq, DESeq2, Python, Bioconductor"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-60 text-white font-bold cursor-pointer"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit for Editorial Review'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
