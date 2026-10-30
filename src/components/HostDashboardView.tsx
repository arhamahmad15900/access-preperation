import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Pause,
  Plus,
  Send,
  XOctagon,
  RefreshCw,
  ShieldAlert,
  Download,
  Volume2,
  VolumeX,
  Share2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sun,
  Moon,
} from 'lucide-react';
import {
  generateResultsCsv,
  generateMasterReportPdf,
  CandidateResultRow,
} from '../lib/examEngine';
import { soundManager } from '../lib/sound';

export interface HostSessionData {
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
  language: string;
  status: 'WAITING' | 'COUNTDOWN' | 'LIVE' | 'PAUSED' | 'CLOSED';
  countdownSeconds: number;
  remainingSeconds: number;
  createdAt: string;
  examDate?: string;
  broadcastMessage: string | null;
  broadcastId?: string | null;
  broadcastAt?: number | null;
  resultsDownloaded: boolean;
  stats: {
    totalCandidates: number;
    activeTesting: number;
    submittedCount: number;
    notSubmittedCount: number;
    removedCount: number;
    totalWarnings: number;
  };
  candidates: Array<{
    rollNumber: string;
    name: string;
    connectionStatus: 'Online' | 'Offline' | 'Removed';
    submissionStatus: 'Not Started' | 'In Progress' | 'Submitted' | 'Auto-Submitted' | 'Removed';
    currentQuestion: number;
    answeredCount: number;
    unansweredCount: number;
    warningsCount: number;
    submittedAt: string | null;
    timeTakenSeconds: number;
    result: {
      totalQuestions: number;
      attempted: number;
      correct: number;
      incorrect: number;
      unanswered: number;
      score: number;
      percentage: number;
      passed: boolean;
    } | null;
  }>;
  events: Array<{
    id: string;
    type: 'JOIN' | 'START' | 'WARNING' | 'SUBMIT' | 'BROADCAST' | 'REMOVE' | 'CLOSE';
    message: string;
    timestamp: string;
  }>;
}

interface HostDashboardViewProps {
  session: HostSessionData;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onHostAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNewSession: () => void;
  onExitHost: () => void;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
}

export const HostDashboardView: React.FC<HostDashboardViewProps> = ({
  session,
  theme = 'light',
  onToggleTheme,
  onHostAction,
  onRefresh,
  onNewSession,
  onExitHost,
}) => {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'results'>('monitoring');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [muted, setMuted] = useState(soundManager.muted);
  const [hasDownloadedLocally, setHasDownloadedLocally] = useState(session.resultsDownloaded);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCsv, setIsGeneratingCsv] = useState(false);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  const buildResultRows = (sourceSession: HostSessionData = session): CandidateResultRow[] => {
    return sourceSession.candidates
      .filter((c) => c.submissionStatus !== 'Removed')
      .map((c) => {
        const res = c.result;
        const attempted = res ? res.attempted : c.answeredCount;
        const correct = res ? res.correct : 0;
        const incorrect = res ? res.incorrect : 0;
        const unanswered = res ? res.unanswered : sourceSession.questionCount - attempted;
        const score = res ? res.score : 0;
        const percentage = res ? res.percentage : 0;
        const subStatus =
          c.submissionStatus === 'Submitted'
            ? 'Submitted'
            : c.submissionStatus === 'Auto-Submitted'
            ? 'Auto-Submitted'
            : c.connectionStatus === 'Offline'
            ? 'Disconnected'
            : c.submissionStatus;
        return {
          rollNumber: c.rollNumber,
          name: c.name,
          attempted,
          correct,
          incorrect,
          unanswered,
          score,
          totalQuestions: sourceSession.questionCount,
          percentage,
          status: percentage >= 50 ? 'PASS' : 'FAIL',
          submissionStatus: subStatus,
          timeTakenSeconds: c.timeTakenSeconds || 0,
          submittedAt: c.submittedAt || subStatus,
          warningsCount: c.warningsCount,
        };
      });
  };

  const fetchLatestHostSession = async (): Promise<HostSessionData> => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(session.sessionId)}/host`);
      if (res.ok) {
        const data = await res.json();
        if (data?.session) {
          return data.session as HostSessionData;
        }
      }
    } catch {
      // Fallback to current in-memory session prop if network request fails
    }
    return session;
  };

  const triggerCsvDownload = async () => {
    if (isGeneratingCsv) return;
    setIsGeneratingCsv(true);
    setDownloadError(null);
    try {
      const latestSession = await fetchLatestHostSession();
      const rows = buildResultRows(latestSession);
      const csvContent = generateResultsCsv(
        {
          sessionId: latestSession.sessionId,
          title: latestSession.title,
          hostName: latestSession.hostName,
          course: latestSession.courseName,
          module: latestSession.moduleName,
          chapter: latestSession.chapterName,
          examDate: latestSession.examDate || new Date().toLocaleDateString('en-IN'),
        },
        rows
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${latestSession.sessionId}-Results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setHasDownloadedLocally(true);
      setDownloadToast(`Downloaded ${latestSession.sessionId}-Results.csv (${rows.length} candidates)`);
      setTimeout(() => setDownloadToast(null), 4000);
      await onHostAction('mark_results_downloaded');
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Failed to generate CSV report. Please try again.'
      );
    } finally {
      setIsGeneratingCsv(false);
    }
  };

  const triggerMasterPdfPrint = async () => {
    if (isGeneratingPdf) return;
    setActiveTab('results');
    setIsGeneratingPdf(true);
    setDownloadError(null);
    try {
      const latestSession = await fetchLatestHostSession();
      const rows = buildResultRows(latestSession);
      const pdfBytes = generateMasterReportPdf(
        {
          sessionId: latestSession.sessionId,
          title: latestSession.title,
          hostName: latestSession.hostName,
          course: latestSession.courseName,
          module: latestSession.moduleName,
          chapter: latestSession.chapterName,
          examDate: latestSession.examDate || new Date().toLocaleDateString('en-IN'),
        },
        rows
      );
      if (!pdfBytes || pdfBytes.byteLength < 100) {
        throw new Error('Generated PDF report was empty or invalid.');
      }
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${latestSession.sessionId}-Result-Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setHasDownloadedLocally(true);
      setDownloadToast(
        `Successfully downloaded ${latestSession.sessionId}-Result-Report.pdf (${rows.length} candidate records)`
      );
      setTimeout(() => setDownloadToast(null), 4500);
      await onHostAction('mark_results_downloaded');
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Failed to generate Result PDF. Please try again.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copySessionCode = () => {
    navigator.clipboard?.writeText(session.sessionId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyStudentJoinLink = () => {
    const joinUrl = `${window.location.origin}/?join=${encodeURIComponent(session.sessionId)}`;
    navigator.clipboard?.writeText(joinUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCloseSessionClick = () => {
    if (session.status === 'CLOSED') return;
    setShowCloseModal(true);
  };

  const confirmCloseSession = async (downloadFirst: boolean) => {
    await onHostAction('close_session');
    if (downloadFirst || (!hasDownloadedLocally && session.candidates.length > 0)) {
      await triggerMasterPdfPrint();
    }
    setShowCloseModal(false);
    setActiveTab('results');
  };

  const toggleSound = () => {
    soundManager.muted = !muted;
    setMuted(soundManager.muted);
  };

  const resultRows = buildResultRows();

  return (
    <div className="min-h-screen bg-slate-100/80 pb-12">
      {/* Examiner Control Center Sub-Header Bar matching screenshots */}
      <div className="bg-[#0B4F9E] text-white px-4 sm:px-8 py-3 shadow-xs no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white text-[#0B4F9E] font-extrabold flex items-center justify-center text-base shadow-xs">
              AC
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">
                Access Computer Preparation
              </h1>
              <p className="text-xs text-blue-200">Examiner Control Center</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="px-2.5 py-1.5 rounded bg-blue-800/70 hover:bg-blue-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-blue-200" />
                    <span className="hidden sm:inline">Dark Mode</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? 'Unmute Examiner Audio Alerts' : 'Mute Examiner Audio Alerts'}
              className="p-2 rounded bg-blue-800/70 hover:bg-blue-700 text-emerald-300 transition-colors cursor-pointer"
              title={muted ? 'Unmute audio alerts' : 'Mute audio alerts'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-red-300" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex flex-wrap items-center gap-1.5 bg-blue-950/50 p-1 rounded-lg border border-blue-800 max-w-full">
              <button
                type="button"
                onClick={() => {
                  if (session.status !== 'CLOSED' && !hasDownloadedLocally) {
                    setShowLeaveWarning(true);
                  } else {
                    onExitHost();
                  }
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded text-xs font-semibold text-blue-100 hover:bg-blue-800/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                Home
              </button>
              <button
                type="button"
                onClick={onNewSession}
                className="px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'monitoring'
                    ? 'bg-white text-[#0B4F9E] shadow-2xs'
                    : 'text-blue-100 hover:bg-blue-800/60'
                }`}
              >
                Controls &amp; Live Monitoring
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'results'
                    ? 'bg-white text-[#0B4F9E] shadow-2xs'
                    : 'text-blue-100 hover:bg-blue-800/60'
                }`}
              >
                Results &amp; PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-5">
        {downloadToast && (
          <div
            role="status"
            className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-between"
          >
            <span>{downloadToast}</span>
            <button
              type="button"
              onClick={() => setDownloadToast(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        {downloadError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-between"
          >
            <span>{downloadError}</span>
            <button
              type="button"
              onClick={() => setDownloadError(null)}
              className="text-red-700 hover:text-red-950 text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        {activeTab === 'monitoring' ? (
          <>
            {/* Current Session Info Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Current Session:
                  </span>
                  <span className="px-3 py-1 rounded bg-blue-50 border border-blue-200 font-mono font-extrabold text-base text-[#0B4F9E] tracking-wide">
                    {session.sessionId}
                  </span>
                  <button
                    type="button"
                    onClick={copySessionCode}
                    aria-label="Copy Session ID"
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Copy Session ID"
                  >
                    {copiedId ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <h2 className="text-lg font-extrabold text-slate-900">{session.title}</h2>
                <p className="text-xs text-slate-600">
                  Course: <strong className="text-slate-900">{session.courseName}</strong>
                  {session.moduleName ? ` · ${session.moduleName}` : ''}
                  {session.chapterName ? ` · ${session.chapterName}` : ''} | Examiner:{' '}
                  <strong className="text-slate-900">{session.hostName}</strong> | Total Qs:{' '}
                  <strong className="font-mono text-slate-900">{session.questionCount}</strong> |
                  Duration:{' '}
                  <strong className="font-mono text-slate-900">{session.durationMinutes}m</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span>Status:</span>
                  <span
                    className={`px-3 py-1 rounded font-bold uppercase tracking-wider ${
                      session.status === 'LIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : session.status === 'COUNTDOWN'
                        ? 'bg-amber-100 text-amber-800'
                        : session.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-800'
                        : session.status === 'CLOSED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {session.status === 'COUNTDOWN'
                      ? `STARTING (${session.countdownSeconds}s)`
                      : session.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={copyStudentJoinLink}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Student Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Copy Student Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Host Controls Bar matching screenshots */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Host Controls
              </h3>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {session.status === 'WAITING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onHostAction('start_countdown', { seconds: 30 })}
                        className="px-4 py-2.5 rounded-lg bg-[#15803D] hover:bg-green-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Test (30s Countdown)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onHostAction('start_now')}
                        className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Immediately</span>
                      </button>
                    </>
                  )}

                  {(session.status === 'LIVE' ||
                    session.status === 'PAUSED' ||
                    session.status === 'COUNTDOWN') && (
                    <>
                      <button
                        type="button"
                        onClick={() => onHostAction('toggle_pause')}
                        className="px-4 py-2.5 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {session.status === 'PAUSED' ? (
                          <>
                            <Play className="w-4 h-4" />
                            <span>Resume Exam</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>Pause Exam</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onHostAction('add_time', { minutes: 10 })}
                        className="px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+10 Mins</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onHostAction('add_time', { minutes: 15 })}
                        className="px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+15 Mins</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(true)}
                    disabled={session.status === 'CLOSED'}
                    className="px-4 py-2.5 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    <span>Broadcast Notice</span>
                  </button>
                </div>

                {session.status !== 'CLOSED' && (
                  <button
                    type="button"
                    onClick={handleCloseSessionClick}
                    className="px-4 py-2.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <XOctagon className="w-4 h-4" />
                    <span>Close Session</span>
                  </button>
                )}
              </div>
            </div>

            {/* 5 KPI Summary Cards matching screenshot */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Candidates
                </p>
                <p className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums mt-2">
                  {session.stats.totalCandidates}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Active Testing
                </p>
                <p className="text-3xl font-extrabold font-mono text-emerald-700 tabular-nums mt-2">
                  {session.stats.activeTesting}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Submitted
                </p>
                <p className="text-3xl font-extrabold font-mono text-blue-700 tabular-nums mt-2">
                  {session.stats.submittedCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Not Submitted: {session.stats.notSubmittedCount} · Removed:{' '}
                  {session.stats.removedCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                  Anti-Cheat Warnings
                </p>
                <p className="text-3xl font-extrabold font-mono text-red-600 tabular-nums mt-2">
                  {session.stats.totalWarnings}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs col-span-2 sm:col-span-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Remaining Time
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono text-red-600 tabular-nums mt-2">
                  {formatClock(session.remainingSeconds)}
                </p>
              </div>
            </div>

            {/* Bottom Split: Live Candidates Monitoring Table + Live Proctoring & Alerts Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Live Candidates Monitoring Table (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800">
                    Live Candidates Monitoring ({session.candidates.length})
                  </h3>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {session.candidates.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    No candidates have joined this session yet. Share the session ID (
                    <strong className="font-mono text-slate-800">{session.sessionId}</strong>) or
                    link!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-3 px-4">Candidate Name</th>
                          <th className="py-3 px-4">Roll Number</th>
                          <th className="py-3 px-4">Connection</th>
                          <th className="py-3 px-4">Progress (Q / Ans)</th>
                          <th className="py-3 px-4">Submission Status</th>
                          <th className="py-3 px-4">Warning Count</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                        {session.candidates.map((cand) => (
                          <tr key={cand.rollNumber} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {cand.name}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                              {cand.rollNumber}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-bold text-xs ${
                                  cand.connectionStatus === 'Online'
                                    ? 'text-emerald-700'
                                    : cand.connectionStatus === 'Removed'
                                    ? 'text-red-600'
                                    : 'text-slate-500'
                                }`}
                              >
                                {cand.connectionStatus === 'Online' ? 'Joined (Online)' : cand.connectionStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                              Q.{cand.currentQuestion} · Ans: {cand.answeredCount} / Unans:{' '}
                              {cand.unansweredCount}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-bold text-xs ${
                                  cand.submissionStatus === 'Submitted' ||
                                  cand.submissionStatus === 'Auto-Submitted'
                                    ? 'text-emerald-700'
                                    : cand.submissionStatus === 'Removed'
                                    ? 'text-red-600'
                                    : 'text-slate-600'
                                }`}
                              >
                                {cand.submissionStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                              {cand.warningsCount > 0 ? (
                                <span className="text-red-600">
                                  {cand.warningsCount} Alerts
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {cand.submissionStatus !== 'Removed' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onHostAction('remove_candidate', {
                                      rollNumber: cand.rollNumber,
                                    })
                                  }
                                  className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Live Proctoring & Alerts Feed (4 cols) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col max-h-[480px]">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800">
                    Live Proctoring &amp; Alerts Feed
                  </h3>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                  {session.events.map((evt) => {
                    const isWarning = evt.type === 'WARNING';
                    const isSubmit = evt.type === 'SUBMIT';
                    const isStart = evt.type === 'START';
                    return (
                      <div
                        key={evt.id}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          isWarning
                            ? 'bg-red-50/80 border-red-200 text-red-900'
                            : isSubmit
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : isStart
                            ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-75">
                          <span>{evt.type}</span>
                          <span className="font-mono tabular-nums">{evt.timestamp}</span>
                        </div>
                        <p className="font-medium leading-snug">{evt.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Official Results & PDF Generation Tab matching Screenshot_2026-10-30_193156_7a5fa1cd.png */
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Official Results &amp; PDF Generation
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Detailed candidate scorecards, ranking table, and exportable CSV / PDF examination
                  reports for Session <strong className="font-mono">{session.sessionId}</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 no-print">
                <button
                  type="button"
                  disabled={isGeneratingCsv}
                  onClick={triggerCsvDownload}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>{isGeneratingCsv ? 'Generating CSV...' : 'Download CSV / Excel'}</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={triggerMasterPdfPrint}
                  className="px-4 py-2.5 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {isGeneratingPdf ? 'Generating PDF Report...' : 'Download Result PDF'}
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              {resultRows.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No candidate submissions recorded yet for session{' '}
                  <strong className="font-mono">{session.sessionId}</strong>. You can still download
                  an official session summary PDF above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-4">Roll No</th>
                        <th className="py-3.5 px-4">Candidate Name</th>
                        <th className="py-3.5 px-4">Attempted</th>
                        <th className="py-3.5 px-4">Correct</th>
                        <th className="py-3.5 px-4">Incorrect</th>
                        <th className="py-3.5 px-4">Unanswered</th>
                        <th className="py-3.5 px-4">Score</th>
                        <th className="py-3.5 px-4">Percentage</th>
                        <th className="py-3.5 px-4">Time Taken</th>
                        <th className="py-3.5 px-4">Result</th>
                        <th className="py-3.5 px-4">Submission Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                      {resultRows.map((row, idx) => (
                        <tr key={row.rollNumber} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                            {row.rollNumber}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">{row.name}</td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">{row.attempted}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 tabular-nums">
                            {row.correct}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-red-600 tabular-nums">
                            {row.incorrect}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                            {row.unanswered}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 tabular-nums">
                            {row.score} / {row.totalQuestions}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-800 tabular-nums">
                            {row.percentage}%
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                            {row.timeTakenSeconds}s
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-bold text-xs ${
                                row.status === 'PASS' ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {row.submissionStatus || row.submittedAt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Broadcast Notice Modal */}
      {showBroadcastModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="broadcast-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-[#0B4F9E] text-white px-5 py-3.5 font-bold text-base" id="broadcast-title">
              Broadcast Notice to All Candidates
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="broadcast-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Announcement Message (Auto-dismisses on student screen after ~4.5 seconds)
                </label>
                <textarea
                  id="broadcast-input"
                  rows={3}
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  placeholder="e.g., Check Question 12 carefully. 10 minutes remaining."
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingBroadcast || !broadcastInput.trim()}
                  onClick={async () => {
                    const msg = broadcastInput.trim();
                    if (!msg) return;
                    setSendingBroadcast(true);
                    try {
                      await onHostAction('broadcast_notice', { message: msg });
                      setBroadcastInput('');
                      setShowBroadcastModal(false);
                      setDownloadToast(`Broadcast Notice sent to all connected candidates: "${msg}"`);
                      setTimeout(() => setDownloadToast(null), 3500);
                    } finally {
                      setSendingBroadcast(false);
                    }
                  }}
                  className="px-4 py-2 rounded bg-[#0B4F9E] hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {sendingBroadcast ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Close Safety Modal (Section 24) */}
      {showCloseModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-safety-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-red-700 text-white px-5 py-3.5 font-bold text-base flex items-center gap-2" id="close-safety-title">
              <AlertTriangle className="w-5 h-5" />
              <span>Close Examination Session</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                You have unsaved/downloadable examination results. Closing this session will
                auto-submit all active candidates and end the test. Are you sure you want to close
                this session?
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmCloseSession(false)}
                  className="px-4 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                >
                  Close Anyway
                </button>
                <button
                  type="button"
                  onClick={() => confirmCloseSession(true)}
                  className="px-4 py-2 rounded bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Results &amp; Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Leave Active Session Warning Modal (Section 25) */}
      {showLeaveWarning && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="host-leave-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-amber-600 text-white px-5 py-3.5 font-bold text-base flex items-center gap-2" id="host-leave-title">
              <AlertTriangle className="w-5 h-5" />
              <span>Active Host Session Warning</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Your hosted examination session ({session.sessionId}) is still active. Leaving now
                without downloading results may interrupt live monitoring.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveWarning(false)}
                  className="px-4 py-2 rounded bg-[#0B4F9E] text-white text-xs font-bold cursor-pointer"
                >
                  Wait (Stay in Dashboard)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveWarning(false);
                    onExitHost();
                  }}
                  className="px-4 py-2 rounded border border-red-300 text-red-700 text-xs font-semibold cursor-pointer"
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
