import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Course, CourseLesson } from '../../types';
import {
  AlertCircle,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Info,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  X
} from 'lucide-react';
import {
  COURSE_CATEGORIES,
  COURSE_DELIVERY_MODES,
  UnifiedCourse,
  classifyCoursePricing,
  extractCourseCategories,
  filterCourses,
  getDefaultCourseImageForCategory,
  isCourseExpired,
  isCourseRegistrationClosed,
  mapApiCourseToUnified,
  normalizeCourseCategory,
  normalizeCourseProviderType,
  parseCurriculumInput,
  validateCourseRegistrationUrl
} from '../../services/courses/courseHelpers';
import { bionexaApi } from '../../services/api/bionexaApiClient';
import { CourseDetailModal } from './CourseDetailModal';

interface SubmitCourseFormState {
  title: string;
  provider: string;
  instructor: string;
  category: string;
  deliveryMode: string;
  duration: string;
  fees: string;
  pricingType: 'free' | 'paid';
  registrationUrl: string;
  registrationDeadline: string;
  eligibility: string;
  certificateInfo: string;
  curriculumText: string;
  description: string;
}

const EMPTY_SUBMIT_FORM: SubmitCourseFormState = {
  title: '',
  provider: '',
  instructor: '',
  category: 'Biotechnology',
  deliveryMode: 'Online (Self-Paced)',
  duration: '',
  fees: '',
  pricingType: 'free',
  registrationUrl: '',
  registrationDeadline: '',
  eligibility: '',
  certificateInfo: '',
  curriculumText: '',
  description: ''
};

export const CoursesPage: React.FC = () => {
  const { courses, addToast } = useApp();

  // Optional Self-Study Reference & Practice Quiz state (unaccredited; no fake enrollment/certificates)
  const [selectedCourse, setSelectedCourse] = useState<Course>(courses[0]);
  const [activeLesson, setActiveLesson] = useState<CourseLesson>(courses[0]?.lessons[0]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes' | 'quiz'>('lessons');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Phase 13 Database-Connected Course Discovery Catalog State
  const [liveCourses, setLiveCourses] = useState<UnifiedCourse[]>([]);
  const [managedCategories, setManagedCategories] = useState<string[]>([...COURSE_CATEGORIES]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'closed'>('all');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [showExpired, setShowExpired] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailCourse, setDetailCourse] = useState<UnifiedCourse | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Public Third-Party Course Submission Modal State
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState<SubmitCourseFormState>(EMPTY_SUBMIT_FORM);
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitReceipt, setSubmitReceipt] = useState<{ title: string; message: string } | null>(null);

  const loadCourses = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch('/api/courses?includeExpired=true');
      if (!res.ok) {
        throw new Error(`Unable to load courses (HTTP ${res.status}).`);
      }
      const data = await res.json();
      const mapped: UnifiedCourse[] = Array.isArray(data?.courses)
        ? data.courses.map(mapApiCourseToUnified)
        : [];
      setLiveCourses(mapped);

      if (Array.isArray(data?.categories) && data.categories.length > 0) {
        setManagedCategories(data.categories);
      }

      // Check URL ?id= param for direct detail modal opening
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      if (idParam) {
        const matchedLive = mapped.find((c) => c.id === idParam);
        if (matchedLive) {
          setDetailCourse(matchedLive);
        }
      }
    } catch (err: any) {
      setCatalogError(err?.message || 'Unable to load the course catalog from the database.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('category');
    if (catParam) {
      setSelectedCategory(catParam.trim());
    }
  }, []);

  const availableCategories = useMemo(() => {
    return extractCourseCategories(liveCourses, managedCategories);
  }, [liveCourses, managedCategories]);

  const expiredCount = useMemo(() => {
    return liveCourses.filter((c) => isCourseExpired(c)).length;
  }, [liveCourses]);

  const visiblePoolForCounts = useMemo(() => {
    return showExpired ? liveCourses : liveCourses.filter((c) => !isCourseExpired(c));
  }, [liveCourses, showExpired]);

  const filteredLiveCourses = useMemo(() => {
    return filterCourses(liveCourses, {
      category: selectedCategory,
      status: statusFilter,
      pricingType: pricingFilter,
      includeExpired: showExpired,
      search: searchQuery
    });
  }, [liveCourses, selectedCategory, statusFilter, pricingFilter, showExpired, searchQuery]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: visiblePoolForCounts.length };
    for (const cat of availableCategories) {
      const catLower = cat.toLowerCase();
      map[cat] = visiblePoolForCounts.filter((c) => {
        const itemCat = (c.category || '').trim().toLowerCase();
        if (itemCat === catLower) return true;
        const isCanonical = COURSE_CATEGORIES.some((cc) => cc.toLowerCase() === catLower);
        return isCanonical && normalizeCourseCategory(c.category).toLowerCase() === catLower;
      }).length;
    }
    return map;
  }, [visiblePoolForCounts, availableCategories]);

  const submitUrlCheck = useMemo(() => {
    if (!submitForm.registrationUrl.trim()) return null;
    return validateCourseRegistrationUrl(submitForm.registrationUrl);
  }, [submitForm.registrationUrl]);

  const handleOpenSubmitModal = () => {
    setSubmitForm({
      ...EMPTY_SUBMIT_FORM,
      category: availableCategories[0] || 'Biotechnology'
    });
    setSubmitError(null);
    setSubmitReceipt(null);
    setSubmitModalOpen(true);
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const urlValidation = validateCourseRegistrationUrl(submitForm.registrationUrl);
    if (!urlValidation.valid) {
      setSubmitError(urlValidation.reason || 'Please enter a valid official enrollment URL.');
      return;
    }

    setSubmittingCourse(true);
    try {
      const res = await bionexaApi.submitCourse({
        title: submitForm.title.trim(),
        provider: submitForm.provider.trim(),
        instructor: submitForm.instructor.trim() || undefined,
        category: submitForm.category,
        deliveryMode: submitForm.deliveryMode,
        duration: submitForm.duration.trim(),
        fees: submitForm.fees.trim(),
        pricingType: submitForm.pricingType,
        registrationUrl: urlValidation.normalizedUrl,
        registrationDeadline: submitForm.registrationDeadline.trim() || undefined,
        eligibility: submitForm.eligibility.trim() || undefined,
        certificateInfo: submitForm.certificateInfo.trim() || undefined,
        curriculum: parseCurriculumInput(submitForm.curriculumText),
        description: submitForm.description.trim()
      });

      setSubmitReceipt({
        title: submitForm.title.trim(),
        message:
          res.message ||
          'Course submitted for administrator approval. It will appear publicly once verified and approved.'
      });
      addToast('Course submitted for administrator approval.', 'success');
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to submit course. Please verify all required fields.');
    } finally {
      setSubmittingCourse(false);
    }
  };

  const handleQuizAnswer = (qId: string, optIndex: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const calculateScore = () => {
    if (!selectedCourse?.quiz?.length) return 0;
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
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Course Specification Detail Modal */}
      <CourseDetailModal course={detailCourse} onClose={() => setDetailCourse(null)} />

      {/* Public Third-Party Course Submission Modal */}
      {submitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-course-modal-title"
          onClick={() => setSubmitModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <h2 id="submit-course-modal-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  Submit a Third-Party Biotechnology Course
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  All submissions are listed as third-party courses and require administrator approval before publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                aria-label="Close course submission form"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitReceipt ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    Pending Administrator Approval
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {submitReceipt.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    {submitReceipt.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="px-5 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCourse} className="p-6 space-y-4 overflow-y-auto flex-1">
                {submitError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Title *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      value={submitForm.title}
                      onChange={(e) => setSubmitForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Applied Microbial Genomics"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Provider / Institution *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={submitForm.provider}
                      onChange={(e) => setSubmitForm((prev) => ({ ...prev, provider: e.target.value }))}
                      placeholder="e.g., NPTEL / IIT Madras"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={submitForm.category}
                      onChange={(e) => setSubmitForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Delivery Mode
                    </label>
                    <select
                      value={submitForm.deliveryMode}
                      onChange={(e) => setSubmitForm((prev) => ({ ...prev, deliveryMode: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {COURSE_DELIVERY_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Duration *
                    </label>
                    <input
                      type="text"
                      required
                      value={submitForm.duration}
                      onChange={(e) => setSubmitForm((prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g., 8 Weeks"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pricing Classification *
                    </label>
                    <select
                      value={submitForm.pricingType}
                      onChange={(e) =>
                        setSubmitForm((prev) => ({
                          ...prev,
                          pricingType: e.target.value === 'paid' ? 'paid' : 'free'
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Fees *
                    </label>
                    <input
                      type="text"
                      required
                      value={submitForm.fees}
                      onChange={(e) => {
                        const feesVal = e.target.value;
                        setSubmitForm((prev) => ({
                          ...prev,
                          fees: feesVal,
                          pricingType: feesVal.trim() ? classifyCoursePricing(feesVal) : prev.pricingType
                        }));
                      }}
                      placeholder="e.g., Free or ₹1,500"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Registration Deadline
                    </label>
                    <input
                      type="text"
                      value={submitForm.registrationDeadline}
                      onChange={(e) =>
                        setSubmitForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))
                      }
                      placeholder="YYYY-MM-DD or Rolling"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Enrollment URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={submitForm.registrationUrl}
                    onChange={(e) =>
                      setSubmitForm((prev) => ({ ...prev, registrationUrl: e.target.value }))
                    }
                    placeholder="https://provider-domain.org/course-enrollment"
                    className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                      submitUrlCheck && !submitUrlCheck.valid
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {submitUrlCheck && (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        submitUrlCheck.valid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {submitUrlCheck.valid
                        ? `Validated enrollment destination: ${submitUrlCheck.domain}`
                        : submitUrlCheck.reason}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Eligibility (Optional)
                    </label>
                    <input
                      type="text"
                      value={submitForm.eligibility}
                      onChange={(e) =>
                        setSubmitForm((prev) => ({ ...prev, eligibility: e.target.value }))
                      }
                      placeholder="e.g., B.Sc / M.Sc Life Sciences"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Provider Certificate Information (Optional)
                    </label>
                    <input
                      type="text"
                      value={submitForm.certificateInfo}
                      onChange={(e) =>
                        setSubmitForm((prev) => ({ ...prev, certificateInfo: e.target.value }))
                      }
                      placeholder="Leave blank if no certificate is offered"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Description *
                  </label>
                  <textarea
                    required
                    minLength={15}
                    rows={3}
                    value={submitForm.description}
                    onChange={(e) =>
                      setSubmitForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Describe the learning objectives, hands-on components, and target audience..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Curriculum Modules (Optional, one module per line)
                  </label>
                  <textarea
                    rows={2}
                    value={submitForm.curriculumText}
                    onChange={(e) =>
                      setSubmitForm((prev) => ({ ...prev, curriculumText: e.target.value }))
                    }
                    placeholder={'Module 1: Experimental Design\nModule 2: Sequencing Data QC'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>
                    Submitted courses are tagged as <strong>Third-Party Courses</strong> and queued for administrator verification. BIO-INEXA does not provide or certify third-party courses.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSubmitModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCourse || Boolean(submitUrlCheck && !submitUrlCheck.valid)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingCourse ? 'Submitting...' : 'Submit for Approval'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Biotechnology Courses &amp; Learning Directory
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Browse verified third-party and institutional biotechnology courses with direct official portal enrollment, clear Free/Paid classification, and provider transparency.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenSubmitModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Submit Course</span>
        </button>
      </div>

      {/* Phase 13 Database-Connected Course Discovery Catalog */}
      <section className="space-y-6" aria-label="Course Discovery Directory">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Course Discovery Directory
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              All Biotechnology Educational Courses ({filteredLiveCourses.length})
            </h2>
          </div>

          {/* Search, Pricing, Availability & Expired Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] sm:w-64">
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
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Free / Paid Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs" role="group" aria-label="Filter by pricing">
              {(['all', 'free', 'paid'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPricingFilter(tier)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-colors cursor-pointer ${
                    pricingFilter === tier
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tier === 'all' ? 'All Fees' : tier === 'free' ? 'Free' : 'Paid'}
                </button>
              ))}
            </div>

            {/* Availability Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs" role="group" aria-label="Filter by availability">
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

            {expiredCount > 0 && (
              <button
                type="button"
                onClick={() => setShowExpired((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  showExpired
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {showExpired ? `Showing expired (${expiredCount})` : `Show expired (${expiredCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Managed Course Categories Filter Strip */}
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

          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-[#14A3A0] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory.toLowerCase() === cat.toLowerCase() ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
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
        ) : catalogError ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-3">
            <AlertCircle className="w-9 h-9 mx-auto text-rose-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Unable to load courses right now
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {catalogError}
            </p>
            <button
              type="button"
              onClick={loadCourses}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0B2A5B] text-white rounded-xl hover:bg-blue-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
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
                setPricingFilter('all');
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
              const expired = isCourseExpired(course);
              const closed = isCourseRegistrationClosed(course);
              const urlCheck = validateCourseRegistrationUrl(course.registrationUrl);
              const providerType = normalizeCourseProviderType(course.providerType);
              const isThirdParty = providerType === 'third_party';
              const pricingType = classifyCoursePricing(course.fees, course.pricingType);
              const imgSrc =
                imgErrors[course.id] || !course.imageUrl
                  ? getDefaultCourseImageForCategory(course.category)
                  : course.imageUrl;

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
                            {course.category || 'Biotechnology'}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md ${
                              isThirdParty
                                ? 'bg-slate-900/85 text-sky-200'
                                : 'bg-[#14A3A0]/95 text-white'
                            }`}
                          >
                            {isThirdParty ? 'Third-Party' : 'BIO-INEXA'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase backdrop-blur-md ${
                              pricingType === 'free'
                                ? 'bg-emerald-600/90 text-white'
                                : 'bg-indigo-600/90 text-white'
                            }`}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>{pricingType === 'free' ? 'Free' : 'Paid'}</span>
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                              expired
                                ? 'bg-rose-700/90 text-white'
                                : closed
                                ? 'bg-slate-700/90 text-slate-200'
                                : 'bg-emerald-600/90 text-white'
                            }`}
                          >
                            {expired ? 'Expired' : closed ? 'Closed' : 'Available'}
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
                          <span>{course.duration || 'Duration TBA'}</span>
                        </span>
                        {course.deliveryMode && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-sky-200 font-medium">
                            {course.deliveryMode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Course Card Body */}
                    <div className="p-5 space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#14A3A0] mb-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{course.provider || 'Course Provider'}</span>
                          </span>
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

                      {/* Key Specs (saved fields only) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        {course.eligibility && (
                          <div className="flex items-start gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-1" title={course.eligibility}>
                              <strong className="text-slate-700 dark:text-slate-200">Eligibility:</strong> {course.eligibility}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate" title={course.fees}>
                            <strong className="text-slate-700 dark:text-slate-200">Fees:</strong>{' '}
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              {course.fees || 'Not specified'}
                            </span>
                          </span>
                          {course.registrationDeadline && (
                            <span className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                              <Calendar className="w-3 h-3 text-amber-500" />
                              <span>{course.registrationDeadline}</span>
                            </span>
                          )}
                        </div>
                        {urlCheck.valid && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Official portal: {urlCheck.domain}</span>
                          </div>
                        )}
                        {course.certificateInfo && (
                          <div className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-200/70 dark:border-amber-800/40">
                            <Award className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <span className="line-clamp-1">
                              {isThirdParty ? 'Provider Certificate: ' : ''}
                              {course.certificateInfo}
                            </span>
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

                      {expired ? (
                        <button
                          type="button"
                          disabled
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
                        >
                          Expired
                        </button>
                      ) : closed ? (
                        <button
                          type="button"
                          disabled
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
                        >
                          Registration Closed
                        </button>
                      ) : !urlCheck.valid ? (
                        <button
                          type="button"
                          onClick={() => setDetailCourse(course)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold text-center cursor-pointer"
                        >
                          View Details
                        </button>
                      ) : (
                        <a
                          href={urlCheck.normalizedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5"
                        >
                          <span>Register</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Honest Self-Study Reference & Practice Quiz Section (No Fake Enrollment or Certificates) */}
      {selectedCourse && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                BIO-INEXA Self-Study Practice · Unaccredited Reference Notes
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Open Protocol Notes &amp; Concept Check Quizzes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Free practice reference materials for self-assessment only. No course enrollment is recorded and no certificates are issued from this section.
              </p>
            </div>

            {courses.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {courses.map((refModule) => (
                  <button
                    key={refModule.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourse(refModule);
                      setActiveLesson(refModule.lessons[0]);
                      setActiveTab('lessons');
                      setQuizSubmitted(false);
                      setSelectedAnswers({});
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                      selectedCourse.id === refModule.id
                        ? 'bg-[#0B2A5B] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {refModule.category}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Top Header */}
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
                  Reference Notes · Unaccredited self-study guide (no certificate issued)
                </p>
              </div>
            </div>

            {/* Video / Content Display */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800">
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
                    <p className="text-sm font-semibold text-white">{activeLesson?.title || 'Reference Topic Viewer'}</p>
                    <p className="text-xs text-slate-400 mt-1">Review the reference notes and practice quiz below.</p>
                  </div>
                )}
              </div>

              {/* Right Topic List */}
              <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-900 flex flex-col divide-y divide-slate-200 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
                <div className="p-3 bg-white dark:bg-slate-800/80 font-semibold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Study Topics</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedCourse.lessons.length} Topics
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedCourse.lessons.map((lesson, idx) => {
                    const isCurrent = activeLesson?.id === lesson.id;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setActiveLesson(lesson)}
                        className={`w-full text-left p-3.5 cursor-pointer text-xs flex items-start justify-between gap-3 transition-colors ${
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
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tab Navigation for Notes & Practice Quiz */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('lessons')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'lessons'
                    ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Topic Overview &amp; Key Concepts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Bench Protocols &amp; Outline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quiz')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'quiz'
                    ? 'bg-[#14A3A0] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Practice Self-Check Quiz</span>
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
                    <p className="text-xs text-slate-500 mt-0.5">Estimated study time: {activeLesson?.duration}</p>
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
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4 max-w-3xl">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    Reference Outline
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
                        Practice Quiz: {selectedCourse.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Unaccredited self-check quiz for personal review (no certificate issued).
                      </p>
                    </div>
                    {quizSubmitted && (
                      <button
                        type="button"
                        onClick={resetQuiz}
                        className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Quiz</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    {selectedCourse.quiz.map((q, idx) => {
                      const userAnswer = selectedAnswers[q.id];

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
                                  type="button"
                                  disabled={quizSubmitted}
                                  onClick={() => handleQuizAnswer(q.id, optIdx)}
                                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between cursor-pointer ${optionStyle}`}
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
                        type="button"
                        onClick={handleQuizSubmit}
                        disabled={Object.keys(selectedAnswers).length < selectedCourse.quiz.length}
                        className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                      >
                        Check Practice Answers
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
                      <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                        Practice Quiz Score
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                        {calculateScore()}%
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {calculateScore() >= 60
                          ? 'Solid conceptual mastery on this self-check review. Note: practice quizzes are for self-study only and do not issue certificates.'
                          : 'Review the scientific explanations above and retake the quiz anytime.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
