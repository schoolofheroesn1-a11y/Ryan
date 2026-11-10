import React, { useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, ErrorText, Field, Modal } from '../../components/ui';
import { NOTE_CATEGORIES, today } from '../../lib/format';
import { CATEGORY_STYLE, SCALE_COLORS, type Meta } from '../../lib/meta';

export type BankType = 'files' | 'text' | 'assessment' | 'achievement' | 'note';

const TYPES: { id: BankType; emoji: string; title: string; text: string }[] = [
  { id: 'text', emoji: '✍️', title: 'Текст или рефлексия', text: 'Рефлексия ученика, переписка с родителями, отзыв, наблюдение — просто вставьте текст' },
  { id: 'files', emoji: '📄', title: 'Файлы', text: 'Word, PDF, фото, сканы: характеристики, работы, контрольные, грамоты' },
  { id: 'assessment', emoji: '📊', title: 'Общая оценка', text: 'Оцените мотивацию, самостоятельность, общение и другие качества по шкале 1–10' },
  { id: 'achievement', emoji: '🏆', title: 'Достижение', text: 'Олимпиада, конкурс, соревнование, проект' },
  { id: 'note', emoji: '📝', title: 'Короткая заметка', text: 'Пара слов о поведении, интересах или событии' },
];

const SOURCES = ['Ученик', 'Родитель', 'Учитель', 'Классный руководитель', 'Психолог', 'Тренер / педагог доп. образования', 'Другое'];

export function AddToBankModal({ studentId, meta, onClose, onDone, onPickAchievement }: {
  studentId: number;
  meta: Meta;
  onClose: () => void;
  onDone: () => void;
  onPickAchievement: () => void;
}) {
  const [type, setType] = useState<BankType | null>(null);
  const title = type ? TYPES.find((t) => t.id === type)!.title : 'Добавить в банк ученика';

  return (
    <Modal open onClose={onClose} title={title} wide>
      {!type ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => (t.id === 'achievement' ? onPickAchievement() : setType(t.id))}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-2xl group-hover:bg-indigo-50">{t.emoji}</span>
              <span>
                <span className="block font-semibold text-slate-800">{t.title}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{t.text}</span>
              </span>
            </button>
          ))}
          <p className="text-xs text-slate-400 sm:col-span-2">
            Каждый текст и файл ИИ кратко разберёт: составит резюме и оценит качества по шкалам. Это попадёт в графики динамики.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setType(null)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Выбрать другой тип
          </button>
          {type === 'text' && <TextForm studentId={studentId} meta={meta} onDone={onDone} />}
          {type === 'files' && <FilesForm studentId={studentId} meta={meta} onDone={onDone} />}
          {type === 'assessment' && <AssessmentForm studentId={studentId} meta={meta} onDone={onDone} />}
          {type === 'note' && <NoteForm studentId={studentId} onDone={onDone} />}
        </div>
      )}
    </Modal>
  );
}

function useSubmit(onDone: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };
  return { loading, error, submit };
}

function CategoryPicker({ meta, value, onChange }: { meta: Meta; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {meta.categories.map((c) => (
        <button type="button" key={c} onClick={() => onChange(c)}
          className={`chip border transition ${value === c ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
          {CATEGORY_STYLE[c]?.emoji} {c}
        </button>
      ))}
    </div>
  );
}

function TextForm({ studentId, meta, onDone }: { studentId: number; meta: Meta; onDone: () => void }) {
  const [category, setCategory] = useState('Рефлексия ученика');
  const [source, setSource] = useState('Ученик');
  const [date, setDate] = useState(today());
  const [text, setText] = useState('');
  const { loading, error, submit } = useSubmit(onDone);
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => api.post(`/api/students/${studentId}/messages`, { category, source, date, text })); }} className="space-y-4">
      <div><span className="label">Что это за текст?</span><CategoryPicker meta={meta} value={category} onChange={setCategory} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Автор"><select className="input" value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Дата"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Текст">
        <textarea className="input h-56" value={text} onChange={(e) => setText(e.target.value)} required autoFocus
          placeholder={category === 'Рефлексия ученика'
            ? 'Например: «Сегодня на проекте у меня получилось… Было трудно… В следующий раз я…»'
            : 'Вставьте текст сообщения, отзыва или наблюдения'} />
      </Field>
      <ErrorText error={error} />
      <div className="flex justify-end"><Button type="submit" loading={loading}>Добавить в банк</Button></div>
    </form>
  );
}

function FilesForm({ studentId, meta, onDone }: { studentId: number; meta: Meta; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('Работа ученика');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [drag, setDrag] = useState(false);
  const { loading, error, submit } = useSubmit(onDone);
  const send = () => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('category', category);
    fd.append('date', date);
    fd.append('description', description);
    return api.post(`/api/students/${studentId}/files`, fd);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(send); }} className="space-y-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles([...e.dataTransfer.files]); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
      >
        <Upload className="mb-2 h-7 w-7 text-indigo-400" />
        <span className="font-semibold text-slate-700">{files.length ? files.map((f) => f.name).join(', ') : 'Перетащите файлы сюда или нажмите'}</span>
        <span className="mt-1 text-xs text-slate-400">Word, PDF, TXT, RTF, фото и сканы · до 20 МБ · можно несколько</span>
        <input type="file" multiple className="hidden" onChange={(e) => setFiles([...(e.target.files || [])])}
          accept=".pdf,.doc,.docx,.rtf,.txt,.md,.csv,.htm,.html,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf" />
      </label>
      <div><span className="label">Что это за материал?</span><CategoryPicker meta={meta} value={category} onChange={setCategory} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Дата материала"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Описание (необязательно)"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Например: эссе по литературе" /></Field>
      </div>
      <ErrorText error={error} />
      <div className="flex justify-end"><Button type="submit" loading={loading} disabled={!files.length}>Загрузить</Button></div>
    </form>
  );
}

export function AssessmentForm({ studentId, meta, onDone }: { studentId: number; meta: Meta; onDone: () => void }) {
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState('');
  const { loading, error, submit } = useSubmit(onDone);
  const filled = Object.values(scores).filter((v) => v != null).length;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => api.post(`/api/students/${studentId}/assessments`, { date, comment, scores })); }} className="space-y-4">
      <p className="text-sm text-slate-500">Оцените только то, что можете оценить: остальные шкалы оставьте пустыми. 1 — очень низко, 10 — отлично.</p>
      <div className="space-y-3">
        {meta.scales.map((s) => {
          const v = scores[s.key];
          return (
            <div key={s.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: SCALE_COLORS[s.key] }}>{s.label}</div>
                  <div className="text-xs text-slate-400">{s.hint}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 text-right text-lg font-bold text-slate-800">{v ?? '—'}</span>
                  {v != null && <button type="button" className="text-xs text-slate-400 hover:text-rose-500" onClick={() => setScores({ ...scores, [s.key]: undefined })}>сброс</button>}
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button type="button" key={n} onClick={() => setScores({ ...scores, [s.key]: n })}
                    className={`h-8 flex-1 rounded-lg text-xs font-semibold transition ${v != null && n <= v ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    style={v != null && n <= v ? { background: SCALE_COLORS[s.key] } : undefined}>{n}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Дата"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Комментарий (необязательно)"><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="На чём основана оценка" /></Field>
      </div>
      <ErrorText error={error} />
      <div className="flex justify-end"><Button type="submit" loading={loading} disabled={!filled}>Сохранить оценку ({filled})</Button></div>
    </form>
  );
}

function NoteForm({ studentId, onDone }: { studentId: number; onDone: () => void }) {
  const [category, setCategory] = useState(NOTE_CATEGORIES[0]);
  const [text, setText] = useState('');
  const { loading, error, submit } = useSubmit(onDone);
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => api.post(`/api/students/${studentId}/notes`, { category, text })); }} className="space-y-4">
      <Field label="Тема"><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Заметка"><textarea className="input h-32" value={text} onChange={(e) => setText(e.target.value)} required autoFocus placeholder="Например: сегодня помог однокласснику разобраться с задачей" /></Field>
      <ErrorText error={error} />
      <div className="flex justify-end"><Button type="submit" loading={loading}>Сохранить</Button></div>
    </form>
  );
}
