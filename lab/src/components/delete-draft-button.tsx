"use client";

import { deleteMaterialAction } from "@/app/actions/materials";
import { ActionForm } from "./ui/action-form";
import { SubmitButton } from "./ui/submit-button";

export function DeleteDraftButton({ materialId, returnTo }: { materialId: string; returnTo?: "admin" }) {
  return (
    <ActionForm action={deleteMaterialAction} className="contents">
      <input type="hidden" name="materialId" value={materialId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <SubmitButton
        className="btn-danger btn-sm"
        pendingText="Удаляем…"
        onClick={(e) => {
          if (!confirm("Удалить материал без возможности восстановления?")) e.preventDefault();
        }}
      >
        Удалить
      </SubmitButton>
    </ActionForm>
  );
}
