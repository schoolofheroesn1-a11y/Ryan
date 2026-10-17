"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Шаги инструкции как чек-лист: учитель может отмечать выполненные шаги прямо на уроке.
 * Отметки хранятся только в браузере пользователя.
 */
export function StepsChecklist({ id, steps }: { id: string; steps: string[] }) {
  const key = `pl-steps-${id}`;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- восстанавливаем состояние из localStorage после гидратации
      if (Array.isArray(saved)) setDone(saved.filter((n) => Number.isInteger(n)));
    } catch {
      /* хранилище недоступно — работаем без сохранения */
    }
  }, [key]);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* без сохранения */
    }
  };
  const pct = Math.round((done.length / steps.length) * 100);
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-valuenow={done.length} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Выполнено шагов">
          <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-[13px] text-muted">
          {done.length} из {steps.length}
          {done.length > 0 && (
            <button type="button" onClick={() => { setDone([]); try { localStorage.removeItem(key); } catch {} }} className="ml-2 text-accent hover:underline">
              сбросить
            </button>
          )}
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const on = done.includes(i);
          return (
            <li key={i}>
              <label className={`flex cursor-pointer gap-3.5 rounded-xl border p-3.5 transition-colors ${on ? "border-ok/30 bg-ok-soft/60" : "border-line bg-surface hover:border-accent/40"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(i)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? "bg-ok text-white" : "bg-accent-soft text-accent"}`}
                >
                  {on ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`prose-lab ${on ? "text-muted line-through decoration-ok/50" : ""}`}>
                  <span className="sr-only">Шаг {i + 1}. </span>
                  {s}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[12.5px] text-muted">Отмечайте шаги по ходу урока — отметки сохраняются в этом браузере.</p>
    </div>
  );
}
