"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CategoryKind, PublicationStatus, ReportStatus, Role, VerificationStatus } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { formValues, toActionState } from "@/server/action";
import { getCurrentUser } from "@/server/auth";
import { moderateReview, resolveReport } from "@/server/community";
import { moderateMaterial, setMaterialVerification, type ModerationDecision } from "@/server/materials";
import {
  addCriterion,
  addIssue,
  addTool,
  lockCriteria,
  removeCriterion,
  removeIssue,
  removeTool,
  researchFields,
  saveResearch,
  saveResults,
  setResearchStatus,
} from "@/server/research";
import { createCategory, deleteCategory, deleteTag, renameCategory, renameTag } from "@/server/taxonomy";
import { setUserBlocked, setUserRole } from "@/server/users";

const str = (form: FormData, key: string) => String(form.get(key) ?? "");

async function revalidateMaterial(id: string) {
  const m = await prisma.material.findUnique({ where: { id }, select: { slug: true } });
  if (m) revalidatePath(`/m/${m.slug}`);
  revalidatePath("/library");
  revalidatePath("/");
  revalidatePath(`/admin/materials/${id}`);
}

export async function moderateMaterialAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, "id");
  const decision = str(form, "decision") as ModerationDecision;
  const state = await toActionState(async () => {
    await moderateMaterial(await getCurrentUser(), { id, decision, comment: str(form, "comment") });
    return { ok: true, message: "Решение сохранено" };
  });
  if (state.ok) await revalidateMaterial(id);
  return state;
}

export async function setVerificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, "id");
  const state = await toActionState(async () => {
    await setMaterialVerification(await getCurrentUser(), {
      id,
      status: str(form, "status") as VerificationStatus,
      comment: str(form, "comment"),
      researchId: str(form, "researchId") || null,
    });
    return { ok: true, message: "Статус проверки обновлён" };
  });
  if (state.ok) await revalidateMaterial(id);
  return state;
}

export async function moderateReviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    const r = await moderateReview(await getCurrentUser(), { id: str(form, "id"), approve: str(form, "approve") === "1" });
    await revalidateMaterial(r.materialId);
  });
  revalidatePath("/admin/reviews");
  return state;
}

export async function resolveReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await resolveReport(await getCurrentUser(), {
      id: str(form, "id"),
      status: str(form, "status") as ReportStatus,
      resolution: str(form, "resolution"),
    });
  });
  revalidatePath("/admin/reports");
  return state;
}

// --- Исследования ---

export async function saveResearchAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, "id") || undefined;
  const raw: Record<string, unknown> = { kind: str(form, "kind"), isDemo: form.get("isDemo") === "on" };
  for (const f of researchFields) raw[f] = str(form, f);
  let savedId = "";
  const state = await toActionState(async () => {
    savedId = (await saveResearch(await getCurrentUser(), { id, raw })).id;
  });
  if (!state.ok) return { ...state, values: formValues(form) };
  revalidatePath("/research");
  redirect(`/admin/research/${savedId}?saved=1`);
}

function researchAction(fn: (form: FormData) => Promise<unknown>, message?: string) {
  return async (form: FormData): Promise<ActionState> => {
    const state = await toActionState(async () => {
      await fn(form);
      return { ok: true, message };
    });
    const rid = str(form, "researchId");
    if (rid) revalidatePath(`/admin/research/${rid}`);
    revalidatePath("/research", "layout");
    return state;
  };
}

export async function addToolAction(_: ActionState, form: FormData) {
  return researchAction(async (f) =>
    addTool(await getCurrentUser(), {
      researchId: str(f, "researchId"),
      name: str(f, "name"),
      version: str(f, "version"),
      vendor: str(f, "vendor"),
      pricing: str(f, "pricing"),
      availability: str(f, "availability"),
    }),
  )(form);
}

export async function removeToolAction(_: ActionState, form: FormData) {
  return researchAction(async (f) => removeTool(await getCurrentUser(), str(f, "toolId")))(form);
}

export async function addCriterionAction(_: ActionState, form: FormData) {
  return researchAction(async (f) =>
    addCriterion(await getCurrentUser(), {
      researchId: str(f, "researchId"),
      name: str(f, "name"),
      description: str(f, "description"),
      dimension: str(f, "dimension"),
      weight: Number(str(f, "weight")),
      scaleMax: Number(str(f, "scaleMax")),
    }),
  )(form);
}

export async function removeCriterionAction(_: ActionState, form: FormData) {
  return researchAction(async (f) => removeCriterion(await getCurrentUser(), str(f, "criterionId")))(form);
}

export async function lockCriteriaAction(_: ActionState, form: FormData) {
  return researchAction(async (f) => lockCriteria(await getCurrentUser(), str(f, "researchId")), "Критерии зафиксированы")(form);
}

export async function saveResultsAction(_: ActionState, form: FormData) {
  return researchAction(async (f) => {
    const entries: { toolId: string; criterionId: string; score: number | null; note: string }[] = [];
    for (const key of f.keys()) {
      const m = key.match(/^score:([^:]+):([^:]+)$/);
      if (!m) continue;
      const raw = str(f, key).trim();
      entries.push({
        toolId: m[1],
        criterionId: m[2],
        score: raw === "" ? null : Number(raw),
        note: str(f, `note:${m[1]}:${m[2]}`),
      });
    }
    await saveResults(await getCurrentUser(), { researchId: str(f, "researchId"), entries });
  }, "Результаты сохранены")(form);
}

export async function addIssueAction(_: ActionState, form: FormData) {
  return researchAction(async (f) =>
    addIssue(await getCurrentUser(), {
      researchId: str(f, "researchId"),
      toolId: str(f, "toolId"),
      description: str(f, "description"),
      isCritical: f.get("isCritical") === "on",
    }),
  )(form);
}

export async function removeIssueAction(_: ActionState, form: FormData) {
  return researchAction(async (f) => removeIssue(await getCurrentUser(), str(f, "issueId")))(form);
}

export async function setResearchStatusAction(_: ActionState, form: FormData) {
  return researchAction(
    async (f) =>
      setResearchStatus(await getCurrentUser(), {
        id: str(f, "researchId"),
        status: str(f, "status") as PublicationStatus,
        comment: str(f, "comment"),
      }),
    "Статус исследования обновлён",
  )(form);
}

// --- Справочники ---

export async function createCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await createCategory(await getCurrentUser(), { kind: str(form, "kind") as CategoryKind, name: str(form, "name") });
  });
  revalidatePath("/admin/taxonomy");
  return state;
}

export async function renameCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await renameCategory(await getCurrentUser(), { id: str(form, "id"), name: str(form, "name") });
    return { ok: true, message: "Сохранено" };
  });
  revalidatePath("/admin/taxonomy");
  return state;
}

export async function deleteCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => deleteCategory(await getCurrentUser(), str(form, "id")));
  revalidatePath("/admin/taxonomy");
  return state;
}

export async function renameTagAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await renameTag(await getCurrentUser(), { id: str(form, "id"), name: str(form, "name") });
    return { ok: true, message: "Сохранено" };
  });
  revalidatePath("/admin/taxonomy");
  return state;
}

export async function deleteTagAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => deleteTag(await getCurrentUser(), str(form, "id")));
  revalidatePath("/admin/taxonomy");
  return state;
}

// --- Пользователи ---

export async function setRoleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await setUserRole(await getCurrentUser(), { userId: str(form, "userId"), role: str(form, "role") as Role });
    return { ok: true, message: "Роль изменена" };
  });
  revalidatePath("/admin/users");
  return state;
}

export async function setBlockedAction(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    await setUserBlocked(await getCurrentUser(), { userId: str(form, "userId"), blocked: str(form, "blocked") === "1" });
  });
  revalidatePath("/admin/users");
  return state;
}
