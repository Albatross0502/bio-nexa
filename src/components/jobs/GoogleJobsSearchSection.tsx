import React, { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  ExternalLink,
  Compass,
  ArrowRight,
  Sparkles,
  Info,
  ShieldCheck,
  Building2,
  FlaskConical,
  Globe,
  Briefcase
} from 'lucide-react';
import {
  GOOGLE_JOBS_DISCIPLINES,
  GoogleJobsDiscipline,
  GOOGLE_JOBS_SUGGESTIONS,
  GOOGLE_JOBS_CATEGORY_TRACKS,
  GoogleJobsSearchCategory,
  QUICK_LOCATION_HUBS,
  OFFICIAL_EMPLOYER_CAREER_PORTALS,
  EmployerPortalSector,
  buildGoogleJobsQuery,
  buildGoogleJobsUrl,
  buildGoogleWebSearchUrl,
  buildEmployerGoogleJobsUrl,
  SearchSuggestion
} from '../../services/jobs/googleJobsSearch';

interface GoogleJobsSearchSectionProps {
  onClose?: () => void;
  className?: string;
}

const EMPLOYER_SECTORS: Array<'All' | EmployerPortalSector> = [
  'All',
  'Biopharma & Biotech',
  'Pharmaceutical',
  'Clinical Research & Genomics',
  'National Research Institutes'
];

export const GoogleJobsSearchSection: React.FC<GoogleJobsSearchSectionProps> = ({
  className = ''
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<GoogleJobsDiscipline>('Biotechnology');
  const [location, setLocation] = useState<string>('Bengaluru');
  const [keywords, setKeywords] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('all');
  const [employmentType, setEmploymentType] = useState<string>('all');
  const [remoteOnly, setRemoteOnly] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<GoogleJobsSearchCategory>('all');
  const [activeEmployerSector, setActiveEmployerSector] = useState<'All' | EmployerPortalSector>('All');

  // Sync URL query params if present
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const locParam = params.get('location') || params.get('loc');
    const discParam = params.get('discipline');
    const remoteParam = params.get('remote');
    if (qParam) setKeywords(qParam);
    if (locParam) setLocation(locParam);
    if (remoteParam === 'true' || remoteParam === '1') setRemoteOnly(true);
    if (discParam && (GOOGLE_JOBS_DISCIPLINES as readonly string[]).includes(discParam)) {
      setSelectedDiscipline(discParam as GoogleJobsDiscipline);
    }
  }, []);

  // Compute live search query and strictly encoded destination URLs
  const currentQuery = buildGoogleJobsQuery({
    discipline: selectedDiscipline,
    location,
    additionalKeywords: keywords,
    experienceLevel,
    employmentType,
    remoteOnly
  });

  const destinationUrl = buildGoogleJobsUrl(currentQuery);
  const webFallbackUrl = buildGoogleWebSearchUrl(currentQuery);

  const filteredSuggestions = useMemo(() => {
    if (activeCategory === 'all') return GOOGLE_JOBS_SUGGESTIONS;
    return GOOGLE_JOBS_SUGGESTIONS.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  const filteredPortals = useMemo(() => {
    if (activeEmployerSector === 'All') return OFFICIAL_EMPLOYER_CAREER_PORTALS;
    return OFFICIAL_EMPLOYER_CAREER_PORTALS.filter((p) => p.sector === activeEmployerSector);
  }, [activeEmployerSector]);

  const applySuggestion = (suggestion: SearchSuggestion) => {
    setSelectedDiscipline(suggestion.discipline);
    setLocation(suggestion.location);
    setKeywords(suggestion.additionalKeywords || '');
    setExperienceLevel(suggestion.experienceLevel || 'all');
    setEmploymentType(suggestion.employmentType || 'all');
    setRemoteOnly(Boolean(suggestion.remoteOnly));
  };

  const handleSelectCategoryTrack = (trackId: GoogleJobsSearchCategory) => {
    setActiveCategory(trackId);
    const track = GOOGLE_JOBS_CATEGORY_TRACKS.find((t) => t.id === trackId);
    if (track?.preset) {
      if ((GOOGLE_JOBS_DISCIPLINES as readonly string[]).includes(track.preset.discipline)) {
        setSelectedDiscipline(track.preset.discipline as GoogleJobsDiscipline);
      }
      if (track.preset.location) setLocation(track.preset.location);
      setKeywords(track.preset.additionalKeywords || '');
      setExperienceLevel(track.preset.experienceLevel || 'all');
      setEmploymentType(track.preset.employmentType || 'all');
      setRemoteOnly(Boolean(track.preset.remoteOnly));
    }
  };

  const handleSelectLocationHub = (hub: string) => {
    if (hub === 'Remote') {
      setRemoteOnly(true);
      setLocation('India');
    } else {
      setRemoteOnly(false);
      setLocation(hub);
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0B2A5B] to-slate-900 text-white p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-sky-200 mb-3 border border-white/15">
            <Compass className="w-3.5 h-3.5 text-teal-300" />
            <span>External Google Search Job Discovery · Official Portal Directory</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
            Discover Real Biotechnology Vacancies via Google Search
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Build tailored life-science search queries for Google Search&rsquo;s native jobs view across Biotechnology, Internships, Fresher roles, Research Assistants, Pharma, Clinical Research, Molecular Biology, Bioinformatics, and Remote openings—or jump directly to verified employer career portals.
          </p>
        </div>
      </div>

      {/* Interactive Search Console */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* Quick Specialized Search Tracks */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Quick Search Tracks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GOOGLE_JOBS_CATEGORY_TRACKS.map((track) => {
              const isActive = activeCategory === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSelectCategoryTrack(track.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B] shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#1F6FB2] dark:hover:border-sky-500'
                  }`}
                >
                  {track.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Discipline Selector */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Biotech Discipline / Field <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <FlaskConical className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                aria-label="Biotech Discipline or Field"
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value as GoogleJobsDiscipline)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              >
                {GOOGLE_JOBS_DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location Input */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Preferred Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Preferred Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bengaluru, Hyderabad, India..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              />
            </div>
          </div>

          {/* Career Level */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Career Level
            </label>
            <select
              aria-label="Career Level"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
            >
              <option value="all">Any Level</option>
              <option value="Fresher entry level">Fresher / Graduate Entry</option>
              <option value="Junior Project Fellow">Junior Project Fellow (JRF)</option>
              <option value="Research Assistant">Research Assistant</option>
              <option value="Senior Scientist">Senior / Lead Scientist</option>
            </select>
          </div>

          {/* Employment Type */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Role Type
            </label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                aria-label="Role Type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              >
                <option value="all">Any Type</option>
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Fellowship">Fellowship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>
        </div>

        {/* Secondary Row: Keywords, Remote Toggle & City Badges */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-9 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Specific Lab Techniques or Employer Keywords (Optional)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Specific Lab Techniques or Employer Keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. HPLC, CRISPR, PCR, Bioreactor, NGS, Western Blot, cGMP, CSIR..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                />
              </div>
            </div>

            {/* Remote Toggle Button */}
            <div className="md:col-span-3">
              <button
                type="button"
                aria-pressed={remoteOnly}
                onClick={() => setRemoteOnly((prev) => !prev)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  remoteOnly
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>{remoteOnly ? 'Remote Filter: ON' : 'Include Remote Only'}</span>
              </button>
            </div>
          </div>

          {/* Popular Location Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1">Biotech hubs:</span>
            {QUICK_LOCATION_HUBS.map((city) => {
              const isSelected =
                city === 'Remote' ? remoteOnly : !remoteOnly && location === city;
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => handleSelectLocationHub(city)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Search Query Preview & Primary Action Links */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Google Search Query Preview</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
            <div className="font-mono text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
              &ldquo;{currentQuery}&rdquo;
            </div>
            <div className="text-[11px] text-slate-500">
              Opens Google Search externally in Jobs view (<code className="font-mono text-teal-600 dark:text-teal-400">ibp=htl;jobs</code>) — direct search link, not a Google API feed.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-gradient-to-r from-[#0B2A5B] via-[#1F6FB2] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Search Jobs on Google</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={webFallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors"
              title="Open standard Google web search"
            >
              <span>Web Search</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Ready Search Suggestions */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Curated Life Science Search Presets ({filteredSuggestions.length})
            </h3>
            <span className="text-xs text-slate-400">
              Load into builder or open encoded Google Jobs search directly
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSuggestions.map((suggestion) => {
              const suggestionUrl = buildGoogleJobsUrl({
                discipline: suggestion.discipline,
                location: suggestion.location,
                additionalKeywords: suggestion.additionalKeywords,
                experienceLevel: suggestion.experienceLevel,
                employmentType: suggestion.employmentType,
                remoteOnly: suggestion.remoteOnly
              });

              return (
                <div
                  key={suggestion.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#1F6FB2] dark:hover:border-sky-500 bg-white dark:bg-slate-900 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1F6FB2] dark:text-sky-400">
                        {suggestion.discipline}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {suggestion.remoteOnly ? `Remote · ${suggestion.location}` : suggestion.location}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {suggestion.label}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => applySuggestion(suggestion)}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0B2A5B] dark:hover:text-sky-300 cursor-pointer"
                    >
                      Load into Form
                    </button>
                    <a
                      href={suggestionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <span>Search</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Official Employer & National Institute Career Portals */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400" />
                <span>Official Employer &amp; National Research Career Portals ({filteredPortals.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Apply directly on verified official career pages of top biopharma companies, CROs, and CSIR/DBT/ICMR/IISc research institutions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EMPLOYER_SECTORS.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setActiveEmployerSector(sector)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeEmployerSector === sector
                    ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPortals.map((portal) => {
              const employerGoogleUrl = buildEmployerGoogleJobsUrl(
                portal,
                selectedDiscipline,
                location || 'India'
              );
              return (
                <div
                  key={portal.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                        {portal.sector}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {portal.headquarters}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {portal.name}
                    </h4>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {portal.focusAreas.slice(0, 3).map((area) => (
                        <span
                          key={area}
                          className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                    <a
                      href={portal.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#0B2A5B] dark:text-sky-300 hover:underline"
                    >
                      <span>Official Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={employerGoogleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <span>Google Jobs</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step-by-Step Candidate Instructions for Official Application */}
        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/40 border border-blue-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B2A5B] dark:text-sky-300">
            <Info className="w-4 h-4 text-[#1F6FB2]" />
            <span>How to navigate Google Search Jobs to official employer applications:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <span>
                <strong>Open Google Search Jobs:</strong> Review publicly indexed biotech, pharma, and research institute vacancies matched to your query.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <span>
                <strong>Verify Employer Source:</strong> Check the posted qualification, deadline, and employer domain before submitting personal documents.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                3
              </span>
              <span>
                <strong>Apply on Official Site:</strong> Use &ldquo;Apply on Employer Site&rdquo; or the Official Employer Career Portals directory above directly.
              </span>
            </div>
          </div>
        </div>

        {/* Legal and Architectural Transparency Note */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              External Search URL Builder · Google does not offer a public Jobs API; BIO-INEXA never scrapes Google or auto-imports search results.
            </span>
          </div>
          <span className="shrink-0">Google Search is a trademark of Google LLC.</span>
        </div>
      </div>
    </div>
  );
};
