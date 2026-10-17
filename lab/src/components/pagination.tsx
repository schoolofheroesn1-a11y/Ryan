import Link from "next/link";

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Страницы результатов" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn-secondary btn-sm" rel="prev">← Назад</Link>
      ) : (
        <span className="btn-secondary btn-sm opacity-40" aria-hidden>← Назад</span>
      )}
      <span className="px-3 text-sm text-muted">
        Страница {page} из {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="btn-secondary btn-sm" rel="next">Вперёд →</Link>
      ) : (
        <span className="btn-secondary btn-sm opacity-40" aria-hidden>Вперёд →</span>
      )}
    </nav>
  );
}
