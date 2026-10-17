"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

/** Компактный поиск в шапке; клавиша «/» переводит в него фокус. */
export function HeaderSearch() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form action="/library" method="get" role="search" className="relative hidden w-full max-w-[240px] xl:block">
      <label htmlFor="header-q" className="sr-only">Поиск по библиотеке</label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        id="header-q"
        type="search"
        name="q"
        placeholder="Найти решение…"
        maxLength={200}
        className="h-10 w-full rounded-[10px] border border-line bg-paper pl-9 pr-9 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
      <kbd aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line-strong bg-surface px-1.5 text-[11px] text-muted">/</kbd>
    </form>
  );
}
