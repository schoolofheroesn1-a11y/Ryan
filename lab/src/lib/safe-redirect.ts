/** Разрешает только относительные пути внутри сайта, чтобы ?next= нельзя было использовать для перенаправления на чужой сайт. */
export function safeNext(value: unknown, fallback = "/me"): string {
  const v = typeof value === "string" ? value : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
