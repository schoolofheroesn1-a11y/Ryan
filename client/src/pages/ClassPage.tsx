import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, CalendarCheck, ClipboardList, Search, Trash2, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, Spinner, Tabs } from '../components/ui';
import { RISK, gradeColor } from '../lib/format';
import { scoreColor, useMeta } from '../lib/meta';
import { BulkAttendanceModal, BulkGradesModal } from './class/JournalModals';
import { ClassAnalytics } from './class/Analytics';

type Tab = 'students' | 'analytics';

export function ClassPage() {
  const { id } = useParams();
  const meta = useMeta();
  const [cls, setCls] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('students');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<null | 'students' | 'grades' | 'attendance'>(null);

  const load = useCallback(() => {
    api.get(`/api/classes/${id}`).then(setCls).catch((e) => setError(e.message));
    api.get(`/api/classes/${id}/analytics`).then(setAnalytics).catch(() => {});
  }, [id]);
  useEffect(() => {
    setCls(null);
    setAnalytics(null);
    setError(null);
    setSelected(new Set());
    setTab('students');
    load();
  }, [id, load]);

  const byId = useMemo(() => new Map<number, any>((analytics?.students || []).map((s: any) => [s.id, s])), [analytics]);
  const students = useMemo(
    () => (cls?.students || []).filter((s: any) => s.full_name.toLowerCase().includes(q.toLowerCase())),
    [cls, q],
  );

  if (error) return <ErrorText error={error} />;
  if (!cls || !meta) return <Spinner />;

  const done = () => {
    setModal(null);
    load();
    window.dispatchEvent(new Event('classes:changed'));
  };
  const toggle = (sid: number) => setSelected((s) => { const n = new Set(s); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const allChecked = students.length > 0 && students.every((s: any) => selected.has(s.id));
  const bulkDelete = async () => {
    if (!window.confirm(`Удалить выбранных учеников (${selected.size}) вместе с их портфолио? Это нельзя отменить.`)) return;
    await api.post('/api/students/bulk-delete', { ids: [...selected] });
    setSelected(new Set());
    done();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-400">Класс</div>
          <h1 className="text-3xl font-bold tracking-tight">{cls.name}</h1>
          <p className="text-sm text-slate-500">{cls.year} · учеников: {cls.students.length}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ClipboardList className="h-4 w-4" />} onClick={() => setModal('grades')} disabled={!cls.students.length}>Выставить оценки</Button>
          <Button variant="secondary" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => setModal('attendance')} disabled={!cls.students.length}>Посещаемость</Button>
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setModal('students')}>Добавить учеников</Button>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'students', label: 'Ученики', count: cls.students.length, icon: <Users className="h-4 w-4" /> },
        { id: 'analytics', label: 'Аналитика класса', icon: <BarChart3 className="h-4 w-4" /> },
      ]} />

      {tab === 'students' && (
        <Card>
          {cls.students.length === 0 ? (
            <Empty icon={<Users className="h-10 w-10" />} title="В классе пока нет учеников" text="Добавьте список учеников — по одному в строке: фамилия и имя."
              action={<Button onClick={() => setModal('students')}>Добавить учеников</Button>} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className="input pl-9" placeholder="Поиск ученика" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {selected.size > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 text-sm text-rose-700">
                    Выбрано: {selected.size}
                    <Button variant="danger" className="px-3 py-1.5" icon={<Trash2 className="h-4 w-4" />} onClick={bulkDelete}>Удалить</Button>
                    <button className="text-rose-500 underline" onClick={() => setSelected(new Set())}>отмена</button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-slate-100 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(students.map((s: any) => s.id)))} aria-label="Выбрать всех" />
                      </th>
                      <th className="px-2 py-3 font-semibold">Ученик</th>
                      <th className="px-3 py-3 text-center font-semibold">Ср. балл</th>
                      <th className="px-3 py-3 text-center font-semibold">Посещ.</th>
                      <th className="px-3 py-3 text-center font-semibold" title="Средний уровень по шкалам 1–10">Качества</th>
                      <th className="px-3 py-3 text-center font-semibold">Динамика</th>
                      <th className="px-4 py-3 font-semibold">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s: any) => {
                      const a = byId.get(s.id);
                      return (
                        <tr key={s.id} className={`transition hover:bg-indigo-50/40 ${selected.has(s.id) ? 'bg-rose-50/50' : ''}`}>
                          <td className="px-4 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Выбрать ${s.full_name}`} /></td>
                          <td className="px-2 py-3">
                            <Link to={`/students/${s.id}`} className="flex items-center gap-3 font-semibold text-slate-800 hover:text-indigo-600">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700">
                                {s.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                              </span>
                              <span>
                                {s.full_name}
                                {s.interests && <span className="block text-xs font-normal text-slate-400">{s.interests}</span>}
                              </span>
                            </Link>
                          </td>
                          <td className={`px-3 py-3 text-center font-bold ${gradeColor(s.average)}`}>{s.average ?? '—'}</td>
                          <td className="px-3 py-3 text-center">{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                          <td className="px-3 py-3 text-center"><span className={`rounded-lg px-2 py-1 font-semibold ${scoreColor(a?.scaleAverage)}`}>{a?.scaleAverage ?? '—'}</span></td>
                          <td className="px-3 py-3 text-center">
                            {a?.momentum > 0 && <TrendingUp className="mx-auto h-4 w-4 text-emerald-500" />}
                            {a?.momentum < 0 && <TrendingDown className="mx-auto h-4 w-4 text-rose-500" />}
                            {(!a || a.momentum === 0) && <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3"><Badge className={RISK[s.risk].cls}>{RISK[s.risk].label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'analytics' && (analytics ? <ClassAnalytics classId={cls.id} data={analytics} meta={meta} reload={load} /> : <Spinner />)}

      {modal === 'students' && <AddStudentsModal classId={cls.id} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'grades' && <BulkGradesModal cls={cls} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'attendance' && <BulkAttendanceModal cls={cls} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

/** A line that doesn't look like "Фамилия Имя": digits, percents, punctuation, too long, etc. */
function suspicious(line: string) {
  return /[\d%:;()«»"!?№/\\]/.test(line) || line.length > 50 || line.split(/\s+/).length > 4 || /^[a-zа-яё]/.test(line) || /\.$/.test(line);
}

function AddStudentsModal({ classId, onClose, onDone }: { classId: number; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const bad = names.filter(suspicious);
  const tooMany = names.length > 45;

  const submit = async (list: string[]) => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/classes/${classId}/students/bulk`, { names: list });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Добавить учеников" wide>
      <div className="space-y-4">
        <Field label="Только фамилия и имя — по одному ученику в строке (можно вставить столбец из Excel)">
          <textarea className="input h-56 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Иванов Иван\nПетрова Мария\n...'} autoFocus />
        </Field>
        <p className="text-xs text-slate-500">Документы, характеристики и рефлексию добавляйте не сюда, а в «Банк ученика» в карточке ученика.</p>
        {(bad.length > 0 || tooMany) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Похоже, это не список учеников</div>
            {tooMany && <p className="mt-1">Строк: {names.length} — больше, чем обычно бывает в классе.</p>}
            {bad.length > 0 && (
              <p className="mt-1">Эти строки не похожи на «Фамилия Имя»: {bad.slice(0, 5).map((b) => `«${b.slice(0, 40)}»`).join(', ')}{bad.length > 5 ? ` и ещё ${bad.length - 5}` : ''}.</p>
            )}
          </div>
        )}
        <ErrorText error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          {bad.length > 0 && names.length > bad.length && (
            <Button variant="secondary" loading={loading} onClick={() => submit(names.filter((n) => !suspicious(n)))}>Добавить без подозрительных ({names.length - bad.length})</Button>
          )}
          <Button onClick={() => submit(names)} loading={loading} disabled={!names.length}>
            {bad.length || tooMany ? `Всё равно добавить ${names.length}` : `Добавить ${names.length || ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
