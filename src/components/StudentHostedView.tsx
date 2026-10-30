import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, AlertOctagon, Bell } from 'lucide-react';
import { ExamLanguage } from '../lib/syllabus';
import { StudentQuestionItem, QuestionResponseState } from '../lib/examEngine';
import { CbtExamInterface } from './CbtExamInterface';

export interface StudentSessionState {
  sessionId: string;
  hostName: string;
  course: string;
  courseName: string;
  module?: string;
  moduleName?: string;
  chapter?: string;
  chapterName?: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  language: ExamLanguage;
  status: 'WAITING' | 'COUNTDOWN' | 'LIVE' | 'PAUSED' | 'CLOSED';
  countdownSeconds: number;
  remainingSeconds: number;
  broadcastMessage: string | null;
  broadcastId?: string | null;
  broadcastAt?: number | null;
  candidate: {
    rollNumber: string;
    name: string;
    connectionStatus: 'Online' | 'Offline' | 'Removed';
    submissionStatus: 'Not Started' | 'In Progress' | 'Submitted' | 'Auto-Submitted' | 'Removed';
    currentQuestion: number;
    warningsCount: number;
    submittedAt: string | null;
    responses: Record<string, QuestionResponseState>;
  } | null;
  questions: StudentQuestionItem[];
}

interface StudentHostedViewProps {
  session: StudentSessionState;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onProgressUpdate: (
    currentQuestion: number,
    responses: Record<string, QuestionResponseState>,
    proctoringAlert?: string
  ) => void;
  onSubmitExam: (responses: Record<string, QuestionResponseState>) => void;
  onExitToHome: () => void;
}

export const StudentHostedView: React.FC<StudentHostedViewProps> = ({
  session,
  theme = 'light',
  onToggleTheme,
  onProgressUpdate,
  onSubmitExam,
  onExitToHome,
}) => {
  const cand = session.candidate;
  const [waitingBroadcast, setWaitingBroadcast] = useState<string | null>(null);
  const lastSeenBroadcastRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = session.broadcastMessage ? session.broadcastMessage.trim() : '';
    if (!trimmed) {
      setWaitingBroadcast(null);
      return;
    }
    const key = session.broadcastId ? `${session.broadcastId}:${trimmed}` : trimmed;
    if (lastSeenBroadcastRef.current === key) return;
    lastSeenBroadcastRef.current = key;
    setWaitingBroadcast(trimmed);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setWaitingBroadcast(null);
      timerRef.current = null;
    }, 4500);
  }, [session.broadcastMessage, session.broadcastId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!cand || cand.submissionStatus === 'Removed') {
    return (
      <div className="max-w-lg mx-auto my-14 px-4">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Session Access Terminated</h2>
          <p className="text-sm text-slate-600">
            Your candidate entry was removed by the examiner or is no longer active.
          </p>
          <button
            type="button"
            onClick={onExitToHome}
            className="px-5 py-2.5 rounded-lg bg-[#0B4F9E] text-white text-sm font-bold cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // 1. Examination Completed / Submitted Lock Screen (matching Screenshot_2026-10-30_192529_25877f89.png)
  if (
    cand.submissionStatus === 'Submitted' ||
    cand.submissionStatus === 'Auto-Submitted' ||
    session.status === 'CLOSED'
  ) {
    return (
      <div className="max-w-xl mx-auto my-10 px-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-[#0B4F9E] text-white px-6 py-5 text-center">
            <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide">
              Access Computer Preparation
            </h1>
            <p className="text-xs text-blue-200 uppercase tracking-widest mt-1">
              Computer Based Test (CBT) Submission
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-extrabold text-slate-900">Examination Completed</h2>
              <div className="bg-blue-50/80 border border-blue-200 rounded-lg px-4 py-3 text-xs sm:text-sm font-semibold text-blue-900">
                Test submitted successfully. Official results are recorded on Examiner{' '}
                <strong>{session.hostName}</strong>&apos;s server.
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs sm:text-sm text-left bg-slate-50/40">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Candidate Name:</span>
                <span className="font-bold text-slate-900">{cand.name}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Roll Number:</span>
                <span className="font-mono font-bold text-slate-900">{cand.rollNumber}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Test Name:</span>
                <span className="font-bold text-slate-900">{session.title}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Examiner / Host:</span>
                <span className="font-bold text-slate-900">{session.hostName}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submission Time:</span>
                <span className="font-mono font-bold text-slate-900">
                  {cand.submittedAt || 'Recorded'}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className="font-bold text-emerald-700">
                  {cand.submissionStatus === 'Auto-Submitted'
                    ? 'Auto-Submitted (Saved)'
                    : 'Successfully Saved'}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-xs text-slate-500">
                You may now safely close this window or return to the home screen.
              </p>
              <button
                type="button"
                onClick={onExitToHome}
                className="px-5 py-2.5 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                Return to Home Screen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Examination Screen (LIVE or PAUSED)
  if ((session.status === 'LIVE' || session.status === 'PAUSED') && session.questions.length > 0) {
    return (
      <CbtExamInterface
        title={session.title}
        candidateName={cand.name}
        rollNumber={cand.rollNumber}
        questions={session.questions}
        initialLanguage={session.language}
        remainingSeconds={session.remainingSeconds}
        isPaused={session.status === 'PAUSED'}
        broadcastMessage={session.broadcastMessage}
        broadcastId={session.broadcastId}
        initialResponses={cand.responses}
        isProctored={true}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onProgressUpdate={onProgressUpdate}
        onSubmitExam={(finalResponses) => onSubmitExam(finalResponses)}
        onLeaveExam={() => onSubmitExam(cand.responses)}
      />
    );
  }

  // 3. Waiting Room & 30s Countdown Screen (matching Screenshot_2026-10-30_192231_cd68bd0d.png & 192246)
  return (
    <div className="max-w-3xl mx-auto my-8 px-4">
      {waitingBroadcast && (
        <div
          role="status"
          aria-live="assertive"
          className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-3.5 text-amber-900 text-sm font-semibold flex items-center gap-3 shadow-sm transition-all duration-300"
        >
          <Bell className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Examiner Broadcast Notice:</strong> {waitingBroadcast}
          </span>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[#0B4F9E] text-white px-6 py-4 text-center">
          <h1 className="text-lg font-extrabold">{session.title}</h1>
          <p className="text-xs text-blue-100 mt-0.5">Computer Based Test (CBT)</p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* General Instructions */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#0B4F9E]">General Instructions</h2>
            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <li>
                इस परीक्षा में कुल <strong>{session.questionCount}</strong> प्रश्न हैं। (Total{' '}
                {session.questionCount} questions in this examination.)
              </li>
              <li>प्रत्येक प्रश्न 1 अंक का है। (Each question carries 1 mark; no negative marking.)</li>
              <li>
                कुल परीक्षा समय <strong>{session.durationMinutes} मिनट</strong> है। (Total duration is{' '}
                {session.durationMinutes} minutes.)
              </li>
              <li>प्रत्येक प्रश्न में केवल एक सही उत्तर है। (Each question has exactly one correct option.)</li>
              <li>उत्तर चुनने के बाद <strong>Save &amp; Next</strong> दबाएँ।</li>
              <li>
                <strong>Mark for Review</strong> से प्रश्न को बाद में देखने के लिए चिह्नित कर सकते हैं।
              </li>
              <li>
                <strong>Question Palette</strong> से किसी भी प्रश्न पर सीधे जा सकते हैं।
              </li>
              <li>समय समाप्त होने पर परीक्षा automatically submit हो जाएगी।</li>
              <li>Submit करने के बाद result Examiner द्वारा publish किया जाएगा।</li>
            </ol>
          </div>

          {/* Candidate Registration & Countdown Box */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 text-center space-y-5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#0B4F9E] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Candidate Registered Successfully!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Candidate: <strong className="text-slate-900">{cand.name}</strong> | Roll No:{' '}
                <strong className="font-mono text-slate-900">{cand.rollNumber}</strong>
              </p>
            </div>

            {session.status === 'COUNTDOWN' ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 max-w-md mx-auto space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                  Examination Is Starting
                </p>
                <p className="text-4xl font-extrabold font-mono text-amber-600 tabular-nums">
                  {session.countdownSeconds}s
                </p>
                <p className="text-xs text-amber-800">
                  Synchronized Countdown in progress. Get ready!
                </p>
              </div>
            ) : (
              <div className="bg-white border border-blue-200 rounded-xl p-5 max-w-md mx-auto space-y-2.5">
                <div className="w-6 h-6 border-2 border-[#0B4F9E] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-[#0B4F9E]">
                  Waiting for Examiner to Start Examination...
                </p>
                <p className="text-xs text-slate-500">
                  Your test will start automatically as soon as the host begins the session. Please
                  do not close this window.
                </p>
              </div>
            )}
          </div>

          {/* Footer Session Metadata */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Session ID: <strong className="font-mono text-slate-900">{session.sessionId}</strong>
            </span>
            <span>
              Examiner: <strong className="text-slate-900">{session.hostName}</strong>
            </span>
            <span>
              Subject:{' '}
              <strong className="text-slate-900">
                {session.courseName}
                {session.module ? ` (${session.module})` : ''}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
