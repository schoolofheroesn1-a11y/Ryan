"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formValues, toActionState } from "@/server/action";
import { getCurrentUser } from "@/server/auth";
import { changePassword, updateProfile } from "@/server/users";
import { signIn } from "@/server/auth";

export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const state = await toActionState(async () => {
    await updateProfile(user, {
      name: String(form.get("name") ?? ""),
      specialization: String(form.get("specialization") ?? ""),
      bio: String(form.get("bio") ?? ""),
      links: String(form.get("links") ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    });
    return { ok: true, message: "Профиль сохранён" };
  });
  if (state.ok && user) revalidatePath("/", "layout");
  return state.ok ? state : { ...state, values: formValues(form) };
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const state = await toActionState(async () => {
    await changePassword(user, { current: String(form.get("current") ?? ""), next: String(form.get("next") ?? "") });
    return { ok: true, message: "Пароль изменён. Все остальные сеансы завершены." };
  });
  if (state.ok && user) await signIn(user.id);
  return state;
}
