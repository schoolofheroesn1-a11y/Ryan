/**
 * Goal setting: goals per student with automatically measured progress.
 *  - subject:    average percent in a subject (target e.g. 85%)
 *  - scale:      a general quality on the 1–10 scale (target e.g. 7)
 *  - attendance: attendance rate in percent (target e.g. 95%)
 *  - custom:     any goal, progress = completed steps
 */
import { all, get } from './db';
import { computeScaleStats } from './stats';
import { SCALES } from './scales';
import { getExam, studentExams } from './exams';

export type GoalKind = 'subject' | 'scale' | 'attendance' | 'custom' | 'exam';
export type GoalHealth = 'achieved' | 'on_track' | 'behind' | 'overdue' | 'no_data' | 'done' | 'dropped';

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Subject goals use the average of the last WINDOW works, so recent effort shows quickly. */
const WINDOW = 5;

/** Current value of the measured metric. `since` limits it to data after the goal was created when possible. */
export function measure(studentId: number, kind: GoalKind, ref: { subjectId?: number | null; scaleKey?: string | null; examId?: number | null }, since?: string) {
  if (kind === 'subject' && ref.subjectId) {
    // Newest first: the last WINDOW works in this subject.
    const basis = all<{ p: number }>(
      `SELECT COALESCE(percent, value * 20) AS p FROM grades WHERE student_id = ? AND subject_id = ? ORDER BY date DESC, id DESC LIMIT ${WINDOW}`,
      studentId, ref.subjectId,
    ).map((g) => g.p);
    if (!basis.length) return { value: null as number | null, basis: [] as number[], fromStart: false };
    return { value: r1(basis.reduce((a, b) => a + b, 0) / basis.length), basis, fromStart: false };
  }
  if (kind === 'scale' && ref.scaleKey) {
    const s = computeScaleStats(studentId).scales.find((x) => x.key === ref.scaleKey);
    return { value: s?.current ?? null, basis: [], fromStart: false };
  }
  if (kind === 'exam' && ref.examId) {
    const last = get<{ total: number }>('SELECT total FROM mock_results WHERE student_id = ? AND exam_id = ? ORDER BY date DESC, id DESC LIMIT 1', studentId, ref.examId);
    return { value: last ? last.total : null, basis: [], fromStart: false };
  }
  if (kind === 'attendance') {
    const rows = all<{ status: string; date: string }>('SELECT status, date FROM attendance WHERE student_id = ?', studentId);
    const after = since ? rows.filter((r) => r.date >= since) : [];
    const basis = after.length >= 5 ? after : rows;
    if (!basis.length) return { value: null, basis: [], fromStart: false };
    const ok = basis.filter((r) => r.status === 'present' || r.status === 'late').length;
    return { value: r1((ok / basis.length) * 100), basis: [], fromStart: after.length >= 5 };
  }
  return { value: null, basis: [], fromStart: false };
}

export function goalUnit(kind: GoalKind) {
  return kind === 'scale' ? '' : kind === 'exam' ? ' б.' : '%';
}

export function enrichGoal(g: any) {
  const steps = all<any>('SELECT * FROM goal_steps WHERE goal_id = ? ORDER BY position, id', g.id);
  const since = String(g.created_at).slice(0, 10);
  let current: number | null = null;
  let progress: number | null = null;
  let need: string | null = null;

  if (g.kind === 'custom') {
    progress = steps.length ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100) : null;
  } else {
    const m = measure(g.student_id, g.kind, { subjectId: g.subject_id, scaleKey: g.scale_key, examId: g.exam_id }, since);
    current = m.value;
    if (current != null && g.target_value != null) {
      const start = g.start_value ?? current;
      if (current >= g.target_value) progress = 100;
      else if (g.target_value > start) progress = Math.max(0, Math.min(99, Math.round(((current - start) / (g.target_value - start)) * 100)));
      else progress = 0;
    }
    // What is needed: new works push old ones out of the window. Find the smallest number of works (2–5)
    // and the average on them that brings the window average up to the target.
    if (g.kind === 'subject' && current != null && g.target_value != null && current < g.target_value) {
      const old = m.basis; // newest first
      need = `в среднем не ниже ${Math.ceil(g.target_value)}% на следующих ${WINDOW} работах`;
      for (let k = 2; k <= WINDOW; k++) {
        const size = Math.min(WINDOW, old.length + k);
        const kept = old.slice(0, size - k).reduce((a, b) => a + b, 0);
        const needed = (g.target_value * size - kept) / k;
        if (needed <= 100) {
          need = `в среднем не ниже ${Math.max(0, Math.ceil(needed))}% на следующих ${k} работах (считаются ${WINDOW} последних работ по предмету)`;
          break;
        }
      }
    }
    if (g.kind === 'scale' && current != null && g.target_value != null && current < g.target_value) {
      need = `поднять оценку качества на ${r1(g.target_value - current)} балла — отмечайте прогресс в «Общей оценке» и материалах банка`;
    }
    if (g.kind === 'exam' && current != null && g.target_value != null && current < g.target_value) {
      const se = studentExams(g.student_id).find((x) => x.exam.id === g.exam_id);
      const weak = (se?.weak || []).slice(0, 3).map((t: any) => `№${t.n}${t.topic ? ` (${t.topic})` : ''} — теряется ${t.lost} б.`);
      need = `добрать ${Math.round((g.target_value - current) * 10) / 10} перв. балла` + (weak.length ? `. Больше всего баллов теряется: ${weak.join('; ')}` : '');
    }
    if (g.kind === 'attendance' && current != null && g.target_value != null && current < g.target_value) {
      need = 'посещать все уроки без пропусков и опозданий в ближайшие недели';
    }
  }

  let health: GoalHealth;
  const today = new Date().toISOString().slice(0, 10);
  if (g.status === 'done') health = 'done';
  else if (g.status === 'dropped') health = 'dropped';
  else if (progress === 100) health = 'achieved';
  else if (progress == null) health = 'no_data';
  else if (g.deadline && g.deadline < today) health = 'overdue';
  else if (g.deadline) {
    const total = new Date(g.deadline).getTime() - new Date(since).getTime();
    const elapsed = Date.now() - new Date(since).getTime();
    const expected = total > 0 ? Math.min(100, (elapsed / total) * 100) : 100;
    health = progress + 10 >= expected ? 'on_track' : 'behind';
  } else health = 'on_track';

  const scale = g.scale_key ? SCALES.find((s) => s.key === g.scale_key) : null;
  const exam = g.exam_id ? getExam(g.exam_id) : null;
  return {
    ...g,
    max: g.kind === 'scale' ? 10 : g.kind === 'exam' ? exam?.maxPrimary ?? null : 100,
    exam_title: exam?.title ?? null,
    subject: g.subject_id ? get<any>('SELECT name FROM subjects WHERE id = ?', g.subject_id)?.name ?? null : null,
    scale_label: scale?.label ?? null,
    unit: goalUnit(g.kind),
    steps: steps.map((s) => ({ ...s, done: Boolean(s.done) })),
    current,
    progress,
    need,
    health,
  };
}

export function studentGoals(studentId: number) {
  return all<any>(
    `SELECT * FROM goals WHERE student_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'done' THEN 1 ELSE 2 END, COALESCE(deadline, '9999'), id DESC`,
    studentId,
  ).map(enrichGoal);
}
