import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { parseLibraryFilters } from "@/lib/search-params";
import { createReport, createReview, moderateReview } from "@/server/community";
import { ValidationError } from "@/server/errors";
import { moderateMaterial, saveMaterial, setMaterialVerification } from "@/server/materials";
import { addCriterion, addIssue, addTool, lockCriteria, removeIssue, saveResearch, saveResults, setResearchStatus } from "@/server/research";
import { searchMaterials } from "@/server/search";
import { deleteTag, renameCategory } from "@/server/taxonomy";
import { changePassword } from "@/server/users";
import { fullMaterial, resetDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof resetDb>>;
let ids: { subject: string; task: string; tech: string };
beforeEach(async () => {
  ctx = await resetDb();
  ids = { subject: ctx.subject.id, task: ctx.task.id, tech: ctx.tech.id };
});
const search = (q: string) => searchMaterials(parseLibraryFilters({ q })).then((r) => r.total);

async function published(title?: string, extra: Record<string, unknown> = {}) {
  const m = await saveMaterial(ctx.author, { raw: { ...fullMaterial(ids, title), ...extra }, intent: "submit" });
  await moderateMaterial(ctx.editor, { id: m.id, decision: "approve", comment: "" });
  return m;
}

describe("поиск (регрессии QA)", () => {
  it("короткое слово «ИИ» ищется целиком, а не как часть других слов", async () => {
    await published("Рефлексия в конце урока", { summary: "Приём для педагогических технологий и рефлексии на уроке без цифровых средств." });
    await published("Разноуровневые задания с помощью ИИ");
    expect(await search("ИИ")).toBe(1);
  });

  it("синонимы: «нейросеть» и «AI» находят материал про ИИ", async () => {
    await published("Разноуровневые задания с помощью ИИ");
    expect(await search("нейросеть")).toBe(1);
    expect(await search("AI")).toBe(1);
  });

  it("служебные слова не мешают поиску, операторы поиска работают", async () => {
    await published("Рефлексия за пять минут на стикерах");
    await published("Квест по станциям", {
      summary: "Игра для повторения темы: группы проходят станции и решают задания.",
      problem: "Повторение перед контрольной проходит скучно.",
      tags: ["квест"],
      resources: "Распечатанные карточки",
      steps: ["Разделите класс на группы", "Раздайте маршрутные листы"],
    });
    expect(await search("стикеры на уроке")).toBe(1);
    expect(await search("квест -стикеры")).toBe(1);
    expect(await search("и")).toBe(2); // только служебное слово — фильтр по тексту не применяется
  });

  it("переименование категории и удаление тега обновляют поиск", async () => {
    await published();
    await renameCategory(ctx.editor, { id: ctx.task.id, name: "Читательская грамотность" });
    expect(await search("читательская грамотность")).toBe(1);
    const tag = await prisma.tag.findFirstOrThrow({ where: { name: "конец урока" } });
    expect(await prisma.material.count({ where: { searchText: { contains: "конец урока" } } })).toBe(1);
    await deleteTag(ctx.editor, tag.id);
    expect(await prisma.material.count({ where: { searchText: { contains: "конец урока" } } })).toBe(0);
  });
});

describe("целостность статусов и испытаний", () => {
  it("правка содержания автором сбрасывает статус проверки на «Требует повторной проверки»", async () => {
    const m = await published();
    const t3 = await prisma.user.create({ data: { email: "t3@t.io", name: "t3", passwordHash: "x" } });
    for (const u of [ctx.other, { id: t3.id, role: "USER" as const, isBlocked: false }]) {
      const r = await createReview(u, { materialId: m.id, raw: { body: "Применяла в 7 классе, работает хорошо.", appliedInPractice: true, context: "7 класс, биология" } });
      await moderateReview(ctx.editor, { id: r.id, approve: true });
    }
    await setMaterialVerification(ctx.editor, { id: m.id, status: "MULTI_TEACHER", comment: "" });
    // сохранение без изменений содержания статус не трогает
    await saveMaterial(ctx.author, { id: m.id, raw: fullMaterial(ids), intent: "submit" });
    await moderateMaterial(ctx.editor, { id: m.id, decision: "approve", comment: "" });
    expect((await prisma.material.findUniqueOrThrow({ where: { id: m.id } })).verificationStatus).toBe("MULTI_TEACHER");
    await saveMaterial(ctx.author, { id: m.id, raw: { ...fullMaterial(ids), steps: ["Совсем другое", "Иначе"] }, intent: "submit" });
    expect((await prisma.material.findUniqueOrThrow({ where: { id: m.id } })).verificationStatus).toBe("NEEDS_RECHECK");
  });

  it("опубликованное испытание нельзя изменить без снятия с публикации с причиной", async () => {
    const raw = {
      title: "Испытание генераторов", summary: "Краткое описание испытания для теста", kind: "TECHNICAL", question: "Какой инструмент лучше?",
      hypothesis: "", conductedFrom: "", conductedTo: "", conditions: "", limitations: "Ограничения", inputTasks: "", rawResults: "",
      errorsFound: "", resourceCosts: "", manualRework: "", pedagogicalCheck: "", conclusions: "Выводы", recommendations: "", reproduction: "", isDemo: false,
    };
    const r = await saveResearch(ctx.editor, { raw });
    const tool = await addTool(ctx.editor, { researchId: r.id, name: "А", version: "1", vendor: "", pricing: "", availability: "" });
    const c = await addCriterion(ctx.editor, { researchId: r.id, name: "Точность", description: "", dimension: "TECHNICAL", weight: 5, scaleMax: 5 });
    await lockCriteria(ctx.editor, r.id);
    await saveResults(ctx.editor, { researchId: r.id, entries: [{ toolId: tool.id, criterionId: c.id, score: 2, note: "" }] });
    const issue = await addIssue(ctx.editor, { researchId: r.id, toolId: tool.id, description: "Неверный ответ", isCritical: true });
    await setResearchStatus(ctx.editor, { id: r.id, status: "PUBLISHED", comment: "" });

    await expect(saveResults(ctx.editor, { researchId: r.id, entries: [{ toolId: tool.id, criterionId: c.id, score: 5, note: "" }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(removeIssue(ctx.editor, issue.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveResearch(ctx.editor, { id: r.id, raw: { ...raw, question: "Подменённый вопрос" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(setResearchStatus(ctx.editor, { id: r.id, status: "UNPUBLISHED", comment: "" })).rejects.toBeInstanceOf(ValidationError);
    await setResearchStatus(ctx.editor, { id: r.id, status: "UNPUBLISHED", comment: "Исправляем опечатку в выводах" });
    await removeIssue(ctx.editor, issue.id);
    expect(await prisma.auditLog.count({ where: { action: "research.issue.remove" } })).toBe(1);
  });
});

describe("аккаунт и жалобы", () => {
  it("смена пароля проверяет текущий пароль и завершает сессии", async () => {
    await prisma.user.update({ where: { id: ctx.other.id }, data: { passwordHash: await bcrypt.hash("old-password", 4) } });
    await prisma.session.create({ data: { id: "s1", userId: ctx.other.id, expiresAt: new Date(Date.now() + 1e6) } });
    await expect(changePassword(ctx.other, { current: "wrong", next: "new-password-1" })).rejects.toBeInstanceOf(ValidationError);
    await changePassword(ctx.other, { current: "old-password", next: "new-password-1" });
    expect(await prisma.session.count({ where: { userId: ctx.other.id } })).toBe(0);
  });

  it("можно сообщить об ошибке в опубликованном испытании", async () => {
    await prisma.research.create({ data: { slug: "r1", title: "И", summary: "И", question: "?", status: "PUBLISHED", authorId: ctx.editor.id } });
    const rep = await createReport(ctx.other, { researchSlug: "r1", raw: { reason: "ERROR", body: "В таблице перепутаны оценки" } });
    expect(rep.researchSlug).toBe("r1");
  });
});
