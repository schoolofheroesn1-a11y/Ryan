import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-[3px] border-ink bg-ink text-[#e8e8e8]">
      <div className="container-page grid gap-10 py-12 text-[14px] sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-white">
            <FlaskConical aria-hidden className="h-5 w-5 text-marker" /> Лаборатория педагогических технологий
          </p>
          <p className="mt-3 max-w-sm leading-relaxed">
            Независимая исследовательская площадка: проверяем, какую педагогическую задачу решает технология, насколько хорошо и какой ценой.
          </p>
          <p className="mt-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-marker">сначала проверяем — потом советуем</p>
        </div>
        <nav aria-label="Разделы" className="flex flex-col gap-2.5">
          <p className="eyebrow text-[#8d92b8]">Разделы</p>
          <Link href="/library" className="hover:text-white">Библиотека решений</Link>
          <Link href="/practice" className="hover:text-white">Фишки и кейсы</Link>
          <Link href="/research" className="hover:text-white">Лаборатория испытаний</Link>
          <Link href="/methodology" className="hover:text-white">Методика и статусы проверки</Link>
        </nav>
        <div className="flex flex-col gap-2.5">
          <p className="eyebrow text-[#8d92b8]">Участие</p>
          <Link href="/submit" className="hover:text-white">Предложить материал</Link>
          <Link href="/register" className="hover:text-white">Присоединиться к сообществу</Link>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8d92b8]">
            Материалы с пометкой «Демо-пример» показывают формат и не являются результатами реальных испытаний.
          </p>
        </div>
      </div>
    </footer>
  );
}
