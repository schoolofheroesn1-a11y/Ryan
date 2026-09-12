import { Subject, AttendanceRecord, TrendDirection } from '../types';

export function getLetterGrade(percentage: number): string {
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 65) return 'D+';
  if (percentage >= 60) return 'D';
  return 'F';
}

export function getGpaPoint(percentage: number): number {
  if (percentage >= 93) return 4.0;
  if (percentage >= 90) return 3.7;
  if (percentage >= 87) return 3.3;
  if (percentage >= 83) return 3.0;
  if (percentage >= 80) return 2.7;
  if (percentage >= 77) return 2.3;
  if (percentage >= 73) return 2.0;
  if (percentage >= 70) return 1.7;
  if (percentage >= 65) return 1.3;
  if (percentage >= 60) return 1.0;
  return 0.0;
}

export function calculateSubjectScore(subject: Subject): { score: number; letterGrade: string } {
  const graded = subject.assignments.filter((a) => a.status === 'Graded' && a.maxScore > 0);
  if (graded.length === 0) {
    return { score: subject.currentScore, letterGrade: getLetterGrade(subject.currentScore) };
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const item of graded) {
    const itemPct = (item.score / item.maxScore) * 100;
    const weight = item.weight || 1;
    totalWeightedScore += itemPct * weight;
    totalWeight += weight;
  }

  const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : subject.currentScore;
  const rounded = Math.round(finalScore * 10) / 10;
  return {
    score: rounded,
    letterGrade: getLetterGrade(rounded),
  };
}

export function calculateStudentOverallGpa(subjects: Subject[]): number {
  if (subjects.length === 0) return 0;
  const totalGpaPoints = subjects.reduce((sum, s) => sum + getGpaPoint(s.currentScore), 0);
  const avg = totalGpaPoints / subjects.length;
  return Math.round(avg * 100) / 100;
}

export function calculateAttendanceRate(records: AttendanceRecord[]): number {
  if (records.length === 0) return 100;
  // Present and Excused count favorably, Late counts as 0.75, Absent counts as 0
  let points = 0;
  for (const r of records) {
    if (r.status === 'Present') points += 1;
    else if (r.status === 'Excused') points += 1;
    else if (r.status === 'Late') points += 0.75;
  }
  const pct = (points / records.length) * 100;
  return Math.round(pct * 10) / 10;
}

export function getTrendDirection(current: number, previous: number): TrendDirection {
  const diff = current - previous;
  if (diff > 0.5) return 'up';
  if (diff < -0.5) return 'down';
  return 'neutral';
}
