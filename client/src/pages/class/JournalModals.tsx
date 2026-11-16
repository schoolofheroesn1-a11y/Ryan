import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, ErrorText, Field, Modal } from '../../components/ui';
import { ATTENDANCE, GRADE_KINDS, markFromPercent, pctFill, pctText, today } from '../../lib/format';
import { ModeSwitch } from '../student/Performance';

export function BulkGradesModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState(GRADE_KINDS[0]);
  const [mode, setMode] = useState<'mark' | 'percent' | 'points'>('percent');
  const [max, setMax] = useState('20');
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [vals, setVals] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/subjects').then((s) => {
      setSubjects(s);
      if (s[0]) setSubjectId(String(s[0].id));
    });
  }, []);

  const entries = mode === 'mark'
    ? Object.entries(marks).map(([sid, v]) => ({ studentId: Number(sid), value: v }))
    : Object.entries(vals).filter(([, v]) => v.trim() !== '').map(([sid, v]) => (
      mode === 'percent' ? { studentId: Number(sid), percent: v } : { studentId: Number(sid), score: v, max }));
  const pctOf = (v: string) => {
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n) || v.trim() === '') return null;
    return mode === 'percent' ? n : Number(max) > 0 ? (n / Number(max)) * 100 : null;
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.post(`/api/classes/${cls.id}/grades/bulk`, { subjectId, date, kind, max, grades: entries });
      if (r.added < entries.length) {
        setError(`Сохранено ${r.added} из ${entries.length}: проверьте значения (проценты 0–100, баллы не больше максимума).`);
        setLoading(false);
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e.message);
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
        <div className="flex flex-wrap items-center gap-3">
          <ModeSwitch mode={mode} onChange={setMode} />
          {mode === 'points' && (
            <label className="flex items-center gap-2 text-sm text-slate-600">Максимум баллов
              <input className="input w-24 font-mono" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} />
            </label>
          )}
        </div>
        <div className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-xl border border-border">
          {cls.students.map((s: any) => {
            const p = mode === 'mark' ? null : pctOf(vals[s.id] || '');
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">{s.full_name}</span>
                {mode === 'mark' ? (
                  <div className="flex gap-1">
                    {[5, 4, 3, 2].map((v) => (
                      <button key={v} onClick={() => setMarks((g) => { const n = { ...g }; if (n[s.id] === v) delete n[s.id]; else n[s.id] = v; return n; })}
                        className={`h-8 w-8 rounded-lg font-mono text-sm font-semibold transition ${marks[s.id] === v ? pctFill(v * 20) + ' text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{v}</button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {p != null && <span className={`w-16 text-right font-mono text-xs ${pctText(p)}`}>{Math.round(p)}% «{markFromPercent(p)}»</span>}
                    <input className="input w-24 py-1.5 text-right font-mono" inputMode="decimal" value={vals[s.id] || ''}
                      onChange={(e) => setVals({ ...vals, [s.id]: e.target.value })} placeholder={mode === 'percent' ? '%' : `из ${max}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">Пустые строки пропускаются. 85%+ — «5», 65%+ — «4», 45%+ — «3».</p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={loading} disabled={!entries.length || !subjectId}>Сохранить ({entries.length})</Button>
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

