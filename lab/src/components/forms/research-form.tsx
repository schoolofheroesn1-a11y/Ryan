"use client";

import { useActionState } from "react";
import { saveResearchAction } from "@/app/actions/admin";
import { initialActionState } from "@/lib/action-state";
import { researchKindLabels } from "@/lib/labels";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { TextArea, TextField } from "./field";

const fields: [string, string, number, string?][] = [
  ["question", "Исследовательский вопрос *", 2],
  ["hypothesis", "Гипотеза", 2],
  ["conditions", "Условия испытания", 4, "Где, с кем, сколько запусков, кто оценивал."],
  ["limitations", "Ограничения испытания", 3, "Чего это испытание не доказывает."],
  ["inputTasks", "Одинаковые исходные задания", 4, "Точные формулировки запросов и входные данные."],
  ["rawResults", "Исходные результаты", 5],
  ["errorsFound", "Обнаруженные ошибки", 3],
  ["resourceCosts", "Затраты времени и ресурсов", 3],
  ["manualRework", "Необходимость ручной доработки", 3],
  ["pedagogicalCheck", "Результаты педагогической проверки", 3, "Если не проводилась — так и напишите."],
  ["conclusions", "Выводы", 4],
  ["recommendations", "Рекомендации", 3],
  ["reproduction", "Материалы для воспроизведения", 4],
];

export function ResearchForm({ id, initial }: { id?: string; initial: Record<string, string | boolean> }) {
  const [state, action] = useActionState(saveResearchAction, initialActionState);
  const v: Record<string, unknown> = { ...initial, ...(state.values ?? {}) };
  const s = (k: string) => String(v[k] ?? "");
  const e = state.errors ?? {};
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <FormMessage ok={state.ok} message={state.message} />
      <TextField label="Название" name="title" required defaultValue={s("title")} error={e.title} />
      <TextArea label="Краткое описание" name="summary" required rows={2} defaultValue={s("summary")} error={e.summary} />
      <div>
        <label htmlFor="f-kind" className="label">Вид проверки</label>
        <select id="f-kind" name="kind" className="input" defaultValue={s("kind") || "TECHNICAL"}>
          {Object.entries(researchKindLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Начало испытания" name="conductedFrom" type="date" defaultValue={s("conductedFrom")} error={e.conductedFrom} />
        <TextField label="Окончание" name="conductedTo" type="date" defaultValue={s("conductedTo")} error={e.conductedTo} />
      </div>
      {fields.map(([name, label, rows, hint]) => (
        <TextArea key={name} label={label} name={name} rows={rows} defaultValue={s(name)} error={e[name]} hint={hint} />
      ))}
      <label className="flex items-start gap-2 text-[14px]">
        <input type="checkbox" name="isDemo" defaultChecked={v.isDemo === true || v.isDemo === "on"} className="mt-1" />
        <span>Учебный пример (испытание не проводилось, данные условные)</span>
      </label>
      <div><SubmitButton>Сохранить</SubmitButton></div>
    </form>
  );
}
