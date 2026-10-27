import React, { useState } from 'react';
import { AcademicProvider, useAcademic } from './context/AcademicContext';
import { Navbar } from './components/Navbar';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { LiveActivityFeed } from './components/common/LiveActivityFeed';
import { ProgressReportModal } from './components/common/ProgressReportModal';
import { UploadCenter, UploadTab } from './components/common/UploadCenter';
import { PortfolioSection } from './components/common/PortfolioSection';
import { StudentDashboard } from './components/student/StudentDashboard';
import { Student } from './types';

const DashboardContent: React.FC = () => {
  const { role, students, selectedStudent, setSelectedStudentId } = useAcademic();
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [uploadTab, setUploadTab] = useState<UploadTab | null>(null);

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col font-sans">
      <Navbar
        onOpenReportModal={() => setReportStudent(selectedStudent)}
        onOpenUpload={() => setUploadTab(role === 'teacher' ? 'gradebook' : 'document')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {role === 'teacher' && (
          <>
            <TeacherDashboard onOpenReport={(student) => setReportStudent(student)} />
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-900">Student Portfolios</h2>
                <select
                  value={selectedStudent.id}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="text-xs font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
              <PortfolioSection student={selectedStudent} onUpload={setUploadTab} />
            </div>
          </>
        )}
        {role === 'parent' && (
          <>
            <ParentDashboard onOpenReport={(student) => setReportStudent(student)} />
            <PortfolioSection student={selectedStudent} onUpload={setUploadTab} />
          </>
        )}
        {role === 'student' && <StudentDashboard onUpload={setUploadTab} />}
      </main>

      {uploadTab && (
        <UploadCenter
          key={`${role}-${uploadTab}-${selectedStudent.id}`}
          isOpen
          initialTab={uploadTab}
          onClose={() => setUploadTab(null)}
        />
      )}

      {/* Floating Live Toast Notifications */}
      <LiveActivityFeed />

      {/* Printable Progress Report Modal */}
      {reportStudent && (
        <ProgressReportModal
          isOpen={Boolean(reportStudent)}
          onClose={() => setReportStudent(null)}
          student={reportStudent}
        />
      )}

      {/* Professional Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
              A
            </div>
            <span className="font-bold text-slate-800">AcademiTrack Intelligence</span>
            <span>• Crestview Preparatory Academy</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Real-Time Engine Active</span>
            </span>
            <span>FERPA Compliant</span>
            <span>Academic Term 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AcademicProvider>
      <DashboardContent />
    </AcademicProvider>
  );
}
