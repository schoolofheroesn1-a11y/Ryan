import { Search } from "lucide-react";

export function SearchBox({ defaultValue = "", size = "lg", autoFocus = false }: { defaultValue?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  const lg = size === "lg";
  return (
    <form action="/library" method="get" role="search" className={`flex w-full gap-2 rounded-2xl ${lg ? "border border-line-strong bg-surface p-1.5 shadow-[var(--shadow-card)] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15" : ""}`}>
      <label htmlFor={`search-${size}`} className="sr-only">
        Поиск по задачам, темам и инструментам
      </label>
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${lg ? "left-3.5 h-5 w-5" : "left-3 h-4 w-4"}`} />
        <input
          id={`search-${size}`}
          type="search"
          name="q"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder={lg ? "Например: рефлексия за 5 минут, разноуровневые задания" : "Задача, тема, инструмент или приём"}
          className={lg ? "h-12 w-full min-w-0 rounded-xl bg-transparent pl-11 pr-3 text-[16px] text-ink placeholder:text-muted focus:outline-none sm:h-14 sm:text-[17px]" : "input h-11 pl-9"}
          maxLength={200}
        />
      </div>
      <button type="submit" className={`btn-primary ${lg ? "h-12 rounded-xl px-5 sm:h-14 sm:px-7 sm:text-[15px]" : "h-11"}`}>
        Найти
      </button>
    </form>
  );
}
