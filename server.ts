import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { CourseId, ExamLanguage, getCourseById, getModuleById, getChapterById } from './src/lib/syllabus';
import { QuestionItem } from './src/lib/questionBank';
import {
  generatePracticeQuestionSet,
  sanitizeQuestionForStudent,
  StudentQuestionItem,
  QuestionResponseState,
  calculateExamResult,
  ExamResultSummary,
  generateSessionId,
  validateQuestion,
  generateMasterReportPdf,
  CandidateResultRow,
} from './src/lib/examEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProctoringEvent {
  id: string;
  type: 'JOIN' | 'START' | 'WARNING' | 'SUBMIT' | 'BROADCAST' | 'REMOVE' | 'CLOSE';
  message: string;
  candidateName?: string;
  rollNumber?: string;
  timestamp: string;
}

export interface HostedCandidate {
  rollNumber: string;
  name: string;
  connectionStatus: 'Online' | 'Offline' | 'Removed';
  submissionStatus: 'Not Started' | 'In Progress' | 'Submitted' | 'Auto-Submitted' | 'Removed';
  autoSubmitted?: boolean;
  currentQuestion: number;
  answeredCount: number;
  unansweredCount: number;
  warningsCount: number;
  joinedAt: number;
  startedAt: number | null;
  submittedAt: string | null;
  timeTakenSeconds: number;
  responses: Record<string, QuestionResponseState>;
  result: ExamResultSummary | null;
}

export interface HostedSession {
  sessionId: string;
  hostToken: string;
  hostName: string;
  course: CourseId;
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
  createdAt: string;
  examDate: string;
  broadcastMessage: string | null;
  broadcastId: string | null;
  broadcastAt: number | null;
  resultsDownloaded: boolean;
  questions: QuestionItem[]; // Authoritative questions with answers kept on server
  candidates: Map<string, HostedCandidate>;
  events: ProctoringEvent[];
}

const sessions = new Map<string, HostedSession>();

function formatClockTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatExamDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function addSessionEvent(
  session: HostedSession,
  type: ProctoringEvent['type'],
  message: string,
  candidateName?: string,
  rollNumber?: string
): ProctoringEvent {
  const evt: ProctoringEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    candidateName,
    rollNumber,
    timestamp: formatClockTime(),
  };
  session.events.unshift(evt);
  if (session.events.length > 200) {
    session.events.length = 200;
  }
  return evt;
}

function serializeHostSession(session: HostedSession) {
  const now = Date.now();
  const candidatesList = Array.from(session.candidates.values()).map((c) => {
    const elapsed =
      c.timeTakenSeconds > 0
        ? c.timeTakenSeconds
        : c.startedAt
        ? Math.max(0, Math.round((now - c.startedAt) / 1000))
        : Math.max(0, session.durationMinutes * 60 - session.remainingSeconds);

    const computedResult =
      c.result || calculateExamResult(session.questions, c.responses || {}, elapsed);

    return {
      rollNumber: c.rollNumber,
      name: c.name,
      connectionStatus: c.connectionStatus,
      submissionStatus: c.submissionStatus,
      autoSubmitted: Boolean(c.autoSubmitted),
      currentQuestion: c.currentQuestion,
      answeredCount: computedResult.attempted,
      unansweredCount: computedResult.unanswered,
      warningsCount: c.warningsCount,
      submittedAt: c.submittedAt,
      timeTakenSeconds: c.timeTakenSeconds > 0 ? c.timeTakenSeconds : elapsed,
      result: computedResult,
    };
  });

  const totalCandidates = candidatesList.filter((c) => c.connectionStatus !== 'Removed').length;
  const activeTesting = candidatesList.filter(
    (c) =>
      c.connectionStatus === 'Online' &&
      c.submissionStatus !== 'Submitted' &&
      c.submissionStatus !== 'Auto-Submitted' &&
      c.submissionStatus !== 'Removed'
  ).length;
  const submittedCount = candidatesList.filter(
    (c) => c.submissionStatus === 'Submitted' || c.submissionStatus === 'Auto-Submitted'
  ).length;
  const removedCount = candidatesList.filter((c) => c.submissionStatus === 'Removed').length;
  const totalWarnings = candidatesList.reduce((acc, c) => acc + c.warningsCount, 0);

  return {
    sessionId: session.sessionId,
    hostName: session.hostName,
    course: session.course,
    courseName: session.courseName,
    module: session.module,
    moduleName: session.moduleName,
    chapter: session.chapter,
    chapterName: session.chapterName,
    title: session.title,
    durationMinutes: session.durationMinutes,
    questionCount: session.questions.length,
    language: session.language,
    status: session.status,
    countdownSeconds: session.countdownSeconds,
    remainingSeconds: session.remainingSeconds,
    createdAt: session.createdAt,
    examDate: session.examDate,
    broadcastMessage: session.broadcastMessage,
    broadcastId: session.broadcastId,
    broadcastAt: session.broadcastAt,
    resultsDownloaded: session.resultsDownloaded,
    stats: {
      totalCandidates,
      activeTesting,
      submittedCount,
      notSubmittedCount: Math.max(0, totalCandidates - submittedCount),
      removedCount,
      totalWarnings,
    },
    candidates: candidatesList,
    events: session.events,
  };
}

function serializeStudentSession(session: HostedSession, rollNumber: string) {
  const candidate = session.candidates.get(rollNumber);
  const canViewQuestions = session.status === 'LIVE' || session.status === 'PAUSED';
  const studentQuestions: StudentQuestionItem[] = canViewQuestions
    ? session.questions.map(sanitizeQuestionForStudent)
    : [];

  return {
    sessionId: session.sessionId,
    hostName: session.hostName,
    course: session.course,
    courseName: session.courseName,
    module: session.module,
    moduleName: session.moduleName,
    chapter: session.chapter,
    chapterName: session.chapterName,
    title: session.title,
    durationMinutes: session.durationMinutes,
    questionCount: session.questions.length,
    language: session.language,
    status: session.status,
    countdownSeconds: session.countdownSeconds,
    remainingSeconds: session.remainingSeconds,
    broadcastMessage: session.broadcastMessage,
    broadcastId: session.broadcastId,
    broadcastAt: session.broadcastAt,
    candidate: candidate
      ? {
          rollNumber: candidate.rollNumber,
          name: candidate.name,
          connectionStatus: candidate.connectionStatus,
          submissionStatus: candidate.submissionStatus,
          autoSubmitted: Boolean(candidate.autoSubmitted),
          currentQuestion: candidate.currentQuestion,
          warningsCount: candidate.warningsCount,
          submittedAt: candidate.submittedAt,
          responses: candidate.responses,
        }
      : null,
    questions: studentQuestions,
  };
}

function finalizeCandidateSubmission(
  session: HostedSession,
  candidate: HostedCandidate,
  autoSubmitted = false
) {
  if (
    candidate.submissionStatus === 'Submitted' ||
    candidate.submissionStatus === 'Auto-Submitted' ||
    candidate.submissionStatus === 'Removed'
  ) {
    return;
  }
  const now = Date.now();
  const elapsed = candidate.startedAt
    ? Math.round((now - candidate.startedAt) / 1000)
    : session.durationMinutes * 60 - session.remainingSeconds;
  const result = calculateExamResult(session.questions, candidate.responses, Math.max(1, elapsed));
  candidate.result = result;
  candidate.autoSubmitted = autoSubmitted;
  candidate.submissionStatus = autoSubmitted ? 'Auto-Submitted' : 'Submitted';
  candidate.submittedAt = formatClockTime();
  candidate.timeTakenSeconds = result.timeTakenSeconds;
  candidate.answeredCount = result.attempted;
  candidate.unansweredCount = result.unanswered;

  addSessionEvent(
    session,
    'SUBMIT',
    autoSubmitted
      ? `${candidate.name} (Roll: ${candidate.rollNumber}) test was auto-submitted upon timer completion.`
      : `${candidate.name} (Roll: ${candidate.rollNumber}) submitted the test.`,
    candidate.name,
    candidate.rollNumber
  );
}

// Optional server-side Gemini AI question augmentation with strict validation
async function tryGenerateValidatedGeminiQuestions(params: {
  course: CourseId;
  module?: string;
  chapter?: string;
  count: number;
}): Promise<QuestionItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return [];
  }
  try {
    const courseInfo = getCourseById(params.course);
    const modInfo = params.module ? getModuleById(params.course, params.module) : undefined;
    const chapInfo = params.chapter
      ? getChapterById(params.course, params.chapter, params.module)
      : undefined;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const topicContext = [
      `Course: ${courseInfo?.name || params.course}`,
      modInfo ? `Module: ${modInfo.code} - ${modInfo.title}` : '',
      chapInfo ? `Chapter: ${chapInfo.title} (${chapInfo.description})` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate ${Math.min(params.count, 5)} accurate, exam-standard multiple-choice questions strictly for ${topicContext}. Provide both English and Hindi text, 4 distinct options, the 0-based correct option index (0-3), and a concise explanation.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionEn: { type: Type.STRING },
              questionHi: { type: Type.STRING },
              optionsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
              optionsHi: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanationEn: { type: Type.STRING },
              explanationHi: { type: Type.STRING },
              difficulty: { type: Type.STRING },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim());
    if (!Array.isArray(parsed)) return [];

    const validItems: QuestionItem[] = [];
    parsed.forEach((raw, idx) => {
      if (
        Array.isArray(raw.optionsEn) &&
        raw.optionsEn.length === 4 &&
        Array.isArray(raw.optionsHi) &&
        raw.optionsHi.length === 4
      ) {
        const candidate: QuestionItem = {
          id: `ai-${params.course}-${Date.now()}-${idx}`,
          course: params.course,
          module: params.module,
          chapter: params.chapter,
          questionEn: String(raw.questionEn || ''),
          questionHi: String(raw.questionHi || raw.questionEn || ''),
          optionsEn: [
            String(raw.optionsEn[0]),
            String(raw.optionsEn[1]),
            String(raw.optionsEn[2]),
            String(raw.optionsEn[3]),
          ],
          optionsHi: [
            String(raw.optionsHi[0]),
            String(raw.optionsHi[1]),
            String(raw.optionsHi[2]),
            String(raw.optionsHi[3]),
          ],
          correctIndex: (Number(raw.correctIndex) as 0 | 1 | 2 | 3) || 0,
          explanationEn: String(raw.explanationEn || ''),
          explanationHi: String(raw.explanationHi || raw.explanationEn || ''),
          difficulty:
            raw.difficulty === 'Easy' || raw.difficulty === 'Hard' ? raw.difficulty : 'Medium',
          source: 'AI Verified Syllabus Supplement',
        };
        if (validateQuestion(candidate, params.course, params.module, params.chapter).valid) {
          validItems.push(candidate);
        }
      }
    });
    return validItems;
  } catch {
    return [];
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      const first = protocols.values().next().value;
      return first || false;
    },
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const protocolHeader = String(request.headers['sec-websocket-protocol'] || '');
      if (protocolHeader.includes('vite-hmr') || protocolHeader.includes('vite-ping')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          if (protocolHeader.includes('vite-hmr') && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'connected' }));
          }
          ws.on('error', () => {});
        });
        return;
      }

      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.on('error', () => {});
        });
      }
    } catch {
      socket.destroy();
    }
  });

  interface SocketClientMeta {
    ws: WebSocket;
    sessionId: string;
    role: 'host' | 'student';
    rollNumber?: string;
  }

  const clients = new Set<SocketClientMeta>();

  function broadcastSessionUpdate(sessionId: string, soundCue?: 'join' | 'alert' | 'submit') {
    const session = sessions.get(sessionId);
    if (!session) return;
    const hostPayload = JSON.stringify({
      type: 'SESSION_STATE',
      soundCue,
      session: serializeHostSession(session),
    });

    for (const client of clients) {
      if (client.sessionId !== sessionId || client.ws.readyState !== WebSocket.OPEN) continue;
      if (client.role === 'host') {
        client.ws.send(hostPayload);
      } else if (client.role === 'student' && client.rollNumber) {
        client.ws.send(
          JSON.stringify({
            type: 'STUDENT_STATE',
            session: serializeStudentSession(session, client.rollNumber),
          })
        );
      }
    }
  }

  // Authoritative 1-second server timer loop for all active sessions
  setInterval(() => {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.status === 'COUNTDOWN') {
        session.countdownSeconds = Math.max(0, session.countdownSeconds - 1);
        if (session.countdownSeconds === 0) {
          session.status = 'LIVE';
          const now = Date.now();
          for (const cand of session.candidates.values()) {
            if (cand.submissionStatus === 'Not Started') {
              cand.submissionStatus = 'In Progress';
              cand.startedAt = now;
            }
          }
          addSessionEvent(session, 'START', 'Official examination started! Timers synchronized.');
        }
        broadcastSessionUpdate(sessionId);
      } else if (session.status === 'LIVE') {
        session.remainingSeconds = Math.max(0, session.remainingSeconds - 1);
        if (session.remainingSeconds === 0) {
          // Auto-submit all candidates when time reaches zero
          for (const cand of session.candidates.values()) {
            if (cand.submissionStatus !== 'Submitted' && cand.submissionStatus !== 'Removed') {
              finalizeCandidateSubmission(session, cand, true);
            }
          }
          session.status = 'CLOSED';
          addSessionEvent(
            session,
            'CLOSE',
            'Examination timer reached 00:00. All active tests were automatically submitted.'
          );
          broadcastSessionUpdate(sessionId, 'submit');
        } else {
          broadcastSessionUpdate(sessionId);
        }
      }
    }
  }, 1000);

  wss.on('connection', (ws) => {
    let currentMeta: SocketClientMeta | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'SUBSCRIBE') {
          const sessionId = String(msg.sessionId || '').toUpperCase();
          const role = msg.role === 'host' ? 'host' : 'student';
          const rollNumber = msg.rollNumber ? String(msg.rollNumber) : undefined;
          currentMeta = { ws, sessionId, role, rollNumber };
          clients.add(currentMeta);

          const session = sessions.get(sessionId);
          if (session) {
            if (role === 'student' && rollNumber) {
              const cand = session.candidates.get(rollNumber);
              if (cand && cand.connectionStatus !== 'Removed') {
                cand.connectionStatus = 'Online';
              }
              ws.send(
                JSON.stringify({
                  type: 'STUDENT_STATE',
                  session: serializeStudentSession(session, rollNumber),
                })
              );
              broadcastSessionUpdate(sessionId);
            } else if (role === 'host') {
              ws.send(
                JSON.stringify({
                  type: 'SESSION_STATE',
                  session: serializeHostSession(session),
                })
              );
            }
          }
        }
      } catch {
        // Ignore malformed WS message
      }
    });

    ws.on('close', () => {
      if (currentMeta) {
        const { sessionId, role, rollNumber } = currentMeta;
        clients.delete(currentMeta);
        if (role === 'student' && rollNumber) {
          const session = sessions.get(sessionId);
          const cand = session?.candidates.get(rollNumber);
          if (session && cand && cand.connectionStatus !== 'Removed') {
            cand.connectionStatus = 'Offline';
            broadcastSessionUpdate(sessionId);
          }
        }
      }
    });
  });

  // ============================================================================
  // REST API ENDPOINTS
  // ============================================================================

  // 1. Generate Fresh Practice / Solo Test Question Set
  app.post('/api/questions/practice', async (req, res) => {
    try {
      const {
        course,
        module,
        chapter,
        count = 25,
        previouslySeenIds = [],
        useAiSupplement = false,
      } = req.body || {};

      const courseInfo = getCourseById(String(course));
      if (!courseInfo) {
        return res.status(400).json({ error: 'Please select a valid course.' });
      }
      if (courseInfo.hasModules && module && !getModuleById(courseInfo.id, String(module))) {
        return res.status(400).json({ error: 'Selected module does not belong to this course.' });
      }
      if (
        courseInfo.hasChapters &&
        chapter &&
        !getChapterById(courseInfo.id, String(chapter), module ? String(module) : undefined)
      ) {
        return res.status(400).json({ error: 'Selected chapter is invalid for this module/course.' });
      }

      const numericCount = Math.max(1, Math.min(200, Number(count) || 25));

      const baseQuestions = generatePracticeQuestionSet({
        course: courseInfo.id,
        module: module ? String(module) : undefined,
        chapter: chapter ? String(chapter) : undefined,
        count: numericCount,
        previouslySeenIds: Array.isArray(previouslySeenIds) ? previouslySeenIds : [],
      });

      if (useAiSupplement) {
        const aiQuestions = await tryGenerateValidatedGeminiQuestions({
          course: courseInfo.id,
          module: module ? String(module) : undefined,
          chapter: chapter ? String(chapter) : undefined,
          count: 3,
        });
        if (aiQuestions.length > 0) {
          baseQuestions.splice(0, aiQuestions.length, ...aiQuestions);
        }
      }

      return res.json({
        questions: baseQuestions,
        totalGenerated: baseQuestions.length,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate question set.',
      });
    }
  });

  // 2. Teacher's Host: Create New Examination Session
  app.post('/api/sessions', (req, res) => {
    try {
      const {
        hostName,
        course,
        module,
        chapter,
        title,
        durationMinutes,
        questionCount,
        language = 'bilingual',
      } = req.body || {};

      if (!hostName || !String(hostName).trim()) {
        return res.status(400).json({ error: 'Teacher/Examiner Name is required.' });
      }
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Test Title is required.' });
      }

      const courseInfo = getCourseById(String(course));
      if (!courseInfo) {
        return res.status(400).json({ error: 'Please select a valid Course.' });
      }

      const modInfo =
        courseInfo.hasModules && module ? getModuleById(courseInfo.id, String(module)) : undefined;
      const chapInfo =
        courseInfo.hasChapters && chapter
          ? getChapterById(courseInfo.id, String(chapter), modInfo?.id)
          : undefined;

      const dur = Math.max(1, Math.min(240, Number(durationMinutes) || 60));
      const qCount = Math.max(5, Math.min(100, Number(questionCount) || 25));

      const questions = generatePracticeQuestionSet({
        course: courseInfo.id,
        module: modInfo?.id,
        chapter: chapInfo?.id,
        count: qCount,
      });

      const sessionId = generateSessionId(new Set(sessions.keys()));
      const hostToken = `host_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const session: HostedSession = {
        sessionId,
        hostToken,
        hostName: String(hostName).trim(),
        course: courseInfo.id,
        courseName: courseInfo.name,
        module: modInfo?.id,
        moduleName: modInfo?.title,
        chapter: chapInfo?.id,
        chapterName: chapInfo?.title,
        title: String(title).trim(),
        durationMinutes: dur,
        questionCount: questions.length,
        language: ['en', 'hi', 'bilingual'].includes(language) ? language : 'bilingual',
        status: 'WAITING',
        countdownSeconds: 30,
        remainingSeconds: dur * 60,
        createdAt: formatClockTime(),
        examDate: formatExamDate(),
        broadcastMessage: null,
        broadcastId: null,
        broadcastAt: null,
        resultsDownloaded: false,
        questions,
        candidates: new Map(),
        events: [],
      };

      addSessionEvent(
        session,
        'JOIN',
        `Session ${sessionId} created by ${session.hostName}.`
      );

      sessions.set(sessionId, session);

      return res.status(201).json({
        sessionId,
        hostToken,
        session: serializeHostSession(session),
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to create examination session.',
      });
    }
  });

  // 3. Get Host Session State
  app.get('/api/sessions/:sessionId/host', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or no longer active.' });
    }
    return res.json({ session: serializeHostSession(session) });
  });

  // 4. Student Join Server
  app.post('/api/sessions/:sessionId/join', (req, res) => {
    const sessionId = String(req.params.sessionId || '').trim().toUpperCase();
    const { name, rollNumber } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Student/Candidate Name is required.' });
    }
    if (!rollNumber || !String(rollNumber).trim()) {
      return res.status(400).json({ error: 'Roll Number is required.' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or no longer active.' });
    }
    if (session.status === 'CLOSED') {
      return res.status(400).json({ error: 'This examination session has already ended.' });
    }

    const cleanName = String(name).trim();
    const cleanRoll = String(rollNumber).trim().toUpperCase();

    const existing = session.candidates.get(cleanRoll);
    if (existing) {
      if (existing.submissionStatus === 'Removed') {
        return res.status(403).json({
          error: 'Your candidate entry was removed by the examiner.',
        });
      }
      if (existing.name.toLowerCase() !== cleanName.toLowerCase()) {
        return res.status(409).json({
          error: `Roll Number "${cleanRoll}" is already registered by another candidate in this session.`,
        });
      }
      // Safe reconnect for the same candidate
      existing.connectionStatus = 'Online';
      broadcastSessionUpdate(sessionId);
      return res.json({
        session: serializeStudentSession(session, cleanRoll),
      });
    }

    // Initialize empty response map
    const initialResponses: Record<string, QuestionResponseState> = {};
    session.questions.forEach((q, idx) => {
      initialResponses[q.id] = {
        selectedOption: null,
        markedForReview: false,
        visited: idx === 0,
      };
    });

    const isLive = session.status === 'LIVE' || session.status === 'PAUSED';
    const newCandidate: HostedCandidate = {
      rollNumber: cleanRoll,
      name: cleanName,
      connectionStatus: 'Online',
      submissionStatus: isLive ? 'In Progress' : 'Not Started',
      currentQuestion: 1,
      answeredCount: 0,
      unansweredCount: session.questions.length,
      warningsCount: 0,
      joinedAt: Date.now(),
      startedAt: isLive ? Date.now() : null,
      submittedAt: null,
      timeTakenSeconds: 0,
      responses: initialResponses,
      result: null,
    };

    session.candidates.set(cleanRoll, newCandidate);
    addSessionEvent(
      session,
      'JOIN',
      `Candidate ${cleanName} (Roll: ${cleanRoll}) joined the test session.`,
      cleanName,
      cleanRoll
    );

    broadcastSessionUpdate(sessionId, 'join');
    return res.status(201).json({
      session: serializeStudentSession(session, cleanRoll),
    });
  });

  // 5. Get Student Session State
  app.get('/api/sessions/:sessionId/student/:rollNumber', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const rollNumber = String(req.params.rollNumber || '').toUpperCase();
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or no longer active.' });
    }
    const cand = session.candidates.get(rollNumber);
    if (!cand) {
      return res.status(404).json({ error: 'Candidate registration not found in this session.' });
    }
    return res.json({
      session: serializeStudentSession(session, rollNumber),
    });
  });

  // 6. Candidate Progress & Proctoring Updates
  app.post('/api/sessions/:sessionId/progress', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const { rollNumber, currentQuestion, responses, proctoringAlert } = req.body || {};
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const cleanRoll = String(rollNumber || '').toUpperCase();
    const candidate = session.candidates.get(cleanRoll);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    if (
      candidate.submissionStatus === 'Submitted' ||
      candidate.submissionStatus === 'Auto-Submitted' ||
      candidate.submissionStatus === 'Removed'
    ) {
      return res.json({ session: serializeStudentSession(session, cleanRoll) });
    }

    if (typeof currentQuestion === 'number' && currentQuestion >= 1) {
      candidate.currentQuestion = Math.min(session.questions.length, currentQuestion);
    }

    if (responses && typeof responses === 'object') {
      candidate.responses = responses;
      let answered = 0;
      for (const q of session.questions) {
        const r = responses[q.id];
        if (r && r.selectedOption !== null && r.selectedOption !== undefined) {
          answered++;
        }
      }
      candidate.answeredCount = answered;
      candidate.unansweredCount = Math.max(0, session.questions.length - answered);
    }

    let soundCue: 'alert' | undefined;
    if (proctoringAlert && typeof proctoringAlert === 'string' && session.status === 'LIVE') {
      candidate.warningsCount += 1;
      addSessionEvent(
        session,
        'WARNING',
        `⚠ Anti-Cheating Alert: Candidate ${candidate.name} (Roll: ${candidate.rollNumber}) ${proctoringAlert} (Warning #${candidate.warningsCount})`,
        candidate.name,
        candidate.rollNumber
      );
      soundCue = 'alert';
    }

    broadcastSessionUpdate(sessionId, soundCue);
    return res.json({
      session: serializeStudentSession(session, cleanRoll),
    });
  });

  // 7. Candidate Submit Examination
  app.post('/api/sessions/:sessionId/submit', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const { rollNumber, responses } = req.body || {};
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const cleanRoll = String(rollNumber || '').toUpperCase();
    const candidate = session.candidates.get(cleanRoll);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    if (responses && typeof responses === 'object') {
      candidate.responses = responses;
    }

    finalizeCandidateSubmission(session, candidate, false);
    broadcastSessionUpdate(sessionId, 'submit');

    return res.json({
      session: serializeStudentSession(session, cleanRoll),
    });
  });

  // 8. Host Controls Action Endpoint
  app.post('/api/sessions/:sessionId/action', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const { action, payload } = req.body || {};
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    switch (action) {
      case 'start_countdown': {
        if (session.status === 'WAITING') {
          session.status = 'COUNTDOWN';
          session.countdownSeconds = Number(payload?.seconds) || 30;
          addSessionEvent(
            session,
            'START',
            `Host triggered ${session.countdownSeconds}-Second Countdown to begin test.`
          );
        }
        break;
      }
      case 'start_now': {
        session.status = 'LIVE';
        session.countdownSeconds = 0;
        const now = Date.now();
        for (const cand of session.candidates.values()) {
          if (cand.submissionStatus === 'Not Started') {
            cand.submissionStatus = 'In Progress';
            cand.startedAt = now;
          }
        }
        addSessionEvent(session, 'START', 'Official examination started immediately by Host.');
        break;
      }
      case 'toggle_pause': {
        if (session.status === 'LIVE') {
          session.status = 'PAUSED';
          addSessionEvent(session, 'BROADCAST', 'Examiner paused the examination timer.');
        } else if (session.status === 'PAUSED') {
          session.status = 'LIVE';
          addSessionEvent(session, 'START', 'Examiner resumed the examination timer.');
        }
        break;
      }
      case 'add_time': {
        const extraMinutes = Number(payload?.minutes) || 10;
        session.remainingSeconds += extraMinutes * 60;
        session.durationMinutes += extraMinutes;
        addSessionEvent(
          session,
          'BROADCAST',
          `Examiner extended examination time by +${extraMinutes} minutes.`
        );
        break;
      }
      case 'broadcast_notice': {
        const message = String(payload?.message || '').trim();
        session.broadcastMessage = message || null;
        if (message) {
          session.broadcastId = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          session.broadcastAt = Date.now();
          addSessionEvent(session, 'BROADCAST', `Examiner Notice: "${message}"`);
        } else {
          session.broadcastId = null;
          session.broadcastAt = null;
        }
        break;
      }
      case 'remove_candidate': {
        const roll = String(payload?.rollNumber || '').toUpperCase();
        const cand = session.candidates.get(roll);
        if (cand) {
          cand.connectionStatus = 'Removed';
          cand.submissionStatus = 'Removed';
          addSessionEvent(
            session,
            'REMOVE',
            `Candidate ${cand.name} (Roll: ${cand.rollNumber}) was removed by the examiner.`,
            cand.name,
            cand.rollNumber
          );
        }
        break;
      }
      case 'mark_results_downloaded': {
        session.resultsDownloaded = true;
        break;
      }
      case 'close_session': {
        for (const cand of session.candidates.values()) {
          if (
            cand.submissionStatus !== 'Submitted' &&
            cand.submissionStatus !== 'Auto-Submitted' &&
            cand.submissionStatus !== 'Removed'
          ) {
            finalizeCandidateSubmission(session, cand, true);
          }
        }
        session.status = 'CLOSED';
        addSessionEvent(session, 'CLOSE', `Session ${sessionId} closed by examiner.`);
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown host action: ${action}` });
    }

    broadcastSessionUpdate(sessionId);
    return res.json({
      session: serializeHostSession(session),
    });
  });

  // 9. Authoritative Server-Side PDF Report Download Endpoint
  app.get('/api/sessions/:sessionId/results.pdf', (req, res) => {
    const sessionId = String(req.params.sessionId || '').toUpperCase();
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const hostData = serializeHostSession(session);
    const rows: CandidateResultRow[] = hostData.candidates
      .filter((c) => c.submissionStatus !== 'Removed')
      .map((c) => {
        const r = c.result!;
        let subLabel: string = c.submissionStatus;
        if (c.autoSubmitted || c.submissionStatus === 'Auto-Submitted') {
          subLabel = 'Auto-Submitted';
        } else if (c.submissionStatus === 'In Progress' && c.connectionStatus === 'Offline') {
          subLabel = 'Disconnected';
        }
        return {
          rollNumber: c.rollNumber,
          name: c.name,
          attempted: r.attempted,
          correct: r.correct,
          incorrect: r.incorrect,
          unanswered: r.unanswered,
          score: r.score,
          totalQuestions: session.questions.length,
          percentage: r.percentage,
          status: r.percentage >= 50 ? 'PASS' : 'FAIL',
          timeTakenSeconds: c.timeTakenSeconds || 0,
          submittedAt: c.submittedAt || subLabel,
          warningsCount: c.warningsCount,
          submissionStatus: subLabel,
        };
      });

    const pdfBytes = generateMasterReportPdf(
      {
        sessionId: session.sessionId,
        title: session.title,
        hostName: session.hostName,
        course: session.courseName,
        module: session.moduleName,
        chapter: session.chapterName,
        examDate: session.examDate,
      },
      rows
    );

    session.resultsDownloaded = true;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${session.sessionId}-Master-Report.pdf"`);
    return res.send(Buffer.from(pdfBytes));
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Access Computer Preparation server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
