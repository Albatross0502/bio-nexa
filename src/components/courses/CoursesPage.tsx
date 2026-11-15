import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Course, CourseLesson } from '../../types';
import {
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Award,
  FileText,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Search,
  Clock,
  Globe,
  Calendar,
  ExternalLink,
  Building2,
  GraduationCap,
  Info,
  X
} from 'lucide-react';
import {
  COURSE_CATEGORIES,
  UnifiedCourse,
  filterCourses,
  getDefaultCourseImageForCategory,
  isCourseRegistrationClosed,
  isValidCourseRegistrationUrl,
  mapApiCourseToUnified,
  normalizeCourseCategory
} from '../../services/courses/courseHelpers';
import { CourseDetailModal } from './CourseDetailModal';

export const CoursesPage: React.FC = () => {
  const {
    courses,
    enrolledCourseIds,
    enrollInCourse,
    completedLessonIds,
    markLessonComplete,
    awardCertificate,
    navigate,
    currentUser
  } = useApp();

  const [selectedCourse, setSelectedCourse] = useState<Course>(courses[0]);
  const [activeLesson, setActiveLesson] = useState<CourseLesson>(courses[0]?.lessons[0]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes' | 'quiz'>('lessons');

  // Interactive Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [earnedCertificate, setEarnedCertificate] = useState<any | null>(null);

  // Phase 09 Live Course Discovery Catalog State
  const [liveCourses, setLiveCourses] = useState<UnifiedCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailCourse, setDetailCourse] = useState<UnifiedCourse | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setCatalogLoading(true);
    fetch('/api/courses')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && Array.isArray(data.courses)) {
          const mapped: UnifiedCourse[] = data.courses.map(mapApiCourseToUnified);
          setLiveCourses(mapped);

          // Check URL ?id= param for direct opening
          const params = new URLSearchParams(window.location.search);
          const idParam = params.get('id');
          if (idParam) {
            const matchedLive = mapped.find((c) => c.id === idParam);
            if (matchedLive && !courses.some((ic) => ic.id === idParam)) {
              setDetailCourse(matchedLive);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [courses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const catParam = params.get('category');
    if (catParam) {
      setSelectedCategory(normalizeCourseCategory(catParam));
    }
    if (idParam) {
      const match = courses.find((c) => c.id === idParam);
      if (match) {
        setSelectedCourse(match);
        setActiveLesson(match.lessons[0]);
        setQuizSubmitted(false);
        setSelectedAnswers({});
        setEarnedCertificate(null);
      }
    }
  }, [courses]);

  const filteredLiveCourses = useMemo(() => {
    return filterCourses(liveCourses, {
      category: selectedCategory,
      status: statusFilter,
      search: searchQuery
    });
  }, [liveCourses, selectedCategory, statusFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: liveCourses.length };
    for (const cat of COURSE_CATEGORIES) {
      map[cat] = liveCourses.filter((c) => normalizeCourseCategory(c.category) === cat).length;
    }
    return map;
  }, [liveCourses]);

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveLesson(course.lessons[0]);
    setActiveTab('lessons');
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setEarnedCertificate(null);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const isEnrolled = enrolledCourseIds.includes(selectedCourse.id);

  const handleQuizAnswer = (qId: string, optIndex: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const calculateScore = () => {
    let correct = 0;
    selectedCourse.quiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / selectedCourse.quiz.length) * 100);
  };

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    const score = calculateScore();
    if (score >= 60) {
      const cert = awardCertificate(selectedCourse, score);
      setEarnedCertificate(cert);
    }
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Course Specification Detail Modal */}
      <CourseDetailModal course={detailCourse} onClose={() => setDetailCourse(null)} />

      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Courses &amp; BIO-INEXA Academy
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Discover biotechnology educational courses across 9 core life science disciplines alongside BIO-INEXA Academy interactive modules.
        </p>
      </div>

      {/* Phase 09 Live Course Discovery Catalog */}
      <section className="space-y-6" aria-label="Course Discovery Directory">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Course Discovery Directory
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              All Biotechnology Educational Courses ({filteredLiveCourses.length})
            </h2>
          </div>

          {/* Search & Availability Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses, providers, topics..."
                aria-label="Search biotechnology courses"
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear course search"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              {(['all', 'available', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All Status' : st === 'available' ? 'Available' : 'Closed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 9 Canonical Course Categories Filter Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Categories</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {categoryCounts.all || 0}
            </span>
          </button>

          {COURSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#14A3A0] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Discovery Course Grid */}
        {catalogLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="h-80 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredLiveCourses.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <BookOpen className="w-9 h-9 mx-auto text-slate-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No courses match your selected category or filters
            </h3>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-bold bg-[#0B2A5B] text-white rounded-xl hover:bg-blue-900 cursor-pointer"
            >
              Show All Courses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLiveCourses.map((course) => {
              const closed = isCourseRegistrationClosed(course);
              const hasValidUrl = isValidCourseRegistrationUrl(course.registrationUrl);
              const imgSrc =
                imgErrors[course.id] || !course.imageUrl
                  ? getDefaultCourseImageForCategory(course.category)
                  : course.imageUrl;
              const interactiveMatch = courses.find((c) => c.id === course.id);

              return (
                <article
                  key={course.id}
                  className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-[#14A3A0]/60 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Course Image Header */}
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={imgSrc}
                        alt={course.title}
                        onError={() => setImgErrors((prev) => ({ ...prev, [course.id]: true }))}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#0B2A5B]/90 text-white backdrop-blur-md">
                            {normalizeCourseCategory(course.category)}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                              closed
                                ? 'bg-slate-700/90 text-slate-200'
                                : 'bg-emerald-600/90 text-white'
                            }`}
                          >
                            {closed ? 'Closed' : 'Available'}
                          </span>
                          {course.featured && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white">
                              <Sparkles className="w-3 h-3" />
                              <span>Featured</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white">
                        <span className="flex items-center gap-1 font-semibold text-teal-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{course.duration}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-sky-200 font-medium">
                          {course.deliveryMode}
                        </span>
                      </div>
                    </div>

                    {/* Course Card Body */}
                    <div className="p-5 space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#14A3A0] mb-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{course.provider}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailCourse(course)}
                          className="text-left text-base font-bold text-slate-900 dark:text-slate-100 hover:text-[#1F6FB2] dark:hover:text-sky-400 transition-colors line-clamp-2 cursor-pointer"
                        >
                          {course.title}
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>

                      {/* Key Specs */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-start gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-1" title={course.eligibility}>
                            <strong className="text-slate-700 dark:text-slate-200">Eligibility:</strong> {course.eligibility}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate" title={course.fees}>
                            <strong className="text-slate-700 dark:text-slate-200">Fees:</strong>{' '}
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{course.fees}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                            <Calendar className="w-3 h-3 text-amber-500" />
                            <span>{course.registrationDeadline || 'Open'}</span>
                          </span>
                        </div>
                        {course.certificateInfo && (
                          <div className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-200/70 dark:border-amber-800/40">
                            <Award className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <span className="line-clamp-1">{course.certificateInfo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Course Card Actions */}
                  <div className="p-5 pt-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailCourse(course)}
                        className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Details &amp; Curriculum</span>
                      </button>

                      {closed ? (
                        <button
                          type="button"
                          disabled
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
                        >
                          Registration Closed
                        </button>
                      ) : !hasValidUrl ? (
                        <button
                          type="button"
                          onClick={() => setDetailCourse(course)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold text-center cursor-pointer"
                        >
                          View Details
                        </button>
                      ) : (
                        <a
                          href={course.registrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5"
                        >
                          <span>Register</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {interactiveMatch && (
                      <button
                        type="button"
                        onClick={() => handleSelectCourse(interactiveMatch)}
                        className="w-full py-1.5 text-[11px] font-semibold text-[#0B2A5B] dark:text-sky-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Open in Interactive Academy Player</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Interactive Course Player Stage (Preserved BIO-INEXA Academy Player) */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Interactive Learning Lab
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            BIO-INEXA Academy Video &amp; Protocol Modules
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Top Header of the Player */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-600">
                <BookOpen className="w-4 h-4" />
                <span>{selectedCourse.category}</span>
                <span>·</span>
                <span className="text-slate-500">{selectedCourse.level}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {selectedCourse.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Instructor: {selectedCourse.instructor} ({selectedCourse.instructorTitle})
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isEnrolled ? (
                <button
                  onClick={() => enrollInCourse(selectedCourse.id)}
                  className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Track Lesson Progress</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enrolled in Interactive Lab</span>
                </span>
              )}
            </div>
          </div>

          {/* Video / Content Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800">
            {/* Main screen area */}
            <div className="lg:col-span-8 bg-black flex flex-col justify-center min-h-[340px] sm:min-h-[420px] relative">
              {activeLesson?.videoUrl ? (
                <iframe
                  src={activeLesson.videoUrl}
                  title={activeLesson.title}
                  className="w-full h-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <PlayCircle className="w-12 h-12 mx-auto mb-2 text-teal-400" />
                  <p className="text-sm font-semibold text-white">{activeLesson?.title || 'Interactive Lesson Viewer'}</p>
                  <p className="text-xs text-slate-400 mt-1">Review the module notes and take the self-check quiz below.</p>
                </div>
              )}
            </div>

            {/* Right Playlist & Controls */}
            <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-900 flex flex-col divide-y divide-slate-200 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
              <div className="p-3 bg-white dark:bg-slate-800/80 font-semibold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span>Curriculum &amp; Modules</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedCourse.lessons.length} Lessons
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedCourse.lessons.map((lesson, idx) => {
                  const isCurrent = activeLesson?.id === lesson.id;
                  const isCompleted = completedLessonIds.includes(lesson.id);

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => setActiveLesson(lesson)}
                      className={`p-3.5 cursor-pointer text-xs flex items-start justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/60 dark:bg-slate-800 border-l-3 border-[#0B2A5B]'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono">0{idx + 1}.</span>
                          <span className={isCurrent ? 'text-[#0B2A5B] dark:text-sky-300' : ''}>
                            {lesson.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{lesson.duration}</span>
                          <span>·</span>
                          <span className="line-clamp-1">{lesson.summary}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markLessonComplete(lesson.id);
                        }}
                        className={`p-1 rounded shrink-0 ${
                          isCompleted ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={isCompleted ? 'Lesson Completed' : 'Mark Lesson as Completed'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab Navigation for Notes & Self-Check Quiz */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'lessons'
                  ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Lesson Overview &amp; Key Concepts
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Bench Protocols &amp; Syllabus
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-[#14A3A0] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Interactive Assessment</span>
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="p-6">
            {activeTab === 'lessons' && (
              <div className="space-y-4 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeLesson?.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Duration: {activeLesson?.duration}</p>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeLesson?.summary}
                </p>
                {activeLesson?.notesMarkdown && (
                  <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800 text-xs text-teal-950 dark:text-teal-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Scientific Takeaway / Rule of Thumb</span>
                    </div>
                    <p>{activeLesson.notesMarkdown}</p>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => markLessonComplete(activeLesson.id)}
                    className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    Mark This Lesson as Completed
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4 max-w-3xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Detailed Course Syllabus Breakdown
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {selectedCourse.syllabus.map((s, idx) => (
                    <li key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Self-Check Quiz: {selectedCourse.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Test your comprehension of key concepts (60% benchmark).
                    </p>
                  </div>
                  {quizSubmitted && (
                    <button
                      onClick={resetQuiz}
                      className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Quiz</span>
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {selectedCourse.quiz.map((q, idx) => {
                    const userAnswer = selectedAnswers[q.id];
                    const isAnswered = userAnswer !== undefined;

                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-xs text-[#0B2A5B] dark:text-sky-400">
                            Q{idx + 1}.
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {q.question}
                          </p>
                        </div>

                        <div className="space-y-2 pl-5">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userAnswer === optIdx;
                            let optionStyle = 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';

                            if (quizSubmitted) {
                              if (optIdx === q.correctAnswer) {
                                optionStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold';
                              } else if (isSelected && optIdx !== q.correctAnswer) {
                                optionStyle = 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200';
                              }
                            } else if (isSelected) {
                              optionStyle = 'border-[#0B2A5B] bg-blue-50/50 dark:bg-slate-700 font-semibold';
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={quizSubmitted}
                                onClick={() => handleQuizAnswer(q.id, optIdx)}
                                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between ${optionStyle}`}
                              >
                                <span>{opt}</span>
                                {quizSubmitted && optIdx === q.correctAnswer && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <strong className="text-slate-900 dark:text-slate-100">Scientific Explanation:</strong>{' '}
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!quizSubmitted ? (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleQuizSubmit}
                      disabled={Object.keys(selectedAnswers).length < selectedCourse.quiz.length}
                      className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
                    >
                      Submit Answers &amp; Check Score
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                    <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                      Assessment Evaluation
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                      {calculateScore()}%
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {calculateScore() >= 60
                        ? 'Great work! You met the 60% passing benchmark for this BIO-INEXA self-assessment module.'
                        : 'You scored below the 60% benchmark. Review the key concepts and retake the quiz.'}
                    </p>

                    {earnedCertificate && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 inline-block text-left text-xs max-w-md w-full">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                            <ShieldCheck className="w-4 h-4" />
                            <span>BIO-INEXA Module Completion Record</span>
                          </div>
                          <div className="mt-1 font-mono text-slate-700 dark:text-slate-300">
                            Record ID: <strong className="text-slate-900 dark:text-white">{earnedCertificate.certificateNumber}</strong>
                          </div>
                          <div className="text-slate-500 mt-0.5">Learner: {currentUser.name}</div>
                          <div className="text-slate-500">Date: {earnedCertificate.issueDate}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
