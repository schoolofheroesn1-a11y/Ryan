const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "не указано";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatGrades(from: number | null | undefined, to: number | null | undefined): string {
  if (from == null && to == null) return "любой класс";
  if (from != null && to != null) return from === to ? `${from} класс` : `${from}–${to} классы`;
  return from != null ? `с ${from} класса` : `до ${to} класса`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** Разбивает многострочный текст на абзацы для вывода. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
