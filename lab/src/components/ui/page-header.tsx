import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children, actions, note }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode; note?: string }) {
  return (
    <header className="border-b-[3px] border-ink bg-surface">
      <div className="container-page flex flex-col gap-5 py-9 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="tag-label mb-4">{eyebrow}</p>}
          <h1 className="font-display text-[28px] leading-[1.05] sm:text-[42px]">{title}</h1>
          {children && <div className="mt-4 max-w-2xl border-t-[3px] border-ink pt-4 text-[15px] leading-relaxed text-ink-soft">{children}</div>}
          {note && <p className="mt-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-accent">{note}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}
