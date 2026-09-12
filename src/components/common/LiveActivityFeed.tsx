import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Sparkles, X, Info } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';

export const LiveActivityFeed: React.FC = () => {
  const { liveToast, dismissToast } = useAcademic();

  useEffect(() => {
    if (liveToast) {
      const timer = setTimeout(() => {
        dismissToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [liveToast, dismissToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <AnimatePresence>
        {liveToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="pointer-events-auto max-w-sm w-full bg-slate-900 text-white rounded-xl shadow-xl p-4 border border-slate-800 flex items-start space-x-3"
          >
            <div className="shrink-0 mt-0.5">
              {liveToast.type === 'grade' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              {liveToast.type === 'milestone' && (
                <Sparkles className="w-5 h-5 text-amber-400" />
              )}
              {liveToast.type === 'attendance' && (
                <Info className="w-5 h-5 text-sky-400" />
              )}
              {liveToast.type === 'info' && (
                <Info className="w-5 h-5 text-indigo-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  {liveToast.title}
                </h4>
                <button
                  onClick={dismissToast}
                  className="text-slate-400 hover:text-white p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {liveToast.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
