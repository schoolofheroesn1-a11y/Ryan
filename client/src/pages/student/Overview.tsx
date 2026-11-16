import React from 'react';
import { AlertTriangle, Flag, Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui';
import { ChartEmpty, PercentBars, PerformanceChart, ScaleRadar, ScaleTrendChart } from '../../components/charts';
import { fmtDate } from '../../lib/format';
import { SCALE_COLORS, type Meta } from '../../lib/meta';
import { GoalPath, HEALTH } from './Goals';

function Trend({ t }: { t: string }) {
  if (t === 'up') return <span className="chip bg-emerald-50 text-emerald-700"><TrendingUp className="h-3.5 w-3.5" />растёт</span>;
  if (t === 'down') return <span className="chip bg-rose-50 text-rose-700"><TrendingDown className="h-3.5 w-3.5" />снижается</span>;
  if (t === 'flat') return <span className="chip bg-slate-100 text-slate-500"><Minus className="h-3.5 w-3.5" />стабильно</span>;
  return null;
}

export function performanceByMonth(grades: any[], attendance: any[]) {
  const g = new Map<string, number[]>();
  for (const x of grades) {
    const m = x.date.slice(0, 7);
    if (!g.has(m)) g.set(m, []);
    g.get(m)!.push(x.percent ?? x.value * 20);
  }
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
      percent: gs ? Math.round(gs.reduce((s, v) => s + v, 0) / gs.length) : null,
      attendance: at ? Math.round((at.ok / at.total) * 1000) / 10 : null,
    };
  });
}

export function OverviewTab({ data, meta, onAssess, onAddBank, onOpenAi, onOpenGoals, onOpenPerformance }: {
  data: any; meta: Meta; onAssess: () => void; onAddBank: () => void; onOpenAi: () => void; onOpenGoals: () => void; onOpenPerformance: () => void;
}) {
  const { stats, scaleStats, reports } = data;
  const radar = scaleStats.scales.map((s: any) => ({ label: s.label, current: s.current, teacher: s.teacher, ai: s.ai }));
  const hasScales = scaleStats.scales.some((s: any) => s.current != null);
  const perf = performanceByMonth(data.grades, data.attendance);
  const last = reports[0];
  const goals = data.goals.filter((g: any) => g.status === 'active').slice(0, 2);

  return (
    <div className="stagger grid gap-5 lg:grid-cols-5">
      {/* Subjects */}
      <Card className="lg:col-span-3">
        <CardHeader title="Успеваемость по предметам" subtitle="Средний процент выполнения работ"
          action={<Button variant="ghost" onClick={onOpenPerformance}>Подробнее →</Button>} />
        <div className="p-5 pt-3">
          {stats.subjects.length
            ? <PercentBars items={stats.subjects.map((s: any) => ({ label: s.subject, value: s.percent, trend: s.trend, hint: `«${s.average}»` }))} />
            : <ChartEmpty>Оценок пока нет — выставляйте их во вкладке «Успеваемость» или через журнал класса</ChartEmpty>}
        </div>
      </Card>

      {/* AI */}
      <Card className="flex flex-col overflow-hidden lg:col-span-2">
        <div className="relative flex-1 overflow-hidden bg-ink p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
          <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-200"><Sparkles className="h-4 w-4" />Рекомендации ИИ</div>
          {last ? (
            <>
              <p className="relative mt-3 line-clamp-[8] font-serif text-[16px] leading-relaxed text-[#fffdf9]">{last.content.summary}</p>
              <p className="relative mt-2 text-xs text-slate-400">от {fmtDate(last.created_at)}</p>
            </>
          ) : (
            <p className="relative mt-3 font-serif text-[16px] leading-relaxed text-slate-200">ИИ изучит весь банк ученика — оценки, цели, рефлексию, документы, динамику — и предложит план развития.</p>
          )}
        </div>
        <div className="p-4">
          <Button className="w-full" onClick={onOpenAi}>{last ? 'Открыть все советы' : '✨ Получить советы'}</Button>
        </div>
      </Card>

      {/* Goals */}
      <Card className="lg:col-span-5">
        <CardHeader title={<span className="flex items-center gap-2"><Flag className="h-4 w-4 text-amber-600" />Путь к цели</span>}
          subtitle="Ближайшие цели ученика и прогресс к ним"
          action={<Button variant="ghost" onClick={onOpenGoals}>Все цели →</Button>} />
        <div className="grid gap-4 p-5 pt-3 md:grid-cols-2">
          {goals.length ? goals.map((g: any) => (
            <div key={g.id} className="rounded-xl border border-border/70 p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="font-semibold text-ink">{g.title}</div>
                <span className={`chip shrink-0 ${HEALTH[g.health].cls}`}>{HEALTH[g.health].label}</span>
              </div>
              <GoalPath g={g} />
              {g.need && <p className="mt-3 text-xs text-amber-800">Что нужно: {g.need}</p>}
            </div>
          )) : (
            <div className="md:col-span-2"><ChartEmpty>
              <div>Целей пока нет. Поставьте понятную цель — например, «85% по математике к концу четверти».
                <div className="mt-3"><Button onClick={onOpenGoals}>Поставить цель</Button></div></div>
            </ChartEmpty></div>
          )}
        </div>
      </Card>

      {/* Profile */}
      <Card className="lg:col-span-3">
        <CardHeader title="Профиль развития" subtitle="Качества 1–10: оценки учителя и выводы ИИ по материалам банка"
          action={<Button variant="secondary" onClick={onAssess}>📊 Оценить</Button>} />
        {hasScales ? (
          <div className="grid items-center gap-2 p-4 md:grid-cols-2">
            <ScaleRadar data={radar} height={280} />
            <ul className="space-y-2.5">
              {scaleStats.scales.map((s: any) => (
                <li key={s.key}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700">{s.label}</span>
                    <span className="flex items-center gap-2"><Trend t={s.trend} /><b className="w-7 text-right font-mono">{s.current ?? '—'}</b></span>
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
                Профиль появится, когда в банке будут общие оценки или материалы (рефлексия, характеристики).
                <div className="mt-3 flex justify-center gap-2">
                  <Button onClick={onAddBank}>+ Добавить в банк</Button>
                  <Button variant="secondary" onClick={onAssess}>📊 Оценить</Button>
                </div>
              </div>
            </ChartEmpty>
          </div>
        )}
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

      {/* Dynamics */}
      <Card className="lg:col-span-3">
        <CardHeader title="Динамика качеств по месяцам" subtitle="Нажмите на шкалу, чтобы скрыть или показать её" />
        <div className="p-4 pt-2">
          {scaleStats.monthly.length ? <ScaleTrendChart monthly={scaleStats.monthly} scales={meta.scales} /> : <ChartEmpty>Данных для графика пока нет</ChartEmpty>}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Учёба и посещаемость" subtitle="Средний процент работ и посещения по месяцам" />
        <div className="p-4 pt-2">
          {perf.length ? <PerformanceChart data={perf} /> : <ChartEmpty>Оценок и отметок посещаемости пока нет</ChartEmpty>}
        </div>
      </Card>
    </div>
  );
}
