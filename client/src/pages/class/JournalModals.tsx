import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, ErrorText, Field, Modal } from '../../components/ui';
import { ATTENDANCE, GRADE_KINDS, today } from '../../lib/format';

export function BulkGradesModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
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

export function BulkAttendanceModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
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

