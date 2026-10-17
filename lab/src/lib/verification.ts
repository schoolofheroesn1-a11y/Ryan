import type { VerificationStatus } from "@prisma/client";

/**
 * Критерии статусов проверки. Тексты публикуются на странице «Методика»,
 * а функция checkVerificationRequirements применяет их на сервере при
 * каждой попытке изменить статус. Статус никогда не присваивается
 * автоматически — его меняет редактор, но система не даст выбрать статус,
 * условия которого не выполнены.
 */
export const verificationCriteria: Record<VerificationStatus, { summary: string; requirements: string[] }> = {
  NOT_TESTED: {
    summary: "Решение описано, но его практическое применение не подтверждено.",
    requirements: ["Статус по умолчанию для любой новой публикации."],
  },
  AUTHOR_TESTED: {
    summary: "Автор применил решение сам и описал, как именно.",
    requirements: [
      "Заполнен раздел «Как автор проверял решение»: где, с кем и когда применялось, что получилось и что пришлось исправить (не короче 80 символов).",
      "Указаны ограничения решения.",
      "Материал не является демонстрационным примером.",
    ],
  },
  MULTI_TEACHER: {
    summary: "Решение применили на практике как минимум два педагога, кроме автора.",
    requirements: [
      "Есть не менее двух опубликованных отзывов от разных пользователей (не автора), отметивших, что применяли решение на практике, и описавших контекст применения.",
      "Отзывы прошли модерацию.",
      "Материал не является демонстрационным примером.",
    ],
  },
  INDEPENDENT: {
    summary: "Решение проверено в испытании лаборатории, которое провёл не автор материала.",
    requirements: [
      "К материалу привязано опубликованное исследование лаборатории.",
      "Автор исследования не является автором материала.",
      "Исследование не является учебным примером, его критерии были зафиксированы до внесения результатов.",
    ],
  },
  NEEDS_RECHECK: {
    summary: "Есть основания считать, что прежняя проверка устарела.",
    requirements: [
      "Можно назначить в любой момент, например после обновления инструмента или подтверждённой жалобы. Редактор указывает причину.",
    ],
  },
};

export type VerificationContext = {
  isDemo: boolean;
  authorId: string;
  testReport: string;
  limitations: string;
  practiceReviewAuthorIds: string[]; // авторы одобренных отзывов с отметкой «применял»
  research: {
    status: string;
    authorId: string;
    isDemo: boolean;
    criteriaLocked: boolean;
  } | null;
};

/** Возвращает список невыполненных требований (пустой — статус можно назначить). */
export function checkVerificationRequirements(target: VerificationStatus, ctx: VerificationContext): string[] {
  const problems: string[] = [];
  switch (target) {
    case "NOT_TESTED":
    case "NEEDS_RECHECK":
      return problems;
    case "AUTHOR_TESTED":
      if (ctx.isDemo) problems.push("Демонстрационный материал не может иметь статус проверки.");
      if (ctx.testReport.trim().length < 80) problems.push("Не описано, как автор проверял решение (минимум 80 символов).");
      if (!ctx.limitations.trim()) problems.push("Не указаны ограничения решения.");
      return problems;
    case "MULTI_TEACHER": {
      if (ctx.isDemo) problems.push("Демонстрационный материал не может иметь статус проверки.");
      const distinct = new Set(ctx.practiceReviewAuthorIds.filter((id) => id !== ctx.authorId));
      if (distinct.size < 2)
        problems.push(`Нужно минимум 2 одобренных отзыва о практическом применении от разных педагогов, сейчас: ${distinct.size}.`);
      return problems;
    }
    case "INDEPENDENT":
      if (!ctx.research) {
        problems.push("К материалу не привязано исследование лаборатории.");
        return problems;
      }
      if (ctx.research.status !== "PUBLISHED") problems.push("Привязанное исследование не опубликовано.");
      if (ctx.research.authorId === ctx.authorId) problems.push("Исследование провёл автор материала — это не независимая проверка.");
      if (ctx.research.isDemo) problems.push("Привязанное исследование — учебный пример, а не реальное испытание.");
      if (!ctx.research.criteriaLocked) problems.push("Критерии исследования не были зафиксированы до внесения результатов.");
      return problems;
  }
}
