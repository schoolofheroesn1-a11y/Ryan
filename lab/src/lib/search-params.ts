import type { CostLevel, DeliveryFormat, MaterialType, SkillLevel, VerificationStatus } from "@prisma/client";
import { materialTypes } from "./validation";

export type SortKey = "relevance" | "new" | "updated" | "prep";
export type PrepBucket = "15" | "60" | "more";
export type PeriodKey = "30" | "90" | "365";

export type LibraryFilters = {
  q: string;
  types: MaterialType[];
  subject: string | null;
  grade: number | null;
  task: string | null;
  tech: string | null;
  prep: PrepBucket | null;
  cost: CostLevel[];
  skill: SkillLevel | null;
  format: DeliveryFormat | null;
  verification: VerificationStatus[];
  period: PeriodKey | null;
  sort: SortKey;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => arr(v)[0] ?? "";

function pick<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Разбирает и нормализует параметры URL; неизвестные значения отбрасываются. */
export function parseLibraryFilters(raw: Raw): LibraryFilters {
  const grade = Number(one(raw.grade));
  const page = Number(one(raw.page));
  const q = one(raw.q).trim().slice(0, 200);
  const sortRaw = one(raw.sort);
  const sort: SortKey = (["relevance", "new", "updated", "prep"] as const).includes(sortRaw as SortKey)
    ? (sortRaw as SortKey)
    : q
      ? "relevance"
      : "new";
  return {
    q,
    types: pick(arr(raw.type), materialTypes),
    subject: one(raw.subject).slice(0, 60) || null,
    grade: Number.isInteger(grade) && grade >= 1 && grade <= 11 ? grade : null,
    task: one(raw.task).slice(0, 60) || null,
    tech: one(raw.tech).slice(0, 60) || null,
    prep: pick([one(raw.prep)], ["15", "60", "more"] as const)[0] ?? null,
    cost: pick(arr(raw.cost), ["FREE", "FREEMIUM", "PAID"] as const),
    skill: pick([one(raw.skill)], ["BASIC", "MEDIUM", "ADVANCED"] as const)[0] ?? null,
    format: pick([one(raw.format)], ["OFFLINE", "ONLINE", "BLENDED"] as const)[0] ?? null,
    verification: pick(arr(raw.verification), [
      "NOT_TESTED",
      "AUTHOR_TESTED",
      "MULTI_TEACHER",
      "INDEPENDENT",
      "NEEDS_RECHECK",
    ] as const),
    period: pick([one(raw.period)], ["30", "90", "365"] as const)[0] ?? null,
    sort,
    page: Number.isInteger(page) && page > 1 && page < 1000 ? page : 1,
  };
}

export function activeFilterCount(f: LibraryFilters): number {
  return (
    f.types.length +
    f.cost.length +
    f.verification.length +
    [f.subject, f.grade, f.task, f.tech, f.prep, f.skill, f.format, f.period].filter((v) => v != null).length
  );
}

/** Собирает строку запроса, сохраняя текущие фильтры и меняя указанные. */
export function filtersToQuery(f: LibraryFilters, patch: Partial<LibraryFilters> = {}): string {
  const m = { ...f, ...patch };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  m.types.forEach((t) => p.append("type", t));
  if (m.subject) p.set("subject", m.subject);
  if (m.grade) p.set("grade", String(m.grade));
  if (m.task) p.set("task", m.task);
  if (m.tech) p.set("tech", m.tech);
  if (m.prep) p.set("prep", m.prep);
  m.cost.forEach((c) => p.append("cost", c));
  if (m.skill) p.set("skill", m.skill);
  if (m.format) p.set("format", m.format);
  m.verification.forEach((v) => p.append("verification", v));
  if (m.period) p.set("period", m.period);
  if (m.sort !== (m.q ? "relevance" : "new")) p.set("sort", m.sort);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
