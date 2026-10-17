"use client";

import { useActionState } from "react";
import { saveMaterialAction } from "@/app/actions/materials";
import { initialActionState } from "@/lib/action-state";
import { costLabels, formatLabels, licenseOptions, materialTypeLabels, materialTypeOrder, skillLabels } from "@/lib/labels";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { CheckboxGroup, TextArea, TextField } from "./field";

export type MaterialFormValues = Record<string, string | string[]>;
type Option = { value: string; label: string };

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card flex flex-col gap-5 p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="eyebrow">Шаг {n}</p>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

export function MaterialForm({
  id,
  initial,
  subjects,
  tasks,
  techs,
  isStaff,
  hasAttachmentSlot,
  republishWarning,
}: {
  id?: string;
  initial: MaterialFormValues;
  subjects: Option[];
  tasks: Option[];
  techs: Option[];
  isStaff: boolean;
  hasAttachmentSlot: boolean;
  republishWarning: boolean;
}) {
  const [state, action] = useActionState(saveMaterialAction, initialActionState);
  const v = { ...initial, ...(state.values ?? {}) };
  const s = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]).join(", ") : String(v[k] ?? ""));
  const arr = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : v[k] ? [String(v[k])] : []);
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6" noValidate encType="multipart/form-data">
      {id && <input type="hidden" name="id" value={id} />}
      {state.message && (
        <div className="sticky top-20 z-10">
          <FormMessage ok={state.ok} message={state.message + (Object.keys(e).length ? ` (полей с ошибками: ${Object.keys(e).length})` : "")} />
        </div>
      )}

      <Section n={1} title="Тип и описание" hint="Короткое описание показывается в карточке каталога — сформулируйте его так, чтобы учитель сразу понял, чем поможет материал.">
        <div>
          <label htmlFor="f-type" className="label">Тип публикации <span className="text-danger" aria-hidden>*</span></label>
          <select id="f-type" name="type" className="input" defaultValue={s("type")} aria-invalid={!!e.type} required>
            <option value="" disabled>Выберите тип</option>
            {materialTypeOrder.map((t) => <option key={t} value={t}>{materialTypeLabels[t]}</option>)}
          </select>
          {e.type && <p className="field-error">{e.type}</p>}
        </div>
        <TextField label="Название" name="title" required defaultValue={s("title")} error={e.title} maxLength={160} hint="Например: «Рефлексия за пять минут: три незаконченных предложения»" />
        <TextArea label="Краткое описание" name="summary" required rows={3} defaultValue={s("summary")} error={e.summary} maxLength={600} hint="2–3 предложения: что это и какой результат даёт." />
        <TextArea label="Какую педагогическую задачу решает" name="problem" required rows={3} defaultValue={s("problem")} error={e.problem} hint="Опишите проблему, с которой сталкивается учитель." />
      </Section>

      <Section n={2} title="Для кого подходит" hint="Эти поля используются в фильтрах каталога.">
        <TextArea label="Аудитория" name="audience" required rows={2} defaultValue={s("audience")} error={e.audience} hint="Например: учителя истории 7–9 классов, классы до 30 человек." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Класс, с" name="gradeFrom" type="number" min={1} max={11} defaultValue={s("gradeFrom")} error={e.gradeFrom} />
          <TextField label="Класс, по" name="gradeTo" type="number" min={1} max={11} defaultValue={s("gradeTo")} error={e.gradeTo} hint="Оставьте пустым, если подходит для любого класса." />
        </div>
        <CheckboxGroup legend="Предметы" name="subjectIds" options={subjects} selected={arr("subjectIds")} error={e.subjectIds} required />
        <CheckboxGroup legend="Педагогические задачи" name="taskIds" options={tasks} selected={arr("taskIds")} error={e.taskIds} required />
        <CheckboxGroup legend="Типы технологий" name="techIds" options={techs} selected={arr("techIds")} error={e.techIds} />
        <TextField label="Теги" name="tags" defaultValue={s("tags")} error={e.tags} hint="Через запятую, до 12 тегов: рефлексия, обратная связь, без гаджетов" />
        <CheckboxGroup legend="Формат проведения" name="formats" options={Object.entries(formatLabels).map(([value, label]) => ({ value, label }))} selected={arr("formats")} error={e.formats} required />
        <div>
          <label htmlFor="f-skill" className="label">Необходимый уровень цифровых навыков</label>
          <select id="f-skill" name="digitalSkill" className="input" defaultValue={s("digitalSkill") || "BASIC"}>
            {Object.entries(skillLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </Section>

      <Section n={3} title="Инструкция и пример">
        <TextArea label="Необходимые инструменты и ресурсы" name="resources" rows={3} defaultValue={s("resources")} error={e.resources} />
        <TextArea label="Шаги инструкции" name="steps" required rows={8} defaultValue={arr("steps").join("\n")} error={e.steps} hint="Каждый шаг — с новой строки. Минимум два шага." />
        <TextArea label="Промпты (если есть)" name="prompts" rows={5} defaultValue={arr("prompts").join("\n---\n")} error={e.prompts} hint="Если промптов несколько, разделите их строкой из трёх дефисов: ---" />
        <TextArea label="Пример применения" name="example" rows={4} defaultValue={s("example")} error={e.example} />
        <TextArea label="Как адаптировать" name="adaptation" rows={3} defaultValue={s("adaptation")} error={e.adaptation} hint="Для других классов, предметов или дистанционного формата." />
      </Section>

      <Section n={4} title="Время, стоимость, ограничения">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Время подготовки, минут" name="prepTimeMin" type="number" min={0} required defaultValue={s("prepTimeMin")} error={e.prepTimeMin} />
          <TextField label="Время на занятии, минут" name="lessonTimeMin" type="number" min={0} defaultValue={s("lessonTimeMin")} error={e.lessonTimeMin} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-cost" className="label">Стоимость использования</label>
            <select id="f-cost" name="cost" className="input" defaultValue={s("cost") || "FREE"}>
              {Object.entries(costLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <TextField label="Уточнение о стоимости" name="costNote" defaultValue={s("costNote")} error={e.costNote} />
        </div>
        <TextArea label="Ограничения и возможные проблемы" name="limitations" required rows={3} defaultValue={s("limitations")} error={e.limitations} hint="Честные ограничения повышают доверие к материалу." />
        <TextArea label="Ожидаемый результат" name="expectedResult" required rows={3} defaultValue={s("expectedResult")} error={e.expectedResult} />
      </Section>

      <Section n={5} title="Результаты испытания" hint="Если вы применяли решение сами, опишите где, с кем, когда и что получилось. Без этого раздела материал получит статус «Не тестировалось».">
        <TextArea label="Как я проверял(а) решение" name="testReport" rows={4} defaultValue={s("testReport")} error={e.testReport} />
      </Section>

      <Section n={6} title="Файлы, источники и лицензия">
        {hasAttachmentSlot ? (
          <div>
            <label htmlFor="f-file" className="label">Приложить файл</label>
            <input id="f-file" name="file" type="file" className="input" accept=".pdf,.docx,.pptx,.xlsx,.odt,.odp,.txt,.csv,.png,.jpg,.jpeg" />
            <p className="hint">PDF, DOCX, PPTX, XLSX, ODT, ODP, TXT, CSV, PNG, JPG — до 10 МБ. Можно приложить до 5 файлов.</p>
          </div>
        ) : (
          <p className="text-[14px] text-muted">Достигнут предел в 5 файлов. Удалите ненужный файл, чтобы добавить новый.</p>
        )}
        <TextField label="Ссылка на материал или инструмент" name="externalUrl" type="url" defaultValue={s("externalUrl")} error={e.externalUrl} placeholder="https://" />
        <TextArea label="Источники" name="sources" rows={3} defaultValue={s("sources")} error={e.sources} hint="Откуда взята идея, на какие публикации или материалы вы опирались." />
        <div>
          <label htmlFor="f-license" className="label">Условия использования <span className="text-danger" aria-hidden>*</span></label>
          <select id="f-license" name="license" className="input" defaultValue={s("license")} aria-invalid={!!e.license}>
            <option value="">Выберите лицензию</option>
            {licenseOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {e.license && <p className="field-error">{e.license}</p>}
        </div>
      </Section>

      {state.message && <FormMessage ok={state.ok} message={state.message} />}
      {republishWarning && (
        <p className="rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-[14px] text-warn">
          Материал опубликован. После сохранения изменений он будет скрыт из каталога до повторной проверки редакцией.
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-line pt-5">
        {isStaff ? (
          <>
            <SubmitButton name="intent" value="publish">Сохранить и опубликовать</SubmitButton>
            {id && <SubmitButton name="intent" value="save" className="btn-secondary">Сохранить без смены статуса</SubmitButton>}
            {!id && <SubmitButton name="intent" value="draft" className="btn-secondary">Сохранить черновик</SubmitButton>}
          </>
        ) : (
          <>
            <SubmitButton name="intent" value="submit" pendingText="Отправляем…">Отправить на модерацию</SubmitButton>
            <SubmitButton name="intent" value="draft" className="btn-secondary">Сохранить черновик</SubmitButton>
          </>
        )}
      </div>
      <p className="text-[13px] text-muted">Черновик можно сохранить с незаполненными полями. Для отправки на модерацию нужно заполнить поля, отмеченные звёздочкой.</p>
    </form>
  );
}
