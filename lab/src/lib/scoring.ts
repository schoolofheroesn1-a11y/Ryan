import type { CriterionDimension } from "@prisma/client";

export type ScoringCriterion = {
  id: string;
  dimension: CriterionDimension;
  weight: number;
  scaleMax: number;
};

export type ScoringResult = { toolId: string; criterionId: string; score: number | null };

export type DimensionScore = {
  dimension: CriterionDimension;
  /** Взвешенная оценка 0–100 по оценённым критериям или null, если оценок нет. */
  percent: number | null;
  /** Доля веса критериев, которые реально оценены (0–1). */
  coverage: number;
};

/**
 * Считает оценки отдельно по каждому измерению. Единый итоговый балл
 * намеренно не вычисляется: высокая оценка удобства не должна маскировать
 * проблемы с точностью или педагогической ценностью.
 */
export function scoreByDimension(
  toolId: string,
  criteria: ScoringCriterion[],
  results: ScoringResult[],
): DimensionScore[] {
  const byDimension = new Map<CriterionDimension, ScoringCriterion[]>();
  for (const c of criteria) {
    const list = byDimension.get(c.dimension) ?? [];
    list.push(c);
    byDimension.set(c.dimension, list);
  }
  const out: DimensionScore[] = [];
  for (const [dimension, list] of byDimension) {
    let totalWeight = 0;
    let ratedWeight = 0;
    let sum = 0;
    for (const c of list) {
      totalWeight += c.weight;
      const r = results.find((x) => x.toolId === toolId && x.criterionId === c.id);
      if (r?.score == null) continue;
      const clamped = Math.max(0, Math.min(c.scaleMax, r.score));
      ratedWeight += c.weight;
      sum += (clamped / c.scaleMax) * c.weight;
    }
    out.push({
      dimension,
      percent: ratedWeight > 0 ? Math.round((sum / ratedWeight) * 100) : null,
      coverage: totalWeight > 0 ? ratedWeight / totalWeight : 0,
    });
  }
  return out;
}

export type ToolVerdict = "critical" | "incomplete" | "ok";

/** Критическая ошибка всегда побеждает любые высокие оценки. */
export function toolVerdict(criticalIssues: number, dimensionScores: DimensionScore[]): ToolVerdict {
  if (criticalIssues > 0) return "critical";
  if (dimensionScores.some((d) => d.coverage < 1)) return "incomplete";
  return "ok";
}
