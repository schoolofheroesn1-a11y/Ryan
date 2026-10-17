"use client";

import { deleteAttachmentAction } from "@/app/actions/materials";
import { formatFileSize } from "@/lib/format";
import { ActionForm } from "./ui/action-form";
import { SubmitButton } from "./ui/submit-button";

export function AttachmentList({ materialId, attachments }: { materialId: string; attachments: { id: string; fileName: string; size: number }[] }) {
  return (
    <section className="card p-5" aria-labelledby="att-h">
      <h2 id="att-h" className="font-semibold">Прикреплённые файлы</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {attachments.map((a) => (
          <li key={a.id}>
            <ActionForm action={deleteAttachmentAction} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
              <input type="hidden" name="attachmentId" value={a.id} />
              <input type="hidden" name="materialId" value={materialId} />
              <span className="text-[14px]">{a.fileName} <span className="text-muted">· {formatFileSize(a.size)}</span></span>
              <span className="flex gap-2">
                <a href={`/api/attachments/${a.id}`} className="btn-ghost btn-sm">Скачать</a>
                <SubmitButton className="btn-danger btn-sm" pendingText="Удаляем…">Удалить</SubmitButton>
              </span>
            </ActionForm>
          </li>
        ))}
      </ul>
    </section>
  );
}
