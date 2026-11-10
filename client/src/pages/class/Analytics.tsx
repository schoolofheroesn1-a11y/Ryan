import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Lightbulb, Sparkles, Trash2, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../App';
import { Button, Card, CardHeader, Empty, ErrorText, Field, confirmDelete } from '../../components/ui';
import { ChartEmpty, PerformanceChart, ScaleRadar, ScaleTrendChart } from '../../components/charts';
import { fmtDate, gradeColor } from '../../lib/format';
import { SCALE_COLORS, scoreColor, type Meta } from '../../lib/meta';

export function ClassAnalytics({ classId, data, meta, reload }: { classId: number; data: any; meta: Meta; reload: () => void }) {
  const students: any[] = data.students;
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const growing = students.filter((s) => s.momentum > 0).sort((a, b) => b.momentum - a.momentum);
  const declining = students.filter((s) => s.momentum < 0).sort((a, b) => a.momentum - b.momentum);
  const hasScales = data.radar.some((r: any) => r.value != null);

  if (!students.length) return <Card><Empty icon={<Users className="h-10 w-10" />} title="Добавьте учеников, чтобы увидеть аналитику" /></Card>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Средний балл', value: mean(students.map((s) => s.average)) ?? '—', cls: gradeColor(mean(students.map((s) => s.average))) },
          { label: 'Посещаемость', value: mean(students.map((s) => s.attendanceRate)) != null ? `${mean(students.map((s) => s.attendanceRate))}%` : '—', cls: '' },
          { label: 'Качества (1–10)', value: mean(students.map((s) => s.scaleAverage)) ?? '—', cls: '' },
          { label: 'Растут', value: growing.length, cls: 'text-emerald-600' },
          { label: 'Проседают', value: declining.length, cls: 'text-rose-600' },
        ].map((k) => (
          <Card key={k.label} className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">{k.label}</div>
            <div className={`text-2xl font-bold tracking-tight ${k.cls}`}>{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Профиль класса" subtitle="Средний уровень качеств учеников (1–10)" />
          <div className="p-4 pt-0">
            {hasScales ? <ScaleRadar data={data.radar.map((r: any) => ({ label: r.label, current: r.value }))} height={300} />
              : <ChartEmpty>Появится, когда у учеников будут общие оценки или разобранные ИИ материалы</ChartEmpty>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Учёба и посещаемость класса" subtitle="Средний балл и посещаемость по месяцам" />
          <div className="p-4 pt-2">
            {data.monthly.some((m: any) => m.grade != null || m.attendance != null) ? <PerformanceChart data={data.monthly} height={300} /> : <ChartEmpty>Нет оценок и посещаемости</ChartEmpty>}
          </div>
        </Card>
      </div>

      {hasScales && (
        <Card>
          <CardHeader title="Динамика качеств класса" subtitle="Средние значения по месяцам" />
          <div className="p-4 pt-2"><ScaleTrendChart monthly={data.monthly} scales={meta.scales} /></div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <MoverList title="Растут" icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} list={growing} empty="Пока никого с выраженным ростом" />
        <MoverList title="Проседают" icon={<TrendingDown className="h-4 w-4 text-rose-500" />} list={declining} empty="Никто заметно не проседает 👍" />
      </div>

      <Card>
        <CardHeader title="Карта качеств" subtitle="Каждая клетка — уровень ученика по шкале. Красное — зона внимания." />
        <div className="overflow-x-auto p-4 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-2 pr-3 text-left font-semibold">Ученик</th>
                <th className="px-1 py-2 font-semibold">Балл</th>
                {meta.scales.map((s) => (
                  <th key={s.key} className="px-1 py-2 font-semibold" title={s.hint}>
                    <span className="mx-auto block h-1.5 w-6 rounded-full" style={{ background: SCALE_COLORS[s.key] }} />
                    <span className="mt-1 block whitespace-nowrap">{s.label.replace('Эмоциональное благополучие', 'Благополучие')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3"><Link to={`/students/${s.id}`} className="font-medium text-slate-700 hover:text-indigo-600">{s.full_name}</Link></td>
                  <td className={`px-1 py-1.5 text-center font-semibold ${gradeColor(s.average)}`}>{s.average ?? '—'}</td>
                  {meta.scales.map((sc) => (
                    <td key={sc.key} className="px-1 py-1.5 text-center">
                      <span className={`inline-block min-w-9 rounded-lg px-2 py-1 font-semibold ${scoreColor(s.scales[sc.key])}`}>
                        {s.scales[sc.key] ?? '·'}
                        {s.trends[sc.key] === 'up' && '↑'}
                        {s.trends[sc.key] === 'down' && '↓'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ClassAi classId={classId} reports={data.reports} reload={reload} />
    </div>
  );
}

function MoverList({ title, icon, list, empty }: { title: string; icon: React.ReactNode; list: any[]; empty: string }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{icon}{title}</span>} subtitle="По шкалам качеств и оценкам за последние 1–2 месяца" />
      {list.length ? (
        <ul className="divide-y divide-slate-100 px-2 pb-2">
          {list.slice(0, 8).map((s) => (
            <li key={s.id}>
              <Link to={`/students/${s.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50">
                <span className="font-medium text-slate-700">{s.full_name}</span>
                <span className="text-xs text-slate-400">{Math.abs(s.momentum)} показат.</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 pb-5 text-sm text-slate-400">{empty}</p>}
    </Card>
  );
}

function ClassAi({ classId, reports, reload }: { classId: number; reports: any[]; reload: () => void }) {
  const { ai } = useApp();
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const report = reports.find((r) => r.id === selected) || reports[0];

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.post(`/api/classes/${classId}/analyze`, { focus });
      setFocus('');
      setSelected(r.id);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async (rid: number) => {
    if (!confirmDelete('этот анализ')) return;
    await api.del(`/api/class-reports/${rid}`);
    setSelected(null);
    reload();
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5" />Рекомендации классному руководителю</div>
          <p className="mt-1 text-sm text-violet-100">
            {ai.enabled ? 'ИИ изучит всех учеников класса: оценки, посещаемость, качества и материалы банка. Имена в ИИ не передаются.' : 'Ключ ИИ не настроен — будет выполнен базовый анализ.'}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <Field label="На что обратить внимание (необязательно)">
            <textarea className="input h-20" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Например: как сплотить класс; кому нужна поддержка перед экзаменами" />
          </Field>
          <ErrorText error={error} />
          <Button onClick={run} loading={loading} icon={<Sparkles className="h-4 w-4" />}>{loading ? 'Анализирую класс… (1–5 минут)' : 'Проанализировать класс'}</Button>
        </div>
      </Card>

      {reports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {reports.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className={`chip border ${r.id === report?.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-500'}`}>
              {fmtDate(r.created_at)}{r.focus ? ` · ${r.focus.slice(0, 30)}` : ''}
            </button>
          ))}
        </div>
      )}

      {report && <ClassReportView r={report} onDelete={() => del(report.id)} />}
    </div>
  );
}

function ClassReportView({ r, onDelete }: { r: any; onDelete: () => void }) {
  const c = r.content;
  const list = (title: string, items: string[], cls: string, icon: React.ReactNode) => items?.length ? (
    <Card>
      <CardHeader title={<span className={`flex items-center gap-2 ${cls}`}>{icon}{title}</span>} />
      <ul className="space-y-2 p-5 pt-2 text-sm text-slate-700">{items.map((s, i) => <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{s}</li>)}</ul>
    </Card>
  ) : null;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold">Общая картина</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {fmtDate(r.created_at)} · {r.source === 'rules' ? 'анализ по правилам' : r.source}{r.author ? ` · ${r.author}` : ''}
            <button onClick={onDelete} className="rounded p-1 hover:bg-slate-100 hover:text-rose-600" title="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {r.focus && <p className="mt-1 text-xs text-violet-600">Запрос: {r.focus}</p>}
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.summary}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {list('Сильные стороны класса', c.strengths, 'text-emerald-700', <TrendingUp className="h-4 w-4" />)}
        {list('Что беспокоит', c.concerns, 'text-amber-700', <AlertTriangle className="h-4 w-4" />)}
      </div>
      {c.recommendations?.length > 0 && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2 text-indigo-700"><Lightbulb className="h-4 w-4" />Что делать</span>} />
          <div className="grid gap-3 p-4 pt-2 md:grid-cols-2">
            {c.recommendations.map((x: any, i: number) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="font-semibold">{x.title}</div>
                <p className="mt-1 text-sm text-slate-600">{x.details}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {c.attention?.length > 0 && (
        <Card>
          <CardHeader title="Кому нужно внимание" />
          <ul className="divide-y divide-slate-100 px-5 pb-3">
            {c.attention.map((a: any, i: number) => (
              <li key={i} className="py-3 text-sm">
                <div className="font-semibold text-slate-800">{a.student}</div>
                <div className="text-slate-600">{a.reason}</div>
                <div className="mt-1 text-indigo-700">→ {a.action}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {c.groups?.length > 0 && (
        <Card>
          <CardHeader title="Идеи для групповой работы" />
          <div className="grid gap-3 p-4 pt-2 md:grid-cols-3">
            {c.groups.map((g: any, i: number) => (
              <div key={i} className="rounded-xl bg-slate-50 p-4 text-sm">
                <div className="font-semibold">{g.title}</div>
                <div className="mt-1 text-xs text-slate-500">{g.students.join(', ')}</div>
                <p className="mt-2 text-slate-600">{g.idea}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
