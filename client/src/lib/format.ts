export const ATTENDANCE: Record<string, { label: string; short: string; cls: string }> = {
  present: { label: 'Присутствовал', short: '✓', cls: 'bg-emerald-100 text-emerald-700' },
  late: { label: 'Опоздал', short: 'ОП', cls: 'bg-amber-100 text-amber-700' },
  absent: { label: 'Отсутствовал', short: 'Н', cls: 'bg-rose-100 text-rose-700' },
  sick: { label: 'Болел', short: 'Б', cls: 'bg-sky-100 text-sky-700' },
  excused: { label: 'Уважительная', short: 'УП', cls: 'bg-violet-100 text-violet-700' },
};

export const ACH_CATEGORIES = ['Олимпиада', 'Конкурс', 'Спорт', 'Творчество', 'Проект', 'Научная работа', 'Волонтёрство', 'Другое'];
export const ACH_LEVELS = ['Школьный', 'Муниципальный', 'Региональный', 'Всероссийский', 'Международный'];
export const NOTE_CATEGORIES = ['Учёба', 'Поведение', 'Интересы', 'Социальное', 'Здоровье', 'Другое'];
export const GRADE_KINDS = ['Работа на уроке', 'Домашнее задание', 'Самостоятельная работа', 'Контрольная работа', 'Проект', 'Устный ответ', 'Тест'];

/** Local calendar date (not UTC) as YYYY-MM-DD — after midnight in Moscow UTC would still say "yesterday". */
export const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => localISO(new Date());
export const daysFromToday = (n: number) => localISO(new Date(Date.now() + n * 864e5));

export function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s.replace(' ', 'T') + (s.includes('T') || s.length === 10 ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtSize(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

export function gradeColor(v: number | null | undefined) {
  if (v == null) return 'text-slate-400';
  if (v >= 4.5) return 'text-emerald-600';
  if (v >= 3.5) return 'text-indigo-600';
  if (v >= 3) return 'text-amber-600';
  return 'text-rose-600';
}

export function gradeBg(v: number) {
  return v === 5 ? 'bg-emerald-500' : v === 4 ? 'bg-indigo-500' : v === 3 ? 'bg-amber-500' : 'bg-rose-500';
}

export const RISK: Record<string, { label: string; cls: string }> = {
  high: { label: 'Нужна поддержка', cls: 'bg-rose-100 text-rose-700' },
  medium: { label: 'Под наблюдением', cls: 'bg-amber-100 text-amber-700' },
  low: { label: 'Всё хорошо', cls: 'bg-emerald-100 text-emerald-700' },
};

// ---------- Percent-based grades ----------
export const markFromPercent = (p: number) => (p >= 85 ? 5 : p >= 65 ? 4 : p >= 45 ? 3 : p >= 20 ? 2 : 1);

/** Text colour for a percent value. */
export function pctText(p: number | null | undefined) {
  if (p == null) return 'text-slate-400';
  if (p >= 85) return 'text-emerald-700';
  if (p >= 65) return 'text-brand-700';
  if (p >= 45) return 'text-amber-700';
  return 'text-rose-700';
}
/** Bar/fill colour for a percent value. */
export function pctFill(p: number | null | undefined) {
  if (p == null) return 'bg-slate-300';
  if (p >= 85) return 'bg-emerald-500';
  if (p >= 65) return 'bg-brand-500';
  if (p >= 45) return 'bg-amber-400';
  return 'bg-rose-500';
}
export const pctHex = (p: number | null | undefined) =>
  p == null ? '#cdbfab' : p >= 85 ? '#6b8d47' : p >= 65 ? '#4f8a6d' : p >= 45 ? '#d39e45' : '#bc5b42';
export const fmtPct = (p: number | null | undefined) => (p == null ? '—' : `${Math.round(p)}%`);
