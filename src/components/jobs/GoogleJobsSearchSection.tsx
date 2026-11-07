import React, { useState } from 'react';
import {
  Search,
  MapPin,
  ExternalLink,
  Compass,
  ArrowRight,
  Briefcase,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  Building2,
  GraduationCap,
  FlaskConical
} from 'lucide-react';
import {
  GOOGLE_JOBS_DISCIPLINES,
  GoogleJobsDiscipline,
  GOOGLE_JOBS_SUGGESTIONS,
  POPULAR_BIOTECH_LOCATIONS,
  buildGoogleJobsQuery,
  buildGoogleJobsUrl,
  SearchSuggestion
} from '../../services/jobs/googleJobsSearch';

interface GoogleJobsSearchSectionProps {
  onClose?: () => void;
  className?: string;
}

export const GoogleJobsSearchSection: React.FC<GoogleJobsSearchSectionProps> = ({
  onClose,
  className = ''
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<GoogleJobsDiscipline>('Biotechnology');
  const [location, setLocation] = useState<string>('Bengaluru');
  const [keywords, setKeywords] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('all');
  const [employmentType, setEmploymentType] = useState<string>('all');

  // Sync URL query params if present
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const locParam = params.get('location') || params.get('loc');
    const discParam = params.get('discipline');
    if (qParam) setKeywords(qParam);
    if (locParam) setLocation(locParam);
    if (discParam && (GOOGLE_JOBS_DISCIPLINES as readonly string[]).includes(discParam)) {
      setSelectedDiscipline(discParam as GoogleJobsDiscipline);
    }
  }, []);

  // Compute live search query and destination URL
  const currentQuery = buildGoogleJobsQuery({
    discipline: selectedDiscipline,
    location,
    additionalKeywords: keywords,
    experienceLevel,
    employmentType
  });

  const destinationUrl = buildGoogleJobsUrl(currentQuery);

  const handleLaunchSearch = (customQuery?: string) => {
    const targetUrl = customQuery ? buildGoogleJobsUrl(customQuery) : destinationUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const applySuggestion = (suggestion: SearchSuggestion) => {
    setSelectedDiscipline(suggestion.discipline);
    setLocation(suggestion.location);
    if (suggestion.additionalKeywords) {
      setKeywords(suggestion.additionalKeywords);
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0B2A5B] to-slate-900 text-white p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-sky-200 mb-3 border border-white/15">
            <Compass className="w-3.5 h-3.5 text-teal-300" />
            <span>Google Jobs Discovery Integration</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
            Discover Real Biotechnology Vacancies via Google Search
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Expand your search beyond BIO-NEXA direct listings. Query aggregated life sciences vacancies indexed by Google Search across thousands of biopharma careers sites, CSIR institutes, hospital labs, and recruitment platforms.
          </p>
        </div>
      </div>

      {/* Interactive Search Console */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* Main Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Discipline Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Biotech Discipline / Field <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <FlaskConical className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
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

          {/* Location Input with Presets */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Preferred Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bengaluru, Hyderabad, Remote..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              />
            </div>
          </div>

          {/* Quick Experience / Scope */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Career Level
            </label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
            >
              <option value="all">Any Level</option>
              <option value="Fresher entry level">Fresher / Graduate Entry</option>
              <option value="Junior Project Fellow">Junior Project Fellow</option>
              <option value="Senior Scientist">Senior / Lead Scientist</option>
            </select>
          </div>
        </div>

        {/* Secondary Row: Keywords and City Badges */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Specific Lab Techniques or Employer Keywords (Optional)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. HPLC, CRISPR, Bioreactor, NGS, Western Blot, cGMP, CSIR..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              />
            </div>
          </div>

          {/* Popular Location Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1">Suggested hubs:</span>
            {['Bengaluru', 'Hyderabad', 'Pune', 'Delhi NCR', 'Mumbai', 'Remote'].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setLocation(city)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  location === city
                    ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Live Search Query Preview & Primary Action Button */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Google Jobs Query Preview</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
            <div className="font-mono text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">
              &ldquo;{currentQuery}&rdquo;
            </div>
            <div className="text-[11px] text-slate-500">
              Directs to Google Search with native job portal indexing enabled (<code className="font-mono text-teal-600">ibp=htl;jobs</code>)
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchSearch()}
            className="px-6 py-3 bg-gradient-to-r from-[#0B2A5B] via-[#1F6FB2] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search Jobs on Google</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ready Search Suggestions */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Curated Life Science Search Suggestions
            </h3>
            <span className="text-xs text-slate-400">Click to apply &amp; discover</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GOOGLE_JOBS_SUGGESTIONS.slice(0, 6).map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#1F6FB2] dark:hover:border-sky-500 bg-white dark:bg-slate-900 transition-all group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#1F6FB2] dark:text-sky-400">
                      {suggestion.discipline}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {suggestion.location}
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
                  <button
                    type="button"
                    onClick={() => {
                      const q = buildGoogleJobsQuery({
                        discipline: suggestion.discipline,
                        location: suggestion.location,
                        additionalKeywords: suggestion.additionalKeywords
                      });
                      handleLaunchSearch(q);
                    }}
                    className="inline-flex items-center gap-1 font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    <span>Search</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-Step Candidate Instructions for Official Application */}
        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/40 border border-blue-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B2A5B] dark:text-sky-300">
            <Info className="w-4 h-4 text-[#1F6FB2]" />
            <span>How to navigate Google Jobs to original employer vacancies:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <span>
                <strong>Browse Google Jobs:</strong> View real-time vacancies aggregated from Biocon, Syngene, Dr. Reddy's, CSIR portals, and LinkedIn.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <span>
                <strong>Select an Opening:</strong> Click any job card on Google to inspect qualifications, salary ranges, and employer credentials.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2A5B] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                3
              </span>
              <span>
                <strong>Continue to Official Site:</strong> Click &ldquo;Apply on Employer Site&rdquo; on Google to complete your application directly with the company.
              </span>
            </div>
          </div>
        </div>

        {/* Legal and Architectural Transparency Note */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>
              External Search Discovery · BIO-NEXA does not scrape Google nor claim an official Google affiliation.
            </span>
          </div>
          <span>Google Search and Google Jobs are trademarks of Google LLC.</span>
        </div>
      </div>
    </div>
  );
};
