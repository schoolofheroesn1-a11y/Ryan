import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, MessageSquare, Award, CalendarCheck, Download, FileText, Lightbulb, Pencil, Plus, Sparkles,
  StickyNote, Target, Trash2, TrendingDown, TrendingUp, Minus, Upload, AlertTriangle, Heart, Users, User, GraduationCap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { useApp } from '../../App';
import { Badge, Button, Card, CardHeader, Empty, ErrorText, Field, Modal, Spinner, Stat, Tabs, confirmDelete } from '../../components/ui';
import {
  ACH_CATEGORIES, ACH_LEVELS, ATTENDANCE, GRADE_KINDS, NOTE_CATEGORIES, RISK, fmtDate, fmtSize, gradeBg, gradeColor, today,
} from '../../lib/format';
import { useMeta } from '../../lib/meta';
import { GoalModal } from './Goals';

export function TrendIcon({ t }: { t: string }) {
  if (t === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="h-4 w-4 text-rose-500" />;
  if (t === 'flat') return <Minus className="h-4 w-4 text-slate-400" />;
  return null;
}


// ---------- AI ----------
export const AUDIENCE_ICON: Record<string, React.ReactNode> = {
  учитель: <GraduationCap className="h-4 w-4" />,
  ученик: <User className="h-4 w-4" />,
  родители: <Users className="h-4 w-4" />,
};

export function AiTab({ data, reload }: { data: any; reload: () => void }) {
  const { ai } = useApp();
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(data.reports[0]?.id ?? null);
  const report = data.reports.find((r: any) => r.id === selected) || data.reports[0];
  const meta = useMeta();
  const [goalPreset, setGoalPreset] = useState<any | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.post(`/api/students/${data.student.id}/analyze`, { focus });
      setFocus('');
      await reload();
      setSelected(r.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeReport = async (rid: number) => {
    if (!confirmDelete('этот анализ')) return;
    await api.del(`/api/reports/${rid}`);
    setSelected(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <Card className="border-violet-200">
        <div className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold">Новый анализ портфолио</h3>
              <p className="text-sm text-slate-500">
                {ai.enabled
                  ? `Модель ${ai.model} изучит все данные ученика. ФИО и дата рождения в ИИ не передаются.`
                  : 'Ключ ИИ не настроен — будет выполнен базовый анализ по правилам. Для полноценных советов добавьте AI_API_KEY в настройки сервера.'}
              </p>
            </div>
          </div>
          <Field label="На что обратить внимание (необязательно)">
            <textarea className="input h-20" value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="Например: как подготовить к олимпиаде по математике; почему упала успеваемость; как помочь стать увереннее" />
          </Field>
          <ErrorText error={error} />
          <Button onClick={analyze} loading={loading} icon={<Sparkles className="h-4 w-4" />}>
            {loading ? 'Анализирую документы… (1–5 минут)' : 'Проанализировать'}
          </Button>
        </div>
      </Card>

      {data.reports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.reports.map((r: any) => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className={`rounded-full border px-3 py-1 text-xs ${r.id === report?.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              {fmtDate(r.created_at)}{r.focus ? ` · ${r.focus.slice(0, 30)}` : ''}
            </button>
          ))}
        </div>
      )}

      {report ? <ReportView r={report} onDelete={() => removeReport(report.id)} onAddGoal={(g) => setGoalPreset(g)} /> : (
        <Card><Empty icon={<Lightbulb className="h-10 w-10" />} title="Анализов пока нет" text="Нажмите «Проанализировать», чтобы получить персональные советы по развитию ученика." /></Card>
      )}
      {goalPreset && meta && (
        <GoalModal data={data} meta={meta} onClose={() => setGoalPreset(null)} onDone={() => { setGoalPreset(null); reload(); }}
          preset={{ title: goalPreset.goal, note: [goalPreset.metric, goalPreset.term].filter(Boolean).join(' · '), source: 'ai' }} />
      )}
    </div>
  );
}

export function ListCard({ title, icon, items, cls }: { title: string; icon: React.ReactNode; items: string[]; cls: string }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title={<span className={`flex items-center gap-2 ${cls}`}>{icon}{title}</span>} />
      <ul className="space-y-2 p-5 text-sm text-slate-700">
        {items.map((s, i) => <li key={i} className="flex gap-2"><span className="text-slate-300">•</span><span>{s}</span></li>)}
      </ul>
    </Card>
  );
}

export function ReportView({ r, onDelete, onAddGoal }: { r: any; onDelete: () => void; onAddGoal?: (g: any) => void }) {
  const c = r.content;
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-indigo-50 to-white">
        <div className="space-y-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">Общая картина</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {fmtDate(r.created_at)} · {r.source === 'rules' ? 'анализ по правилам' : r.source}{r.author ? ` · ${r.author}` : ''}
              <button onClick={onDelete} className="rounded p-1 hover:bg-slate-100 hover:text-rose-600" title="Удалить анализ"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {r.focus && <p className="text-xs text-violet-600">Запрос: {r.focus}</p>}
          <p className="text-sm leading-relaxed text-slate-700">{c.summary}</p>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <ListCard title="Сильные стороны" icon={<TrendingUp className="h-4 w-4" />} items={c.strengths} cls="text-emerald-700" />
        <ListCard title="Зоны роста" icon={<Target className="h-4 w-4" />} items={c.growthAreas} cls="text-amber-700" />
      </div>

      {c.recommendations.length > 0 && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2 text-indigo-700"><Lightbulb className="h-4 w-4" />Рекомендации</span>} />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {c.recommendations.map((x: any, i: number) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium">{x.title}</span>
                  <Badge className="shrink-0 gap-1 bg-slate-100 text-slate-600">{AUDIENCE_ICON[x.audience]}{x.audience}</Badge>
                </div>
                <p className="text-sm text-slate-600">{x.details}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ListCard title="Куда развиваться: кружки, олимпиады, проекты" icon={<Award className="h-4 w-4" />} items={c.activities} cls="text-violet-700" />
        {c.goals.length > 0 && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2 text-sky-700"><Target className="h-4 w-4" />Цели</span>} />
            <ul className="divide-y divide-slate-100 text-sm">
              {c.goals.map((g: any, i: number) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{g.goal}</div>
                    <div className="text-xs text-slate-500">{g.metric}{g.term ? ` · ${g.term}` : ''}</div>
                  </div>
                  {onAddGoal && (
                    <button onClick={() => onAddGoal(g)} className="chip shrink-0 border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" title="Сделать целью ученика">
                      <Plus className="h-3.5 w-3.5" />В цели
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ListCard title="Риски" icon={<AlertTriangle className="h-4 w-4" />} items={c.risks} cls="text-rose-700" />

      {c.parentMessage && (
        <Card className="border-pink-200 bg-pink-50/40">
          <div className="space-y-2 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-pink-700"><Heart className="h-4 w-4" />Сообщение для родителей</h3>
            <p className="text-sm text-slate-700">{c.parentMessage}</p>
            <Button variant="secondary" className="text-xs" onClick={() => navigator.clipboard.writeText(c.parentMessage)}>Скопировать</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" title="Удалить">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

// ---------- Attendance ----------
export function AttendanceTab({ data, reload }: { data: any; reload: () => void }) {
  const [form, setForm] = useState({ date: today(), status: 'absent', comment: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = data.stats.attendance;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/students/${data.student.id}/attendance`, form);
      setForm((f) => ({ ...f, comment: '' }));
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async (aid: number) => {
    if (!confirmDelete('отметку')) return;
    await api.del(`/api/attendance/${aid}`);
    reload();
  };

  const chart = Object.entries(ATTENDANCE).map(([k, v]) => ({ name: v.label, value: a[k] || 0, key: k }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Отметить день" subtitle="Если отметка за дату уже есть, она будет заменена" />
          <form onSubmit={add} className="grid gap-3 p-5 sm:grid-cols-4">
            <Field label="Дата"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Статус">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(ATTENDANCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Комментарий"><input className="input" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" loading={loading} icon={<CalendarCheck className="h-4 w-4" />} className="w-full">Сохранить</Button></div>
            <div className="sm:col-span-4"><ErrorText error={error} /></div>
          </form>
        </Card>
        <Card>
          <CardHeader title="Сводка" subtitle={a.rate != null ? `Посещаемость ${a.rate}% из ${a.total} дней` : 'Нет данных'} />
          <ul className="space-y-1.5 p-5 pt-2 text-sm">
            {chart.map((c) => (
              <li key={c.key} className="flex items-center justify-between">
                <span className={`chip ${ATTENDANCE[c.key].cls}`}>{c.name}</span>
                <b className="font-mono text-ink">{c.value}</b>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Пропуски и опоздания" />
        {(() => {
          const list = data.attendance.filter((r: any) => r.status !== 'present');
          if (!list.length) return <Empty title="Пропусков нет" />;
          return (
            <ul className="divide-y divide-slate-100 text-sm">
              {list.map((r: any) => (
                <li key={r.id} className="group flex items-center gap-3 px-5 py-2">
                  <span className="w-28 text-slate-500">{fmtDate(r.date)}</span>
                  <Badge className={ATTENDANCE[r.status].cls}>{ATTENDANCE[r.status].label}</Badge>
                  <span className="flex-1 text-slate-500">{r.comment}</span>
                  <DelBtn onClick={() => del(r.id)} />
                </li>
              ))}
            </ul>
          );
        })()}
      </Card>
    </div>
  );
}


export function AchievementModal({ studentId, onClose, onDone }: { studentId: number; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ title: '', category: ACH_CATEGORIES[0], level: ACH_LEVELS[0], result: '', date: today(), description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('file', file);
    try {
      await api.post(`/api/students/${studentId}/achievements`, fd);
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Новое достижение">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Название"><input className="input" value={form.title} onChange={set('title')} required autoFocus placeholder="Например: Олимпиада по математике" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория"><select className="input" value={form.category} onChange={set('category')}>{ACH_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Уровень"><select className="input" value={form.level} onChange={set('level')}>{ACH_LEVELS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Результат"><input className="input" value={form.result} onChange={set('result')} placeholder="Победитель, призёр, участник…" /></Field>
          <Field label="Дата"><input type="date" className="input" value={form.date} onChange={set('date')} required /></Field>
        </div>
        <Field label="Описание"><textarea className="input h-20" value={form.description} onChange={set('description')} /></Field>
        <Field label="Грамота / диплом (необязательно)"><input type="file" className="input" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Edit student ----------
export function EditStudentModal({ student, onClose, onDone }: { student: any; onClose: () => void; onDone: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({
    fullName: student.full_name, birthDate: student.birth_date || '', interests: student.interests, about: student.about, classId: String(student.class_id || ''),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { api.get('/api/classes').then(setClasses); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/api/students/${student.id}`, form);
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Данные ученика">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Фамилия и имя"><input className="input" value={form.fullName} onChange={set('fullName')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата рождения"><input type="date" className="input" value={form.birthDate} onChange={set('birthDate')} /></Field>
          <Field label="Класс"><select className="input" value={form.classId} onChange={set('classId')}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <Field label="Интересы и увлечения"><input className="input" value={form.interests} onChange={set('interests')} placeholder="шахматы, программирование, рисование" /></Field>
        <Field label="О ученике"><textarea className="input h-24" value={form.about} onChange={set('about')} placeholder="Особенности, цели, пожелания семьи" /></Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
}

