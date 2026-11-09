import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, tx, UPLOAD_DIR } from './db';
import {
  accessibleClassIds, canAccessClass, canAccessStudent, createSession, destroySession,
  hashPassword, loadUser, requireAdmin, requireAuth, verifyPassword, type User,
} from './auth';
import { computeStudentStats } from './stats';
import { extractText } from './extract';
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
  const email = str(req.body.email, 'Email');
  const password = str(req.body.password, 'Пароль');
  const u = get<any>('SELECT * FROM users WHERE email = ?', email);
  if (!u || !verifyPassword(password, u.password_hash)) throw new HttpError(401, 'Неверный email или пароль');
  run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString());
  createSession(res, u.id);
  res.json({ ok: true });
}));

app.post('/api/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null });
});

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
        attendanceRate: st.attendance.rate,
        achievements: st.achievementsCount,
        risk: st.risk,
        riskReasons: st.riskReasons,
      };
    }),
  });
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
  const items: { studentId: number; value: number }[] = Array.isArray(req.body.grades) ? req.body.grades : [];
  let added = 0;
  tx(() => {
    for (const it of items) {
      const v = Number(it.value);
      if (!(v >= 1 && v <= 5)) continue;
      const sid = id(it.studentId);
      if (!get('SELECT 1 FROM students WHERE id = ? AND class_id = ?', sid, cid)) continue;
      run('INSERT INTO grades (student_id, subject_id, value, kind, date, teacher_id) VALUES (?, ?, ?, ?, ?, ?)', sid, subjectId, Math.round(v), kind, d, req.user!.id);
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
    .map((s) => ({ ...s, ...(({ risk, riskReasons, average }) => ({ risk, riskReasons, average }))(computeStudentStats(s.id)) }))
    .filter((s) => s.risk === 'high')
    .slice(0, 12);
  const recentAchievements = all<any>(
    `SELECT a.id, a.title, a.level, a.result, a.date, s.id AS student_id, s.full_name FROM achievements a
     JOIN students s ON s.id = a.student_id WHERE s.class_id IN (${placeholders}) ORDER BY a.date DESC LIMIT 8`,
    ...classIds,
  );
  res.json({
    totals: {
      classes: classes.length,
      students: students.length,
      teachers: user.role === 'admin' ? get<any>("SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'")!.c : null,
    },
    classes,
    atRisk,
    recentAchievements,
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
    files: all(
      `SELECT f.id, f.student_id, f.original_name, f.mime, f.size, f.description, f.kind, f.extract_status, f.created_at,
       LENGTH(f.extracted_text) AS text_length, u.name AS uploader
       FROM files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.student_id = ? ORDER BY f.created_at DESC`, sid),
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
  const v = Number(req.body.value);
  if (!Number.isInteger(v) || v < 1 || v > 5) throw new HttpError(400, 'Оценка должна быть от 1 до 5');
  const r = run(
    'INSERT INTO grades (student_id, subject_id, value, kind, date, comment, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sid, id(req.body.subjectId), v, str(req.body.kind, 'Тип', false) || 'Работа на уроке', date(req.body.date),
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
async function saveFile(user: User, studentId: number, f: Express.Multer.File, description: string) {
  const name = fileName(f);
  const { text, status } = await extractText(path.join(UPLOAD_DIR, f.filename), name, f.mimetype);
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, uploaded_by, kind, extracted_text, extract_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'file', ?, ?)`,
    studentId, name, f.filename, f.mimetype, f.size, description, user.id, text || null, status,
  );
  return Number(r.lastInsertRowid);
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
  for (const f of files) await saveFile(req.user!, sid, f, description);
  res.json({ added: files.length });
}));

// Text messages (from parents, chats, observations) are stored as .txt documents.
app.post('/api/students/:id/messages', wrap((req, res) => {
  const sid = id(req.params.id);
  assertStudent(req.user!, sid);
  const text = str(req.body.text, 'Текст сообщения').slice(0, 60_000);
  const source = str(req.body.source, 'От кого', false);
  const d = req.body.date ? date(req.body.date) : new Date().toISOString().slice(0, 10);
  const title = `Сообщение${source ? ` (${source})` : ''} от ${d.split('-').reverse().join('.')}`;
  const stored = crypto.randomBytes(16).toString('hex') + '.txt';
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), text, 'utf8');
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, uploaded_by, kind, extracted_text, extract_status)
     VALUES (?, ?, ?, 'text/plain; charset=utf-8', ?, ?, ?, 'message', ?, 'ok')`,
    sid, `${title}.txt`, stored, Buffer.byteLength(text), source, req.user!.id, text,
  );
  res.json({ id: Number(r.lastInsertRowid) });
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
  const fileId = req.file ? await saveFile(req.user!, sid, req.file, `Подтверждение: ${title}`) : null;
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
  const r = run('INSERT INTO notes (student_id, category, text, teacher_id) VALUES (?, ?, ?, ?)',
    sid, str(req.body.category, 'Категория'), str(req.body.text, 'Текст'), req.user!.id);
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
  app.listen(PORT, () => {
    console.log(`Сайт запущен: http://localhost:${PORT}`);
    console.log(aiEnabled() ? `ИИ: ${aiProvider()} / ${aiModelName()}` : 'ИИ: ключ не задан — используется анализ по правилам');
  });
}
start();
