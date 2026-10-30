import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from './syllabus';
import { CORE_QUESTIONS } from './questionBank';
import {
  validateQuestion,
  generatePracticeQuestionSet,
  sanitizeQuestionForStudent,
  getPaletteStatus,
  calculateExamResult,
  generateSessionId,
  generateResultsCsv,
  generateMasterReportPdf,
  getAvailableQuestionCount,
} from './examEngine';

test('Every core question in CORE_QUESTIONS passes strict 10-point quality validation', () => {
  assert.ok(CORE_QUESTIONS.length >= 250, `Expected at least 250 core verified questions, got ${CORE_QUESTIONS.length}`);
  for (const q of CORE_QUESTIONS) {
    const res = validateQuestion(q, q.course, q.module, q.chapter);
    assert.equal(res.valid, true, `Question ${q.id} failed validation: ${res.reason}`);
  }
});

test('All 9 courses and all chapters have expanded, validated question pools', () => {
  for (const course of COURSES) {
    const count = getAvailableQuestionCount(course.id);
    if (course.id === 'olevel') {
      assert.ok(count >= 3500, `Expected O'Level to have >= 3500 questions, got ${count}`);
      for (const mod of course.modules || []) {
        const modCount = getAvailableQuestionCount(course.id, mod.id);
        assert.ok(modCount >= 650, `Expected module ${mod.id} to have >= 650 questions, got ${modCount}`);
        for (const ch of mod.chapters) {
          const chCount = getAvailableQuestionCount(course.id, mod.id, ch.id);
          assert.ok(chCount >= 135, `Expected chapter ${ch.id} to have >= 135 questions, got ${chCount}`);
        }
      }
    } else if (course.id === 'ccc') {
      assert.ok(count >= 1200, `Expected CCC to have >= 1200 questions, got ${count}`);
      for (const ch of course.chapters || []) {
        const chCount = getAvailableQuestionCount(course.id, undefined, ch.id);
        assert.ok(chCount >= 135, `Expected chapter ${ch.id} to have >= 135 questions, got ${chCount}`);
      }
    } else {
      assert.ok(count >= 180, `Expected ${course.id} to have >= 180 questions, got ${count}`);
    }
  }
});

test("O'Level contains all 4 official modules (M1, M2, M3, M4) with authentic chapters", () => {
  const olevel = COURSES.find((c) => c.id === 'olevel');
  assert.ok(olevel);
  assert.equal(olevel.modules?.length, 4);
  const codes = olevel.modules?.map((m) => m.id);
  assert.deepEqual(codes, ['M1', 'M2', 'M3', 'M4']);
  for (const mod of olevel.modules!) {
    assert.ok(mod.chapters.length >= 5, `Module ${mod.id} should have chapters`);
  }
});

test('generatePracticeQuestionSet strictly isolates Course -> Module -> Chapter without cross-leakage', () => {
  const set = generatePracticeQuestionSet({
    course: 'olevel',
    module: 'M3',
    chapter: 'm3-ch4',
    count: 25,
  });
  assert.equal(set.length, 25);
  const ids = new Set<string>();
  for (const q of set) {
    assert.equal(q.course, 'olevel');
    assert.equal(q.module, 'M3');
    assert.equal(q.chapter, 'm3-ch4');
    assert.equal(ids.has(q.id), false, `Duplicate question ID ${q.id} in single test`);
    ids.add(q.id);
  }
});

test('generatePracticeQuestionSet rotates questions when previouslySeenIds are provided', () => {
  const firstRun = generatePracticeQuestionSet({
    course: 'ccc',
    chapter: 'ccc-ch1',
    count: 10,
  });
  const firstIds = firstRun.map((q) => q.id);

  const secondRun = generatePracticeQuestionSet({
    course: 'ccc',
    chapter: 'ccc-ch1',
    count: 10,
    previouslySeenIds: firstIds,
  });
  const secondIds = new Set(secondRun.map((q) => q.id));
  const overlap = firstIds.filter((id) => secondIds.has(id));
  assert.equal(overlap.length, 0, 'Expected fresh unseen questions on subsequent run');
});

test('sanitizeQuestionForStudent removes correctIndex and explanations from active test payload', () => {
  const sample = CORE_QUESTIONS[0];
  const sanitized = sanitizeQuestionForStudent(sample) as Record<string, unknown>;
  assert.equal('correctIndex' in sanitized, false);
  assert.equal('explanationEn' in sanitized, false);
  assert.equal('explanationHi' in sanitized, false);
  assert.equal(sanitized.id, sample.id);
});

test('getPaletteStatus transitions accurately across CBT states', () => {
  assert.equal(getPaletteStatus(undefined), 'not_visited');
  assert.equal(
    getPaletteStatus({ visited: true, selectedOption: null, markedForReview: false }),
    'not_answered'
  );
  assert.equal(
    getPaletteStatus({ visited: true, selectedOption: 2, markedForReview: false }),
    'answered'
  );
  assert.equal(
    getPaletteStatus({ visited: true, selectedOption: null, markedForReview: true }),
    'marked'
  );
  assert.equal(
    getPaletteStatus({ visited: true, selectedOption: 1, markedForReview: true }),
    'answered_marked'
  );
});

test('calculateExamResult computes score, percentage, accuracy, and pass/fail accurately', () => {
  const qs = CORE_QUESTIONS.slice(0, 4);
  const responses = {
    [qs[0].id]: { visited: true, selectedOption: qs[0].correctIndex, markedForReview: false },
    [qs[1].id]: { visited: true, selectedOption: qs[1].correctIndex, markedForReview: true },
    [qs[2].id]: {
      visited: true,
      selectedOption: (qs[2].correctIndex + 1) % 4,
      markedForReview: false,
    },
    [qs[3].id]: { visited: true, selectedOption: null, markedForReview: false },
  };
  const summary = calculateExamResult(qs, responses, 145);
  assert.equal(summary.totalQuestions, 4);
  assert.equal(summary.attempted, 3);
  assert.equal(summary.correct, 2);
  assert.equal(summary.incorrect, 1);
  assert.equal(summary.unanswered, 1);
  assert.equal(summary.markedForReviewCount, 1);
  assert.equal(summary.score, 2);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.accuracy, 66.7);
  assert.equal(summary.passed, true);
});

test('generateSessionId creates unique ACCP-XXXXX IDs and generateResultsCsv formats rows', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const id = generateSessionId(seen);
    assert.match(id, /^ACCP-[A-Z0-9]{5}$/);
    assert.equal(seen.has(id), false);
    seen.add(id);
  }

  const csv = generateResultsCsv(
    { sessionId: 'ACCP-7X42K', title: 'Python Mid Term', hostName: 'Prof. Sharma', course: 'olevel', module: 'M3' },
    [
      {
        rollNumber: '101',
        name: 'Rahul Kumar',
        attempted: 24,
        correct: 20,
        incorrect: 4,
        unanswered: 1,
        score: 20,
        totalQuestions: 25,
        percentage: 80,
        status: 'PASS',
        timeTakenSeconds: 1200,
        submittedAt: '10:30:00 AM',
        warningsCount: 0,
      },
    ]
  );
  assert.ok(csv.includes('ACCP-7X42K'));
  assert.ok(csv.includes('Rahul Kumar'));
  assert.ok(csv.includes('80%'));

  const pdfBytes = generateMasterReportPdf(
    {
      sessionId: 'ACCP-7X42K',
      title: 'Python Mid Term',
      hostName: 'Prof. Sharma',
      course: 'olevel',
      module: 'M3',
      chapter: 'List, Tuple and Dictionary',
      examDate: '30 Oct 2026',
    },
    [
      {
        rollNumber: '101',
        name: 'Rahul Kumar',
        attempted: 24,
        correct: 20,
        incorrect: 4,
        unanswered: 1,
        score: 20,
        totalQuestions: 25,
        percentage: 80,
        status: 'PASS',
        submissionStatus: 'Submitted',
        timeTakenSeconds: 1200,
        submittedAt: '10:30:00 AM',
        warningsCount: 0,
      },
    ]
  );
  const pdfString = Buffer.from(pdfBytes).toString('latin1');
  assert.ok(pdfString.startsWith('%PDF-1.4'));
  assert.ok(pdfString.includes('ACCP-7X42K'));
  assert.ok(pdfString.includes('Rahul Kumar'));
  assert.ok(pdfString.includes('Page 1 of 1'));
  assert.ok(pdfString.trimEnd().endsWith('%%EOF'));

  // Test multi-page pagination with 60 candidates across 3 pages
  const manyRows = Array.from({ length: 60 }, (_, idx) => ({
    rollNumber: `OL-${100 + idx}`,
    name: `Candidate Number ${idx + 1}`,
    attempted: 20,
    correct: 15,
    incorrect: 5,
    unanswered: 5,
    score: 15,
    totalQuestions: 25,
    percentage: 60,
    status: 'PASS' as const,
    submissionStatus: idx % 3 === 0 ? 'Auto-Submitted' : 'Submitted',
    timeTakenSeconds: 945,
    submittedAt: '11:00:00 AM',
    warningsCount: 0,
  }));
  const multiPagePdf = generateMasterReportPdf(
    {
      sessionId: 'ACCP-MULTI',
      title: 'Large Batch Exam',
      hostName: 'Dr. Verma',
      course: "O'Level",
      module: 'M1',
      examDate: '30 Oct 2026',
    },
    manyRows
  );
  const multiStr = Buffer.from(multiPagePdf).toString('latin1');
  assert.ok(multiStr.startsWith('%PDF-1.4'));
  assert.ok(multiStr.includes('Page 1 of 3'));
  assert.ok(multiStr.includes('Page 2 of 3'));
  assert.ok(multiStr.includes('Page 3 of 3'));
  assert.ok(multiStr.includes('Candidate Number 60'));
  assert.ok(multiStr.trimEnd().endsWith('%%EOF'));
});

