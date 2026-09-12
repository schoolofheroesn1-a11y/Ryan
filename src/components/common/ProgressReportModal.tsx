import React from 'react';
import { X, Printer, GraduationCap, Award, Calendar, CheckCircle2 } from 'lucide-react';
import { Student } from '../../types';

interface ProgressReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
}

export const ProgressReportModal: React.FC<ProgressReportModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Action Header - hidden when printing */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Official Academic Progress Report
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-slate-900 print:p-6" id="printable-report">
          {/* Institution Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-950 tracking-tight uppercase">
                Crestview Preparatory Academy
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Office of Academic Affairs & Student Records • Fall Term 2026
              </p>
              <p className="text-[11px] text-slate-500">
                100 Academy Parkway, Education District • accreditation: NEASC Tier 1
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-100 text-slate-900 font-bold text-xs border border-slate-300">
                OFFICIAL REPORT CARD
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Issued: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Student Name
              </span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{student.name}</p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Student ID / Grade
              </span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {student.studentIdNumber} • {student.gradeLevel}
              </p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Cumulative GPA
              </span>
              <p className="font-extrabold text-indigo-700 text-sm mt-0.5">
                {student.overallGpa.toFixed(2)} / 4.00
              </p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Attendance Rate
              </span>
              <p className="font-bold text-emerald-700 text-sm mt-0.5">
                {student.attendanceRate}%
              </p>
            </div>
          </div>

          {/* Academic Performance Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              Academic Course Performance & Mastery
            </h4>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Course Title</th>
                  <th className="py-2.5 px-3">Instructor</th>
                  <th className="py-2.5 px-3 text-center">Score</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {student.subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 font-semibold">
                      {sub.code}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {sub.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{sub.teacherName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {sub.currentScore.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-900 border border-slate-200">
                        {sub.letterGrade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-[11px] text-slate-600">
                      {sub.currentScore >= 70 ? 'In Good Standing' : 'Academic Focus'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attendance History Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Attendance & Punctuality
              </h5>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Days Recorded:</span>
                  <span className="font-semibold text-slate-900">
                    {student.attendanceHistory.length} Days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Overall Attendance Ratio:</span>
                  <span className="font-bold text-emerald-700">{student.attendanceRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Excused Absences / Tardy:</span>
                  <span className="font-semibold text-slate-800">
                    {student.attendanceHistory.filter((a) => a.status === 'Excused' || a.status === 'Late').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Active Academic Goals
              </h5>
              <div className="space-y-1.5 text-xs">
                {student.goals.map((g) => (
                  <div key={g.id} className="flex items-center space-x-1.5">
                    <span className="text-slate-400">•</span>
                    <span className={`text-slate-700 ${g.completed ? 'line-through text-slate-400' : ''}`}>
                      {g.title}
                    </span>
                    {g.completed && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                        Achieved
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Instructor Observations */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              Faculty Observations & Recommendations
            </h5>
            <div className="space-y-2 text-xs text-slate-700">
              {student.teacherNotes.map((note, idx) => (
                <p key={idx} className="italic bg-white p-2 rounded border border-slate-100">
                  "{note}"
                </p>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <p className="font-semibold text-slate-800">Academic Counselor Signature</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <p className="font-semibold text-slate-800">Parent / Guardian Acknowledgment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
