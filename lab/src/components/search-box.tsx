export function SearchBox({ defaultValue = "", size = "lg", autoFocus = false }: { defaultValue?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  return (
    <form action="/library" method="get" role="search" className="flex w-full gap-2">
      <label htmlFor={`search-${size}`} className="sr-only">
        Поиск по задачам, темам и инструментам
      </label>
      <input
        id={`search-${size}`}
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Например: рефлексия за 5 минут, разноуровневые задания, обсуждение сложной темы"
        className={`input flex-1 ${size === "lg" ? "h-14 px-4 text-[16px] sm:text-[17px]" : "h-11"}`}
        maxLength={200}
      />
      <button type="submit" className={`btn-primary ${size === "lg" ? "h-14 px-6 text-[15px]" : "h-11"}`}>
        Найти
      </button>
    </form>
  );
}
