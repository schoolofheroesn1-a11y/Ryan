import { dimensionLabels, dimensionOrder } from "@/lib/labels";
import { scoreByDimension, toolVerdict } from "@/lib/scoring";
import type { CriterionDimension } from "@prisma/client";

type Props = {
  tools: { id: string; name: string; version: string }[];
  criteria: { id: string; name: string; description: string; dimension: CriterionDimension; weight: number; scaleMax: number }[];
  results: { toolId: string; criterionId: string; score: number | null; note: string }[];
  issues: { id: string; toolId: string; description: string; isCritical: boolean }[];
};

function scoreTone(score: number, max: number) {
  const r = score / max;
  if (r >= 0.8) return "bg-ok-soft text-ok";
  if (r >= 0.5) return "bg-neutral-soft text-ink";
  return "bg-danger-soft text-danger";
}

/** Таблица результатов: оценки по каждому критерию, сводка по измерениям и критические ошибки. */
export function ResearchTable({ tools, criteria, results, issues }: Props) {
  const dims = dimensionOrder.filter((d) => criteria.some((c) => c.dimension === d));
  return (
    <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Таблица результатов испытания">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <caption className="sr-only">Оценки инструментов по критериям испытания</caption>
        <thead>
          <tr className="bg-paper">
            <th scope="col" className="w-[34%] p-3 text-left font-medium text-muted">Критерий (вес)</th>
            {tools.map((t) => (
              <th key={t.id} scope="col" className="p-3 text-left align-bottom font-semibold">
                {t.name}
                <span className="block text-[12px] font-normal text-muted">{t.version}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line bg-danger-soft/40">
            <th scope="row" className="p-3 text-left font-semibold text-danger">Критические ошибки</th>
            {tools.map((t) => {
              const crit = issues.filter((i) => i.toolId === t.id && i.isCritical);
              return (
                <td key={t.id} className="p-3 align-top">
                  {crit.length ? (
                    <ul className="space-y-1 text-danger">{crit.map((i) => <li key={i.id}>⚠ {i.description}</li>)}</ul>
                  ) : (
                    <span className="text-muted">Не выявлены</span>
                  )}
                </td>
              );
            })}
          </tr>
          {dims.map((d) => (
            <DimensionRows key={d} dimension={d} tools={tools} criteria={criteria.filter((c) => c.dimension === d)} results={results} allCriteria={criteria} />
          ))}
          <tr className="border-t-2 border-line-strong">
            <th scope="row" className="p-3 text-left font-semibold">Итог по методике</th>
            {tools.map((t) => {
              const scores = scoreByDimension(t.id, criteria, results);
              const verdict = toolVerdict(issues.filter((i) => i.toolId === t.id && i.isCritical).length, scores);
              return (
                <td key={t.id} className="p-3 align-top">
                  {verdict === "critical" ? (
                    <span className="font-medium text-danger">Нельзя использовать без устранения критической ошибки</span>
                  ) : verdict === "incomplete" ? (
                    <span className="text-warn">Оценены не все критерии</span>
                  ) : (
                    <span className="text-ok">Критических ошибок нет — см. оценки по измерениям</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DimensionRows({
  dimension,
  tools,
  criteria,
  results,
  allCriteria,
}: {
  dimension: CriterionDimension;
  tools: Props["tools"];
  criteria: Props["criteria"];
  results: Props["results"];
  allCriteria: Props["criteria"];
}) {
  return (
    <>
      <tr className="border-t border-line bg-paper">
        <th scope="rowgroup" className="p-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
          {dimensionLabels[dimension]}
        </th>
        {tools.map((t) => {
          const s = scoreByDimension(t.id, allCriteria, results).find((x) => x.dimension === dimension);
          return (
            <td key={t.id} className="p-3 text-[13px] font-semibold">
              {s?.percent == null ? "—" : `${s.percent}%`}
              {s && s.coverage < 1 && <span className="ml-1 font-normal text-warn">(оценено {Math.round(s.coverage * 100)}% веса)</span>}
            </td>
          );
        })}
      </tr>
      {criteria.map((c) => (
        <tr key={c.id} className="border-t border-line">
          <th scope="row" className="p-3 text-left align-top font-normal">
            <span className="font-medium">{c.name}</span> <span className="text-muted">({c.weight})</span>
            {c.description && <span className="block text-[12.5px] text-muted">{c.description}</span>}
          </th>
          {tools.map((t) => {
            const r = results.find((x) => x.toolId === t.id && x.criterionId === c.id);
            return (
              <td key={t.id} className="p-3 align-top">
                {r?.score == null ? (
                  <span className="text-muted">не оценивалось</span>
                ) : (
                  <span className={`inline-block rounded-md px-2 py-0.5 font-semibold ${scoreTone(r.score, c.scaleMax)}`}>
                    {r.score} из {c.scaleMax}
                  </span>
                )}
                {r?.note && <span className="mt-1 block text-[12.5px] text-muted">{r.note}</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
