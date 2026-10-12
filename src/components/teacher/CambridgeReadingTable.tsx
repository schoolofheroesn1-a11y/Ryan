import React, { useMemo, useState } from 'react';
import { BookOpen, Target, RotateCcw } from 'lucide-react';

// Cambridge English A2 Key (KET) Reading — 5 parts, 30 marks in total.
export const READING_PARTS = [
  { label: 'Part 1', max: 6, task: 'Multiple-choice: short texts' },
  { label: 'Part 2', max: 7, task: 'Multiple matching' },
  { label: 'Part 3', max: 5, task: 'Multiple-choice: longer text' },
  { label: 'Part 4', max: 6, task: 'Multiple-choice cloze' },
  { label: 'Part 5', max: 6, task: 'Open cloze' },
] as const;

export const READING_MAX = READING_PARTS.reduce((sum, p) => sum + p.max, 0); // 30

// Raw score -> Cambridge English Scale anchors for A2 Key Reading.
// Values between anchors are interpolated linearly.
const SCALE_ANCHORS: [number, number][] = [
  [7, 82],
  [13, 100],
  [20, 120],
  [27, 140],
  [30, 150],
];

export function toScaleScore(raw: number): number | null {
  if (raw < SCALE_ANCHORS[0][0]) return null; // below the reportable range (<82)
  for (let i = 1; i < SCALE_ANCHORS.length; i++) {
    const [r0, s0] = SCALE_ANCHORS[i - 1];
    const [r1, s1] = SCALE_ANCHORS[i];
    if (raw <= r1) return Math.round(s0 + ((raw - r0) * (s1 - s0)) / (r1 - r0));
  }
  return 150;
}

interface Band {
  min: number;
  cefr: string;
  grade: string;
  className: string;
}

// A2 Key result bands on the Cambridge English Scale.
export const BANDS: Band[] = [
  { min: 140, cefr: 'B1', grade: 'Grade A', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { min: 133, cefr: 'A2', grade: 'Grade B', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  { min: 120, cefr: 'A2', grade: 'Grade C', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  { min: 100, cefr: 'A1', grade: 'Level A1', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { min: 0, cefr: 'Below A1', grade: 'Fail', className: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export function bandFor(scale: number | null): Band {
  return BANDS.find((b) => (scale ?? 0) >= b.min) ?? BANDS[BANDS.length - 1];
}

type Scores = (number | null)[];

interface CambridgeReadingTableProps {
  studentName?: string;
  /** Target Cambridge Scale score for the term (120 = A2 pass). */
  initialGoal?: number;
  initialTests?: Scores[];
}

const emptyTest = (): Scores => READING_PARTS.map(() => null);

const DEFAULT_TESTS: Scores[] = [
  emptyTest(),
  emptyTest(),
  [2, 3, 1, 4, 1],
  [2, 2, 2, 3, 2],
  [1, 5, 0, 5, 0],
];

export const CambridgeReadingTable: React.FC<CambridgeReadingTableProps> = ({
  studentName = 'Student',
  initialGoal = 120,
  initialTests = DEFAULT_TESTS,
}) => {
  const [tests, setTests] = useState<Scores[]>(initialTests);
  const [goal, setGoal] = useState<number>(initialGoal);

  const setScore = (testIdx: number, partIdx: number, value: string) => {
    const max = READING_PARTS[partIdx].max;
    const parsed = value === '' ? null : Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    setTests((prev) =>
      prev.map((t, i) => (i === testIdx ? t.map((s, j) => (j === partIdx ? parsed : s)) : t))
    );
  };

  const rows = useMemo(
    () =>
      tests.map((scores) => {
        const taken = scores.some((s) => s !== null);
        const raw: number = scores.reduce((sum: number, s) => sum + (s ?? 0), 0);
        const scale = taken ? toScaleScore(raw) : null;
        return { scores, taken, raw, scale, band: bandFor(scale) };
      }),
    [tests]
  );

  const taken = rows.filter((r) => r.taken);
  const best = taken.reduce<number | null>((b, r) => Math.max(b ?? 0, r.scale ?? 0), null);
  const partAverages = READING_PARTS.map((p, j) => {
    if (!taken.length) return null;
    const avg = taken.reduce((sum, r) => sum + (r.scores[j] ?? 0), 0) / taken.length;
    return Math.round((avg / p.max) * 100);
  });

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Cambridge A2 Key — Reading</h2>
            <p className="text-xs text-slate-500">
              {studentName} · 5 parts · {READING_MAX} marks · CEFR A1–B1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <Target className="w-4 h-4 text-indigo-600" />
            Goal for term
            <select
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-900 focus:outline-none"
            >
              {BANDS.slice(0, 4).map((b) => (
                <option key={b.min} value={b.min}>
                  {b.min} · {b.cefr} {b.grade}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setTests(initialTests)}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900"
            title="Reset scores"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500 bg-white">
              <th className="px-3 py-3 text-left font-semibold">Test</th>
              {READING_PARTS.map((p) => (
                <th key={p.label} className="px-2 py-3 font-semibold" title={p.task}>
                  <div className="text-slate-700">{p.label}</div>
                  <div className="font-normal normal-case text-slate-400">max {p.max}</div>
                </th>
              ))}
              <th className="px-3 py-3 font-semibold bg-slate-50">
                <div className="text-slate-700">Score</div>
                <div className="font-normal normal-case text-slate-400">max {READING_MAX}</div>
              </th>
              <th className="px-3 py-3 font-semibold bg-slate-50">
                <div className="text-slate-700">Cambridge</div>
                <div className="font-normal normal-case text-slate-400">scale</div>
              </th>
              <th className="px-3 py-3 font-semibold bg-slate-50 text-slate-700">CEFR</th>
              <th className="px-3 py-3 font-semibold bg-slate-50 text-slate-700">Result</th>
              <th className="px-3 py-3 font-semibold bg-slate-50 text-slate-700">vs Goal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const gap = row.scale !== null ? row.scale - goal : null;
              return (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">
                    Test {i + 1}
                  </td>
                  {READING_PARTS.map((p, j) => (
                    <td key={p.label} className="px-1 py-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={p.max}
                        value={row.scores[j] ?? ''}
                        placeholder="–"
                        onChange={(e) => setScore(i, j, e.target.value)}
                        aria-label={`Test ${i + 1} ${p.label}`}
                        className="w-12 text-center rounded-md border border-slate-200 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                  ))}
                  {row.taken ? (
                    <>
                      <td className="px-3 py-2 font-bold text-slate-900 bg-slate-50/70">{row.raw}</td>
                      <td className="px-3 py-2 font-bold text-indigo-700 bg-slate-50/70">
                        {row.scale ?? '<82'}
                      </td>
                      <td className="px-3 py-2 bg-slate-50/70 whitespace-nowrap">{row.band.cefr}</td>
                      <td className="px-3 py-2 bg-slate-50/70">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${row.band.className}`}
                        >
                          {row.band.grade}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 bg-slate-50/70 font-semibold ${
                          gap !== null && gap >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {gap === null ? '–' : gap >= 0 ? `+${gap}` : `${gap}`}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-3 py-2 text-xs text-slate-400 bg-slate-50/70">
                      Not taken yet
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs">
              <td className="px-3 py-2 text-left font-semibold text-slate-600">Avg %</td>
              {partAverages.map((pct, j) => (
                <td
                  key={j}
                  className={`px-1 py-2 font-semibold ${
                    pct === null ? 'text-slate-400' : pct >= 60 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {pct === null ? '–' : `${pct}%`}
                </td>
              ))}
              <td colSpan={5} className="px-3 py-2 text-slate-600">
                Best scale score: <span className="font-bold text-slate-900">{best ?? '–'}</span>
                {best !== null && (
                  <>
                    {' '}· {bandFor(best).cefr} {bandFor(best).grade}
                  </>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Scale legend */}
      <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap gap-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700 mr-1">Cambridge Scale:</span>
        {BANDS.map((b, i) => (
          <span key={b.min} className={`px-2 py-0.5 rounded-full border ${b.className}`}>
            {i === 0 ? '140–150' : `${b.min || 82}–${BANDS[i - 1].min - 1}`} · {b.cefr} · {b.grade}
          </span>
        ))}
      </div>
    </section>
  );
};
