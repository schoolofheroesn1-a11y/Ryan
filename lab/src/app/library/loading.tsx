export default function Loading() {
  return (
    <div className="container-page py-16" role="status" aria-live="polite">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-neutral-soft" />
      <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-neutral-soft" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-[var(--radius-card)] bg-neutral-soft" />)}
      </div>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
