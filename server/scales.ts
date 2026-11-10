/** Scales for "general assessments" (1–10). Teachers rate them; the AI also infers them from each material. */
export const SCALES = [
  { key: 'motivation', label: 'Мотивация', hint: 'интерес к учёбе, желание стараться' },
  { key: 'independence', label: 'Самостоятельность', hint: 'умение работать без подсказок, планировать' },
  { key: 'responsibility', label: 'Ответственность', hint: 'выполнение обещаний и заданий, пунктуальность' },
  { key: 'communication', label: 'Общение', hint: 'сотрудничество, отношения с одноклассниками и взрослыми' },
  { key: 'wellbeing', label: 'Эмоциональное благополучие', hint: 'настроение, уверенность, тревожность (10 — всё отлично)' },
  { key: 'curiosity', label: 'Любознательность', hint: 'инициатива, творчество, интерес к новому' },
] as const;

export type ScaleKey = (typeof SCALES)[number]['key'];
export const SCALE_KEYS = SCALES.map((s) => s.key) as ScaleKey[];

export const MATERIAL_CATEGORIES = [
  'Рефлексия ученика',
  'Характеристика',
  'Работа ученика',
  'Сообщение / переписка',
  'Наблюдение учителя',
  'Отчёт / протокол',
  'Грамота / сертификат',
  'Другое',
];

/** Keeps only known scale keys with integer values 1–10. */
export function cleanScores(input: any): Partial<Record<ScaleKey, number>> {
  const out: Partial<Record<ScaleKey, number>> = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of SCALE_KEYS) {
    const v = Number(input[k]);
    if (Number.isFinite(v) && v >= 1 && v <= 10) out[k] = Math.round(v);
  }
  return out;
}
