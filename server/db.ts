import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'school.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  year TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS class_teachers (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  interests TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  kind TEXT NOT NULL DEFAULT 'Работа на уроке',
  date TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','sick','excused')),
  comment TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
`);

// Migrations for databases created by earlier versions.
function addColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumn('files', 'kind', "kind TEXT NOT NULL DEFAULT 'file'");
addColumn('files', 'extracted_text', 'extracted_text TEXT');
addColumn('files', 'extract_status', 'extract_status TEXT');
addColumn('files', 'category', 'category TEXT');
addColumn('files', 'material_date', 'material_date TEXT');
addColumn('files', 'ai_status', 'ai_status TEXT');
addColumn('files', 'ai_summary', 'ai_summary TEXT');
addColumn('files', 'ai_scores', 'ai_scores TEXT');
addColumn('files', 'ai_tags', 'ai_tags TEXT');
addColumn('files', 'ai_error', 'ai_error TEXT');
addColumn('grades', 'percent', 'percent REAL');
addColumn('grades', 'score', 'score REAL');
addColumn('grades', 'max_score', 'max_score REAL');
db.exec('UPDATE grades SET percent = value * 20 WHERE percent IS NULL');

db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('subject','scale','attendance','custom')),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  scale_key TEXT,
  start_value REAL,
  target_value REAL,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','dropped')),
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'teacher',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_student ON goals(student_id, status);
CREATE TABLE IF NOT EXISTS goal_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  done_at TEXT
);
`);

// Goals: allow the 'exam' kind (SQLite can't alter a CHECK constraint, so rebuild the table once).
{
  const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'goals'").get() as { sql: string }).sql;
  if (!sql.includes("'exam'")) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      BEGIN;
      CREATE TABLE goals_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('subject','scale','attendance','custom','exam')),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        scale_key TEXT,
        exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL,
        start_value REAL,
        target_value REAL,
        deadline TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','dropped')),
        note TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'teacher',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );
      INSERT INTO goals_new (id, student_id, title, kind, subject_id, scale_key, start_value, target_value, deadline, status, note, source, created_by, created_at, completed_at)
        SELECT id, student_id, title, kind, subject_id, scale_key, start_value, target_value, deadline, status, note, source, created_by, created_at, completed_at FROM goals;
      DROP TABLE goals;
      ALTER TABLE goals_new RENAME TO goals;
      CREATE INDEX IF NOT EXISTS idx_goals_student ON goals(student_id, status);
      COMMIT;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
}

db.exec(`
-- OGE / EGE tracker
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('oge','ege')),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  tasks TEXT NOT NULL,          -- JSON [{ n, max, topic }]
  thresholds TEXT NOT NULL,     -- JSON: OGE {"3":min,"4":min,"5":min} (primary); EGE {"pass":minTest}
  scale TEXT,                   -- JSON array: EGE primary -> test score (index = primary)
  archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mock_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  scores TEXT,                  -- JSON array of points per task (null = only total known)
  total REAL NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mock_student ON mock_results(student_id, exam_id, date);

-- Mentoring
CREATE TABLE IF NOT EXISTS mentor_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  went_well TEXT NOT NULL DEFAULT '',
  difficulties TEXT NOT NULL DEFAULT '',
  agreements TEXT NOT NULL DEFAULT '',
  next_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meet_student ON mentor_meetings(student_id, date);

-- Student cabinet (separate from staff accounts)
CREATE TABLE IF NOT EXISTS student_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS student_sessions (
  token TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS self_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  scores TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
addColumn('files', 'by_student', 'by_student INTEGER NOT NULL DEFAULT 0');
addColumn('students', 'mentor_id', 'mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL');

db.exec(`
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  scores TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assess_student ON assessments(student_id, date);

CREATE TABLE IF NOT EXISTS class_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const subjectCount = db.prepare('SELECT COUNT(*) AS c FROM subjects').get() as { c: number };
if (subjectCount.c === 0) {
  const ins = db.prepare('INSERT INTO subjects (name) VALUES (?)');
  for (const s of [
    'Русский язык', 'Литература', 'Математика', 'Алгебра', 'Геометрия', 'Информатика',
    'Физика', 'Химия', 'Биология', 'География', 'История', 'Обществознание',
    'Английский язык', 'Физкультура', 'Музыка', 'ИЗО', 'Технология',
  ]) ins.run(s);
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
}
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
