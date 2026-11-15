import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import type { UnifiedCourse } from '../../services/courses/courseHelpers';
import {
  getDefaultCourseImageForCategory,
  isCourseRegistrationClosed,
  isValidCourseRegistrationUrl,
  normalizeCourseCategory
} from '../../services/courses/courseHelpers';

interface CourseDetailModalProps {
  course: UnifiedCourse | null;
  onClose: () => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({ course, onClose }) => {
  const [imgError, setImgError] = useState(false);

  if (!course) return null;

  const title = course.title || course.name || 'Biotechnology Course';
  const category = normalizeCourseCategory(course.category);
  const isClosed = isCourseRegistrationClosed(course);
  const destinationUrl = course.registrationUrl || course.registrationLink || '';
  const hasValidUrl = isValidCourseRegistrationUrl(destinationUrl);
  const displayImage =
    imgError || !course.imageUrl ? getDefaultCourseImageForCategory(category) : course.imageUrl;
  const curriculum = course.curriculum || course.syllabus || [];
  const certInfo = (course.certificateInfo || '').trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Course Banner Image */}
        <div className="relative h-36 sm:h-44 w-full bg-slate-100 dark:bg-slate-800 shrink-0">
          <img
            src={displayImage}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-5 right-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0B2A5B]/90 text-white">
              <BookOpen className="w-3 h-3 text-teal-300" />
              <span>{category}</span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isClosed ? 'bg-slate-700/90 text-slate-200' : 'bg-emerald-600/90 text-white'
              }`}
            >
              <span>{isClosed ? 'Closed' : 'Available'}</span>
            </span>

            {course.featured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/90 text-white">
                <Sparkles className="w-3 h-3" />
                <span>Featured</span>
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Details Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>{course.provider || 'Course Provider'}</span>
            </div>
            <h2 id="course-modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {title}
            </h2>
            {course.instructor && course.instructor !== course.provider && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Instructor / Coordinator: {course.instructor}
              </p>
            )}
          </div>

          {/* 4 Key Specification Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Duration</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#14A3A0] shrink-0" />
                <span>{course.duration}</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Delivery Mode</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-500 shrink-0" />
                <span>{course.deliveryMode}</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Fees</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                {course.fees || 'See Provider Portal'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Reg. Deadline</span>
              <span className={`font-bold mt-0.5 flex items-center gap-1 ${isClosed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                <Calendar className="w-3 h-3 shrink-0" />
                <span>{course.registrationDeadline || 'Open / Rolling'}</span>
              </span>
            </div>
          </div>

          {/* Course Description */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Course Description</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs whitespace-pre-line">
              {course.description}
            </p>
          </div>

          {/* Eligibility */}
          <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 space-y-1">
            <div className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5 text-xs">
              <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Eligibility</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
              {course.eligibility || 'Open to Life Sciences & Biotechnology learners'}
            </p>
          </div>

          {/* Curriculum */}
          {curriculum.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-[#14A3A0]" />
                <span>Curriculum ({curriculum.length} Modules)</span>
              </h4>
              <ul className="space-y-1.5">
                {curriculum.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14A3A0] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Certificate Info (Only displayed if applicable — never fabricated) */}
          {certInfo && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Certificate Information</span>
              </div>
              <p className="text-amber-900/90 dark:text-amber-200/90 text-xs leading-relaxed">
                {certInfo}
              </p>
            </div>
          )}

          {/* Official Source Transparency */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Enrollment and any applicable program credentials are administered directly by{' '}
              <strong className="text-slate-800 dark:text-slate-200">{course.provider}</strong> on their official portal.
            </span>
          </div>
        </div>

        {/* Pinned Modal Footer Actions */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold cursor-pointer"
          >
            Close
          </button>

          {isClosed ? (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed"
            >
              Registration Closed
            </button>
          ) : !hasValidUrl ? (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed"
            >
              Registration Link Pending
            </button>
          ) : (
            <a
              href={destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span>Go to Official Registration Portal</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
