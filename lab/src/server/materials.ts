import { Prisma, type MaterialType, type PublicationStatus, type VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomSuffix, slugify } from "@/lib/slug";
import {
  materialDraftSchema,
  materialSubmitSchema,
  zodFieldErrors,
  type MaterialInput,
} from "@/lib/validation";
import { checkVerificationRequirements } from "@/lib/verification";
import { logAudit } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { canEditMaterial, canViewMaterial, isStaff, requireActor, requireStaff, type Actor } from "./permissions";

export type SaveIntent = "draft" | "submit" | "save" | "publish";

async function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title);
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.material.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${randomSuffix()}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function resolveTags(tx: Prisma.TransactionClient, names: string[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.replace(/\s+/g, " ").trim().toLowerCase();
    const slug = slugify(name, 40);
    if (!name || seen.has(slug)) continue;
    seen.add(slug);
    const tag = await tx.tag.upsert({ where: { slug }, update: {}, create: { slug, name } });
    ids.push(tag.id);
  }
  return ids;
}

function buildSearchText(input: MaterialInput, tagNames: string[], categoryNames: string[]) {
  return [
    input.audience,
    input.resources,
    input.steps.join(" "),
    input.example,
    input.expectedResult,
    input.adaptation,
    input.limitations,
    input.prompts.join(" "),
    tagNames.join(" "),
    categoryNames.join(" "),
  ]
    .join(" \n")
    .slice(0, 50000);
}

function contentData(input: MaterialInput) {
  return {
    type: input.type,
    title: input.title,
    summary: input.summary,
    problem: input.problem,
    audience: input.audience,
    gradeFrom: input.gradeFrom,
    gradeTo: input.gradeTo,
    resources: input.resources,
    steps: input.steps,
    example: input.example,
    prepTimeMin: input.prepTimeMin,
    lessonTimeMin: input.lessonTimeMin,
    cost: input.cost,
    costNote: input.costNote,
    digitalSkill: input.digitalSkill,
    formats: input.formats,
    limitations: input.limitations,
    expectedResult: input.expectedResult,
    adaptation: input.adaptation,
    testReport: input.testReport,
    prompts: input.prompts,
    externalUrl: input.externalUrl || null,
    sources: input.sources,
    license: input.license,
  };
}

/**
 * Создание и сохранение материала. Пользователь может сохранить черновик
 * или отправить на модерацию; публиковать без проверки может только редакция.
 */
export async function saveMaterial(
  actorInput: Actor | null,
  args: { id?: string; raw: unknown; intent: SaveIntent },
) {
  const actor = requireActor(actorInput);
  const { intent } = args;
  if ((intent === "save" || intent === "publish") && !isStaff(actor)) throw new ForbiddenError();

  const strict = intent === "submit" || intent === "publish";
  const parsed = (strict ? materialSubmitSchema : materialDraftSchema).safeParse(args.raw);
  if (!parsed.success) {
    throw new ValidationError("Проверьте поля формы", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const existing = args.id
    ? await prisma.material.findUnique({ where: { id: args.id }, select: { id: true, status: true, authorId: true } })
    : null;
  if (args.id && !existing) throw new NotFoundError("Материал не найден");
  if (existing && !canEditMaterial(actor, existing)) {
    throw new ForbiddenError(
      existing.status === "PENDING" ? "Материал на модерации — дождитесь решения редакции" : undefined,
    );
  }

  const categoryIds = [...input.subjectIds, ...input.taskIds, ...input.techIds];
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const byKind = (kind: string, ids: string[]) =>
    ids.every((id) => categories.some((c) => c.id === id && c.kind === kind));
  if (!byKind("SUBJECT", input.subjectIds) || !byKind("TASK", input.taskIds) || !byKind("TECHNOLOGY", input.techIds)) {
    throw new ValidationError("Выбрана несуществующая категория", { form: "Обновите страницу и выберите категории заново" });
  }

  const previous: PublicationStatus | null = existing?.status ?? null;
  let next: PublicationStatus;
  if (intent === "draft") next = isStaff(actor) && previous ? previous : "DRAFT";
  else if (intent === "submit") next = "PENDING";
  else if (intent === "publish") next = "PUBLISHED";
  else next = previous ?? "DRAFT";

  return prisma.$transaction(async (tx) => {
    const tagIds = await resolveTags(tx, input.tags);
    const tagNames = input.tags;
    const searchText = buildSearchText(input, tagNames, categories.map((c) => c.name));
    const data = {
      ...contentData(input),
      status: next,
      searchText,
      publishedAt: next === "PUBLISHED" ? new Date() : undefined,
    };

    const material = existing
      ? await tx.material.update({ where: { id: existing.id }, data })
      : await tx.material.create({
          data: { ...data, slug: await uniqueSlug(input.title), authorId: actor.id },
        });

    await tx.materialCategory.deleteMany({ where: { materialId: material.id } });
    await tx.materialCategory.createMany({
      data: categoryIds.map((categoryId) => ({ materialId: material.id, categoryId })),
      skipDuplicates: true,
    });
    await tx.materialTag.deleteMany({ where: { materialId: material.id } });
    await tx.materialTag.createMany({ data: tagIds.map((tagId) => ({ materialId: material.id, tagId })) });

    if (previous !== next) {
      await tx.moderationEvent.create({
        data: {
          materialId: material.id,
          actorId: actor.id,
          fromStatus: previous,
          toStatus: next,
          comment:
            next === "PENDING"
              ? "Отправлено на модерацию"
              : next === "PUBLISHED"
                ? "Опубликовано редакцией"
                : previous === null
                  ? "Создан черновик"
                  : "Возвращено в черновики",
        },
      });
    }
    if (isStaff(actor) && existing && existing.authorId !== actor.id) {
      await logAudit(tx, { actorId: actor.id, action: "material.edit", targetType: "Material", targetId: material.id });
    }
    return material;
  });
}

export type ModerationDecision = "approve" | "reject" | "unpublish" | "republish";

const decisionTarget: Record<ModerationDecision, { from: PublicationStatus[]; to: PublicationStatus }> = {
  approve: { from: ["PENDING"], to: "PUBLISHED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  unpublish: { from: ["PUBLISHED"], to: "UNPUBLISHED" },
  republish: { from: ["UNPUBLISHED"], to: "PUBLISHED" },
};

export async function moderateMaterial(
  actorInput: Actor | null,
  args: { id: string; decision: ModerationDecision; comment: string },
) {
  const actor = requireStaff(actorInput);
  const rule = decisionTarget[args.decision];
  if (!rule) throw new ValidationError("Неизвестное действие");
  const comment = args.comment.trim().slice(0, 2000);
  if ((args.decision === "reject" || args.decision === "unpublish") && comment.length < 5) {
    throw new ValidationError("Укажите причину — автор увидит её в личном кабинете", { comment: "Укажите причину" });
  }
  const material = await prisma.material.findUnique({
    where: { id: args.id },
    include: { categories: { include: { category: true } }, tags: { include: { tag: true } } },
  });
  if (!material) throw new NotFoundError("Материал не найден");
  if (!rule.from.includes(material.status)) {
    throw new ValidationError("Действие недоступно для текущего статуса материала");
  }
  if (rule.to === "PUBLISHED") {
    // Публикация требует полного заполнения, даже если материал прислала редакция.
    const check = materialSubmitSchema.safeParse({
      ...material,
      externalUrl: material.externalUrl ?? "",
      subjectIds: material.categories.filter((c) => c.category.kind === "SUBJECT").map((c) => c.categoryId),
      taskIds: material.categories.filter((c) => c.category.kind === "TASK").map((c) => c.categoryId),
      techIds: material.categories.filter((c) => c.category.kind === "TECHNOLOGY").map((c) => c.categoryId),
      tags: material.tags.map((t) => t.tag.name),
    });
    if (!check.success) throw new ValidationError("Материал заполнен не полностью", zodFieldErrors(check.error));
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.material.update({
      where: { id: material.id },
      data: {
        status: rule.to,
        publishedAt: rule.to === "PUBLISHED" ? (material.publishedAt ?? new Date()) : material.publishedAt,
      },
    });
    await tx.moderationEvent.create({
      data: { materialId: material.id, actorId: actor.id, fromStatus: material.status, toStatus: rule.to, comment },
    });
    await logAudit(tx, {
      actorId: actor.id,
      action: `material.${args.decision}`,
      targetType: "Material",
      targetId: material.id,
      details: comment,
    });
    return updated;
  });
}

export async function setMaterialVerification(
  actorInput: Actor | null,
  args: { id: string; status: VerificationStatus; comment: string; researchId?: string | null },
) {
  const actor = requireStaff(actorInput);
  const material = await prisma.material.findUnique({
    where: { id: args.id },
    include: {
      reviews: { where: { status: "APPROVED", appliedInPractice: true }, select: { authorId: true } },
    },
  });
  if (!material) throw new NotFoundError("Материал не найден");
  const researchId = args.researchId === undefined ? material.researchId : args.researchId || null;
  const research = researchId ? await prisma.research.findUnique({ where: { id: researchId } }) : null;
  if (researchId && !research) throw new ValidationError("Исследование не найдено");

  const problems = checkVerificationRequirements(args.status, {
    isDemo: material.isDemo,
    authorId: material.authorId,
    testReport: material.testReport,
    limitations: material.limitations,
    practiceReviewAuthorIds: material.reviews.map((r) => r.authorId),
    research: research
      ? {
          status: research.status,
          authorId: research.authorId,
          isDemo: research.isDemo,
          criteriaLocked: !!research.criteriaLockedAt,
        }
      : null,
  });
  if (problems.length) throw new ValidationError(problems.join(" "));
  const comment = args.comment.trim().slice(0, 2000);
  if (args.status === "NEEDS_RECHECK" && comment.length < 5)
    throw new ValidationError("Укажите причину повторной проверки", { comment: "Укажите причину" });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.material.update({
      where: { id: material.id },
      data: { verificationStatus: args.status, researchId },
    });
    await tx.moderationEvent.create({
      data: {
        materialId: material.id,
        actorId: actor.id,
        fromVerification: material.verificationStatus,
        toVerification: args.status,
        comment,
      },
    });
    await logAudit(tx, {
      actorId: actor.id,
      action: "material.verification",
      targetType: "Material",
      targetId: material.id,
      details: `${material.verificationStatus} → ${args.status}. ${comment}`,
    });
    return updated;
  });
}

export async function deleteMaterial(actorInput: Actor | null, id: string) {
  const actor = requireActor(actorInput);
  const material = await prisma.material.findUnique({ where: { id }, include: { attachments: true } });
  if (!material) throw new NotFoundError("Материал не найден");
  const ownDraft = material.authorId === actor.id && (material.status === "DRAFT" || material.status === "REJECTED");
  if (!ownDraft && !isStaff(actor)) throw new ForbiddenError("Удалить можно только свой черновик");
  await prisma.$transaction(async (tx) => {
    await tx.material.delete({ where: { id } });
    if (isStaff(actor) && !ownDraft)
      await logAudit(tx, { actorId: actor.id, action: "material.delete", targetType: "Material", targetId: id, details: material.title });
  });
  const { removeFile } = await import("./storage");
  await Promise.all(material.attachments.map((a) => removeFile(a.storageKey)));
}

export const materialPageInclude = {
  author: { select: { id: true, name: true, specialization: true } },
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  attachments: { orderBy: { createdAt: "asc" } },
  research: { select: { slug: true, title: true, status: true, isDemo: true, kind: true } },
  reviews: {
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.MaterialInclude;

export async function getMaterialForView(slug: string, actor: Actor | null) {
  const material = await prisma.material.findUnique({ where: { slug }, include: materialPageInclude });
  if (!material || !canViewMaterial(actor, material)) return null;
  return material;
}

export async function getSimilarMaterials(material: { id: string; categories: { categoryId: string }[]; tags: { tagId: string }[] }) {
  const categoryIds = material.categories.map((c) => c.categoryId);
  const tagIds = material.tags.map((t) => t.tagId);
  const candidates = await prisma.material.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: material.id },
      OR: [{ categories: { some: { categoryId: { in: categoryIds } } } }, { tags: { some: { tagId: { in: tagIds } } } }],
    },
    include: { ...cardInclude, categories: true, tags: true },
    take: 30,
  });
  return candidates
    .map((c) => ({
      c,
      score:
        c.tags.filter((t) => tagIds.includes(t.tagId)).length * 2 +
        c.categories.filter((x) => categoryIds.includes(x.categoryId)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.c);
}

export const cardInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.MaterialInclude;

export type MaterialCardData = {
  id: string;
  slug: string;
  type: MaterialType;
  title: string;
  summary: string;
  audience: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  prepTimeMin: number | null;
  cost: "FREE" | "FREEMIUM" | "PAID";
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  updatedAt: Date;
  author: { id: string; name: string };
  subjects?: string[];
};
