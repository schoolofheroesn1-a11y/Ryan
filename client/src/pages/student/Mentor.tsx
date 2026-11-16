import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, MessageCircleHeart, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../App';
import { Button, Card, CardHeader, Empty, ErrorText, Field, confirmDelete } from '../../components/ui';
import { fmtDate, today } from '../../lib/format';

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export function MentorTab({ data, reload }: { data: any; reload: () => void }) {
  const { user } = useApp();
  const m = data.mentoring;
  const [staff, setStaff] = useState<any[]>([]);
  const [prep, setPrep] = useState<any | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  useEffect(() => { api.get('/api/staff').then(setStaff); }, []);

  const setMentor = async (mentorId: string) => {
    await api.put(`/api/students/${data.student.id}/mentor`, { mentorId: mentorId || null });
    reload();
  };
  const makePrep = async () => {
    setPrepLoading(true);
    setPrepError(null);
    try {
      setPrep(await api.post(`/api/students/${data.student.id}/meeting-prep`));
    } catch (e: any) {
      setPrepError(e.message);
    } finally {
      setPrepLoading(false);
    }
  };
  const del = async (id: number) => {
    if (!confirmDelete('запись о встрече')) return;
    await api.del(`/api/meetings/${id}`);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Наставничество</div>
          <h2 className="text-2xl text-ink">Встречи один на один</h2>
          <p className="text-sm text-muted">Рекомендуемая частота — раз в {m.everyDays} дней. Договорённости можно сразу превратить в шаги цели.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Наставник</div>
          <select className="input mt-2" value={m.mentor?.id ?? ''} onChange={(e) => setMentor(e.target.value)}>
            <option value="">— не назначен —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === user!.id ? ' (вы)' : ''}</option>)}
          </select>
          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Последняя встреча</span><b className="font-mono">{m.lastMeeting ? fmtDate(m.lastMeeting.date) : '—'}</b></div>
            <div className="flex justify-between"><span className="text-muted">Прошло дней</span><b className="font-mono">{m.daysSince ?? '—'}</b></div>
            <div className="flex justify-between"><span className="text-muted">Следующая</span><b className="font-mono">{m.nextDate ? fmtDate(m.nextDate) : '—'}</b></div>
          </div>
          {m.overdue && (
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {m.lastMeeting ? 'Пора встретиться: прошло больше обычного или пропущена запланированная дата.' : 'Встреч ещё не было — запланируйте первую.'}
            </div>
          )}
        </Card>

        <Card className="flex flex-col overflow-hidden lg:col-span-2">
          <div className="relative overflow-hidden bg-ink p-5 text-[#fffdf9]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
            <div className="relative flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles className="h-5 w-5" />Повестка встречи</div>
            <p className="relative mt-1 text-sm text-slate-300">ИИ посмотрит, что изменилось с прошлой встречи: оценки, цели, материалы банка, договорённости — и предложит, о чём поговорить.</p>
            <Button className="relative mt-3" onClick={makePrep} loading={prepLoading}>{prepLoading ? 'Готовлю… (до минуты)' : 'Подготовить повестку'}</Button>
          </div>
          <div className="flex-1 p-5">
            <ErrorText error={prepError} />
            {prep ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { k: 'changes', t: 'Что изменилось', c: 'text-ink' },
                  { k: 'wins', t: 'За что похвалить', c: 'text-emerald-700' },
                  { k: 'concerns', t: 'Что обсудить бережно', c: 'text-amber-700' },
                  { k: 'questions', t: 'Вопросы ученику', c: 'text-brand-700' },
                  { k: 'followUp', t: 'Проверить договорённости', c: 'text-violet-700' },
                ].filter((b) => prep.prep[b.k]?.length).map((b) => (
                  <div key={b.k}>
                    <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${b.c}`}>{b.t}</div>
                    <ul className="space-y-1 text-sm text-slate-700">{prep.prep[b.k].map((x: string, i: number) => <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{x}</li>)}</ul>
                  </div>
                ))}
              </div>
            ) : !prepError && <p className="text-sm text-muted">Нажмите «Подготовить повестку» перед встречей.</p>}
          </div>
        </Card>
      </div>

      <MeetingForm data={data} reload={reload} />

      <Card>
        <CardHeader title="История встреч" subtitle={`${m.meetings.length} записей`} />
        {m.meetings.length === 0 ? <Empty icon={<MessageCircleHeart className="h-10 w-10" />} title="Встреч пока нет" /> : (
          <ul className="divide-y divide-border/60 px-5 pb-3">
            {m.meetings.map((x: any) => (
              <li key={x.id} className="group py-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-ink">{fmtDate(x.date)} <span className="text-sm font-normal text-muted">· {x.mentor_name || 'наставник'}</span></div>
                  <div className="flex items-center gap-2">
                    {x.next_date && <span className="chip bg-slate-100 text-slate-600"><CalendarClock className="h-3.5 w-3.5" />след. {fmtDate(x.next_date)}</span>}
                    <button onClick={() => del(x.id)} className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" title="Удалить"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                  {[{ l: 'Что получилось', v: x.went_well }, { l: 'Трудности', v: x.difficulties }, { l: 'Договорённости', v: x.agreements }].map((f) => (
                    <div key={f.l}>
                      <div className="text-xs uppercase tracking-wide text-muted">{f.l}</div>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{f.v || '—'}</p>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MeetingForm({ data, reload }: { data: any; reload: () => void }) {
  const [form, setForm] = useState({ date: today(), wentWell: '', difficulties: '', agreements: '', nextDate: plusDays(14), toGoal: 'new' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goals = data.goals.filter((g: any) => g.status === 'active');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/students/${data.student.id}/meetings`, { ...form, toGoal: form.toGoal === 'none' ? null : form.toGoal });
      setForm({ ...form, wentWell: '', difficulties: '', agreements: '' });
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Записать встречу" subtitle="Три коротких поля — по шаблону «получилось / трудно / договорились»" />
      <form onSubmit={submit} className="space-y-3 p-5 pt-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Что получилось"><textarea className="input h-28" value={form.wentWell} onChange={set('wentWell')} placeholder="Сдал все домашние работы по математике" /></Field>
          <Field label="Что было трудно"><textarea className="input h-28" value={form.difficulties} onChange={set('difficulties')} placeholder="Устаёт после тренировок, не успевает английский" /></Field>
          <Field label="О чём договорились — каждое с новой строки"><textarea className="input h-28" value={form.agreements} onChange={set('agreements')} placeholder={'Делать английский до тренировки\nЗаписаться на консультацию по дробям'} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Дата встречи"><input type="date" className="input" value={form.date} onChange={set('date')} /></Field>
          <Field label="Следующая встреча"><input type="date" className="input" value={form.nextDate} onChange={set('nextDate')} /></Field>
          <Field label="Договорённости → шаги цели">
            <select className="input" value={form.toGoal} onChange={set('toGoal')}>
              <option value="new">Новая цель «Договорённости со встречи»</option>
              {goals.map((g: any) => <option key={g.id} value={g.id}>В цель: {g.title}</option>)}
              <option value="none">Не добавлять</option>
            </select>
          </Field>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end"><Button type="submit" loading={loading}>Сохранить встречу</Button></div>
      </form>
    </Card>
  );
}
