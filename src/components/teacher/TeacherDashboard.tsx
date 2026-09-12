import React, { useState, useMemo } from 'react';
import {
  Users,
  GraduationCap,
  AlertTriangle,
  Calendar,
  Sparkles,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useAcademic } from '../../context/AcademicContext';
import { Student, Assignment, GradeCategory, AttendanceStatus } from '../../types';
import { AiTeacherModal } from './AiTeacherModal';

export const TeacherDashboard: React.FC<{ onOpenReport: (student: Student) => void }> = ({
  onOpenReport,
}) => {
  const {
    students,
    updateAssignmentScore,
    addAssignment,
    markAttendance,
    addTeacherNote,
    sendMessage,
    setSelectedStudentId,
    setRole,
  } = useAcademic();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFilter, setFilter] = useState<'all' | 'at-risk' | 'honor-roll' | 'grade-8' | 'grade-10'>('all');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>('student-1');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('sub-algebra');

  // Modals state
  const [aiModalStudent, setAiModalStudent] = useState<Student | null>(null);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [noteModalStudent, setNoteModalStudent] = useState<Student | null>(null);
  const [noteText, setNoteText] = useState('');

  // Inline assignment editing state
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState<number>(0);
  const [editFeedbackValue, setEditFeedbackValue] = useState<string>('');

  // Add assignment form state
  const [newAsgTitle, setNewAsgTitle] = useState('');
  const [newAsgCategory, setNewAsgCategory] = useState<GradeCategory>('Quiz');
  const [newAsgMaxScore, setNewAsgMaxScore] = useState(50);
  const [newAsgWeight, setNewAsgWeight] = useState(25);
  const [newAsgDueDate, setNewAsgDueDate] = useState('2026-09-25');
  const [newAsgTargetSubject, setNewAsgTargetSubject] = useState('Advanced Algebra');

  // Quick Attendance form state
  const [attDate, setAttDate] = useState('2026-09-12');
  const [attStatuses, setAttStatuses] = useState<Record<string, AttendanceStatus>>({});

  // Class analytics calculations
  const totalStudents = students.length;
  const classAvgGpa = (students.reduce((acc, s) => acc + s.overallGpa, 0) / totalStudents).toFixed(2);
  const classAvgAttendance = (students.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudents).toFixed(1);

  const atRiskStudents = students.filter(
    (s) => s.overallGpa < 3.0 || s.attendanceRate < 90 || s.subjects.some((sub) => sub.currentScore < 75)
  );

  const honorRollStudents = students.filter((s) => s.overallGpa >= 3.75);

  // Grade Distribution Histogram data
  const gradeDistributionData = useMemo(() => {
    let countA = 0;
    let countB = 0;
    let countC = 0;
    let countDF = 0;

    students.forEach((s) => {
      s.subjects.forEach((sub) => {
        if (sub.currentScore >= 90) countA++;
        else if (sub.currentScore >= 80) countB++;
        else if (sub.currentScore >= 70) countC++;
        else countDF++;
      });
    });

    return [
      { band: 'A (90-100%)', count: countA, color: '#10b981' },
      { band: 'B (80-89%)', count: countB, color: '#6366f1' },
      { band: 'C (70-79%)', count: countC, color: '#f59e0b' },
      { band: 'D/F (<70%)', count: countDF, color: '#ef4444' },
    ];
  }, [students]);

  // Subject Performance Average
  const subjectAverages = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    students.forEach((s) => {
      s.subjects.forEach((sub) => {
        if (!map[sub.name]) map[sub.name] = { total: 0, count: 0 };
        map[sub.name].total += sub.currentScore;
        map[sub.name].count += 1;
      });
    });

    return Object.entries(map).map(([name, data]) => ({
      subject: name.replace(' & Python', '').replace(' & Biology', ''),
      average: Math.round((data.total / data.count) * 10) / 10,
    }));
  }, [students]);

  // Filtered student roster
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterFilter === 'at-risk') {
        return (
          student.overallGpa < 3.0 ||
          student.attendanceRate < 90 ||
          student.subjects.some((sub) => sub.currentScore < 75)
        );
      }
      if (filterFilter === 'honor-roll') {
        return student.overallGpa >= 3.75;
      }
      if (filterFilter === 'grade-8') {
        return student.gradeLevel.includes('8');
      }
      if (filterFilter === 'grade-10') {
        return student.gradeLevel.includes('10');
      }
      return true;
    });
  }, [students, searchQuery, filterFilter]);

  const handleSaveGrade = (studentId: string, subjectId: string, assignmentId: string) => {
    updateAssignmentScore(studentId, subjectId, assignmentId, editScoreValue, editFeedbackValue);
    setEditingAssignmentId(null);
  };

  const handleStartEdit = (asg: Assignment) => {
    setEditingAssignmentId(asg.id);
    setEditScoreValue(asg.score);
    setEditFeedbackValue(asg.feedback || '');
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle.trim()) return;

    // Apply assignment across enrolled students in this subject
    students.forEach((student) => {
      const matchSubject = student.subjects.find((s) =>
        s.name.toLowerCase().includes(newAsgTargetSubject.toLowerCase())
      );
      if (matchSubject) {
        addAssignment(student.id, matchSubject.id, {
          title: newAsgTitle.trim(),
          category: newAsgCategory,
          score: 0,
          maxScore: Number(newAsgMaxScore),
          weight: Number(newAsgWeight),
          dueDate: newAsgDueDate,
          status: 'Pending',
        });
      }
    });

    setNewAsgTitle('');
    setShowAddAssignmentModal(false);
  };

  const handleSaveAttendance = () => {
    Object.entries(attStatuses).forEach(([studentId, status]) => {
      markAttendance(studentId, attDate, status);
    });
    setShowAttendanceModal(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Teacher Hub Hero Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
              Faculty Command Center
            </span>
            <span className="text-xs text-slate-400">• Fall Semester 2026</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Gradebook & Cohort Academic Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Real-time score recalculation, attendance metrics, early warning at-risk detection, and AI pedagogical diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Calendar className="w-4 h-4 text-slate-600" />
            <span>Mark Attendance</span>
          </button>
          <button
            onClick={() => setShowAddAssignmentModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Assignment</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Enrolled Students
            </span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalStudents}</span>
            <span className="text-xs text-emerald-600 font-semibold">Active Roster</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Grade 8 & Grade 10 Cohorts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Class Average GPA
            </span>
            <GraduationCap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-indigo-700">{classAvgGpa}</span>
            <span className="text-xs text-slate-400 font-medium">/ 4.00</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            +0.12 pts from last term
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Average Attendance
            </span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">{classAvgAttendance}%</span>
            <span className="text-xs text-emerald-600 font-semibold">Healthy</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across 180 logged sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              At-Risk / Watchlist
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-amber-600">
              {atRiskStudents.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Needs Attention</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">GPA &lt; 3.0 or Attendance &lt; 90%</p>
        </div>
      </div>

      {/* Real-time Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Cohort Grade Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Aggregated course grades across all student assignments
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="band"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {gradeDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Performance Average */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Average Score by Course Subject
              </h3>
              <p className="text-xs text-slate-500">
                Curriculum benchmark comparison across classes
              </p>
            </div>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={subjectAverages}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  domain={[60, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="subject"
                  type="category"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Subject Average']}
                />
                <Bar dataKey="average" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Roster & Interactive Gradebook */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or ID..."
                className="pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setFilter('at-risk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterFilter === 'at-risk'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              At Risk ({atRiskStudents.length})
            </button>
            <button
              onClick={() => setFilter('honor-roll')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterFilter === 'honor-roll'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              Honor Roll ({honorRollStudents.length})
            </button>
            <button
              onClick={() => setFilter('grade-8')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterFilter === 'grade-8'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Grade 8
            </button>
            <button
              onClick={() => setFilter('grade-10')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterFilter === 'grade-10'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Grade 10
            </button>
          </div>
        </div>

        {/* Student Rows */}
        <div className="divide-y divide-slate-200">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No students match the current filters.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isExpanded = expandedStudentId === student.id;
              const isAtRisk =
                student.overallGpa < 3.0 ||
                student.attendanceRate < 90 ||
                student.subjects.some((s) => s.currentScore < 75);

              const currentActiveSubject =
                student.subjects.find((s) => s.id === selectedSubjectId) ||
                student.subjects[0];

              return (
                <div key={student.id} className="transition-colors">
                  {/* Student Summary Row */}
                  <div
                    className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 cursor-pointer hover:bg-slate-50/80 ${
                      isExpanded ? 'bg-indigo-50/30' : ''
                    }`}
                    onClick={() =>
                      setExpandedStudentId(isExpanded ? null : student.id)
                    }
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center space-x-3.5">
                      <img
                        src={student.avatarUrl}
                        alt={student.name}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-900 text-sm">{student.name}</h4>
                          <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {student.studentIdNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {student.gradeLevel}
                          </span>
                          {isAtRisk && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              Watchlist
                            </span>
                          )}
                          {student.overallGpa >= 3.8 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Dean's List
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Parent: {student.parentName} • {student.parentEmail}
                        </p>
                      </div>
                    </div>

                    {/* Right: Metrics & Quick Action Buttons */}
                    <div
                      className="flex items-center justify-between md:justify-end space-x-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                          Overall GPA
                        </span>
                        <p className="font-extrabold text-slate-900 text-base">
                          {student.overallGpa.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                          Attendance
                        </span>
                        <p
                          className={`font-extrabold text-base ${
                            student.attendanceRate >= 95
                              ? 'text-emerald-600'
                              : student.attendanceRate >= 90
                              ? 'text-indigo-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {student.attendanceRate}%
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5 pl-2">
                        <button
                          onClick={() => setAiModalStudent(student)}
                          title="Generate AI Diagnostic & Intervention Strategies"
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">AI Diagnostic</span>
                        </button>

                        <button
                          onClick={() => {
                            setNoteModalStudent(student);
                            setNoteText('');
                          }}
                          title="Add Teacher Observation Note"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onOpenReport(student)}
                          title="View Official Academic Progress Report"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg"
                        >
                          <GraduationCap className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setRole('parent');
                          }}
                          title="Preview how parent sees this student"
                          className="text-[11px] text-slate-500 hover:text-indigo-600 underline font-medium px-1"
                        >
                          View as Parent
                        </button>

                        <button
                          onClick={() =>
                            setExpandedStudentId(isExpanded ? null : student.id)
                          }
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Gradebook Drawer */}
                  {isExpanded && (
                    <div className="p-5 bg-slate-50/70 border-t border-slate-200 space-y-4">
                      {/* Subject Tabs */}
                      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                          Subjects:
                        </span>
                        {student.subjects.map((sub) => {
                          const isSubSelected = currentActiveSubject?.id === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setSelectedSubjectId(sub.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center space-x-2 transition-all ${
                                isSubSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{sub.name}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                                  isSubSelected
                                    ? 'bg-indigo-700 text-white'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {sub.currentScore.toFixed(1)}% ({sub.letterGrade})
                              </span>
                              {sub.trend === 'up' && (
                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                              )}
                              {sub.trend === 'down' && (
                                <TrendingDown className="w-3 h-3 text-rose-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Subject Assignment Table */}
                      {currentActiveSubject && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                                {currentActiveSubject.name} — Assignment Gradebook
                              </span>
                              <span className="text-xs text-slate-500">
                                (Instructor: {currentActiveSubject.teacherName})
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-600">
                              Live Weight Calculation: {currentActiveSubject.currentScore.toFixed(1)}% ({currentActiveSubject.letterGrade})
                            </span>
                          </div>

                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                                <th className="py-2.5 px-4 font-semibold">Title</th>
                                <th className="py-2.5 px-3 font-semibold">Category</th>
                                <th className="py-2.5 px-3 font-semibold">Weight</th>
                                <th className="py-2.5 px-3 font-semibold text-center">Score</th>
                                <th className="py-2.5 px-3 font-semibold text-center">%</th>
                                <th className="py-2.5 px-3 font-semibold">Teacher Feedback</th>
                                <th className="py-2.5 px-4 font-semibold text-right">Quick Edit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {currentActiveSubject.assignments.map((asg) => {
                                const isEditing = editingAssignmentId === asg.id;
                                const pct =
                                  asg.maxScore > 0
                                    ? Math.round((asg.score / asg.maxScore) * 100)
                                    : 0;

                                return (
                                  <tr
                                    key={asg.id}
                                    className={`hover:bg-slate-50/70 ${
                                      isEditing ? 'bg-amber-50/50' : ''
                                    }`}
                                  >
                                    <td className="py-2.5 px-4 font-medium text-slate-900">
                                      {asg.title}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                        {asg.category}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500">
                                      {asg.weight}%
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {isEditing ? (
                                        <div className="flex items-center justify-center space-x-1">
                                          <input
                                            type="number"
                                            value={editScoreValue}
                                            onChange={(e) =>
                                              setEditScoreValue(Number(e.target.value))
                                            }
                                            max={asg.maxScore}
                                            min={0}
                                            className="w-16 px-1.5 py-1 text-center font-bold border border-indigo-400 rounded bg-white text-slate-900 text-xs"
                                          />
                                          <span className="text-slate-400 font-bold">
                                            /{asg.maxScore}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="font-bold text-slate-800">
                                          {asg.score}/{asg.maxScore}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span
                                        className={`font-semibold ${
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
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editFeedbackValue}
                                          onChange={(e) =>
                                            setEditFeedbackValue(e.target.value)
                                          }
                                          placeholder="Add constructive notes..."
                                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                                        />
                                      ) : (
                                        <span className="italic text-slate-500 line-clamp-1">
                                          {asg.feedback || 'No feedback logged'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      {isEditing ? (
                                        <div className="flex items-center justify-end space-x-1.5">
                                          <button
                                            onClick={() =>
                                              handleSaveGrade(
                                                student.id,
                                                currentActiveSubject.id,
                                                asg.id
                                              )
                                            }
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => setEditingAssignmentId(null)}
                                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleStartEdit(asg)}
                                          className="text-indigo-600 hover:text-indigo-900 font-semibold p-1 hover:bg-indigo-50 rounded"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Observations and notes */}
                      {student.teacherNotes.length > 0 && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block">
                            Recent Teacher Observations:
                          </span>
                          {student.teacherNotes.map((note, i) => (
                            <p key={i} className="italic text-slate-600">
                              • "{note}"
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Assignment Modal */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Publish New Assignment
              </h3>
              <button
                onClick={() => setShowAddAssignmentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Course / Subject:
                </label>
                <select
                  value={newAsgTargetSubject}
                  onChange={(e) => setNewAsgTargetSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Advanced Algebra">Advanced Algebra</option>
                  <option value="Life Science & Biology">Life Science & Biology</option>
                  <option value="World Civilizations">World Civilizations</option>
                  <option value="English & Literature">English & Literature</option>
                  <option value="Computer Science & Python">Computer Science & Python</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Title:
                </label>
                <input
                  type="text"
                  required
                  value={newAsgTitle}
                  onChange={(e) => setNewAsgTitle(e.target.value)}
                  placeholder="e.g. Quadratic Factoring Unit Test"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category:
                  </label>
                  <select
                    value={newAsgCategory}
                    onChange={(e) => setNewAsgCategory(e.target.value as GradeCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Quiz">Quiz</option>
                    <option value="Exam">Exam</option>
                    <option value="Homework">Homework</option>
                    <option value="Project">Project</option>
                    <option value="Lab">Lab</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Points:
                  </label>
                  <input
                    type="number"
                    value={newAsgMaxScore}
                    onChange={(e) => setNewAsgMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Grade Weight (%):
                  </label>
                  <input
                    type="number"
                    value={newAsgWeight}
                    onChange={(e) => setNewAsgWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Due Date:
                  </label>
                  <input
                    type="date"
                    value={newAsgDueDate}
                    onChange={(e) => setNewAsgDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssignmentModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Daily Attendance Tracker
                </h3>
                <p className="text-xs text-slate-500">Record cohort presence and punctuality</p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date:
                </label>
                <input
                  type="date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-2">
                {students.map((student) => {
                  const currentStatus = attStatuses[student.id] || 'Present';
                  return (
                    <div
                      key={student.id}
                      className="py-2 px-1 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{student.name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          ({student.gradeLevel})
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        {(['Present', 'Late', 'Absent', 'Excused'] as AttendanceStatus[]).map(
                          (status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                setAttStatuses((prev) => ({ ...prev, [student.id]: status }))
                              }
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                currentStatus === status
                                  ? status === 'Present'
                                    ? 'bg-emerald-600 text-white'
                                    : status === 'Late'
                                    ? 'bg-amber-500 text-white'
                                    : status === 'Absent'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {status}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAttendance}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Submit & Sync Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Teacher Note Modal */}
      {noteModalStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Record Observation Note for {noteModalStudent.name}
              </h3>
              <button
                onClick={() => setNoteModalStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <textarea
                rows={4}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log academic breakthrough, collaborative behavior, or area needing attention..."
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setNoteModalStudent(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    addTeacherNote(noteModalStudent.id, noteText);
                    setNoteModalStudent(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Save Observation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Teacher Diagnostic Modal */}
      {aiModalStudent && (
        <AiTeacherModal
          isOpen={Boolean(aiModalStudent)}
          onClose={() => setAiModalStudent(null)}
          student={aiModalStudent}
          onApplyComment={(comment) => {
            addTeacherNote(aiModalStudent.id, comment);
          }}
        />
      )}
    </div>
  );
};
