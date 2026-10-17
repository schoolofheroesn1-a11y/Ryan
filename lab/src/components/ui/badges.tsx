import type { MaterialType, PublicationStatus, VerificationStatus } from "@prisma/client";
import { BadgeCheck, CircleDashed, CircleDot, RotateCcw, ShieldCheck } from "lucide-react";
import { materialTypeLabels, publicationStatusLabels, verificationLabels } from "@/lib/labels";

/** Статус проверки оформлен как штамп: цвет — как у ручки, которой проверяли. */
const verificationStyles: Record<VerificationStatus, string> = {
  NOT_TESTED: "border-line-strong text-muted bg-surface",
  AUTHOR_TESTED: "border-info/50 text-info bg-info-soft",
  MULTI_TEACHER: "border-ok/50 text-ok bg-ok-soft",
  INDEPENDENT: "border-ok bg-ok text-white",
  NEEDS_RECHECK: "border-warn/50 text-warn bg-warn-soft",
};

const verificationIcons = {
  NOT_TESTED: CircleDashed,
  AUTHOR_TESTED: CircleDot,
  MULTI_TEACHER: BadgeCheck,
  INDEPENDENT: ShieldCheck,
  NEEDS_RECHECK: RotateCcw,
} satisfies Record<VerificationStatus, unknown>;

export function VerificationBadge({ status, size = "md" }: { status: VerificationStatus; size?: "sm" | "md" }) {
  const Icon = verificationIcons[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border-[1.5px] font-semibold uppercase tracking-[0.06em] ${verificationStyles[status]} ${
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"
      }`}
      title="Статус проверки — критерии описаны на странице «Методика»"
    >
      <Icon aria-hidden className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.2} />
      {verificationLabels[status]}
    </span>
  );
}

const typeColors: Record<MaterialType, string> = {
  CASE: "text-accent",
  TIP: "text-[#b23b8a]",
  TOOL_REVIEW: "text-info",
  COMPARISON: "text-[#9a4d00]",
  READY_MATERIAL: "text-ok",
  INTERACTIVE: "text-[#0e7c86]",
  METHOD: "text-[#5b3fb5]",
  TEMPLATE: "text-ink-soft",
};

export function TypeLabel({ type }: { type: MaterialType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] ${typeColors[type]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {materialTypeLabels[type]}
    </span>
  );
}

const statusStyles: Record<PublicationStatus, string> = {
  DRAFT: "bg-neutral-soft text-ink-soft",
  PENDING: "bg-warn-soft text-warn",
  PUBLISHED: "bg-ok-soft text-ok",
  REJECTED: "bg-danger-soft text-danger",
  UNPUBLISHED: "bg-neutral-soft text-muted",
};

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-medium ${statusStyles[status]}`}>
      {publicationStatusLabels[status]}
    </span>
  );
}

export function DemoBadge({ label = "Демо-пример" }: { label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 rounded-md border border-dashed border-line-strong bg-surface px-2 py-0.5 text-[11.5px] text-muted"
      title="Демонстрационные данные: показывают формат, но не являются результатом реальной практики"
    >
      {label}
    </span>
  );
}
