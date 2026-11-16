import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, GraduationCap, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { Button, Card, CardHeader, Empty, ErrorText, Field, Modal, Spinner, confirmDelete } from '../components/ui';
import { ChartEmpty } from '../components/charts';
import { fmtDate, today } from '../lib/format';

export interface Exam {
  id: number; title: string; type: 'oge' | 'ege'; subject_id: number | null; subject: string | null;
  tasks: { n: number; max: number; topic?: string }[]; thresholds: Record<string, number>; scale: number[] | null;
  maxPrimary: number; archived: number;
}

const typeLabel = (t: string) => (t === 'oge' ? 'ОГЭ' : 'ЕГЭ');
/** Cell colour by the share of points earned on a task. */
export function shareCls(share: number | null | undefined) {
  if (share == null) return 'bg-slate-50 text-slate-300';
  if (share >= 85) return 'bg-emerald-100 text-emerald-800';
  if (share >= 60) return 'bg-brand-100 text-brand-800';
  if (share >= 35) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-700';
}
export function PredictionBadge({ p, big }: { p: any; big?: boolean }) {
  const ok = p.mark != null ? p.mark >= 4 : p.passed;
  const cls = p.mark != null
    ? p.mark >= 5 ? 'bg-emerald-100 text-emerald-800' : p.mark === 4 ? 'bg-brand-100 text-brand-800' : p.mark === 3 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
    : p.passed === false ? 'bg-rose-100 text-rose-700' : ok ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center rounded-lg font-mono font-semibold ${big ? 'px-3 py-1 text-2xl' : 'px-2 py-0.5 text-sm'} ${cls}`}>{p.label}</span>;
}

// ---------- Exam editor ----------
export function ExamEditorModal({ exam, onClose, onDone }: { exam?: Exam | null; onClose: () => void; onDone: () => void }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [title, setTitle] = useState(exam?.title || '');
  const [type, setType] = useState<'oge' | 'ege'>(exam?.type || 'oge');
  const [subjectId, setSubjectId] = useState(exam?.subject_id ? String(exam.subject_id) : '');
  const [tasks, setTasks] = useState<{ max: string; topic: string }[]>(
    exam ? exam.tasks.map((t) => ({ max: String(t.max), topic: t.topic || '' })) : Array.from({ length: 10 }, () => ({ max: '1', topic: '' })),
  );
  const [count, setCount] = useState(String(exam?.tasks.length || 10));
  const [th, setTh] = useState<Record<string, string>>({
    '3': String(exam?.thresholds['3'] ?? ''), '4': String(exam?.thresholds['4'] ?? ''), '5': String(exam?.thresholds['5'] ?? ''),
    pass: String(exam?.thresholds.pass ?? ''),
  });
  const [scale, setScale] = useState(exam?.scale ? exam.scale.join(', ') : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get('/api/subjects').then(setSubjects); }, []);
  const max = tasks.reduce((a, t) => a + (Number(t.max) || 0), 0);
  const applyCount = () => {
    const n = Math.max(1, Math.min(60, Number(count) || 1));
    setTasks((ts) => Array.from({ length: n }, (_, i) => ts[i] || { max: '1', topic: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = {
      title, type, subjectId: subjectId || null,
      tasks: tasks.map((t) => ({ max: t.max, topic: t.topic })),
      thresholds: type === 'oge' ? { 3: th['3'], 4: th['4'], 5: th['5'] } : { pass: th.pass },
      scale: type === 'ege' ? scale : '',
    };
    try {
      if (exam) await api.patch(`/api/exams/${exam.id}`, body);
      else await api.post('/api/exams', body);
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Настройки экзамена' : 'Новый экзамен'} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
          <Field label="Тип">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(['oge', 'ege'] as const).map((t) => (
                <button type="button" key={t} onClick={() => setType(t)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${type === t ? 'bg-white text-ink shadow-soft' : 'text-slate-500'}`}>{typeLabel(t)}</button>
              ))}
            </div>
          </Field>
          <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="ОГЭ математика 2027" /></Field>
          <Field label="Предмет">
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">—</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Число заданий, баллы и пороги каждый год уточняйте по демоверсии и спецификации ФИПИ.
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <Field label="Заданий"><input className="input w-24 font-mono" type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
            <Button type="button" variant="secondary" onClick={applyCount}>Применить</Button>
            <Button type="button" variant="ghost" onClick={() => setTasks((ts) => ts.map((t) => ({ ...t, max: '1' })))}>Всем по 1 баллу</Button>
            <span className="ml-auto text-sm text-muted">Максимум: <b className="font-mono text-ink">{max}</b> перв. баллов</span>
          </div>
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-4 lg:grid-cols-5">
            {tasks.map((t, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-7 font-mono text-xs font-semibold text-muted">№{i + 1}</span>
                  <input className="input px-2 py-1 text-center font-mono" type="number" min={0} step="0.5" value={t.max} title="Максимум баллов"
                    onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))} />
                </div>
                <input className="input mt-1 px-2 py-1 text-xs" value={t.topic} placeholder="тема (необяз.)"
                  onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)))} />
              </div>
            ))}
          </div>
        </div>

        {type === 'oge' ? (
          <div>
            <span className="label">Минимальный первичный балл на отметку</span>
            <div className="flex flex-wrap gap-3">
              {['3', '4', '5'].map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">«{k}» от
                  <input className="input w-20 font-mono" type="number" min={0} max={max} value={th[k]} required onChange={(e) => setTh({ ...th, [k]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Field label="Минимальный тестовый балл"><input className="input font-mono" type="number" min={0} max={100} value={th.pass} onChange={(e) => setTh({ ...th, pass: e.target.value })} /></Field>
            <Field label={`Перевод в тестовые баллы (необяз.): ${Math.round(max) + 1} чисел для 0…${Math.round(max)} первичных`}>
              <textarea className="input h-20 font-mono text-xs" value={scale} onChange={(e) => setScale(e.target.value)} placeholder="0, 5, 9, 14, 18, …" />
            </Field>
          </div>
        )}

        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>{exam ? 'Сохранить' : 'Создать экзамен'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Mock entry (one student or a whole class) ----------
export function MockEntryModal({ exam, students, classId, studentId, onClose, onDone }: {
  exam: Exam; students: { id: number; full_name: string }[]; classId?: number; studentId?: number; onClose: () => void; onDone: () => void;
}) {
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState('');
  const [byTask, setByTask] = useState(true);
  const [rows, setRows] = useState<Record<number, { scores: string[]; total: string }>>(
    Object.fromEntries(students.map((s) => [s.id, { scores: exam.tasks.map(() => ''), total: '' }])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sum = (r: { scores: string[]; total: string }) =>
    byTask ? r.scores.reduce((a, v) => a + (Number(v.replace(',', '.')) || 0), 0) : Number(r.total.replace(',', '.')) || 0;
  const filled = (r: { scores: string[]; total: string }) => (byTask ? r.scores.some((v) => v !== '') : r.total !== '');
  const count = Object.values(rows).filter(filled).length;
  const setCell = (sid: number, i: number, v: string) =>
    setRows((rs) => ({ ...rs, [sid]: { ...rs[sid], scores: rs[sid].scores.map((x, j) => (j === i ? v : x)) } }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    const payload = (sid: number) => (byTask ? { scores: rows[sid].scores } : { total: rows[sid].total });
    try {
      if (studentId) await api.post(`/api/students/${studentId}/mocks`, { examId: exam.id, date, title, ...payload(studentId) });
      else await api.post(`/api/classes/${classId}/mocks/bulk`, { examId: exam.id, date, title, rows: students.map((s) => ({ studentId: s.id, ...payload(s.id) })) });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Пробник: ${exam.title}`} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Название (необязательно)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Пробник №2, вариант ФИПИ" /></Field>
          <Field label="Дата"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {[{ v: true, l: 'По заданиям' }, { v: false, l: 'Только итоговый балл' }].map((o) => (
            <button key={String(o.v)} type="button" onClick={() => setByTask(o.v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${byTask === o.v ? 'bg-white text-ink shadow-soft' : 'text-slate-500'}`}>{o.l}</button>
          ))}
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
          <table className="text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Ученик</th>
                {byTask ? exam.tasks.map((t) => <th key={t.n} className="px-1 py-2 font-mono" title={t.topic}>№{t.n}<div className="font-normal text-slate-400">/{t.max}</div></th>)
                  : <th className="px-3 py-2">Первичный балл / {exam.maxPrimary}</th>}
                <th className="px-3 py-2">Итог</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {students.map((s) => {
                const r = rows[s.id];
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 bg-white px-3 py-1.5 whitespace-nowrap">{s.full_name}</td>
                    {byTask ? r.scores.map((v, i) => (
                      <td key={i} className="px-0.5 py-1">
                        <input className="w-10 rounded-md border border-border bg-white px-1 py-1 text-center font-mono text-sm outline-none focus:border-brand-400"
                          inputMode="decimal" value={v} onChange={(e) => setCell(s.id, i, e.target.value)} />
                      </td>
                    )) : (
                      <td className="px-3 py-1">
                        <input className="input w-24 py-1 text-center font-mono" inputMode="decimal" value={r.total}
                          onChange={(e) => setRows({ ...rows, [s.id]: { ...r, total: e.target.value } })} />
                      </td>
                    )}
                    <td className="px-3 py-1 text-center font-mono font-semibold text-ink">{filled(r) ? `${Math.round(sum(r) * 10) / 10}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Пустые ячейки по заданиям считаются нулём. Строки учеников без данных пропускаются.</p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={loading} disabled={!count}>Сохранить ({count})</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Mock totals over time with OGE mark thresholds (or the EGE pass line). */
function MockChart({ exam, mocks }: { exam: Exam; mocks: any[] }) {
  const data = mocks.map((m) => ({ label: fmtDate(m.date), total: m.total }));
  const lines = exam.type === 'oge'
    ? [{ y: exam.thresholds['3'], l: '«3»' }, { y: exam.thresholds['4'], l: '«4»' }, { y: exam.thresholds['5'], l: '«5»' }]
    : [];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -16, right: 24, top: 10 }}>
        <CartesianGrid stroke="#efe8de" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#877b6d' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, exam.maxPrimary]} tick={{ fontSize: 11, fill: '#a99a88' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4dacb', background: '#fffdf9', fontSize: 12 }} formatter={(v: any) => [`${v} перв.`, 'Балл']} />
        {lines.map((l) => <ReferenceLine key={l.l} y={l.y} stroke="#cdbfab" strokeDasharray="4 4" label={{ value: l.l, position: 'right', fill: '#877b6d', fontSize: 11 }} />)}
        <Line type="monotone" dataKey="total" stroke="#3f7a5f" strokeWidth={2.5} dot={{ r: 4, fill: '#3f7a5f' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Student tab ----------
export function StudentExamsTab({ data, reload, onGoal }: { data: any; reload: () => void; onGoal: (exam: Exam) => void }) {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [entry, setEntry] = useState<Exam | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => { api.get('/api/exams').then((x: Exam[]) => { setExams(x); const a = x.find((e) => !e.archived); if (a) setPick(String(a.id)); }); }, []);
  if (!exams) return <Spinner />;
  const active = exams.filter((e) => !e.archived);

  const delMock = async (id: number) => {
    if (!confirmDelete('результат пробника')) return;
    await api.del(`/api/mocks/${id}`);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Подготовка к ГИА</div>
          <h2 className="text-2xl text-ink">ОГЭ и ЕГЭ</h2>
          <p className="text-sm text-muted">Пробники по номерам заданий, прогноз результата и задания, на которых теряются баллы.</p>
        </div>
        {active.length > 0 && (
          <div className="flex gap-2">
            <select className="input w-auto" value={pick} onChange={(e) => setPick(e.target.value)}>
              {active.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEntry(active.find((e) => String(e.id) === pick) || null)}>Внести пробник</Button>
          </div>
        )}
      </div>

      {active.length === 0 && (
        <Card><Empty icon={<GraduationCap className="h-10 w-10" />} title="Экзамены ещё не настроены"
          text="Создайте экзамен (число заданий, баллы, пороги) во вкладке «ОГЭ / ЕГЭ» на странице класса — после этого здесь можно вносить пробники." /></Card>
      )}
      {active.length > 0 && data.exams.length === 0 && (
        <Card><Empty title="Пробников пока нет" text="Внесите результаты первого пробника — появится прогноз и разбор по заданиям." /></Card>
      )}

      {data.exams.map((se: any) => (
        <Card key={se.exam.id}>
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <div className="eyebrow">{typeLabel(se.exam.type)}{se.exam.subject ? ` · ${se.exam.subject}` : ''}</div>
              <h3 className="text-xl text-ink">{se.exam.title}</h3>
              <div className="mt-1 text-sm text-muted">Пробников: {se.mocks.length} · последний {fmtDate(se.latest.date)}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-3xl font-semibold text-ink">{se.latest.total}<span className="text-lg text-muted">/{se.exam.maxPrimary}</span></div>
                <div className="text-xs text-muted">первичных баллов
                  {se.delta != null && se.delta !== 0 && (
                    <span className={se.delta > 0 ? 'ml-1 text-emerald-700' : 'ml-1 text-rose-700'}>
                      {se.delta > 0 ? <TrendingUp className="inline h-3.5 w-3.5" /> : <TrendingDown className="inline h-3.5 w-3.5" />} {se.delta > 0 ? '+' : ''}{se.delta}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-center">
                <PredictionBadge p={se.latest.prediction} big />
                <div className="mt-1 text-xs text-muted">прогноз</div>
              </div>
            </div>
          </div>
          <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Динамика пробников</div>
              {se.mocks.length > 1 ? <MockChart exam={se.exam} mocks={se.mocks} /> : <ChartEmpty>График появится после второго пробника</ChartEmpty>}
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Выполнение заданий (3 последних пробника)</div>
              {se.tasks.some((t: any) => t.share != null) ? (
                <div className="flex flex-wrap gap-1.5">
                  {se.tasks.map((t: any) => (
                    <div key={t.n} className={`w-12 rounded-lg px-1 py-1.5 text-center ${shareCls(t.share)}`} title={`${t.topic || ''} — в среднем ${t.avg} из ${t.max}`}>
                      <div className="font-mono text-[11px] opacity-70">№{t.n}</div>
                      <div className="font-mono text-sm font-semibold">{t.share == null ? '·' : `${t.share}%`}</div>
                    </div>
                  ))}
                </div>
              ) : <ChartEmpty>Разбор появится, если вносить баллы по заданиям</ChartEmpty>}
              {se.weak.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Где теряются баллы: </span>
                  {se.weak.slice(0, 5).map((t: any) => `№${t.n}${t.topic ? ` (${t.topic})` : ''} −${t.lost}`).join(' · ')}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEntry(se.exam)}>Ещё пробник</Button>
                <Button variant="secondary" onClick={() => onGoal(se.exam)}>🎯 Цель по экзамену</Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {[...se.mocks].reverse().map((m: any) => (
                  <tr key={m.id} className="group">
                    <td className="px-5 py-2 text-muted">{fmtDate(m.date)}</td>
                    <td className="px-3 py-2">{m.title || 'Пробник'}</td>
                    <td className="px-3 py-2 font-mono">{m.total}/{se.exam.maxPrimary}</td>
                    <td className="px-3 py-2"><PredictionBadge p={m.prediction} /></td>
                    <td className="px-3 py-2 text-xs text-muted">{m.scores ? 'по заданиям' : 'только итог'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => delMock(m.id)} className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" title="Удалить"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {entry && (
        <MockEntryModal exam={entry} students={[{ id: data.student.id, full_name: data.student.full_name }]} studentId={data.student.id}
          onClose={() => setEntry(null)} onDone={() => { setEntry(null); reload(); }} />
      )}
    </div>
  );
}

// ---------- Class tab ----------
export function ClassExamsTab({ cls }: { cls: any }) {
  const [list, setList] = useState<{ exams: Exam[]; used: number[] } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<any>(null);
  const [modal, setModal] = useState<null | 'new' | 'edit' | 'mock'>(null);

  const loadList = () => api.get(`/api/classes/${cls.id}/exams`).then((d) => {
    setList(d);
    setSelected((cur) => cur ?? (d.exams.find((e: Exam) => !e.archived && d.used.includes(e.id)) || d.exams.find((e: Exam) => !e.archived))?.id ?? null);
  });
  const loadView = () => selected && api.get(`/api/classes/${cls.id}/exams/${selected}`).then(setView);
  useEffect(() => { loadList(); }, [cls.id]);
  useEffect(() => { setView(null); loadView(); }, [selected]);

  if (!list) return <Spinner />;
  const active = list.exams.filter((e) => !e.archived);
  const exam = list.exams.find((e) => e.id === selected) || null;

  const archive = async () => {
    if (!exam || !window.confirm(`Перенести «${exam.title}» в архив? Результаты сохранятся.`)) return;
    await api.patch(`/api/exams/${exam.id}`, { archived: true });
    setSelected(null);
    loadList();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {active.map((e) => (
          <button key={e.id} onClick={() => setSelected(e.id)}
            className={`chip border px-3 py-1.5 text-sm ${selected === e.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-white text-slate-600 hover:border-slate-300'}`}>
            {typeLabel(e.type)} · {e.title}{list.used.includes(e.id) ? '' : ' (нет данных)'}
          </button>
        ))}
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('new')}>Новый экзамен</Button>
      </div>

      {!exam ? (
        <Card><Empty icon={<GraduationCap className="h-10 w-10" />} title="Экзаменов пока нет"
          text="Создайте экзамен: число заданий, баллы за каждое и пороги отметок. Потом вносите пробники всему классу — сайт покажет прогноз и слабые задания."
          action={<Button onClick={() => setModal('new')}>Создать экзамен</Button>} /></Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">{typeLabel(exam.type)}{exam.subject ? ` · ${exam.subject}` : ''}</div>
                <h3 className="text-xl text-ink">{exam.title}</h3>
                <div className="mt-1 text-sm text-muted">
                  {exam.tasks.length} заданий · максимум {exam.maxPrimary} перв.
                  {exam.type === 'oge' ? ` · «3» от ${exam.thresholds['3']}, «4» от ${exam.thresholds['4']}, «5» от ${exam.thresholds['5']}` : exam.thresholds.pass ? ` · порог ${exam.thresholds.pass} т.б.` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal('mock')} disabled={!cls.students.length}>Внести пробник классу</Button>
                <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setModal('edit')} title="Настройки" />
                <Button variant="ghost" icon={<Archive className="h-4 w-4" />} onClick={archive} title="В архив" />
              </div>
            </div>
            {view && Object.keys(view.distribution).length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Прогноз по последним пробникам:</span>
                {Object.entries(view.distribution).sort().map(([k, v]) => (
                  <span key={k} className="chip bg-slate-100 text-ink"><b className="font-mono">{k}</b> — {v as number} уч.</span>
                ))}
              </div>
            )}
          </Card>

          {!view ? <Spinner /> : (
            <>
              <Card>
                <CardHeader title="Результаты учеников" subtitle="Последний пробник, прогноз и изменение к предыдущему" />
                <div className="overflow-x-auto pb-2">
                  <table className="w-full text-sm">
                    <thead className="border-y border-border/70 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                      <tr><th className="px-5 py-2.5">Ученик</th><th className="px-3 py-2.5">Балл</th><th className="px-3 py-2.5">Прогноз</th><th className="px-3 py-2.5">Изменение</th><th className="px-3 py-2.5">Пробников</th><th className="px-3 py-2.5">Последний</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {view.students.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-5 py-2.5"><Link to={`/students/${s.id}`} className="font-semibold text-ink hover:text-brand-700">{s.full_name}</Link></td>
                          <td className="px-3 py-2.5 font-mono">{s.latest ? `${s.latest.total}/${exam.maxPrimary}` : '—'}</td>
                          <td className="px-3 py-2.5">{s.latest ? <PredictionBadge p={s.latest.prediction} /> : <span className="text-slate-300">—</span>}</td>
                          <td className={`px-3 py-2.5 font-mono ${s.delta > 0 ? 'text-emerald-700' : s.delta < 0 ? 'text-rose-700' : 'text-muted'}`}>{s.delta == null ? '—' : `${s.delta > 0 ? '+' : ''}${s.delta}`}</td>
                          <td className="px-3 py-2.5 font-mono">{s.count}</td>
                          <td className="px-3 py-2.5 text-muted">{s.latest ? fmtDate(s.latest.date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <CardHeader title="Карта заданий" subtitle="Доля набранных баллов в последнем пробнике. Красное — задание, которое стоит разобрать с классом." />
                <div className="overflow-x-auto p-4 pt-2">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-white pr-3 text-left font-semibold text-muted">Ученик</th>
                        {exam.tasks.map((t) => <th key={t.n} className="px-0.5 pb-1 font-mono text-muted" title={t.topic}>№{t.n}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="sticky left-0 bg-white pr-3 font-semibold text-ink">Класс</td>
                        {view.tasks.map((t: any) => <td key={t.n} className="px-0.5 py-0.5"><div className={`w-9 rounded-md py-1 text-center font-mono font-semibold ${shareCls(t.share)}`}>{t.share ?? '·'}</div></td>)}
                      </tr>
                      {view.students.map((s: any) => (
                        <tr key={s.id}>
                          <td className="sticky left-0 whitespace-nowrap bg-white pr-3 text-slate-700">{s.full_name}</td>
                          {exam.tasks.map((t, i) => {
                            const sc = s.latest?.scores;
                            const share = Array.isArray(sc) ? Math.round((Number(sc[i]) / t.max) * 100) : null;
                            return <td key={t.n} className="px-0.5 py-0.5"><div className={`w-9 rounded-md py-1 text-center font-mono ${shareCls(share)}`} title={Array.isArray(sc) ? `${sc[i]} из ${t.max}` : ''}>{Array.isArray(sc) ? sc[i] : '·'}</div></td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {view.weakest.length > 0 && (
                    <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Разобрать с классом в первую очередь: </span>
                      {view.weakest.map((t: any) => `№${t.n}${t.topic ? ` (${t.topic})` : ''} — ${t.share}%`).join(' · ')}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {modal === 'new' && <ExamEditorModal onClose={() => setModal(null)} onDone={() => { setModal(null); setSelected(null); loadList(); }} />}
      {modal === 'edit' && exam && <ExamEditorModal exam={exam} onClose={() => setModal(null)} onDone={() => { setModal(null); loadList(); loadView(); }} />}
      {modal === 'mock' && exam && (
        <MockEntryModal exam={exam} students={cls.students} classId={cls.id}
          onClose={() => setModal(null)} onDone={() => { setModal(null); loadList(); loadView(); }} />
      )}
    </div>
  );
}

export function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  useEffect(() => { api.get('/api/exams').then(setExams).catch(() => {}); }, []);
  return useMemo(() => exams.filter((e) => !e.archived), [exams]);
}
