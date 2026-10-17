import type { CategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { logAudit } from "./audit";
import { NotFoundError, ValidationError } from "./errors";
import { requireStaff, type Actor } from "./permissions";
import { reindexMaterials } from "./materials";

export async function createCategory(actorInput: Actor | null, args: { kind: CategoryKind; name: string }) {
  const actor = requireStaff(actorInput);
  const name = args.name.trim().slice(0, 80);
  if (name.length < 2) throw new ValidationError("Название: минимум 2 символа");
  if (!["SUBJECT", "TASK", "TECHNOLOGY"].includes(args.kind)) throw new ValidationError("Неизвестный тип категории");
  const slug = slugify(name, 50);
  if (await prisma.category.findUnique({ where: { kind_slug: { kind: args.kind, slug } } }))
    throw new ValidationError("Такая категория уже есть");
  const count = await prisma.category.count({ where: { kind: args.kind } });
  const c = await prisma.category.create({ data: { kind: args.kind, name, slug, order: count } });
  await logAudit(prisma, { actorId: actor.id, action: "category.create", targetType: "Category", targetId: c.id, details: name });
  return c;
}

export async function renameCategory(actorInput: Actor | null, args: { id: string; name: string }) {
  const actor = requireStaff(actorInput);
  const name = args.name.trim().slice(0, 80);
  if (name.length < 2) throw new ValidationError("Название: минимум 2 символа");
  const c = await prisma.category.findUnique({ where: { id: args.id } });
  if (!c) throw new NotFoundError();
  await prisma.category.update({ where: { id: c.id }, data: { name } });
  const linked = await prisma.materialCategory.findMany({ where: { categoryId: c.id }, select: { materialId: true } });
  await reindexMaterials(linked.map((l) => l.materialId));
  await logAudit(prisma, { actorId: actor.id, action: "category.rename", targetType: "Category", targetId: c.id, details: `${c.name} → ${name}` });
}

export async function deleteCategory(actorInput: Actor | null, id: string) {
  const actor = requireStaff(actorInput);
  const c = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { materials: true } } } });
  if (!c) throw new NotFoundError();
  if (c._count.materials > 0) throw new ValidationError(`Категория используется в ${c._count.materials} материалах`);
  await prisma.category.delete({ where: { id } });
  await logAudit(prisma, { actorId: actor.id, action: "category.delete", targetType: "Category", targetId: id, details: c.name });
}

export async function renameTag(actorInput: Actor | null, args: { id: string; name: string }) {
  const actor = requireStaff(actorInput);
  const name = args.name.trim().toLowerCase().slice(0, 40);
  if (name.length < 2) throw new ValidationError("Тег: минимум 2 символа");
  const tag = await prisma.tag.findUnique({ where: { id: args.id } });
  if (!tag) throw new NotFoundError();
  await prisma.tag.update({ where: { id: tag.id }, data: { name } });
  const linked = await prisma.materialTag.findMany({ where: { tagId: tag.id }, select: { materialId: true } });
  await reindexMaterials(linked.map((l) => l.materialId));
  await logAudit(prisma, { actorId: actor.id, action: "tag.rename", targetType: "Tag", targetId: tag.id, details: `${tag.name} → ${name}` });
}

export async function deleteTag(actorInput: Actor | null, id: string) {
  const actor = requireStaff(actorInput);
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError();
  const linked = await prisma.materialTag.findMany({ where: { tagId: id }, select: { materialId: true } });
  await prisma.tag.delete({ where: { id } });
  await reindexMaterials(linked.map((l) => l.materialId));
  await logAudit(prisma, { actorId: actor.id, action: "tag.delete", targetType: "Tag", targetId: id, details: tag.name });
}
