import React, { useEffect, useState } from 'react';
import { Plus, User } from 'lucide-react';
import {
  CambridgeSkillTable,
  A2_KEY_READING,
  A2_KEY_LISTENING,
  SkillResults,
  emptyResults,
} from './CambridgeSkillTable';

interface CambridgeStudent {
  id: string;
  name: string;
  reading: SkillResults;
  listening: SkillResults;
}

const INITIAL_CAMBRIDGE_STUDENTS: CambridgeStudent[] = [
  {
    id: 'cambridge-artem',
    name: 'Artem',
    reading: {
      goal: 120,
      tests: [
        [null, null, null, null, null],
        [null, null, null, null, null],
        [2, 3, 1, 4, 1],
        [2, 2, 2, 3, 2],
        [1, 5, 0, 5, 0],
      ],
    },
    listening: {
      goal: 120,
      tests: [
        [null, null, null, null, null],
        [null, null, null, null, null],
        [4, 0, 1, 1, 5],
        [4, 0, 2, 2, 4],
        [4, 0, 0, 4, 5],
      ],
    },
  },
];

const LOCAL_STORAGE_KEY_CAMBRIDGE = 'academic_tracker_cambridge_v1';

function loadStudents(): CambridgeStudent[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_CAMBRIDGE);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    console.error('Failed reading Cambridge scores from localStorage', e);
  }
  return INITIAL_CAMBRIDGE_STUDENTS;
}

export const CambridgeSection: React.FC = () => {
  const [students, setStudents] = useState<CambridgeStudent[]>(loadStudents);
  const [selectedId, setSelectedId] = useState<string>(() => students[0].id);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CAMBRIDGE, JSON.stringify(students));
    } catch (e) {
      console.error('Failed saving Cambridge scores to localStorage', e);
    }
  }, [students]);

  const selected = students.find((s) => s.id === selectedId) ?? students[0];

  const updateSelected = (patch: Partial<CambridgeStudent>) =>
    setStudents((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));

  const addStudent = () => {
    const name = window.prompt('Student name')?.trim();
    if (!name) return;
    const student: CambridgeStudent = {
      id: `cambridge-${Date.now()}`,
      name,
      reading: emptyResults(A2_KEY_READING),
      listening: emptyResults(A2_KEY_LISTENING),
    };
    setStudents((prev) => [...prev, student]);
    setSelectedId(student.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-lg text-slate-900">Cambridge A2 Key Results</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <User className="w-4 h-4 text-indigo-600" />
            Student
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={addStudent}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <Plus className="w-4 h-4" />
            Add student
          </button>
        </div>
      </div>

      <CambridgeSkillTable
        skill={A2_KEY_READING}
        studentName={selected.name}
        results={selected.reading}
        onChange={(reading) => updateSelected({ reading })}
      />
      <CambridgeSkillTable
        skill={A2_KEY_LISTENING}
        studentName={selected.name}
        results={selected.listening}
        onChange={(listening) => updateSelected({ listening })}
      />
    </div>
  );
};
