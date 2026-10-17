import { describe, expect, it } from "vitest";
import { scoreByDimension, toolVerdict, type ScoringCriterion } from "@/lib/scoring";

const criteria: ScoringCriterion[] = [
  { id: "acc", dimension: "TECHNICAL", weight: 5, scaleMax: 5 },
  { id: "rel", dimension: "TECHNICAL", weight: 1, scaleMax: 5 },
  { id: "ux", dimension: "INTERFACE", weight: 2, scaleMax: 5 },
];

describe("scoreByDimension", () => {
  it("считает взвешенный процент отдельно по каждому измерению", () => {
    const scores = scoreByDimension("t", criteria, [
      { toolId: "t", criterionId: "acc", score: 1 },
      { toolId: "t", criterionId: "rel", score: 5 },
      { toolId: "t", criterionId: "ux", score: 5 },
    ]);
    expect(scores.find((s) => s.dimension === "TECHNICAL")).toMatchObject({ percent: 33, coverage: 1 });
    expect(scores.find((s) => s.dimension === "INTERFACE")).toMatchObject({ percent: 100, coverage: 1 });
  });

  it("сообщает о неполном покрытии и игнорирует чужие инструменты", () => {
    const scores = scoreByDimension("t", criteria, [
      { toolId: "t", criterionId: "acc", score: 5 },
      { toolId: "other", criterionId: "rel", score: 0 },
    ]);
    const tech = scores.find((s) => s.dimension === "TECHNICAL")!;
    expect(tech.percent).toBe(100);
    expect(tech.coverage).toBeCloseTo(5 / 6);
    expect(scores.find((s) => s.dimension === "INTERFACE")!.percent).toBeNull();
  });
});

describe("toolVerdict", () => {
  it("критическая ошибка не компенсируется высокими оценками", () => {
    expect(toolVerdict(1, [{ dimension: "INTERFACE", percent: 100, coverage: 1 }])).toBe("critical");
    expect(toolVerdict(0, [{ dimension: "INTERFACE", percent: 100, coverage: 0.5 }])).toBe("incomplete");
    expect(toolVerdict(0, [{ dimension: "INTERFACE", percent: 40, coverage: 1 }])).toBe("ok");
  });
});
