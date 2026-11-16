import React, { useEffect, useMemo, useState } from 'react';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Card, CardHeader, Empty, ErrorText, Field, confirmDelete } from '../../components/ui';
import { ChartEmpty, SERIES_COLORS, SeriesChart } from '../../components/charts';
import { GRADE_KINDS, fmtDate, fmtPct, markFromPercent, pctFill, pctText, today } from '../../lib/format';
import { AttendanceTab, DelBtn } from './parts';

type Mode = 'mark' | 'percent' | 'points';

/** Toggle between entering a mark, a percent or points. */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opts: { id: Mode; label: string }[] = [
    { id: 'percent', label: 'Проценты' },
    { id: 'points', label: 'Баллы' },
    { id: 'mark', label: 'Отметка 2–5' },
  ];
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {opts.map((o) => (
        <button type="button" key={o.id} onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === o.id ? 'bg-white text-ink shadow-soft' : 'text-slate-500 hover:text-slate-800'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MarkBadge({ g }: { g: any }) {
  const p = g.percent ?? g.value * 20;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 font-mono text-sm font-semibold text-white ${pctFill(p)}`}>{g.value}</span>
      <span className={`font-mono text-sm font-semibold ${pctText(p)}`}>{fmtPct(p)}</span>
      {g.score != null && g.max_score != null && <span className="font-mono text-xs text-slate-400">{g.score}/{g.max_score}</span>}
    </span>
  );
}

export function PerformanceTab({ data, reload }: { data: any; reload: () => void }) {
  const subjects = data.stats.subjects;
  const [selected, setSelected] = useState<string>('');

  // Monthly percent per subject for the chart.
  const chart = useMemo(() => {
    const map = new Map<string, Record<string, number[]>>();
    for (const g of data.grades) {
      const m = g.date.slice(0, 7);
      if (!map.has(m)) map.set(m, {});
      (map.get(m)![g.subject] ||= []).push(g.percent ?? g.value * 20);
    }
    const rows = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, bySubj]) => {
      const r: Record<string, any> = { month };
      for (const [s, xs] of Object.entries(bySubj)) r[s] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      return r;
    });
    const series = subjects.map((s: any, i: number) => ({ key: s.subject, label: s.subject, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
    return { rows, series: selected ? series.filter((s: any) => s.key === selected) : series };
  }, [data.grades, subjects, selected]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Успеваемость</div>
          <h2 className="text-2xl text-ink">Предметы в процентах</h2>
          <p className="text-sm text-muted">85%+ — «5», 65%+ — «4», 45%+ — «3». Нажмите на предмет, чтобы увидеть его динамику.</p>
        </div>
        {data.stats.percent != null && (
          <div className="text-right">
            <div className={`font-mono text-4xl font-semibold ${pctText(data.stats.percent)}`}>{fmtPct(data.stats.percent)}</div>
            <div className="text-xs text-muted">средняя успеваемость</div>
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <Card><Empty title="Оценок пока нет" text="Добавьте первую оценку ниже или выставите оценки всему классу через журнал класса." /></Card>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s: any, i: number) => (
            <button key={s.subject} onClick={() => setSelected(selected === s.subject ? '' : s.subject)}
              className={`panel-top rounded-[14px] border bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 ${selected === s.subject ? 'ring-2 ring-brand-400' : 'border-border/80'}`}
              style={{ borderTopColor: SERIES_COLORS[i % SERIES_COLORS.length] }}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-ink">{s.subject}</div>
                {s.trend === 'up' && <span className="chip bg-emerald-50 text-emerald-700"><TrendingUp className="h-3.5 w-3.5" />растёт</span>}
                {s.trend === 'down' && <span className="chip bg-rose-50 text-rose-700"><TrendingDown className="h-3.5 w-3.5" />падает</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`font-mono text-3xl font-semibold ${pctText(s.percent)}`}>{fmtPct(s.percent)}</span>
                <span className="text-sm text-muted">≈ «{markFromPercent(s.percent)}» · ср. отметка {s.average}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${pctFill(s.percent)}`} style={{ width: `${s.percent}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>оценок: {s.count}</span>
                <span>за месяц: {fmtPct(s.recentPercent)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title={selected ? `Динамика: ${selected}` : 'Динамика по предметам'} subtitle="Средний процент за месяц"
          action={selected && <Button variant="ghost" onClick={() => setSelected('')}>Показать все</Button>} />
        <div className="p-4 pt-2">
          {chart.rows.length ? <SeriesChart rows={chart.rows} series={chart.series} /> : <ChartEmpty>Появится после первых оценок</ChartEmpty>}
        </div>
      </Card>

      <Journal data={data} reload={reload} filter={selected} />
      <AttendanceTab data={data} reload={reload} />
    </div>
  );
}

function Journal({ data, reload, filter }: { data: any; reload: () => void; filter: string }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>('percent');
  const [form, setForm] = useState({ subjectId: '', value: 5, percent: '', score: '', max: '', kind: GRADE_KINDS[0], date: today(), comment: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/subjects').then((s) => {
      setSubjects(s);
      if (s[0]) setForm((f) => ({ ...f, subjectId: String(s[0].id) }));
    });
  }, []);

  const preview = mode === 'percent' && form.percent !== '' ? Number(form.percent)
    : mode === 'points' && form.score !== '' && Number(form.max) > 0 ? (Number(form.score) / Number(form.max)) * 100 : null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body: any = { subjectId: form.subjectId, kind: form.kind, date: form.date, comment: form.comment };
    if (mode === 'mark') body.value = form.value;
    if (mode === 'percent') body.percent = form.percent;
    if (mode === 'points') { body.score = form.score; body.max = form.max; }
    try {
      await api.post(`/api/students/${data.student.id}/grades`, body);
      setForm((f) => ({ ...f, comment: '', percent: '', score: '' }));
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async (gid: number) => {
    if (!confirmDelete('оценку')) return;
    await api.del(`/api/grades/${gid}`);
    reload();
  };
  const [showAll, setShowAll] = useState(false);
  const full = filter ? data.grades.filter((g: any) => g.subject === filter) : data.grades;
  const list = showAll ? full : full.slice(0, 20);

  return (
    <>
      <Card>
        <CardHeader title="Добавить оценку" subtitle="Можно ввести процент, баллы «из N» или обычную отметку — всё пересчитается в проценты"
          action={<ModeSwitch mode={mode} onChange={setMode} />} />
        <form onSubmit={add} className="grid gap-3 p-5 pt-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Предмет">
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={mode === 'mark' ? 'Отметка' : mode === 'percent' ? 'Процент выполнения' : 'Баллы'}>
            {mode === 'mark' && (
              <div className="flex gap-1">
                {[5, 4, 3, 2].map((v) => (
                  <button type="button" key={v} onClick={() => setForm({ ...form, value: v })}
                    className={`h-10 flex-1 rounded-lg font-mono text-sm font-semibold ${form.value === v ? pctFill(v * 20) + ' text-white' : 'bg-slate-100 text-slate-600'}`}>{v}</button>
                ))}
              </div>
            )}
            {mode === 'percent' && (
              <div className="relative">
                <input className="input pr-8 font-mono" type="number" min={0} max={100} step="0.1" value={form.percent} required
                  onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="например 78" />
                <span className="absolute right-3 top-2.5 text-sm text-muted">%</span>
              </div>
            )}
            {mode === 'points' && (
              <div className="flex items-center gap-1.5">
                <input className="input font-mono" type="number" min={0} step="0.5" value={form.score} required onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="17" />
                <span className="text-muted">из</span>
                <input className="input font-mono" type="number" min={1} step="0.5" value={form.max} required onChange={(e) => setForm({ ...form, max: e.target.value })} placeholder="20" />
              </div>
            )}
            {preview != null && Number.isFinite(preview) && (
              <div className={`mt-1 text-xs ${pctText(preview)}`}>{Math.round(preview)}% → «{markFromPercent(preview)}»</div>
            )}
          </Field>
          <Field label="Тип работы">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {GRADE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Дата"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Комментарий"><input className="input" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit" loading={loading} icon={<Plus className="h-4 w-4" />} className="w-full">Добавить</Button></div>
          <div className="sm:col-span-2 lg:col-span-6"><ErrorText error={error} /></div>
        </form>
      </Card>

      <Card>
        <CardHeader title={filter ? `Журнал: ${filter}` : 'Журнал оценок'} subtitle={`${full.length} записей`} />
        {list.length === 0 ? <Empty title="Оценок нет" /> : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead className="border-y border-border/70 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-2.5">Дата</th><th className="px-3 py-2.5">Предмет</th><th className="px-3 py-2.5">Результат</th><th className="px-3 py-2.5">Тип</th><th className="px-3 py-2.5">Комментарий</th><th className="px-3 py-2.5">Учитель</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {list.map((g: any) => (
                  <tr key={g.id} className="group hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{fmtDate(g.date)}</td>
                    <td className="px-3 py-2.5">{g.subject}</td>
                    <td className="px-3 py-2.5"><MarkBadge g={g} /></td>
                    <td className="px-3 py-2.5 text-muted">{g.kind}</td>
                    <td className="px-3 py-2.5 text-muted">{g.comment}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{g.teacher}</td>
                    <td className="px-3 py-2.5 text-right"><DelBtn onClick={() => del(g.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {full.length > list.length && (
              <div className="px-5 pt-3 text-center">
                <Button variant="secondary" onClick={() => setShowAll(true)}>Показать все {full.length}</Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
