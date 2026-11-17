import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, tx, UPLOAD_DIR } from './db';
import {
  createStudentSession, requireStudent,
  accessibleClassIds, canAccessClass, canAccessStudent, createSession, destroySession,
  hashPassword, loadUser, requireAdmin, requireAuth, verifyPassword, type User,
} from './auth';
import { computeStudentStats } from './stats';
import { extractText } from './extract';
import { enqueueMaterial, resumePendingMaterials } from './material-ai';
import { analyzeClass, classAnalytics } from './class-ai';
import { MATERIAL_CATEGORIES, SCALES, cleanScores } from './scales';
import { computeScaleStats } from './stats';
import { normalizeGrade, MARK_THRESHOLDS } from './grading';
import { enrichGoal, measure, studentGoals, type GoalKind } from './goals';
import { meetingPrep, mentoringInfo, mentoringOverview } from './mentoring';
import { createDemoStudent } from './demo';
import { classExam, cleanExamInput, getExam, listExams, predict, primaryForTarget, studentExams } from './exams';
import { aiEnabled, aiModelName, aiProvider, analyzeStudent } from './ai';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(loadUser);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const wrap = (fn: (req: Request, res: Response) => any) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) { next(e); }
};
const id = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Неверный идентификатор');
  return n;
};
const str = (v: unknown, field: string, required = true) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) throw new HttpError(400, `Поле «${field}» обязательно`);
  return s;
};
const date = (v: unknown) => {
  const s = str(v, 'Дата');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Дата должна быть в формате ГГГГ-ММ-ДД');
  return s;
};
// Multer stores originalname as latin1; decode to UTF-8 so Cyrillic names survive.
const fileName = (f: Express.Multer.File) => Buffer.from(f.originalname, 'latin1').toString('utf8');

function assertStudent(user: User, studentId: number) {
  if (!get('SELECT 1 FROM students WHERE id = ?', studentId)) throw new HttpError(404, 'Ученик не найден');
  if (!canAccessStudent(user, studentId)) throw new HttpError(403, 'Нет доступа к этому ученику');
}
function assertClass(user: User, classId: number) {
  if (!get('SELECT 1 FROM classes WHERE id = ?', classId)) throw new HttpError(404, 'Класс не найден');
  if (!canAccessClass(user, classId)) throw new HttpError(403, 'Нет доступа к этому классу');
}
/** For rows in tables with student_id: check access and return the row. */
function ownedRow(user: User, table: string, rowId: number) {
  const row = get<any>(`SELECT * FROM ${table} WHERE id = ?`, rowId);
  if (!row) throw new HttpError(404, 'Запись не найдена');
  assertStudent(user, row.student_id);
  return row;
}
function removeFile(stored: string) {
  fs.rm(path.join(UPLOAD_DIR, path.basename(stored)), { force: true }, () => {});
}

// ---------- Auth ----------
app.get('/api/setup-status', (_req, res) => {
  const c = get<{ c: number }>('SELECT COUNT(*) AS c FROM users')!.c;
  res.json({ needsSetup: c === 0, aiEnabled: aiEnabled(), aiModel: aiModelName() });
});

app.post('/api/setup', wrap((req, res) => {
  if (get<{ c: number }>('SELECT COUNT(*) AS c FROM users')!.c > 0) throw new HttpError(400, 'Администратор уже создан');
  const name = str(req.body.name, 'Имя');
  const email = str(req.body.email, 'Email');
  const password = str(req.body.password, 'Пароль');
  if (password.length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
  const r = run('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', email, name, hashPassword(password), 'admin');
  createSession(res, Number(r.lastInsertRowid));
  res.json({ ok: true });
}));

app.post('/api/login', wrap((req, res) => {
  const email = str(req.body.email, 'Логин');
  const password = str(req.body.password, 'Пароль');
  const nowIso = new Date().toISOString();
  const u = get<any>('SELECT * FROM users WHERE email = ?', email);
  if (u && verifyPassword(password, u.password_hash)) {
    run('DELETE FROM sessions WHERE expires_at < ?', nowIso);
    createSession(res, u.id);
    return res.json({ ok: true, kind: 'staff' });
  }
  // Student cabinet login
  const a = get<any>('SELECT * FROM student_accounts WHERE login = ?', email);
  if (a && verifyPassword(password, a.password_hash)) {
    run('DELETE FROM student_sessions WHERE expires_at < ?', nowIso);
    run("UPDATE student_accounts SET last_login = datetime('now') WHERE id = ?", a.id);
    createStudentSession(res, a.student_id);
    return res.json({ ok: true, kind: 'student' });
  }
  throw new HttpError(401, 'Неверный логин или пароль');
}));

app.post('/api/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null, student: req.student || null });
});

// ---------- Student cabinet (only the student's own data) ----------
app.use('/api/student', requireStudent);
app.get('/api/student/me', (req, res) => {
  const sid = req.student!.studentId;
  const stats = computeStudentStats(sid);
  const m = mentoringInfo(sid);
  res.json({
    me: req.student,
    scales: SCALES,
    stats: { percent: stats.percent, average: stats.average, subjects: stats.subjects, attendance: stats.attendance.rate },
    grades: all<any>(
      `SELECT g.id, g.date, g.value, COALESCE(g.percent, g.value * 20) AS percent, g.score, g.max_score, g.kind, g.comment, s.name AS subject
       FROM grades g JOIN subjects s ON s.id = g.subject_id WHERE g.student_id = ? ORDER BY g.date DESC, g.id DESC LIMIT 40`, sid),
    goals: studentGoals(sid).filter((g) => g.status !== 'dropped'),
    exams: studentExams(sid),
    selfAssessments: all<any>('SELECT * FROM self_assessments WHERE student_id = ? ORDER BY date DESC, id DESC LIMIT 12', sid)
      .map((a) => ({ ...a, scores: JSON.parse(a.scores || '{}') })),
    reflections: all<any>(
      `SELECT id, extracted_text AS text, COALESCE(material_date, substr(created_at, 1, 10)) AS date FROM files
       WHERE student_id = ? AND by_student = 1 ORDER BY id DESC LIMIT 20`, sid),
    mentor: m.mentor ? { name: m.mentor.name } : null,
    agreements: m.meetings.slice(0, 3).map((x: any) => ({ date: x.date, agreements: x.agreements, next_date: x.next_date })).filter((x: any) => x.agreements),
  });
});
app.post('/api/student/reflection', wrap((req, res) => {
  const sid = req.student!.studentId;
  const parts = [
    ['Что получилось на этой неделе', str(req.body.worked, 'Что получилось', false)],
    ['Что было трудно', str(req.body.hard, 'Что было трудно', false)],
    ['Что сделаю иначе / цель на следующую неделю', str(req.body.next, 'План', false)],
  ].filter(([, v]) => v);
  if (!parts.length) throw new HttpError(400, 'Напиши хотя бы один ответ');
  const text = parts.map(([q, a]) => `${q}: ${a}`).join('\n\n').slice(0, 20_000);
  const d = new Date().toISOString().slice(0, 10);
  const stored = crypto.randomBytes(16).toString('hex') + '.txt';
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), text, 'utf8');
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, kind, extracted_text, extract_status, category, material_date, by_student)
     VALUES (?, ?, ?, 'text/plain; charset=utf-8', ?, 'Ученик (сам)', 'message', ?, 'ok', 'Рефлексия ученика', ?, 1)`,
    sid, `Рефлексия ученика от ${d.split('-').reverse().join('.')}.txt`, stored, Buffer.byteLength(text), text, d,
  );
  enqueueMaterial(Number(r.lastInsertRowid));
  res.json({ ok: true });
}));
app.post('/api/student/self-assessment', wrap((req, res) => {
  const scores = cleanScores(req.body.scores);
  if (!Object.keys(scores).length) throw new HttpError(400, 'Оцени себя хотя бы по одному качеству');
  run('INSERT INTO self_assessments (student_id, date, scores, comment) VALUES (?, ?, ?, ?)',
    req.student!.studentId, new Date().toISOString().slice(0, 10), JSON.stringify(scores), str(req.body.comment, 'Комментарий', false).slice(0, 1000));
  res.json({ ok: true });
}));
app.post('/api/student/goals', wrap((req, res) => {
  const sid = req.student!.studentId;
  const title = str(req.body.title, 'Цель').slice(0, 200);
  const steps: string[] = (Array.isArray(req.body.steps) ? req.body.steps : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 15);
  tx(() => {
    const g = Number(run(`INSERT INTO goals (student_id, title, kind, deadline, source) VALUES (?, ?, 'custom', ?, 'student')`,
      sid, title, req.body.deadline ? date(req.body.deadline) : null).lastInsertRowid);
    steps.forEach((t, i) => run('INSERT INTO goal_steps (goal_id, text, position) VALUES (?, ?, ?)', g, t.slice(0, 200), i));
  });
  res.json({ ok: true });
}));
/** A step of the student's own goal. */
function ownStep(sid: number, stepId: number) {
  const st = get<any>('SELECT gs.*, g.student_id FROM goal_steps gs JOIN goals g ON g.id = gs.goal_id WHERE gs.id = ?', stepId);
  if (!st || st.student_id !== sid) throw new HttpError(404, 'Шаг не найден');
  return st;
}
app.patch('/api/student/goal-steps/:id', wrap((req, res) => {
  const st = ownStep(req.student!.studentId, id(req.params.id));
  const done = req.body.done ? 1 : 0;
  run(`UPDATE goal_steps SET done = ?, done_at = CASE WHEN ? = 1 THEN COALESCE(done_at, datetime('now')) ELSE NULL END WHERE id = ?`, done, done, st.id);
  res.json({ ok: true });
}));
app.post('/api/student/goals/:id/steps', wrap((req, res) => {
  const g = get<any>('SELECT * FROM goals WHERE id = ?', id(req.params.id));
  if (!g || g.student_id !== req.student!.studentId) throw new HttpError(404, 'Цель не найдена');
  const pos = get<any>('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM goal_steps WHERE goal_id = ?', g.id).p;
  run('INSERT INTO goal_steps (goal_id, text, position) VALUES (?, ?, ?)', g.id, str(req.body.text, 'Шаг').slice(0, 200), pos);
  res.json({ ok: true });
}));
app.post('/api/student/password', wrap((req, res) => {
  const a = get<any>('SELECT * FROM student_accounts WHERE student_id = ?', req.student!.studentId);
  const next = str(req.body.next, 'Новый пароль');
  if (!a || !verifyPassword(str(req.body.current, 'Текущий пароль'), a.password_hash)) throw new HttpError(400, 'Текущий пароль неверен');
  if (next.length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
  run('UPDATE student_accounts SET password_hash = ? WHERE id = ?', hashPassword(next), a.id);
  res.json({ ok: true });
}));

app.use('/api', requireAuth);

app.post('/api/me/password', wrap((req, res) => {
  const current = str(req.body.current, 'Текущий пароль');
  const next = str(req.body.next, 'Новый пароль');
  if (next.length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
  const u = get<any>('SELECT * FROM users WHERE id = ?', req.user!.id);
  if (!verifyPassword(current, u.password_hash)) throw new HttpError(400, 'Текущий пароль неверен');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), u.id);
  res.json({ ok: true });
}));

// ---------- Users (admin) ----------
app.get('/api/users', requireAdmin, (_req, res) => {
  const users = all<any>('SELECT id, email, name, role, created_at FROM users ORDER BY role, name');
  const links = all<{ user_id: number; class_id: number }>('SELECT * FROM class_teachers');
  res.json(users.map((u) => ({ ...u, classIds: links.filter((l) => l.user_id === u.id).map((l) => l.class_id) })));
});

function setTeacherClasses(userId: number, classIds: unknown) {
  if (!Array.isArray(classIds)) return;
  run('DELETE FROM class_teachers WHERE user_id = ?', userId);
  for (const c of classIds) run('INSERT OR IGNORE INTO class_teachers (class_id, user_id) VALUES (?, ?)', id(c), userId);
}

app.post('/api/users', requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 'ФИО');
  const email = str(req.body.email, 'Email');
  const password = str(req.body.password, 'Пароль');
  const role = req.body.role === 'admin' ? 'admin' : 'teacher';
  if (password.length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) throw new HttpError(400, 'Пользователь с таким email уже есть');
  const userId = tx(() => {
    const r = run('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', email, name, hashPassword(password), role);
    const uid = Number(r.lastInsertRowid);
    setTeacherClasses(uid, req.body.classIds);
    return uid;
  });
  res.json({ id: userId });
}));

app.patch('/api/users/:id', requireAdmin, wrap((req, res) => {
  const uid = id(req.params.id);
  const u = get<any>('SELECT * FROM users WHERE id = ?', uid);
  if (!u) throw new HttpError(404, 'Пользователь не найден');
  tx(() => {
    if (req.body.name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', str(req.body.name, 'ФИО'), uid);
    if (req.body.email !== undefined) run('UPDATE users SET email = ? WHERE id = ?', str(req.body.email, 'Email'), uid);
    if (req.body.role !== undefined && uid !== req.user!.id)
      run('UPDATE users SET role = ? WHERE id = ?', req.body.role === 'admin' ? 'admin' : 'teacher', uid);
    if (req.body.password) {
      if (String(req.body.password).length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
      run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(req.body.password)), uid);
      run('DELETE FROM sessions WHERE user_id = ? AND user_id != ?', uid, req.user!.id);
    }
    setTeacherClasses(uid, req.body.classIds);
  });
  res.json({ ok: true });
}));

app.delete('/api/users/:id', requireAdmin, wrap((req, res) => {
  const uid = id(req.params.id);
  if (uid === req.user!.id) throw new HttpError(400, 'Нельзя удалить самого себя');
  run('DELETE FROM users WHERE id = ?', uid);
  res.json({ ok: true });
}));

// ---------- Subjects ----------
app.get('/api/subjects', (_req, res) => res.json(all('SELECT * FROM subjects ORDER BY name')));
app.post('/api/subjects', requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 'Название');
  if (get('SELECT 1 FROM subjects WHERE name = ?', name)) throw new HttpError(400, 'Такой предмет уже есть');
  res.json({ id: Number(run('INSERT INTO subjects (name) VALUES (?)', name).lastInsertRowid) });
}));
app.delete('/api/subjects/:id', requireAdmin, wrap((req, res) => {
  run('DELETE FROM subjects WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// ---------- Classes ----------
function classSummaries(user: User) {
  const ids = accessibleClassIds(user);
  const classes = all<any>('SELECT * FROM classes ORDER BY name').filter((c) => ids === null || ids.includes(c.id));
  const teachers = all<any>('SELECT ct.class_id, u.id, u.name FROM class_teachers ct JOIN users u ON u.id = ct.user_id');
  return classes.map((c) => {
    const stats = get<any>(
      `SELECT COUNT(DISTINCT s.id) AS students,
        (SELECT ROUND(AVG(g.value), 2) FROM grades g JOIN students s2 ON s2.id = g.student_id WHERE s2.class_id = c.id) AS average,
        (SELECT ROUND(AVG(COALESCE(g.percent, g.value * 20)), 1) FROM grades g JOIN students s4 ON s4.id = g.student_id WHERE s4.class_id = c.id) AS percent,
        (SELECT ROUND(100.0 * SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1)
           FROM attendance a JOIN students s3 ON s3.id = a.student_id WHERE s3.class_id = c.id) AS attendance
       FROM classes c LEFT JOIN students s ON s.class_id = c.id WHERE c.id = ?`,
      c.id,
    );
    return { ...c, ...stats, teachers: teachers.filter((t) => t.class_id === c.id).map((t) => ({ id: t.id, name: t.name })) };
  });
}

app.get('/api/classes', (req, res) => res.json(classSummaries(req.user!)));

app.post('/api/classes', requireAdmin, wrap((req, res) => {
  const r = run('INSERT INTO classes (name, year) VALUES (?, ?)', str(req.body.name, 'Название'), str(req.body.year, 'Учебный год', false));
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.patch('/api/classes/:id', requireAdmin, wrap((req, res) => {
  const cid = id(req.params.id);
  run('UPDATE classes SET name = ?, year = ? WHERE id = ?', str(req.body.name, 'Название'), str(req.body.year, 'Учебный год', false), cid);
  res.json({ ok: true });
}));
app.delete('/api/classes/:id', requireAdmin, wrap((req, res) => {
  run('DELETE FROM classes WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

app.get('/api/classes/:id', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const cls = get<any>('SELECT * FROM classes WHERE id = ?', cid);
  const students = all<any>('SELECT id, full_name, birth_date, interests FROM students WHERE class_id = ? ORDER BY full_name', cid);
  res.json({
    ...cls,
    students: students.map((s) => {
      const st = computeStudentStats(s.id);
      return {
        ...s,
        average: st.average,
        percent: st.percent,
        attendanceRate: st.attendance.rate,
        achievements: st.achievementsCount,
        risk: st.risk,
        riskReasons: st.riskReasons,
      };
    }),
  });
}));

app.post('/api/classes/:id/demo-student', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  res.json(createDemoStudent(cid, req.user!.id));
}));

app.post('/api/classes/:id/students/bulk', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const names: string[] = (Array.isArray(req.body.names) ? req.body.names : []).map((n: any) => String(n).trim()).filter(Boolean);
  if (!names.length) throw new HttpError(400, 'Список учеников пуст');
  tx(() => names.forEach((n) => run('INSERT INTO students (class_id, full_name) VALUES (?, ?)', cid, n)));
  res.json({ added: names.length });
}));

app.post('/api/classes/:id/grades/bulk', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const subjectId = id(req.body.subjectId);
  const d = date(req.body.date);
  const kind = str(req.body.kind, 'Тип работы', false) || 'Работа на уроке';
  // Each item: { studentId, value } (mark), { studentId, percent } or { studentId, score } with a common max.
  const items: any[] = Array.isArray(req.body.grades) ? req.body.grades : [];
  const max = req.body.max;
  let added = 0;
  tx(() => {
    for (const it of items) {
      const g = normalizeGrade({ value: it.value, percent: it.percent, score: it.score, max: it.max ?? max });
      if (!g) continue;
      const sid = id(it.studentId);
      if (!get('SELECT 1 FROM students WHERE id = ? AND class_id = ?', sid, cid)) continue;
      run('INSERT INTO grades (student_id, subject_id, value, percent, score, max_score, kind, date, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        sid, subjectId, g.value, g.percent, g.score, g.max, kind, d, req.user!.id);
      added++;
    }
  });
  res.json({ added });
}));

app.get('/api/classes/:id/attendance', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const d = date(req.query.date);
  res.json(all('SELECT a.student_id, a.status FROM attendance a JOIN students s ON s.id = a.student_id WHERE s.class_id = ? AND a.date = ?', cid, d));
}));

const STATUSES = ['present', 'absent', 'late', 'sick', 'excused'];
app.post('/api/classes/:id/attendance/bulk', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const d = date(req.body.date);
  const records: { studentId: number; status: string }[] = Array.isArray(req.body.records) ? req.body.records : [];
  tx(() => {
    for (const r of records) {
      if (!STATUSES.includes(r.status)) continue;
      const sid = id(r.studentId);
      if (!get('SELECT 1 FROM students WHERE id = ? AND class_id = ?', sid, cid)) continue;
      run(
        `INSERT INTO attendance (student_id, date, status, teacher_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, teacher_id = excluded.teacher_id`,
        sid, d, r.status, req.user!.id,
      );
    }
  });
  res.json({ ok: true });
}));

// ---------- Dashboard ----------
app.get('/api/dashboard', (req, res) => {
  const user = req.user!;
  const classes = classSummaries(user);
  const classIds = classes.map((c) => c.id);
  const placeholders = classIds.map(() => '?').join(',') || 'NULL';
  const students = all<any>(
    `SELECT s.id, s.full_name, c.name AS class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.class_id IN (${placeholders})`,
    ...classIds,
  );
  const atRisk = students
    .map((s) => ({ ...s, ...(({ risk, riskReasons, average, percent }) => ({ risk, riskReasons, average, percent }))(computeStudentStats(s.id)) }))
    .filter((s) => s.risk === 'high')
    .slice(0, 12);
  const recentAchievements = all<any>(
    `SELECT a.id, a.title, a.level, a.result, a.date, s.id AS student_id, s.full_name FROM achievements a
     JOIN students s ON s.id = a.student_id WHERE s.class_id IN (${placeholders}) ORDER BY a.date DESC LIMIT 8`,
    ...classIds,
  );
  const sids = students.map((s) => s.id);
  const sph = sids.map(() => '?').join(',') || 'NULL';
  const subjects = all<any>(
    `SELECT s.name AS subject, ROUND(AVG(COALESCE(g.percent, g.value * 20)), 1) AS percent, COUNT(*) AS count
     FROM grades g JOIN subjects s ON s.id = g.subject_id WHERE g.student_id IN (${sph}) GROUP BY s.id ORDER BY percent DESC`,
    ...sids,
  );
  const overall = get<any>(`SELECT ROUND(AVG(COALESCE(percent, value * 20)), 1) AS p FROM grades WHERE student_id IN (${sph})`, ...sids)?.p ?? null;
  const goals = all<any>(
    `SELECT g.*, st.full_name, c.name AS class_name FROM goals g JOIN students st ON st.id = g.student_id
     LEFT JOIN classes c ON c.id = st.class_id WHERE g.student_id IN (${sph}) AND g.status = 'active'`,
    ...sids,
  ).map((g) => ({ ...enrichGoal(g), full_name: g.full_name, class_name: g.class_name }));
  const goalStats = { total: goals.length, achieved: 0, on_track: 0, behind: 0, overdue: 0, no_data: 0 } as Record<string, number>;
  for (const g of goals) goalStats[g.health] = (goalStats[g.health] || 0) + 1;
  const goalFocus = goals
    .filter((g) => g.health !== 'achieved')
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
    .slice(0, 6);
  const recentMaterials = all<any>(
    `SELECT f.id, f.original_name, f.category, f.ai_summary, f.ai_status, COALESCE(f.material_date, substr(f.created_at, 1, 10)) AS date,
       st.id AS student_id, st.full_name FROM files f JOIN students st ON st.id = f.student_id
     WHERE f.student_id IN (${sph}) ORDER BY f.id DESC LIMIT 5`,
    ...sids,
  );

  res.json({
    totals: {
      classes: classes.length,
      students: students.length,
      teachers: user.role === 'admin' ? get<any>("SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'")!.c : null,
      percent: overall,
      materials: get<any>(`SELECT COUNT(*) AS c FROM files WHERE student_id IN (${sph})`, ...sids)!.c,
    },
    classes,
    atRisk,
    recentAchievements,
    subjects,
    goalStats,
    goalFocus,
    recentMaterials,
  });
});

// ---------- Students ----------
app.post('/api/students', wrap((req, res) => {
  const cid = id(req.body.classId);
  assertClass(req.user!, cid);
  const r = run(
    'INSERT INTO students (class_id, full_name, birth_date, interests, about) VALUES (?, ?, ?, ?, ?)',
    cid, str(req.body.fullName, 'ФИО'), str(req.body.birthDate, 'Дата рождения', false) || null,
    str(req.body.interests, 'Интересы', false), str(req.body.about, 'О ученике', false),
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));

app.get('/api/students/:id', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const student = get<any>('SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ?', sid);
  res.json({
    student,
    stats: computeStudentStats(sid),
    grades: all(
      `SELECT g.*, sub.name AS subject, u.name AS teacher FROM grades g JOIN subjects sub ON sub.id = g.subject_id
       LEFT JOIN users u ON u.id = g.teacher_id WHERE g.student_id = ? ORDER BY g.date DESC, g.id DESC`, sid),
    attendance: all('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', sid),
    achievements: all(
      `SELECT a.*, f.original_name AS file_name, u.name AS teacher FROM achievements a LEFT JOIN files f ON f.id = a.file_id
       LEFT JOIN users u ON u.id = a.teacher_id WHERE a.student_id = ? ORDER BY a.date DESC`, sid),
    notes: all('SELECT n.*, u.name AS teacher FROM notes n LEFT JOIN users u ON u.id = n.teacher_id WHERE n.student_id = ? ORDER BY n.created_at DESC', sid),
    files: all<any>(
      `SELECT f.id, f.student_id, f.original_name, f.mime, f.size, f.description, f.kind, f.extract_status, f.created_at,
       f.category, COALESCE(f.material_date, substr(f.created_at, 1, 10)) AS material_date, f.ai_status, f.ai_summary, f.by_student,
       f.ai_scores, f.ai_tags, f.ai_error, LENGTH(f.extracted_text) AS text_length, u.name AS uploader
       FROM files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.student_id = ?
       ORDER BY material_date DESC, f.id DESC`, sid,
    ).map((f) => ({ ...f, ai_scores: f.ai_scores ? JSON.parse(f.ai_scores) : null, ai_tags: f.ai_tags ? JSON.parse(f.ai_tags) : [] })),
    assessments: all<any>(
      `SELECT a.*, u.name AS teacher FROM assessments a LEFT JOIN users u ON u.id = a.teacher_id
       WHERE a.student_id = ? ORDER BY a.date DESC, a.id DESC`, sid,
    ).map((a) => ({ ...a, scores: JSON.parse(a.scores || '{}') })),
    scaleStats: computeScaleStats(sid),
    goals: studentGoals(sid),
    exams: studentExams(sid),
    mentoring: mentoringInfo(sid),
    selfAssessments: all<any>('SELECT * FROM self_assessments WHERE student_id = ? ORDER BY date DESC, id DESC', sid)
      .map((a) => ({ ...a, scores: JSON.parse(a.scores || '{}') })),
    account: get<any>('SELECT login, created_at, last_login FROM student_accounts WHERE student_id = ?', sid) ?? null,
    reports: all<any>('SELECT r.*, u.name AS author FROM ai_reports r LEFT JOIN users u ON u.id = r.created_by WHERE r.student_id = ? ORDER BY r.created_at DESC', sid)
      .map((r) => ({ ...r, content: JSON.parse(r.content) })),
  });
}));

app.patch('/api/students/:id', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const cid = req.body.classId ? id(req.body.classId) : get<any>('SELECT class_id FROM students WHERE id = ?', sid).class_id;
  if (cid) assertClass(req.user!, cid);
  run(
    'UPDATE students SET full_name = ?, birth_date = ?, interests = ?, about = ?, class_id = ? WHERE id = ?',
    str(req.body.fullName, 'ФИО'), str(req.body.birthDate, 'Дата рождения', false) || null,
    str(req.body.interests, 'Интересы', false), str(req.body.about, 'О ученике', false), cid, sid,
  );
  res.json({ ok: true });
}));

app.post('/api/students/bulk-delete', wrap((req, res) => {
  const ids: number[] = (Array.isArray(req.body.ids) ? req.body.ids : []).map(id);
  if (!ids.length) throw new HttpError(400, 'Не выбраны ученики');
  for (const sid of ids) assertStudent(req.user!, sid);
  const files = all<any>(`SELECT stored_name FROM files WHERE student_id IN (${ids.map(() => '?').join(',')})`, ...ids);
  tx(() => ids.forEach((sid) => run('DELETE FROM students WHERE id = ?', sid)));
  files.forEach((f) => removeFile(f.stored_name));
  res.json({ deleted: ids.length });
}));

app.delete('/api/students/:id', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const files = all<any>('SELECT stored_name FROM files WHERE student_id = ?', sid);
  run('DELETE FROM students WHERE id = ?', sid);
  files.forEach((f) => removeFile(f.stored_name));
  res.json({ ok: true });
}));

// Grades
app.post('/api/students/:id/grades', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const g = normalizeGrade(req.body);
  if (!g) throw new HttpError(400, 'Укажите отметку 1–5, процент 0–100 или баллы (не больше максимума)');
  const r = run(
    'INSERT INTO grades (student_id, subject_id, value, percent, score, max_score, kind, date, comment, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    sid, id(req.body.subjectId), g.value, g.percent, g.score, g.max, str(req.body.kind, 'Тип', false) || 'Работа на уроке', date(req.body.date),
    str(req.body.comment, 'Комментарий', false), req.user!.id,
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.delete('/api/grades/:id', wrap((req, res) => {
  ownedRow(req.user!, 'grades', id(req.params.id));
  run('DELETE FROM grades WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// Attendance
app.post('/api/students/:id/attendance', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  if (!STATUSES.includes(req.body.status)) throw new HttpError(400, 'Неверный статус');
  run(
    `INSERT INTO attendance (student_id, date, status, comment, teacher_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, comment = excluded.comment, teacher_id = excluded.teacher_id`,
    sid, date(req.body.date), req.body.status, str(req.body.comment, 'Комментарий', false), req.user!.id,
  );
  res.json({ ok: true });
}));
app.delete('/api/attendance/:id', wrap((req, res) => {
  ownedRow(req.user!, 'attendance', id(req.params.id));
  run('DELETE FROM attendance WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// Files
const category = (v: unknown, fallback: string) => {
  const c = typeof v === 'string' ? v.trim() : '';
  return MATERIAL_CATEGORIES.includes(c) ? c : fallback;
};
const optDate = (v: unknown) => (v ? date(v) : new Date().toISOString().slice(0, 10));

async function saveFile(user: User, studentId: number, f: Express.Multer.File, description: string, cat = 'Другое', mdate = optDate(null)) {
  const name = fileName(f);
  const { text, status } = await extractText(path.join(UPLOAD_DIR, f.filename), name, f.mimetype);
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, uploaded_by, kind, extracted_text, extract_status, category, material_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'file', ?, ?, ?, ?)`,
    studentId, name, f.filename, f.mimetype, f.size, description, user.id, text || null, status, cat, mdate,
  );
  const fid = Number(r.lastInsertRowid);
  enqueueMaterial(fid);
  return fid;
}

app.post('/api/students/:id/files', upload.array('files', 20), wrap(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const sid = id(req.params.id);
  try {
    assertStudent(req.user!, sid);
  } catch (e) {
    files.forEach((f) => removeFile(f.filename));
    throw e;
  }
  if (!files.length) throw new HttpError(400, 'Файлы не выбраны');
  const description = str(req.body.description, 'Описание', false);
  const cat = category(req.body.category, 'Другое');
  const mdate = optDate(req.body.date);
  for (const f of files) await saveFile(req.user!, sid, f, description, cat, mdate);
  res.json({ added: files.length });
}));

// Text messages (from parents, chats, observations) are stored as .txt documents.
app.post('/api/students/:id/messages', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const text = str(req.body.text, 'Текст').slice(0, 60_000);
  const source = str(req.body.source, 'От кого', false);
  const d = optDate(req.body.date);
  const cat = category(req.body.category, 'Сообщение / переписка');
  const title = `${cat}${source ? ` (${source})` : ''} от ${d.split('-').reverse().join('.')}`;
  const stored = crypto.randomBytes(16).toString('hex') + '.txt';
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), text, 'utf8');
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, uploaded_by, kind, extracted_text, extract_status, category, material_date)
     VALUES (?, ?, ?, 'text/plain; charset=utf-8', ?, ?, ?, 'message', ?, 'ok', ?, ?)`,
    sid, `${title}.txt`, stored, Buffer.byteLength(text), source, req.user!.id, text, cat, d,
  );
  const fid = Number(r.lastInsertRowid);
  enqueueMaterial(fid);
  res.json({ id: fid });
}));

app.patch('/api/files/:id', wrap((req, res) => {
  const f = ownedRow(req.user!, 'files', id(req.params.id));
  run('UPDATE files SET category = ?, material_date = ?, description = ? WHERE id = ?',
    category(req.body.category, f.category || 'Другое'), req.body.date ? date(req.body.date) : f.material_date,
    req.body.description !== undefined ? str(req.body.description, 'Описание', false) : f.description, f.id);
  if (req.body.reanalyze) enqueueMaterial(f.id);
  res.json({ ok: true });
}));

app.post('/api/files/:id/reanalyze', wrap((req, res) => {
  const f = ownedRow(req.user!, 'files', id(req.params.id));
  enqueueMaterial(f.id);
  res.json({ ok: true });
}));

// General assessments on the 1–10 scales
app.post('/api/students/:id/assessments', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const scores = cleanScores(req.body.scores);
  if (!Object.keys(scores).length) throw new HttpError(400, 'Поставьте оценку хотя бы по одной шкале');
  const r = run('INSERT INTO assessments (student_id, date, scores, comment, teacher_id) VALUES (?, ?, ?, ?, ?)',
    sid, optDate(req.body.date), JSON.stringify(scores), str(req.body.comment, 'Комментарий', false), req.user!.id);
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.delete('/api/assessments/:id', wrap((req, res) => {
  ownedRow(req.user!, 'assessments', id(req.params.id));
  run('DELETE FROM assessments WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// Goals
const GOAL_KINDS: GoalKind[] = ['subject', 'scale', 'attendance', 'custom', 'exam'];
app.post('/api/students/:id/goals', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const kind = GOAL_KINDS.includes(req.body.kind) ? (req.body.kind as GoalKind) : 'custom';
  const subjectId = kind === 'subject' ? id(req.body.subjectId) : null;
  const scaleKey = kind === 'scale' ? str(req.body.scaleKey, 'Качество') : null;
  if (scaleKey && !SCALES.some((s) => s.key === scaleKey)) throw new HttpError(400, 'Неизвестное качество');
  let target: number | null = null;
  let examId: number | null = null;
  let examLabel = '';
  if (kind === 'exam') {
    examId = id(req.body.examId);
    const exam = getExam(examId);
    if (!exam) throw new HttpError(404, 'Экзамен не найден');
    const want = Number(req.body.target);
    target = primaryForTarget(exam, want);
    if (target == null || !Number.isFinite(target) || target <= 0 || target > exam.maxPrimary) {
      throw new HttpError(400, exam.type === 'oge' ? 'Цель — отметка 3, 4 или 5' : 'Цель не помещается в шкалу этого экзамена');
    }
    examLabel = `${exam.title} — ${exam.type === 'oge' ? `«${want}»` : exam.scale ? `${want} т.б.` : `${want} перв.`}`;
  } else if (kind !== 'custom') {
    target = Number(req.body.target);
    const max = kind === 'scale' ? 10 : 100;
    if (!Number.isFinite(target) || target <= 0 || target > max) throw new HttpError(400, `Целевое значение должно быть от 1 до ${max}`);
  }
  // A goal can be set retroactively: its starting point is measured as of that date.
  const startDate = req.body.startDate ? date(req.body.startDate) : null;
  const start = kind === 'custom' ? null : measure(sid, kind, { subjectId, scaleKey, examId }, undefined, startDate ?? undefined).value;
  const subjectName = subjectId ? get<any>('SELECT name FROM subjects WHERE id = ?', subjectId)?.name : null;
  const scaleLabel = scaleKey ? SCALES.find((s) => s.key === scaleKey)!.label : null;
  const title = str(req.body.title, 'Название', false) || (
    kind === 'exam' ? examLabel : kind === 'subject' ? `${subjectName}: ${target}%` : kind === 'scale' ? `${scaleLabel}: ${target} из 10` : kind === 'attendance' ? `Посещаемость ${target}%` : '');
  if (!title) throw new HttpError(400, 'Поле «Название» обязательно');
  const steps: string[] = (Array.isArray(req.body.steps) ? req.body.steps : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 20);
  const gid = tx(() => {
    const r = run(
      `INSERT INTO goals (student_id, title, kind, subject_id, scale_key, exam_id, start_value, target_value, deadline, note, source, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
      sid, title, kind, subjectId, scaleKey, examId, start, target, req.body.deadline ? date(req.body.deadline) : null,
      str(req.body.note, 'Комментарий', false), req.body.source === 'ai' ? 'ai' : 'teacher', req.user!.id,
      startDate ? `${startDate} 08:00:00` : null,
    );
    const g = Number(r.lastInsertRowid);
    steps.forEach((t, i) => run('INSERT INTO goal_steps (goal_id, text, position) VALUES (?, ?, ?)', g, t, i));
    return g;
  });
  res.json({ id: gid });
}));

app.patch('/api/goals/:id', wrap((req, res) => {
  const g = ownedRow(req.user!, 'goals', id(req.params.id));
  const status = ['active', 'done', 'dropped'].includes(req.body.status) ? req.body.status : g.status;
  const target = req.body.target !== undefined && g.kind !== 'custom' ? Number(req.body.target) : g.target_value;
  if (g.kind !== 'custom' && (!Number.isFinite(target) || target <= 0)) throw new HttpError(400, 'Неверное целевое значение');
  run(
    `UPDATE goals SET title = ?, target_value = ?, deadline = ?, note = ?, status = ?,
       completed_at = CASE WHEN ? = 'done' AND status != 'done' THEN datetime('now') WHEN ? != 'done' THEN NULL ELSE completed_at END
     WHERE id = ?`,
    req.body.title !== undefined ? str(req.body.title, 'Название') : g.title, target,
    req.body.deadline !== undefined ? (req.body.deadline ? date(req.body.deadline) : null) : g.deadline,
    req.body.note !== undefined ? str(req.body.note, 'Комментарий', false) : g.note, status, status, status, g.id,
  );
  res.json(enrichGoal(get('SELECT * FROM goals WHERE id = ?', g.id)));
}));
app.delete('/api/goals/:id', wrap((req, res) => {
  const g = ownedRow(req.user!, 'goals', id(req.params.id));
  run('DELETE FROM goals WHERE id = ?', g.id);
  res.json({ ok: true });
}));

function ownedStep(user: User, stepId: number) {
  const st = get<any>('SELECT gs.*, g.student_id FROM goal_steps gs JOIN goals g ON g.id = gs.goal_id WHERE gs.id = ?', stepId);
  if (!st) throw new HttpError(404, 'Шаг не найден');
  assertStudent(user, st.student_id);
  return st;
}
app.post('/api/goals/:id/steps', wrap((req, res) => {
  const g = ownedRow(req.user!, 'goals', id(req.params.id));
  const pos = get<any>('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM goal_steps WHERE goal_id = ?', g.id).p;
  const r = run('INSERT INTO goal_steps (goal_id, text, position) VALUES (?, ?, ?)', g.id, str(req.body.text, 'Шаг'), pos);
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.patch('/api/goal-steps/:id', wrap((req, res) => {
  const st = ownedStep(req.user!, id(req.params.id));
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : st.done;
  run(`UPDATE goal_steps SET text = ?, done = ?, done_at = CASE WHEN ? = 1 THEN COALESCE(done_at, datetime('now')) ELSE NULL END WHERE id = ?`,
    req.body.text !== undefined ? str(req.body.text, 'Шаг') : st.text, done, done, st.id);
  res.json({ ok: true });
}));
app.delete('/api/goal-steps/:id', wrap((req, res) => {
  const st = ownedStep(req.user!, id(req.params.id));
  run('DELETE FROM goal_steps WHERE id = ?', st.id);
  res.json({ ok: true });
}));

// ---------- Student accounts (issued by staff) ----------
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const translit = (s: string) => s.toLowerCase().split('').map((c) => TRANSLIT[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('');
const readablePassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(8), (b) => abc[b % abc.length]).join('');
};
app.post('/api/students/:id/account', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const st = get<any>('SELECT * FROM students WHERE id = ?', sid);
  const existing = get<any>('SELECT * FROM student_accounts WHERE student_id = ?', sid);
  const password = readablePassword();
  let login = existing?.login;
  if (!login) {
    const [last, first] = st.full_name.split(/\s+/);
    const base = (translit(last || '') + (first ? '.' + translit(first) : '')).replace(/^\.+|\.+$/g, '') || 'student';
    login = base;
    for (let i = 2; get('SELECT 1 FROM student_accounts WHERE login = ?', login) || get('SELECT 1 FROM users WHERE email = ?', login); i++) login = `${base}${i}`;
    run('INSERT INTO student_accounts (student_id, login, password_hash) VALUES (?, ?, ?)', sid, login, hashPassword(password));
  } else {
    run('UPDATE student_accounts SET password_hash = ? WHERE id = ?', hashPassword(password), existing.id);
    run('DELETE FROM student_sessions WHERE student_id = ?', sid);
  }
  res.json({ login, password });
}));
app.delete('/api/students/:id/account', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  run('DELETE FROM student_accounts WHERE student_id = ?', sid);
  run('DELETE FROM student_sessions WHERE student_id = ?', sid);
  res.json({ ok: true });
}));

// ---------- Mentoring ----------
app.get('/api/staff', (_req, res) => res.json(all('SELECT id, name, role FROM users ORDER BY name')));
app.get('/api/mentoring', (req, res) => res.json(mentoringOverview(req.user!.id, req.user!.role === 'admin')));
app.put('/api/students/:id/mentor', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const mid = req.body.mentorId ? id(req.body.mentorId) : null;
  if (mid && !get('SELECT 1 FROM users WHERE id = ?', mid)) throw new HttpError(404, 'Сотрудник не найден');
  run('UPDATE students SET mentor_id = ? WHERE id = ?', mid, sid);
  res.json({ ok: true });
}));
app.post('/api/students/:id/meetings', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const d = optDate(req.body.date);
  const agreements = str(req.body.agreements, 'Договорённости', false);
  const went = str(req.body.wentWell, 'Что получилось', false);
  const hard = str(req.body.difficulties, 'Трудности', false);
  if (!agreements && !went && !hard) throw new HttpError(400, 'Заполните хотя бы одно поле встречи');
  const mentorId = get<any>('SELECT mentor_id FROM students WHERE id = ?', sid)?.mentor_id || req.user!.id;
  const mid = tx(() => {
    const r = run(
      'INSERT INTO mentor_meetings (student_id, mentor_id, date, went_well, difficulties, agreements, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sid, mentorId, d, went, hard, agreements, req.body.nextDate ? date(req.body.nextDate) : null,
    );
    // Agreements → goal steps (one per line): into an existing goal or a new "Договорённости" goal.
    const lines = agreements.split('\n').map((x) => x.replace(/^[-–•\d.)\s]+/, '').trim()).filter(Boolean);
    if (lines.length && req.body.toGoal) {
      let gid: number;
      if (req.body.toGoal === 'new') {
        gid = Number(run(
          `INSERT INTO goals (student_id, title, kind, deadline, source, created_by) VALUES (?, ?, 'custom', ?, 'mentor', ?)`,
          sid, `Договорённости со встречи ${d.split('-').reverse().join('.')}`, req.body.nextDate ? date(req.body.nextDate) : null, req.user!.id,
        ).lastInsertRowid);
      } else {
        gid = id(req.body.toGoal);
        if (!get('SELECT 1 FROM goals WHERE id = ? AND student_id = ?', gid, sid)) throw new HttpError(400, 'Цель не найдена');
      }
      const pos = get<any>('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM goal_steps WHERE goal_id = ?', gid).p;
      lines.forEach((t, i) => run('INSERT INTO goal_steps (goal_id, text, position) VALUES (?, ?, ?)', gid, t, pos + i));
    }
    return Number(r.lastInsertRowid);
  });
  res.json({ id: mid });
}));
app.delete('/api/meetings/:id', wrap((req, res) => {
  const m = ownedRow(req.user!, 'mentor_meetings', id(req.params.id));
  run('DELETE FROM mentor_meetings WHERE id = ?', m.id);
  res.json({ ok: true });
}));
app.post('/api/students/:id/meeting-prep', wrap(async (req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  res.json(await meetingPrep(sid));
}));

// ---------- OGE / EGE ----------
app.get('/api/exams', (_req, res) => res.json(listExams()));
app.post('/api/exams', wrap((req, res) => {
  let cfg;
  try { cfg = cleanExamInput(req.body); } catch (e) { throw new HttpError(400, (e as Error).message); }
  const r = run('INSERT INTO exams (title, type, subject_id, tasks, thresholds, scale, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    str(req.body.title, 'Название'), cfg.type, req.body.subjectId ? id(req.body.subjectId) : null,
    JSON.stringify(cfg.tasks), JSON.stringify(cfg.thresholds), cfg.scale ? JSON.stringify(cfg.scale) : null, req.user!.id);
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.patch('/api/exams/:id', wrap((req, res) => {
  const exam = getExam(id(req.params.id));
  if (!exam) throw new HttpError(404, 'Экзамен не найден');
  if (req.body.archived !== undefined && Object.keys(req.body).length === 1) {
    run('UPDATE exams SET archived = ? WHERE id = ?', req.body.archived ? 1 : 0, exam.id);
    return res.json({ ok: true });
  }
  let cfg;
  try { cfg = cleanExamInput(req.body); } catch (e) { throw new HttpError(400, (e as Error).message); }
  const used = get<any>('SELECT COUNT(*) c FROM mock_results WHERE exam_id = ? AND scores IS NOT NULL', exam.id).c;
  if (used && cfg.tasks.length !== exam.tasks.length) throw new HttpError(400, 'По экзамену уже есть пробники по заданиям — число заданий менять нельзя (создайте новый экзамен)');
  run('UPDATE exams SET title = ?, type = ?, subject_id = ?, tasks = ?, thresholds = ?, scale = ? WHERE id = ?',
    str(req.body.title, 'Название'), cfg.type, req.body.subjectId ? id(req.body.subjectId) : null,
    JSON.stringify(cfg.tasks), JSON.stringify(cfg.thresholds), cfg.scale ? JSON.stringify(cfg.scale) : null, exam.id);
  res.json({ ok: true });
}));
app.delete('/api/exams/:id', wrap((req, res) => {
  const ex = get<any>('SELECT * FROM exams WHERE id = ?', id(req.params.id));
  if (!ex) throw new HttpError(404, 'Экзамен не найден');
  if (req.user!.role !== 'admin' && ex.created_by !== req.user!.id) throw new HttpError(403, 'Удалить экзамен может администрация или автор');
  run('DELETE FROM exams WHERE id = ?', ex.id);
  res.json({ ok: true });
}));

/** Validates one mock result: either per-task scores or only a total. */
function cleanMock(exam: NonNullable<ReturnType<typeof getExam>>, row: any) {
  if (Array.isArray(row.scores) && row.scores.some((v: any) => v !== '' && v != null)) {
    if (row.scores.length !== exam.tasks.length) throw new HttpError(400, 'Число баллов не совпадает с числом заданий');
    const scores = row.scores.map((v: any, i: number) => {
      const n = v === '' || v == null ? 0 : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > exam.tasks[i].max) throw new HttpError(400, `Задание №${i + 1}: от 0 до ${exam.tasks[i].max}`);
      return n;
    });
    return { scores, total: Math.round(scores.reduce((a: number, b: number) => a + b, 0) * 10) / 10 };
  }
  const total = Number(String(row.total ?? '').replace(',', '.'));
  if (row.total === '' || row.total == null || !Number.isFinite(total) || total < 0 || total > exam.maxPrimary) {
    throw new HttpError(400, `Итоговый балл от 0 до ${exam.maxPrimary}`);
  }
  return { scores: null, total };
}

app.post('/api/students/:id/mocks', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const exam = getExam(id(req.body.examId));
  if (!exam) throw new HttpError(404, 'Экзамен не найден');
  const m = cleanMock(exam, req.body);
  const r = run('INSERT INTO mock_results (exam_id, student_id, date, title, scores, total, comment, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    exam.id, sid, optDate(req.body.date), str(req.body.title, 'Название', false), m.scores ? JSON.stringify(m.scores) : null, m.total,
    str(req.body.comment, 'Комментарий', false), req.user!.id);
  res.json({ id: Number(r.lastInsertRowid), prediction: predict(exam, m.total) });
}));
app.delete('/api/mocks/:id', wrap((req, res) => {
  const m = ownedRow(req.user!, 'mock_results', id(req.params.id));
  run('DELETE FROM mock_results WHERE id = ?', m.id);
  res.json({ ok: true });
}));
app.post('/api/classes/:id/mocks/bulk', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const exam = getExam(id(req.body.examId));
  if (!exam) throw new HttpError(404, 'Экзамен не найден');
  const rows: any[] = Array.isArray(req.body.rows) ? req.body.rows : [];
  const clean = rows
    .filter((r) => (Array.isArray(r.scores) && r.scores.some((v: any) => v !== '' && v != null)) || (r.total !== '' && r.total != null))
    .map((r) => {
      const sid = id(r.studentId);
      if (!get('SELECT 1 FROM students WHERE id = ? AND class_id = ?', sid, cid)) throw new HttpError(400, 'Ученик не из этого класса');
      try {
        return { sid, ...cleanMock(exam, r) };
      } catch (e) {
        const name = get<any>('SELECT full_name FROM students WHERE id = ?', sid)?.full_name;
        throw new HttpError(400, `${name}: ${(e as Error).message}`);
      }
    });
  const d = optDate(req.body.date);
  const title = str(req.body.title, 'Название', false);
  tx(() => clean.forEach((m) => run(
    'INSERT INTO mock_results (exam_id, student_id, date, title, scores, total, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    exam.id, m.sid, d, title, m.scores ? JSON.stringify(m.scores) : null, m.total, req.user!.id)));
  res.json({ added: clean.length });
}));
app.get('/api/classes/:id/exams', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const used = all<any>(
    `SELECT DISTINCT m.exam_id FROM mock_results m JOIN students s ON s.id = m.student_id WHERE s.class_id = ?`, cid,
  ).map((r) => r.exam_id);
  res.json({ exams: listExams(), used });
}));
app.get('/api/classes/:id/exams/:examId', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const data = classExam(cid, id(req.params.examId));
  if (!data) throw new HttpError(404, 'Экзамен не найден');
  res.json(data);
}));

app.get('/api/files/:id/text', wrap((req, res) => {
  const f = ownedRow(req.user!, 'files', id(req.params.id));
  res.json({ name: f.original_name, status: f.extract_status, text: f.extracted_text || '' });
}));

app.get('/api/files/:id', wrap((req, res) => {
  const f = ownedRow(req.user!, 'files', id(req.params.id));
  // Uploaded HTML/SVG/XML must never render in our origin — always force a download.
  const dangerous = /html|svg|xml|javascript/i.test(f.mime);
  const disposition = req.query.download || dangerous ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  res.setHeader('Content-Type', dangerous ? 'application/octet-stream' : f.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(UPLOAD_DIR, path.basename(f.stored_name)));
}));

app.delete('/api/files/:id', wrap((req, res) => {
  const f = ownedRow(req.user!, 'files', id(req.params.id));
  run('DELETE FROM files WHERE id = ?', f.id);
  removeFile(f.stored_name);
  res.json({ ok: true });
}));

// Achievements
app.post('/api/students/:id/achievements', upload.single('file'), wrap(async (req, res) => {
  const sid = id(req.params.id);
  try {
    assertStudent(req.user!, sid);
  } catch (e) {
    if (req.file) removeFile(req.file.filename);
    throw e;
  }
  const title = str(req.body.title, 'Название');
  const fileId = req.file ? await saveFile(req.user!, sid, req.file, `Подтверждение: ${title}`, 'Грамота / сертификат', optDate(req.body.date)) : null;
  const r = run(
    `INSERT INTO achievements (student_id, title, category, level, result, date, description, file_id, teacher_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sid, title, str(req.body.category, 'Категория'), str(req.body.level, 'Уровень'), str(req.body.result, 'Результат', false),
    date(req.body.date), str(req.body.description, 'Описание', false), fileId, req.user!.id,
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.delete('/api/achievements/:id', wrap((req, res) => {
  ownedRow(req.user!, 'achievements', id(req.params.id));
  run('DELETE FROM achievements WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// Notes
app.post('/api/students/:id/notes', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  // A past date is allowed: the note is shown and analysed as written on that day.
  const created = req.body.date ? `${date(req.body.date)} 12:00:00` : new Date().toISOString().slice(0, 19).replace('T', ' ');
  const r = run('INSERT INTO notes (student_id, category, text, teacher_id, created_at) VALUES (?, ?, ?, ?, ?)',
    sid, str(req.body.category, 'Категория'), str(req.body.text, 'Текст'), req.user!.id, created);
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.delete('/api/notes/:id', wrap((req, res) => {
  const n = ownedRow(req.user!, 'notes', id(req.params.id));
  if (n.teacher_id !== req.user!.id && req.user!.role !== 'admin') throw new HttpError(403, 'Можно удалять только свои заметки');
  run('DELETE FROM notes WHERE id = ?', n.id);
  res.json({ ok: true });
}));

// AI
app.post('/api/students/:id/analyze', wrap(async (req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const focus = str(req.body.focus, 'Фокус', false).slice(0, 1000);
  const { report, source } = await analyzeStudent(sid, focus);
  const r = run('INSERT INTO ai_reports (student_id, created_by, source, focus, content) VALUES (?, ?, ?, ?, ?)',
    sid, req.user!.id, source, focus, JSON.stringify(report));
  res.json({ id: Number(r.lastInsertRowid), source, report });
}));
app.delete('/api/reports/:id', wrap((req, res) => {
  ownedRow(req.user!, 'ai_reports', id(req.params.id));
  run('DELETE FROM ai_reports WHERE id = ?', id(req.params.id));
  res.json({ ok: true });
}));

// Class analytics
app.get('/api/classes/:id/analytics', wrap((req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  res.json({
    ...classAnalytics(cid),
    reports: all<any>(
      'SELECT r.*, u.name AS author FROM class_reports r LEFT JOIN users u ON u.id = r.created_by WHERE r.class_id = ? ORDER BY r.created_at DESC',
      cid,
    ).map((r) => ({ ...r, content: JSON.parse(r.content) })),
  });
}));
app.post('/api/classes/:id/analyze', wrap(async (req, res) => {
  const cid = id(req.params.id);
  assertClass(req.user!, cid);
  const focus = str(req.body.focus, 'Фокус', false).slice(0, 1000);
  const { report, source } = await analyzeClass(cid, focus);
  const r = run('INSERT INTO class_reports (class_id, created_by, source, focus, content) VALUES (?, ?, ?, ?, ?)',
    cid, req.user!.id, source, focus, JSON.stringify(report));
  res.json({ id: Number(r.lastInsertRowid), report, source });
}));
app.delete('/api/class-reports/:id', wrap((req, res) => {
  const r = get<any>('SELECT * FROM class_reports WHERE id = ?', id(req.params.id));
  if (!r) throw new HttpError(404, 'Запись не найдена');
  assertClass(req.user!, r.class_id);
  run('DELETE FROM class_reports WHERE id = ?', r.id);
  res.json({ ok: true });
}));

app.get('/api/meta', (_req, res) => res.json({ scales: SCALES, categories: MATERIAL_CATEGORIES, markThresholds: MARK_THRESHOLDS }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Не найдено' }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Файл больше 20 МБ' : err.message });
  if (String(err?.message).includes('UNIQUE constraint failed: users.email')) return res.status(400).json({ error: 'Пользователь с таким email уже есть' });
  console.error(err);
  res.status(500).json({ error: err?.message || 'Внутренняя ошибка сервера' });
});

// ---------- Frontend ----------
async function start() {
  if (isProd) {
    const dist = path.resolve('dist');
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  resumePendingMaterials();
  app.listen(PORT, () => {
    console.log(`Сайт запущен: http://localhost:${PORT}`);
    console.log(aiEnabled() ? `ИИ: ${aiProvider()} / ${aiModelName()}` : 'ИИ: ключ не задан — используется анализ по правилам');
  });
}
start();
