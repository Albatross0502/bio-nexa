import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { SEED_EXAMS, SEED_SCHOLARSHIPS, SEED_RESEARCH, SEED_NEWS } from '../../data/seedData';

export const HomePage: React.FC = () => {
  const { jobs, internships, courses, navigate, isItemSaved, toggleSaveItem } = useApp();
  const [searchTab, setSearchTab] = useState<'all' | 'jobs' | 'internships' | 'courses'>('all');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTab === 'jobs') {
      navigate(`/jobs?q=${encodeURIComponent(keyword)}&loc=${encodeURIComponent(location)}`);
    } else if (searchTab === 'internships') {
      navigate(`/internships?q=${encodeURIComponent(keyword)}`);
    } else if (searchTab === 'courses') {
      navigate(`/courses?q=${encodeURIComponent(keyword)}`);
    } else {
      navigate(`/jobs?q=${encodeURIComponent(keyword)}`);
    }
  };

  const featuredJobs = jobs.slice(0, 3);
  const featuredCourses = courses.slice(0, 3);
  const featuredInternships = internships.slice(0, 2);
  const featuredScholarships = SEED_SCHOLARSHIPS.slice(0, 3);
  const latestPapers = SEED_RESEARCH.slice(0, 2);
  const latestNews = SEED_NEWS.slice(0, 3);

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-[#F4F8FB] via-white to-white dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-950 pt-12 pb-16 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-300 bg-blue-50 dark:bg-slate-800 rounded-full border border-blue-100 dark:border-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-[#14A3A0]" />
              <span>National Biotechnology & Life Sciences Portal</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
              Connecting Science. <span className="text-[#14A3A0]">Creating Careers.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              The unified destination for biotechnology, molecular biology, and life sciences. Discover vetted R&D jobs, summer research fellowships, national exam prep (CSIR NET & GATE), hands-on certification, and peer-reviewed PubMed discoveries.
            </p>

            {/* Unified Search Box */}
            <div className="pt-4 max-w-2xl mx-auto">
              {/* Tab Selector */}
              <div className="flex justify-center gap-2 mb-3">
                {(
                  [
                    ['all', 'All Opportunities'],
                    ['jobs', 'Biotech Jobs'],
                    ['internships', 'Internships'],
                    ['courses', 'Courses']
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    onClick={() => setSearchTab(tabKey)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      searchTab === tabKey
                        ? 'bg-[#0B2A5B] text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleHeroSearch}
                className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Role, skill (e.g. CRISPR, Fermentation, QC), or topic..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="sm:w-44 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or Remote..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Quick Metrics Strip */}
            <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Active Listings
                </span>
                <span className="text-2xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300 tabular-nums">
                  480+
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Biotech & CRO positions</span>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  National Fellowships
                </span>
                <span className="text-2xl font-bold font-mono text-[#14A3A0] tabular-nums">
                  ₹37,000
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Monthly JRF base stipend</span>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Premier Institutes
                </span>
                <span className="text-2xl font-bold font-mono text-[#2E9D57] tabular-nums">
                  92+
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">IISc, CSIR, Biocon & Labs</span>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Exam Success Rate
                </span>
                <span className="text-2xl font-bold font-mono text-[#1F6FB2] dark:text-sky-400 tabular-nums">
                  94.2%
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Mock test pass benchmark</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Biotech Jobs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Featured Biotech & Biopharma Careers
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Direct openings from leading Indian and global life science enterprises
            </p>
          </div>
          <button
            onClick={() => navigate('/jobs')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline"
          >
            <span>View All Jobs ({jobs.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-slate-800/90 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#1F6FB2] dark:text-sky-400">
                      {job.company}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug hover:text-blue-600 transition-colors mt-0.5">
                      <a
                        href={`/jobs?id=${job.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/jobs?id=${job.id}`);
                        }}
                      >
                        {job.title}
                      </a>
                    </h3>
                  </div>
                  <button
                    onClick={() => toggleSaveItem(job.id, job.title)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isItemSaved(job.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-slate-700 dark:border-slate-600'
                        : 'text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                    title="Save job"
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(job.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="text-xs text-slate-500 space-y-1 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{job.location}</span>
                    <span>·</span>
                    <span>{job.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{job.salary}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4 leading-relaxed">
                  {job.description}
                </p>

                {/* Skills Unboxed */}
                <div className="flex flex-wrap gap-1.5 mb-4 text-[11px] text-slate-500 dark:text-slate-400">
                  {job.skills.slice(0, 3).map((skill, idx) => (
                    <span key={skill}>
                      {skill}
                      {idx < 2 && <span className="ml-1.5 text-slate-300">·</span>}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">Deadline: {job.deadline}</span>
                <button
                  onClick={() => navigate(`/jobs?id=${job.id}`)}
                  className="font-semibold text-[#0B2A5B] dark:text-sky-300 hover:text-[#14A3A0] transition-colors"
                >
                  Details &amp; Apply &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* National Exam Preparation Hub Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0B2A5B] rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                <span>National Competitive Exam Hub</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Crack CSIR NET Life Sciences, GATE Biotechnology &amp; DBT-BET
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">
                Comprehensive 13-unit syllabus coverage, previous 10-year question papers (PYQs) with official answer keys, and a realistic timed mock test simulator with instant percentile scoring.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/exams?slug=csir-net-life-sciences')}
                  className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  CSIR NET Prep &amp; Mock Test
                </button>
                <button
                  onClick={() => navigate('/exams?slug=gate-biotechnology-bt')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors border border-white/20"
                >
                  GATE BT Syllabus &amp; PYQs
                </button>
                <button
                  onClick={() => navigate('/exams?slug=dbt-bet-biotechnology-eligibility-test')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors border border-white/20"
                >
                  DBT-BET Category-I Guide
                </button>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15 space-y-3">
              <div className="flex items-center justify-between text-xs text-teal-200">
                <span>Next Upcoming Examination</span>
                <span className="font-mono">Dec 2026</span>
              </div>
              <div className="text-lg font-bold">CSIR-UGC NET Life Sciences</div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>Exam Date: <strong className="text-white font-mono">22 December 2026</strong></div>
                <div>Pattern: 200 Marks · 3 Hours · 3 Sections</div>
                <div>Cutoff Projection: ~54.2% for JRF (UR)</div>
              </div>
              <button
                onClick={() => navigate('/exams?slug=csir-net-life-sciences&mock=true')}
                className="w-full py-2 bg-white text-[#0B2A5B] font-bold text-xs rounded-lg hover:bg-slate-100 transition-colors mt-2"
              >
                Launch 10-Min Diagnostic Mock Test &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              BIO-NEXA Academy &amp; Certifications
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Curated masterclasses with verifiable certificates, protocol guides, and interactive quizzes
            </p>
          </div>
          <button
            onClick={() => navigate('/courses')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline"
          >
            <span>Explore All Courses ({courses.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-800/90 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  {course.category}
                </span>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors leading-snug">
                  <a
                    href={`/courses?id=${course.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/courses?id=${course.id}`);
                    }}
                  >
                    {course.title}
                  </a>
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  By {course.instructor} · <span className="text-slate-400">{course.instructorTitle}</span>
                </p>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 my-3 leading-relaxed">
                  {course.overview}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-700/60 pt-3">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>{course.lessonsCount} Modules</span>
                  </div>
                  <div>·</div>
                  <div>{course.duration}</div>
                  <div>·</div>
                  <div className="font-semibold text-amber-600">★ {course.rating}</div>
                </div>
              </div>

              <div className="pt-4 mt-3 flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-600 font-semibold">
                  Free Verified Certificate
                </span>
                <button
                  onClick={() => navigate(`/courses?id=${course.id}`)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#0B2A5B] hover:bg-blue-900 rounded-lg transition-colors"
                >
                  Start Learning
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Internships & Fellowships Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Summer Research &amp; Industrial Internships
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Funded lab opportunities at IASc-INSA, Biocon Academy, and NCBS
            </p>
          </div>
          <button
            onClick={() => navigate('/internships')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline"
          >
            <span>View All Internships</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredInternships.map((intern) => (
            <div
              key={intern.id}
              className="bg-white dark:bg-slate-800/90 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                      {intern.organization}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      <a
                        href={`/internships?id=${intern.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/internships?id=${intern.id}`);
                        }}
                        className="hover:text-teal-600 transition-colors"
                      >
                        {intern.title}
                      </a>
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-mono bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800">
                    {intern.mode}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 my-2 leading-relaxed">
                  {intern.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-2">
                  <span>Duration: <strong className="text-slate-700 dark:text-slate-300">{intern.duration}</strong></span>
                  <span>·</span>
                  <span>Stipend: <strong className="text-emerald-600 font-mono">{intern.stipend}</strong></span>
                  <span>·</span>
                  <span>Deadline: <strong className="text-slate-700 dark:text-slate-300">{intern.deadline}</strong></span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-xs text-slate-400">Source: {intern.source.name}</span>
                <button
                  onClick={() => navigate(`/internships?id=${intern.id}`)}
                  className="text-xs font-bold text-[#0B2A5B] dark:text-sky-300 hover:text-teal-600 transition-colors"
                >
                  View Eligibility &amp; Apply &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scholarships & Fellowships Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Prestigious Scholarships &amp; Doctoral Fellowships
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              DBT-JRF, PMRF, INSPIRE, and international funding schemes for biotechnology scholars
            </p>
          </div>
          <button
            onClick={() => navigate('/scholarships')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline"
          >
            <span>All Scholarships</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredScholarships.map((sch) => (
            <div
              key={sch.id}
              className="bg-white dark:bg-slate-800/90 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  {sch.scope} · {sch.level}
                </span>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug hover:text-emerald-600 transition-colors">
                  <a
                    href={`/scholarships?id=${sch.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/scholarships?id=${sch.id}`);
                    }}
                  >
                    {sch.title}
                  </a>
                </h3>

                <p className="text-xs text-slate-500 mt-1">{sch.provider}</p>

                <div className="my-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Award Coverage:</div>
                  <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {sch.amount}
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div>Next Deadline: <strong className="text-slate-800 dark:text-slate-200">{sch.deadline}</strong></div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <button
                  onClick={() => toggleSaveItem(sch.id, sch.title)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <Bookmark className="w-3.5 h-3.5" fill={isItemSaved(sch.id) ? 'currentColor' : 'none'} />
                  <span>{isItemSaved(sch.id) ? 'Saved' : 'Save'}</span>
                </button>
                <button
                  onClick={() => navigate(`/scholarships?id=${sch.id}`)}
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Check Eligibility &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Research & PubMed Discoveries */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
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
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-sky-700 dark:text-sky-300">{paper.journal}</span>
                    <span>{paper.publishedDate}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-sky-600 transition-colors leading-snug">
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

      {/* Science News Articles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Biotech Intelligence &amp; Science News
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              DCGI trial approvals, clinical developments, and agricultural breakthroughs
            </p>
          </div>
          <button
            onClick={() => navigate('/news')}
            className="text-sm font-semibold text-[#0B2A5B] dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            <span>All Articles</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {latestNews.map((news) => (
            <div
              key={news.id}
              className="bg-white dark:bg-slate-800/90 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{news.category}</span>
                  <span>{news.readTime}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug hover:text-blue-600 transition-colors">
                  <a
                    href={`/news?slug=${news.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/news?slug=${news.slug}`);
                    }}
                  >
                    {news.title}
                  </a>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 my-2 leading-relaxed">
                  {news.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate max-w-[150px]">Source: {news.sourceName}</span>
                <button
                  onClick={() => navigate(`/news?slug=${news.slug}`)}
                  className="font-semibold text-[#0B2A5B] dark:text-sky-300 hover:underline"
                >
                  Read &rarr;
                </button>
              </div>
            </div>
          ))}
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
