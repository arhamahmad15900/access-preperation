import { CourseId, getCourseById } from './syllabus';
import { QuestionItem } from './questionBank';
import { buildExpandedQuestionPool } from './questionGenerator';

export type PaletteStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

export interface StudentQuestionItem {
  id: string;
  course: CourseId;
  module?: string;
  chapter?: string;
  questionEn: string;
  questionHi: string;
  optionsEn: [string, string, string, string];
  optionsHi: [string, string, string, string];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  source: string;
}

export interface QuestionResponseState {
  selectedOption: number | null; // 0..3 or null
  markedForReview: boolean;
  visited: boolean;
}

export interface ExamResultSummary {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  markedForReviewCount: number;
  score: number;
  percentage: number;
  accuracy: number;
  passed: boolean;
  grade: string;
  timeTakenSeconds: number;
}

/**
 * Validates a question against all 10 quality rules from Section 39.
 */
export function validateQuestion(
  q: QuestionItem,
  expectedCourse?: CourseId,
  expectedModule?: string,
  expectedChapter?: string
): { valid: boolean; reason?: string } {
  if (!q || typeof q.id !== 'string' || !q.id.trim()) {
    return { valid: false, reason: 'Missing question ID' };
  }
  if (expectedCourse && q.course !== expectedCourse) {
    return { valid: false, reason: `Course mismatch: expected ${expectedCourse}, got ${q.course}` };
  }
  if (expectedModule && q.module !== expectedModule) {
    return { valid: false, reason: `Module mismatch: expected ${expectedModule}, got ${q.module}` };
  }
  if (expectedChapter && q.chapter !== expectedChapter) {
    return { valid: false, reason: `Chapter mismatch: expected ${expectedChapter}, got ${q.chapter}` };
  }
  if (!q.questionEn || q.questionEn.trim().length < 5) {
    return { valid: false, reason: 'Invalid English question text' };
  }
  if (!q.questionHi || q.questionHi.trim().length < 3) {
    return { valid: false, reason: 'Invalid Hindi question text' };
  }
  if (!Array.isArray(q.optionsEn) || q.optionsEn.length !== 4) {
    return { valid: false, reason: 'Must have exactly 4 English options' };
  }
  if (!Array.isArray(q.optionsHi) || q.optionsHi.length !== 4) {
    return { valid: false, reason: 'Must have exactly 4 Hindi options' };
  }
  const trimmedEn = q.optionsEn.map((o) => (o || '').trim());
  if (trimmedEn.some((o) => o.length === 0)) {
    return { valid: false, reason: 'Empty option text found' };
  }
  const uniqueEn = new Set(trimmedEn.map((o) => o.toLowerCase()));
  if (uniqueEn.size !== 4) {
    return { valid: false, reason: 'Duplicate options detected' };
  }
  if (![0, 1, 2, 3].includes(q.correctIndex)) {
    return { valid: false, reason: 'correctIndex must be 0, 1, 2, or 3' };
  }
  if (!q.explanationEn || q.explanationEn.trim().length < 5) {
    return { valid: false, reason: 'Explanation is missing or too short' };
  }
  return { valid: true };
}

/**
 * Deterministically shuffles an array using Fisher-Yates with an optional seed/random fn.
 */
export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Shuffles the 4 options of a question while updating correctIndex accurately so even the
 * same question has randomized option ordering across sessions.
 */
export function randomizeQuestionOptions(
  q: QuestionItem,
  rng: () => number = Math.random
): QuestionItem {
  const indices = shuffleArray([0, 1, 2, 3], rng);
  const optionsEn: [string, string, string, string] = [
    q.optionsEn[indices[0]],
    q.optionsEn[indices[1]],
    q.optionsEn[indices[2]],
    q.optionsEn[indices[3]],
  ];
  const optionsHi: [string, string, string, string] = [
    q.optionsHi[indices[0]],
    q.optionsHi[indices[1]],
    q.optionsHi[indices[2]],
    q.optionsHi[indices[3]],
  ];
  const newCorrectIndex = indices.indexOf(q.correctIndex) as 0 | 1 | 2 | 3;
  return {
    ...q,
    optionsEn,
    optionsHi,
    correctIndex: newCorrectIndex,
  };
}

/**
 * Returns the exact count of validated available questions for a given course / module / chapter.
 */
export function getAvailableQuestionCount(
  course: CourseId,
  module?: string,
  chapter?: string
): number {
  const pool = buildExpandedQuestionPool(course, module, chapter);
  return pool.filter((q) => validateQuestion(q, course, module, chapter).valid).length;
}

/**
 * Generates a fresh, non-repeating, validated question set for the given Course -> Module -> Chapter.
 * Prioritizes questions not in `previouslySeenIds` so repeated practice sessions get fresh combinations.
 */
export function generatePracticeQuestionSet(params: {
  course: CourseId;
  module?: string;
  chapter?: string;
  count: number;
  previouslySeenIds?: string[];
  rng?: () => number;
}): QuestionItem[] {
  const { course, module, chapter, count, previouslySeenIds = [], rng = Math.random } = params;
  const courseInfo = getCourseById(course);
  if (!courseInfo) {
    throw new Error(`Invalid course: ${course}`);
  }

  const rawPool = buildExpandedQuestionPool(course, module, chapter);
  const validPool = rawPool.filter((q) => validateQuestion(q, course, module, chapter).valid);

  // Deduplicate by question ID and normalized English question text
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  const uniquePool: QuestionItem[] = [];

  for (const item of validPool) {
    const normText = item.questionEn.trim().toLowerCase();
    if (!seenIds.has(item.id) && !seenTexts.has(normText)) {
      seenIds.add(item.id);
      seenTexts.add(normText);
      uniquePool.push(item);
    }
  }

  const prevSet = new Set(previouslySeenIds);
  const unseen = uniquePool.filter((q) => !prevSet.has(q.id));
  const seen = uniquePool.filter((q) => prevSet.has(q.id));

  const shuffledUnseen = shuffleArray(unseen, rng);
  const shuffledSeen = shuffleArray(seen, rng);

  const combined = [...shuffledUnseen, ...shuffledSeen];
  const targetCount = Math.max(1, Math.min(count, combined.length));

  return combined.slice(0, targetCount).map((q) => randomizeQuestionOptions(q, rng));
}

/**
 * Strips correct answer and explanations before sending questions to a student in an active hosted test.
 */
export function sanitizeQuestionForStudent(q: QuestionItem): StudentQuestionItem {
  return {
    id: q.id,
    course: q.course,
    module: q.module,
    chapter: q.chapter,
    questionEn: q.questionEn,
    questionHi: q.questionHi,
    optionsEn: q.optionsEn,
    optionsHi: q.optionsHi,
    difficulty: q.difficulty,
    source: q.source,
  };
}

/**
 * Computes the NIELIT CBT Question Palette status for a single question.
 */
export function getPaletteStatus(state?: QuestionResponseState): PaletteStatus {
  if (!state || !state.visited) {
    return 'not_visited';
  }
  const hasAnswer = state.selectedOption !== null && state.selectedOption !== undefined;
  if (hasAnswer && state.markedForReview) {
    return 'answered_marked';
  }
  if (state.markedForReview) {
    return 'marked';
  }
  if (hasAnswer) {
    return 'answered';
  }
  return 'not_answered';
}

/**
 * Calculates authoritative exam results given the question set and candidate response map.
 */
export function calculateExamResult(
  questions: readonly QuestionItem[],
  responses: Record<string, QuestionResponseState>,
  timeTakenSeconds: number
): ExamResultSummary {
  const totalQuestions = questions.length;
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;
  let markedForReviewCount = 0;

  for (const q of questions) {
    const resp = responses[q.id];
    if (resp?.markedForReview) {
      markedForReviewCount++;
    }
    if (resp && resp.selectedOption !== null && resp.selectedOption !== undefined) {
      attempted++;
      if (resp.selectedOption === q.correctIndex) {
        correct++;
      } else {
        incorrect++;
      }
    }
  }

  const unanswered = Math.max(0, totalQuestions - attempted);
  const score = correct; // 1 mark per question, no negative marking as per NIELIT O'Level/CCC CBT pattern
  const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 1000) / 10 : 0;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;
  const passed = percentage >= 50;

  let grade = 'F';
  if (percentage >= 85) grade = 'S (Super)';
  else if (percentage >= 75) grade = 'A';
  else if (percentage >= 65) grade = 'B';
  else if (percentage >= 55) grade = 'C';
  else if (percentage >= 50) grade = 'D';

  return {
    totalQuestions,
    attempted,
    correct,
    incorrect,
    unanswered,
    markedForReviewCount,
    score,
    percentage,
    accuracy,
    passed,
    grade,
    timeTakenSeconds: Math.max(0, Math.round(timeTakenSeconds)),
  };
}

/**
 * Generates a unique, collision-resistant session ID formatted like ACCP-7X42K.
 */
export function generateSessionId(existingIds: Set<string> = new Set()): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 100; attempt++) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `ACCP-${suffix}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `ACCP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export interface CandidateResultRow {
  rollNumber: string;
  name: string;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  status: 'PASS' | 'FAIL';
  timeTakenSeconds: number;
  submittedAt: string;
  warningsCount: number;
  submissionStatus?: string;
}

export function formatDurationShort(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

/**
 * Generates an Excel-compatible CSV string for downloading all candidate results.
 */
export function generateResultsCsv(
  sessionInfo: {
    sessionId: string;
    title: string;
    hostName: string;
    course: string;
    module?: string;
    chapter?: string;
    examDate?: string;
  },
  rows: readonly CandidateResultRow[]
): string {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const examDateStr =
    sessionInfo.examDate ||
    new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const lines: string[] = [
    `# Access Computer Preparation - Official Examination Results`,
    `# Session ID,${escapeCsv(sessionInfo.sessionId)}`,
    `# Examination Title,${escapeCsv(sessionInfo.title)}`,
    `# Examiner,${escapeCsv(sessionInfo.hostName)}`,
    `# Course,${escapeCsv(sessionInfo.course)}`,
    ...(sessionInfo.module ? [`# Module,${escapeCsv(sessionInfo.module)}`] : []),
    ...(sessionInfo.chapter ? [`# Chapter,${escapeCsv(sessionInfo.chapter)}`] : []),
    `# Examination Date,${escapeCsv(examDateStr)}`,
    `# Total Candidates,${rows.length}`,
    '',
    [
      'Rank',
      'Roll Number',
      'Candidate Name',
      'Total Questions',
      'Attempted',
      'Correct',
      'Incorrect',
      'Unanswered',
      'Final Score',
      'Percentage (%)',
      'Result Status',
      'Time Taken',
      'Submission Status',
      'Anti-Cheat Warnings',
      'Submitted At',
    ].join(','),
  ];

  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.timeTakenSeconds - b.timeTakenSeconds
  );

  sorted.forEach((r, idx) => {
    lines.push(
      [
        idx + 1,
        escapeCsv(r.rollNumber),
        escapeCsv(r.name),
        r.totalQuestions,
        r.attempted,
        r.correct,
        r.incorrect,
        r.unanswered,
        `${r.score}/${r.totalQuestions}`,
        `${r.percentage}%`,
        r.status,
        escapeCsv(formatDurationShort(r.timeTakenSeconds)),
        escapeCsv(r.submissionStatus || 'Submitted'),
        r.warningsCount,
        escapeCsv(r.submittedAt),
      ].join(',')
    );
  });

  return lines.join('\n');
}

/**
 * Generates a valid, multi-page PDF-1.4 document (Uint8Array) for the Master Examination Report
 * with automatic page breaks, page numbers, and complete candidate results.
 */
export function generateMasterReportPdf(
  sessionInfo: {
    sessionId: string;
    title: string;
    hostName: string;
    course: string;
    module?: string;
    chapter?: string;
    examDate?: string;
  },
  rows: readonly CandidateResultRow[]
): Uint8Array {
  const sanitizePdfText = (input: string | number | undefined): string => {
    const raw = String(input ?? '')
      .replace(/—|–/g, '-')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return raw
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.timeTakenSeconds - b.timeTakenSeconds
  );

  const examDateStr =
    sessionInfo.examDate ||
    new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const passCount = sorted.filter((r) => r.status === 'PASS').length;
  const failCount = sorted.length - passCount;

  // Pagination: Page 1 has full metadata header (fits 22 rows); subsequent pages fit 28 rows
  const FIRST_PAGE_ROWS = 22;
  const NEXT_PAGE_ROWS = 28;

  const pageChunks: CandidateResultRow[][] = [];
  if (sorted.length === 0) {
    pageChunks.push([]);
  } else {
    pageChunks.push(sorted.slice(0, FIRST_PAGE_ROWS));
    let offset = FIRST_PAGE_ROWS;
    while (offset < sorted.length) {
      pageChunks.push(sorted.slice(offset, offset + NEXT_PAGE_ROWS));
      offset += NEXT_PAGE_ROWS;
    }
  }

  const totalPages = pageChunks.length;

  const drawTableHeader = (ops: string[], topY: number) => {
    ops.push('0.11 0.21 0.36 rg');
    ops.push(`28 ${topY - 6} 556 22 re f`);
    ops.push('1 1 1 rg');
    ops.push(`BT /F2 7.5 Tf 33 ${topY + 2} Td (#) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 50 ${topY + 2} Td (ROLL NO) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 105 ${topY + 2} Td (CANDIDATE NAME) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 218 ${topY + 2} Td (TOTAL) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 252 ${topY + 2} Td (COR) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 280 ${topY + 2} Td (INC) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 308 ${topY + 2} Td (UNA) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 338 ${topY + 2} Td (SCORE) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 380 ${topY + 2} Td (PCT) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 418 ${topY + 2} Td (TIME) Tj ET`);
    ops.push(`BT /F2 7.5 Tf 466 ${topY + 2} Td (SUBMISSION STATUS) Tj ET`);
  };

  const pageStreams: string[] = [];
  let globalRowIndex = 0;

  pageChunks.forEach((chunk, pageIndex) => {
    const ops: string[] = [];
    let currentY = 0;

    if (pageIndex === 0) {
      // Top Official Header Banner (#0B4F9E)
      ops.push('0.043 0.310 0.620 rg');
      ops.push('28 746 556 64 re f');

      ops.push('1 1 1 rg');
      ops.push('BT /F2 15 Tf 40 786 Td (Access Computer Preparation) Tj ET');
      ops.push(
        'BT /F1 9 Tf 40 770 Td (Official Computer Based Test \\(CBT\\) Examination Result Report) Tj ET'
      );
      ops.push(
        `BT /F2 10 Tf 425 786 Td (Session ID: ${sanitizePdfText(sessionInfo.sessionId)}) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf 425 770 Td (Date: ${sanitizePdfText(examDateStr)}) Tj ET`
      );

      // Detailed Session Metadata Box
      ops.push('0.96 0.97 0.99 rg');
      ops.push('28 652 556 84 re f');
      ops.push('0.80 0.84 0.90 RG 0.8 w');
      ops.push('28 652 556 84 re S');

      const titleSafe = sanitizePdfText(sessionInfo.title || 'Examination Report').slice(0, 68);
      const hostSafe = sanitizePdfText(sessionInfo.hostName || 'Examiner').slice(0, 38);
      const courseSafe = sanitizePdfText(sessionInfo.course || 'General').slice(0, 35);
      const moduleSafe = sanitizePdfText(sessionInfo.module || 'N/A').slice(0, 35);
      const chapterSafe = sanitizePdfText(sessionInfo.chapter || 'All Chapters').slice(0, 52);

      ops.push('0.08 0.12 0.18 rg');
      ops.push(`BT /F2 10 Tf 40 718 Td (Examination Title: ${titleSafe}) Tj ET`);
      ops.push(
        `BT /F1 8.5 Tf 40 701 Td (Teacher / Examiner: ${hostSafe}) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf 300 701 Td (Course: ${courseSafe}) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf 40 685 Td (Module: ${moduleSafe}) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf 300 685 Td (Chapter: ${chapterSafe}) Tj ET`
      );
      ops.push(
        `BT /F2 8.5 Tf 40 666 Td (Total Candidates: ${sorted.length}   |   Passed: ${passCount}   |   Failed: ${failCount}   |   Session ID: ${sanitizePdfText(sessionInfo.sessionId)}) Tj ET`
      );

      drawTableHeader(ops, 626);
      currentY = 602;
    } else {
      // Continuation Page Header
      ops.push('0.043 0.310 0.620 rg');
      ops.push('28 770 556 38 re f');
      ops.push('1 1 1 rg');
      ops.push(
        `BT /F2 11 Tf 40 785 Td (Access Computer Preparation - Session ${sanitizePdfText(sessionInfo.sessionId)} \\(Continued\\)) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf 420 785 Td (Date: ${sanitizePdfText(examDateStr)}) Tj ET`
      );

      drawTableHeader(ops, 742);
      currentY = 718;
    }

    if (chunk.length === 0) {
      ops.push('0.35 0.40 0.48 rg');
      ops.push(
        `BT /F1 9.5 Tf 40 ${currentY - 6} Td (No candidate records available for this examination session.) Tj ET`
      );
    } else {
      chunk.forEach((r, localIdx) => {
        globalRowIndex += 1;
        if (localIdx % 2 === 1) {
          ops.push('0.965 0.975 0.99 rg');
          ops.push(`28 ${currentY - 5} 556 19 re f`);
        }

        // Row bottom border line
        ops.push('0.88 0.91 0.95 RG 0.4 w');
        ops.push(`28 ${currentY - 5} m 584 ${currentY - 5} l S`);

        const rollSafe = sanitizePdfText(r.rollNumber || '-').slice(0, 10);
        const nameSafe = sanitizePdfText(r.name || 'Candidate').slice(0, 21);
        const timeSafe = sanitizePdfText(formatDurationShort(r.timeTakenSeconds));
        const subStatusRaw = r.submissionStatus || (r.submittedAt && r.submittedAt !== 'Pending' ? 'Submitted' : 'Pending');
        const subStatusSafe = sanitizePdfText(`${subStatusRaw} (${r.status})`).slice(0, 22);

        ops.push('0.10 0.14 0.20 rg');
        ops.push(`BT /F1 8 Tf 33 ${currentY} Td (${globalRowIndex}) Tj ET`);
        ops.push(`BT /F2 8 Tf 50 ${currentY} Td (${rollSafe}) Tj ET`);
        ops.push(`BT /F1 8 Tf 105 ${currentY} Td (${nameSafe}) Tj ET`);
        ops.push(`BT /F1 8 Tf 222 ${currentY} Td (${r.totalQuestions}) Tj ET`);

        // Correct (Green)
        ops.push('0.08 0.50 0.24 rg');
        ops.push(`BT /F2 8 Tf 254 ${currentY} Td (${r.correct}) Tj ET`);

        // Incorrect (Red)
        ops.push('0.75 0.14 0.14 rg');
        ops.push(`BT /F2 8 Tf 282 ${currentY} Td (${r.incorrect}) Tj ET`);

        // Unanswered
        ops.push('0.30 0.35 0.42 rg');
        ops.push(`BT /F1 8 Tf 310 ${currentY} Td (${r.unanswered}) Tj ET`);

        // Final Score & Percentage
        ops.push('0.08 0.12 0.18 rg');
        ops.push(`BT /F2 8 Tf 338 ${currentY} Td (${r.score}/${r.totalQuestions}) Tj ET`);
        ops.push(`BT /F2 8 Tf 380 ${currentY} Td (${r.percentage}%) Tj ET`);

        // Time Taken
        ops.push('0.25 0.30 0.38 rg');
        ops.push(`BT /F1 7.5 Tf 418 ${currentY} Td (${timeSafe}) Tj ET`);

        // Submission Status + PASS/FAIL
        if (r.status === 'PASS') {
          ops.push('0.08 0.50 0.24 rg');
        } else {
          ops.push('0.75 0.14 0.14 rg');
        }
        ops.push(`BT /F2 7.5 Tf 466 ${currentY} Td (${subStatusSafe}) Tj ET`);

        currentY -= 20;
      });
    }

    // Page Footer with Page Numbers
    ops.push('0.82 0.85 0.90 RG 0.6 w');
    ops.push('28 48 m 584 48 l S');
    ops.push('0.40 0.45 0.52 rg');
    ops.push(
      'BT /F1 8 Tf 28 34 Td (Access Computer Preparation - Official CBT Examination Result Report) Tj ET'
    );
    ops.push(
      `BT /F2 8 Tf 515 34 Td (Page ${pageIndex + 1} of ${totalPages}) Tj ET`
    );

    pageStreams.push(ops.join('\n'));
  });

  // Construct Multi-Page PDF Object Graph
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Helvetica Font
  // Object 4: Helvetica-Bold Font
  // For each page i (0..totalPages-1):
  //   Page Object = 5 + i * 2
  //   Content Stream Object = 6 + i * 2
  const pageObjIds = pageStreams.map((_, i) => 5 + i * 2);
  const kidsArray = pageObjIds.map((id) => `${id} 0 R`).join(' ');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${kidsArray}] /Count ${totalPages} >>\nendobj\n`,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  pageStreams.forEach((stream, i) => {
    const pageObjId = 5 + i * 2;
    const contentObjId = 6 + i * 2;
    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}


