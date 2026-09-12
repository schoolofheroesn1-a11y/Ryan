import React, { useState } from 'react';
import { Sparkles, X, Loader2, Check, BookOpen, AlertCircle, Copy } from 'lucide-react';
import { Student } from '../../types';

interface AiTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  onApplyComment?: (comment: string) => void;
}

interface TeacherAiResponse {
  summary: string;
  strengths: string[];
  growthAreas: string[];
  recommendedInterventions: string[];
  draftReportComment: string;
}

export const AiTeacherModal: React.FC<AiTeacherModalProps> = ({
  isOpen,
  onClose,
  student,
  onApplyComment,
}) => {
  const [focusArea, setFocusArea] = useState<string>('Exam preparation & homework consistency');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<TeacherAiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/teacher-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          gradeLevel: student.gradeLevel,
          gpa: student.overallGpa,
          attendanceRate: student.attendanceRate,
          subjects: student.subjects.map((s) => ({
            name: s.name,
            score: s.currentScore,
            letter: s.letterGrade,
            trend: s.trend,
          })),
          recentNotes: student.teacherNotes.join('; '),
          focusArea,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Failed generating teacher insights', err);
      setError(err.message || 'Unable to generate analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.draftReportComment) {
      navigator.clipboard.writeText(result.draftReportComment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Diagnostic & Differentiated Interventions
              </h3>
              <p className="text-xs text-slate-500">
                Targeted recommendations for {student.name} ({student.gradeLevel})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-center">
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                Current GPA
              </span>
              <p className="text-lg font-extrabold text-slate-900">{student.overallGpa.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                Attendance
              </span>
              <p className="text-lg font-extrabold text-slate-900">{student.attendanceRate}%</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                Enrolled Subjects
              </span>
              <p className="text-lg font-extrabold text-slate-900">{student.subjects.length}</p>
            </div>
          </div>

          {/* Inquiry / Prompt focus input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Teacher Focus Area / Pedagogical Inquiry:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g. Scaffolding quadratic equations or missing homework follow-up"
                className="flex-1 text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Insights</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Output Content */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Summary */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Diagnostic Overview
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {result.summary}
                </p>
              </div>

              {/* Strengths & Growth Areas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1.5">
                    Demonstrated Strengths
                  </span>
                  <ul className="space-y-1.5 text-xs text-emerald-900">
                    {result.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1.5">
                    Target Growth Opportunities
                  </span>
                  <ul className="space-y-1.5 text-xs text-amber-900">
                    {result.growthAreas.map((area, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Differentiated Interventions */}
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-xs">
                <div className="flex items-center space-x-1.5 text-indigo-700 mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Recommended Differentiated Classroom Strategies
                  </span>
                </div>
                <div className="space-y-2">
                  {result.recommendedInterventions.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-700 flex items-start space-x-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100"
                    >
                      <span className="font-bold text-indigo-600 shrink-0">{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Draft Report Card Comment */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Draft Report Card Narrative
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopy}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Comment</span>
                        </>
                      )}
                    </button>
                    {onApplyComment && (
                      <button
                        onClick={() => {
                          onApplyComment(result.draftReportComment);
                          onClose();
                        }}
                        className="text-xs font-semibold px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        Save to Student Notes
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                  "{result.draftReportComment}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Powered by Google Gemini 3.8 Flash
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
