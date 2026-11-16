/**
 * OGE / EGE tracker. An exam is configured by the teacher (tasks with max points, grade thresholds,
 * optional EGE primary→test conversion). Mock results are stored per task when known.
 */
import { all, get } from './db';

export interface ExamTask { n: number; max: number; topic?: string }
export interface Exam {
  id: number;
  title: string;
  type: 'oge' | 'ege';
  subject_id: number | null;
  subject?: string | null;
  tasks: ExamTask[];
  thresholds: Record<string, number>;
  scale: number[] | null;
  maxPrimary: number;
  archived: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function parseExam(row: any): Exam {
  const tasks: ExamTask[] = JSON.parse(row.tasks || '[]');
  return {
    ...row,
    tasks,
    thresholds: JSON.parse(row.thresholds || '{}'),
    scale: row.scale ? JSON.parse(row.scale) : null,
    maxPrimary: tasks.reduce((a, t) => a + t.max, 0),
  };
}

export function getExam(id: number): Exam | null {
  const row = get<any>('SELECT e.*, s.name AS subject FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id WHERE e.id = ?', id);
  return row ? parseExam(row) : null;
}

export function listExams(): Exam[] {
  return all<any>('SELECT e.*, s.name AS subject FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id ORDER BY e.archived, e.type, e.title').map(parseExam);
}

/** Predicted result for a primary score: OGE → mark 2–5; EGE → test score (if a scale is set) and pass/fail. */
export function predict(exam: Exam, primary: number) {
  if (exam.type === 'oge') {
    const t = exam.thresholds;
    const mark = primary >= (t['5'] ?? Infinity) ? 5 : primary >= (t['4'] ?? Infinity) ? 4 : primary >= (t['3'] ?? Infinity) ? 3 : 2;
    return { mark, test: null as number | null, passed: mark >= 3, label: `«${mark}»` };
  }
  const p = Math.max(0, Math.round(primary));
  const test = exam.scale && exam.scale.length ? exam.scale[Math.min(p, exam.scale.length - 1)] : null;
  const pass = exam.thresholds.pass ?? null;
  const passed = test != null && pass != null ? test >= pass : null;
  return { mark: null as number | null, test, passed, label: test != null ? `${test} т.б.` : `${primary} перв.` };
}

/** Primary points needed for a target: OGE mark → threshold; EGE test score → minimal primary on the scale. */
export function primaryForTarget(exam: Exam, target: number): number | null {
  if (exam.type === 'oge') return exam.thresholds[String(target)] ?? null;
  if (exam.scale && exam.scale.length) {
    const i = exam.scale.findIndex((t) => t >= target);
    return i >= 0 ? i : null;
  }
  return target; // no scale: the target is set in primary points
}

/** Per-task statistics over the last `last` mocks that have per-task scores. */
export function taskStats(exam: Exam, mocks: any[], last = 3) {
  const withScores = mocks.filter((m) => Array.isArray(m.scores)).slice(-last);
  return exam.tasks.map((t, i) => {
    const pts = withScores.map((m) => Number(m.scores[i] ?? 0));
    const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
    return {
      n: t.n,
      max: t.max,
      topic: t.topic || '',
      avg: avg == null ? null : r1(avg),
      share: avg == null || !t.max ? null : Math.round((avg / t.max) * 100),
      lost: avg == null ? null : r1(t.max - avg),
    };
  });
}

/** All exams a student has mock results for, with prediction, trend and weak tasks. */
export function studentExams(studentId: number) {
  const rows = all<any>('SELECT * FROM mock_results WHERE student_id = ? ORDER BY date, id', studentId)
    .map((m) => ({ ...m, scores: m.scores ? JSON.parse(m.scores) : null }));
  const byExam = new Map<number, any[]>();
  for (const m of rows) {
    if (!byExam.has(m.exam_id)) byExam.set(m.exam_id, []);
    byExam.get(m.exam_id)!.push(m);
  }
  const out: any[] = [];
  for (const [examId, mocks] of byExam) {
    const exam = getExam(examId);
    if (!exam) continue;
    const latest = mocks[mocks.length - 1];
    const prev = mocks.length > 1 ? mocks[mocks.length - 2] : null;
    const tasks = taskStats(exam, mocks);
    const weak = tasks.filter((t) => t.share != null && t.share < 50).sort((a, b) => (b.lost ?? 0) - (a.lost ?? 0));
    out.push({
      exam,
      mocks: mocks.map((m) => ({ ...m, prediction: predict(exam, m.total), percent: exam.maxPrimary ? Math.round((m.total / exam.maxPrimary) * 100) : null })),
      latest: { ...latest, prediction: predict(exam, latest.total) },
      delta: prev ? r1(latest.total - prev.total) : null,
      tasks,
      weak,
    });
  }
  return out;
}

/** Class view for one exam: latest mock per student, class average per task, weakest tasks, distribution. */
export function classExam(classId: number, examId: number) {
  const exam = getExam(examId);
  if (!exam) return null;
  const students = all<any>('SELECT id, full_name FROM students WHERE class_id = ? ORDER BY full_name', classId);
  const rows = students.map((s) => {
    const mocks = all<any>('SELECT * FROM mock_results WHERE student_id = ? AND exam_id = ? ORDER BY date, id', s.id, examId)
      .map((m) => ({ ...m, scores: m.scores ? JSON.parse(m.scores) : null }));
    const latest = mocks[mocks.length - 1] || null;
    const prev = mocks.length > 1 ? mocks[mocks.length - 2] : null;
    return {
      id: s.id,
      full_name: s.full_name,
      count: mocks.length,
      latest: latest ? { ...latest, prediction: predict(exam, latest.total) } : null,
      delta: latest && prev ? r1(latest.total - prev.total) : null,
      history: mocks.map((m) => ({ date: m.date, total: m.total })),
    };
  });
  const latestScored = rows.map((r) => r.latest).filter((l) => l && Array.isArray(l.scores));
  const tasks = exam.tasks.map((t, i) => {
    const pts = latestScored.map((l: any) => Number(l.scores[i] ?? 0));
    const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
    return { n: t.n, max: t.max, topic: t.topic || '', share: avg == null || !t.max ? null : Math.round((avg / t.max) * 100) };
  });
  const distribution: Record<string, number> = {};
  for (const r of rows) if (r.latest) distribution[r.latest.prediction.label] = (distribution[r.latest.prediction.label] || 0) + 1;
  return {
    exam,
    students: rows,
    tasks,
    weakest: tasks.filter((t) => t.share != null).sort((a, b) => (a.share ?? 0) - (b.share ?? 0)).slice(0, 5),
    distribution,
  };
}

/** Validates the exam configuration coming from the form. */
export function cleanExamInput(body: any) {
  const type = body.type === 'ege' ? 'ege' : 'oge';
  const tasks: ExamTask[] = (Array.isArray(body.tasks) ? body.tasks : [])
    .map((t: any, i: number) => ({ n: i + 1, max: Math.max(0, Math.round(Number(t?.max) * 10) / 10), topic: String(t?.topic || '').slice(0, 80) }))
    .filter((t: ExamTask) => Number.isFinite(t.max) && t.max > 0);
  if (!tasks.length || tasks.length > 60) throw new Error('Укажите от 1 до 60 заданий с максимальным баллом больше 0');
  const maxPrimary = tasks.reduce((a, t) => a + t.max, 0);
  const thresholds: Record<string, number> = {};
  if (type === 'oge') {
    for (const k of ['3', '4', '5']) {
      const v = Number(body.thresholds?.[k]);
      if (!Number.isFinite(v) || v < 0 || v > maxPrimary) throw new Error(`Порог на «${k}» должен быть от 0 до ${maxPrimary}`);
      thresholds[k] = v;
    }
    if (!(thresholds['3'] <= thresholds['4'] && thresholds['4'] <= thresholds['5'])) throw new Error('Пороги должны расти: «3» ≤ «4» ≤ «5»');
  } else {
    const pass = Number(body.thresholds?.pass);
    if (Number.isFinite(pass) && pass > 0) thresholds.pass = pass;
  }
  let scale: number[] | null = null;
  if (type === 'ege' && typeof body.scale === 'string' && body.scale.trim()) {
    scale = body.scale.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (scale!.some((x) => !Number.isFinite(x) || x < 0 || x > 100)) throw new Error('Таблица перевода: числа от 0 до 100 через запятую');
    if (scale!.length !== Math.round(maxPrimary) + 1) {
      throw new Error(`Таблица перевода должна содержать ${Math.round(maxPrimary) + 1} чисел — для 0…${Math.round(maxPrimary)} первичных баллов`);
    }
  }
  return { type, tasks, thresholds, scale, maxPrimary };
}
