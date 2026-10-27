import React from 'react';
import { CalendarClock, Award, Target, MessageSquareQuote, CheckCircle2, Circle, AlertCircle, BookOpen } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { PortfolioSection } from '../common/PortfolioSection';
import { UploadTab } from '../common/UploadCenter';

export const StudentDashboard: React.FC<{ onUpload: (tab: UploadTab) => void }> = ({ onUpload }) => {
  const { selectedStudent: student, toggleGoal } = useAcademic();
  const today = new Date().toISOString().split('T')[0];

  const all = student.subjects.flatMap((sub) => sub.assignments.map((a) => ({ ...a, subjectName: sub.name })));
  const upcoming = all
    .filter((a) => a.status === 'Pending' || a.status === 'Missing')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const overdueCount = all.filter((a) => a.status === 'Missing' || (a.status === 'Pending' && a.dueDate < today)).length;
  const feedback = all
    .filter((a) => a.status === 'Graded' && a.feedback)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 4);
  const firstName = student.name.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <img src={student.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/60" />
            <div>
              <p className="text-indigo-100 text-xs font-semibold uppercase tracking-wider">My Portfolio</p>
              <h1 className="text-2xl font-bold">Hi, {firstName}!</h1>
              <p className="text-indigo-100 text-sm">
                {student.gradeLevel} • {student.studentIdNumber}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{student.overallGpa.toFixed(2)}</p>
              <p className="text-[11px] text-indigo-100">GPA (target {student.targetGpa})</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{student.attendanceRate}%</p>
              <p className="text-[11px] text-indigo-100">Attendance</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{upcoming.length}</p>
              <p className="text-[11px] text-indigo-100">{overdueCount ? `${overdueCount} overdue` : 'To do'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coming up */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <CalendarClock className="w-4 h-4 text-indigo-600" /> Coming up
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">You're all caught up. Nice work!</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => {
                const overdue = a.status === 'Missing' || a.dueDate < today;
                return (
                  <li key={a.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {a.subjectName} • {a.category}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                        overdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {overdue && <AlertCircle className="w-3 h-3" />}
                      {a.status === 'Missing' ? 'Missing' : overdue ? `Overdue (${a.dueDate})` : `Due ${a.dueDate}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Subjects */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <BookOpen className="w-4 h-4 text-indigo-600" /> My subjects
          </h2>
          {student.subjects.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No subjects yet.</p>
          ) : (
            <ul className="space-y-3">
              {student.subjects.map((s) => (
                <li key={s.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700 truncate">{s.name}</span>
                    <span className="font-bold text-slate-900">
                      {s.letterGrade} • {s.currentScore}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, s.currentScore)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Feedback */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <MessageSquareQuote className="w-4 h-4 text-indigo-600" /> Latest teacher feedback
          </h2>
          {feedback.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No feedback yet.</p>
          ) : (
            <ul className="space-y-3">
              {feedback.map((a) => (
                <li key={a.id} className="border-l-2 border-indigo-200 pl-3">
                  <p className="text-xs font-semibold text-slate-800">
                    {a.title} <span className="text-slate-400 font-normal">• {a.subjectName}</span>
                  </p>
                  <p className="text-xs text-slate-600 italic">"{a.feedback}"</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Goals */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <Target className="w-4 h-4 text-indigo-600" /> My goals
          </h2>
          {student.goals.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No goals set yet.</p>
          ) : (
            <ul className="space-y-2">
              {student.goals.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => toggleGoal(student.id, g.id)}
                    className="w-full flex items-start gap-2 text-left p-2 rounded-lg hover:bg-slate-50"
                  >
                    {g.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <span>
                      <span className={`block text-xs font-semibold ${g.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {g.title}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {g.targetMetric} • now: {g.currentValue}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {student.goals.some((g) => g.completed) && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <Award className="w-3.5 h-3.5" /> {student.goals.filter((g) => g.completed).length} of {student.goals.length}{' '}
              goals reached
            </p>
          )}
        </section>
      </div>

      <PortfolioSection student={student} onUpload={onUpload} />
    </div>
  );
};
