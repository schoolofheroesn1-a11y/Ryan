import type { ActionState } from "@/lib/action-state";
import { AppError, ValidationError } from "./errors";

/** Преобразует ошибки сервисов в состояние формы. Неожиданные ошибки не раскрываются клиенту. */
export async function toActionState(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message, errors: e.fieldErrors };
    if (e instanceof AppError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Не удалось выполнить действие. Попробуйте ещё раз или сообщите редакции." };
  }
}

export function formValues(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$") || key === "file") continue;
    const all = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}
