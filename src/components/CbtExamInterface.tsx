import React, { useState, useEffect, useRef } from 'react';
import { Clock, Volume2, VolumeX, AlertTriangle, Globe, LogOut, Sun, Moon, Bell } from 'lucide-react';
import { ExamLanguage } from '../lib/syllabus';
import {
  StudentQuestionItem,
  QuestionResponseState,
  getPaletteStatus,
  PaletteStatus,
} from '../lib/examEngine';
import { soundManager } from '../lib/sound';

interface CbtExamInterfaceProps {
  title: string;
  candidateName: string;
  rollNumber: string;
  questions: StudentQuestionItem[];
  initialLanguage: ExamLanguage;
  remainingSeconds: number;
  isPaused?: boolean;
  broadcastMessage?: string | null;
  broadcastId?: string | null;
  initialResponses?: Record<string, QuestionResponseState>;
  isProctored?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onProgressUpdate?: (
    currentQuestion: number,
    responses: Record<string, QuestionResponseState>,
    proctoringAlert?: string
  ) => void;
  onSubmitExam: (
    responses: Record<string, QuestionResponseState>,
    timeTakenSeconds: number
  ) => void;
  onLeaveExam: () => void;
}

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
}

export const CbtExamInterface: React.FC<CbtExamInterfaceProps> = ({
  title,
  candidateName,
  rollNumber,
  questions,
  initialLanguage,
  remainingSeconds: externalRemainingSeconds,
  isPaused = false,
  broadcastMessage = null,
  broadcastId = null,
  initialResponses,
  isProctored = false,
  theme = 'light',
  onToggleTheme,
  onProgressUpdate,
  onSubmitExam,
  onLeaveExam,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [language, setLanguage] = useState<ExamLanguage>(initialLanguage);
  const [responses, setResponses] = useState<Record<string, QuestionResponseState>>(() => {
    if (initialResponses && Object.keys(initialResponses).length > 0) {
      return initialResponses;
    }
    const map: Record<string, QuestionResponseState> = {};
    questions.forEach((q, idx) => {
      map[q.id] = {
        selectedOption: null,
        markedForReview: false,
        visited: idx === 0,
      };
    });
    return map;
  });

  const [localSeconds, setLocalSeconds] = useState(externalRemainingSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [muted, setMuted] = useState(soundManager.muted);
  const [proctorBanner, setProctorBanner] = useState<string | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<string | null>(null);

  const startedAtRef = useRef<number>(Date.now());
  const submittedRef = useRef<boolean>(false);
  const lastAlertTimeRef = useRef<number>(0);
  const lastSeenBroadcastKeyRef = useRef<string | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const currentIdxRef = useRef(currentIdx);
  currentIdxRef.current = currentIdx;

  // Automatically display and dismiss Examiner Broadcast Notice after 4.5 seconds
  useEffect(() => {
    const trimmed = broadcastMessage ? broadcastMessage.trim() : '';
    if (!trimmed) {
      setActiveBroadcast(null);
      return;
    }

    const uniqueKey = broadcastId ? `${broadcastId}:${trimmed}` : trimmed;
    if (lastSeenBroadcastKeyRef.current === uniqueKey) {
      return;
    }
    lastSeenBroadcastKeyRef.current = uniqueKey;
    setActiveBroadcast(trimmed);

    if (broadcastTimerRef.current) {
      clearTimeout(broadcastTimerRef.current);
    }
    broadcastTimerRef.current = setTimeout(() => {
      setActiveBroadcast(null);
      broadcastTimerRef.current = null;
    }, 4500);
  }, [broadcastMessage, broadcastId]);

  useEffect(() => {
    return () => {
      if (broadcastTimerRef.current) {
        clearTimeout(broadcastTimerRef.current);
      }
    };
  }, []);

  // Keep local timer synced with authoritative server timer (or tick locally in Solo/Practice mode)
  useEffect(() => {
    setLocalSeconds(externalRemainingSeconds);
  }, [externalRemainingSeconds]);

  useEffect(() => {
    if (isProctored) {
      // In proctored server mode, server broadcasts remainingSeconds, but we also guard 0 locally
      if (externalRemainingSeconds <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        onSubmitExam(responsesRef.current, elapsed);
      }
      return;
    }
    // Solo / Practice mode local countdown
    const timer = setInterval(() => {
      if (isPaused || submittedRef.current) return;
      setLocalSeconds((prev) => {
        if (prev <= 1) {
          submittedRef.current = true;
          const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
          setTimeout(() => onSubmitExam(responsesRef.current, elapsed), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isProctored, isPaused, externalRemainingSeconds, onSubmitExam]);

  // Proctoring event listeners (visibilitychange, window blur)
  useEffect(() => {
    const triggerProctorAlert = (reason: string) => {
      if (!isProctored || submittedRef.current) return;
      const now = Date.now();
      if (now - lastAlertTimeRef.current < 2500) return; // debounce rapid blur+visibility events
      lastAlertTimeRef.current = now;
      soundManager.playProctoringAlert();
      setProctorBanner(`Proctoring Alert recorded: ${reason}`);
      onProgressUpdate?.(currentIdxRef.current + 1, responsesRef.current, reason);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerProctorAlert('switched tabs / minimized examination window');
      }
    };

    const handleWindowBlur = () => {
      triggerProctorAlert('switched away from the examination window / lost focus');
    };

    if (isProctored) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isProctored, onProgressUpdate]);

  const currentQuestion = questions[currentIdx];
  if (!currentQuestion) return null;

  const currentResp = responses[currentQuestion.id] || {
    selectedOption: null,
    markedForReview: false,
    visited: true,
  };

  const syncProgress = (
    nextIdx: number,
    nextResponses: Record<string, QuestionResponseState>
  ) => {
    onProgressUpdate?.(nextIdx + 1, nextResponses);
  };

  const goToQuestion = (index: number) => {
    const bounded = Math.max(0, Math.min(questions.length - 1, index));
    const targetQ = questions[bounded];
    const nextResponses: Record<string, QuestionResponseState> = {
      ...responses,
      [targetQ.id]: {
        ...(responses[targetQ.id] || { selectedOption: null, markedForReview: false }),
        visited: true,
      },
    };
    setResponses(nextResponses);
    setCurrentIdx(bounded);
    syncProgress(bounded, nextResponses);
  };

  const handleSelectOption = (optionIndex: number) => {
    if (isPaused) return;
    const nextResponses: Record<string, QuestionResponseState> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResp,
        selectedOption: optionIndex,
        visited: true,
      },
    };
    setResponses(nextResponses);
    syncProgress(currentIdx, nextResponses);
  };

  const handleClearResponse = () => {
    if (isPaused) return;
    const nextResponses: Record<string, QuestionResponseState> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResp,
        selectedOption: null,
        markedForReview: false,
        visited: true,
      },
    };
    setResponses(nextResponses);
    syncProgress(currentIdx, nextResponses);
  };

  const handleMarkForReview = () => {
    if (isPaused) return;
    const nextIdx = currentIdx < questions.length - 1 ? currentIdx + 1 : currentIdx;
    const nextQ = questions[nextIdx];
    const nextResponses: Record<string, QuestionResponseState> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResp,
        markedForReview: !currentResp.markedForReview,
        visited: true,
      },
      [nextQ.id]: {
        ...(responses[nextQ.id] || { selectedOption: null, markedForReview: false }),
        visited: true,
      },
    };
    setResponses(nextResponses);
    setCurrentIdx(nextIdx);
    syncProgress(nextIdx, nextResponses);
  };

  const handleSaveAndNext = () => {
    if (isPaused) return;
    const nextIdx = currentIdx < questions.length - 1 ? currentIdx + 1 : currentIdx;
    const nextQ = questions[nextIdx];
    const nextResponses: Record<string, QuestionResponseState> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResp,
        visited: true,
      },
      [nextQ.id]: {
        ...(responses[nextQ.id] || { selectedOption: null, markedForReview: false }),
        visited: true,
      },
    };
    setResponses(nextResponses);
    setCurrentIdx(nextIdx);
    syncProgress(nextIdx, nextResponses);
  };

  const handleConfirmSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    soundManager.playSubmissionChime();
    const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onSubmitExam(responses, elapsed);
  };

  const toggleSound = () => {
    soundManager.muted = !muted;
    setMuted(soundManager.muted);
  };

  // Compute palette summary counts
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let notVisitedCount = 0;
  let markedCount = 0;
  let answeredMarkedCount = 0;

  questions.forEach((q) => {
    const status = getPaletteStatus(responses[q.id]);
    if (status === 'answered') answeredCount++;
    else if (status === 'not_answered') notAnsweredCount++;
    else if (status === 'not_visited') notVisitedCount++;
    else if (status === 'marked') markedCount++;
    else if (status === 'answered_marked') {
      answeredMarkedCount++;
      answeredCount++;
    }
  });

  const getPaletteButtonClass = (status: PaletteStatus, isCurrent: boolean) => {
    const base =
      'h-10 w-full rounded font-mono text-sm font-semibold transition-all flex items-center justify-center relative select-none ';
    const ring = isCurrent ? 'ring-2 ring-blue-700 ring-offset-1 ' : '';
    switch (status) {
      case 'answered':
        return base + ring + 'bg-emerald-600 text-white border border-emerald-700';
      case 'not_answered':
        return base + ring + 'bg-red-600 text-white border border-red-700';
      case 'marked':
        return base + ring + 'bg-purple-700 text-white border border-purple-800';
      case 'answered_marked':
        return base + ring + 'bg-purple-700 text-white border border-emerald-400';
      default:
        return base + ring + 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Top CBT Header Bar matching user screenshot */}
      <header className="bg-[#0B4F9E] text-white px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm border-b border-blue-900">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded bg-white text-[#0B4F9E] font-extrabold flex items-center justify-center text-sm shrink-0">
            AC
          </div>
          <div className="truncate">
            <h1 className="font-bold text-base lg:text-lg tracking-tight truncate">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 bg-blue-950/60 border border-blue-700 rounded px-2.5 py-1">
            <Globe className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            <label htmlFor="cbt-lang-select" className="sr-only">
              Question Language
            </label>
            <select
              id="cbt-lang-select"
              aria-label="Question Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as ExamLanguage)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="en" className="text-slate-900">
                English
              </option>
              <option value="hi" className="text-slate-900">
                हिन्दी (Hindi)
              </option>
              <option value="bilingual" className="text-slate-900">
                Hindi + English
              </option>
            </select>
          </div>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="px-2.5 py-1.5 rounded bg-blue-950/60 hover:bg-blue-800 text-xs font-bold text-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-200" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? 'Unmute Examination Audio' : 'Mute Examination Audio'}
            className="p-2 rounded bg-blue-950/50 hover:bg-blue-800 text-blue-100 transition-colors cursor-pointer"
            title={muted ? 'Unmute alerts' : 'Mute alerts'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Timer Display */}
          <div
            className={`bg-white px-3.5 py-1.5 rounded flex items-center gap-2 font-mono font-bold text-base sm:text-lg tabular-nums shadow-xs ${
              localSeconds <= 300 ? 'text-red-600 animate-pulse' : 'text-red-600'
            }`}
            aria-live="polite"
          >
            <Clock className="w-4 h-4 text-red-600 shrink-0" />
            <span>{formatTimer(localSeconds)}</span>
          </div>

          {/* Leave Test Button */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="px-3 py-1.5 rounded bg-blue-950/70 hover:bg-red-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* Examiner Broadcast Notice Temporary Notification (auto-dismisses after ~4.5 seconds) */}
      {activeBroadcast && (
        <div
          role="status"
          aria-live="assertive"
          className="bg-amber-50 border-b border-amber-300 px-6 py-3 text-amber-900 text-sm font-semibold flex items-center gap-2.5 shadow-xs transition-all duration-300 pointer-events-none"
        >
          <Bell className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Examiner Notice:</strong> {activeBroadcast}
          </span>
        </div>
      )}

      {/* Proctoring Warning Banner */}
      {proctorBanner && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{proctorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setProctorBanner(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Paused Overlay */}
      {isPaused && (
        <div className="bg-amber-600 text-white px-6 py-2 text-center text-sm font-bold">
          Examination Paused by Examiner — Please wait for the host to resume the timer.
        </div>
      )}

      {/* Main Two-Column NIELIT CBT Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 max-w-[1600px] w-full mx-auto">
        {/* Left Question Stage (9 columns on desktop) */}
        <main className="lg:col-span-9 bg-white border border-slate-200 rounded shadow-xs flex flex-col justify-between min-h-[540px]">
          <div>
            {/* Question Number & Marks Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900 text-base">
                  Question No. {currentIdx + 1}
                </span>
                <span className="text-xs text-slate-500">
                  · {currentQuestion.difficulty}
                </span>
              </div>
              <div className="font-bold text-slate-800 text-sm tabular-nums">Marks: 1</div>
            </div>

            {/* Question Text */}
            <div className="p-5 sm:p-6 space-y-6">
              <div className="space-y-2.5 text-slate-900">
                {(language === 'en' || language === 'bilingual') && (
                  <p className="text-base sm:text-lg font-semibold leading-relaxed whitespace-pre-line">
                    {currentQuestion.questionEn}
                  </p>
                )}
                {(language === 'hi' || language === 'bilingual') && (
                  <p
                    className={`leading-relaxed whitespace-pre-line ${
                      language === 'bilingual'
                        ? 'text-base font-medium text-slate-700 pt-1 border-t border-slate-100'
                        : 'text-base sm:text-lg font-semibold text-slate-900'
                    }`}
                  >
                    {currentQuestion.questionHi}
                  </p>
                )}
              </div>

              {/* Four Answer Options */}
              <div className="space-y-3 pt-2" role="radiogroup" aria-label={`Question ${currentIdx + 1} options`}>
                {[0, 1, 2, 3].map((optIndex) => {
                  const letter = ['A', 'B', 'C', 'D'][optIndex];
                  const isSelected = currentResp.selectedOption === optIndex;
                  const optEn = currentQuestion.optionsEn[optIndex];
                  const optHi = currentQuestion.optionsHi[optIndex];
                  const showBothOpts =
                    language === 'bilingual' &&
                    optHi &&
                    optHi.trim().toLowerCase() !== optEn.trim().toLowerCase();

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectOption(optIndex)}
                      className={`w-full text-left px-4 py-3.5 rounded border transition-all flex items-start gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-600 ring-1 ring-blue-600 text-slate-950'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-slate-800'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <div className="text-sm sm:text-base font-medium leading-snug">
                        <span>
                          {letter}.{' '}
                          {language === 'hi' ? optHi : optEn}
                        </span>
                        {showBothOpts && (
                          <span className="block text-sm text-slate-600 mt-0.5">
                            {optHi}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom CBT Action Controls Bar matching user screenshot */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => goToQuestion(currentIdx - 1)}
                className="px-4 py-2.5 rounded text-sm font-bold bg-slate-300 text-slate-800 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleClearResponse}
                className="px-4 py-2.5 rounded text-sm font-bold bg-[#DC2626] hover:bg-red-700 text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear Response
              </button>
              <button
                type="button"
                onClick={handleMarkForReview}
                className="px-4 py-2.5 rounded text-sm font-bold bg-[#6D28D9] hover:bg-purple-800 text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {currentResp.markedForReview ? 'Unmark Review' : 'Mark for Review'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveAndNext}
              className="px-6 py-2.5 rounded text-sm font-bold bg-[#15803D] hover:bg-green-800 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Save &amp; Next
            </button>
          </div>
        </main>

        {/* Right Question Palette Sidebar (3 columns on desktop) */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded shadow-xs flex flex-col justify-between p-4 space-y-4">
          <div className="space-y-4">
            {/* Candidate Identity */}
            <div className="border-b border-slate-200 pb-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Candidate:</span>
                <span className="font-bold text-slate-900 truncate max-w-[160px]">{candidateName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Roll No:</span>
                <span className="font-mono font-bold text-slate-900">{rollNumber}</span>
              </div>
            </div>

            {/* Question Palette Grid */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Question Palette
              </h2>
              <div className="grid grid-cols-5 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const st = getPaletteStatus(responses[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(idx)}
                      aria-label={`Question ${idx + 1}, status ${st.replace('_', ' ')}`}
                      className={getPaletteButtonClass(st, idx === currentIdx)}
                    >
                      {idx + 1}
                      {st === 'answered_marked' && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white absolute -top-1 -right-1"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Palette Status Legend & Submit Button */}
          <div className="space-y-4 pt-3 border-t border-slate-200">
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-xs bg-slate-200 border border-slate-300 inline-block" />
                  <span>Not Visited</span>
                </div>
                <span className="font-mono font-semibold tabular-nums">{notVisitedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>Answered</span>
                </div>
                <span className="font-mono font-semibold tabular-nums">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-xs bg-red-600 inline-block" />
                  <span>Not Answered</span>
                </div>
                <span className="font-mono font-semibold tabular-nums">{notAnsweredCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-xs bg-purple-700 inline-block" />
                  <span>Marked for Review</span>
                </div>
                <span className="font-mono font-semibold tabular-nums">{markedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-xs bg-purple-700 relative inline-block">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
                  </span>
                  <span>Answered &amp; Review</span>
                </div>
                <span className="font-mono font-semibold tabular-nums">{answeredMarkedCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider bg-[#B91C1C] hover:bg-red-800 text-white transition-colors shadow-xs cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </aside>
      </div>

      {/* Confirm Test Submission Modal matching Screenshot_2026-10-30_192522_51048cdd.png */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-[#B91C1C] text-white px-5 py-3.5 font-bold text-base" id="submit-modal-title">
              Confirm Test Submission
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Are you sure you want to submit the examination? You will not be able to change your
                answers once submitted.
              </p>

              <div className="border border-slate-200 rounded p-3.5 space-y-2 text-sm bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Total Questions:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {questions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 font-semibold">Answered:</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-600 font-semibold">Not Answered:</span>
                  <span className="font-mono font-bold text-red-600 tabular-nums">
                    {questions.length - answeredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-700 font-semibold">Marked for Review:</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">
                    {markedCount + answeredMarkedCount}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  className="px-5 py-2 rounded bg-[#B91C1C] hover:bg-red-800 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  Yes, Submit Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaving Active Test Warning Modal (Section 25) */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-modal-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-amber-600 text-white px-5 py-3.5 font-bold text-base flex items-center gap-2" id="leave-modal-title">
              <AlertTriangle className="w-5 h-5" />
              <span>Active Examination Warning</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Your test is currently in progress. Leaving may submit or terminate your
                examination.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-5 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  Wait (Continue Exam)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveModal(false);
                    onLeaveExam();
                  }}
                  className="px-4 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Still Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
