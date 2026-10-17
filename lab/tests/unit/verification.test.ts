import { describe, expect, it } from "vitest";
import { checkVerificationRequirements, type VerificationContext } from "@/lib/verification";

const base: VerificationContext = {
  isDemo: false,
  authorId: "author",
  testReport: "",
  limitations: "",
  practiceReviewAuthorIds: [],
  research: null,
};

describe("checkVerificationRequirements", () => {
  it("всегда разрешает «Не тестировалось» и «Требует повторной проверки»", () => {
    expect(checkVerificationRequirements("NOT_TESTED", base)).toEqual([]);
    expect(checkVerificationRequirements("NEEDS_RECHECK", { ...base, isDemo: true })).toEqual([]);
  });

  it("«Проверено автором» требует описания проверки и ограничений", () => {
    expect(checkVerificationRequirements("AUTHOR_TESTED", base)).toHaveLength(2);
    const ok = { ...base, testReport: "x".repeat(80), limitations: "Нужны устройства" };
    expect(checkVerificationRequirements("AUTHOR_TESTED", ok)).toEqual([]);
    expect(checkVerificationRequirements("AUTHOR_TESTED", { ...ok, isDemo: true })).toHaveLength(1);
  });

  it("«Несколько педагогов» не учитывает отзыв автора и повторы", () => {
    const ctx = { ...base, practiceReviewAuthorIds: ["author", "u1", "u1"] };
    expect(checkVerificationRequirements("MULTI_TEACHER", ctx)).toHaveLength(1);
    expect(checkVerificationRequirements("MULTI_TEACHER", { ...base, practiceReviewAuthorIds: ["u1", "u2"] })).toEqual([]);
  });

  it("«Независимое подтверждение» отклоняет исследование автора, учебный пример и незафиксированные критерии", () => {
    expect(checkVerificationRequirements("INDEPENDENT", base)).toHaveLength(1);
    const research = { status: "PUBLISHED", authorId: "author", isDemo: true, criteriaLocked: false };
    expect(checkVerificationRequirements("INDEPENDENT", { ...base, research })).toHaveLength(3);
    const good = { status: "PUBLISHED", authorId: "lab", isDemo: false, criteriaLocked: true };
    expect(checkVerificationRequirements("INDEPENDENT", { ...base, research: good })).toEqual([]);
  });
});
