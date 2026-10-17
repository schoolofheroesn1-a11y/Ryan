import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page flex flex-col gap-4 py-8 sm:py-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
          {children && <div className="mt-3 text-[16px] leading-relaxed text-ink-soft">{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
