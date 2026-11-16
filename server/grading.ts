/**
 * Grades are stored both as a mark (1–5) and as a percent (0–100).
 * A teacher can enter a mark, a percent or points ("17 of 20"); the rest is derived.
 */
export const MARK_THRESHOLDS = { 5: 85, 4: 65, 3: 45, 2: 20 } as const;

export function percentToMark(p: number): number {
  if (p >= MARK_THRESHOLDS[5]) return 5;
  if (p >= MARK_THRESHOLDS[4]) return 4;
  if (p >= MARK_THRESHOLDS[3]) return 3;
  if (p >= MARK_THRESHOLDS[2]) return 2;
  return 1;
}

/** A mark without a known percent counts as: 5 → 100%, 4 → 80%, 3 → 60%, 2 → 40%, 1 → 20%. */
export function markToPercent(m: number): number {
  return Math.max(0, Math.min(100, m * 20));
}

export interface GradeInput { value?: unknown; percent?: unknown; score?: unknown; max?: unknown }
export interface NormalizedGrade { value: number; percent: number; score: number | null; max: number | null }

/** Returns null when nothing valid was entered. */
export function normalizeGrade(g: GradeInput): NormalizedGrade | null {
  const num = (v: unknown) => (v === '' || v == null ? NaN : Number(String(v).replace(',', '.')));
  const score = num(g.score);
  const max = num(g.max);
  if (Number.isFinite(score) && Number.isFinite(max) && max > 0 && score >= 0 && score <= max) {
    const percent = Math.round((score / max) * 1000) / 10;
    return { value: percentToMark(percent), percent, score, max };
  }
  const percent = num(g.percent);
  if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
    const p = Math.round(percent * 10) / 10;
    return { value: percentToMark(p), percent: p, score: null, max: null };
  }
  const value = num(g.value);
  if (Number.isInteger(value) && value >= 1 && value <= 5) return { value, percent: markToPercent(value), score: null, max: null };
  return null;
}
