import React, { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, RotateCcw, ArrowLeft, Award, Clock } from 'lucide-react';
import { ExamLanguage } from '../lib/syllabus';
import { QuestionItem } from '../lib/questionBank';
import { QuestionResponseState, ExamResultSummary } from '../lib/examEngine';

interface PracticeResultViewProps {
  title: string;
  subtitle?: string;
  candidateName: string;
  language: ExamLanguage;
  questions: QuestionItem[];
  responses: Record<string, QuestionResponseState>;
  summary: ExamResultSummary;
  onPracticeAgain: () => void;
  onBackToCourse: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export const PracticeResultView: React.FC<PracticeResultViewProps> = ({
  title,
  subtitle,
  candidateName,
  language: initialLang,
  questions,
  responses,
  summary,
  onPracticeAgain,
  onBackToCourse,
}) => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  const [language, setLanguage] = useState<ExamLanguage>(initialLang);

  const filteredQuestions = questions.filter((q) => {
    const r = responses[q.id];
    const hasAns = r && r.selectedOption !== null && r.selectedOption !== undefined;
    if (filter === 'correct') return hasAns && r.selectedOption === q.correctIndex;
    if (filter === 'incorrect') return hasAns && r.selectedOption !== q.correctIndex;
    if (filter === 'unanswered') return !hasAns;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Scorecard Banner */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="bg-[#0B4F9E] text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              Examination Scorecard &amp; Detailed Review
            </p>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{title}</h1>
            {subtitle && <p className="text-sm text-blue-100 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPracticeAgain}
              className="px-4 py-2 rounded bg-white text-[#0B4F9E] hover:bg-blue-50 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Practice Fresh Set</span>
            </button>
            <button
              type="button"
              onClick={onBackToCourse}
              className="px-4 py-2 rounded bg-blue-900 hover:bg-blue-950 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 border-b border-slate-200 bg-slate-50/50">
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">Final Score</p>
            <p className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums mt-1">
              {summary.score} / {summary.totalQuestions}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">Percentage</p>
            <p className="text-2xl font-extrabold font-mono text-blue-700 tabular-nums mt-1">
              {summary.percentage}%
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">Accuracy</p>
            <p className="text-2xl font-extrabold font-mono text-emerald-700 tabular-nums mt-1">
              {summary.accuracy}%
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">Correct / Wrong</p>
            <p className="text-xl font-bold font-mono tabular-nums mt-1">
              <span className="text-emerald-700">{summary.correct}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-red-600">{summary.incorrect}</span>
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">Time Taken</p>
            <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              {formatDuration(summary.timeTakenSeconds)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded p-3.5">
            <p className="text-xs text-slate-500 font-medium">NIELIT Grade</p>
            <p
              className={`text-xl font-extrabold font-mono mt-1 flex items-center gap-1.5 ${
                summary.passed ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              <Award className="w-4 h-4" />
              {summary.grade}
            </p>
          </div>
        </div>

        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Candidate: <strong className="text-slate-900">{candidateName}</strong> · Attempted:{' '}
            <strong className="font-mono text-slate-900">{summary.attempted}</strong> · Unanswered:{' '}
            <strong className="font-mono text-slate-900">{summary.unanswered}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span>Review Language:</span>
            <select
              aria-label="Review Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as ExamLanguage)}
              className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="bilingual">Hindi + English</option>
              <option value="en">English Only</option>
              <option value="hi">Hindi Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Bar for Answer Review */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">
          Question-by-Question Solution &amp; Explanations
        </h2>
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
          {(
            [
              ['all', `All (${questions.length})`],
              ['correct', `Correct (${summary.correct})`],
              ['incorrect', `Incorrect (${summary.incorrect})`],
              ['unanswered', `Unanswered (${summary.unanswered})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Question Review Cards */}
      <div className="space-y-4">
        {filteredQuestions.map((q) => {
          const originalIdx = questions.findIndex((item) => item.id === q.id);
          const resp = responses[q.id];
          const selected = resp?.selectedOption ?? null;
          const isCorrect = selected === q.correctIndex;
          const isUnanswered = selected === null || selected === undefined;

          return (
            <div
              key={q.id}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    Question {originalIdx + 1}
                  </span>
                  <span className="text-xs text-slate-500">· {q.difficulty}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {isUnanswered ? (
                    <span className="text-slate-600 flex items-center gap-1">
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      Not Answered (0 Marks)
                    </span>
                  ) : isCorrect ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Correct (+1 Mark)
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Incorrect (0 Marks)
                    </span>
                  )}
                </div>
              </div>

              {/* Question Prompt */}
              <div className="space-y-1.5">
                {(language === 'en' || language === 'bilingual') && (
                  <p className="font-semibold text-slate-900 text-base whitespace-pre-line">
                    {q.questionEn}
                  </p>
                )}
                {(language === 'hi' || language === 'bilingual') && (
                  <p className="text-slate-700 text-sm sm:text-base font-medium whitespace-pre-line">
                    {q.questionHi}
                  </p>
                )}
              </div>

              {/* Options List with Correct/Selected Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((optIdx) => {
                  const letter = ['A', 'B', 'C', 'D'][optIdx];
                  const isRightOpt = optIdx === q.correctIndex;
                  const isUserChoice = selected === optIdx;

                  let boxStyle = 'border-slate-200 bg-slate-50/60 text-slate-700';
                  let statusTag = '';
                  if (isRightOpt) {
                    boxStyle = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold';
                    statusTag = isUserChoice ? '✓ Your Answer (Correct)' : '✓ Correct Answer';
                  } else if (isUserChoice) {
                    boxStyle = 'border-red-400 bg-red-50/70 text-red-950 font-semibold';
                    statusTag = '✗ Your Answer';
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded border text-sm flex items-start justify-between gap-2 ${boxStyle}`}
                    >
                      <div>
                        <span>
                          {letter}. {language === 'hi' ? q.optionsHi[optIdx] : q.optionsEn[optIdx]}
                        </span>
                        {language === 'bilingual' &&
                          q.optionsHi[optIdx] !== q.optionsEn[optIdx] && (
                            <span className="block text-xs opacity-80 mt-0.5">
                              {q.optionsHi[optIdx]}
                            </span>
                          )}
                      </div>
                      {statusTag && (
                        <span className="text-xs font-bold shrink-0">{statusTag}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Verified Explanation */}
              <div className="bg-blue-50/60 border border-blue-200 rounded p-3.5 text-xs sm:text-sm space-y-1">
                <p className="font-bold text-blue-950">Explanation / व्याख्या:</p>
                {(language === 'en' || language === 'bilingual') && (
                  <p className="text-slate-800">{q.explanationEn}</p>
                )}
                {(language === 'hi' || language === 'bilingual') && (
                  <p className="text-slate-700">{q.explanationHi}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
