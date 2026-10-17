export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-lg border px-3 py-2 text-sm ${ok ? "border-ok/20 bg-ok-soft text-ok" : "border-danger/20 bg-danger-soft text-danger"}`}
    >
      {message}
    </p>
  );
}
