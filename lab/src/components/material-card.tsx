import Link from "next/link";
import type { MaterialType, VerificationStatus } from "@prisma/client";
import { costLabels } from "@/lib/labels";
import { formatDate, formatGrades, formatMinutes } from "@/lib/format";
import { DemoBadge, TypeLabel, VerificationBadge } from "./ui/badges";

export type CardMaterial = {
  slug: string;
  type: MaterialType;
  title: string;
  summary: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  prepTimeMin: number | null;
  cost: "FREE" | "FREEMIUM" | "PAID";
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  updatedAt: Date;
  author: { name: string };
  categories?: { category: { kind: string; name: string } }[];
};

export function MaterialCard({ m, headingLevel = 3 }: { m: CardMaterial; headingLevel?: 2 | 3 }) {
  const subjects = (m.categories ?? []).filter((c) => c.category.kind === "SUBJECT").map((c) => c.category.name);
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card group relative flex h-full flex-col p-5 transition-shadow hover:shadow-[0_2px_16px_rgba(22,24,29,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <TypeLabel type={m.type} />
        {m.isDemo && <DemoBadge />}
      </div>
      <H className="mt-2 text-[17px] font-semibold leading-snug">
        <Link href={`/m/${m.slug}`} className="after:absolute after:inset-0 group-hover:text-accent">
          {m.title}
        </Link>
      </H>
      <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-ink-soft">{m.summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        <div>
          <dt className="sr-only">Для кого</dt>
          <dd className="text-muted">{subjects.slice(0, 2).join(", ") || "Любой предмет"} · {formatGrades(m.gradeFrom, m.gradeTo)}</dd>
        </div>
        <div>
          <dt className="sr-only">Подготовка и стоимость</dt>
          <dd className="text-muted">Подготовка {formatMinutes(m.prepTimeMin)} · {costLabels[m.cost]}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <VerificationBadge status={m.verificationStatus} size="sm" />
        <span className="text-[12.5px] text-muted">
          {m.author.name} · обновлено {formatDate(m.updatedAt)}
        </span>
      </div>
    </article>
  );
}
