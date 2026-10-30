/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  BookOpen,
  Shield,
  Server,
  UserCheck,
  Menu,
  X,
  ChevronRight,
  Monitor,
  Code2,
  FileSpreadsheet,
  Award,
  Sun,
  Moon,
} from 'lucide-react';
import {
  COURSES,
  CourseId,
  CourseInfo,
  ModuleInfo,
  ChapterInfo,
  ExamLanguage,
  getCourseById,
} from './lib/syllabus';
import { QuestionItem } from './lib/questionBank';
import {
  getAvailableQuestionCount,
  sanitizeQuestionForStudent,
  QuestionResponseState,
  calculateExamResult,
  ExamResultSummary,
} from './lib/examEngine';
import { CbtExamInterface } from './components/CbtExamInterface';
import { PracticeResultView } from './components/PracticeResultView';
import { CoursePrepView } from './components/CoursePrepView';
import { TestsHubView, TestsSubTab } from './components/TestsHubView';
import { HostDashboardView, HostSessionData } from './components/HostDashboardView';
import { StudentHostedView, StudentSessionState } from './components/StudentHostedView';
import { soundManager } from './lib/sound';

type ActiveRoute =
  | { view: 'home' }
  | { view: 'course'; courseId: CourseId }
  | { view: 'tests'; subTab?: TestsSubTab; joinCode?: string }
  | {
      view: 'practice_exam';
      title: string;
      subtitle?: string;
      candidateName: string;
      courseId: CourseId;
      moduleId?: string;
      chapterId?: string;
      language: ExamLanguage;
      durationMinutes: number;
      questions: QuestionItem[];
    }
  | {
      view: 'practice_result';
      title: string;
      subtitle?: string;
      candidateName: string;
      courseId: CourseId;
      moduleId?: string;
      chapterId?: string;
      language: ExamLanguage;
      questionCount: number;
      durationMinutes: number;
      questions: QuestionItem[];
      responses: Record<string, QuestionResponseState>;
      summary: ExamResultSummary;
    }
  | { view: 'host_dashboard'; sessionId: string }
  | { view: 'student_hosted'; sessionId: string; rollNumber: string };

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      return { view: 'tests', subTab: 'join', joinCode: joinParam.toUpperCase() };
    }
    return { view: 'home' };
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      localStorage.removeItem('accp-theme');
      const saved = localStorage.getItem('accp-theme-mode');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('accp-theme-mode', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<
    'All' | 'NIELIT Certification' | 'Office Productivity' | 'Web & Programming'
  >('All');

  // Real-time Host & Student Session States
  const [hostSession, setHostSession] = useState<HostSessionData | null>(null);
  const [studentSession, setStudentSession] = useState<StudentSessionState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Track seen question IDs per course/chapter so repeated sessions generate fresh sets
  const seenQuestionsRef = useRef<Record<string, string[]>>({});

  // Navigate helper with browser history support
  const navigateTo = useCallback((nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Connect WebSocket when in host_dashboard or student_hosted view
  useEffect(() => {
    if (route.view !== 'host_dashboard' && route.view !== 'student_hosted') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (route.view === 'host_dashboard') {
          socket?.send(
            JSON.stringify({
              type: 'SUBSCRIBE',
              role: 'host',
              sessionId: route.sessionId,
            })
          );
        } else if (route.view === 'student_hosted') {
          socket?.send(
            JSON.stringify({
              type: 'SUBSCRIBE',
              role: 'student',
              sessionId: route.sessionId,
              rollNumber: route.rollNumber,
            })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SESSION_STATE' && data.session) {
            setHostSession(data.session);
            if (data.soundCue === 'alert') {
              soundManager.playProctoringAlert();
            } else if (data.soundCue === 'submit') {
              soundManager.playSubmissionChime();
            } else if (data.soundCue === 'join') {
              soundManager.playJoinNotification();
            }
          } else if (data.type === 'STUDENT_STATE' && data.session) {
            setStudentSession(data.session);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      socket.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [route]);

  // Launch a Practice or Solo Test Session via Server API
  const startPracticeOrSoloSession = async (params: {
    course: CourseInfo;
    module?: ModuleInfo;
    chapter?: ChapterInfo;
    candidateName: string;
    questionCount: number;
    durationMinutes: number;
    language: ExamLanguage;
  }) => {
    const scopeKey = `${params.course.id}:${params.module?.id || 'all'}:${
      params.chapter?.id || 'all'
    }`;
    const previouslySeenIds = seenQuestionsRef.current[scopeKey] || [];

    const response = await fetch('/api/questions/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course: params.course.id,
        module: params.module?.id,
        chapter: params.chapter?.id,
        count: params.questionCount,
        previouslySeenIds,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate practice question set.');
    }

    const data = await response.json();
    const questions: QuestionItem[] = data.questions || [];

    // Record seen IDs so next practice session gives fresh questions
    seenQuestionsRef.current[scopeKey] = [
      ...previouslySeenIds,
      ...questions.map((q) => q.id),
    ].slice(-90);

    const titleParts = [params.course.name];
    if (params.module) titleParts.push(params.module.id);
    if (params.chapter) titleParts.push(params.chapter.title);

    navigateTo({
      view: 'practice_exam',
      title: titleParts.join(' — '),
      subtitle: params.chapter?.titleHi || params.module?.titleHi || params.course.shortName,
      candidateName: params.candidateName,
      courseId: params.course.id,
      moduleId: params.module?.id,
      chapterId: params.chapter?.id,
      language: params.language,
      durationMinutes: params.durationMinutes,
      questions,
    });
  };

  // Create Teacher's Host Session
  const handleCreateHostSession = async (form: {
    hostName: string;
    course: CourseId;
    module?: string;
    chapter?: string;
    title: string;
    durationMinutes: number;
    questionCount: number;
    language: ExamLanguage;
  }) => {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not create session.');
    }
    setHostSession(data.session);
    navigateTo({ view: 'host_dashboard', sessionId: data.sessionId });
  };

  // Student Join Server Session
  const handleJoinServerSession = async (form: {
    name: string;
    rollNumber: string;
    sessionId: string;
  }) => {
    const response = await fetch(`/api/sessions/${encodeURIComponent(form.sessionId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        rollNumber: form.rollNumber,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Session not found or no longer active.');
    }
    setStudentSession(data.session);
    navigateTo({
      view: 'student_hosted',
      sessionId: form.sessionId,
      rollNumber: form.rollNumber,
    });
  };

  // Host Control Action Handler
  const handleHostAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!hostSession) return;
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(hostSession.sessionId)}/action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      }
    );
    if (response.ok) {
      const data = await response.json();
      setHostSession(data.session);
    }
  };

  // Refresh Host Session Manually
  const handleRefreshHost = async () => {
    if (!hostSession) return;
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(hostSession.sessionId)}/host`
    );
    if (response.ok) {
      const data = await response.json();
      setHostSession(data.session);
    }
  };

  // Student Progress & Proctoring Update Handler
  const handleStudentProgress = async (
    currentQuestion: number,
    responses: Record<string, QuestionResponseState>,
    proctoringAlert?: string
  ) => {
    if (!studentSession || !studentSession.candidate) return;
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(studentSession.sessionId)}/progress`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rollNumber: studentSession.candidate.rollNumber,
            currentQuestion,
            responses,
            proctoringAlert,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setStudentSession(data.session);
      }
    } catch {
      // Network transient failure ignored; WebSocket or next action will resync
    }
  };

  // Student Final Submission Handler
  const handleStudentSubmit = async (responses: Record<string, QuestionResponseState>) => {
    if (!studentSession || !studentSession.candidate) return;
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(studentSession.sessionId)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNumber: studentSession.candidate.rollNumber,
          responses,
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      setStudentSession(data.session);
    }
  };

  // Full-screen CBT view when taking a practice/solo test
  if (route.view === 'practice_exam') {
    const studentQuestions = route.questions.map(sanitizeQuestionForStudent);
    return (
      <CbtExamInterface
        title={route.title}
        candidateName={route.candidateName}
        rollNumber="PRACTICE"
        questions={studentQuestions}
        initialLanguage={route.language}
        remainingSeconds={route.durationMinutes * 60}
        isProctored={false}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSubmitExam={(responses, timeTakenSeconds) => {
          const summary = calculateExamResult(route.questions, responses, timeTakenSeconds);
          navigateTo({
            view: 'practice_result',
            title: route.title,
            subtitle: route.subtitle,
            candidateName: route.candidateName,
            courseId: route.courseId,
            moduleId: route.moduleId,
            chapterId: route.chapterId,
            language: route.language,
            questionCount: route.questions.length,
            durationMinutes: route.durationMinutes,
            questions: route.questions,
            responses,
            summary,
          });
        }}
        onLeaveExam={() => navigateTo({ view: 'course', courseId: route.courseId })}
      />
    );
  }

  // Full-screen Student Hosted Exam when examination is LIVE or PAUSED and not yet submitted
  if (
    route.view === 'student_hosted' &&
    studentSession &&
    (studentSession.status === 'LIVE' || studentSession.status === 'PAUSED') &&
    studentSession.candidate?.submissionStatus !== 'Submitted' &&
    studentSession.candidate?.submissionStatus !== 'Auto-Submitted' &&
    studentSession.candidate?.submissionStatus !== 'Removed'
  ) {
    return (
      <StudentHostedView
        session={studentSession}
        theme={theme}
        onToggleTheme={toggleTheme}
        onProgressUpdate={handleStudentProgress}
        onSubmitExam={handleStudentSubmit}
        onExitToHome={() => navigateTo({ view: 'home' })}
      />
    );
  }

  const totalVerifiedQuestionsAcrossPlatform = COURSES.reduce(
    (sum, c) => sum + getAvailableQuestionCount(c.id),
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors duration-200">
      {/* Global Top Bar (Brand Wordmark — Concise Nav Links — Theme Toggle & Primary Action) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              navigateTo({ view: 'home' });
            }}
            className="text-sm sm:text-lg font-extrabold tracking-tight text-[#0B4F9E] whitespace-nowrap shrink-0"
          >
            Access Computer Preparation
          </a>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600"
          >
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'home' });
              }}
              className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                route.view === 'home'
                  ? 'border-[#0B4F9E] text-slate-950'
                  : 'border-transparent'
              }`}
            >
              Home
            </a>
            <a
              href="#olevel"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'course', courseId: 'olevel' });
              }}
              className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                route.view === 'course' && route.courseId === 'olevel'
                  ? 'border-[#0B4F9E] text-slate-950'
                  : 'border-transparent'
              }`}
            >
              O&apos;Level
            </a>
            <a
              href="#ccc"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'course', courseId: 'ccc' });
              }}
              className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                route.view === 'course' && route.courseId === 'ccc'
                  ? 'border-[#0B4F9E] text-slate-950'
                  : 'border-transparent'
              }`}
            >
              CCC
            </a>
            <a
              href="#python"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'course', courseId: 'python' });
              }}
              className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                route.view === 'course' && route.courseId === 'python'
                  ? 'border-[#0B4F9E] text-slate-950'
                  : 'border-transparent'
              }`}
            >
              Python
            </a>
            <a
              href="#tests"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'tests', subTab: 'host' });
              }}
              className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                route.view === 'tests' || route.view === 'host_dashboard'
                  ? 'border-[#0B4F9E] text-slate-950'
                  : 'border-transparent'
              }`}
            >
              Tests
            </a>
          </nav>

          {/* Zone 3: Theme Toggle + 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#0B4F9E] shrink-0" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateTo({ view: 'tests', subTab: 'join' })}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#15803D] hover:bg-green-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Join Exam Server
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Course Navigation Menu"
              className="lg:hidden p-1.5 sm:p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Secondary Course Quick-Switcher Bar (Desktop & Tablet) */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-5 text-xs font-semibold text-slate-600">
            <span className="text-slate-400 uppercase tracking-wider shrink-0">Courses:</span>
            {COURSES.map((c) => {
              const isActive = route.view === 'course' && route.courseId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigateTo({ view: 'course', courseId: c.id })}
                  className={`hover:text-[#0B4F9E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive ? 'text-[#0B4F9E] font-extrabold underline underline-offset-4' : ''
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
              className={`hover:text-[#0B4F9E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.view === 'tests' ? 'text-[#0B4F9E] font-extrabold underline underline-offset-4' : ''
              }`}
            >
              Tests (Host / Join / Solo)
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigateTo({ view: 'home' })}
                className="text-left px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-900"
              >
                Home Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
                className="text-left px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-[#0B4F9E]"
              >
                Tests &amp; Live Server
              </button>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                All Preparation Courses
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {COURSES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigateTo({ view: 'course', courseId: c.id })}
                    className="text-left px-3 py-2 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Route Viewport */}
      <div className="flex-1">
        {/* ROUTE 1: HOME DASHBOARD (All 10 Core Categories) */}
        {route.view === 'home' && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-12">
            {/* Clean Educational Header & Examination Portal Split */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0B4F9E]">
                  Computer Based Test (CBT) Examination &amp; Preparation Portal
                </p>
                <h1
                  className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Master NIELIT O&apos;Level, CCC, MS Office &amp; Programming Examinations
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                  Practice chapter-wise bilingual (Hindi + English) CBT question banks aligned with
                  the official NIELIT R5.1 syllabus, or host live proctored classroom examinations
                  with real-time candidate monitoring and instant scorecards.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo({ view: 'course', courseId: 'olevel' })}
                    className="px-5 py-3 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start O&apos;Level Preparation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
                    className="px-5 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Shield className="w-4 h-4 text-[#0B4F9E]" />
                    <span>Teacher&apos;s Host / Live Tests</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Examination Quick-Access Panel */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Online Examination Portal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct access for teachers, examination candidates, and solo test takers
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
                    className="w-full p-3.5 rounded-lg bg-white border border-slate-200 hover:border-[#0B4F9E] flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0B4F9E] flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Teacher&apos;s Host</p>
                        <p className="text-xs text-slate-500">
                          Create session ID, monitor candidates &amp; proctoring alerts
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo({ view: 'tests', subTab: 'join' })}
                    className="w-full p-3.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Join Server</p>
                        <p className="text-xs text-slate-500">
                          Enter Roll Number &amp; Session ID to join classroom CBT
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo({ view: 'tests', subTab: 'solo' })}
                    className="w-full p-3.5 rounded-lg bg-white border border-slate-200 hover:border-[#0B4F9E] flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Solo Practice Test</p>
                        <p className="text-xs text-slate-500">
                          Timed full-length mock test with instant explanations
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>
            </section>

            {/* Real Platform Inventory Bar (No fake statistics) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-medium">Core Preparation Courses</p>
                <p className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums mt-1">
                  9 Courses + Tests Hub
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-medium">O&apos;Level Modules &amp; Chapters</p>
                <p className="text-2xl font-extrabold font-mono text-[#0B4F9E] tabular-nums mt-1">
                  4 Modules · 26 Chapters
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-medium">Verified Question Pool</p>
                <p className="text-2xl font-extrabold font-mono text-emerald-700 tabular-nums mt-1">
                  {totalVerifiedQuestionsAcrossPlatform} Questions
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-medium">Supported Exam Languages</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  English · हिन्दी · Bilingual
                </p>
              </div>
            </section>

            {/* Core Courses Directory (Section 1: All 10 Categories) */}
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    Core Preparation Courses &amp; Examination Categories
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Select any course below to configure your practice session or chapter-wise test.
                  </p>
                </div>

                {/* Interactive Category Filter */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
                  {(
                    [
                      'All',
                      'NIELIT Certification',
                      'Office Productivity',
                      'Web & Programming',
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {COURSES.filter(
                  (c) => categoryFilter === 'All' || c.category === categoryFilter
                ).map((course) => {
                  const qCount = getAvailableQuestionCount(course.id);
                  const chapterStructureText = course.hasModules
                    ? '4 Modules (M1–M4) · 26 Chapters'
                    : course.hasChapters
                    ? `${course.chapters?.length || 9} Syllabus Chapters`
                    : 'Direct Topic-Mixed Practice';

                  return (
                    <div
                      key={course.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col justify-between space-y-5 hover:border-blue-400 transition-colors"
                    >
                      <div className="space-y-3">
                        {/* Unboxed quiet metadata per frontend-design constitution */}
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>{course.category}</span>
                          <span className="font-mono font-semibold text-slate-700 tabular-nums">
                            {qCount} Available Qs
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0B4F9E] flex items-center justify-center shrink-0">
                            {course.category === 'NIELIT Certification' ? (
                              <Award className="w-5 h-5" />
                            ) : course.category === 'Office Productivity' ? (
                              <FileSpreadsheet className="w-5 h-5" />
                            ) : (
                              <Code2 className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">{course.name}</h3>
                            <p className="text-xs text-slate-500">{course.shortName}</p>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {course.description}
                        </p>

                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                          <div>
                            <span className="text-slate-400">Structure:</span>{' '}
                            <strong className="text-slate-800">{chapterStructureText}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Practice Mode:</span>{' '}
                            <span className="text-slate-700">{course.practiceModeLabel}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateTo({ view: 'course', courseId: course.id })}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>
                          {course.hasModules
                            ? 'Select Module & Practice'
                            : course.hasChapters
                            ? 'Select Chapter & Practice'
                            : 'Configure & Start Practice'}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {/* 10th Core Category Card: Tests (Teacher's Host / Join Server / Solo Practice Test) */}
                {categoryFilter === 'All' && (
                  <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-2xs flex flex-col justify-between space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-blue-300 font-medium">
                        <span>Live Examination Suite</span>
                        <span className="font-mono">Real-Time CBT</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Monitor className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-white">10. Tests</h3>
                          <p className="text-xs text-slate-300">
                            Teacher&apos;s Host · Join Server · Solo Test
                          </p>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Host a real-time classroom examination with unique Session IDs, live
                        candidate tracking, anti-cheat proctoring alerts, and downloadable CSV/PDF
                        scorecards.
                      </p>

                      <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                        <div>· Teacher&apos;s Host Control Center</div>
                        <div>· Student Join Server (with Roll Number)</div>
                        <div>· Solo Timed Mock Examination</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      <span>Open Tests Portal</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        )}

        {/* ROUTE 2: COURSE PREPARATION FLOW (O'Level, CCC, Excel, Word, PowerPoint, HTML, CSS, JS, Python) */}
        {route.view === 'course' && (
          <CoursePrepView
            course={getCourseById(route.courseId) || COURSES[0]}
            onStartPractice={async ({
              course,
              module,
              chapter,
              questionCount,
              durationMinutes,
              language,
            }) => {
              await startPracticeOrSoloSession({
                course,
                module,
                chapter,
                candidateName: 'Student Candidate',
                questionCount,
                durationMinutes,
                language,
              });
            }}
            onBackToHome={() => navigateTo({ view: 'home' })}
          />
        )}

        {/* ROUTE 3: PRACTICE / SOLO TEST RESULT & EXPLANATION VIEW */}
        {route.view === 'practice_result' && (
          <PracticeResultView
            title={route.title}
            subtitle={route.subtitle}
            candidateName={route.candidateName}
            language={route.language}
            questions={route.questions}
            responses={route.responses}
            summary={route.summary}
            onPracticeAgain={async () => {
              const cObj = getCourseById(route.courseId) || COURSES[0];
              const mObj = route.moduleId
                ? cObj.modules?.find((m) => m.id === route.moduleId)
                : undefined;
              const chObj = route.chapterId
                ? (mObj?.chapters || cObj.chapters)?.find((ch) => ch.id === route.chapterId)
                : undefined;

              await startPracticeOrSoloSession({
                course: cObj,
                module: mObj,
                chapter: chObj,
                candidateName: route.candidateName,
                questionCount: route.questionCount,
                durationMinutes: route.durationMinutes,
                language: route.language,
              });
            }}
            onBackToCourse={() => navigateTo({ view: 'course', courseId: route.courseId })}
          />
        )}

        {/* ROUTE 4: TESTS HUB (Teacher's Host / Join Server / Solo Practice Test) */}
        {route.view === 'tests' && (
          <TestsHubView
            initialSubTab={route.subTab}
            prefilledSessionId={route.joinCode}
            onCreateHostSession={handleCreateHostSession}
            onJoinServerSession={handleJoinServerSession}
            onStartSoloTest={async (form) => {
              const cObj = getCourseById(form.course) || COURSES[0];
              const mObj = form.module
                ? cObj.modules?.find((m) => m.id === form.module)
                : undefined;
              const chObj = form.chapter
                ? (mObj?.chapters || cObj.chapters)?.find((ch) => ch.id === form.chapter)
                : undefined;

              await startPracticeOrSoloSession({
                course: cObj,
                module: mObj,
                chapter: chObj,
                candidateName: form.name,
                questionCount: form.questionCount,
                durationMinutes: form.durationMinutes,
                language: form.language,
              });
            }}
          />
        )}

        {/* ROUTE 5: TEACHER'S HOST EXAMINER CONTROL CENTER */}
        {route.view === 'host_dashboard' && hostSession && (
          <HostDashboardView
            session={hostSession}
            theme={theme}
            onToggleTheme={toggleTheme}
            onHostAction={handleHostAction}
            onRefresh={handleRefreshHost}
            onNewSession={() => navigateTo({ view: 'tests', subTab: 'host' })}
            onExitHost={() => navigateTo({ view: 'home' })}
          />
        )}

        {/* ROUTE 6: STUDENT HOSTED WAITING / COUNTDOWN / COMPLETED SCREEN */}
        {route.view === 'student_hosted' && studentSession && (
          <StudentHostedView
            session={studentSession}
            theme={theme}
            onToggleTheme={toggleTheme}
            onProgressUpdate={handleStudentProgress}
            onSubmitExam={handleStudentSubmit}
            onExitToHome={() => navigateTo({ view: 'home' })}
          />
        )}
      </div>

      {/* Clean Educational Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong className="text-slate-800">Access Computer Preparation</strong> — NIELIT
            O&apos;Level, CCC, MS Office &amp; Programming CBT Examination Platform
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo({ view: 'home' })}
              className="hover:text-slate-900 cursor-pointer"
            >
              Courses
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => navigateTo({ view: 'course', courseId: 'olevel' })}
              className="hover:text-slate-900 cursor-pointer"
            >
              O&apos;Level (M1–M4)
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => navigateTo({ view: 'course', courseId: 'ccc' })}
              className="hover:text-slate-900 cursor-pointer"
            >
              CCC Syllabus
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => navigateTo({ view: 'tests', subTab: 'host' })}
              className="hover:text-slate-900 cursor-pointer"
            >
              Examiner Control Center
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
