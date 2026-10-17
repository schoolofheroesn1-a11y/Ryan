import { Search } from "lucide-react";

export function SearchBox({ defaultValue = "", size = "lg", autoFocus = false }: { defaultValue?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  const lg = size === "lg";
  return (
    <form action="/library" method="get" role="search" className={`flex w-full gap-2 ${lg ? "border-[3px] border-ink bg-white p-1.5 shadow-[6px_6px_0_0_var(--color-ink)] focus-within:shadow-[6px_6px_0_0_var(--color-cyan)]" : ""}`}>
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
          className={lg ? "h-12 w-full min-w-0 bg-transparent pl-11 pr-3 font-mono text-[15px] text-ink placeholder:text-muted focus:outline-none sm:h-14 sm:text-[16px]" : "input h-11 pl-9"}
          maxLength={200}
        />
      </div>
      <button type="submit" className={`btn-primary shadow-none ${lg ? "h-12 px-5 sm:h-14 sm:px-7 sm:text-[14px]" : "h-11"}`}>
        Найти
      </button>
    </form>
  );
}
