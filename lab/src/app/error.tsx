"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-20">
      <p className="eyebrow">Ошибка</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Что-то пошло не так</h1>
      <p className="mt-3 max-w-xl text-ink-soft">Не удалось загрузить страницу. Попробуйте ещё раз через несколько секунд.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Повторить</button>
    </div>
  );
}
