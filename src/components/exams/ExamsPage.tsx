import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_EXAMS } from '../../data/seedData';
import { Exam, ExamMockQuestion } from '../../types';
import {
  Award,
  Calendar,
  Clock,
  Download,
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react';

export const ExamsPage: React.FC = () => {
  const { addToast } = useApp();
  const [selectedExam, setSelectedExam] = useState<Exam>(SEED_EXAMS[0]);

  // Mock Test State
  const [isMockActive, setIsMockActive] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes (600 seconds)
  const [mockFinished, setMockFinished] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug');
    const mockParam = params.get('mock');
    if (slugParam) {
      const match = SEED_EXAMS.find((e) => e.slug === slugParam);
      if (match) setSelectedExam(match);
    }
    if (mockParam === 'true') {
      setIsMockActive(true);
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    let timer: any;
    if (isMockActive && !mockFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleMockSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isMockActive, mockFinished, timeLeft]);

  const handleStartMock = () => {
    setIsMockActive(true);
    setMockFinished(false);
    setTimeLeft(600);
    setCurrentQIndex(0);
    setAnswers({});
    setMarkedForReview([]);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleSelectAnswer = (qId: string, optIndex: number) => {
    if (mockFinished) return;
    setAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const toggleReview = (qId: string) => {
    setMarkedForReview((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleMockSubmit = () => {
    setMockFinished(true);
    addToast('Mock test submitted. Review your diagnostic analytics below.', 'info');
  };

  const currentQ: ExamMockQuestion | undefined = selectedExam.mockQuestions[currentQIndex];

  // Calculate scores (assume 4 marks per correct, -1 per incorrect)
  const calculateMockScore = () => {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    selectedExam.mockQuestions.forEach((q) => {
      const userAns = answers[q.id];
      if (userAns === undefined) {
        unattempted++;
      } else if (userAns === q.correctIndex) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const totalMarks = correct * 4 - incorrect * 1;
    const maxPossible = selectedExam.mockQuestions.length * 4;

    return { correct, incorrect, unattempted, totalMarks, maxPossible };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          National Biotechnology Exam Preparation Hub
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Master CSIR NET Life Sciences, GATE Biotechnology, and DBT-BET with official syllabus matrices, solved PYQ downloads, and live timed mock diagnostics.
        </p>
      </div>

      {/* Exam Selector Strip */}
      <div className="flex flex-wrap gap-3">
        {SEED_EXAMS.map((exam) => (
          <button
            key={exam.id}
            onClick={() => {
              setSelectedExam(exam);
              setIsMockActive(false);
              setMockFinished(false);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              selectedExam.id === exam.id
                ? 'bg-[#0B2A5B] text-white border-[#0B2A5B] shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {exam.shortName} · {exam.fullName.split('-')[0]}
          </button>
        ))}
      </div>

      {/* Active Exam Overview Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
              <Award className="w-4 h-4" />
              <span>Conducted by: {selectedExam.conductingBody}</span>
              <span>·</span>
              <span className="text-slate-500">{selectedExam.frequency}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {selectedExam.fullName}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-right">
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">
                Next Upcoming Exam Date
              </span>
              <span className="text-base font-bold font-mono text-amber-900 dark:text-amber-200">
                {selectedExam.upcomingDate}
              </span>
            </div>
            <button
              onClick={handleStartMock}
              className="px-5 py-3 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Launch Mock Test</span>
            </button>
          </div>
        </div>

        {/* Pattern & Eligibility Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
              Examination Scheme &amp; Pattern
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedExam.patternOverview}
            </p>
            <div className="pt-2 space-y-1.5">
              {selectedExam.sections.map((sec, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{sec.name}</span>
                  <span className="font-mono text-emerald-600 font-bold">{sec.marks} Marks</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
              Eligibility &amp; Age Criteria
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedExam.eligibility}
            </p>
            <div className="pt-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">Application Cycle:</span>
              <p className="text-slate-500">{selectedExam.applicationPeriod}</p>
            </div>
          </div>
        </div>

        {/* High-Yield Topics List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Core High-Yield Syllabus Domains
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {selectedExam.keyTopics.map((topic, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-teal-600 font-bold">&bull;</span>
                <span>{topic}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Downloadable Resources (Syllabus, PYQs) */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Official Question Papers &amp; Syllabus Downloads
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {selectedExam.resources.map((res) => (
              <div
                key={res.id}
                className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{res.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{res.type} · {res.fileSize}</div>
                </div>
                <button
                  onClick={() => addToast(`Downloaded "${res.title}"`, 'success')}
                  className="p-1.5 text-slate-500 hover:text-[#0B2A5B] dark:hover:text-sky-300"
                  title="Download Resource"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Realistic Timed Mock Test Interface */}
      {isMockActive && (
        <div id="mock-section" className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-teal-500/50 shadow-xl p-6 space-y-6">
          {/* Mock Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 block">
                Official Mock Test Simulator
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {selectedExam.shortName} Diagnostic Assessment
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                <Clock className="w-4 h-4 text-rose-500" />
                <span>{formatTime(timeLeft)}</span>
              </div>

              {!mockFinished ? (
                <button
                  onClick={handleMockSubmit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  Submit Mock Test
                </button>
              ) : (
                <button
                  onClick={handleStartMock}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart Test</span>
                </button>
              )}
            </div>
          </div>

          {!mockFinished ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Question Stage (8 cols) */}
              {currentQ && (
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Question <strong className="text-slate-900 dark:text-slate-100 font-mono">{currentQIndex + 1}</strong> of {selectedExam.mockQuestions.length}
                    </span>
                    <span className="font-semibold text-teal-600">{currentQ.subject}</span>
                    <span className="text-slate-400">{currentQ.section}</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                    {currentQ.question}
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = answers[currentQ.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(currentQ.id, optIdx)}
                          className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'border-[#0B2A5B] bg-blue-50/50 dark:bg-slate-700 font-semibold text-[#0B2A5B] dark:text-sky-300'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border flex items-center justify-center font-mono text-xs">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0B2A5B] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigation and Review buttons */}
                  <div className="pt-4 flex items-center justify-between text-xs">
                    <button
                      onClick={() => toggleReview(currentQ.id)}
                      className={`px-3 py-1.5 rounded-lg border font-medium ${
                        markedForReview.includes(currentQ.id)
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      {markedForReview.includes(currentQ.id) ? '★ Marked for Review' : 'Mark for Review'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentQIndex === 0}
                        onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        &larr; Previous
                      </button>
                      <button
                        disabled={currentQIndex === selectedExam.mockQuestions.length - 1}
                        onClick={() => setCurrentQIndex((prev) => Math.min(selectedExam.mockQuestions.length - 1, prev + 1))}
                        className="px-3 py-1.5 rounded-lg bg-[#0B2A5B] text-white font-semibold disabled:opacity-40"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Question Palette (4 cols) */}
              <div className="lg:col-span-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Question Navigation Palette
                </span>

                <div className="grid grid-cols-5 gap-2">
                  {selectedExam.mockQuestions.map((q, idx) => {
                    const isAns = answers[q.id] !== undefined;
                    const isRev = markedForReview.includes(q.id);
                    const isCurr = currentQIndex === idx;

                    let bgClass = 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200';
                    if (isCurr) bgClass = 'ring-2 ring-blue-600 font-bold';
                    if (isAns) bgClass += ' bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                    if (isRev) bgClass += ' bg-amber-100 text-amber-800 border-amber-300';

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`h-9 rounded-lg border flex items-center justify-center font-mono text-xs ${bgClass}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Answered ({Object.keys(answers).length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Marked for Review ({markedForReview.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span>Unattempted ({selectedExam.mockQuestions.length - Object.keys(answers).length})</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Results Screen */
            <div className="space-y-6">
              {(() => {
                const scoreData = calculateMockScore();
                return (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 text-center">
                    <span className="text-xs uppercase font-bold text-slate-400">Diagnostic Summary</span>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                      Score: {scoreData.totalMarks} / {scoreData.maxPossible} Marks
                    </div>
                    <div className="flex justify-center gap-6 text-xs font-semibold">
                      <span className="text-emerald-600">Correct: {scoreData.correct}</span>
                      <span className="text-rose-600">Incorrect (-1): {scoreData.incorrect}</span>
                      <span className="text-slate-500">Unattempted: {scoreData.unattempted}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Review of Question Explanations */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Question Solutions &amp; Scientific Explanations
                </h4>
                {selectedExam.mockQuestions.map((q, idx) => {
                  const userAns = answers[q.id];
                  const isCorrect = userAns === q.correctIndex;

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">Q{idx + 1}. {q.question}</span>
                        {isCorrect ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Correct (+4)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-1 shrink-0">
                            <XCircle className="w-4 h-4" /> Incorrect (-1)
                          </span>
                        )}
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">
                        <strong>Correct Answer:</strong> {q.options[q.correctIndex]}
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-200">Explanation:</strong> {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
