import React, { useMemo, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Table2,
  FileText,
  UserPlus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { useAcademic, GradebookImportSummary } from '../../context/AcademicContext';
import { PortfolioFileCategory } from '../../types';
import {
  parseTableFile,
  mapGradebookTable,
  ParsedTable,
  GradebookParseResult,
  GRADEBOOK_TEMPLATE_CSV,
  PROGRESS_TABLE_TEMPLATE_CSV,
  downloadTextFile,
  fileToBase64,
} from '../../lib/tableImport';

export type UploadTab = 'gradebook' | 'table' | 'document' | 'student';

const FILE_CATEGORIES: PortfolioFileCategory[] = ['Task', 'Exam', 'Project', 'Certificate', 'Report', 'Other'];
const DOCUMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.odt,.ods,.odp';

interface UploadCenterProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UploadTab;
}

export const UploadCenter: React.FC<UploadCenterProps> = ({ isOpen, onClose, initialTab }) => {
  const {
    role,
    visibleStudents,
    selectedStudent,
    importGradebook,
    addProgressTable,
    addPortfolioFile,
    addStudent,
  } = useAcademic();

  const tabs = useMemo(() => {
    const all: { id: UploadTab; label: string; icon: React.ReactNode }[] = [
      { id: 'gradebook', label: 'Tasks & Exams', icon: <FileSpreadsheet className="w-4 h-4" /> },
      { id: 'table', label: 'Progress Table', icon: <Table2 className="w-4 h-4" /> },
      { id: 'document', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
      { id: 'student', label: 'Add Student', icon: <UserPlus className="w-4 h-4" /> },
    ];
    // Grades and progress tables are owned by teachers; students and parents can add documents
    return role === 'teacher' ? all : all.filter((t) => t.id === 'document');
  }, [role]);

  const [tab, setTab] = useState<UploadTab>(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id
  );
  const [targetStudentId, setTargetStudentId] = useState(selectedStudent.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Gradebook import state
  const [gradebookFileName, setGradebookFileName] = useState('');
  const [gradebook, setGradebook] = useState<GradebookParseResult | null>(null);
  const [importSummary, setImportSummary] = useState<GradebookImportSummary | null>(null);

  // Progress table state
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [tableFileName, setTableFileName] = useState('');
  const [tableTitle, setTableTitle] = useState('');
  const [tableDescription, setTableDescription] = useState('');

  // Document state
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docCategory, setDocCategory] = useState<PortfolioFileCategory>(role === 'student' ? 'Task' : 'Report');
  const [docSubjectId, setDocSubjectId] = useState('');
  const [docDescription, setDocDescription] = useState('');

  // New student state
  const [newStudent, setNewStudent] = useState({
    name: '',
    gradeLevel: '',
    studentIdNumber: '',
    parentName: '',
    parentEmail: '',
  });

  if (!isOpen) return null;

  const targetStudent = visibleStudents.find((s) => s.id === targetStudentId) || selectedStudent;

  const switchTab = (t: UploadTab) => {
    setTab(t);
    setError(null);
  };

  const handleGradebookFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setImportSummary(null);
    try {
      const parsed = await parseTableFile(file);
      setGradebook(mapGradebookTable(parsed));
      setGradebookFileName(file.name);
    } catch (e: any) {
      setGradebook(null);
      setError(e.message || 'Could not read that file.');
    }
  };

  const handleImportGradebook = () => {
    if (!gradebook || gradebook.rows.length === 0) return;
    setImportSummary(importGradebook(gradebook.rows, targetStudent.id));
    setGradebook(null);
    setGradebookFileName('');
  };

  const handleTableFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseTableFile(file);
      setTable(parsed);
      setTableFileName(file.name);
      if (!tableTitle) setTableTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    } catch (e: any) {
      setTable(null);
      setError(e.message || 'Could not read that file.');
    }
  };

  const handleSaveTable = () => {
    if (!table || !tableTitle.trim()) return;
    addProgressTable(targetStudent.id, {
      title: tableTitle.trim(),
      description: tableDescription.trim() || undefined,
      columns: table.columns,
      rows: table.rows,
      sourceFileName: tableFileName,
      uploadedBy: role,
    });
    setTable(null);
    setTableFileName('');
    setTableTitle('');
    setTableDescription('');
    onClose();
  };

  const handleUploadDocuments = async () => {
    if (docFiles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of docFiles) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" is larger than 10 MB.`);
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, dataBase64: await fileToBase64(file) }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Upload of "${file.name}" failed.`);
        addPortfolioFile(targetStudent.id, {
          name: file.name,
          url: body.url,
          mimeType: file.type || 'application/octet-stream',
          size: body.size ?? file.size,
          category: docCategory,
          subjectId: docSubjectId || undefined,
          description: docDescription.trim() || undefined,
          uploadedBy: role,
        });
      }
      setDocFiles([]);
      setDocDescription('');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Upload failed. Is the server running?');
    } finally {
      setBusy(false);
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim()) return;
    const id = addStudent(newStudent);
    setTargetStudentId(id);
    setNewStudent({ name: '', gradeLevel: '', studentIdNumber: '', parentName: '', parentEmail: '' });
    switchTab('gradebook');
  };

  const studentPicker = (
    <div>
      <label className="block font-semibold text-slate-700 mb-1">Student portfolio:</label>
      <select
        value={targetStudent.id}
        onChange={(e) => setTargetStudentId(e.target.value)}
        disabled={visibleStudents.length <= 1}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-50"
      >
        {visibleStudents.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.gradeLevel})
          </option>
        ))}
      </select>
    </div>
  );

  const dropZone = (accept: string, onFile: (f: File | undefined) => void, hint: string, fileName?: string) => (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl px-4 py-6 cursor-pointer transition-colors text-center">
      <Upload className="w-6 h-6 text-indigo-500" />
      <span className="font-semibold text-slate-800">{fileName || 'Click to choose a file'}</span>
      <span className="text-[11px] text-slate-500">{hint}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Upload Centre</h3>
            <p className="text-xs text-slate-500">
              Everything uploaded here appears in the student's portfolio for teachers, the student and parents.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {tabs.length > 1 && (
          <div className="flex gap-1 px-6 pt-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'gradebook' && (
            <>
              <p className="text-slate-600 leading-relaxed">
                Upload a <strong>CSV or Excel (.xlsx)</strong> sheet of tasks, homework, quizzes and exams. Required
                columns: <strong>Subject</strong> and <strong>Title</strong>. Optional: Student, Type (Homework / Quiz /
                Exam / Project / Lab), Score, Max Score, Weight, Due Date, Status, Feedback. Rows with the same title
                as an existing task are updated, so you can re-upload a sheet as marks come in.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadTextFile('tasks-and-exams-template.csv', GRADEBOOK_TEMPLATE_CSV)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" /> Download template
                </button>
              </div>

              {studentPicker}
              <p className="text-[11px] text-slate-500 -mt-2">
                If your sheet has a <strong>Student</strong> column, each row goes to that student (new names create a
                new portfolio). Otherwise all rows go to the student selected above.
              </p>

              {dropZone('.csv,.xlsx,.tsv,.txt', handleGradebookFile, 'CSV or .xlsx, first row = column headings', gradebookFileName)}

              {importSummary && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Imported: {importSummary.added} new, {importSummary.updated} updated.
                    </p>
                    {importSummary.newStudents.length > 0 && (
                      <p>New student portfolios: {importSummary.newStudents.join(', ')}</p>
                    )}
                    {importSummary.newSubjects.length > 0 && <p>New subjects: {importSummary.newSubjects.join(', ')}</p>}
                  </div>
                </div>
              )}

              {gradebook && (
                <div className="space-y-3">
                  {gradebook.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 space-y-0.5">
                      {gradebook.errors.map((e, i) => (
                        <p key={i}>• {e}</p>
                      ))}
                    </div>
                  )}
                  {gradebook.rows.length > 0 && (
                    <>
                      <p className="font-semibold text-slate-800">
                        Preview — {gradebook.rows.length} row(s) ready
                        {!gradebook.hasStudentColumn && <> for {targetStudent.name}</>}
                      </p>
                      <div className="max-h-64 overflow-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                            <tr>
                              {gradebook.hasStudentColumn && <th className="px-2 py-1.5">Student</th>}
                              <th className="px-2 py-1.5">Subject</th>
                              <th className="px-2 py-1.5">Title</th>
                              <th className="px-2 py-1.5">Type</th>
                              <th className="px-2 py-1.5">Score</th>
                              <th className="px-2 py-1.5">Due</th>
                              <th className="px-2 py-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {gradebook.rows.map((r) => (
                              <tr key={r.rowNumber}>
                                {gradebook.hasStudentColumn && <td className="px-2 py-1.5">{r.studentName}</td>}
                                <td className="px-2 py-1.5">{r.subjectName}</td>
                                <td className="px-2 py-1.5 font-medium text-slate-800">{r.title}</td>
                                <td className="px-2 py-1.5">{r.category}</td>
                                <td className="px-2 py-1.5">
                                  {r.score === null ? '—' : r.score}/{r.maxScore}
                                </td>
                                <td className="px-2 py-1.5">{r.dueDate}</td>
                                <td className="px-2 py-1.5">{r.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={handleImportGradebook}
                        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        Import {gradebook.rows.length} task(s) & exam(s)
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'table' && (
            <>
              <p className="text-slate-600 leading-relaxed">
                Upload any table that tracks progress — reading logs, behaviour charts, skills checklists, exam
                breakdowns. It's shown exactly as uploaded in the student's portfolio.
              </p>
              <button
                onClick={() => downloadTextFile('progress-table-example.csv', PROGRESS_TABLE_TEMPLATE_CSV)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                <Download className="w-3.5 h-3.5" /> Download example
              </button>
              {studentPicker}
              {dropZone('.csv,.xlsx,.tsv,.txt', handleTableFile, 'CSV or .xlsx, first row = column headings', tableFileName)}

              {table && (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Table title:</label>
                      <input
                        value={tableTitle}
                        onChange={(e) => setTableTitle(e.target.value)}
                        placeholder="e.g. Term 1 Reading Log"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Description (optional):</label>
                      <input
                        value={tableDescription}
                        onChange={(e) => setTableDescription(e.target.value)}
                        placeholder="What this table shows"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <p className="font-semibold text-slate-800">
                    Preview — {table.rows.length} row(s), {table.columns.length} column(s)
                  </p>
                  <div className="max-h-64 overflow-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0">
                        <tr>
                          {table.columns.map((c, i) => (
                            <th key={i} className="px-2 py-1.5 font-semibold whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {table.rows.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            {r.map((c, j) => (
                              <td key={j} className="px-2 py-1.5">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={handleSaveTable}
                    disabled={!tableTitle.trim()}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold"
                  >
                    Add table to {targetStudent.name}'s portfolio
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'document' && (
            <>
              <p className="text-slate-600 leading-relaxed">
                {role === 'student'
                  ? 'Add your work to your portfolio: completed tasks, projects, certificates and more.'
                  : role === 'parent'
                    ? "Share documents with your child's teachers, such as notes, certificates or reports."
                    : 'Attach exam papers, marked tasks, report cards or certificates to a student portfolio.'}{' '}
                PDF, images, Word, Excel and PowerPoint files up to 10 MB.
              </p>
              {studentPicker}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type:</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as PortfolioFileCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {FILE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject (optional):</label>
                  <select
                    value={docSubjectId}
                    onChange={(e) => setDocSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">General</option>
                    {targetStudent.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note (optional):</label>
                <input
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="e.g. Marked mid-term paper with corrections"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl px-4 py-6 cursor-pointer transition-colors text-center">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="font-semibold text-slate-800">
                  {docFiles.length ? docFiles.map((f) => f.name).join(', ') : 'Click to choose one or more files'}
                </span>
                <span className="text-[11px] text-slate-500">Max 10 MB per file</span>
                <input
                  type="file"
                  multiple
                  accept={DOCUMENT_ACCEPT}
                  className="hidden"
                  onChange={(e) => setDocFiles(Array.from(e.target.files || []))}
                />
              </label>
              <button
                onClick={handleUploadDocuments}
                disabled={docFiles.length === 0 || busy}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload {docFiles.length || ''} file(s)
              </button>
            </>
          )}

          {tab === 'student' && (
            <form onSubmit={handleAddStudent} className="space-y-3">
              <p className="text-slate-600">Create an empty portfolio, then upload their tasks and exams.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {(
                  [
                    ['name', 'Student name *', 'e.g. Amelia Brooks'],
                    ['gradeLevel', 'Grade / class', 'e.g. Grade 7'],
                    ['studentIdNumber', 'Student ID', 'auto-generated if empty'],
                    ['parentName', 'Parent / guardian name', 'e.g. Sam Brooks'],
                    ['parentEmail', 'Parent email', 'parent@example.com'],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key}>
                    <label className="block font-semibold text-slate-700 mb-1">{label}:</label>
                    <input
                      required={key === 'name'}
                      type={key === 'parentEmail' ? 'email' : 'text'}
                      value={newStudent[key]}
                      onChange={(e) => setNewStudent((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Children with the same parent / guardian name are grouped together in the Parent Portal.
              </p>
              <button type="submit" className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                Create portfolio
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
