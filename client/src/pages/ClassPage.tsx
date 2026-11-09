import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Search, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, Spinner } from '../components/ui';
import { ATTENDANCE, GRADE_KINDS, RISK, gradeColor, today } from '../lib/format';

export function ClassPage() {
  const { id } = useParams();
  const [cls, setCls] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<null | 'students' | 'grades' | 'attendance'>(null);

  const load = () => api.get(`/api/classes/${id}`).then(setCls).catch((e) => setError(e.message));
  useEffect(() => {
    setCls(null);
    setError(null);
    load();
  }, [id]);

  const students = useMemo(
    () => (cls?.students || []).filter((s: any) => s.full_name.toLowerCase().includes(q.toLowerCase())),
    [cls, q],
  );

  if (error) return <ErrorText error={error} />;
  if (!cls) return <Spinner />;

  const done = () => {
    setModal(null);
    load();
    window.dispatchEvent(new Event('classes:changed'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Класс {cls.name}</h1>
          <p className="text-sm text-slate-500">{cls.year} · учеников: {cls.students.length}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ClipboardList className="h-4 w-4" />} onClick={() => setModal('grades')} disabled={!cls.students.length}>Выставить оценки</Button>
          <Button variant="secondary" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => setModal('attendance')} disabled={!cls.students.length}>Отметить посещаемость</Button>
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setModal('students')}>Добавить учеников</Button>
        </div>
      </div>

      <Card>
        {cls.students.length === 0 ? (
          <Empty icon={<Users className="h-10 w-10" />} title="В классе пока нет учеников" text="Добавьте список учеников — можно сразу всех, по одному в строке."
            action={<Button onClick={() => setModal('students')}>Добавить учеников</Button>} />
        ) : (
          <>
            <div className="border-b border-slate-100 p-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input className="input pl-9" placeholder="Поиск ученика" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Ученик</th>
                    <th className="px-3 py-2.5 text-center font-medium">Ср. балл</th>
                    <th className="px-3 py-2.5 text-center font-medium">Посещаемость</th>
                    <th className="px-3 py-2.5 text-center font-medium">Достижения</th>
                    <th className="px-5 py-2.5 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link to={`/students/${s.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{s.full_name}</Link>
                        {s.interests && <div className="text-xs text-slate-400">{s.interests}</div>}
                      </td>
                      <td className={`px-3 py-3 text-center font-semibold ${gradeColor(s.average)}`}>{s.average ?? '—'}</td>
                      <td className="px-3 py-3 text-center">{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                      <td className="px-3 py-3 text-center">{s.achievements || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge className={RISK[s.risk].cls}>{RISK[s.risk].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <AddStudentsModal open={modal === 'students'} classId={cls.id} onClose={() => setModal(null)} onDone={done} />
      {modal === 'grades' && <BulkGradesModal cls={cls} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'attendance' && <BulkAttendanceModal cls={cls} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

function AddStudentsModal({ open, classId, onClose, onDone }: { open: boolean; classId: number; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = text.split('\n').map((s) => s.trim()).filter(Boolean);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/classes/${classId}/students/bulk`, { names });
      setText('');
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить учеников">
      <div className="space-y-4">
        <Field label="Фамилия и имя — по одному ученику в строке (можно вставить из Excel)">
          <textarea className="input h-48 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Иванов Иван\nПетрова Мария\n...'} autoFocus />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={loading} disabled={!names.length}>Добавить {names.length || ''}</Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkGradesModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState(GRADE_KINDS[0]);
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/subjects').then((s) => {
      setSubjects(s);
      if (s[0]) setSubjectId(String(s[0].id));
    });
  }, []);

  const count = Object.keys(grades).length;
  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/classes/${cls.id}/grades/bulk`, {
        subjectId, date, kind,
        grades: Object.entries(grades).map(([studentId, value]) => ({ studentId: Number(studentId), value })),
      });
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Оценки — ${cls.name}`} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Предмет">
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Тип работы">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {GRADE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Дата"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {cls.students.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm">{s.full_name}</span>
              <div className="flex gap-1">
                {[5, 4, 3, 2].map((v) => (
                  <button
                    key={v}
                    onClick={() => setGrades((g) => {
                      const n = { ...g };
                      if (n[s.id] === v) delete n[s.id]; else n[s.id] = v;
                      return n;
                    })}
                    className={`h-8 w-8 rounded-md text-sm font-semibold transition ${
                      grades[s.id] === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">Нажмите на оценку, чтобы выбрать; повторное нажатие снимает выбор. Ученики без оценки пропускаются.</p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={loading} disabled={!count || !subjectId}>Сохранить ({count})</Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkAttendanceModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/api/classes/${cls.id}/attendance?date=${date}`).then((rows: any[]) => {
      const m: Record<number, string> = {};
      for (const s of cls.students) m[s.id] = 'present';
      for (const r of rows) m[r.student_id] = r.status;
      setStatus(m);
    });
  }, [date]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/classes/${cls.id}/attendance/bulk`, {
        date,
        records: Object.entries(status).map(([studentId, st]) => ({ studentId: Number(studentId), status: st })),
      });
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Посещаемость — ${cls.name}`} wide>
      <div className="space-y-4">
        <Field label="Дата"><input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {cls.students.map((s: any) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm">{s.full_name}</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(ATTENDANCE).map(([k, v]) => (
                  <button
                    key={k}
                    title={v.label}
                    onClick={() => setStatus((m) => ({ ...m, [s.id]: k }))}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${status[s.id] === k ? v.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >{v.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={loading}>Сохранить</Button>
        </div>
      </div>
    </Modal>
  );
}
