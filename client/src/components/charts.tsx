import React, { useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SCALE_COLORS, monthLabel, type Scale } from '../lib/meta';

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -12px rgba(15,23,42,.2)', fontSize: 12 };

/** Spider chart of the 1–10 scales. */
export function ScaleRadar({ data, height = 300 }: {
  data: { label: string; current?: number | null; teacher?: number | null; ai?: number | null }[];
  height?: number;
}) {
  const SHORT: Record<string, string> = {
    'Эмоциональное благополучие': 'Благополучие', 'Самостоятельность': 'Самостоят.', 'Ответственность': 'Ответств.', 'Любознательность': 'Любознат.',
  };
  const rows = data.map((d) => ({ ...d, label: SHORT[d.label] || d.label }));
  const hasTeacher = rows.some((d) => d.teacher != null);
  const hasAi = rows.some((d) => d.ai != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={rows} outerRadius="66%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
        <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} />
        <Radar name="Итог" dataKey="current" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
        {hasTeacher && <Radar name="Учитель" dataKey="teacher" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeDasharray="4 3" />}
        {hasAi && <Radar name="ИИ по материалам" dataKey="ai" stroke="#ec4899" fill="#ec4899" fillOpacity={0.05} strokeDasharray="2 3" />}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (v == null ? '—' : v)} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Month-by-month dynamics of the scales; click chips to show/hide lines. */
export function ScaleTrendChart({ monthly, scales, height = 280 }: { monthly: any[]; scales: Scale[]; height?: number }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const data = monthly.map((m) => ({ ...m, label: monthLabel(String(m.month)) }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {scales.map((s) => (
          <button
            key={s.key}
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className={`chip border transition ${hidden[s.key] ? 'border-slate-200 bg-white text-slate-400' : 'border-transparent text-white'}`}
            style={hidden[s.key] ? undefined : { background: SCALE_COLORS[s.key] }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: -20, right: 10, top: 5 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          {scales.filter((s) => !hidden[s.key]).map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SCALE_COLORS[s.key]} strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 0, fill: SCALE_COLORS[s.key] }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Average grade (line, 2–5) and attendance % (bars) per month. */
export function PerformanceChart({ data, height = 260 }: { data: { month: string; grade: number | null; attendance: number | null }[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ left: -20, right: -10, top: 5 }}>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="g" domain={[2, 5]} ticks={[2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="a" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="a" dataKey="attendance" name="Посещаемость, %" fill="#e0e7ff" radius={[6, 6, 0, 0]} barSize={22} />
        <Line yAxisId="g" type="monotone" dataKey="grade" name="Средний балл" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-400">{children}</div>;
}
