import type { MaterialType, PublicationStatus, VerificationStatus } from "@prisma/client";
import { materialTypeLabels, publicationStatusLabels, verificationLabels } from "@/lib/labels";

const verificationStyles: Record<VerificationStatus, string> = {
  NOT_TESTED: "bg-neutral-soft text-ink-soft border-line",
  AUTHOR_TESTED: "bg-info-soft text-info border-info/20",
  MULTI_TEACHER: "bg-ok-soft text-ok border-ok/20",
  INDEPENDENT: "bg-ok text-white border-ok",
  NEEDS_RECHECK: "bg-warn-soft text-warn border-warn/25",
};

const verificationIcons: Record<VerificationStatus, string> = {
  NOT_TESTED: "○",
  AUTHOR_TESTED: "◐",
  MULTI_TEACHER: "●",
  INDEPENDENT: "✓",
  NEEDS_RECHECK: "!",
};

export function VerificationBadge({ status, size = "md" }: { status: VerificationStatus; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${verificationStyles[status]} ${
        size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]"
      }`}
      title="Статус проверки — критерии описаны на странице «Методика»"
    >
      <span aria-hidden>{verificationIcons[status]}</span>
      {verificationLabels[status]}
    </span>
  );
}

export function TypeLabel({ type }: { type: MaterialType }) {
  return <span className="eyebrow text-accent">{materialTypeLabels[type]}</span>;
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
      className="inline-flex rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[12px] text-muted"
      title="Демонстрационные данные: показывают формат, но не являются результатом реальной практики"
    >
      {label}
    </span>
  );
}
