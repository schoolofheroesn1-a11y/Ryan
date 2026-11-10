import React from 'react';
import { AlertTriangle, Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui';
import { ChartEmpty, PerformanceChart, ScaleRadar, ScaleTrendChart } from '../../components/charts';
import { fmtDate, gradeColor } from '../../lib/format';
import { SCALE_COLORS, type Meta } from '../../lib/meta';

function Trend({ t }: { t: string }) {
  if (t === 'up') return <span className="chip bg-emerald-50 text-emerald-700"><TrendingUp className="h-3.5 w-3.5" />растёт</span>;
  if (t === 'down') return <span className="chip bg-rose-50 text-rose-700"><TrendingDown className="h-3.5 w-3.5" />снижается</span>;
  if (t === 'flat') return <span className="chip bg-slate-100 text-slate-500"><Minus className="h-3.5 w-3.5" />стабильно</span>;
  return null;
}

export function performanceByMonth(grades: any[], attendance: any[]) {
  const g = new Map<string, number[]>();
  for (const x of grades) (g.get(x.date.slice(0, 7)) || g.set(x.date.slice(0, 7), []).get(x.date.slice(0, 7))!).push(x.value);
  const a = new Map<string, { ok: number; total: number }>();
  for (const x of attendance) {
    const m = x.date.slice(0, 7);
    const v = a.get(m) || { ok: 0, total: 0 };
    v.total++;
    if (x.status === 'present' || x.status === 'late') v.ok++;
    a.set(m, v);
  }
  return [...new Set([...g.keys(), ...a.keys()])].sort().map((month) => {
    const gs = g.get(month);
    const at = a.get(month);
    return {
      month,
      grade: gs ? Math.round((gs.reduce((s, v) => s + v, 0) / gs.length) * 100) / 100 : null,
      attendance: at ? Math.round((at.ok / at.total) * 1000) / 10 : null,
    };
  });
}

export function OverviewTab({ data, meta, onAssess, onAddBank, onOpenAi }: {
  data: any; meta: Meta; onAssess: () => void; onAddBank: () => void; onOpenAi: () => void;
}) {
  const { stats, scaleStats, reports } = data;
  const radar = scaleStats.scales.map((s: any) => ({ label: s.label, current: s.current, teacher: s.teacher, ai: s.ai }));
  const hasScales = scaleStats.scales.some((s: any) => s.current != null);
  const perf = performanceByMonth(data.grades, data.attendance);
  const last = reports[0];
  const pendingCount = data.files.filter((f: any) => f.ai_status === 'pending').length;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Profile */}
      <Card className="lg:col-span-3">
        <CardHeader title="Профиль развития" subtitle="Шкалы 1–10: оценки учителя и выводы ИИ по материалам банка"
          action={<Button variant="secondary" onClick={onAssess}>📊 Оценить</Button>} />
        {hasScales ? (
          <div className="grid items-center gap-2 p-4 md:grid-cols-2">
            <ScaleRadar data={radar} height={280} />
            <ul className="space-y-2.5">
              {scaleStats.scales.map((s: any) => (
                <li key={s.key}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700">{s.label}</span>
                    <span className="flex items-center gap-2"><Trend t={s.trend} /><b className="w-7 text-right">{s.current ?? '—'}</b></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(s.current || 0) * 10}%`, background: SCALE_COLORS[s.key] }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-5">
            <ChartEmpty>
              <div>
                Профиль появится, когда в банке будут общие оценки или материалы (рефлексия, характеристики).{' '}
                {pendingCount > 0 ? `ИИ разбирает ${pendingCount} материал(ов)…` : ''}
                <div className="mt-3 flex justify-center gap-2">
                  <Button onClick={onAddBank}>+ Добавить в банк</Button>
                  <Button variant="secondary" onClick={onAssess}>📊 Оценить</Button>
                </div>
              </div>
            </ChartEmpty>
          </div>
        )}
      </Card>

      {/* AI */}
      <Card className="flex flex-col overflow-hidden lg:col-span-2">
        <div className="flex-1 bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-100"><Sparkles className="h-4 w-4" />Рекомендации ИИ</div>
          {last ? (
            <>
              <p className="mt-3 line-clamp-[8] text-[15px] leading-relaxed">{last.content.summary}</p>
              <p className="mt-2 text-xs text-violet-200">от {fmtDate(last.created_at)}</p>
            </>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-violet-50">ИИ изучит весь банк ученика — оценки, рефлексию, документы, динамику — и предложит конкретный план развития.</p>
          )}
        </div>
        <div className="p-4">
          <Button className="w-full" onClick={onOpenAi}>{last ? 'Открыть все советы' : '✨ Получить советы'}</Button>
        </div>
      </Card>

      {/* Dynamics */}
      <Card className="lg:col-span-3">
        <CardHeader title="Динамика качеств по месяцам" subtitle="Нажмите на шкалу, чтобы скрыть или показать её" />
        <div className="p-4 pt-2">
          {scaleStats.monthly.length ? <ScaleTrendChart monthly={scaleStats.monthly} scales={meta.scales} /> : <ChartEmpty>Данных для графика пока нет</ChartEmpty>}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Учёба и посещаемость" subtitle="Средний балл и процент посещения по месяцам" />
        <div className="p-4 pt-2">
          {perf.length ? <PerformanceChart data={perf} /> : <ChartEmpty>Оценок и отметок посещаемости пока нет</ChartEmpty>}
        </div>
      </Card>

      {/* Subjects */}
      <Card className="lg:col-span-3">
        <CardHeader title="Предметы" subtitle="Средний балл и изменение за последний месяц" />
        {stats.subjects.length ? (
          <ul className="grid gap-x-8 gap-y-2.5 p-5 pt-3 sm:grid-cols-2">
            {stats.subjects.map((s: any) => (
              <li key={s.subject}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-700">{s.subject}</span>
                  <span className="flex items-center gap-1.5">
                    {s.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                    {s.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-rose-500" />}
                    <b className={gradeColor(s.average)}>{s.average}</b>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.average >= 4.5 ? 'bg-emerald-500' : s.average >= 3.5 ? 'bg-indigo-500' : s.average >= 3 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${((s.average - 1) / 4) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="p-5 pt-2"><ChartEmpty>Оценок пока нет — выставляйте их через журнал класса или вкладку «Успеваемость»</ChartEmpty></div>}
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Сигналы" />
        <div className="space-y-2 p-5 pt-2 text-sm">
          {stats.riskReasons.length ? stats.riskReasons.map((r: string) => (
            <div key={r} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{r}</div>
          )) : <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">✓ Тревожных сигналов по оценкам и посещаемости нет</div>}
          {scaleStats.scales.filter((s: any) => s.trend === 'down').map((s: any) => (
            <div key={s.key} className="flex gap-2 rounded-xl bg-rose-50 px-3 py-2 text-rose-700"><TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />Снижается: {s.label.toLowerCase()}</div>
          ))}
          {scaleStats.scales.filter((s: any) => s.trend === 'up').map((s: any) => (
            <div key={s.key} className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />Растёт: {s.label.toLowerCase()}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
