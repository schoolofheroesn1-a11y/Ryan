import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page grid gap-8 py-10 text-[14px] text-muted sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">Лаборатория педагогических технологий</p>
          <p className="mt-2 max-w-xs">
            Независимая исследовательская площадка: проверяем, какую педагогическую задачу решает технология, насколько хорошо и какой ценой.
          </p>
        </div>
        <nav aria-label="Разделы" className="flex flex-col gap-2">
          <Link href="/library" className="hover:text-ink">Библиотека решений</Link>
          <Link href="/research" className="hover:text-ink">Лаборатория испытаний</Link>
          <Link href="/practice" className="hover:text-ink">Фишки и кейсы</Link>
          <Link href="/methodology" className="hover:text-ink">Методика и статусы проверки</Link>
        </nav>
        <div className="flex flex-col gap-2">
          <Link href="/submit" className="hover:text-ink">Предложить материал</Link>
          <Link href="/register" className="hover:text-ink">Присоединиться к сообществу</Link>
          <p className="mt-2 text-[13px]">Материалы с пометкой «Демо-пример» показывают формат и не являются результатами реальных испытаний.</p>
        </div>
      </div>
    </footer>
  );
}
