import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  MessageCircle,
  FileCheck,
  AlertCircle,
  Award,
  ChevronRight,
  Plus,
  Heart,
  BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAcademic } from '../../context/AcademicContext';
import { Student, Subject, AcademicGoal } from '../../types';
import { AiParentModal } from './AiParentModal';

export const ParentDashboard: React.FC<{ onOpenReport: (student: Student) => void }> = ({
  onOpenReport,
}) => {
  const {
    students,
    selectedStudentId,
    setSelectedStudentId,
    selectedStudent,
    toggleGoal,
    addGoal,
    markAttendance,
    sendMessage,
  } = useAcademic();

  // Modals state
  const [showAiModal, setShowAiModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Excuse slip state
  const [excuseDate, setExcuseDate] = useState('2026-09-14');
  const [excuseReason, setExcuseReason] = useState('Family medical appointment');

  // New goal state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalMetric, setGoalMetric] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('2026-10-01');

  // Teacher message state
  const [messageTeacherEmail, setMessageTeacherEmail] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');

  // Selected subject for deep-dive card
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<Subject>(
    selectedStudent.subjects[0] || {}
  );

  // Available children in Eleanor Vance's family
  const familyStudents = students.filter(
    (s) => s.parentName === 'Eleanor Vance' || s.id === 'student-1' || s.id === 'student-2'
  );

  // Real-time chart data constructed from student subjects
  const timelineData = selectedStudent.subjects.map((sub) => ({
    name: sub.name.split(' ')[0],
    Score: sub.currentScore,
    Previous: sub.previousScore,
  }));

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    addGoal(selectedStudent.id, {
      title: goalTitle.trim(),
      targetMetric: goalMetric.trim() || 'Achieve targeted mastery',
      currentValue: 'In Progress',
      dueDate: goalTargetDate,
    });

    setGoalTitle('');
    setGoalMetric('');
    setShowGoalModal(false);
  };

  const handleSendExcuseSlip = (e: React.FormEvent) => {
    e.preventDefault();
    markAttendance(selectedStudent.id, excuseDate, 'Excused', excuseReason);
    setShowExcuseModal(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;

    sendMessage(selectedStudent.id, {
      fromRole: 'parent',
      senderName: selectedStudent.parentName,
      subject: messageSubject.trim() || 'Parent Inquiry',
      content: messageBody.trim(),
    });

    setMessageSubject('');
    setMessageBody('');
    setShowMessageModal(false);
  };

  const completedGoalsCount = selectedStudent.goals.filter((g) => g.completed).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Multi-Child Selector Bar */}
      <div className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Viewing Family Student:
          </span>
          <div className="flex space-x-2">
            {familyStudents.map((child) => {
              const isChildActive = child.id === selectedStudentId;
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    setSelectedStudentId(child.id);
                    setSelectedSubjectDetail(child.subjects[0]);
                  }}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isChildActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <img
                    src={child.avatarUrl}
                    alt={child.name}
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span>{child.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      isChildActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {child.gradeLevel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>AI Progress Companion</span>
          </button>
        </div>
      </div>

      {/* Student Academic Hero Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <img
              src={selectedStudent.avatarUrl}
              alt={selectedStudent.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-100 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {selectedStudent.name}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedStudent.gradeLevel}
                </span>
                {selectedStudent.overallGpa >= 3.8 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>Honor Roll Standing</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Student ID: <span className="font-mono font-bold text-slate-700">{selectedStudent.studentIdNumber}</span> • Crestview Preparatory Academy
              </p>
            </div>
          </div>

          {/* Quick Metrics Header */}
          <div className="grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Current GPA
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl font-extrabold text-indigo-600">
                  {selectedStudent.overallGpa.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 4.00</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Target: {selectedStudent.targetGpa.toFixed(2)}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Attendance Rate
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl font-extrabold text-emerald-600">
                  {selectedStudent.attendanceRate}%
                </span>
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold">Excellent</p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Goals
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl font-extrabold text-slate-900">
                  {completedGoalsCount}/{selectedStudent.goals.length}
                </span>
              </div>
              <p className="text-[10px] text-indigo-600 font-semibold">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Analytics & Milestone celebration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Progress Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Real-Time Course Performance Trajectory
              </h3>
              <p className="text-xs text-slate-500">
                Live comparison of current vs previous evaluation checkpoints
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Upward Momentum
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[60, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Current Score']}
                />
                <Area
                  type="monotone"
                  dataKey="Score"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreColor)"
                />
                <Area
                  type="monotone"
                  dataKey="Previous"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Milestone & At-a-Glance Actions Card */}
        <div className="bg-linear-to-br from-indigo-50/70 to-slate-50 p-6 rounded-2xl border border-indigo-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700 mb-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Academic Standing
              </span>
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              {selectedStudent.overallGpa >= 3.8
                ? 'Outstanding Achievement'
                : 'Steady Academic Progress'}
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {selectedStudent.name} is excelling in core coursework. Review individual teacher comments below or generate a custom AI briefing for at-home discussion topics.
            </p>

            <div className="mt-4 p-3 bg-white rounded-xl border border-indigo-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Enrolled Courses:</span>
                <span className="font-bold text-slate-900">{selectedStudent.subjects.length} classes</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Pending Assignments:</span>
                <span className="font-bold text-amber-600">
                  {selectedStudent.subjects.reduce(
                    (sum, s) => sum + s.assignments.filter((a) => a.status === 'Pending').length,
                    0
                  )} due this month
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <button
              onClick={() => onOpenReport(selectedStudent)}
              className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>Download / Print Official Report</span>
            </button>
            <button
              onClick={() => setShowMessageModal(true)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Teacher / Counselor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course Subjects Bento Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Subject Gradebook & Course Drilldown
            </h2>
            <p className="text-xs text-slate-500">
              Select any course to view full assignment scores and teacher feedback
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedStudent.subjects.map((sub) => {
            const isSelected = selectedSubjectDetail?.id === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => setSelectedSubjectDetail(sub)}
                className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {sub.code}
                  </span>
                  <div className="flex items-center space-x-1">
                    {sub.trend === 'up' && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                        <TrendingUp className="w-3 h-3 mr-0.5" /> +
                        {(sub.currentScore - sub.previousScore).toFixed(1)}%
                      </span>
                    )}
                    {sub.trend === 'down' && (
                      <span className="text-[10px] text-rose-600 font-bold flex items-center">
                        <TrendingDown className="w-3 h-3 mr-0.5" /> -
                        {(sub.previousScore - sub.currentScore).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{sub.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Instructor: {sub.teacherName}</p>

                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      {sub.currentScore.toFixed(1)}%
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
                    Grade: {sub.letterGrade}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      sub.currentScore >= 90
                        ? 'bg-emerald-500'
                        : sub.currentScore >= 80
                        ? 'bg-indigo-500'
                        : sub.currentScore >= 70
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, sub.currentScore)}%` }}
                  ></div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{sub.assignments.length} assignments</span>
                  <span className="text-indigo-600 font-semibold flex items-center">
                    View Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Course Deep Dive Table */}
        {selectedSubjectDetail && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-4">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Course Assignment Ledger
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedSubjectDetail.name} ({selectedSubjectDetail.code})
                </h3>
              </div>
              <div className="text-xs text-slate-500">
                Teacher contact:{' '}
                <span className="font-mono text-indigo-600">{selectedSubjectDetail.teacherEmail}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50 text-slate-500 font-semibold">
                    <th className="py-2.5 px-4">Assignment Title</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Percentage</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4">Instructor Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSubjectDetail.assignments?.map((asg) => {
                    const pct =
                      asg.maxScore > 0 ? Math.round((asg.score / asg.maxScore) * 100) : 0;
                    return (
                      <tr key={asg.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-semibold text-slate-900">{asg.title}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {asg.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {asg.status === 'Graded' ? `${asg.score}/${asg.maxScore}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {asg.status === 'Graded' ? (
                            <span
                              className={`font-extrabold ${
                                pct >= 90
                                  ? 'text-emerald-700'
                                  : pct >= 80
                                  ? 'text-indigo-700'
                                  : pct >= 70
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {pct}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              asg.status === 'Graded'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {asg.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm">
                          {asg.feedback ? (
                            <span className="italic text-slate-600">"{asg.feedback}"</span>
                          ) : (
                            <span className="text-slate-400 italic">No notes</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Attendance & Academic Goals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Tracker */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Attendance & Punctuality
              </h3>
              <p className="text-xs text-slate-500">
                Cumulative session presence: {selectedStudent.attendanceRate}%
              </p>
            </div>
            <button
              onClick={() => setShowExcuseModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>Submit Excuse Slip</span>
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100">
            {selectedStudent.attendanceHistory.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-900">{item.date}</span>
                  {item.notes && (
                    <span className="text-slate-400 text-[11px] italic">({item.notes})</span>
                  )}
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    item.status === 'Present'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : item.status === 'Late'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : item.status === 'Excused'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Home Goals & Study Habits */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Academic Targets & Goals
              </h3>
              <p className="text-xs text-slate-500">
                Check off milestones to track mastery
              </p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Goal</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {selectedStudent.goals.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No goals set yet.</p>
            ) : (
              selectedStudent.goals.map((g) => (
                <div
                  key={g.id}
                  onClick={() => toggleGoal(selectedStudent.id, g.id)}
                  className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                    g.completed
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={g.completed}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-bold ${
                        g.completed ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {g.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{g.targetMetric}</p>
                    <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Target Date: {g.dueDate}</span>
                    </div>
                  </div>
                  {g.completed && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Achieved!
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Messages & Communications log */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              School & Teacher Communication Channel
            </h3>
            <p className="text-xs text-slate-500">
              Direct messages with {selectedStudent.name}’s instructors
            </p>
          </div>
          <button
            onClick={() => setShowMessageModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Message</span>
          </button>
        </div>

        <div className="space-y-3">
          {selectedStudent.messages.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No messages logged yet. Use the button above to write to an instructor.
            </p>
          ) : (
            selectedStudent.messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {msg.senderName} ({msg.fromRole === 'teacher' ? 'Instructor' : 'Parent'})
                  </span>
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                </div>
                <h5 className="text-xs font-semibold text-indigo-700">{msg.subject}</h5>
                <p className="text-xs text-slate-600 leading-relaxed">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Submit Excuse Slip Modal */}
      {showExcuseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Submit Absence / Excuse Slip
              </h3>
              <button
                onClick={() => setShowExcuseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendExcuseSlip} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Absence Date:
                </label>
                <input
                  type="date"
                  value={excuseDate}
                  onChange={(e) => setExcuseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Absence:
                </label>
                <input
                  type="text"
                  required
                  value={excuseReason}
                  onChange={(e) => setExcuseReason(e.target.value)}
                  placeholder="e.g. Doctor appointment, illness, or family emergency"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowExcuseModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Submit Excuse Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Create Student Academic Goal
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Goal Title:
                </label>
                <input
                  type="text"
                  required
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g. Score 90% or higher on upcoming Biology Exam"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Metric:
                </label>
                <input
                  type="text"
                  value={goalMetric}
                  onChange={(e) => setGoalMetric(e.target.value)}
                  placeholder="e.g. Complete 3 practice problem sets before Friday"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Deadline:
                </label>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Save Academic Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Message to Teacher Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Message Instructor / Counselor
              </h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Recipient:
                </label>
                <select
                  value={messageTeacherEmail}
                  onChange={(e) => setMessageTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {selectedStudent.subjects.map((sub) => (
                    <option key={sub.id} value={sub.teacherEmail}>
                      {sub.teacherName} — {sub.name}
                    </option>
                  ))}
                  <option value="counselor@crestview.edu">Mrs. Adams — Academic Counselor</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject:
                </label>
                <input
                  type="text"
                  required
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="e.g. Question regarding upcoming project rubric"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Message:
                </label>
                <textarea
                  rows={4}
                  required
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your question or request for a check-in..."
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Send Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Parent Modal */}
      {showAiModal && (
        <AiParentModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          student={selectedStudent}
        />
      )}
    </div>
  );
};
