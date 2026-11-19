import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Internship } from '../../types';
import { bionexaApi, PublicInternship } from '../../services/api/bionexaApiClient';
import {
  INTERNSHIP_CATEGORIES,
  INTERNSHIP_MODES,
  classifyInternshipCompensation,
  extractInternshipLocations,
  filterInternships,
  getInternshipDaysRemaining,
  isInternshipDeadlineExpired,
  sortInternshipsByUpcomingDeadline,
  validateInternshipApplicationUrl,
  validateInternshipSubmissionPayload,
  type InternshipCompensationFilter
} from '../../services/internships/internshipHelpers';
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
  ExternalLink,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Globe,
  RotateCcw
} from 'lucide-react';

function mapPublicInternship(item: PublicInternship): Internship {
  const mode = (
    item.mode === 'Hybrid' || item.workMode === 'Hybrid'
      ? 'Hybrid'
      : item.mode === 'Remote / Dry Lab' || item.workMode === 'Remote / Dry Lab'
        ? 'Remote / Dry Lab'
        : 'On-site Lab'
  ) as Internship['mode'];

  const category = (
    item.category === 'Summer Fellowship' ||
    item.category === 'Industrial R&D' ||
    item.category === 'Academic Dissertation' ||
    item.category === 'Clinical Research'
      ? item.category
      : 'Industrial R&D'
  ) as Internship['category'];

  const expired =
    Boolean(item.isExpired) ||
    item.verificationStatus === 'Expired' ||
    item.isActive === false ||
    isInternshipDeadlineExpired(item.deadline);

  return {
    id: item.id,
    slug: item.slug || item.id,
    title: item.title,
    organization: item.organization,
    location: item.location,
    mode,
    stipend: item.stipend,
    duration: item.duration,
    deadline: item.deadline || 'Rolling',
    category,
    eligibility: item.eligibility,
    description: item.description,
    learningOutcomes: item.learningOutcomes || [],
    skillsRequired: item.skillsRequired || [],
    source: {
      name: item.source?.name || item.sourceName || 'Official Fellowship Portal',
      url: item.source?.url || item.sourceUrl || item.applicationUrl || '',
      isExternal: true
    },
    applicationUrl: item.applicationUrl || item.source?.url || item.sourceUrl || '',
    featured: Boolean(item.featured),
    verificationStatus: (expired
      ? 'Expired'
      : item.verificationStatus || 'Pending Verification') as Internship['verificationStatus'],
    verificationNotes: item.verificationNotes || '',
    lastVerificationDate: item.lastVerificationDate || '',
    isVerified: !expired && Boolean(item.isVerified ?? item.verificationStatus === 'Verified'),
    isApproved: Boolean(item.isApproved ?? true),
    isActive: !expired && Boolean(item.isActive ?? true),
    isExpired: expired,
    compensationType: item.compensationType || classifyInternshipCompensation(item.stipend)
  };
}

interface SubmissionFormState {
  title: string;
  organization: string;
  category: string;
  mode: string;
  location: string;
  stipend: string;
  duration: string;
  deadline: string;
  eligibility: string;
  applicationUrl: string;
  sourceName: string;
  description: string;
  skillsRequired: string;
  learningOutcomes: string;
}

const INITIAL_SUBMISSION_FORM: SubmissionFormState = {
  title: '',
  organization: '',
  category: 'Summer Fellowship',
  mode: 'On-site Lab',
  location: '',
  stipend: '',
  duration: '',
  deadline: '',
  eligibility: '',
  applicationUrl: '',
  sourceName: '',
  description: '',
  skillsRequired: '',
  learningOutcomes: ''
};

export const InternshipsPage: React.FC = () => {
  const { isItemSaved, toggleSaveItem, addToast } = useApp();

  const [records, setRecords] = useState<Internship[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCompensation, setSelectedCompensation] = useState<InternshipCompensationFilter>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [showExpired, setShowExpired] = useState<boolean>(false);

  const [selectedIntern, setSelectedIntern] = useState<Internship | null>(null);

  // Submit Internship Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionForm, setSubmissionForm] = useState<SubmissionFormState>(INITIAL_SUBMISSION_FORM);
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<{ title: string; message: string } | null>(null);

  const fetchInternships = useCallback(async (includeExpiredFlag: boolean) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const apiRows = await bionexaApi.getInternships({
        includeExpired: includeExpiredFlag,
        limit: 100
      });
      const mapped = apiRows.map(mapPublicInternship);
      setRecords(mapped);
    } catch (err: any) {
      setRecords([]);
      setLoadError(err?.message || 'Unable to reach the internship registry backend.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInternships(showExpired);
  }, [fetchInternships, showExpired]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const idParam = params.get('id');
    if (qParam) setSearchTerm(qParam);
    if (idParam && records.length > 0) {
      const match = records.find((i) => i.id === idParam);
      if (match) setSelectedIntern(match);
    }
  }, [records]);

  const locationOptions = useMemo(() => extractInternshipLocations(records), [records]);

  const filteredInternships = useMemo(() => {
    const filtered = filterInternships(records, {
      search: searchTerm,
      category: selectedCategory,
      location: selectedLocation,
      compensation: selectedCompensation,
      mode: selectedMode,
      includeExpired: showExpired
    });
    return sortInternshipsByUpcomingDeadline(filtered);
  }, [records, searchTerm, selectedCategory, selectedLocation, selectedCompensation, selectedMode, showExpired]);

  // Keep selectedIntern synchronized with currently filtered list
  useEffect(() => {
    if (filteredInternships.length === 0) {
      setSelectedIntern(null);
      return;
    }
    if (!selectedIntern || !filteredInternships.some((item) => item.id === selectedIntern.id)) {
      setSelectedIntern(filteredInternships[0]);
    }
  }, [filteredInternships, selectedIntern]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    selectedCategory !== 'all' ||
    selectedLocation !== 'all' ||
    selectedCompensation !== 'all' ||
    selectedMode !== 'all' ||
    showExpired;

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedCompensation('all');
    setSelectedMode('all');
    setShowExpired(false);
  };

  const handleShare = (intern: Internship) => {
    const url = `${window.location.origin}/internships?id=${intern.id}`;
    navigator.clipboard?.writeText(url);
    addToast('Internship link copied to clipboard!', 'info');
  };

  const openSubmitModal = () => {
    setSubmissionErrors([]);
    setSubmissionReceipt(null);
    setIsSubmitModalOpen(true);
  };

  const handleSubmissionChange = (field: keyof SubmissionFormState, value: string) => {
    setSubmissionForm((prev) => ({ ...prev, [field]: value }));
    if (submissionErrors.length > 0) setSubmissionErrors([]);
  };

  const handleSubmitInternship = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionErrors([]);

    const payload = {
      title: submissionForm.title,
      organization: submissionForm.organization,
      category: submissionForm.category,
      mode: submissionForm.mode,
      location: submissionForm.location,
      stipend: submissionForm.stipend.trim() || 'Unpaid',
      duration: submissionForm.duration,
      deadline: submissionForm.deadline,
      eligibility: submissionForm.eligibility,
      applicationUrl: submissionForm.applicationUrl,
      sourceName: submissionForm.sourceName,
      description: submissionForm.description,
      skillsRequired: submissionForm.skillsRequired
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      learningOutcomes: submissionForm.learningOutcomes
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    };

    const validation = validateInternshipSubmissionPayload(payload);
    if (!validation.valid) {
      setSubmissionErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await bionexaApi.submitInternship(payload);
      setSubmissionReceipt({
        title: submissionForm.title.trim(),
        message:
          response.message ||
          'Internship submitted with Pending Verification status. It will appear publicly only after editorial approval.'
      });
      setSubmissionForm(INITIAL_SUBMISSION_FORM);
      addToast('Internship submitted for editorial verification.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Unable to submit internship at this time.';
      setSubmissionErrors([msg]);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVerificationBadge = (intern: Internship) => {
    const expired = Boolean(intern.isExpired) || intern.verificationStatus === 'Expired' || intern.isActive === false;
    if (expired) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <Clock className="w-3 h-3" />
          <span>Expired</span>
        </span>
      );
    }
    if (intern.verificationStatus === 'Verified' && intern.isVerified) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3 h-3" />
          <span>Verified</span>
        </span>
      );
    }
    if (intern.verificationStatus === 'Link Unavailable') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3" />
          <span>Link Unavailable</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <Clock className="w-3 h-3" />
        <span>{intern.verificationStatus || 'Pending Verification'}</span>
      </span>
    );
  };

  const getDeadlineSummary = (intern: Internship) => {
    const expired = Boolean(intern.isExpired) || intern.verificationStatus === 'Expired' || intern.isActive === false;
    if (expired) {
      return {
        label: 'Deadline Passed · Closed',
        tone: 'text-rose-700 dark:text-rose-300',
        isClosed: true
      };
    }
    const daysLeft = getInternshipDaysRemaining(intern.deadline);
    if (daysLeft === null) {
      return {
        label: 'Rolling Applications Open',
        tone: 'text-emerald-700 dark:text-emerald-400',
        isClosed: false
      };
    }
    if (daysLeft <= 0) {
      return {
        label: 'Deadline Passed · Closed',
        tone: 'text-rose-700 dark:text-rose-300',
        isClosed: true
      };
    }
    if (daysLeft <= 14) {
      return {
        label: `Closing Soon · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
        tone: 'text-amber-700 dark:text-amber-400',
        isClosed: false
      };
    }
    return {
      label: `Open · ${daysLeft} days remaining`,
      tone: 'text-emerald-700 dark:text-emerald-400',
      isClosed: false
    };
  };

  const selectedUrlCheck = selectedIntern
    ? validateInternshipApplicationUrl(selectedIntern.applicationUrl || selectedIntern.source.url)
    : null;
  const selectedDeadlineInfo = selectedIntern ? getDeadlineSummary(selectedIntern) : null;
  const selectedCanApply = Boolean(
    selectedIntern &&
      selectedUrlCheck?.valid &&
      !selectedDeadlineInfo?.isClosed &&
      selectedIntern.verificationStatus !== 'Link Unavailable' &&
      selectedIntern.verificationStatus !== 'Rejected'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Biotechnology Internships &amp; Research Fellowships
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Verified summer research programs, national academy fellowships, and biopharma industrial training with official application portals.
          </p>
        </div>
        <button
          type="button"
          onClick={openSubmitModal}
          className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Submit Internship</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              aria-label="Search internships"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by program, institution (e.g. IISc, NCBS, Biocon), eligibility, or technique..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Categories</option>
              {INTERNSHIP_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none max-w-[200px]"
            >
              <option value="all">All Locations</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by stipend"
              value={selectedCompensation}
              onChange={(e) => setSelectedCompensation(e.target.value as InternshipCompensationFilter)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">Paid &amp; Unpaid</option>
              <option value="paid">Paid / Stipend</option>
              <option value="unpaid">Unpaid / Volunteer</option>
            </select>

            <select
              aria-label="Filter by work mode"
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>Include expired internships</span>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchInternships(showExpired)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Listings column */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
            <span>
              Showing <strong className="text-slate-900 dark:text-slate-100 font-mono">{filteredInternships.length}</strong>{' '}
              {filteredInternships.length === 1 ? 'opportunity' : 'opportunities'}
            </span>
            <span>Sorted by Upcoming Deadline</span>
          </div>

          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse space-y-3"
                >
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/70 rounded" />
                </div>
              ))}
            </div>
          ) : filteredInternships.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No verified internships match your current filters
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {records.length === 0
                  ? 'No approved internships are currently published in the registry. Check back soon or submit a verified fellowship for review.'
                  : 'Try adjusting your category, location, compensation, or work mode filters.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            filteredInternships.map((intern) => {
              const isSelected = selectedIntern?.id === intern.id;
              const compType = intern.compensationType || classifyInternshipCompensation(intern.stipend);
              const urlCheck = validateInternshipApplicationUrl(intern.applicationUrl || intern.source.url);
              const deadlineInfo = getDeadlineSummary(intern);
              const canApply =
                urlCheck.valid &&
                !deadlineInfo.isClosed &&
                intern.verificationStatus !== 'Link Unavailable' &&
                intern.verificationStatus !== 'Rejected';

              return (
                <article
                  key={intern.id}
                  onClick={() => setSelectedIntern(intern)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/40 dark:bg-slate-800/90 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
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

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {renderVerificationBadge(intern)}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        compType === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {compType === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {intern.location}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                    <span>{intern.duration}</span>
                    <span>·</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {intern.stipend}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-2 leading-relaxed">
                    {intern.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>
                        Deadline: <strong className="text-slate-700 dark:text-slate-300">{intern.deadline}</strong>
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIntern(intern);
                          if (window.innerWidth < 1024) {
                            window.scrollTo({ top: 380, behavior: 'smooth' });
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                      {canApply ? (
                        <a
                          href={urlCheck.normalizedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>Apply</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg">
                          {deadlineInfo.isClosed ? 'Closed' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Detail column */}
        <div className="lg:col-span-7 lg:sticky lg:top-20">
          {selectedIntern ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{selectedIntern.organization}</span>
                    <span>·</span>
                    <span className="text-slate-500 dark:text-slate-400">{selectedIntern.category}</span>
                    {renderVerificationBadge(selectedIntern)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedIntern.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedIntern.location}
                    </span>
                    <span>·</span>
                    <span>Mode: <strong className="text-slate-800 dark:text-slate-200">{selectedIntern.mode}</strong></span>
                    <span>·</span>
                    <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{selectedIntern.duration}</strong></span>
                    <span>·</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {selectedIntern.stipend}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Save ${selectedIntern.title}`}
                    onClick={() => toggleSaveItem(selectedIntern.id, selectedIntern.title)}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      isItemSaved(selectedIntern.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                    title="Save Internship"
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(selectedIntern.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Share ${selectedIntern.title}`}
                    onClick={() => handleShare(selectedIntern)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Copy Internship Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action & Deadline Banner */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                  selectedCanApply
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="text-slate-700 dark:text-slate-200">
                    Application Deadline:{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">{selectedIntern.deadline}</strong>
                  </div>
                  {selectedDeadlineInfo && (
                    <div className={`inline-flex items-center gap-1 font-semibold ${selectedDeadlineInfo.tone}`}>
                      {selectedDeadlineInfo.isClosed ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{selectedDeadlineInfo.label}</span>
                    </div>
                  )}
                </div>

                {selectedCanApply && selectedUrlCheck ? (
                  <a
                    href={selectedUrlCheck.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                  >
                    <span>Apply on Official Fellowship Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-not-allowed shrink-0"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {selectedDeadlineInfo?.isClosed
                        ? 'Application Window Closed'
                        : 'Official Link Unavailable'}
                    </span>
                  </button>
                )}
              </div>

              {/* Official Destination & Verification Audit */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-teal-600" />
                    <span>Official Portal Audit</span>
                  </span>
                  {selectedIntern.lastVerificationDate && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Verified: {selectedIntern.lastVerificationDate.slice(0, 10)}
                    </span>
                  )}
                </div>
                <div className="text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Destination domain:{' '}
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {selectedUrlCheck?.valid ? selectedUrlCheck.domain : 'Invalid / Unavailable URL'}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Compensation:{' '}
                    <strong className="capitalize text-slate-900 dark:text-slate-100">
                      {selectedIntern.compensationType || classifyInternshipCompensation(selectedIntern.stipend)}
                    </strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Applications are submitted directly on the host institution&apos;s official portal. BIO-INEXA does not simulate or intermediate fellowship submissions.
                </p>
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
              {selectedIntern.learningOutcomes.length > 0 && (
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
              )}

              {/* Skills required */}
              {selectedIntern.skillsRequired.length > 0 && (
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
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Source: <strong className="text-slate-700 dark:text-slate-300">{selectedIntern.source.name}</strong>
                </span>
                {selectedUrlCheck?.valid && (
                  <a
                    href={selectedUrlCheck.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-teal-600 dark:text-teal-400 font-medium inline-flex items-center gap-1"
                  >
                    <span>Official Fellowship Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Select an internship or summer fellowship to review eligibility, duration, and official portal details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Internship for Admin Verification Modal */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-internship-title"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                  Community &amp; Institutional Submission
                </span>
                <h3 id="submit-internship-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Submit a Biotechnology Internship
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submissions enter the admin moderation queue as <strong>Pending Verification</strong> and are published only after official URL verification.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close submission modal"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submissionReceipt ? (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Submission Received — Pending Verification</span>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    <strong>{submissionReceipt.title}</strong> has been queued for editorial review. {submissionReceipt.message}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubmissionReceipt(null)}
                    className="px-4 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg cursor-pointer"
                  >
                    Submit Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitInternship} className="space-y-3.5 text-xs" noValidate>
                {submissionErrors.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 space-y-1">
                    {submissionErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="intern-title" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Internship / Fellowship Title *
                    </label>
                    <input
                      id="intern-title"
                      type="text"
                      required
                      value={submissionForm.title}
                      onChange={(e) => handleSubmissionChange('title', e.target.value)}
                      placeholder="e.g. Summer Research Fellowship in Genomics"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="intern-org" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Host Institution / Organization *
                    </label>
                    <input
                      id="intern-org"
                      type="text"
                      required
                      value={submissionForm.organization}
                      onChange={(e) => handleSubmissionChange('organization', e.target.value)}
                      placeholder="e.g. CSIR-IGIB / IISc Bengaluru"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="intern-category" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      id="intern-category"
                      value={submissionForm.category}
                      onChange={(e) => handleSubmissionChange('category', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      {INTERNSHIP_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="intern-mode" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Work Mode *
                    </label>
                    <select
                      id="intern-mode"
                      value={submissionForm.mode}
                      onChange={(e) => handleSubmissionChange('mode', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      {INTERNSHIP_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="intern-location" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Location *
                    </label>
                    <input
                      id="intern-location"
                      type="text"
                      required
                      value={submissionForm.location}
                      onChange={(e) => handleSubmissionChange('location', e.target.value)}
                      placeholder="e.g. Bengaluru, Karnataka"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="intern-stipend" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Stipend / Compensation *
                    </label>
                    <input
                      id="intern-stipend"
                      type="text"
                      required
                      value={submissionForm.stipend}
                      onChange={(e) => handleSubmissionChange('stipend', e.target.value)}
                      placeholder="e.g. ₹15,000 / month or Unpaid"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="intern-duration" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Duration *
                    </label>
                    <input
                      id="intern-duration"
                      type="text"
                      required
                      value={submissionForm.duration}
                      onChange={(e) => handleSubmissionChange('duration', e.target.value)}
                      placeholder="e.g. 8 Weeks or 6 Months"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="intern-deadline" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Application Deadline
                    </label>
                    <input
                      id="intern-deadline"
                      type="date"
                      value={submissionForm.deadline}
                      onChange={(e) => handleSubmissionChange('deadline', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="intern-url" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Application URL *
                    </label>
                    <input
                      id="intern-url"
                      type="url"
                      required
                      value={submissionForm.applicationUrl}
                      onChange={(e) => handleSubmissionChange('applicationUrl', e.target.value)}
                      placeholder="https://institute.res.in/fellowships/apply"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="intern-eligibility" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Eligibility Criteria *
                    </label>
                    <input
                      id="intern-eligibility"
                      type="text"
                      required
                      value={submissionForm.eligibility}
                      onChange={(e) => handleSubmissionChange('eligibility', e.target.value)}
                      placeholder="e.g. M.Sc / B.Tech Biotechnology students"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="intern-desc" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Program Description &amp; Scope *
                  </label>
                  <textarea
                    id="intern-desc"
                    rows={3}
                    required
                    value={submissionForm.description}
                    onChange={(e) => handleSubmissionChange('description', e.target.value)}
                    placeholder="Describe lab training modules, research theme, mentorship, and expected outcomes..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="intern-skills" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Preferred Skills (comma-separated)
                    </label>
                    <input
                      id="intern-skills"
                      type="text"
                      value={submissionForm.skillsRequired}
                      onChange={(e) => handleSubmissionChange('skillsRequired', e.target.value)}
                      placeholder="PCR, Python, Cell Culture"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="intern-source" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Source Name
                    </label>
                    <input
                      id="intern-source"
                      type="text"
                      value={submissionForm.sourceName}
                      onChange={(e) => handleSubmissionChange('sourceName', e.target.value)}
                      placeholder="e.g. CSIR-IGIB Official Portal"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 disabled:opacity-60 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
