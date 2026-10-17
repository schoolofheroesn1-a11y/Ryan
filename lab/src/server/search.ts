import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LibraryFilters } from "@/lib/search-params";
import { cardInclude } from "./materials";

export const PAGE_SIZE = 12;

/**
 * Поиск по опубликованным материалам. Полнотекстовый поиск PostgreSQL
 * с русской морфологией (рефлексия ≈ рефлексии) дополняется поиском
 * по подстроке, чтобы находились и незаконченные слова («геймиф»).
 */
function buildWhere(f: LibraryFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`m."status" = 'PUBLISHED'`];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    parts.push(Prisma.sql`(
      m."searchVector" @@ websearch_to_tsquery('russian', ${f.q})
      OR m."title" ILIKE ${like} OR m."summary" ILIKE ${like} OR m."problem" ILIKE ${like} OR m."searchText" ILIKE ${like}
    )`);
  }
  if (f.types.length) parts.push(Prisma.sql`m."type"::text IN (${Prisma.join(f.types)})`);
  for (const [kind, slug] of [
    ["SUBJECT", f.subject],
    ["TASK", f.task],
    ["TECHNOLOGY", f.tech],
  ] as const) {
    if (!slug) continue;
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "MaterialCategory" mc JOIN "Category" c ON c."id" = mc."categoryId"
      WHERE mc."materialId" = m."id" AND c."kind"::text = ${kind} AND c."slug" = ${slug}
    )`);
  }
  if (f.grade) {
    parts.push(Prisma.sql`(m."gradeFrom" IS NULL OR m."gradeFrom" <= ${f.grade})`);
    parts.push(Prisma.sql`(m."gradeTo" IS NULL OR m."gradeTo" >= ${f.grade})`);
  }
  if (f.prep === "15") parts.push(Prisma.sql`m."prepTimeMin" <= 15`);
  if (f.prep === "60") parts.push(Prisma.sql`m."prepTimeMin" <= 60`);
  if (f.prep === "more") parts.push(Prisma.sql`m."prepTimeMin" > 60`);
  if (f.cost.length) parts.push(Prisma.sql`m."cost"::text IN (${Prisma.join(f.cost)})`);
  if (f.skill) parts.push(Prisma.sql`m."digitalSkill"::text = ${f.skill}`);
  if (f.format) parts.push(Prisma.sql`${f.format} = ANY(m."formats"::text[])`);
  if (f.verification.length)
    parts.push(Prisma.sql`m."verificationStatus"::text IN (${Prisma.join(f.verification)})`);
  if (f.period) {
    const since = new Date(Date.now() - Number(f.period) * 86400000);
    parts.push(Prisma.sql`m."publishedAt" >= ${since}`);
  }
  return Prisma.join(parts, " AND ");
}

function buildOrder(f: LibraryFilters): Prisma.Sql {
  switch (f.sort) {
    case "relevance":
      return f.q
        ? Prisma.sql`ts_rank(m."searchVector", websearch_to_tsquery('russian', ${f.q})) DESC, (m."title" ILIKE ${`%${f.q}%`}) DESC, m."publishedAt" DESC`
        : Prisma.sql`m."publishedAt" DESC`;
    case "updated":
      return Prisma.sql`m."updatedAt" DESC`;
    case "prep":
      return Prisma.sql`m."prepTimeMin" ASC NULLS LAST, m."publishedAt" DESC`;
    default:
      return Prisma.sql`m."publishedAt" DESC NULLS LAST`;
  }
}

export async function searchMaterials(f: LibraryFilters) {
  const where = buildWhere(f);
  const offset = (f.page - 1) * PAGE_SIZE;
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT m."id" FROM "Material" m WHERE ${where} ORDER BY ${buildOrder(f)}, m."id" LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "Material" m WHERE ${where}`,
  ]);
  const ids = rows.map((r) => r.id);
  const materials = await prisma.material.findMany({
    where: { id: { in: ids } },
    include: { ...cardInclude, categories: { include: { category: true } } },
  });
  const ordered = ids.map((id) => materials.find((m) => m.id === id)!).filter(Boolean);
  const total = Number(countRows[0]?.count ?? 0);
  return { items: ordered, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getTaxonomy() {
  const categories = await prisma.category.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return {
    subjects: categories.filter((c) => c.kind === "SUBJECT"),
    tasks: categories.filter((c) => c.kind === "TASK"),
    techs: categories.filter((c) => c.kind === "TECHNOLOGY"),
  };
}
