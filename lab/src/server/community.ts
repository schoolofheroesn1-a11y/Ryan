import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reportSchema, reviewSchema, zodFieldErrors } from "@/lib/validation";
import { logAudit } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { canViewMaterial, requireActor, requireStaff, type Actor } from "./permissions";

export async function toggleBookmark(actorInput: Actor | null, materialId: string) {
  const actor = requireActor(actorInput);
  const material = await prisma.material.findUnique({ where: { id: materialId }, select: { status: true, authorId: true } });
  if (!material || !canViewMaterial(actor, material)) throw new NotFoundError("Материал не найден");
  const key = { userId_materialId: { userId: actor.id, materialId } };
  const existing = await prisma.bookmark.findUnique({ where: key });
  if (existing) {
    await prisma.bookmark.delete({ where: key });
    return false;
  }
  await prisma.bookmark.create({ data: { userId: actor.id, materialId } });
  return true;
}

/** Отзывы публикуются только после модерации: неподтверждённые отзывы не показываются. */
export async function createReview(actorInput: Actor | null, args: { materialId: string; raw: unknown }) {
  const actor = requireActor(actorInput);
  const parsed = reviewSchema.safeParse(args.raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля отзыва", zodFieldErrors(parsed.error));
  const material = await prisma.material.findUnique({ where: { id: args.materialId } });
  if (!material || material.status !== "PUBLISHED") throw new NotFoundError("Материал не найден");
  if (material.authorId === actor.id) throw new ForbiddenError("Нельзя оставить отзыв на собственный материал");
  const existing = await prisma.review.findUnique({
    where: { materialId_authorId: { materialId: material.id, authorId: actor.id } },
  });
  if (existing) throw new ValidationError("Вы уже оставили отзыв на этот материал");
  return prisma.review.create({
    data: {
      materialId: material.id,
      authorId: actor.id,
      body: parsed.data.body,
      appliedInPractice: parsed.data.appliedInPractice,
      context: parsed.data.context,
    },
  });
}

export async function moderateReview(actorInput: Actor | null, args: { id: string; approve: boolean }) {
  const actor = requireStaff(actorInput);
  const review = await prisma.review.findUnique({ where: { id: args.id } });
  if (!review) throw new NotFoundError();
  const updated = await prisma.review.update({
    where: { id: args.id },
    data: { status: args.approve ? "APPROVED" : "REJECTED", moderatedAt: new Date() },
  });
  await logAudit(prisma, {
    actorId: actor.id,
    action: args.approve ? "review.approve" : "review.reject",
    targetType: "Review",
    targetId: review.id,
  });
  return updated;
}

export async function createReport(actorInput: Actor | null, args: { materialId?: string; researchSlug?: string; raw: unknown }) {
  const actor = requireActor(actorInput);
  const parsed = reportSchema.safeParse(args.raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля сообщения", zodFieldErrors(parsed.error));
  let materialId: string | null = null;
  let researchSlug: string | null = null;
  if (args.researchSlug) {
    const research = await prisma.research.findUnique({ where: { slug: args.researchSlug }, select: { slug: true, status: true } });
    if (!research || research.status !== "PUBLISHED") throw new NotFoundError("Исследование не найдено");
    researchSlug = research.slug;
  } else {
    const material = await prisma.material.findUnique({ where: { id: args.materialId ?? "" }, select: { id: true, status: true, authorId: true } });
    if (!material || !canViewMaterial(actor, material)) throw new NotFoundError("Материал не найден");
    materialId = material.id;
  }
  const recent = await prisma.report.count({
    where: { reporterId: actor.id, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= 10) throw new ValidationError("Слишком много сообщений за час. Попробуйте позже.");
  return prisma.report.create({
    data: { materialId, researchSlug, reporterId: actor.id, reason: parsed.data.reason, body: parsed.data.body },
  });
}

export async function resolveReport(
  actorInput: Actor | null,
  args: { id: string; status: ReportStatus; resolution: string },
) {
  const actor = requireStaff(actorInput);
  if (args.status === "OPEN") throw new ValidationError("Выберите решение");
  const report = await prisma.report.findUnique({ where: { id: args.id } });
  if (!report) throw new NotFoundError();
  const updated = await prisma.report.update({
    where: { id: args.id },
    data: {
      status: args.status,
      resolution: args.resolution.trim().slice(0, 2000),
      resolvedById: actor.id,
      resolvedAt: new Date(),
    },
  });
  await logAudit(prisma, {
    actorId: actor.id,
    action: `report.${args.status.toLowerCase()}`,
    targetType: "Report",
    targetId: report.id,
    details: args.resolution.slice(0, 500),
  });
  return updated;
}
