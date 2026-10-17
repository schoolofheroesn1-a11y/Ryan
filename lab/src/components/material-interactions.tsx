"use client";

import { useActionState } from "react";
import { createReportAction, createReviewAction, toggleBookmarkAction } from "@/app/actions/community";
import { initialActionState } from "@/lib/action-state";
import { reportReasonLabels } from "@/lib/labels";
import { FormMessage } from "./ui/form-message";
import { SubmitButton } from "./ui/submit-button";

export function BookmarkButton({ materialId, saved }: { materialId: string; saved: boolean }) {
  const [state, action] = useActionState(toggleBookmarkAction, initialActionState);
  return (
    <form action={action} className="contents">
      <input type="hidden" name="materialId" value={materialId} />
      <SubmitButton className={saved ? "btn-primary" : "btn-secondary"} pendingText="…" aria-pressed={saved}>
        {saved ? "★ В избранном" : "☆ В избранное"}
      </SubmitButton>
      {state.ok === false && <FormMessage message={state.message} />}
    </form>
  );
}

export function ReviewForm({ materialId }: { materialId: string }) {
  const [state, action] = useActionState(createReviewAction, initialActionState);
  if (state.ok) return <FormMessage ok message={state.message} />;
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="materialId" value={materialId} />
      <FormMessage message={state.message} />
      <div>
        <label htmlFor="review-body" className="label">Ваш отзыв</label>
        <textarea id="review-body" name="body" rows={4} className="input" defaultValue={String(v.body ?? "")} aria-invalid={!!state.errors?.body} placeholder="Что сработало, что пришлось изменить, кому подойдёт" />
        {state.errors?.body && <p className="field-error">{state.errors.body}</p>}
      </div>
      <label className="flex items-start gap-2 text-[14px]">
        <input type="checkbox" name="appliedInPractice" defaultChecked={v.appliedInPractice === "on"} className="mt-1 accent-[var(--color-accent)]" />
        <span>Я применял(а) это решение на практике</span>
      </label>
      <div>
        <label htmlFor="review-context" className="label">Где и как применяли</label>
        <input id="review-context" name="context" className="input" defaultValue={String(v.context ?? "")} placeholder="Например: 7 класс, урок биологии, 25 учеников" aria-invalid={!!state.errors?.context} />
        {state.errors?.context ? <p className="field-error">{state.errors.context}</p> : <p className="hint">Обязательно, если отметили применение на практике.</p>}
      </div>
      <div>
        <SubmitButton pendingText="Отправляем…">Отправить отзыв</SubmitButton>
      </div>
      <p className="text-[13px] text-muted">Отзывы публикуются после проверки редакцией.</p>
    </form>
  );
}

export function ReportForm({ materialId, researchSlug }: { materialId?: string; researchSlug?: string }) {
  const [state, action] = useActionState(createReportAction, initialActionState);
  if (state.ok) return <FormMessage ok message={state.message} />;
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {materialId && <input type="hidden" name="materialId" value={materialId} />}
      {researchSlug && <input type="hidden" name="researchSlug" value={researchSlug} />}
      <FormMessage message={state.message} />
      <div>
        <label htmlFor="report-reason" className="label">Что не так</label>
        <select id="report-reason" name="reason" className="input" defaultValue={String(v.reason ?? "")} aria-invalid={!!state.errors?.reason}>
          <option value="" disabled>Выберите причину</option>
          {Object.entries(reportReasonLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {state.errors?.reason && <p className="field-error">{state.errors.reason}</p>}
      </div>
      <div>
        <label htmlFor="report-body" className="label">Опишите проблему</label>
        <textarea id="report-body" name="body" rows={3} className="input" defaultValue={String(v.body ?? "")} aria-invalid={!!state.errors?.body} />
        {state.errors?.body && <p className="field-error">{state.errors.body}</p>}
      </div>
      <div>
        <SubmitButton className="btn-secondary" pendingText="Отправляем…">Отправить редакции</SubmitButton>
      </div>
    </form>
  );
}
