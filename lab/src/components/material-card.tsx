import Link from "next/link";
import type { MaterialType, VerificationStatus } from "@prisma/client";
import { Clock, GraduationCap, Wallet } from "lucide-react";
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
    <article className="card-raised group relative flex h-full flex-col p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-3">
        <TypeLabel type={m.type} />
        {m.isDemo && <DemoBadge />}
      </div>
      <H className="mt-3 text-[17.5px] font-semibold leading-snug tracking-tight">
        <Link href={`/m/${m.slug}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] group-hover:text-accent">
          {m.title}
        </Link>
      </H>
      <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-ink-soft">{m.summary}</p>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted" aria-label="Кратко">
        <li className="inline-flex items-center gap-1.5">
          <Clock aria-hidden className="h-3.5 w-3.5" /> подготовка {formatMinutes(m.prepTimeMin)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <GraduationCap aria-hidden className="h-3.5 w-3.5" /> {formatGrades(m.gradeFrom, m.gradeTo)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Wallet aria-hidden className="h-3.5 w-3.5" /> {costLabels[m.cost].toLowerCase()}
        </li>
      </ul>
      {subjects.length > 0 && <p className="mt-2 text-[12.5px] text-muted">{subjects.slice(0, 3).join(" · ")}</p>}
      <div aria-hidden className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line pt-3.5">
        <VerificationBadge status={m.verificationStatus} size="sm" />
        <span className="text-[12px] text-muted">обновлено {formatDate(m.updatedAt)}</span>
      </div>
    </article>
  );
}
