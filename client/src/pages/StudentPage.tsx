import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Award, CalendarCheck, Download, FileText, Image as ImageIcon, Lightbulb, Pencil, Plus, Sparkles,
  StickyNote, Target, Trash2, TrendingDown, TrendingUp, Minus, Upload, AlertTriangle, Heart, Users, User, GraduationCap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Badge, Button, Card, CardHeader, Empty, ErrorText, Field, Modal, Spinner, Stat, Tabs, confirmDelete } from '../components/ui';
import {
  ACH_CATEGORIES, ACH_LEVELS, ATTENDANCE, GRADE_KINDS, NOTE_CATEGORIES, RISK, fmtDate, fmtSize, gradeBg, gradeColor, today,
} from '../lib/format';

type Tab = 'overview' | 'ai' | 'grades' | 'attendance' | 'achievements' | 'notes' | 'files';

export function StudentPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  const load = () => api.get(`/api/students/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    setData(null);
    load();
  }, [id]);

  if (error) return <ErrorText error={error} />;
  if (!data) return <Spinner />;
  const { student, stats } = data;

  const remove = async () => {
    if (!confirmDelete(`ученика «${student.full_name}» со всем портфолио`)) return;
    await api.del(`/api/students/${student.id}`);
    window.dispatchEvent(new Event('classes:changed'));
    navigate(student.class_id ? `/classes/${student.class_id}` : '/');
  };

  return (
    <div className="space-y-6">
      <div>
        {student.class_id && (
          <Link to={`/classes/${student.class_id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> {student.class_name}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xl font-semibold text-white">
              {student.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{student.full_name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{student.class_name || 'Без класса'}</span>
                {student.birth_date && <span>· {fmtDate(student.birth_date)}</span>}
                <Badge className={RISK[stats.risk].cls}>{RISK[stats.risk].label}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Изменить</Button>
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove} title="Удалить ученика" />
          </div>
        </div>
        {(student.interests || student.about) && (
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            {student.interests && <p><span className="text-slate-400">Интересы:</span> {student.interests}</p>}
            {student.about && <p><span className="text-slate-400">О ученике:</span> {student.about}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Средний балл" value={stats.average ?? '—'} valueCls={gradeColor(stats.average)} hint={`оценок: ${stats.gradesCount}`} />
        <Stat label="Посещаемость" value={stats.attendance.rate != null ? `${stats.attendance.rate}%` : '—'} hint={`пропусков: ${stats.attendance.absent + stats.attendance.sick + stats.attendance.excused}`} />
        <Stat label="Достижения" value={stats.achievementsCount} hint={Object.keys(stats.achievementsByCategory).join(', ') || 'пока нет'} />
        <Stat label="Файлы и заметки" value={`${stats.filesCount} / ${stats.notesCount}`} hint="файлов / заметок" />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Обзор' },
          { id: 'ai', label: '✨ ИИ-советы', count: data.reports.length },
          { id: 'grades', label: 'Оценки', count: data.grades.length },
          { id: 'attendance', label: 'Посещаемость', count: data.attendance.length },
          { id: 'achievements', label: 'Достижения', count: data.achievements.length },
          { id: 'notes', label: 'Заметки', count: data.notes.length },
          { id: 'files', label: 'Файлы', count: data.files.length },
        ]}
      />

      {tab === 'overview' && <Overview data={data} onAnalyze={() => setTab('ai')} />}
      {tab === 'ai' && <AiTab data={data} reload={load} />}
      {tab === 'grades' && <GradesTab data={data} reload={load} />}
      {tab === 'attendance' && <AttendanceTab data={data} reload={load} />}
      {tab === 'achievements' && <AchievementsTab data={data} reload={load} />}
      {tab === 'notes' && <NotesTab data={data} reload={load} />}
      {tab === 'files' && <FilesTab data={data} reload={load} />}

      {editing && <EditStudentModal student={student} onClose={() => setEditing(false)} onDone={() => { setEditing(false); load(); window.dispatchEvent(new Event('classes:changed')); }} />}
    </div>
  );
}

// ---------- Overview ----------
function TrendIcon({ t }: { t: string }) {
  if (t === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="h-4 w-4 text-rose-500" />;
  if (t === 'flat') return <Minus className="h-4 w-4 text-slate-400" />;
  return null;
}

function Overview({ data, onAnalyze }: { data: any; onAnalyze: () => void }) {
  const { stats, grades, reports } = data;

  // monthly average for line chart
  const byMonth = new Map<string, number[]>();
  for (const g of grades) {
    const m = g.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(g.value);
  }
  const timeline = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, vs]) => ({
      month: new Date(m + '-01T00:00:00').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      avg: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100,
    }));

  const barColor = (v: number) => (v >= 4.5 ? '#10b981' : v >= 3.5 ? '#6366f1' : v >= 3 ? '#f59e0b' : '#f43f5e');
  const last = reports[0];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Успеваемость по предметам" />
        {stats.subjects.length === 0 ? (
          <Empty title="Оценок пока нет" text="Добавьте оценки во вкладке «Оценки» или через журнал класса." />
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={Math.max(200, stats.subjects.length * 34)}>
              <BarChart data={stats.subjects} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="subject" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [v, 'Средний балл']} />
                <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={18}>
                  {stats.subjects.map((s: any) => <Cell key={s.subject} fill={barColor(s.average)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Динамика за месяц" subtitle="последние 30 дней к предыдущему периоду" />
        <ul className="divide-y divide-slate-100 text-sm">
          {stats.subjects.map((s: any) => (
            <li key={s.subject} className="flex items-center justify-between px-5 py-2">
              <span className="truncate">{s.subject}</span>
              <span className="flex items-center gap-2">
                <span className={`font-semibold ${gradeColor(s.average)}`}>{s.average}</span>
                <TrendIcon t={s.trend} />
              </span>
            </li>
          ))}
          {stats.subjects.length === 0 && <li className="px-5 py-6 text-center text-slate-400">Нет данных</li>}
        </ul>
      </Card>

      {timeline.length > 1 && (
        <Card className="lg:col-span-2">
          <CardHeader title="Средний балл по месяцам" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline}>
                <CartesianGrid stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[2, 5]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [v, 'Средний балл']} />
                <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className={`${timeline.length > 1 ? '' : 'lg:col-span-3'} border-violet-200 bg-gradient-to-br from-violet-50 to-white`}>
        <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" />ИИ-анализ</span>} />
        <div className="space-y-3 p-5 text-sm">
          {last ? (
            <>
              <p className="text-slate-700">{last.content.summary}</p>
              <p className="text-xs text-slate-400">от {fmtDate(last.created_at)}</p>
            </>
          ) : (
            <p className="text-slate-600">ИИ проанализирует оценки, посещаемость, достижения и заметки и предложит план развития.</p>
          )}
          <Button onClick={onAnalyze} icon={<Sparkles className="h-4 w-4" />}>{last ? 'Открыть советы' : 'Получить советы'}</Button>
        </div>
      </Card>

      {stats.riskReasons.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 lg:col-span-3">
          <div className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div><span className="font-medium">Обратите внимание:</span> {stats.riskReasons.join('; ')}</div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------- AI ----------
const AUDIENCE_ICON: Record<string, React.ReactNode> = {
  учитель: <GraduationCap className="h-4 w-4" />,
  ученик: <User className="h-4 w-4" />,
  родители: <Users className="h-4 w-4" />,
};

function AiTab({ data, reload }: { data: any; reload: () => void }) {
  const { ai } = useApp();
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(data.reports[0]?.id ?? null);
  const report = data.reports.find((r: any) => r.id === selected) || data.reports[0];

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
            {loading ? 'Анализирую… (до минуты)' : 'Проанализировать'}
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

      {report ? <ReportView r={report} onDelete={() => removeReport(report.id)} /> : (
        <Card><Empty icon={<Lightbulb className="h-10 w-10" />} title="Анализов пока нет" text="Нажмите «Проанализировать», чтобы получить персональные советы по развитию ученика." /></Card>
      )}
    </div>
  );
}

function ListCard({ title, icon, items, cls }: { title: string; icon: React.ReactNode; items: string[]; cls: string }) {
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

function ReportView({ r, onDelete }: { r: any; onDelete: () => void }) {
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
                <li key={i} className="px-5 py-3">
                  <div className="font-medium">{g.goal}</div>
                  <div className="text-xs text-slate-500">{g.metric}{g.term ? ` · ${g.term}` : ''}</div>
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

// ---------- Grades ----------
function GradesTab({ data, reload }: { data: any; reload: () => void }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [form, setForm] = useState({ subjectId: '', value: 5, kind: GRADE_KINDS[0], date: today(), comment: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/api/subjects').then((s) => {
      setSubjects(s);
      if (s[0]) setForm((f) => ({ ...f, subjectId: String(s[0].id) }));
    });
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/students/${data.student.id}/grades`, form);
      setForm((f) => ({ ...f, comment: '' }));
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

  const list = filter ? data.grades.filter((g: any) => g.subject === filter) : data.grades;
  const subjectsWithGrades = [...new Set<string>(data.grades.map((g: any) => g.subject))].sort();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Добавить оценку" />
        <form onSubmit={add} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Предмет">
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Оценка">
            <div className="flex gap-1">
              {[5, 4, 3, 2, 1].map((v) => (
                <button type="button" key={v} onClick={() => setForm({ ...form, value: v })}
                  className={`h-9 flex-1 rounded-md text-sm font-semibold ${form.value === v ? gradeBg(v) + ' text-white' : 'bg-slate-100 text-slate-600'}`}>{v}</button>
              ))}
            </div>
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
        <CardHeader title="Все оценки" action={
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Все предметы</option>
            {subjectsWithGrades.map((s) => <option key={s}>{s}</option>)}
          </select>
        } />
        {list.length === 0 ? <Empty title="Оценок нет" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-2">Дата</th><th className="px-3 py-2">Предмет</th><th className="px-3 py-2">Оценка</th><th className="px-3 py-2">Тип</th><th className="px-3 py-2">Комментарий</th><th className="px-3 py-2">Учитель</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((g: any) => (
                  <tr key={g.id} className="group hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-2 text-slate-500">{fmtDate(g.date)}</td>
                    <td className="px-3 py-2">{g.subject}</td>
                    <td className="px-3 py-2"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-md font-semibold text-white ${gradeBg(g.value)}`}>{g.value}</span></td>
                    <td className="px-3 py-2 text-slate-500">{g.kind}</td>
                    <td className="px-3 py-2 text-slate-500">{g.comment}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{g.teacher}</td>
                    <td className="px-3 py-2 text-right"><DelBtn onClick={() => del(g.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" title="Удалить">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

// ---------- Attendance ----------
function AttendanceTab({ data, reload }: { data: any; reload: () => void }) {
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
  const colors: Record<string, string> = { present: '#10b981', late: '#f59e0b', absent: '#f43f5e', sick: '#0ea5e9', excused: '#8b5cf6' };

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
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chart}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>{chart.map((c) => <Cell key={c.key} fill={colors[c.key]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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

// ---------- Achievements ----------
function AchievementsTab({ data, reload }: { data: any; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const del = async (aid: number) => {
    if (!confirmDelete('достижение')) return;
    await api.del(`/api/achievements/${aid}`);
    reload();
  };
  return (
    <Card>
      <CardHeader title="Достижения" subtitle="Олимпиады, конкурсы, спорт, творчество, проекты" action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Добавить</Button>} />
      {data.achievements.length === 0 ? (
        <Empty icon={<Award className="h-10 w-10" />} title="Достижений пока нет" text="Добавьте грамоты, дипломы и результаты участия — ИИ учтёт их в советах." />
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {data.achievements.map((a: any) => (
            <div key={a.id} className="group relative rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Award className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge className="bg-indigo-50 text-indigo-700">{a.category}</Badge>
                    <Badge className="bg-slate-100 text-slate-600">{a.level}</Badge>
                    {a.result && <Badge className="bg-emerald-50 text-emerald-700">{a.result}</Badge>}
                  </div>
                  {a.description && <p className="mt-2 text-sm text-slate-600">{a.description}</p>}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    {fmtDate(a.date)}
                    {a.file_id && <a href={`/api/files/${a.file_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><FileText className="h-3.5 w-3.5" />{a.file_name}</a>}
                  </div>
                </div>
                <DelBtn onClick={() => del(a.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <AchievementModal studentId={data.student.id} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </Card>
  );
}

function AchievementModal({ studentId, onClose, onDone }: { studentId: number; onClose: () => void; onDone: () => void }) {
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

// ---------- Notes ----------
function NotesTab({ data, reload }: { data: any; reload: () => void }) {
  const { user } = useApp();
  const [category, setCategory] = useState(NOTE_CATEGORIES[0]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/students/${data.student.id}/notes`, { category, text });
      setText('');
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async (nid: number) => {
    if (!confirmDelete('заметку')) return;
    await api.del(`/api/notes/${nid}`);
    reload();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title="Новая заметка" subtitle="Наблюдения о характере, интересах, поведении" />
        <form onSubmit={add} className="space-y-3 p-5">
          <Field label="Категория"><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Текст"><textarea className="input h-32" value={text} onChange={(e) => setText(e.target.value)} required placeholder="Например: проявил лидерские качества при подготовке классного проекта" /></Field>
          <ErrorText error={error} />
          <Button type="submit" loading={loading} icon={<StickyNote className="h-4 w-4" />}>Добавить</Button>
        </form>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Заметки учителей" />
        {data.notes.length === 0 ? <Empty icon={<StickyNote className="h-10 w-10" />} title="Заметок пока нет" /> : (
          <ul className="divide-y divide-slate-100">
            {data.notes.map((n: any) => (
              <li key={n.id} className="group px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Badge className="bg-slate-100 text-slate-600">{n.category}</Badge>
                  {n.teacher} · {fmtDate(n.created_at)}
                  <span className="flex-1" />
                  {(n.teacher_id === user!.id || user!.role === 'admin') && <DelBtn onClick={() => del(n.id)} />}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------- Files ----------
function FilesTab({ data, reload }: { data: any; reload: () => void }) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files?.length) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files', f));
    fd.append('description', description);
    try {
      await api.post(`/api/students/${data.student.id}/files`, fd);
      setFiles(null);
      setDescription('');
      setInputKey((k) => k + 1);
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async (fid: number) => {
    if (!confirmDelete('файл')) return;
    await api.del(`/api/files/${fid}`);
    reload();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Загрузить файлы" subtitle="Работы, фото, грамоты, PDF — до 20 МБ каждый" />
        <form onSubmit={upload} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
          <input key={inputKey} type="file" multiple className="input" onChange={(e) => setFiles(e.target.files)} />
          <input className="input" placeholder="Описание (например: проект по биологии)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" loading={loading} disabled={!files?.length} icon={<Upload className="h-4 w-4" />}>Загрузить</Button>
          <div className="sm:col-span-3"><ErrorText error={error} /></div>
        </form>
      </Card>

      <Card>
        {data.files.length === 0 ? <Empty icon={<FileText className="h-10 w-10" />} title="Файлов пока нет" /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.files.map((f: any) => {
              const isImg = f.mime.startsWith('image/') && f.mime !== 'image/svg+xml';
              return (
                <div key={f.id} className="group overflow-hidden rounded-lg border border-slate-200">
                  <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex h-36 items-center justify-center bg-slate-50">
                    {isImg ? <img src={`/api/files/${f.id}`} alt={f.original_name} className="h-full w-full object-cover" loading="lazy" />
                      : f.mime.startsWith('image/') ? <ImageIcon className="h-10 w-10 text-slate-300" /> : <FileText className="h-10 w-10 text-slate-300" />}
                  </a>
                  <div className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" title={f.original_name}>{f.original_name}</div>
                      {f.description && <div className="truncate text-xs text-slate-500">{f.description}</div>}
                      <div className="text-xs text-slate-400">{fmtSize(f.size)} · {fmtDate(f.created_at)}</div>
                    </div>
                    <a href={`/api/files/${f.id}?download=1`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Скачать"><Download className="h-4 w-4" /></a>
                    <DelBtn onClick={() => del(f.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Edit student ----------
function EditStudentModal({ student, onClose, onDone }: { student: any; onClose: () => void; onDone: () => void }) {
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
