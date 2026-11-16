import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, Flag, Layers, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, ErrorText, Modal, Spinner, Tabs, confirmDelete } from '../components/ui';
import { RISK, fmtDate, fmtPct, pctText } from '../lib/format';
import { useMeta } from '../lib/meta';
import { AchievementModal, AiTab, EditStudentModal } from './student/parts';
import { AddToBankModal, AssessmentForm } from './student/AddToBank';
import { BankTab } from './student/Bank';
import { OverviewTab } from './student/Overview';
import { PerformanceTab } from './student/Performance';
import { GoalModal, GoalsTab } from './student/Goals';

type Tab = 'overview' | 'performance' | 'goals' | 'bank' | 'ai';
type ModalKind = null | 'add' | 'assess' | 'achievement' | 'edit' | 'goal';

export function StudentPage() {
  const { id } = useParams();
  const meta = useMeta();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<ModalKind>(null);
  const navigate = useNavigate();

  const load = useCallback(() => api.get(`/api/students/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    setData(null);
    setTab('overview');
    load();
  }, [id, load]);

  if (error) return <ErrorText error={error} />;
  if (!data || !meta) return <Spinner />;
  const { student, stats } = data;
  const bankCount = data.files.length + data.assessments.length + data.notes.length + data.achievements.length;
  const activeGoals = data.goals.filter((g: any) => g.status === 'active');
  const reached = data.goals.filter((g: any) => g.status === 'done' || g.health === 'achieved').length;

  const remove = async () => {
    if (!confirmDelete(`ученика «${student.full_name}» со всем портфолио`)) return;
    await api.del(`/api/students/${student.id}`);
    window.dispatchEvent(new Event('classes:changed'));
    navigate(student.class_id ? `/classes/${student.class_id}` : '/');
  };
  const done = () => {
    setModal(null);
    load();
  };

  return (
    <div className="page-in space-y-6">
      {student.class_id && (
        <Link to={`/classes/${student.class_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Класс {student.class_name}
        </Link>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[20px] border border-border/80 bg-white p-5 shadow-soft sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-100/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-amber-100/60 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-serif text-2xl font-semibold text-white shadow-soft">
              {student.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
            </div>
            <div>
              <div className="eyebrow">Ученик · {student.class_name || 'без класса'}</div>
              <h1 className="text-3xl leading-tight text-ink">{student.full_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                {student.birth_date && <span>{fmtDate(student.birth_date)}</span>}
                <Badge className={RISK[stats.risk].cls}>{RISK[stats.risk].label}</Badge>
                {student.interests && <span>· {student.interests}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal('add')}>Добавить в банк</Button>
            <Button variant="secondary" icon={<Flag className="h-4 w-4 text-amber-600" />} onClick={() => setModal('goal')}>Цель</Button>
            <Button variant="secondary" icon={<Sparkles className="h-4 w-4 text-brand-600" />} onClick={() => setTab('ai')}>Советы ИИ</Button>
            <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setModal('edit')} title="Изменить данные" />
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove} title="Удалить ученика" />
          </div>
        </div>
        {student.about && <p className="relative mt-3 max-w-3xl text-sm text-slate-600">{student.about}</p>}

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Успеваемость', value: fmtPct(stats.percent), cls: pctText(stats.percent), hint: stats.average != null ? `ср. отметка ${stats.average}` : 'оценок нет' },
            { label: 'Посещаемость', value: fmtPct(stats.attendance.rate), cls: 'text-ink', hint: `${stats.attendance.total} дней в журнале` },
            { label: 'Цели', value: `${activeGoals.length}`, cls: 'text-ink', hint: reached ? `достигнуто: ${reached}` : 'активных целей' },
            { label: 'Банк ученика', value: `${bankCount}`, cls: 'text-ink', hint: `достижений: ${stats.achievementsCount}` },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-border/70 bg-slate-50/70 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted">{k.label}</div>
              <div className={`font-mono text-2xl font-semibold ${k.cls}`}>{k.value}</div>
              <div className="text-xs text-muted">{k.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Обзор', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'performance', label: 'Успеваемость', icon: <BookOpen className="h-4 w-4" /> },
          { id: 'goals', label: 'Цели', count: activeGoals.length, icon: <Flag className="h-4 w-4" /> },
          { id: 'bank', label: 'Банк ученика', count: bankCount, icon: <Layers className="h-4 w-4" /> },
          { id: 'ai', label: 'Советы ИИ', count: data.reports.length, icon: <Sparkles className="h-4 w-4" /> },
        ]}
      />

      {tab === 'overview' && (
        <OverviewTab data={data} meta={meta} onAssess={() => setModal('assess')} onAddBank={() => setModal('add')}
          onOpenAi={() => setTab('ai')} onOpenGoals={() => setTab('goals')} onOpenPerformance={() => setTab('performance')} />
      )}
      {tab === 'performance' && <PerformanceTab data={data} reload={load} />}
      {tab === 'goals' && <GoalsTab data={data} meta={meta} reload={load} />}
      {tab === 'bank' && <BankTab data={data} meta={meta} reload={load} onAdd={() => setModal('add')} />}
      {tab === 'ai' && <AiTab data={data} reload={load} />}

      {modal === 'add' && (
        <AddToBankModal studentId={student.id} meta={meta} onClose={() => setModal(null)}
          onDone={() => { done(); setTab('bank'); }} onPickAchievement={() => setModal('achievement')} />
      )}
      {modal === 'assess' && (
        <Modal open onClose={() => setModal(null)} title="Общая оценка" wide>
          <AssessmentForm studentId={student.id} meta={meta} onDone={done} />
        </Modal>
      )}
      {modal === 'goal' && <GoalModal data={data} meta={meta} onClose={() => setModal(null)} onDone={() => { done(); setTab('goals'); }} />}
      {modal === 'achievement' && <AchievementModal studentId={student.id} onClose={() => setModal(null)} onDone={() => { done(); setTab('bank'); }} />}
      {modal === 'edit' && <EditStudentModal student={student} onClose={() => setModal(null)} onDone={() => { done(); window.dispatchEvent(new Event('classes:changed')); }} />}
    </div>
  );
}
