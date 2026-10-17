import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCriterionAction,
  addIssueAction,
  addToolAction,
  lockCriteriaAction,
  removeCriterionAction,
  removeIssueAction,
  removeToolAction,
  saveResultsAction,
  setResearchStatusAction,
} from "@/app/actions/admin";
import { ResearchForm } from "@/components/forms/research-form";
import { ActionForm } from "@/components/ui/action-form";
import { PublicationBadge } from "@/components/ui/badges";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { dimensionLabels } from "@/lib/labels";
import { requirePageStaff } from "@/server/auth";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditResearchPage({ params, searchParams }: PageProps<"/admin/research/[id]">) {
  await requirePageStaff();
  const { id } = await params;
  const sp = await searchParams;
  const r = await prisma.research.findUnique({
    where: { id },
    include: { tools: { orderBy: { order: "asc" } }, criteria: { orderBy: { order: "asc" } }, results: true, issues: true },
  });
  if (!r) notFound();
  const locked = !!r.criteriaLockedAt;
  const hidden = <input type="hidden" name="researchId" value={r.id} />;

  return (
    <div className="flex flex-col gap-6">
      {sp.saved && <FormMessage ok message="Исследование сохранено." />}
      <div>
        <h1 className="font-display text-2xl font-semibold">{r.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
          <PublicationBadge status={r.status} />
          {r.status === "PUBLISHED" && <Link href={`/research/${r.slug}`} className="link">Открыть страницу</Link>}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">1. Участники испытания</h2>
        <p className="mt-1 text-[13.5px] text-muted">Название и точная версия инструмента (или дата обращения к онлайн-сервису).</p>
        <ul className="mt-3 flex flex-col gap-2">
          {r.tools.map((t) => (
            <li key={t.id}>
              <ActionForm action={removeToolAction} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-[14px]">
                {hidden}<input type="hidden" name="toolId" value={t.id} />
                <span><b>{t.name}</b> · {t.version}{t.availability && ` · ${t.availability}`}</span>
                {!locked && <SubmitButton className="btn-danger btn-sm">Удалить</SubmitButton>}
              </ActionForm>
            </li>
          ))}
        </ul>
        {!locked && (
          <ActionForm action={addToolAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            {hidden}
            <input name="name" className="input" placeholder="Название *" aria-label="Название инструмента" />
            <input name="version" className="input" placeholder="Версия или дата обращения *" aria-label="Версия" />
            <input name="vendor" className="input" placeholder="Разработчик" aria-label="Разработчик" />
            <input name="pricing" className="input" placeholder="Стоимость" aria-label="Стоимость" />
            <input name="availability" className="input sm:col-span-2" placeholder="Доступность в российских условиях" aria-label="Доступность" />
            <div><SubmitButton className="btn-secondary btn-sm">Добавить инструмент</SubmitButton></div>
          </ActionForm>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">2. Критерии и веса</h2>
        <p className="mt-1 text-[13.5px] text-muted">Задаются до проведения испытания. Измерения оцениваются раздельно; вес — от 1 до 10 внутри измерения.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {r.criteria.map((c) => (
            <li key={c.id}>
              <ActionForm action={removeCriterionAction} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-[14px]">
                {hidden}<input type="hidden" name="criterionId" value={c.id} />
                <span><b>{c.name}</b> · {dimensionLabels[c.dimension]} · вес {c.weight} · шкала 0–{c.scaleMax}</span>
                {!locked && <SubmitButton className="btn-danger btn-sm">Удалить</SubmitButton>}
              </ActionForm>
            </li>
          ))}
        </ul>
        {locked ? (
          <p className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-[14px] text-ok">Критерии и состав участников зафиксированы {formatDate(r.criteriaLockedAt)}. Изменить их нельзя.</p>
        ) : (
          <>
            <ActionForm action={addCriterionAction} className="mt-3 grid gap-2 sm:grid-cols-2">
              {hidden}
              <input name="name" className="input" placeholder="Название критерия *" aria-label="Название критерия" />
              <select name="dimension" className="input" aria-label="Измерение" defaultValue="TECHNICAL">
                {Object.entries(dimensionLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input name="description" className="input sm:col-span-2" placeholder="Как оценивается" aria-label="Описание" />
              <input name="weight" type="number" min={1} max={10} defaultValue={3} className="input" aria-label="Вес" />
              <select name="scaleMax" className="input" aria-label="Шкала" defaultValue="5">
                <option value="3">Шкала 0–3</option><option value="5">Шкала 0–5</option><option value="10">Шкала 0–10</option>
              </select>
              <div><SubmitButton className="btn-secondary btn-sm">Добавить критерий</SubmitButton></div>
            </ActionForm>
            <ActionForm action={lockCriteriaAction} className="mt-4">
              {hidden}
              <SubmitButton className="btn-primary btn-sm">Зафиксировать критерии и начать испытание</SubmitButton>
            </ActionForm>
          </>
        )}
      </section>

      {locked && r.tools.length > 0 && r.criteria.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">3. Результаты</h2>
          <ActionForm action={saveResultsAction} className="mt-3">
            {hidden}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-[14px]">
                <thead><tr><th className="p-2 text-left text-muted">Критерий</th>{r.tools.map((t) => <th key={t.id} className="p-2 text-left">{t.name}</th>)}</tr></thead>
                <tbody>
                  {r.criteria.map((c) => (
                    <tr key={c.id} className="border-t border-line align-top">
                      <th className="p-2 text-left font-normal">{c.name} <span className="text-muted">(0–{c.scaleMax})</span></th>
                      {r.tools.map((t) => {
                        const res = r.results.find((x) => x.toolId === t.id && x.criterionId === c.id);
                        return (
                          <td key={t.id} className="p-2">
                            <input name={`score:${t.id}:${c.id}`} type="number" min={0} max={c.scaleMax} defaultValue={res?.score ?? ""} className="input w-20" aria-label={`Оценка: ${t.name}, ${c.name}`} />
                            <input name={`note:${t.id}:${c.id}`} defaultValue={res?.note ?? ""} className="input mt-1 text-[13px]" placeholder="Комментарий" aria-label={`Комментарий: ${t.name}, ${c.name}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3"><SubmitButton className="btn-primary btn-sm">Сохранить результаты</SubmitButton></div>
          </ActionForm>
        </section>
      )}

      {r.tools.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">4. Ошибки и критические ошибки</h2>
          <p className="mt-1 text-[13.5px] text-muted">Критическая ошибка — та, из-за которой результат нельзя использовать. Она выводится отдельно и не компенсируется оценками.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {r.issues.map((i) => (
              <li key={i.id}>
                <ActionForm action={removeIssueAction} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-[14px]">
                  {hidden}<input type="hidden" name="issueId" value={i.id} />
                  <span>{i.isCritical && <b className="text-danger">Критическая: </b>}{r.tools.find((t) => t.id === i.toolId)?.name} — {i.description}</span>
                  <SubmitButton className="btn-danger btn-sm">Удалить</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addIssueAction} className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr]">
            {hidden}
            <select name="toolId" className="input" aria-label="Инструмент">{r.tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <input name="description" className="input" placeholder="Описание ошибки" aria-label="Описание ошибки" />
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="isCritical" /> Критическая</label>
            <div><SubmitButton className="btn-secondary btn-sm">Добавить</SubmitButton></div>
          </ActionForm>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold">5. Публикация</h2>
        <ActionForm action={setResearchStatusAction} className="mt-3 flex flex-col gap-2">
          {hidden}
          <input name="comment" className="input" placeholder="Комментарий (необязательно)" aria-label="Комментарий" />
          <div className="flex flex-wrap gap-2">
            {r.status !== "PUBLISHED" && <SubmitButton name="status" value="PUBLISHED" className="btn-primary btn-sm">Опубликовать</SubmitButton>}
            {r.status === "PUBLISHED" && <SubmitButton name="status" value="UNPUBLISHED" className="btn-danger btn-sm">Снять с публикации</SubmitButton>}
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Описание исследования</h2>
        <ResearchForm
          id={r.id}
          initial={{
            title: r.title, summary: r.summary, kind: r.kind, question: r.question, hypothesis: r.hypothesis,
            conductedFrom: iso(r.conductedFrom), conductedTo: iso(r.conductedTo), conditions: r.conditions, limitations: r.limitations,
            inputTasks: r.inputTasks, rawResults: r.rawResults, errorsFound: r.errorsFound, resourceCosts: r.resourceCosts,
            manualRework: r.manualRework, pedagogicalCheck: r.pedagogicalCheck, conclusions: r.conclusions,
            recommendations: r.recommendations, reproduction: r.reproduction, isDemo: r.isDemo,
          }}
        />
      </section>
    </div>
  );
}
