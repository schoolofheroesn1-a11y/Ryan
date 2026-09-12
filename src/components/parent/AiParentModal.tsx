import React, { useState } from 'react';
import { Sparkles, X, Loader2, MessageCircle, Heart, Home, AlertCircle } from 'lucide-react';
import { Student } from '../../types';

interface AiParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
}

interface ParentAiResponse {
  greeting: string;
  overview: string;
  highlights: string[];
  homeActionItems: string[];
  discussionStarters: string[];
}

export const AiParentModal: React.FC<AiParentModalProps> = ({ isOpen, onClose, student }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParentAiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/parent-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          parentName: student.parentName,
          attendanceRate: student.attendanceRate,
          subjects: student.subjects.map((s) => ({
            name: s.name,
            score: s.currentScore,
            letter: s.letterGrade,
            trend: s.trend,
            recentWork: s.assignments[0]?.title,
          })),
          recentAchievements: student.overallGpa >= 3.5 ? 'Honor Roll Standing' : 'Consistent effort',
          areasNeedingSupport: student.subjects.find((s) => s.currentScore < 80)?.name || 'Routine study habits',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Failed generating parent summary', err);
      setError(err.message || 'Unable to generate parent briefing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Parent Academic Companion
              </h3>
              <p className="text-xs text-slate-500">
                Personalized home learning briefing for {student.name}
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!result && !loading && (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Ready for your weekly parent briefing?
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Gemini translates gradebook records into encouraging, plain-language insights with actionable tips for home.
              </p>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Parent Briefing</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Analyzing recent grades, attendance, and coursework for {student.name}...
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Greeting & Overview */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                  {result.greeting}
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {result.overview}
                </p>
              </div>

              {/* Highlights */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center space-x-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Celebration Highlights</span>
                </div>
                <ul className="space-y-1.5 text-xs text-emerald-900">
                  {result.highlights.map((h, i) => (
                    <li key={i} className="flex items-start space-x-1.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Practical Home Action Items */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center space-x-1.5 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>Practical At-Home Support Tips</span>
                </div>
                <div className="space-y-2">
                  {result.homeActionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start space-x-2"
                    >
                      <span className="font-bold text-indigo-600 shrink-0">{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dinner Conversation Starters */}
              <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200">
                <div className="flex items-center space-x-1.5 text-sky-800 text-xs font-bold uppercase tracking-wider mb-2">
                  <MessageCircle className="w-4 h-4 text-sky-600" />
                  <span>Dinner Table Conversation Starters</span>
                </div>
                <div className="space-y-2">
                  {result.discussionStarters.map((starter, idx) => (
                    <p
                      key={idx}
                      className="text-xs text-sky-900 italic bg-white/80 p-2 rounded-lg border border-sky-100"
                    >
                      {starter}
                    </p>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={handleGenerate}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  Regenerate with latest updates
                </button>
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
