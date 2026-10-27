import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  Student,
  Role,
  RealtimeAlert,
  Assignment,
  AttendanceStatus,
  AcademicGoal,
  MessageLog,
  PortfolioFile,
  ProgressTable,
  Subject,
} from '../types';
import { GradebookRow } from '../lib/tableImport';
import { INITIAL_STUDENTS, INITIAL_ALERTS } from '../data/mockData';
import {
  calculateSubjectScore,
  calculateStudentOverallGpa,
  calculateAttendanceRate,
  getTrendDirection,
} from '../lib/calculations';

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'offline';

export interface GradebookImportSummary {
  added: number;
  updated: number;
  newSubjects: string[];
  newStudents: string[];
}

const SUBJECT_COLORS = ['indigo', 'emerald', 'amber', 'sky', 'teal', 'rose', 'violet', 'orange'];

// Self-contained initials avatar so student names are never sent to an external avatar service
function initialsAvatar(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
    .replace(/[^A-Z0-9]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#4f46e5"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="38" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface AcademicContextType {
  role: Role;
  setRole: (role: Role) => void;
  students: Student[];
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  selectedStudent: Student;
  // Students the current portal may see: teacher = everyone, parent = the selected child's family, student = themself
  visibleStudents: Student[];
  alerts: RealtimeAlert[];
  unreadAlertCount: number;
  liveToast: { title: string; message: string; type: 'grade' | 'attendance' | 'milestone' | 'info' } | null;
  dismissToast: () => void;
  updateAssignmentScore: (
    studentId: string,
    subjectId: string,
    assignmentId: string,
    newScore: number,
    feedback?: string
  ) => void;
  addAssignment: (
    studentId: string,
    subjectId: string,
    assignment: Omit<Assignment, 'id'>
  ) => void;
  markAttendance: (
    studentId: string,
    date: string,
    status: AttendanceStatus,
    notes?: string
  ) => void;
  addGoal: (studentId: string, goal: Omit<AcademicGoal, 'id' | 'completed'>) => void;
  toggleGoal: (studentId: string, goalId: string) => void;
  addTeacherNote: (studentId: string, note: string) => void;
  sendMessage: (
    studentId: string,
    message: { fromRole: Role; senderName: string; subject: string; content: string }
  ) => void;
  markAlertRead: (alertId: string) => void;
  clearAllAlerts: () => void;
  simulateLiveUpdate: () => void;
  resetToDefaults: () => void;
  syncStatus: SyncStatus;
  addStudent: (data: {
    name: string;
    gradeLevel: string;
    studentIdNumber?: string;
    parentName?: string;
    parentEmail?: string;
  }) => string;
  importGradebook: (rows: GradebookRow[], fallbackStudentId: string) => GradebookImportSummary;
  addProgressTable: (studentId: string, table: Omit<ProgressTable, 'id' | 'uploadedAt'>) => void;
  removeProgressTable: (studentId: string, tableId: string) => void;
  addPortfolioFile: (studentId: string, file: Omit<PortfolioFile, 'id' | 'uploadedAt'>) => void;
  removePortfolioFile: (studentId: string, fileId: string) => void;
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_STUDENTS = 'academic_tracker_students_v1';
const LOCAL_STORAGE_KEY_ALERTS = 'academic_tracker_alerts_v1';
const LOCAL_STORAGE_KEY_ROLE = 'academic_tracker_role_v1';
const LOCAL_STORAGE_KEY_STUDENT_ID = 'academic_tracker_student_id_v1';

export const AcademicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ROLE);
    return saved === 'parent' || saved === 'student' ? saved : 'teacher';
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STUDENTS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed reading students from localStorage', e);
    }
    return INITIAL_STUDENTS;
  });

  const [selectedStudentId, setSelectedStudentIdState] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STUDENT_ID);
    return saved || 'student-1';
  });

  const [alerts, setAlerts] = useState<RealtimeAlert[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ALERTS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed reading alerts from localStorage', e);
    }
    return INITIAL_ALERTS;
  });

  const [liveToast, setLiveToast] = useState<{
    title: string;
    message: string;
    type: 'grade' | 'attendance' | 'milestone' | 'info';
  } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ALERTS, JSON.stringify(alerts));
  }, [alerts]);

  // Shared server store: every portal (teacher / student / parent) reads and writes the same data.
  // localStorage above remains as an offline cache.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const serverReadyRef = useRef(false);
  const revisionRef = useRef(0);
  const skipNextSaveRef = useRef(false);
  const savePendingRef = useRef(false);
  const latestStateRef = useRef({ students, alerts });
  latestStateRef.current = { students, alerts };

  const pushState = async () => {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(latestStateRef.current),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const { revision } = await res.json();
    revisionRef.current = revision;
  };

  const applyServerState = (store: { revision: number; students: Student[]; alerts: RealtimeAlert[] | null }) => {
    revisionRef.current = store.revision;
    skipNextSaveRef.current = true;
    setStudents(store.students);
    setAlerts(store.alerts || []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/state')
      .then((r) => r.json())
      .then(async (store) => {
        if (cancelled) return;
        if (Array.isArray(store.students)) {
          applyServerState(store);
        } else {
          // First run: seed the server with the data this browser already has
          await pushState();
        }
        serverReadyRef.current = true;
        setSyncStatus('synced');
      })
      .catch(() => !cancelled && setSyncStatus('offline'));

    // Pick up changes made from other devices / portals
    const poll = setInterval(async () => {
      if (!serverReadyRef.current || savePendingRef.current) return;
      try {
        const { revision } = await (await fetch('/api/state/revision')).json();
        if (revision > revisionRef.current && !savePendingRef.current) {
          const store = await (await fetch('/api/state')).json();
          if (Array.isArray(store.students) && !savePendingRef.current) applyServerState(store);
        }
      } catch {
        setSyncStatus('offline');
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!serverReadyRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    savePendingRef.current = true;
    setSyncStatus('saving');
    const timer = setTimeout(() => {
      pushState()
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('offline'))
        .finally(() => {
          savePendingRef.current = false;
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [students, alerts]);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem(LOCAL_STORAGE_KEY_ROLE, newRole);
  };

  const setSelectedStudentId = (id: string) => {
    setSelectedStudentIdState(id);
    localStorage.setItem(LOCAL_STORAGE_KEY_STUDENT_ID, id);
  };

  const triggerToast = (
    title: string,
    message: string,
    type: 'grade' | 'attendance' | 'milestone' | 'info'
  ) => {
    setLiveToast({ title, message, type });
  };

  const dismissToast = () => setLiveToast(null);

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0] || INITIAL_STUDENTS[0];

  const visibleStudents =
    role === 'teacher'
      ? students
      : role === 'parent'
        ? students.filter((s) => s.id === selectedStudent.id || (s.parentName && s.parentName === selectedStudent.parentName))
        : [selectedStudent];

  const updateAssignmentScore = (
    studentId: string,
    subjectId: string,
    assignmentId: string,
    newScore: number,
    feedback?: string
  ) => {
    setStudents((prev) => {
      return prev.map((student) => {
        if (student.id !== studentId) return student;

        const updatedSubjects = student.subjects.map((sub) => {
          if (sub.id !== subjectId) return sub;

          const updatedAssignments = sub.assignments.map((asg) => {
            if (asg.id !== assignmentId) return asg;
            return {
              ...asg,
              score: Math.max(0, Math.min(newScore, asg.maxScore)),
              status: 'Graded' as const,
              submittedDate: asg.submittedDate || new Date().toISOString().split('T')[0],
              ...(feedback !== undefined ? { feedback } : {}),
            };
          });

          const subWithNewAsgs = { ...sub, assignments: updatedAssignments };
          const { score: newSubjectScore, letterGrade: newLetterGrade } =
            calculateSubjectScore(subWithNewAsgs);

          return {
            ...sub,
            assignments: updatedAssignments,
            previousScore: sub.currentScore,
            currentScore: newSubjectScore,
            letterGrade: newLetterGrade,
            trend: getTrendDirection(newSubjectScore, sub.currentScore),
          };
        });

        const newOverallGpa = calculateStudentOverallGpa(updatedSubjects);

        // Check if student reached milestone or honors
        if (newOverallGpa >= student.targetGpa && student.overallGpa < student.targetGpa) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }

        return {
          ...student,
          subjects: updatedSubjects,
          overallGpa: newOverallGpa,
        };
      });
    });

    const targetStudent = students.find((s) => s.id === studentId);
    const targetSubject = targetStudent?.subjects.find((s) => s.id === subjectId);
    const targetAsg = targetSubject?.assignments.find((a) => a.id === assignmentId);

    const alertMsg = `${targetAsg?.title || 'Assignment'} score updated to ${newScore}/${targetAsg?.maxScore || 100} in ${targetSubject?.name || 'Subject'}.`;
    const newAlert: RealtimeAlert = {
      id: `alert-${Date.now()}`,
      timestamp: 'Just now',
      type: 'grade',
      studentId,
      studentName: targetStudent?.name || 'Student',
      title: `Score Updated: ${targetSubject?.name}`,
      message: alertMsg,
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    triggerToast(`Grade Real-Time Update`, alertMsg, 'grade');
  };

  const addAssignment = (
    studentId: string,
    subjectId: string,
    assignmentData: Omit<Assignment, 'id'>
  ) => {
    const newAsg: Assignment = {
      ...assignmentData,
      id: `asg-${Date.now()}`,
    };

    setStudents((prev) => {
      return prev.map((student) => {
        if (student.id !== studentId) return student;

        const updatedSubjects = student.subjects.map((sub) => {
          if (sub.id !== subjectId) return sub;

          const updatedAssignments = [newAsg, ...sub.assignments];
          const subWithNew = { ...sub, assignments: updatedAssignments };
          const { score, letterGrade } = calculateSubjectScore(subWithNew);

          return {
            ...sub,
            assignments: updatedAssignments,
            currentScore: score,
            letterGrade,
          };
        });

        return {
          ...student,
          subjects: updatedSubjects,
          overallGpa: calculateStudentOverallGpa(updatedSubjects),
        };
      });
    });

    const targetStudent = students.find((s) => s.id === studentId);
    const targetSubject = targetStudent?.subjects.find((s) => s.id === subjectId);
    const alertMsg = `New assignment "${newAsg.title}" added to ${targetSubject?.name || 'class'}.`;

    const newAlert: RealtimeAlert = {
      id: `alert-${Date.now()}`,
      timestamp: 'Just now',
      type: 'grade',
      studentId,
      studentName: targetStudent?.name || 'Student',
      title: `New Assignment Published`,
      message: alertMsg,
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    triggerToast('New Assignment Published', alertMsg, 'info');
  };

  const markAttendance = (
    studentId: string,
    date: string,
    status: AttendanceStatus,
    notes?: string
  ) => {
    setStudents((prev) => {
      return prev.map((student) => {
        if (student.id !== studentId) return student;

        const existingIdx = student.attendanceHistory.findIndex((a) => a.date === date);
        let updatedHistory = [...student.attendanceHistory];

        if (existingIdx >= 0) {
          updatedHistory[existingIdx] = {
            ...updatedHistory[existingIdx],
            status,
            notes: notes || updatedHistory[existingIdx].notes,
          };
        } else {
          updatedHistory.unshift({
            id: `att-${Date.now()}`,
            date,
            status,
            notes,
          });
        }

        const newRate = calculateAttendanceRate(updatedHistory);
        return {
          ...student,
          attendanceHistory: updatedHistory,
          attendanceRate: newRate,
        };
      });
    });

    const targetStudent = students.find((s) => s.id === studentId);
    const msg = `Attendance for ${targetStudent?.name} on ${date} marked as ${status}.`;
    const newAlert: RealtimeAlert = {
      id: `alert-${Date.now()}`,
      timestamp: 'Just now',
      type: 'attendance',
      studentId,
      studentName: targetStudent?.name || 'Student',
      title: `Attendance Updated`,
      message: msg,
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    triggerToast('Attendance Sync', msg, 'attendance');
  };

  const addGoal = (studentId: string, goalData: Omit<AcademicGoal, 'id' | 'completed'>) => {
    const newGoal: AcademicGoal = {
      ...goalData,
      id: `goal-${Date.now()}`,
      completed: false,
    };

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, goals: [...s.goals, newGoal] } : s))
    );

    triggerToast('Academic Goal Created', `New goal: "${newGoal.title}" added for tracking.`, 'milestone');
  };

  const toggleGoal = (studentId: string, goalId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g;
            const newCompleted = !g.completed;
            if (newCompleted) {
              confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.7 },
              });
            }
            return { ...g, completed: newCompleted };
          }),
        };
      })
    );
  };

  const addTeacherNote = (studentId: string, note: string) => {
    if (!note.trim()) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, teacherNotes: [note.trim(), ...s.teacherNotes] } : s))
    );
    triggerToast('Teacher Note Recorded', 'Observation added to student progress record.', 'info');
  };

  const sendMessage = (
    studentId: string,
    messageData: { fromRole: Role; senderName: string; subject: string; content: string }
  ) => {
    const newMsg: MessageLog = {
      id: `msg-${Date.now()}`,
      ...messageData,
      timestamp: 'Just now',
      read: true,
    };

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, messages: [newMsg, ...s.messages] } : s))
    );

    const alertMsg = `New note from ${messageData.senderName}: "${messageData.subject}"`;
    const newAlert: RealtimeAlert = {
      id: `alert-${Date.now()}`,
      timestamp: 'Just now',
      type: 'message',
      studentId,
      studentName: students.find((s) => s.id === studentId)?.name || 'Student',
      title: 'New Communication',
      message: alertMsg,
      read: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
    triggerToast('Message Delivered', alertMsg, 'info');
  };

  const markAlertRead = (alertId: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  // Simulate incoming real-time gradebook entry by teacher or student exam result
  const simulateLiveUpdate = () => {
    const student = students[0]; // Leo Vance
    const subject = student.subjects[0]; // Algebra
    const pendingAsg = subject.assignments.find((a) => a.status === 'Pending') || subject.assignments[0];

    // Give a realistic high score to demonstrate grade progression
    const simulatedScore = Math.min(pendingAsg.maxScore, Math.round(pendingAsg.maxScore * 0.94));

    updateAssignmentScore(
      student.id,
      subject.id,
      pendingAsg.id,
      simulatedScore,
      'Live Simulation: Excellent mastery shown on quadratic factorization problems!'
    );

    confetti({
      particleCount: 90,
      spread: 60,
      origin: { y: 0.5 },
    });
  };

  const resetToDefaults = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_STUDENTS);
    localStorage.removeItem(LOCAL_STORAGE_KEY_ALERTS);
    setStudents(INITIAL_STUDENTS);
    setAlerts(INITIAL_ALERTS);
    triggerToast('Data Reset', 'All academic tracking data returned to starting state.', 'info');
  };

  const pushAlert = (studentId: string, studentName: string, title: string, message: string) => {
    const newAlert: RealtimeAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleString(),
      type: 'milestone',
      studentId,
      studentName,
      title,
      message,
      read: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  const recalcSubject = (sub: Subject): Subject => {
    const { score, letterGrade } = calculateSubjectScore(sub);
    return {
      ...sub,
      previousScore: sub.currentScore,
      currentScore: score,
      letterGrade,
      trend: getTrendDirection(score, sub.currentScore),
    };
  };

  const buildStudent = (data: {
    name: string;
    gradeLevel: string;
    studentIdNumber?: string;
    parentName?: string;
    parentEmail?: string;
  }): Student => ({
    id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: data.name.trim(),
    gradeLevel: data.gradeLevel.trim() || 'Unassigned',
    studentIdNumber: data.studentIdNumber?.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
    avatarUrl: initialsAvatar(data.name),
    parentName: data.parentName?.trim() || '',
    parentEmail: data.parentEmail?.trim() || '',
    parentPhone: '',
    targetGpa: 3.5,
    overallGpa: 0,
    attendanceRate: 100,
    attendanceHistory: [],
    subjects: [],
    goals: [],
    messages: [],
    teacherNotes: [],
    portfolioFiles: [],
    progressTables: [],
  });

  const addStudent: AcademicContextType['addStudent'] = (data) => {
    const student = buildStudent(data);
    setStudents((prev) => [...prev, student]);
    triggerToast('Student Added', `${student.name} now has a portfolio.`, 'info');
    return student.id;
  };

  const importGradebook: AcademicContextType['importGradebook'] = (rows, fallbackStudentId) => {
    const summary: GradebookImportSummary = { added: 0, updated: 0, newSubjects: [], newStudents: [] };
    const next = students.map((s) => ({ ...s, subjects: s.subjects.map((sub) => ({ ...sub, assignments: [...sub.assignments] })) }));
    const touched = new Map<string, Set<string>>(); // studentId -> subjectIds to recalculate
    const norm = (v: string) => v.trim().toLowerCase();

    for (const row of rows) {
      let student = row.studentName
        ? next.find((s) => norm(s.name) === norm(row.studentName!) || norm(s.studentIdNumber) === norm(row.studentName!))
        : next.find((s) => s.id === fallbackStudentId);
      if (!student && row.studentName) {
        student = buildStudent({ name: row.studentName, gradeLevel: '' });
        next.push(student);
        summary.newStudents.push(student.name);
      }
      if (!student) continue;

      let subject = student.subjects.find(
        (sub) => norm(sub.name) === norm(row.subjectName) || norm(sub.code) === norm(row.subjectName)
      );
      if (!subject) {
        subject = {
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: row.subjectName,
          code: row.subjectName.slice(0, 4).toUpperCase(),
          teacherName: '',
          teacherEmail: '',
          currentScore: 0,
          letterGrade: '-',
          previousScore: 0,
          trend: 'neutral',
          color: SUBJECT_COLORS[student.subjects.length % SUBJECT_COLORS.length],
          assignments: [],
        };
        student.subjects.push(subject);
        summary.newSubjects.push(`${row.subjectName} (${student.name})`);
      }

      const fields = {
        title: row.title,
        category: row.category,
        score: row.score ?? 0,
        maxScore: row.maxScore,
        weight: row.weight,
        dueDate: row.dueDate,
        status: row.status,
        ...(row.status === 'Graded' ? { submittedDate: row.dueDate } : {}),
        ...(row.feedback ? { feedback: row.feedback } : {}),
      };
      const existing = subject.assignments.findIndex((a) => norm(a.title) === norm(row.title));
      if (existing >= 0) {
        subject.assignments[existing] = { ...subject.assignments[existing], ...fields };
        summary.updated++;
      } else {
        subject.assignments.unshift({ id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...fields });
        summary.added++;
      }

      if (!touched.has(student.id)) touched.set(student.id, new Set());
      touched.get(student.id)!.add(subject.id);
    }

    const result = next.map((s) => {
      const subIds = touched.get(s.id);
      if (!subIds) return s;
      const subjects = s.subjects.map((sub) => (subIds.has(sub.id) ? recalcSubject(sub) : sub));
      return { ...s, subjects, overallGpa: calculateStudentOverallGpa(subjects) };
    });
    setStudents(result);

    for (const [studentId] of touched) {
      const st = result.find((s) => s.id === studentId)!;
      pushAlert(studentId, st.name, 'Tasks & Exams Uploaded', `New gradebook results were uploaded for ${st.name}.`);
    }
    triggerToast(
      'Gradebook Imported',
      `${summary.added} added, ${summary.updated} updated across ${touched.size} student(s).`,
      'grade'
    );
    return summary;
  };

  const updateStudent = (studentId: string, fn: (s: Student) => Student) =>
    setStudents((prev) => prev.map((s) => (s.id === studentId ? fn(s) : s)));

  const addProgressTable: AcademicContextType['addProgressTable'] = (studentId, table) => {
    const newTable: ProgressTable = { ...table, id: `tbl-${Date.now()}`, uploadedAt: new Date().toISOString() };
    updateStudent(studentId, (s) => ({ ...s, progressTables: [newTable, ...(s.progressTables || [])] }));
    const name = students.find((s) => s.id === studentId)?.name || 'Student';
    pushAlert(studentId, name, 'Progress Table Uploaded', `"${table.title}" was added to ${name}'s portfolio.`);
    triggerToast('Progress Table Added', `"${table.title}" is now visible to the student and parents.`, 'info');
  };

  const removeProgressTable: AcademicContextType['removeProgressTable'] = (studentId, tableId) => {
    updateStudent(studentId, (s) => ({ ...s, progressTables: (s.progressTables || []).filter((t) => t.id !== tableId) }));
  };

  const addPortfolioFile: AcademicContextType['addPortfolioFile'] = (studentId, file) => {
    const newFile: PortfolioFile = { ...file, id: `file-${Date.now()}`, uploadedAt: new Date().toISOString() };
    updateStudent(studentId, (s) => ({ ...s, portfolioFiles: [newFile, ...(s.portfolioFiles || [])] }));
    const name = students.find((s) => s.id === studentId)?.name || 'Student';
    pushAlert(studentId, name, `New ${file.category} Document`, `"${file.name}" was uploaded to ${name}'s portfolio.`);
    triggerToast('Document Uploaded', `"${file.name}" added to the portfolio.`, 'info');
  };

  const removePortfolioFile: AcademicContextType['removePortfolioFile'] = (studentId, fileId) => {
    const file = students.find((s) => s.id === studentId)?.portfolioFiles?.find((f) => f.id === fileId);
    if (file?.url.startsWith('/uploads/')) {
      fetch(`/api/files/${encodeURIComponent(file.url.replace('/uploads/', ''))}`, { method: 'DELETE' }).catch(() => {});
    }
    updateStudent(studentId, (s) => ({ ...s, portfolioFiles: (s.portfolioFiles || []).filter((f) => f.id !== fileId) }));
  };

  const unreadAlertCount = alerts.filter((a) => !a.read).length;

  return (
    <AcademicContext.Provider
      value={{
        role,
        setRole,
        students,
        selectedStudentId,
        setSelectedStudentId,
        selectedStudent,
        visibleStudents,
        alerts,
        unreadAlertCount,
        liveToast,
        dismissToast,
        updateAssignmentScore,
        addAssignment,
        markAttendance,
        addGoal,
        toggleGoal,
        addTeacherNote,
        sendMessage,
        markAlertRead,
        clearAllAlerts,
        simulateLiveUpdate,
        resetToDefaults,
        syncStatus,
        addStudent,
        importGradebook,
        addProgressTable,
        removeProgressTable,
        addPortfolioFile,
        removePortfolioFile,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => {
  const context = useContext(AcademicContext);
  if (!context) {
    throw new Error('useAcademic must be used within an AcademicProvider');
  }
  return context;
};
