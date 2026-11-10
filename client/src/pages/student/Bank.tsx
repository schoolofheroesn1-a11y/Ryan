import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Eye, Loader2, Plus, RefreshCw, Search, Sparkles, StickyNote, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../App';
import { Badge, Button, Card, Empty, Modal, confirmDelete } from '../../components/ui';
import { fmtDate, fmtSize } from '../../lib/format';
import { CATEGORY_STYLE, SCALE_COLORS, monthLabel, scoreColor, type Meta } from '../../lib/meta';

type Filter = 'all' | 'materials' | 'assessments' | 'notes' | 'achievements';

interface Item { kind: 'material' | 'assessment' | 'note' | 'achievement'; date: string; id: number; data: any }

export function BankTab({ data, meta, reload, onAdd }: { data: any; meta: Meta; reload: () => void; onAdd: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<any | null>(null);
  const pending = data.files.some((f: any) => f.ai_status === 'pending');

  // While the AI is still reading new materials, refresh every few seconds.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(reload, 6000);
    return () => clearInterval(t);
  }, [pending, reload]);

  const items: Item[] = useMemo(() => {
    const list: Item[] = [
      ...data.files.map((f: any) => ({ kind: 'material' as const, date: f.material_date, id: f.id, data: f })),
      ...data.assessments.map((a: any) => ({ kind: 'assessment' as const, date: a.date, id: a.id, data: a })),
      ...data.notes.map((n: any) => ({ kind: 'note' as const, date: String(n.created_at).slice(0, 10), id: n.id, data: n })),
      ...data.achievements.map((a: any) => ({ kind: 'achievement' as const, date: a.date, id: a.id, data: a })),
    ];
    const kindOf: Record<Filter, Item['kind'] | null> = { all: null, materials: 'material', assessments: 'assessment', notes: 'note', achievements: 'achievement' };
    const needle = q.trim().toLowerCase();
    return list
      .filter((i) => !kindOf[filter] || i.kind === kindOf[filter])
      .filter((i) => !needle || JSON.stringify(i.data).toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [data, filter, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      const k = i.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return [...m.entries()];
  }, [items]);

  const counts = {
    all: data.files.length + data.assessments.length + data.notes.length + data.achievements.length,
    materials: data.files.length,
    assessments: data.assessments.length,
    notes: data.notes.length,
    achievements: data.achievements.length,
  };
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Всё' },
    { id: 'materials', label: '📄 Материалы' },
    { id: 'assessments', label: '📊 Общие оценки' },
    { id: 'notes', label: '📝 Заметки' },
    { id: 'achievements', label: '🏆 Достижения' },
  ];

  const del = async (i: Item) => {
    const path = { material: 'files', assessment: 'assessments', note: 'notes', achievement: 'achievements' }[i.kind];
    if (!confirmDelete('эту запись')) return;
    await api.del(`/api/${path}/${i.id}`);
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`chip border px-3 py-1.5 text-sm transition ${filter === f.id ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            {f.label} <span className="opacity-70">{counts[f.id]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Поиск по банку" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {pending && (
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm text-violet-700">
          <Loader2 className="h-4 w-4 animate-spin" /> ИИ разбирает новые материалы — резюме и баллы появятся через минуту.
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <Empty icon={<Sparkles className="h-10 w-10" />} title={counts.all ? 'Ничего не найдено' : 'Банк пока пуст'}
            text="Добавляйте рефлексию, характеристики, переписку, работы ученика и общие оценки — всё соберётся здесь, а ИИ построит по ним динамику и советы."
            action={!counts.all && <Button icon={<Plus className="h-4 w-4" />} onClick={onAdd}>Добавить первый материал</Button>} />
        </Card>
      ) : (
        groups.map(([month, list]) => (
          <section key={month}>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">{monthLabel(month)}</h3>
            <div className="space-y-3">
              {list.map((i) => (
                <BankItem key={`${i.kind}-${i.id}`} item={i} meta={meta} onView={setViewing} onDelete={() => del(i)} reload={reload} />
              ))}
            </div>
          </section>
        ))
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.name} wide>
          <pre className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-700">{viewing.text || 'Текст не найден'}</pre>
        </Modal>
      )}
    </div>
  );
}

function ScoreChips({ scores, meta }: { scores: Record<string, number> | null; meta: Meta }) {
  if (!scores || !Object.keys(scores).length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {meta.scales.filter((s) => scores[s.key] != null).map((s) => (
        <span key={s.key} className="chip border border-slate-200 bg-white text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: SCALE_COLORS[s.key] }} />
          {s.label} <b className={`ml-0.5 rounded px-1 ${scoreColor(scores[s.key])}`}>{scores[s.key]}</b>
        </span>
      ))}
    </div>
  );
}

function BankItem({ item, meta, onView, onDelete, reload }: { item: Item; meta: Meta; onView: (v: any) => void; onDelete: () => void; reload: () => void }) {
  const { user } = useApp();
  const d = item.data;
  const iconBox = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl';
  const actions = (extra?: React.ReactNode) => (
    <div className="flex shrink-0 items-start gap-0.5 text-slate-400">
      {extra}
      <button onClick={onDelete} className="rounded-lg p-1.5 hover:bg-rose-50 hover:text-rose-600" title="Удалить"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  if (item.kind === 'material') {
    const style = CATEGORY_STYLE[d.category] || CATEGORY_STYLE['Другое'];
    const isImg = d.mime.startsWith('image/') && d.mime !== 'image/svg+xml';
    const hasText = d.kind === 'message' || d.extract_status === 'ok';
    const name = d.original_name.replace(/\.txt$/, '');
    const view = async () => onView(await api.get(`/api/files/${d.id}/text`));
    const reanalyze = async () => { await api.post(`/api/files/${d.id}/reanalyze`); reload(); };
    return (
      <Card className="p-4">
        <div className="flex gap-3">
          {isImg ? (
            <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              <img src={`/api/files/${d.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ) : <div className={`${iconBox} ${style.cls}`}>{style.emoji}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{name}</span>
              <Badge className={style.cls}>{d.category || 'Материал'}</Badge>
            </div>
            <div className="text-xs text-slate-400">
              {fmtDate(d.material_date)}{d.kind !== 'message' ? ` · ${fmtSize(d.size)}` : ''}{d.description ? ` · ${d.description}` : ''}{d.uploader ? ` · ${d.uploader}` : ''}
            </div>
            {d.ai_status === 'pending' && <div className="mt-2 flex items-center gap-1.5 text-sm text-violet-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />ИИ разбирает…</div>}
            {d.ai_status === 'done' && (
              <div className="mt-2 rounded-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/50 p-3">
                <p className="text-sm text-slate-700"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet-500" />{d.ai_summary}</p>
                {d.ai_tags?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{d.ai_tags.map((t: string) => <span key={t} className="chip bg-white/80 text-slate-500">#{t}</span>)}</div>}
                <ScoreChips scores={d.ai_scores} meta={meta} />
              </div>
            )}
            {d.ai_status === 'error' && <div className="mt-2 text-sm text-rose-600">ИИ не смог разобрать материал. <button className="underline" onClick={reanalyze}>Повторить</button></div>}
            {d.ai_status === 'skipped' && <div className="mt-2 text-xs text-slate-400">Текст не найден — материал сохранён, но ИИ его не учитывает.</div>}
          </div>
          {actions(<>
            {hasText && <button onClick={view} className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-700" title="Показать текст"><Eye className="h-4 w-4" /></button>}
            <a href={`/api/files/${d.id}?download=1`} className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-700" title="Скачать"><Download className="h-4 w-4" /></a>
            {d.ai_status !== 'pending' && <button onClick={reanalyze} className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-700" title="Разобрать заново"><RefreshCw className="h-4 w-4" /></button>}
          </>)}
        </div>
      </Card>
    );
  }

  if (item.kind === 'assessment') {
    return (
      <Card className="p-4">
        <div className="flex gap-3">
          <div className={`${iconBox} bg-emerald-50`}>📊</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-800">Общая оценка</div>
            <div className="text-xs text-slate-400">{fmtDate(d.date)}{d.teacher ? ` · ${d.teacher}` : ''}</div>
            <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {meta.scales.filter((s) => d.scores[s.key] != null).map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate text-slate-600">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${d.scores[s.key] * 10}%`, background: SCALE_COLORS[s.key] }} />
                  </div>
                  <b className="w-5 text-right text-slate-700">{d.scores[s.key]}</b>
                </div>
              ))}
            </div>
            {d.comment && <p className="mt-2 text-sm text-slate-600">{d.comment}</p>}
          </div>
          {actions()}
        </div>
      </Card>
    );
  }

  if (item.kind === 'note') {
    return (
      <Card className="p-4">
        <div className="flex gap-3">
          <div className={`${iconBox} bg-amber-50 text-amber-600`}><StickyNote className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="font-semibold text-slate-800">Заметка</span><Badge className="bg-slate-100 text-slate-600">{d.category}</Badge></div>
            <div className="text-xs text-slate-400">{fmtDate(d.created_at)}{d.teacher ? ` · ${d.teacher}` : ''}</div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{d.text}</p>
          </div>
          {(d.teacher_id === user!.id || user!.role === 'admin') && actions()}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className={`${iconBox} bg-yellow-50 text-yellow-600`}><Award className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800">{d.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge className="bg-indigo-50 text-indigo-700">{d.category}</Badge>
            <Badge className="bg-slate-100 text-slate-600">{d.level}</Badge>
            {d.result && <Badge className="bg-emerald-50 text-emerald-700">{d.result}</Badge>}
          </div>
          <div className="mt-1 text-xs text-slate-400">{fmtDate(d.date)}</div>
          {d.description && <p className="mt-1.5 text-sm text-slate-600">{d.description}</p>}
        </div>
        {actions()}
      </div>
    </Card>
  );
}
