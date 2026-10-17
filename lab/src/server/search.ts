import { Prisma, type MaterialType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LibraryFilters } from "@/lib/search-params";
import { cardInclude } from "./materials";

export const PAGE_SIZE = 12;

/**
 * Поиск по опубликованным материалам. Полнотекстовый поиск PostgreSQL
 * с русской морфологией (рефлексия ≈ рефлексии) дополняется поиском
 * по подстроке, чтобы находились и незаконченные слова («геймиф»).
 */
const STOP_WORDS = new Set(
  "и в во на по с со к ко о об от до для из у за над под при про без а но или ли же не ни как что это то так the a an of to in on for and or".split(" "),
);

/**
 * Группы синонимов: учитель может написать «нейросеть», а материал — «ИИ» или «языковая модель».
 * Значения — начала слов (основы), поэтому охватывают разные падежи.
 */
const SYNONYMS: string[][] = [
  ["ии", "ai", "нейросет", "искусственн", "языков модел", "llm", "gpt", "чат-бот", "чатбот", "генеративн"],
  ["игр", "геймиф", "квест"],
  ["тест", "контрольн", "проверочн", "викторин"],
  ["разноуровнев", "дифференц", "индивидуализ"],
  ["рефлекс", "обратн связ"],
];

const SEARCH_FIELDS = Prisma.sql`(m."title" || ' ' || m."summary" || ' ' || m."problem" || ' ' || m."searchText")`;

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9-]+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Совпадение одного варианта: короткое слово пользователя — только целиком («ИИ» не находит «технологии»),
 * основа синонима — по началу слова («игр» → «игра», «игровой»), длинные слова — по подстроке.
 */
function textMatch(alt: string, isStem: boolean): Prisma.Sql {
  const words = alt.split(" ");
  const parts = words.map((w) =>
    w.length <= 3
      ? Prisma.sql`${SEARCH_FIELDS} ~* ${isStem ? `(^|[^а-яёa-z0-9])${w}` : `(^|[^а-яёa-z0-9])${w}($|[^а-яёa-z0-9])`}`
      : Prisma.sql`${SEARCH_FIELDS} ILIKE ${`%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`,
  );
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

function alternatives(token: string): string[] {
  const group = SYNONYMS.find((g) => g.some((stem) => token.startsWith(stem.split(" ")[0])));
  return group ? [token, ...group.filter((g) => g !== token)] : [token];
}

/**
 * Текстовая часть запроса. Обычный запрос разбирается на слова: каждое слово (или его синоним)
 * должно встретиться в материале — по русской морфологии или по началу слова.
 * Запросы с операторами поиска («кавычки», -исключение, or) обрабатываются полнотекстовым поиском как есть.
 */
function textCondition(q: string): Prisma.Sql | null {
  if (/["«»]|(^|\s)-\S|\sor\s/i.test(q)) {
    return Prisma.sql`m."searchVector" @@ websearch_to_tsquery('russian', ${q})`;
  }
  const tokens = tokenize(q);
  if (!tokens.length) {
    // Запрос только из служебных слов («и», «по») не сужает выдачу; из символов («%», «C++») — ничего не находит.
    const onlyStopWords = q.toLowerCase().split(/[^a-zа-яё0-9]+/).filter(Boolean).every((w) => STOP_WORDS.has(w));
    return onlyStopWords && /[a-zа-яё]/i.test(q) ? null : Prisma.sql`FALSE`;
  }
  const perToken = tokens.map((token) => {
    const alts = alternatives(token);
    const fts = Prisma.join(alts.map((a) => Prisma.sql`m."searchVector" @@ plainto_tsquery('russian', ${a})`), " OR ");
    const text = Prisma.join(alts.map((a, i) => textMatch(a, i > 0)), " OR ");
    return Prisma.sql`(${fts} OR ${text})`;
  });
  return Prisma.join(perToken, " AND ");
}

/**
 * Поиск по опубликованным материалам: полнотекстовый поиск PostgreSQL с русской морфологией
 * (рефлексия ≈ рефлексии), синонимы и поиск по началу слова («геймиф»).
 */
function buildWhere(f: LibraryFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`m."status" = 'PUBLISHED'`];
  if (f.q) {
    const cond = textCondition(f.q);
    if (cond) parts.push(Prisma.sql`(${cond})`);
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

/** Количество материалов каждого типа при текущих фильтрах (без учёта фильтра по типу). */
export async function countByType(f: LibraryFilters, within?: MaterialType[]) {
  const where = buildWhere({ ...f, types: within ?? [] });
  const rows = await prisma.$queryRaw<{ type: MaterialType; count: bigint }[]>`
    SELECT m."type"::text AS type, COUNT(*)::bigint AS count FROM "Material" m WHERE ${where} GROUP BY m."type"`;
  return Object.fromEntries(rows.map((r) => [r.type, Number(r.count)])) as Partial<Record<MaterialType, number>>;
}

export async function getTaxonomy() {
  const categories = await prisma.category.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return {
    subjects: categories.filter((c) => c.kind === "SUBJECT"),
    tasks: categories.filter((c) => c.kind === "TASK"),
    techs: categories.filter((c) => c.kind === "TECHNOLOGY"),
  };
}
