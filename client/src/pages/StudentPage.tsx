import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, Layers, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, ErrorText, Modal, Spinner, Tabs, confirmDelete } from '../components/ui';
import { RISK, fmtDate, gradeColor } from '../lib/format';
import { useMeta } from '../lib/meta';
import { AchievementModal, AiTab, AttendanceTab, EditStudentModal, GradesTab } from './student/parts';
import { AddToBankModal, AssessmentForm } from './student/AddToBank';
import { BankTab } from './student/Bank';
import { OverviewTab } from './student/Overview';

type Tab = 'overview' | 'bank' | 'performance' | 'ai';
type ModalKind = null | 'add' | 'assess' | 'achievement' | 'edit';

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
    <div className="space-y-6">
      {student.class_id && (
        <Link to={`/classes/${student.class_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Класс {student.class_name}
        </Link>
      )}

      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,.12)]">
        <div className="h-20 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-lg">
                {student.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-bold tracking-tight">{student.full_name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>{student.class_name || 'Без класса'}</span>
                  {student.birth_date && <span>· {fmtDate(student.birth_date)}</span>}
                  <Badge className={RISK[stats.risk].cls}>{RISK[stats.risk].label}</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal('add')}>Добавить в банк</Button>
              <Button variant="secondary" icon={<Sparkles className="h-4 w-4 text-violet-500" />} onClick={() => setTab('ai')}>Советы ИИ</Button>
              <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setModal('edit')} title="Изменить данные" />
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove} title="Удалить ученика" />
            </div>
          </div>
          {(student.interests || student.about) && (
            <p className="mt-3 text-sm text-slate-600">
              {student.interests && <><span className="text-slate-400">Интересы:</span> {student.interests}. </>}
              {student.about}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Средний балл', value: stats.average ?? '—', cls: gradeColor(stats.average) },
              { label: 'Посещаемость', value: stats.attendance.rate != null ? `${stats.attendance.rate}%` : '—', cls: '' },
              { label: 'Материалов в банке', value: bankCount, cls: '' },
              { label: 'Достижений', value: stats.achievementsCount, cls: '' },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-medium text-slate-500">{k.label}</div>
                <div className={`text-xl font-bold tracking-tight ${k.cls}`}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Обзор', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'bank', label: 'Банк ученика', count: bankCount, icon: <Layers className="h-4 w-4" /> },
          { id: 'performance', label: 'Оценки и посещаемость', icon: <BookOpen className="h-4 w-4" /> },
          { id: 'ai', label: 'Советы ИИ', count: data.reports.length, icon: <Sparkles className="h-4 w-4" /> },
        ]}
      />

      {tab === 'overview' && <OverviewTab data={data} meta={meta} onAssess={() => setModal('assess')} onAddBank={() => setModal('add')} onOpenAi={() => setTab('ai')} />}
      {tab === 'bank' && <BankTab data={data} meta={meta} reload={load} onAdd={() => setModal('add')} />}
      {tab === 'performance' && <div className="space-y-6"><GradesTab data={data} reload={load} /><AttendanceTab data={data} reload={load} /></div>}
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
      {modal === 'achievement' && <AchievementModal studentId={student.id} onClose={() => setModal(null)} onDone={() => { done(); setTab('bank'); }} />}
      {modal === 'edit' && <EditStudentModal student={student} onClose={() => setModal(null)} onDone={() => { done(); window.dispatchEvent(new Event('classes:changed')); }} />}
    </div>
  );
}
