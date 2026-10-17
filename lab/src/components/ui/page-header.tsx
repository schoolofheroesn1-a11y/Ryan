import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children, actions, note }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode; note?: string }) {
  return (
    <header className="margin-rule border-b border-line bg-surface/80">
      <div className="container-page flex flex-col gap-5 py-9 sm:py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-3 text-accent">{eyebrow}</p>}
          <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight sm:text-[36px]">{title}</h1>
          {children && <div className="mt-4 max-w-2xl text-[16.5px] leading-relaxed text-ink-soft">{children}</div>}
          {note && <p className="mt-3 font-hand text-[22px] leading-tight text-danger">{note}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
