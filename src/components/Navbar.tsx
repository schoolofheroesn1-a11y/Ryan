import React, { useState } from 'react';
import {
  GraduationCap,
  Users,
  Bell,
  Sparkles,
  Printer,
  RotateCcw,
  ChevronDown,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAcademic } from '../context/AcademicContext';
import { Role } from '../types';

interface NavbarProps {
  onOpenReportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenReportModal }) => {
  const {
    role,
    setRole,
    students,
    selectedStudentId,
    setSelectedStudentId,
    selectedStudent,
    alerts,
    unreadAlertCount,
    markAlertRead,
    clearAllAlerts,
    simulateLiveUpdate,
    resetToDefaults,
  } = useAcademic();

  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  // For parent role, filter to children in the family (Leo and Maya)
  const familyStudents = students.filter(
    (s) => s.parentName === 'Eleanor Vance' || s.id === 'student-1' || s.id === 'student-2'
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">AcademiTrack</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Real-Time Student Academic Progress & Analytics
              </p>
            </div>
          </div>

          {/* Central Role Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="role-teacher-btn"
              onClick={() => setRole('teacher')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                role === 'teacher'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Teacher Portal</span>
            </button>
            <button
              id="role-parent-btn"
              onClick={() => setRole('parent')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                role === 'parent'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Parent Portal</span>
            </button>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* If Parent role, Child selector */}
            {role === 'parent' && (
              <div className="hidden md:flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Child:</span>
                <select
                  id="parent-child-select"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="text-xs sm:text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
                >
                  {familyStudents.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({child.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Simulate Live Score Entry */}
            <button
              id="simulate-grade-btn"
              onClick={simulateLiveUpdate}
              title="Simulate a live gradebook submission and see real-time recalculations"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden lg:inline">Simulate Live Update</span>
            </button>

            {/* Print / Report button */}
            <button
              id="print-report-btn"
              onClick={onOpenReportModal}
              title="Generate printable progress report"
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Progress Report</span>
            </button>

            {/* Real-Time Alerts Bell */}
            <div className="relative">
              <button
                id="alerts-bell-btn"
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className="relative p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unreadAlertCount}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown Menu */}
              {showAlertsDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                        Real-Time Updates ({alerts.length})
                      </span>
                    </div>
                    {alerts.length > 0 && (
                      <button
                        onClick={clearAllAlerts}
                        className="text-[11px] text-slate-400 hover:text-slate-700"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No alerts right now. New activity will stream here live!
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          onClick={() => markAlertRead(alert.id)}
                          className={`py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors ${
                            !alert.read ? 'bg-indigo-50/40 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">
                              {alert.title}
                            </span>
                            <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                            {alert.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reset Defaults button */}
            <button
              id="reset-data-btn"
              onClick={resetToDefaults}
              title="Reset mock data to initial defaults"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
