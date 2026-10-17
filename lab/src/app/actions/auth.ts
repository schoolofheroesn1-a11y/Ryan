"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { safeNext } from "@/lib/safe-redirect";
import { toActionState, formValues } from "@/server/action";
import { signIn, signOut } from "@/server/auth";
import { authenticate, registerUser } from "@/server/users";

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  let userId = "";
  const state = await toActionState(async () => {
    const user = await authenticate({ email: form.get("email"), password: form.get("password") });
    userId = user.id;
  });
  if (!state.ok) return { ...state, values: { email: String(form.get("email") ?? "") } };
  await signIn(userId);
  redirect(safeNext(form.get("next")));
}

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  let userId = "";
  const state = await toActionState(async () => {
    const user = await registerUser({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    userId = user.id;
  });
  if (!state.ok) {
    const values = formValues(form);
    delete values.password;
    return { ...state, values };
  }
  await signIn(userId);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}
