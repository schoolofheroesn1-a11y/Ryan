import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div className="container-page py-20">
      <p className="eyebrow">Ошибка 404</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Страница не найдена</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Возможно, материал снят с публикации, ещё не прошёл модерацию или ссылка содержит ошибку. Попробуйте найти решение через поиск.
      </p>
      <div className="mt-6 max-w-2xl"><SearchBox size="md" /></div>
      <Link href="/library" className="link mt-6 inline-block">Открыть библиотеку</Link>
    </div>
  );
}
