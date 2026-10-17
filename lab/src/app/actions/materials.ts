"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { materialFormToObject, materialSubmitSchema, zodFieldErrors } from "@/lib/validation";
import { formValues, toActionState } from "@/server/action";
import { addAttachment, removeAttachment } from "@/server/attachments";
import { getCurrentUser } from "@/server/auth";
import { deleteMaterial, saveMaterial, type SaveIntent } from "@/server/materials";
import { AppError, ValidationError } from "@/server/errors";

const intents: SaveIntent[] = ["draft", "submit", "save", "publish"];

export async function saveMaterialAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const rawIntent = String(form.get("intent") ?? "draft");
  const intent = intents.includes(rawIntent as SaveIntent) ? (rawIntent as SaveIntent) : "draft";
  const id = String(form.get("id") ?? "") || undefined;
  const file = form.get("file");
  let savedId = "";
  let slug = "";
  let fileError = "";

  const hasFile = file instanceof File && file.size > 0;
  const raw = materialFormToObject(form);

  const state = await toActionState(async () => {
    // Отправленный на модерацию материал автор изменить уже не может, поэтому файл
    // прикрепляется к черновику, а статус меняется последним шагом.
    const deferSubmit = hasFile && intent === "submit";
    if (deferSubmit) {
      const check = materialSubmitSchema.safeParse(raw);
      if (!check.success) throw new ValidationError("Проверьте поля формы", zodFieldErrors(check.error));
    }
    const material = await saveMaterial(user, { id, raw, intent: deferSubmit ? "draft" : intent });
    savedId = material.id;
    slug = material.slug;
    if (hasFile) {
      try {
        await addAttachment(user, { materialId: savedId, file: file as File });
      } catch (e) {
        if (!(e instanceof AppError)) console.error(e);
        fileError = e instanceof AppError ? e.message : "Не удалось сохранить файл";
      }
    }
    if (deferSubmit && !fileError) await saveMaterial(user, { id: savedId, raw, intent: "submit" });
  });
  if (!state.ok) return { ...state, values: formValues(form) };

  revalidatePath("/library");
  revalidatePath(`/m/${slug}`);
  revalidatePath("/me");
  const fe = fileError ? `&fileError=${encodeURIComponent(fileError)}` : "";
  if (intent === "submit" && !fileError) redirect(`/me?tab=publications&submitted=1`);
  if (intent === "save" || intent === "publish") redirect(`/admin/materials/${savedId}?saved=${intent}${fe}`);
  redirect(`/me/materials/${savedId}/edit?saved=${intent}${fe}`);
}

export async function deleteAttachmentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await removeAttachment(await getCurrentUser(), String(form.get("attachmentId") ?? ""));
    return { ok: true, message: "Файл удалён" };
  });
  if (state.ok) revalidatePath(`/me/materials/${String(form.get("materialId"))}/edit`);
  return state;
}

export async function deleteMaterialAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await deleteMaterial(await getCurrentUser(), String(form.get("materialId") ?? ""));
  });
  if (!state.ok) return state;
  revalidatePath("/library");
  redirect(String(form.get("returnTo") ?? "") === "admin" ? "/admin/materials" : "/me?tab=publications");
}
