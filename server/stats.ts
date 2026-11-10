import { all, get } from './db';
import { SCALES, type ScaleKey } from './scales';

export interface SubjectStat {
  subject: string;
  average: number;
  count: number;
  recentAverage: number | null; // last 30 days
  previousAverage: number | null; // before last 30 days
  trend: 'up' | 'down' | 'flat' | 'unknown';
  lowCount: number; // count of 2s and 1s
}

export interface StudentStats {
  average: number | null;
  gradesCount: number;
  subjects: SubjectStat[];
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    sick: number;
    excused: number;
    rate: number | null; // % of days present or late
  };
  achievementsCount: number;
  achievementsByCategory: Record<string, number>;
  notesCount: number;
  filesCount: number;
  risk: 'high' | 'medium' | 'low';
  riskReasons: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function computeStudentStats(studentId: number): StudentStats {
  const grades = all<{ value: number; date: string; subject: string }>(
    `SELECT g.value, g.date, s.name AS subject FROM grades g JOIN subjects s ON s.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.date`,
    studentId,
  );
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const bySubject = new Map<string, { value: number; date: string }[]>();
  for (const g of grades) {
    if (!bySubject.has(g.subject)) bySubject.set(g.subject, []);
    bySubject.get(g.subject)!.push(g);
  }

  const subjects: SubjectStat[] = [...bySubject.entries()].map(([subject, list]) => {
    const values = list.map((g) => g.value);
    const recent = avg(list.filter((g) => g.date >= cutoff).map((g) => g.value));
    const prev = avg(list.filter((g) => g.date < cutoff).map((g) => g.value));
    let trend: SubjectStat['trend'] = 'unknown';
    if (recent !== null && prev !== null) {
      const d = recent - prev;
      trend = d > 0.25 ? 'up' : d < -0.25 ? 'down' : 'flat';
    }
    return {
      subject,
      average: avg(values)!,
      count: values.length,
      recentAverage: recent,
      previousAverage: prev,
      trend,
      lowCount: values.filter((v) => v <= 2).length,
    };
  });
  subjects.sort((a, b) => b.average - a.average);

  const att = all<{ status: string; c: number }>(
    'SELECT status, COUNT(*) AS c FROM attendance WHERE student_id = ? GROUP BY status',
    studentId,
  );
  const a = { total: 0, present: 0, absent: 0, late: 0, sick: 0, excused: 0, rate: null as number | null };
  for (const r of att) {
    (a as any)[r.status] = r.c;
    a.total += r.c;
  }
  if (a.total) a.rate = round(((a.present + a.late) / a.total) * 100);

  const ach = all<{ category: string; c: number }>(
    'SELECT category, COUNT(*) AS c FROM achievements WHERE student_id = ? GROUP BY category',
    studentId,
  );
  const achievementsByCategory: Record<string, number> = {};
  let achievementsCount = 0;
  for (const r of ach) {
    achievementsByCategory[r.category] = r.c;
    achievementsCount += r.c;
  }

  const notesCount = get<{ c: number }>('SELECT COUNT(*) AS c FROM notes WHERE student_id = ?', studentId)!.c;
  const filesCount = get<{ c: number }>('SELECT COUNT(*) AS c FROM files WHERE student_id = ?', studentId)!.c;

  const average = avg(grades.map((g) => g.value));
  const riskReasons: string[] = [];
  let score = 0;
  if (average !== null && average < 3) { score += 2; riskReasons.push(`низкий средний балл (${average})`); }
  else if (average !== null && average < 3.5) { score += 1; riskReasons.push(`средний балл ниже 3.5 (${average})`); }
  const weak = subjects.filter((s) => s.average < 3);
  if (weak.length) { score += weak.length > 1 ? 2 : 1; riskReasons.push(`слабые предметы: ${weak.map((s) => s.subject).join(', ')}`); }
  const falling = subjects.filter((s) => s.trend === 'down');
  if (falling.length) { score += 1; riskReasons.push(`снижение оценок: ${falling.map((s) => s.subject).join(', ')}`); }
  if (a.rate !== null && a.rate < 80) { score += 2; riskReasons.push(`посещаемость ${a.rate}%`); }
  else if (a.rate !== null && a.rate < 90) { score += 1; riskReasons.push(`посещаемость ${a.rate}%`); }

  return {
    average,
    gradesCount: grades.length,
    subjects,
    attendance: a,
    achievementsCount,
    achievementsByCategory,
    notesCount,
    filesCount,
    risk: score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low',
    riskReasons,
  };
}

// ---------- General scales (teacher assessments + AI scores of materials) ----------

export interface ScalePoint { date: string; source: 'teacher' | 'ai'; scores: Partial<Record<ScaleKey, number>> }
export interface ScaleStat {
  key: ScaleKey;
  label: string;
  current: number | null; // blended current level
  teacher: number | null; // latest teacher rating
  ai: number | null; // AI average for the last 90 days
  trend: 'up' | 'down' | 'flat' | 'unknown';
  points: number;
}
export interface ScaleStats {
  scales: ScaleStat[];
  monthly: Record<string, number | string | null>[]; // { month: '2026-09', motivation: 6.5, ... }
  materialsByMonth: { month: string; count: number }[];
  totalPoints: number;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function scalePoints(studentId: number): ScalePoint[] {
  const pts: ScalePoint[] = [];
  for (const a of all<any>('SELECT date, scores FROM assessments WHERE student_id = ? ORDER BY date', studentId)) {
    pts.push({ date: a.date, source: 'teacher', scores: JSON.parse(a.scores || '{}') });
  }
  for (const f of all<any>(
    "SELECT COALESCE(material_date, substr(created_at, 1, 10)) AS date, ai_scores FROM files WHERE student_id = ? AND ai_status = 'done' AND ai_scores IS NOT NULL",
    studentId,
  )) {
    const scores = JSON.parse(f.ai_scores || '{}');
    if (Object.keys(scores).length) pts.push({ date: f.date, source: 'ai', scores });
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeScaleStats(studentId: number): ScaleStats {
  const pts = scalePoints(studentId);
  const recent = daysAgo(60);
  const prevStart = daysAgo(120);
  const aiFrom = daysAgo(90);

  const scales: ScaleStat[] = SCALES.map((s) => {
    const vals = pts.filter((p) => p.scores[s.key] != null);
    const teacherPts = vals.filter((p) => p.source === 'teacher');
    const teacher = teacherPts.length ? teacherPts[teacherPts.length - 1].scores[s.key]! : null;
    const ai = mean(vals.filter((p) => p.source === 'ai' && p.date >= aiFrom).map((p) => p.scores[s.key]!));
    const current = teacher != null && ai != null ? r1((teacher + ai) / 2) : (teacher ?? ai);
    const last = mean(vals.filter((p) => p.date >= recent).map((p) => p.scores[s.key]!));
    const prev = mean(vals.filter((p) => p.date < recent && p.date >= prevStart).map((p) => p.scores[s.key]!));
    let trend: ScaleStat['trend'] = 'unknown';
    if (last != null && prev != null) trend = last - prev > 0.7 ? 'up' : last - prev < -0.7 ? 'down' : 'flat';
    return { key: s.key, label: s.label, current, teacher, ai, trend, points: vals.length };
  });

  const byMonth = new Map<string, ScalePoint[]>();
  for (const p of pts) {
    const m = p.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(p);
  }
  const monthly = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => {
    const row: Record<string, number | string | null> = { month };
    for (const s of SCALES) row[s.key] = mean(list.filter((p) => p.scores[s.key] != null).map((p) => p.scores[s.key]!));
    return row;
  });

  const materialsByMonth = all<{ month: string; count: number }>(
    `SELECT substr(COALESCE(material_date, created_at), 1, 7) AS month, COUNT(*) AS count FROM files
     WHERE student_id = ? GROUP BY month ORDER BY month`,
    studentId,
  );
  return { scales, monthly, materialsByMonth, totalPoints: pts.length };
}
