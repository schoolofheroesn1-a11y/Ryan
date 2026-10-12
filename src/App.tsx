import React, { useState } from 'react';
import { AcademicProvider, useAcademic } from './context/AcademicContext';
import { Navbar } from './components/Navbar';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import {
  CambridgeSkillTable,
  A2_KEY_READING,
  A2_KEY_LISTENING,
} from './components/teacher/CambridgeSkillTable';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { LiveActivityFeed } from './components/common/LiveActivityFeed';
import { ProgressReportModal } from './components/common/ProgressReportModal';
import { Student } from './types';
import { ShieldCheck, Activity, GraduationCap } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { role, selectedStudent } = useAcademic();
  const [reportStudent, setReportStudent] = useState<Student | null>(null);

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col font-sans">
      <Navbar onOpenReportModal={() => setReportStudent(selectedStudent)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {role === 'teacher' ? (
          <>
            <TeacherDashboard onOpenReport={(student) => setReportStudent(student)} />
            <div className="mt-6 space-y-6">
              <CambridgeSkillTable skill={A2_KEY_READING} studentName={selectedStudent?.name} />
              <CambridgeSkillTable skill={A2_KEY_LISTENING} studentName={selectedStudent?.name} />
            </div>
          </>
        ) : (
          <ParentDashboard onOpenReport={(student) => setReportStudent(student)} />
        )}
      </main>

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
