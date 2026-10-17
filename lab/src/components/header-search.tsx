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
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" />
      <input
        ref={ref}
        id="header-q"
        type="search"
        name="q"
        placeholder="Найти решение…"
        maxLength={200}
        className="input h-10 pl-9 pr-9 text-[13px]"
      />
      <kbd aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 border-2 border-ink bg-marker px-1.5 text-[11px] font-bold">/</kbd>
    </form>
  );
}
