import React, { useState, useEffect } from 'react';
import { Shield, Users, UserCheck, Play, AlertCircle, Server } from 'lucide-react';
import { COURSES, CourseId, ExamLanguage, getCourseById, getModuleById } from '../lib/syllabus';

export type TestsSubTab = 'host' | 'join' | 'solo';

interface TestsHubViewProps {
  initialSubTab?: TestsSubTab;
  prefilledSessionId?: string;
  onCreateHostSession: (form: {
    hostName: string;
    course: CourseId;
    module?: string;
    chapter?: string;
    title: string;
    durationMinutes: number;
    questionCount: number;
    language: ExamLanguage;
  }) => Promise<void>;
  onJoinServerSession: (form: {
    name: string;
    rollNumber: string;
    sessionId: string;
  }) => Promise<void>;
  onStartSoloTest: (form: {
    name: string;
    course: CourseId;
    module?: string;
    chapter?: string;
    durationMinutes: number;
    questionCount: number;
    language: ExamLanguage;
  }) => Promise<void>;
}

export const TestsHubView: React.FC<TestsHubViewProps> = ({
  initialSubTab = 'host',
  prefilledSessionId = '',
  onCreateHostSession,
  onJoinServerSession,
  onStartSoloTest,
}) => {
  const [subTab, setSubTab] = useState<TestsSubTab>(
    prefilledSessionId ? 'join' : initialSubTab
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 1. Teacher's Host Form State
  const [hostName, setHostName] = useState('');
  const [hostCourse, setHostCourse] = useState<CourseId>('olevel');
  const [hostModule, setHostModule] = useState<string>('M1');
  const [hostChapter, setHostChapter] = useState<string>('m1-ch1');
  const [hostTitle, setHostTitle] = useState('');
  const [hostDuration, setHostDuration] = useState<number>(60);
  const [hostQuestionCount, setHostQuestionCount] = useState<number>(25);
  const [hostLanguage, setHostLanguage] = useState<ExamLanguage>('bilingual');

  // 2. Join Server Form State
  const [joinName, setJoinName] = useState('');
  const [joinRoll, setJoinRoll] = useState('');
  const [joinSessionId, setJoinSessionId] = useState(prefilledSessionId);

  // 3. Solo Practice Test Form State
  const [soloName, setSoloName] = useState('');
  const [soloCourse, setSoloCourse] = useState<CourseId>('olevel');
  const [soloModule, setSoloModule] = useState<string>('M3');
  const [soloChapter, setSoloChapter] = useState<string>('m3-ch4');
  const [soloDuration, setSoloDuration] = useState<number>(30);
  const [soloQuestionCount, setSoloQuestionCount] = useState<number>(25);
  const [soloLanguage, setSoloLanguage] = useState<ExamLanguage>('bilingual');

  useEffect(() => {
    if (prefilledSessionId) {
      setSubTab('join');
      setJoinSessionId(prefilledSessionId);
    }
  }, [prefilledSessionId]);

  // Synchronize dynamic module/chapter selectors for Teacher's Host
  const selectedHostCourseObj = getCourseById(hostCourse);
  const selectedHostModObj =
    selectedHostCourseObj?.hasModules && hostModule
      ? getModuleById(hostCourse, hostModule)
      : undefined;

  const handleHostCourseChange = (nextCourse: CourseId) => {
    setHostCourse(nextCourse);
    const cObj = getCourseById(nextCourse);
    if (cObj?.hasModules && cObj.modules && cObj.modules.length > 0) {
      const firstMod = cObj.modules[0];
      setHostModule(firstMod.id);
      setHostChapter(firstMod.chapters[0]?.id || '');
    } else if (cObj?.hasChapters && cObj.chapters && cObj.chapters.length > 0) {
      setHostModule('');
      setHostChapter(cObj.chapters[0].id);
    } else {
      setHostModule('');
      setHostChapter('');
    }
  };

  const handleHostModuleChange = (nextMod: string) => {
    setHostModule(nextMod);
    const mObj = getModuleById(hostCourse, nextMod);
    setHostChapter(mObj?.chapters[0]?.id || '');
  };

  // Synchronize dynamic module/chapter selectors for Solo Practice Test
  const selectedSoloCourseObj = getCourseById(soloCourse);
  const selectedSoloModObj =
    selectedSoloCourseObj?.hasModules && soloModule
      ? getModuleById(soloCourse, soloModule)
      : undefined;

  const handleSoloCourseChange = (nextCourse: CourseId) => {
    setSoloCourse(nextCourse);
    const cObj = getCourseById(nextCourse);
    if (cObj?.hasModules && cObj.modules && cObj.modules.length > 0) {
      const firstMod = cObj.modules[0];
      setSoloModule(firstMod.id);
      setSoloChapter(firstMod.chapters[0]?.id || '');
    } else if (cObj?.hasChapters && cObj.chapters && cObj.chapters.length > 0) {
      setSoloModule('');
      setSoloChapter(cObj.chapters[0].id);
    } else {
      setSoloModule('');
      setSoloChapter('');
    }
  };

  const handleSoloModuleChange = (nextMod: string) => {
    setSoloModule(nextMod);
    const mObj = getModuleById(soloCourse, nextMod);
    setSoloChapter(mObj?.chapters[0]?.id || '');
  };

  const submitHostForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!hostName.trim()) {
      setErrorMsg('Please enter the Teacher / Examiner Name.');
      return;
    }
    if (!hostTitle.trim()) {
      setErrorMsg('Please enter a Test Title.');
      return;
    }
    setBusy(true);
    try {
      await onCreateHostSession({
        hostName: hostName.trim(),
        course: hostCourse,
        module: selectedHostCourseObj?.hasModules ? hostModule || undefined : undefined,
        chapter: selectedHostCourseObj?.hasChapters ? hostChapter || undefined : undefined,
        title: hostTitle.trim(),
        durationMinutes: hostDuration,
        questionCount: hostQuestionCount,
        language: hostLanguage,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create session.');
    } finally {
      setBusy(false);
    }
  };

  const submitJoinForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!joinName.trim()) {
      setErrorMsg('Please enter your Candidate Name.');
      return;
    }
    if (!joinRoll.trim()) {
      setErrorMsg('Please enter a valid Roll Number.');
      return;
    }
    if (!joinSessionId.trim()) {
      setErrorMsg('Please enter the Session ID provided by your examiner.');
      return;
    }
    setBusy(true);
    try {
      await onJoinServerSession({
        name: joinName.trim(),
        rollNumber: joinRoll.trim().toUpperCase(),
        sessionId: joinSessionId.trim().toUpperCase(),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Session not found or no longer active.');
    } finally {
      setBusy(false);
    }
  };

  const submitSoloForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!soloName.trim()) {
      setErrorMsg('Please enter your Name to begin the Solo Practice Test.');
      return;
    }
    setBusy(true);
    try {
      await onStartSoloTest({
        name: soloName.trim(),
        course: soloCourse,
        module: selectedSoloCourseObj?.hasModules ? soloModule || undefined : undefined,
        chapter: selectedSoloCourseObj?.hasChapters ? soloChapter || undefined : undefined,
        durationMinutes: soloDuration,
        questionCount: soloQuestionCount,
        language: soloLanguage,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start solo practice test.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0B4F9E]">
          Online Examination &amp; Assessment Center
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Tests &amp; Live Examination Server
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Host a proctored real-time classroom examination as an instructor, join an active
          examiner server with your roll number, or configure a timed solo mock examination.
        </p>
      </div>

      {/* Primary 3 Mode Selector Cards (Section 14) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="tablist" aria-label="Test Modes">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'host'}
          onClick={() => {
            setErrorMsg(null);
            setSubTab('host');
          }}
          className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
            subTab === 'host'
              ? 'bg-white border-[#0B4F9E] ring-2 ring-[#0B4F9E] shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0B4F9E] flex items-center justify-center mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Teacher&apos;s Host</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Create a live examination server, monitor connected students, view proctoring alerts,
            and export official results.
          </p>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'join'}
          onClick={() => {
            setErrorMsg(null);
            setSubTab('join');
          }}
          className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
            subTab === 'join'
              ? 'bg-white border-emerald-700 ring-2 ring-emerald-700 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Server className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Join Server</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Enter your Candidate Name, Roll Number, and Session ID (e.g., ACCP-7X42K) to join a
            live hosted examination.
          </p>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'solo'}
          onClick={() => {
            setErrorMsg(null);
            setSubTab('solo');
          }}
          className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
            subTab === 'solo'
              ? 'bg-white border-[#0B4F9E] ring-2 ring-[#0B4F9E] shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
            <UserCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Solo Practice Test</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Take a full-length timed mock CBT test independently with instant grading and answer
            explanations.
          </p>
        </button>
      </div>

      {/* Validation Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm font-medium flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. TEACHER'S HOST FORM (Section 15) */}
      {subTab === 'host' && (
        <form
          onSubmit={submitHostForm}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xs space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              Examiner Information &amp; Session Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure your live examination parameters. A unique Session ID will be generated upon
              hosting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="host-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Teacher / Examiner Name *
              </label>
              <input
                id="host-name"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g., Prof. Rajesh Sharma"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="host-title" className="block text-xs font-bold text-slate-700 mb-1.5">
                Test Title *
              </label>
              <input
                id="host-title"
                type="text"
                value={hostTitle}
                onChange={(e) => setHostTitle(e.target.value)}
                placeholder="e.g., O'Level M3 Python Batch Test - 1"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="host-course" className="block text-xs font-bold text-slate-700 mb-1.5">
                Course *
              </label>
              <select
                id="host-course"
                value={hostCourse}
                onChange={(e) => handleHostCourseChange(e.target.value as CourseId)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shortName})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Module Selector (Only visible if course hasModules, e.g. O'Level) */}
            {selectedHostCourseObj?.hasModules && selectedHostCourseObj.modules && (
              <div>
                <label htmlFor="host-module" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Module *
                </label>
                <select
                  id="host-module"
                  value={hostModule}
                  onChange={(e) => handleHostModuleChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {selectedHostCourseObj.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Chapter Selector (Only visible if course hasChapters, e.g. O'Level or CCC) */}
            {selectedHostCourseObj?.hasChapters && (
              <div className="sm:col-span-2">
                <label htmlFor="host-chapter" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chapter / Scope
                </label>
                <select
                  id="host-chapter"
                  value={hostChapter}
                  onChange={(e) => setHostChapter(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Chapters (Entire {selectedHostModObj ? selectedHostModObj.id : selectedHostCourseObj.name})</option>
                  {(selectedHostModObj?.chapters || selectedHostCourseObj.chapters || []).map(
                    (ch) => (
                      <option key={ch.id} value={ch.id}>
                        Chapter {ch.number}: {ch.title} ({ch.titleHi})
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="host-duration" className="block text-xs font-bold text-slate-700 mb-1.5">
                Time Duration (Minutes)
              </label>
              <select
                id="host-duration"
                value={hostDuration}
                onChange={(e) => setHostDuration(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
              </select>
            </div>

            <div>
              <label htmlFor="host-qcount" className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Number of Questions
              </label>
              <select
                id="host-qcount"
                value={hostQuestionCount}
                onChange={(e) => setHostQuestionCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10 Questions</option>
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={100}>100 Questions</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="host-lang" className="block text-xs font-bold text-slate-700 mb-1.5">
                Question Language
              </label>
              <select
                id="host-lang"
                value={hostLanguage}
                onChange={(e) => setHostLanguage(e.target.value as ExamLanguage)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="bilingual">Hindi + English (Bilingual Recommended)</option>
                <option value="en">English Only</option>
                <option value="hi">Hindi Only (हिन्दी)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{busy ? 'Creating Session...' : 'Host Session'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 2. JOIN SERVER FORM (Section 26) */}
      {subTab === 'join' && (
        <form
          onSubmit={submitJoinForm}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xs max-w-xl mx-auto space-y-5"
        >
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              Join Live Examination Server
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your candidate details and the Session ID shared by your teacher/examiner.
            </p>
          </div>

          <div>
            <label htmlFor="join-name" className="block text-xs font-bold text-slate-700 mb-1.5">
              Student / Candidate Name *
            </label>
            <input
              id="join-name"
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="e.g., Rahul Kumar"
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="join-roll" className="block text-xs font-bold text-slate-700 mb-1.5">
              Roll Number *
            </label>
            <input
              id="join-roll"
              type="text"
              value={joinRoll}
              onChange={(e) => setJoinRoll(e.target.value)}
              placeholder="e.g., 101 or OL-2026-01"
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="join-session-id" className="block text-xs font-bold text-slate-700 mb-1.5">
              Session ID *
            </label>
            <input
              id="join-session-id"
              type="text"
              value={joinSessionId}
              onChange={(e) => setJoinSessionId(e.target.value.toUpperCase())}
              placeholder="e.g., ACCP-7X42K"
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-[#15803D] hover:bg-green-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Server className="w-4 h-4" />
            <span>{busy ? 'Connecting to Server...' : 'Join Server'}</span>
          </button>
        </form>
      )}

      {/* 3. SOLO PRACTICE TEST FORM (Section 27) */}
      {subTab === 'solo' && (
        <form
          onSubmit={submitSoloForm}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xs space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              Configure Solo Practice Examination
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your course, module/chapter, question quantity, duration, and language to launch
              a self-paced timed CBT test.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="solo-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Candidate Name *
              </label>
              <input
                id="solo-name"
                type="text"
                value={soloName}
                onChange={(e) => setSoloName(e.target.value)}
                placeholder="Enter your name"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="solo-course" className="block text-xs font-bold text-slate-700 mb-1.5">
                Course *
              </label>
              <select
                id="solo-course"
                value={soloCourse}
                onChange={(e) => handleSoloCourseChange(e.target.value as CourseId)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shortName})
                  </option>
                ))}
              </select>
            </div>

            {selectedSoloCourseObj?.hasModules && selectedSoloCourseObj.modules && (
              <div>
                <label htmlFor="solo-module" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Module *
                </label>
                <select
                  id="solo-module"
                  value={soloModule}
                  onChange={(e) => handleSoloModuleChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {selectedSoloCourseObj.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSoloCourseObj?.hasChapters && (
              <div className={selectedSoloCourseObj.hasModules ? '' : 'sm:col-span-2'}>
                <label htmlFor="solo-chapter" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chapter
                </label>
                <select
                  id="solo-chapter"
                  value={soloChapter}
                  onChange={(e) => setSoloChapter(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Chapters</option>
                  {(selectedSoloModObj?.chapters || selectedSoloCourseObj.chapters || []).map(
                    (ch) => (
                      <option key={ch.id} value={ch.id}>
                        Chapter {ch.number}: {ch.title}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="solo-qcount" className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Questions
              </label>
              <select
                id="solo-qcount"
                value={soloQuestionCount}
                onChange={(e) => setSoloQuestionCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10 Questions</option>
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={100}>100 Questions</option>
              </select>
            </div>

            <div>
              <label htmlFor="solo-duration" className="block text-xs font-bold text-slate-700 mb-1.5">
                Time Duration (Minutes)
              </label>
              <select
                id="solo-duration"
                value={soloDuration}
                onChange={(e) => setSoloDuration(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="solo-lang" className="block text-xs font-bold text-slate-700 mb-1.5">
                Language
              </label>
              <select
                id="solo-lang"
                value={soloLanguage}
                onChange={(e) => setSoloLanguage(e.target.value as ExamLanguage)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="bilingual">Hindi + English (Bilingual)</option>
                <option value="en">English</option>
                <option value="hi">Hindi (हिन्दी)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{busy ? 'Preparing Test...' : 'Start Test'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
