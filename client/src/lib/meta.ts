import { useEffect, useState } from 'react';
import { api } from './api';

export interface Scale { key: string; label: string; hint: string }
export interface Meta { scales: Scale[]; categories: string[] }

export const SCALE_COLORS: Record<string, string> = {
  motivation: '#6366f1',
  independence: '#0ea5e9',
  responsibility: '#10b981',
  communication: '#f59e0b',
  wellbeing: '#ec4899',
  curiosity: '#8b5cf6',
};

export const CATEGORY_STYLE: Record<string, { emoji: string; cls: string }> = {
  'Рефлексия ученика': { emoji: '💭', cls: 'bg-violet-50 text-violet-700' },
  'Характеристика': { emoji: '📋', cls: 'bg-indigo-50 text-indigo-700' },
  'Работа ученика': { emoji: '✏️', cls: 'bg-sky-50 text-sky-700' },
  'Сообщение / переписка': { emoji: '💬', cls: 'bg-emerald-50 text-emerald-700' },
  'Наблюдение учителя': { emoji: '👀', cls: 'bg-amber-50 text-amber-700' },
  'Отчёт / протокол': { emoji: '📑', cls: 'bg-slate-100 text-slate-700' },
  'Грамота / сертификат': { emoji: '🏆', cls: 'bg-yellow-50 text-yellow-700' },
  'Другое': { emoji: '📎', cls: 'bg-slate-100 text-slate-600' },
};

let cache: Promise<Meta> | null = null;
export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    cache ||= api.get<Meta>('/api/meta');
    cache.then(setMeta).catch(() => { cache = null; });
  }, []);
  return meta;
}

export function monthLabel(m: string) {
  const d = new Date(m + '-01T00:00:00');
  return isNaN(d.getTime()) ? m : d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

export function scoreColor(v: number | null | undefined) {
  if (v == null) return 'bg-slate-100 text-slate-400';
  if (v >= 8) return 'bg-emerald-100 text-emerald-700';
  if (v >= 6) return 'bg-sky-100 text-sky-700';
  if (v >= 4) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}
