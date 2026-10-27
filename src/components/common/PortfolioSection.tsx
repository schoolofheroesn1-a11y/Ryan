import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  GraduationCap,
  Table2,
  FolderOpen,
  Upload,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAcademic } from '../../context/AcademicContext';
import { Assignment, Student, ProgressTable, Role } from '../../types';
import { downloadTextFile } from '../../lib/tableImport';
import { UploadTab } from './UploadCenter';

type PortfolioTab = 'tasks' | 'exams' | 'tables' | 'documents';
type TaskFilter = 'all' | 'todo' | 'overdue' | 'done';

interface PortfolioItem extends Assignment {
  subjectId: string;
  subjectName: string;
}

const today = () => new Date().toISOString().split('T')[0];

const ROLE_LABEL: Record<Role, string> = { teacher: 'Teacher', parent: 'Parent', student: 'Student' };

function isOverdue(a: Assignment): boolean {
  return a.status === 'Missing' || (a.status === 'Pending' && a.dueDate < today());
}

function statusBadge(a: Assignment) {
  const overdue = isOverdue(a);
  const label = overdue && a.status === 'Pending' ? 'Overdue' : a.status;
  const cls =
    a.status === 'Graded'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : overdue || a.status === 'Missing'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : a.status === 'Late'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-sky-50 text-sky-700 border-sky-200';
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function pct(a: Assignment): number | null {
  if (a.status !== 'Graded' || a.maxScore <= 0) return null;
  return Math.round((a.score / a.maxScore) * 1000) / 10;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function tableToCsv(t: ProgressTable): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [t.columns, ...t.rows].map((r) => r.map(esc).join(',')).join('\n');
}

export const PortfolioSection: React.FC<{
  student: Student;
  onUpload: (tab: UploadTab) => void;
}> = ({ student, onUpload }) => {
  const { role, removeProgressTable, removePortfolioFile } = useAcademic();
  const [tab, setTab] = useState<PortfolioTab>('tasks');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const items: PortfolioItem[] = useMemo(
    () =>
      student.subjects.flatMap((sub) =>
        sub.assignments.map((a) => ({ ...a, subjectId: sub.id, subjectName: sub.name }))
      ),
    [student]
  );

  const tasks = items
    .filter((a) => a.category !== 'Exam' && a.category !== 'Quiz')
    .filter((a) =>
      taskFilter === 'all'
        ? true
        : taskFilter === 'todo'
          ? a.status === 'Pending'
          : taskFilter === 'overdue'
            ? isOverdue(a)
            : a.status === 'Graded' || a.status === 'Late'
    )
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  const exams = items
    .filter((a) => a.category === 'Exam' || a.category === 'Quiz')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const examChartData = exams
    .map((e) => ({ date: e.dueDate, label: `${e.title} (${e.subjectName})`, Score: pct(e) }))
    .filter((d) => d.Score !== null);

  const tables = student.progressTables || [];
  const files = student.portfolioFiles || [];
  const subjectName = (id?: string) => student.subjects.find((s) => s.id === id)?.name;

  const tabs: { id: PortfolioTab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'tasks', label: 'Tasks', count: items.filter((a) => a.category !== 'Exam' && a.category !== 'Quiz').length, icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'exams', label: 'Exams & Quizzes', count: exams.length, icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'tables', label: 'Progress Tables', count: tables.length, icon: <Table2 className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', count: files.length, icon: <FolderOpen className="w-4 h-4" /> },
  ];

  const renderAssignmentTable = (rows: PortfolioItem[], emptyText: string) =>
    rows.length === 0 ? (
      <div className="py-10 text-center text-xs text-slate-400">{emptyText}</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2">Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => {
              const p = pct(a);
              return (
                <tr key={`${a.subjectId}-${a.id}`} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{a.title}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.subjectName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.category}</td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.dueDate}</td>
                  <td className="px-3 py-2.5">{statusBadge(a)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {p === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <>
                        <span className="font-bold text-slate-900">{p}%</span>
                        <span className="text-slate-400 ml-1">
                          ({a.score}/{a.maxScore})
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-xs">{a.feedback || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const canDelete = (uploadedBy: Role) => role === 'teacher' || uploadedBy === role;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img src={student.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
          <div>
            <h2 className="font-bold text-slate-900">{student.name}'s Portfolio</h2>
            <p className="text-xs text-slate-500">
              {student.gradeLevel} • {student.studentIdNumber} • shared with teachers, the student and parents
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            onUpload(role !== 'teacher' ? 'document' : tab === 'tables' ? 'table' : tab === 'documents' ? 'document' : 'gradebook')
          }
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
        >
          <Upload className="w-3.5 h-3.5" />
          {role === 'teacher' ? 'Upload to portfolio' : 'Upload a document'}
        </button>
      </div>

      <div className="flex gap-1 px-5 pt-3 overflow-x-auto border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
            <span className="ml-0.5 px-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['todo', 'To do'],
                  ['overdue', 'Overdue / missing'],
                  ['done', 'Completed'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTaskFilter(id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    taskFilter === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {renderAssignmentTable(tasks, 'No tasks here yet. Teachers can upload them from a CSV or Excel sheet.')}
          </div>
        )}

        {tab === 'exams' && (
          <div className="space-y-4">
            {examChartData.length >= 2 && (
              <div>
                <h3 className="text-xs font-bold text-slate-700 mb-2">Exam & quiz results over time (%)</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={examChartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                        formatter={(v) => [`${v}%`, 'Score']}
                      />
                      <Line
                        type="monotone"
                        dataKey="Score"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {renderAssignmentTable([...exams].reverse(), 'No exams or quizzes recorded yet.')}
          </div>
        )}

        {tab === 'tables' && (
          <div className="space-y-5">
            {tables.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-400">
                No progress tables yet. Teachers can upload reading logs, behaviour charts or any other table.
              </div>
            )}
            {tables.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t.title}</h3>
                    <p className="text-[11px] text-slate-500">
                      {t.description ? `${t.description} • ` : ''}Uploaded by {ROLE_LABEL[t.uploadedBy]} on{' '}
                      {new Date(t.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => downloadTextFile(`${t.title}.csv`, tableToCsv(t))}
                      title="Download as CSV"
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {canDelete(t.uploadedBy) && (
                      <button
                        onClick={() => confirm(`Remove "${t.title}"?`) && removeProgressTable(student.id, t.id)}
                        title="Remove table"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 sticky top-0">
                      <tr>
                        {t.columns.map((c, i) => (
                          <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap border-b border-slate-100">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {t.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          {r.map((c, j) => (
                            <td key={j} className="px-3 py-2 text-slate-700">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'documents' && (
          <>
            {files.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No documents yet. Upload exam papers, finished tasks, certificates or reports.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((f) => {
                  const isImage = f.mimeType.startsWith('image/');
                  const Icon = isImage ? ImageIcon : /sheet|excel|csv/.test(f.mimeType) ? FileSpreadsheet : FileText;
                  return (
                    <div key={f.id} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                      {isImage ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="block h-32 bg-slate-100">
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-32 bg-slate-50 flex items-center justify-center text-indigo-400"
                        >
                          <Icon className="w-10 h-10" />
                        </a>
                      )}
                      <div className="p-3 flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            {f.category}
                          </span>
                          {subjectName(f.subjectId) && (
                            <span className="text-[10px] text-slate-500 truncate">{subjectName(f.subjectId)}</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 break-all">{f.name}</p>
                        {f.description && <p className="text-[11px] text-slate-500">{f.description}</p>}
                        <p className="text-[10px] text-slate-400 mt-auto">
                          {ROLE_LABEL[f.uploadedBy]} • {new Date(f.uploadedAt).toLocaleDateString()} • {formatSize(f.size)}
                        </p>
                        <div className="flex items-center gap-1 pt-1">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                          <a
                            href={f.url}
                            download={f.name}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Download className="w-3 h-3" /> Download
                          </a>
                          {canDelete(f.uploadedBy) && (
                            <button
                              onClick={() => confirm(`Delete "${f.name}"?`) && removePortfolioFile(student.id, f.id)}
                              className="ml-auto p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
