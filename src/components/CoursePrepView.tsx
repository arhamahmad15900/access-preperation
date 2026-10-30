import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronRight,
  Play,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Globe,
  Hash,
  Clock,
} from 'lucide-react';
import {
  CourseInfo,
  ModuleInfo,
  ChapterInfo,
  ExamLanguage,
} from '../lib/syllabus';
import { getAvailableQuestionCount } from '../lib/examEngine';

export const PREDEFINED_QUESTION_COUNTS = [10, 25, 50, 100] as const;
export const PREDEFINED_TIME_DURATIONS = [10, 15, 20, 30, 45, 60, 90] as const;

interface CoursePrepViewProps {
  course: CourseInfo;
  onStartPractice: (config: {
    course: CourseInfo;
    module?: ModuleInfo;
    chapter?: ChapterInfo;
    questionCount: number;
    durationMinutes: number;
    language: ExamLanguage;
  }) => Promise<void>;
  onBackToHome: () => void;
}

export const CoursePrepView: React.FC<CoursePrepViewProps> = ({
  course,
  onStartPractice,
  onBackToHome,
}) => {
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | undefined>(undefined);
  const [selectedChapter, setSelectedChapter] = useState<ChapterInfo | undefined>(undefined);
  const [practiceEntireModule, setPracticeEntireModule] = useState(false);

  // Independent Practice Config State (Predefined Question Count + Predefined Time Duration)
  const [questionCount, setQuestionCount] = useState<number>(25);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [language, setLanguage] = useState<ExamLanguage>('bilingual');
  const [starting, setStarting] = useState(false);

  // Reset module/chapter when course changes
  useEffect(() => {
    setSelectedModule(undefined);
    setSelectedChapter(undefined);
    setPracticeEntireModule(false);
    setQuestionCount(25);
    setDurationMinutes(30);
  }, [course.id]);

  const handleLaunch = async () => {
    setStarting(true);
    try {
      await onStartPractice({
        course,
        module: selectedModule,
        chapter: selectedChapter,
        questionCount,
        durationMinutes,
        language,
      });
    } finally {
      setStarting(false);
    }
  };

  // Determine whether we are currently on the final Setup Screen (Number of Questions + Language + Start Practice)
  const isSetupReady =
    (!course.hasModules && !course.hasChapters) ||
    selectedChapter !== undefined ||
    practiceEntireModule;

  // =========================================================================
  // VIEW 1: O'LEVEL MODULE SELECTION SCREEN
  // =========================================================================
  if (course.hasModules && !selectedModule) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Breadcrumb & Header */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="text-xs font-bold text-[#0B4F9E] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Courses</span>
          </button>

          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#0B4F9E]">
                NIELIT Official R5.1 Syllabus Structure
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {course.name} Examination Preparation
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">{course.description}</p>
            </div>
          </div>
        </div>

        {/* 4 Official O'Level Modules Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            Step 1: Select an O&apos;Level Module (M1 to M4)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {course.modules?.map((mod) => {
              const totalModQuestions = getAvailableQuestionCount(course.id, mod.id);
              return (
                <div
                  key={mod.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col justify-between space-y-5 hover:border-blue-400 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span className="font-mono font-bold text-[#0B4F9E]">{mod.code}</span>
                      <span>
                        {mod.chapters.length} Chapters · {totalModQuestions}+ Verified Questions
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">{mod.title}</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{mod.titleHi}</p>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {mod.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <p className="text-xs font-bold text-slate-700">Key Syllabus Units:</p>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {mod.syllabusSummary.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[#0B4F9E] font-bold">·</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModule(mod);
                        setPracticeEntireModule(false);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Open Module &amp; Chapters</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MODULE / CHAPTER LIST SCREEN (For O'Level Module or CCC)
  // =========================================================================
  if (course.hasChapters && !isSetupReady) {
    const activeChapters = selectedModule ? selectedModule.chapters : course.chapters || [];
    const totalScopeQuestions = getAvailableQuestionCount(course.id, selectedModule?.id);

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Breadcrumb */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              if (selectedModule) {
                setSelectedModule(undefined);
              } else {
                onBackToHome();
              }
            }}
            className="text-xs font-bold text-[#0B4F9E] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {selectedModule ? "Back to O'Level Modules" : 'Back to All Courses'}
            </span>
          </button>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="text-xs text-slate-500 font-semibold">
                <span>{course.name}</span>
                {selectedModule && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono text-[#0B4F9E]">{selectedModule.code}</span>
                  </>
                )}
                <span className="mx-1.5">·</span>
                <span>{activeChapters.length} Official Chapters</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {selectedModule ? selectedModule.title : `${course.name} Complete Syllabus`}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {selectedModule ? selectedModule.description : course.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPracticeEntireModule(true)}
              className="px-4 py-2.5 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-4 h-4" />
              <span>
                Practice Entire {selectedModule ? selectedModule.id : course.name} (
                {totalScopeQuestions} Qs)
              </span>
            </button>
          </div>
        </div>

        {/* Syllabus Overview Strip */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Official Syllabus Coverage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
            {(selectedModule ? selectedModule.syllabusSummary : course.syllabusOverview).map(
              (line, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{line}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Chapter List */}
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            Select a Chapter to Start Practice
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {activeChapters.map((chap) => {
              const chapCount = getAvailableQuestionCount(
                course.id,
                selectedModule?.id,
                chap.id
              );
              return (
                <div
                  key={chap.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-400 transition-colors"
                >
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                      <span className="font-mono font-bold text-[#0B4F9E]">
                        Chapter {String(chap.number).padStart(2, '0')}
                      </span>
                      <span>·</span>
                      <span>{chapCount} Verified Questions Available</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {chap.title}{' '}
                      <span className="text-sm font-normal text-slate-500">({chap.titleHi})</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {chap.description}
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {chap.topics.map((t, i) => (
                        <span key={i}>
                          {i > 0 && '· '}
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedChapter(chap)}
                    className="px-5 py-2.5 rounded-lg bg-[#0B4F9E] hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Practice Chapter</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: PRACTICE CONFIGURATION SCREEN (Question Count + Language + Start)
  // =========================================================================
  const availableCount = getAvailableQuestionCount(
    course.id,
    selectedModule?.id,
    selectedChapter?.id
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => {
          if (selectedChapter || practiceEntireModule) {
            setSelectedChapter(undefined);
            setPracticeEntireModule(false);
          } else {
            onBackToHome();
          }
        }}
        className="text-xs font-bold text-[#0B4F9E] hover:underline flex items-center gap-1.5 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>
          {selectedChapter || practiceEntireModule
            ? `Back to ${selectedModule ? selectedModule.title : course.name} Chapters`
            : 'Back to All Courses'}
        </span>
      </button>

      {/* Main Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-[#0B4F9E] text-white px-6 py-5 space-y-1">
          <div className="text-xs text-blue-200 font-semibold flex flex-wrap items-center gap-1.5">
            <span>{course.name}</span>
            {selectedModule && (
              <>
                <span>→</span>
                <span>{selectedModule.id}</span>
              </>
            )}
            {selectedChapter && (
              <>
                <span>→</span>
                <span>Chapter {selectedChapter.number}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold">
            {selectedChapter
              ? `${selectedChapter.title} (${selectedChapter.titleHi})`
              : selectedModule
              ? `${selectedModule.title} — Full Module Practice`
              : `${course.name} (${course.shortName}) Practice`}
          </h1>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Description & Syllabus Summary */}
          <div className="space-y-3 border-b border-slate-200 pb-5">
            <p className="text-sm text-slate-700 leading-relaxed">
              {selectedChapter
                ? selectedChapter.description
                : selectedModule
                ? selectedModule.description
                : course.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-1">
              <span>
                Available Verified Questions:{' '}
                <strong className="font-mono text-slate-900">{availableCount} Questions</strong>
              </span>
              <span>·</span>
              <span>Mode: {course.practiceModeLabel}</span>
            </div>

            {!course.hasChapters && (
              <div className="pt-2 space-y-1.5">
                <p className="text-xs font-bold text-slate-700">Covered Examination Topics:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                  {course.syllabusOverview.map((topic, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#0B4F9E] shrink-0 mt-0.5" />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 1. Predefined Number of Questions Selector (No Custom Quantity) */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#0B4F9E]" />
              <span>Select Number of Questions</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PREDEFINED_QUESTION_COUNTS.map((countOpt) => (
                <button
                  key={countOpt}
                  type="button"
                  aria-pressed={questionCount === countOpt}
                  onClick={() => setQuestionCount(countOpt)}
                  className={`py-2.5 px-3 rounded-lg border text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap ${
                    questionCount === countOpt
                      ? 'bg-[#0B4F9E] text-white border-[#0B4F9E] ring-1 ring-[#4F9CF9]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {countOpt} Questions
                </button>
              ))}
            </div>
          </div>

          {/* 2. Independent Time Duration Selector */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0B4F9E]" />
              <span>Select Time Duration</span>
            </label>

            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {PREDEFINED_TIME_DURATIONS.map((minsOpt) => (
                <button
                  key={minsOpt}
                  type="button"
                  aria-pressed={durationMinutes === minsOpt}
                  onClick={() => setDurationMinutes(minsOpt)}
                  className={`py-2.5 px-2.5 rounded-lg border text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap ${
                    durationMinutes === minsOpt
                      ? 'bg-[#0B4F9E] text-white border-[#0B4F9E] ring-1 ring-[#4F9CF9]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {minsOpt} Mins
                </button>
              ))}
            </div>
          </div>

          {/* 3. Language Selector */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0B4F9E]" />
              <span>Select Question Language</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ['bilingual', 'Hindi + English', 'Both English & Hindi displayed together'],
                  ['en', 'English', 'Questions and options in English'],
                  ['hi', 'Hindi (हिन्दी)', 'प्रश्न और विकल्प हिंदी भाषा में'],
                ] as const
              ).map(([langCode, label, sub]) => (
                <button
                  key={langCode}
                  type="button"
                  onClick={() => setLanguage(langCode)}
                  className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                    language === langCode
                      ? 'border-[#0B4F9E] bg-blue-50/60 ring-1 ring-[#0B4F9E]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Start Practice CTA */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Questions: <strong className="font-mono text-slate-800">{questionCount} Qs</strong> ·
              Timer: <strong className="font-mono text-slate-800">{durationMinutes} Minutes</strong>{' '}
              · Fresh non-repeating question set
            </div>

            <button
              type="button"
              disabled={starting}
              onClick={handleLaunch}
              className="px-6 py-3 rounded-lg bg-[#15803D] hover:bg-green-800 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>
                {starting
                  ? 'Generating Fresh Set...'
                  : `Start Practice (${questionCount} Qs · ${durationMinutes} Mins)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
