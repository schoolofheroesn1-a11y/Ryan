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

export const today = () => new Date().toISOString().slice(0, 10);

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
