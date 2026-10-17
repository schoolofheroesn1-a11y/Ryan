import type { CriterionDimension, PublicationStatus, ResearchKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomSuffix, slugify } from "@/lib/slug";
import { zodFieldErrors } from "@/lib/validation";
import { logAudit } from "./audit";
import { NotFoundError, ValidationError } from "./errors";
import { isStaff, requireStaff, type Actor } from "./permissions";

const text = (max: number) => z.string().trim().max(max);
const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? null : new Date(String(v))),
  z.date({ message: "Некорректная дата" }).nullable(),
);

export const researchSchema = z.object({
  title: text(200).min(5, "Название: минимум 5 символов"),
  summary: text(800).min(20, "Краткое описание: минимум 20 символов"),
  kind: z.enum(["TECHNICAL", "TEACHER_REVIEW", "STUDENT_OUTCOMES"]),
  question: text(1000).min(10, "Сформулируйте исследовательский вопрос"),
  hypothesis: text(2000),
  conductedFrom: optionalDate,
  conductedTo: optionalDate,
  conditions: text(5000),
  limitations: text(5000),
  inputTasks: text(10000),
  rawResults: text(20000),
  errorsFound: text(10000),
  resourceCosts: text(5000),
  manualRework: text(5000),
  pedagogicalCheck: text(5000),
  conclusions: text(10000),
  recommendations: text(5000),
  reproduction: text(10000),
  isDemo: z.boolean(),
});

export const researchFields = Object.keys(researchSchema.shape).filter((k) => k !== "isDemo" && k !== "kind");

export async function saveResearch(actorInput: Actor | null, args: { id?: string; raw: unknown }) {
  const actor = requireStaff(actorInput);
  const parsed = researchSchema.safeParse(args.raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля формы", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (data.kind === "STUDENT_OUTCOMES" && data.limitations.length < 20)
    throw new ValidationError("Для измерения результатов учеников опишите ограничения выборки и методики", {
      limitations: "Обязательно для этого типа исследования",
    });
  if (args.id) {
    const existing = await prisma.research.findUnique({ where: { id: args.id } });
    if (!existing) throw new NotFoundError();
    const updated = await prisma.research.update({ where: { id: args.id }, data });
    await logAudit(prisma, { actorId: actor.id, action: "research.edit", targetType: "Research", targetId: args.id });
    return updated;
  }
  let slug = slugify(data.title);
  if (await prisma.research.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix()}`;
  const created = await prisma.research.create({ data: { ...data, slug, authorId: actor.id } });
  await logAudit(prisma, { actorId: actor.id, action: "research.create", targetType: "Research", targetId: created.id });
  return created;
}

async function loadEditable(id: string) {
  const research = await prisma.research.findUnique({ where: { id } });
  if (!research) throw new NotFoundError("Исследование не найдено");
  return research;
}

export async function addTool(
  actorInput: Actor | null,
  args: { researchId: string; name: string; version: string; vendor: string; pricing: string; availability: string },
) {
  requireStaff(actorInput);
  const research = await loadEditable(args.researchId);
  if (research.criteriaLockedAt)
    throw new ValidationError("Состав участников испытания зафиксирован вместе с критериями");
  const name = args.name.trim().slice(0, 120);
  const version = args.version.trim().slice(0, 120);
  if (!name || !version)
    throw new ValidationError("Укажите название и версию инструмента (или дату обращения к сервису)");
  const count = await prisma.researchTool.count({ where: { researchId: research.id } });
  return prisma.researchTool.create({
    data: {
      researchId: research.id,
      name,
      version,
      vendor: args.vendor.trim().slice(0, 200),
      pricing: args.pricing.trim().slice(0, 300),
      availability: args.availability.trim().slice(0, 500),
      order: count,
    },
  });
}

export async function removeTool(actorInput: Actor | null, toolId: string) {
  requireStaff(actorInput);
  const tool = await prisma.researchTool.findUnique({ where: { id: toolId }, include: { research: true } });
  if (!tool) throw new NotFoundError();
  if (tool.research.criteriaLockedAt) throw new ValidationError("Нельзя удалить инструмент после фиксации критериев");
  await prisma.researchTool.delete({ where: { id: toolId } });
}

const dimensions: CriterionDimension[] = ["TECHNICAL", "INTERFACE", "PEDAGOGICAL", "RESOURCES"];

export async function addCriterion(
  actorInput: Actor | null,
  args: { researchId: string; name: string; description: string; dimension: string; weight: number; scaleMax: number },
) {
  requireStaff(actorInput);
  const research = await loadEditable(args.researchId);
  if (research.criteriaLockedAt)
    throw new ValidationError("Критерии уже зафиксированы. Изменение критериев после начала испытания запрещено методикой.");
  const name = args.name.trim().slice(0, 160);
  if (!name) throw new ValidationError("Укажите название критерия");
  if (!dimensions.includes(args.dimension as CriterionDimension)) throw new ValidationError("Выберите измерение");
  if (!Number.isInteger(args.weight) || args.weight < 1 || args.weight > 10)
    throw new ValidationError("Вес — целое число от 1 до 10");
  if (![3, 5, 10].includes(args.scaleMax)) throw new ValidationError("Шкала: 3, 5 или 10 баллов");
  const count = await prisma.researchCriterion.count({ where: { researchId: research.id } });
  return prisma.researchCriterion.create({
    data: {
      researchId: research.id,
      name,
      description: args.description.trim().slice(0, 1000),
      dimension: args.dimension as CriterionDimension,
      weight: args.weight,
      scaleMax: args.scaleMax,
      order: count,
    },
  });
}

export async function removeCriterion(actorInput: Actor | null, criterionId: string) {
  requireStaff(actorInput);
  const c = await prisma.researchCriterion.findUnique({ where: { id: criterionId }, include: { research: true } });
  if (!c) throw new NotFoundError();
  if (c.research.criteriaLockedAt) throw new ValidationError("Критерии уже зафиксированы");
  await prisma.researchCriterion.delete({ where: { id: criterionId } });
}

export async function lockCriteria(actorInput: Actor | null, researchId: string) {
  const actor = requireStaff(actorInput);
  const research = await prisma.research.findUnique({
    where: { id: researchId },
    include: { _count: { select: { tools: true, criteria: true } } },
  });
  if (!research) throw new NotFoundError();
  if (research.criteriaLockedAt) return research;
  if (research._count.tools < 1 || research._count.criteria < 1)
    throw new ValidationError("Перед фиксацией добавьте хотя бы один инструмент и один критерий");
  const updated = await prisma.research.update({ where: { id: researchId }, data: { criteriaLockedAt: new Date() } });
  await logAudit(prisma, { actorId: actor.id, action: "research.lock_criteria", targetType: "Research", targetId: researchId });
  return updated;
}

export async function saveResults(
  actorInput: Actor | null,
  args: { researchId: string; entries: { toolId: string; criterionId: string; score: number | null; note: string }[] },
) {
  const actor = requireStaff(actorInput);
  const research = await prisma.research.findUnique({
    where: { id: args.researchId },
    include: { tools: true, criteria: true },
  });
  if (!research) throw new NotFoundError();
  if (!research.criteriaLockedAt)
    throw new ValidationError("Сначала зафиксируйте критерии и веса — результаты вносятся только после этого");
  for (const e of args.entries) {
    const criterion = research.criteria.find((c) => c.id === e.criterionId);
    if (!criterion || !research.tools.some((t) => t.id === e.toolId))
      throw new ValidationError("Некорректная ячейка таблицы результатов");
    if (e.score != null && (!Number.isInteger(e.score) || e.score < 0 || e.score > criterion.scaleMax))
      throw new ValidationError(`Оценка по критерию «${criterion.name}» должна быть от 0 до ${criterion.scaleMax}`);
  }
  await prisma.$transaction(
    args.entries.map((e) =>
      prisma.researchResult.upsert({
        where: { toolId_criterionId: { toolId: e.toolId, criterionId: e.criterionId } },
        update: { score: e.score, note: e.note.trim().slice(0, 1000) },
        create: {
          researchId: research.id,
          toolId: e.toolId,
          criterionId: e.criterionId,
          score: e.score,
          note: e.note.trim().slice(0, 1000),
        },
      }),
    ),
  );
  await logAudit(prisma, { actorId: actor.id, action: "research.results", targetType: "Research", targetId: research.id });
}

export async function addIssue(
  actorInput: Actor | null,
  args: { researchId: string; toolId: string; description: string; isCritical: boolean },
) {
  requireStaff(actorInput);
  const tool = await prisma.researchTool.findFirst({ where: { id: args.toolId, researchId: args.researchId } });
  if (!tool) throw new ValidationError("Выберите инструмент");
  const description = args.description.trim().slice(0, 2000);
  if (description.length < 5) throw new ValidationError("Опишите ошибку");
  return prisma.researchIssue.create({
    data: { researchId: args.researchId, toolId: tool.id, description, isCritical: args.isCritical },
  });
}

export async function removeIssue(actorInput: Actor | null, issueId: string) {
  requireStaff(actorInput);
  await prisma.researchIssue.delete({ where: { id: issueId } });
}

export async function setResearchStatus(
  actorInput: Actor | null,
  args: { id: string; status: PublicationStatus; comment: string },
) {
  const actor = requireStaff(actorInput);
  const research = await prisma.research.findUnique({
    where: { id: args.id },
    include: { _count: { select: { results: true } } },
  });
  if (!research) throw new NotFoundError();
  if (!["PUBLISHED", "UNPUBLISHED", "DRAFT"].includes(args.status)) throw new ValidationError("Недопустимый статус");
  if (args.status === "PUBLISHED") {
    if (!research.criteriaLockedAt || research._count.results === 0)
      throw new ValidationError("Публикация невозможна: критерии не зафиксированы или нет результатов");
    if (!research.conclusions.trim() || !research.limitations.trim())
      throw new ValidationError("Публикация невозможна: заполните выводы и ограничения");
  }
  const updated = await prisma.research.update({
    where: { id: args.id },
    data: { status: args.status, publishedAt: args.status === "PUBLISHED" ? (research.publishedAt ?? new Date()) : research.publishedAt },
  });
  await prisma.moderationEvent.create({
    data: { researchId: research.id, actorId: actor.id, fromStatus: research.status, toStatus: args.status, comment: args.comment.slice(0, 1000) },
  });
  await logAudit(prisma, {
    actorId: actor.id,
    action: `research.status.${args.status}`,
    targetType: "Research",
    targetId: research.id,
    details: args.comment.slice(0, 1000),
  });
  return updated;
}

export const researchPageInclude = {
  author: { select: { id: true, name: true, specialization: true } },
  tools: { orderBy: { order: "asc" } },
  criteria: { orderBy: { order: "asc" } },
  results: true,
  issues: true,
  materials: { where: { status: "PUBLISHED" }, select: { slug: true, title: true, type: true } },
} as const;

export async function getResearchForView(slug: string, actor: Actor | null) {
  const research = await prisma.research.findUnique({ where: { slug }, include: researchPageInclude });
  if (!research) return null;
  if (research.status !== "PUBLISHED" && !isStaff(actor)) return null;
  return research;
}

export function listPublishedResearch(kind?: ResearchKind, take = 50) {
  return prisma.research.findMany({
    where: { status: "PUBLISHED", ...(kind ? { kind } : {}) },
    orderBy: { publishedAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
      tools: { select: { name: true, version: true }, orderBy: { order: "asc" } },
      _count: { select: { issues: { where: { isCritical: true } } } },
    },
    take,
  });
}
