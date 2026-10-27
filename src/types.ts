export type Role = 'teacher' | 'parent' | 'student';

export type GradeCategory = 'Homework' | 'Quiz' | 'Exam' | 'Project' | 'Lab';
export type AssignmentStatus = 'Graded' | 'Pending' | 'Late' | 'Missing';
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface Assignment {
  id: string;
  title: string;
  category: GradeCategory;
  score: number;
  maxScore: number;
  weight: number; // percentage weight, e.g. 20 for 20%
  dueDate: string;
  submittedDate?: string;
  status: AssignmentStatus;
  feedback?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  teacherEmail: string;
  currentScore: number; // percentage, e.g. 92.5
  letterGrade: string; // 'A', 'A-', 'B+', etc.
  previousScore: number;
  trend: TrendDirection;
  color: string;
  assignments: Assignment[];
}

export interface AcademicGoal {
  id: string;
  title: string;
  subjectId?: string;
  targetMetric: string; // e.g., "Score 90% or above on next Chemistry Exam"
  currentValue: string;
  completed: boolean;
  dueDate: string;
}

export interface MessageLog {
  id: string;
  fromRole: Role;
  senderName: string;
  timestamp: string;
  subject: string;
  content: string;
  read: boolean;
}

export interface Student {
  id: string;
  name: string;
  gradeLevel: string; // e.g. "Grade 8" or "Grade 10"
  studentIdNumber: string;
  avatarUrl: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  targetGpa: number;
  overallGpa: number;
  attendanceRate: number; // percentage 0 - 100
  attendanceHistory: AttendanceRecord[];
  subjects: Subject[];
  goals: AcademicGoal[];
  messages: MessageLog[];
  teacherNotes: string[];
  portfolioFiles?: PortfolioFile[];
  progressTables?: ProgressTable[];
}

export type PortfolioFileCategory = 'Task' | 'Exam' | 'Project' | 'Certificate' | 'Report' | 'Other';

export interface PortfolioFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number; // bytes
  category: PortfolioFileCategory;
  subjectId?: string;
  description?: string;
  uploadedAt: string; // ISO timestamp
  uploadedBy: Role;
}

// A free-form table uploaded from a CSV / Excel file (reading logs, behaviour charts, test breakdowns...)
export interface ProgressTable {
  id: string;
  title: string;
  description?: string;
  columns: string[];
  rows: string[][];
  sourceFileName?: string;
  uploadedAt: string;
  uploadedBy: Role;
}

export interface RealtimeAlert {
  id: string;
  timestamp: string;
  type: 'grade' | 'attendance' | 'milestone' | 'message';
  studentId: string;
  studentName: string;
  title: string;
  message: string;
  read: boolean;
}
