import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  Student,
  Role,
  RealtimeAlert,
  Assignment,
  AttendanceStatus,
  AcademicGoal,
  MessageLog,
} from '../types';
import { INITIAL_STUDENTS, INITIAL_ALERTS } from '../data/mockData';
import {
  calculateSubjectScore,
  calculateStudentOverallGpa,
  calculateAttendanceRate,
  getTrendDirection,
} from '../lib/calculations';

interface AcademicContextType {
  role: Role;
  setRole: (role: Role) => void;
  students: Student[];
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  selectedStudent: Student;
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
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_STUDENTS = 'academic_tracker_students_v1';
const LOCAL_STORAGE_KEY_ALERTS = 'academic_tracker_alerts_v1';
const LOCAL_STORAGE_KEY_ROLE = 'academic_tracker_role_v1';
const LOCAL_STORAGE_KEY_STUDENT_ID = 'academic_tracker_student_id_v1';

export const AcademicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ROLE);
    return saved === 'parent' ? 'parent' : 'teacher';
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

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem(LOCAL_STORAGE_KEY_ROLE, newRole);
    // If switching to parent, default to student-1 (Leo Vance)
    if (newRole === 'parent' && selectedStudentId !== 'student-1' && selectedStudentId !== 'student-2') {
      setSelectedStudentIdState('student-1');
      localStorage.setItem(LOCAL_STORAGE_KEY_STUDENT_ID, 'student-1');
    }
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
