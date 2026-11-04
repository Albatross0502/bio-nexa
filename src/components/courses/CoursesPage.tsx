import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Course, CourseLesson } from '../../types';
import {
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Award,
  ChevronRight,
  FileText,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Printer
} from 'lucide-react';

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

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [earnedCertificate, setEarnedCertificate] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
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

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveLesson(course.lessons[0]);
    setActiveTab('lessons');
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setEarnedCertificate(null);
    window.scrollTo({ top: 300, behavior: 'smooth' });
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          BIO-NEXA Academy &amp; Certification
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Master CRISPR gene editing, bioprocess scale-up, and NGS pipelines with practical video lessons, quiz assessments, and verifiable certificates.
        </p>
      </div>

      {/* Interactive Course Player Stage */}
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
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {selectedCourse.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Instructor: {selectedCourse.instructor} ({selectedCourse.instructorTitle})
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isEnrolled ? (
              <button
                onClick={() => enrollInCourse(selectedCourse.id)}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enroll Free &amp; Unlock Certification</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Enrolled &amp; Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Video / Content Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800">
          {/* Main screen area (7 cols) */}
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
                <p className="text-xs text-slate-400 mt-1">Review the module notes and take the certification quiz below.</p>
              </div>
            )}
          </div>

          {/* Right Playlist & Controls (4 cols) */}
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

        {/* Tab Navigation for Notes & Certification Quiz */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'lessons'
                ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Lesson Overview &amp; Key Concepts
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Downloadable Bench Protocols &amp; Syllabus
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'quiz'
                ? 'bg-[#14A3A0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Interactive Assessment &amp; Certificate</span>
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
                  className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
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
                    Certification Assessment: {selectedCourse.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Answer all questions correctly to qualify for a verifiable BIO-NEXA certificate (Pass threshold: 60%).
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

              {/* Quiz Questions */}
              <div className="space-y-6">
                {selectedCourse.quiz.map((q, idx) => {
                  const userAnswer = selectedAnswers[q.id];
                  const isAnswered = userAnswer !== undefined;
                  const isCorrect = isAnswered && userAnswer === q.correctAnswer;

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

              {/* Submit Quiz button or Score Result */}
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
                      ? 'Congratulations! You met the passing standard and earned a verifiable Certificate.'
                      : 'You scored below the 60% benchmark. Review the key concepts and retake the quiz.'}
                  </p>

                  {earnedCertificate && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 inline-block text-left text-xs max-w-md w-full">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                          <ShieldCheck className="w-4 h-4" />
                          <span>BIO-NEXA Certified Credential</span>
                        </div>
                        <div className="mt-1 font-mono text-slate-700 dark:text-slate-300">
                          Certificate ID: <strong className="text-slate-900 dark:text-white">{earnedCertificate.certificateNumber}</strong>
                        </div>
                        <div className="text-slate-500 mt-0.5">Issued to: {currentUser.name}</div>
                        <div className="text-slate-500">Date: {earnedCertificate.issueDate}</div>
                      </div>

                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => navigate(`/verify-certificate?id=${earnedCertificate.certificateNumber}`)}
                          className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold text-xs rounded-lg"
                        >
                          Verify on Public Registry &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Catalogue Grid: Other Courses */}
      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          All Academy Courses
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((course) => {
            const isSelected = selectedCourse.id === course.id;
            return (
              <div
                key={course.id}
                onClick={() => handleSelectCourse(course)}
                className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#0B2A5B] bg-blue-50/40 dark:bg-slate-800 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    {course.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug hover:text-blue-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Instructor: {course.instructor}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 my-2 leading-relaxed">
                    {course.overview}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{course.duration}</span>
                  <span className="font-semibold text-[#0B2A5B] dark:text-sky-300">
                    {isSelected ? 'Currently Viewing' : 'Select Course &rarr;'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
