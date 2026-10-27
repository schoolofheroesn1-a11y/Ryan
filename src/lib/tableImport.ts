import readXlsxFile from 'read-excel-file/browser';
import { AssignmentStatus, GradeCategory } from '../types';

export interface ParsedTable {
  columns: string[];
  rows: string[][];
}

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF line endings)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  // Excel in many locales exports ';'-separated "CSV"; pick whichever separator the header line uses most
  const firstLine = src.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).trim();
}

// Reads a .csv / .xlsx file into a header row + data rows, dropping fully empty rows
export async function parseTableFile(file: File): Promise<ParsedTable> {
  const lower = file.name.toLowerCase();
  let grid: string[][];

  if (lower.endsWith('.xlsx')) {
    const sheets = await readXlsxFile(file);
    const first = sheets[0];
    grid = (first?.data || []).map((r) => r.map(cellToString));
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
    grid = parseCsv(await file.text()).map((r) => r.map((c) => c.trim()));
  } else {
    throw new Error('Please upload a .csv or .xlsx file (older .xls files: use "Save As" → .xlsx first).');
  }

  const nonEmpty = grid.filter((r) => r.some((c) => c !== ''));
  if (nonEmpty.length === 0) throw new Error('The file appears to be empty.');

  const [header, ...body] = nonEmpty;
  const width = Math.max(header.length, ...body.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => header[i] || `Column ${i + 1}`);
  const rows = body.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Gradebook (tasks & exams) import
// ---------------------------------------------------------------------------

export interface GradebookRow {
  rowNumber: number;
  studentName?: string;
  subjectName: string;
  title: string;
  category: GradeCategory;
  score: number | null;
  maxScore: number;
  weight: number;
  dueDate: string;
  status: AssignmentStatus;
  feedback?: string;
}

export interface GradebookParseResult {
  rows: GradebookRow[];
  errors: string[];
  hasStudentColumn: boolean;
}

const HEADER_ALIASES: Record<keyof Omit<GradebookRow, 'rowNumber'>, string[]> = {
  studentName: ['student', 'student name', 'name', 'pupil', 'learner', 'student id'],
  subjectName: ['subject', 'course', 'class', 'subject name'],
  title: ['title', 'task', 'assignment', 'exam', 'assessment', 'task name', 'assignment name', 'exam name'],
  category: ['type', 'category', 'kind'],
  score: ['score', 'mark', 'marks', 'points', 'result', 'grade'],
  maxScore: ['max', 'max score', 'out of', 'total', 'max marks', 'total marks', 'possible', 'max points'],
  weight: ['weight', 'weight %', 'weighting'],
  dueDate: ['due', 'due date', 'date', 'exam date'],
  status: ['status', 'state'],
  feedback: ['feedback', 'comment', 'comments', 'notes', 'remarks'],
};

const CATEGORY_ALIASES: Record<string, GradeCategory> = {
  homework: 'Homework',
  hw: 'Homework',
  task: 'Homework',
  assignment: 'Homework',
  classwork: 'Homework',
  quiz: 'Quiz',
  test: 'Exam',
  exam: 'Exam',
  midterm: 'Exam',
  final: 'Exam',
  project: 'Project',
  lab: 'Lab',
  practical: 'Lab',
};

const DEFAULT_WEIGHT: Record<GradeCategory, number> = {
  Homework: 15,
  Quiz: 20,
  Lab: 20,
  Project: 25,
  Exam: 40,
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_*:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Excel serial dates exported as plain numbers
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const d = new Date(Math.round((Number(raw) - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : parsed.toISOString().split('T')[0];
}

export function mapGradebookTable(table: ParsedTable): GradebookParseResult {
  const colIndex: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  table.columns.forEach((col, idx) => {
    const norm = normalizeHeader(col);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
      if (colIndex[field] === undefined && aliases.includes(norm)) {
        colIndex[field] = idx;
        break;
      }
    }
  });

  const errors: string[] = [];
  if (colIndex.title === undefined) errors.push('Missing a "Title" (or Task / Assignment / Exam) column.');
  if (colIndex.subjectName === undefined) errors.push('Missing a "Subject" (or Course / Class) column.');
  if (errors.length) return { rows: [], errors, hasStudentColumn: false };

  const get = (r: string[], f: keyof typeof HEADER_ALIASES) =>
    colIndex[f] !== undefined ? (r[colIndex[f]!] || '').trim() : '';

  const rows: GradebookRow[] = [];
  table.rows.forEach((r, i) => {
    const rowNumber = i + 2; // +1 for header, +1 for 1-based
    const title = get(r, 'title');
    const subjectName = get(r, 'subjectName');
    if (!title && !subjectName) return;
    if (!title || !subjectName) {
      errors.push(`Row ${rowNumber}: needs both a subject and a title — skipped.`);
      return;
    }

    const rawCategory = get(r, 'category').toLowerCase();
    const category: GradeCategory =
      CATEGORY_ALIASES[rawCategory] || (/exam|test/i.test(title) ? 'Exam' : 'Homework');

    const rawScore = get(r, 'score').replace('%', '');
    let rawMax = get(r, 'maxScore');
    // Allow "45/50" style scores in a single column
    let scoreText = rawScore;
    if (/^\s*[\d.]+\s*\/\s*[\d.]+\s*$/.test(rawScore)) {
      const [s, m] = rawScore.split('/');
      scoreText = s.trim();
      rawMax = rawMax || m.trim();
    }
    const score = scoreText === '' ? null : Number(scoreText);
    if (score !== null && isNaN(score)) {
      errors.push(`Row ${rowNumber}: score "${rawScore}" is not a number — skipped.`);
      return;
    }
    const maxScore = rawMax ? Number(rawMax) : 100;
    if (isNaN(maxScore) || maxScore <= 0) {
      errors.push(`Row ${rowNumber}: max score "${rawMax}" is invalid — skipped.`);
      return;
    }

    const rawWeight = get(r, 'weight').replace('%', '');
    const weight = rawWeight && !isNaN(Number(rawWeight)) ? Number(rawWeight) : DEFAULT_WEIGHT[category];

    const rawStatus = get(r, 'status').toLowerCase();
    let status: AssignmentStatus;
    if (rawStatus.startsWith('miss')) status = 'Missing';
    else if (rawStatus.startsWith('late')) status = 'Late';
    else if (rawStatus.startsWith('pend') || rawStatus.startsWith('upcoming') || rawStatus.startsWith('todo')) status = 'Pending';
    else if (rawStatus.startsWith('grad') || rawStatus.startsWith('done') || rawStatus.startsWith('complete')) status = 'Graded';
    else status = score !== null ? 'Graded' : 'Pending';

    rows.push({
      rowNumber,
      studentName: get(r, 'studentName') || undefined,
      subjectName,
      title,
      category,
      score,
      maxScore,
      weight,
      dueDate: normalizeDate(get(r, 'dueDate')),
      status,
      feedback: get(r, 'feedback') || undefined,
    });
  });

  return { rows, errors, hasStudentColumn: colIndex.studentName !== undefined };
}

export const GRADEBOOK_TEMPLATE_CSV = [
  'Student,Subject,Title,Type,Score,Max Score,Weight,Due Date,Status,Feedback',
  'Leo Vance,Advanced Algebra,Chapter 4 Worksheet,Homework,27,30,15,2026-10-02,Graded,Neat working shown',
  'Leo Vance,Advanced Algebra,Unit 2 Exam,Exam,88,100,40,2026-10-10,Graded,Strong on factoring',
  'Leo Vance,Life Science & Biology,Cell Diagram Project,Project,,50,25,2026-11-05,Pending,',
].join('\n');

export const PROGRESS_TABLE_TEMPLATE_CSV = [
  'Week,Books Read,Minutes Read,Reading Level,Teacher Comment',
  'Week 1,1,120,Level 12,Good start',
  'Week 2,2,180,Level 12,Reading more consistently',
  'Week 3,1,150,Level 13,Moved up a level!',
].join('\n');

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
