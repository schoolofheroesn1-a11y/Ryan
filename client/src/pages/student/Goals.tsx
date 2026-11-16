import React, { useEffect, useState } from 'react';
import { Check, Flag, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Card, Empty, ErrorText, Field, Modal, confirmDelete } from '../../components/ui';
import { fmtDate, fmtPct, markFromPercent, pctText, today } from '../../lib/format';
import { SCALE_COLORS, type Meta } from '../../lib/meta';
import { useExams } from '../exams';

export const HEALTH: Record<string, { label: string; cls: string }> = {
  achieved: { label: 'Цель достигнута 🎉', cls: 'bg-emerald-100 text-emerald-800' },
  on_track: { label: 'Идём по плану', cls: 'bg-brand-50 text-brand-700' },
  behind: { label: 'Отстаём от плана', cls: 'bg-amber-100 text-amber-800' },
  overdue: { label: 'Срок прошёл', cls: 'bg-rose-100 text-rose-700' },
  no_data: { label: 'Пока нет данных', cls: 'bg-slate-100 text-slate-500' },
  done: { label: 'Выполнена', cls: 'bg-emerald-100 text-emerald-800' },
  dropped: { label: 'Отменена', cls: 'bg-slate-100 text-slate-500' },
};
const KIND_EMOJI: Record<string, string> = { subject: '📘', scale: '🌱', attendance: '📅', custom: '🎯', exam: '🎓' };

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + 'T23:59:59').getTime() - Date.now()) / 864e5);
}
const fmtVal = (g: any, v: number | null) => (v == null ? '—' : g.kind === 'scale' ? `${v}` : g.kind === 'exam' ? `${v} б.` : fmtPct(v));

/** "Путь к цели": track with the start point, current value and the target flag. */
export function GoalPath({ g }: { g: any }) {
  if (g.kind === 'custom') {
    const done = g.steps.filter((s: any) => s.done).length;
    return (
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Выполнено шагов</span>
          <span className="font-mono font-semibold text-ink">{done} / {g.steps.length || 0}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${g.progress ?? 0}%` }} />
        </div>
      </div>
    );
  }
  const max = g.max || (g.kind === 'scale' ? 10 : 100);
  const pos = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / max) * 100))}%`;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-mono text-4xl font-semibold ${g.kind === 'scale' || g.kind === 'exam' ? 'text-brand-600' : pctText(g.current)}`}>{fmtVal(g, g.current)}</span>
        <span className="text-slate-600">→ цель <b className="font-mono">{fmtVal(g, g.target_value)}</b>
          {g.kind === 'subject' && g.target_value != null && <span className="text-muted"> (≈ «{markFromPercent(g.target_value)}»)</span>}
        </span>
        {g.progress != null && <span className="ml-auto rounded-full bg-emerald-50 px-3 py-0.5 text-sm font-semibold text-emerald-700">{g.progress}% пути</span>}
      </div>
      <div className="relative mt-5 h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-300 to-brand-600 transition-all" style={{ width: pos(g.current) }} />
        {g.start_value != null && (
          <div className="absolute -top-2 -bottom-2 w-0 -translate-x-1/2 border-l-2 border-dashed border-slate-400" style={{ left: pos(g.start_value) }} title={`Старт: ${fmtVal(g, g.start_value)}`} />
        )}
        {g.target_value != null && (
          <div className="absolute -top-5 -translate-x-1/2 text-ink" style={{ left: pos(g.target_value) }} title={`Цель: ${fmtVal(g, g.target_value)}`}>
            <Flag className="h-4 w-4 fill-amber-400 text-amber-700" />
          </div>
        )}
        {g.current != null && (
          <div className="absolute -top-1.5 -bottom-1.5 z-10 w-1.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-white" style={{ left: pos(g.current) }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>0</span>
        {g.start_value != null && <span>старт {fmtVal(g, g.start_value)}</span>}
        <span>{max}{g.kind === 'scale' ? '' : g.kind === 'exam' ? ' б.' : '%'}</span>
      </div>
    </div>
  );
}

export function GoalsTab({ data, meta, reload }: { data: any; meta: Meta; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const goals: any[] = data.goals;
  const active = goals.filter((g) => g.status === 'active');
  const archived = goals.filter((g) => g.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Целеполагание</div>
          <h2 className="text-2xl text-ink">Цели ученика</h2>
          <p className="text-sm text-muted">Цель по предмету, качеству или посещаемости измеряется автоматически. Своя цель — по шагам.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Новая цель</Button>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip bg-white text-ink shadow-soft">Активных: <b className="font-mono">{active.length}</b></span>
          {['achieved', 'on_track', 'behind', 'overdue'].map((h) => {
            const n = active.filter((g) => g.health === h).length;
            return n ? <span key={h} className={`chip ${HEALTH[h].cls}`}>{HEALTH[h].label}: <b className="font-mono">{n}</b></span> : null;
          })}
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <Empty icon={<Flag className="h-10 w-10" />} title="Целей пока нет"
            text="Поставьте ученику понятную цель: например, 85% по математике к концу четверти или посещаемость 95%. Сайт будет сам следить за прогрессом."
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Поставить первую цель</Button>} />
        </Card>
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {active.map((g) => <GoalCard key={g.id} g={g} reload={reload} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg text-ink">Архив целей</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {archived.map((g) => <GoalCard key={g.id} g={g} reload={reload} compact />)}
          </div>
        </div>
      )}

      {adding && <GoalModal data={data} meta={meta} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </div>
  );
}

function GoalCard({ g, reload, compact }: { g: any; reload: () => void; compact?: boolean }) {
  const [step, setStep] = useState('');
  const left = daysLeft(g.deadline);
  const h = HEALTH[g.health] || HEALTH.no_data;
  const patch = async (body: any) => { await api.patch(`/api/goals/${g.id}`, body); reload(); };
  const toggleStep = async (s: any) => { await api.patch(`/api/goal-steps/${s.id}`, { done: !s.done }); reload(); };
  const delStep = async (s: any) => { await api.del(`/api/goal-steps/${s.id}`); reload(); };
  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step.trim()) return;
    await api.post(`/api/goals/${g.id}/steps`, { text: step });
    setStep('');
    reload();
  };
  const remove = async () => {
    if (!confirmDelete('цель')) return;
    await api.del(`/api/goals/${g.id}`);
    reload();
  };

  return (
    <div className={`rounded-[14px] border border-border/80 bg-white shadow-soft ${compact ? 'p-4 opacity-80' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">{KIND_EMOJI[g.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold leading-snug text-ink">{g.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`chip ${h.cls}`}>{h.label}</span>
            {g.deadline && (
              <span className="chip bg-slate-100 text-slate-600">
                до {fmtDate(g.deadline)}{g.status === 'active' && left != null ? (left >= 0 ? ` · осталось ${left} дн.` : '') : ''}
              </span>
            )}
            {g.source === 'ai' && <span className="chip bg-amber-50 text-amber-800">✨ от ИИ</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 text-slate-400">
          {g.status === 'active' ? (
            <>
              <button onClick={() => patch({ status: 'done' })} className="rounded-lg p-1.5 hover:bg-emerald-50 hover:text-emerald-700" title="Отметить выполненной"><Check className="h-4 w-4" /></button>
              <button onClick={() => patch({ status: 'dropped' })} className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-700" title="Отменить цель"><X className="h-4 w-4" /></button>
            </>
          ) : (
            <button onClick={() => patch({ status: 'active' })} className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-700" title="Вернуть в работу"><RotateCcw className="h-4 w-4" /></button>
          )}
          <button onClick={remove} className="rounded-lg p-1.5 hover:bg-rose-50 hover:text-rose-600" title="Удалить"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-5"><GoalPath g={g} /></div>
          {g.need && g.status === 'active' && (
            <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Что нужно для цели: </span>{g.need}
            </div>
          )}
          {g.note && <p className="mt-3 text-sm text-slate-600">{g.note}</p>}

          {(g.steps.length > 0 || g.status === 'active') && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Шаги</div>
              <ul className="space-y-1">
                {g.steps.map((s: any) => (
                  <li key={s.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                    <button onClick={() => toggleStep(s)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${s.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500'}`}>
                      {s.done && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`flex-1 text-sm ${s.done ? 'text-muted line-through' : 'text-slate-700'}`}>{s.text}</span>
                    <button onClick={() => delStep(s)} className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" title="Удалить шаг"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
              {g.status === 'active' && (
                <form onSubmit={addStep} className="mt-2 flex gap-2">
                  <input className="input py-2" value={step} onChange={(e) => setStep(e.target.value)} placeholder="Добавить шаг, например «разобрать ошибки контрольной»" />
                  <Button type="submit" variant="secondary" className="px-3" icon={<Plus className="h-4 w-4" />} />
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Deadline presets: in a month, end of the current school quarter, end of the year. */
function deadlinePresets() {
  const now = new Date();
  const y = now.getFullYear();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ends = [new Date(y, 9, 26), new Date(y, 11, 27), new Date(y + 1, 2, 21), new Date(y + 1, 4, 26), new Date(y, 2, 21), new Date(y, 4, 26)]
    .filter((d) => d > now).sort((a, b) => a.getTime() - b.getTime());
  const yearEnd = now.getMonth() >= 5 ? new Date(y + 1, 4, 26) : new Date(y, 4, 26);
  return [
    { label: 'Через месяц', value: iso(new Date(Date.now() + 30 * 864e5)) },
    { label: 'Конец четверти', value: iso(ends[0]) },
    { label: 'Конец учебного года', value: iso(yearEnd) },
  ];
}

export function GoalModal({ data, meta, onClose, onDone, preset }: {
  data: any; meta: Meta; onClose: () => void; onDone: () => void;
  preset?: { title?: string; note?: string; source?: string; examId?: number };
}) {
  const exams = useExams();
  const [kind, setKind] = useState<'subject' | 'scale' | 'attendance' | 'custom' | 'exam'>(preset?.examId ? 'exam' : preset ? 'custom' : 'subject');
  const [examId, setExamId] = useState(preset?.examId ? String(preset.examId) : '');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [form, setForm] = useState({
    subjectId: '', scaleKey: meta.scales[0].key, target: preset?.examId ? '4' : '85', title: preset?.title || '', note: preset?.note || '',
    deadline: deadlinePresets()[1].value, steps: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/subjects').then((s) => {
      setSubjects(s);
      const weakest = [...data.stats.subjects].sort((a: any, b: any) => a.percent - b.percent)[0];
      const def = weakest ? s.find((x: any) => x.name === weakest.subject) : s[0];
      if (def) setForm((f) => ({ ...f, subjectId: String(def.id) }));
    });
  }, []);

  const setKindAndTarget = (k: typeof kind) => {
    setKind(k);
    setForm((f) => ({ ...f, target: k === 'scale' ? '7' : k === 'attendance' ? '95' : k === 'exam' ? '4' : f.target === '7' || f.target === '4' ? '85' : f.target }));
  };
  const subjName = subjects.find((s) => String(s.id) === form.subjectId)?.name;
  const currentSubj = data.stats.subjects.find((s: any) => s.subject === subjName);
  const currentScale = data.scaleStats.scales.find((s: any) => s.key === form.scaleKey);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/students/${data.student.id}/goals`, {
        kind, subjectId: form.subjectId, scaleKey: form.scaleKey, examId: examId || exams[0]?.id, target: form.target, title: form.title,
        note: form.note, deadline: form.deadline, steps: form.steps.split('\n'), source: preset?.source,
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const KINDS = [
    { id: 'subject', emoji: '📘', title: 'Предмет', text: 'Поднять успеваемость до нужного процента' },
    { id: 'scale', emoji: '🌱', title: 'Качество', text: 'Мотивация, самостоятельность и др. (1–10)' },
    { id: 'attendance', emoji: '📅', title: 'Посещаемость', text: 'Процент посещённых уроков' },
    { id: 'exam', emoji: '🎓', title: 'ОГЭ / ЕГЭ', text: 'Отметка или балл по результатам пробников' },
    { id: 'custom', emoji: '🎯', title: 'Своя цель', text: 'Олимпиада, проект, привычка — по шагам' },
  ] as const;
  const exam = exams.find((e) => String(e.id) === (examId || String(exams[0]?.id ?? '')));
  const lastMock = data.exams?.find((x: any) => x.exam.id === exam?.id)?.latest;

  return (
    <Modal open onClose={onClose} title="Новая цель" wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {KINDS.map((k) => (
            <button type="button" key={k.id} onClick={() => setKindAndTarget(k.id)}
              className={`rounded-xl border p-3 text-left transition ${kind === k.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-border hover:border-slate-300'}`}>
              <div className="text-2xl">{k.emoji}</div>
              <div className="mt-1 text-sm font-semibold text-ink">{k.title}</div>
              <div className="text-xs text-muted">{k.text}</div>
            </button>
          ))}
        </div>

        {kind === 'subject' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Предмет">
              <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={`Цель, % ${currentSubj ? `(сейчас ${fmtPct(currentSubj.percent)})` : ''}`}>
              <div className="flex gap-1.5">
                <input className="input font-mono" type="number" min={1} max={100} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
                {[{ v: '65', l: '«4»' }, { v: '85', l: '«5»' }].map((p) => (
                  <button type="button" key={p.v} onClick={() => setForm({ ...form, target: p.v })}
                    className={`shrink-0 rounded-xl border px-3 text-sm ${form.target === p.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border text-slate-600'}`}>{p.v}% {p.l}</button>
                ))}
              </div>
            </Field>
          </div>
        )}
        {kind === 'scale' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Качество">
              <select className="input" value={form.scaleKey} onChange={(e) => setForm({ ...form, scaleKey: e.target.value })}>
                {meta.scales.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label={`Цель, 1–10 ${currentScale?.current != null ? `(сейчас ${currentScale.current})` : ''}`}>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
                  <button type="button" key={n} onClick={() => setForm({ ...form, target: n })}
                    className={`h-10 flex-1 rounded-lg font-mono text-sm font-semibold ${Number(n) <= Number(form.target) ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                    style={Number(n) <= Number(form.target) ? { background: SCALE_COLORS[form.scaleKey] } : undefined}>{n}</button>
                ))}
              </div>
            </Field>
          </div>
        )}
        {kind === 'exam' && (exams.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Сначала создайте экзамен во вкладке «ОГЭ / ЕГЭ» на странице класса.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Экзамен">
              <select className="input" value={examId || String(exams[0].id)} onChange={(e) => setExamId(e.target.value)}>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.type === 'oge' ? 'ОГЭ' : 'ЕГЭ'} · {e.title}</option>)}
              </select>
            </Field>
            {exam?.type === 'oge' ? (
              <Field label={`Цель — отметка ${lastMock ? `(сейчас прогноз ${lastMock.prediction.label})` : ''}`}>
                <div className="flex gap-1.5">
                  {['3', '4', '5'].map((m) => (
                    <button type="button" key={m} onClick={() => setForm({ ...form, target: m })}
                      className={`h-10 flex-1 rounded-xl border font-mono font-semibold ${form.target === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border text-slate-600'}`}>
                      «{m}» <span className="text-xs font-normal text-muted">от {exam.thresholds[m]}</span>
                    </button>
                  ))}
                </div>
              </Field>
            ) : (
              <Field label={exam?.scale ? 'Цель — тестовый балл' : 'Цель — первичный балл'}>
                <input className="input font-mono" type="number" min={1} max={exam?.scale ? 100 : exam?.maxPrimary} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
              </Field>
            )}
          </div>
        ))}
        {kind === 'attendance' && (
          <Field label={`Цель по посещаемости, % ${data.stats.attendance.rate != null ? `(сейчас ${fmtPct(data.stats.attendance.rate)})` : ''}`}>
            <input className="input max-w-xs font-mono" type="number" min={1} max={100} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
          </Field>
        )}

        <Field label={kind === 'custom' ? 'Цель' : 'Название (необязательно — составится само)'}>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required={kind === 'custom'}
            placeholder={kind === 'custom' ? 'Например: пройти в региональный этап олимпиады по биологии' : ''} />
        </Field>

        <div>
          <span className="label">Срок</span>
          <div className="flex flex-wrap items-center gap-2">
            {deadlinePresets().map((p) => (
              <button type="button" key={p.label} onClick={() => setForm({ ...form, deadline: p.value })}
                className={`chip border px-3 py-1.5 ${form.deadline === p.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border bg-white text-slate-600'}`}>{p.label}</button>
            ))}
            <input type="date" className="input w-auto" value={form.deadline} min={today()} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </div>

        <Field label="Шаги к цели — по одному в строке (необязательно)">
          <textarea className="input h-24" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })}
            placeholder={'Разобрать ошибки последней контрольной\nДве консультации у учителя\nРешить пробный вариант'} />
        </Field>
        <Field label="Комментарий"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading} icon={<Flag className="h-4 w-4" />}>Поставить цель</Button>
        </div>
      </form>
    </Modal>
  );
}
