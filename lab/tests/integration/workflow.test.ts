import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { parseLibraryFilters } from "@/lib/search-params";
import { createReview, moderateReview, toggleBookmark } from "@/server/community";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { getMaterialForView, moderateMaterial, saveMaterial, setMaterialVerification } from "@/server/materials";
import { addCriterion, addTool, lockCriteria, saveResearch, saveResults, setResearchStatus } from "@/server/research";
import { searchMaterials } from "@/server/search";
import { setUserRole } from "@/server/users";
import { fullMaterial, resetDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof resetDb>>;
let ids: { subject: string; task: string; tech: string };

beforeEach(async () => {
  ctx = await resetDb();
  ids = { subject: ctx.subject.id, task: ctx.task.id, tech: ctx.tech.id };
});

const search = (q: Record<string, string | string[]>) => searchMaterials(parseLibraryFilters(q));

describe("публикация и модерация", () => {
  it("черновик → модерация → публикация → поиск и постоянная ссылка", async () => {
    const draft = await saveMaterial(ctx.author, { raw: { ...fullMaterial(ids), summary: "" }, intent: "draft" });
    expect(draft.status).toBe("DRAFT");

    await expect(saveMaterial(ctx.author, { id: draft.id, raw: { ...fullMaterial(ids), summary: "" }, intent: "submit" })).rejects.toBeInstanceOf(ValidationError);

    const submitted = await saveMaterial(ctx.author, { id: draft.id, raw: fullMaterial(ids), intent: "submit" });
    expect(submitted.status).toBe("PENDING");
    expect((await search({ q: "рефлексия" })).total).toBe(0);
    expect(await getMaterialForView(submitted.slug, null)).toBeNull();
    expect(await getMaterialForView(submitted.slug, ctx.other)).toBeNull();
    expect(await getMaterialForView(submitted.slug, ctx.author)).not.toBeNull();

    // Автор не может редактировать материал на модерации и не может его опубликовать.
    await expect(saveMaterial(ctx.author, { id: draft.id, raw: fullMaterial(ids), intent: "draft" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveMaterial(ctx.author, { raw: fullMaterial(ids), intent: "publish" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(moderateMaterial(ctx.author, { id: draft.id, decision: "approve", comment: "" })).rejects.toBeInstanceOf(ForbiddenError);

    await moderateMaterial(ctx.editor, { id: draft.id, decision: "approve", comment: "Проверено" });
    expect(await getMaterialForView(submitted.slug, null)).not.toBeNull();

    // Поиск по морфологии и по содержанию шагов/тегов.
    expect((await search({ q: "рефлексии" })).total).toBe(1);
    expect((await search({ q: "стикеры" })).total).toBe(1);
    expect((await search({ q: "геймификация" })).total).toBe(0);
    expect((await search({ task: "reflection", grade: "7", cost: "FREE" })).total).toBe(1);
    expect((await search({ grade: "3" })).total).toBe(0);
    expect((await search({ type: "CASE" })).total).toBe(0);

    const events = await prisma.moderationEvent.findMany({ where: { materialId: draft.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["DRAFT", "PENDING", "PUBLISHED"]);
  });

  it("отклонение требует комментария, а правка опубликованного автором скрывает его до повторной проверки", async () => {
    const m = await saveMaterial(ctx.author, { raw: fullMaterial(ids), intent: "submit" });
    await expect(moderateMaterial(ctx.editor, { id: m.id, decision: "reject", comment: "" })).rejects.toBeInstanceOf(ValidationError);
    await moderateMaterial(ctx.editor, { id: m.id, decision: "approve", comment: "" });
    const edited = await saveMaterial(ctx.author, { id: m.id, raw: fullMaterial(ids, "Новое название"), intent: "submit" });
    expect(edited.status).toBe("PENDING");
    expect((await search({})).total).toBe(0);
  });
});

describe("статусы проверки", () => {
  it("не позволяет назначить статус без выполнения критериев", async () => {
    const m = await saveMaterial(ctx.author, { raw: fullMaterial(ids), intent: "submit" });
    await moderateMaterial(ctx.editor, { id: m.id, decision: "approve", comment: "" });
    await expect(setMaterialVerification(ctx.editor, { id: m.id, status: "AUTHOR_TESTED", comment: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(setMaterialVerification(ctx.editor, { id: m.id, status: "MULTI_TEACHER", comment: "" })).rejects.toThrow(/минимум 2/);
    await expect(setMaterialVerification(ctx.author, { id: m.id, status: "NEEDS_RECHECK", comment: "причина" })).rejects.toBeInstanceOf(ForbiddenError);

    // Два одобренных отзыва о практике от разных педагогов.
    const third = await prisma.user.create({ data: { email: "t3@t.io", name: "t3", passwordHash: "x" } });
    for (const u of [ctx.other, { id: third.id, role: "USER" as const, isBlocked: false }]) {
      const r = await createReview(u, { materialId: m.id, raw: { body: "Применяла в 7 классе, работает хорошо.", appliedInPractice: true, context: "7 класс, биология" } });
      await moderateReview(ctx.editor, { id: r.id, approve: true });
    }
    await setMaterialVerification(ctx.editor, { id: m.id, status: "MULTI_TEACHER", comment: "Два отзыва" });
    expect((await prisma.material.findUniqueOrThrow({ where: { id: m.id } })).verificationStatus).toBe("MULTI_TEACHER");
  });

  it("автор не может оставить отзыв на свой материал", async () => {
    const m = await saveMaterial(ctx.author, { raw: fullMaterial(ids), intent: "submit" });
    await moderateMaterial(ctx.editor, { id: m.id, decision: "approve", comment: "" });
    await expect(createReview(ctx.author, { materialId: m.id, raw: { body: "Отличный материал, всем советую!", appliedInPractice: false, context: "" } })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("избранное и права", () => {
  it("гость не может добавить в избранное, пользователь — может и может убрать", async () => {
    const m = await saveMaterial(ctx.editor, { raw: fullMaterial(ids), intent: "publish" });
    await expect(toggleBookmark(null, m.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await toggleBookmark(ctx.other, m.id)).toBe(true);
    expect(await toggleBookmark(ctx.other, m.id)).toBe(false);
  });

  it("роли меняет только администратор", async () => {
    await expect(setUserRole(ctx.editor, { userId: ctx.other.id, role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
    await setUserRole(ctx.admin, { userId: ctx.other.id, role: "EDITOR" });
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "user.role" } })).targetId).toBe(ctx.other.id);
  });
});

describe("методика испытаний", () => {
  it("результаты вносятся только после фиксации критериев, а критерии после фиксации не меняются", async () => {
    const raw = {
      title: "Испытание генераторов", summary: "Краткое описание испытания для теста", kind: "TECHNICAL",
      question: "Какой инструмент лучше?", hypothesis: "", conductedFrom: "", conductedTo: "", conditions: "", limitations: "Ограничения",
      inputTasks: "", rawResults: "", errorsFound: "", resourceCosts: "", manualRework: "", pedagogicalCheck: "",
      conclusions: "Выводы", recommendations: "", reproduction: "", isDemo: false,
    };
    await expect(saveResearch(ctx.author, { raw })).rejects.toBeInstanceOf(ForbiddenError);
    const r = await saveResearch(ctx.editor, { raw });
    const tool = await addTool(ctx.editor, { researchId: r.id, name: "Инструмент", version: "1.0", vendor: "", pricing: "", availability: "" });
    const crit = await addCriterion(ctx.editor, { researchId: r.id, name: "Точность", description: "", dimension: "TECHNICAL", weight: 5, scaleMax: 5 });

    await expect(saveResults(ctx.editor, { researchId: r.id, entries: [{ toolId: tool.id, criterionId: crit.id, score: 4, note: "" }] })).rejects.toThrow(/зафиксируйте/);
    await expect(setResearchStatus(ctx.editor, { id: r.id, status: "PUBLISHED", comment: "" })).rejects.toBeInstanceOf(ValidationError);

    await lockCriteria(ctx.editor, r.id);
    await expect(addCriterion(ctx.editor, { researchId: r.id, name: "Новый", description: "", dimension: "INTERFACE", weight: 1, scaleMax: 5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveResults(ctx.editor, { researchId: r.id, entries: [{ toolId: tool.id, criterionId: crit.id, score: 9, note: "" }] })).rejects.toBeInstanceOf(ValidationError);
    await saveResults(ctx.editor, { researchId: r.id, entries: [{ toolId: tool.id, criterionId: crit.id, score: 4, note: "" }] });
    const published = await setResearchStatus(ctx.editor, { id: r.id, status: "PUBLISHED", comment: "" });
    expect(published.status).toBe("PUBLISHED");
  });
});
