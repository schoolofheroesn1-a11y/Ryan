"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formValues, toActionState } from "@/server/action";
import { getCurrentUser } from "@/server/auth";
import { createReport, createReview, toggleBookmark } from "@/server/community";
import { prisma } from "@/lib/db";

async function materialPath(id: string) {
  const m = await prisma.material.findUnique({ where: { id }, select: { slug: true } });
  return m ? `/m/${m.slug}` : "/";
}

export async function toggleBookmarkAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("materialId") ?? "");
  const state = await toActionState(async () => {
    const saved = await toggleBookmark(await getCurrentUser(), id);
    return { ok: true, message: saved ? "Добавлено в избранное" : "Удалено из избранного" };
  });
  if (state.ok) {
    revalidatePath(await materialPath(id));
    revalidatePath("/me");
  }
  return state;
}

export async function createReviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("materialId") ?? "");
  const state = await toActionState(async () => {
    await createReview(await getCurrentUser(), {
      materialId: id,
      raw: {
        body: String(form.get("body") ?? ""),
        appliedInPractice: form.get("appliedInPractice") === "on",
        context: String(form.get("context") ?? ""),
      },
    });
    return { ok: true, message: "Спасибо! Отзыв появится на странице после проверки редакцией." };
  });
  return state.ok ? state : { ...state, values: formValues(form) };
}

export async function createReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await createReport(await getCurrentUser(), {
      materialId: String(form.get("materialId") ?? ""),
      raw: { reason: String(form.get("reason") ?? ""), body: String(form.get("body") ?? "") },
    });
    return { ok: true, message: "Сообщение отправлено редакции. Спасибо, что помогаете поддерживать качество." };
  });
  return state.ok ? state : { ...state, values: formValues(form) };
}
