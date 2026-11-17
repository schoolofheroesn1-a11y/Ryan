import React, { useCallback, useEffect, useState } from 'react';
import { Check, GraduationCap, LogOut, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Button, Card, CardHeader, ErrorText, Field, Modal, Spinner } from '../components/ui';
import { ChartEmpty, SubjectRadar } from '../components/charts';
import { daysFromToday, fmtDate, fmtPct, pctText } from '../lib/format';
import { SCALE_COLORS } from '../lib/meta';
import { GoalPath, HEALTH } from './student/Goals';
import { PredictionBadge } from './exams';

/** The student's own cabinet: own grades, goals, mock exams, weekly reflection and self-assessment. */
export function CabinetPage() {
  const { student, logout } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwd, setPwd] = useState(false);
  const load = useCallback(() => api.get('/api/student/me').then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const firstName = (student?.name || '').split(' ')[1] || student?.name || '';
  const activeGoals = data?.goals.filter((g: any) => g.status === 'active') || [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft"><GraduationCap className="h-5 w-5" /></div>
            <div className="leading-tight">
              <div className="font-serif text-[15px] font-semibold text-ink">Мой кабинет</div>
              <div className="text-xs text-muted">{student?.name}{student?.className ? ` · ${student.className}` : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setPwd(true)}>Пароль</Button>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Выйти"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <ErrorText error={error} />
        {!data ? <Spinner /> : (
          <div className="page-in space-y-8">
            <section className="relative overflow-hidden rounded-[22px] border border-border/80 bg-white px-6 py-7 shadow-soft">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
              <div className="relative">
                <div className="eyebrow">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <h1 className="mt-1 text-[32px] leading-tight text-ink">Привет, {firstName}!</h1>
                <p className="mt-2 max-w-xl text-slate-600">Здесь твои предметы, цели и пробники. Раз в неделю напиши короткую рефлексию — она поможет тебе и твоему наставнику.</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { l: 'Успеваемость', v: fmtPct(data.stats.percent), c: pctText(data.stats.percent) },
                    { l: 'Посещаемость', v: fmtPct(data.stats.attendance), c: 'text-ink' },
                    { l: 'Мои цели', v: String(activeGoals.length), c: 'text-ink' },
                    { l: 'Рефлексий', v: String(data.reflections.length), c: 'text-ink' },
                  ].map((k) => (
                    <div key={k.l} className="rounded-2xl border border-border/70 bg-slate-50/80 px-4 py-3">
                      <div className={`font-mono text-2xl font-semibold ${k.c}`}>{k.v}</div>
                      <div className="text-xs uppercase tracking-wide text-muted">{k.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Reflection data={data} reload={load} />
              <SelfAssessment data={data} reload={load} />
            </div>

            <Goals data={data} reload={load} />

            {(data.mentor || data.agreements.length > 0) && (
              <Card className="p-5">
                <div className="eyebrow">Наставник{data.mentor ? ` · ${data.mentor.name}` : ''}</div>
                <h2 className="mt-1 text-xl text-ink">О чём мы договорились</h2>
                {data.agreements.length ? (
                  <ul className="mt-3 space-y-3">
                    {data.agreements.map((a: any, i: number) => (
                      <li key={i} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-xs text-muted">встреча {fmtDate(a.date)}{a.next_date ? ` · следующая ${fmtDate(a.next_date)}` : ''}</div>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{a.agreements}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-muted">Договорённости появятся после встречи с наставником.</p>}
              </Card>
            )}

            <div className="grid gap-5 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader title="Мои предметы" subtitle="Средний процент выполнения работ" />
                <div className="p-4 pt-0">
                  {data.stats.subjects.length ? <SubjectRadar items={data.stats.subjects.map((s: any) => ({ label: s.subject, value: s.percent }))} height={300} />
                    : <ChartEmpty>Оценок пока нет</ChartEmpty>}
                </div>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader title="Последние оценки" />
                <ul className="max-h-[340px] divide-y divide-border/60 overflow-y-auto px-5 pb-3 text-sm">
                  {data.grades.map((g: any) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-ink">{g.subject}</div>
                        <div className="text-xs text-muted">{fmtDate(g.date)} · {g.kind}</div>
                      </div>
                      <span className={`font-mono font-semibold ${pctText(g.percent)}`}>{fmtPct(g.percent)} <span className="text-xs text-muted">«{g.value}»</span></span>
                    </li>
                  ))}
                  {!data.grades.length && <li className="py-4 text-muted">Пока пусто</li>}
                </ul>
              </Card>
            </div>

            {data.exams.length > 0 && (
              <Card>
                <CardHeader title="Мои пробники ОГЭ / ЕГЭ" subtitle="Прогноз по последнему пробнику и задания, где теряются баллы" />
                <div className="grid gap-4 p-5 pt-2 md:grid-cols-2">
                  {data.exams.map((e: any) => (
                    <div key={e.exam.id} className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-ink">{e.exam.title}</div>
                          <div className="text-xs text-muted">{e.mocks.length} пробн. · последний {fmtDate(e.latest.date)}</div>
                        </div>
                        <PredictionBadge p={e.latest.prediction} />
                      </div>
                      <div className="mt-2 font-mono text-sm text-slate-700">{e.latest.total} из {e.exam.maxPrimary} перв. баллов{e.delta ? ` (${e.delta > 0 ? '+' : ''}${e.delta})` : ''}</div>
                      {e.weak.length > 0 && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Потренируй: {e.weak.slice(0, 4).map((t: any) => `№${t.n}${t.topic ? ` (${t.topic})` : ''}`).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
      {pwd && <PasswordModal onClose={() => setPwd(false)} />}
    </div>
  );
}

function Reflection({ data, reload }: { data: any; reload: () => void }) {
  const [f, setF] = useState({ worked: '', hard: '', next: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const weekAgo = daysFromToday(-6);
  const thisWeek = data.reflections.find((r: any) => r.date >= weekAgo);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/student/reflection', f);
      setF({ worked: '', hard: '', next: '' });
      setSent(true);
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardHeader title="💭 Рефлексия недели" subtitle={thisWeek ? `На этой неделе ты уже писал(а) — ${fmtDate(thisWeek.date)}. Можно дополнить.` : 'Три коротких ответа — пара минут'} />
      <form onSubmit={submit} className="space-y-3 p-5 pt-2">
        <Field label="Что получилось на этой неделе?"><textarea className="input h-20" value={f.worked} onChange={(e) => setF({ ...f, worked: e.target.value })} /></Field>
        <Field label="Что было трудно?"><textarea className="input h-20" value={f.hard} onChange={(e) => setF({ ...f, hard: e.target.value })} /></Field>
        <Field label="Что сделаю иначе / моя цель на следующую неделю"><textarea className="input h-20" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <ErrorText error={error} />
        {sent && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Спасибо! Рефлексия сохранена.</p>}
        <Button type="submit" loading={loading} disabled={!f.worked && !f.hard && !f.next}>Отправить</Button>
      </form>
    </Card>
  );
}

function SelfAssessment({ data, reload }: { data: any; reload: () => void }) {
  const last = data.selfAssessments[0];
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const filled = Object.values(scores).filter((v) => v != null).length;
  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/student/self-assessment', { scores });
      setScores({});
      setSaved(true);
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardHeader title="🪞 Как я себя оцениваю" subtitle={last ? `Последний раз — ${fmtDate(last.date)}. Оценивай честно: 1 — совсем нет, 10 — отлично.` : 'Оценивай честно: 1 — совсем нет, 10 — отлично.'} />
      <div className="space-y-2.5 p-5 pt-2">
        {data.scales.map((s: any) => {
          const v = scores[s.key];
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium" style={{ color: SCALE_COLORS[s.key] }}>{s.label}</span>
                <span className="text-xs text-muted">{last?.scores[s.key] != null ? `было ${last.scores[s.key]}` : s.hint}</span>
              </div>
              <div className="mt-1 flex gap-0.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setScores({ ...scores, [s.key]: n })}
                    className={`h-7 flex-1 rounded-md font-mono text-[11px] font-semibold ${v != null && n <= v ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                    style={v != null && n <= v ? { background: SCALE_COLORS[s.key] } : undefined}>{n}</button>
                ))}
              </div>
            </div>
          );
        })}
        <ErrorText error={error} />
        {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Сохранено!</p>}
        <Button onClick={submit} loading={loading} disabled={!filled}>Сохранить самооценку ({filled})</Button>
      </div>
    </Card>
  );
}

function Goals({ data, reload }: { data: any; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const goals = data.goals.filter((g: any) => g.status === 'active');
  const toggle = async (s: any) => { await api.patch(`/api/student/goal-steps/${s.id}`, { done: !s.done }); reload(); };
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Целеполагание</div>
          <h2 className="text-2xl text-ink">Мои цели</h2>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Своя цель</Button>
      </div>
      {goals.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Целей пока нет. Поставь себе цель — например, «прочитать 2 книги за месяц» или «решить 5 вариантов ОГЭ».</Card>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {goals.map((g: any) => (
            <div key={g.id} className="rounded-[14px] border border-border/80 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[17px] font-semibold text-ink">{g.title}</div>
                <span className={`chip shrink-0 ${HEALTH[g.health].cls}`}>{HEALTH[g.health].label}</span>
              </div>
              <div className="mt-1 text-xs text-muted">{g.source === 'student' ? 'моя цель' : 'цель от учителя'}{g.deadline ? ` · до ${fmtDate(g.deadline)}` : ''}</div>
              <div className="mt-4"><GoalPath g={g} /></div>
              {g.need && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Что нужно: {g.need}</p>}
              {g.steps.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {g.steps.map((s: any) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <button onClick={() => toggle(s)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${s.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                        {s.done && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <span className={`text-sm ${s.done ? 'text-muted line-through' : 'text-slate-700'}`}>{s.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {adding && <OwnGoalModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </section>
  );
}

function OwnGoalModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', deadline: daysFromToday(30), steps: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/student/goals', { ...f, steps: f.steps.split('\n') });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Моя цель">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Чего я хочу добиться"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus placeholder="Например: подтянуть английский до «4»" /></Field>
        <Field label="К какому сроку"><input type="date" className="input" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        <Field label="Шаги — каждый с новой строки"><textarea className="input h-28" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} placeholder={'Каждый день 15 минут слов\nСделать 3 теста\nСпросить учителя про ошибки'} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit" loading={loading}>Поставить цель</Button></div>
      </form>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/student/password', { current, next });
      setMsg('Пароль изменён');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Сменить пароль">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Текущий пароль"><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="Новый пароль (от 6 символов)"><input className="input" type="password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <ErrorText error={error} />
        {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        <div className="flex justify-end"><Button type="submit">Сохранить</Button></div>
      </form>
    </Modal>
  );
}
