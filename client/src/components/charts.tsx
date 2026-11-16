import React, { useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SCALE_COLORS, monthLabel, type Scale } from '../lib/meta';

const tooltipStyle = { borderRadius: 12, border: '1px solid #e4dacb', background: '#fffdf9', boxShadow: '0 8px 24px -12px rgba(60,40,20,.25)', fontSize: 12 };

export const SERIES_COLORS = ['#3f7a5f', '#b98128', '#a4412e', '#4b6fa5', '#7a5c99', '#6b8d47', '#c0667a', '#2f8a8a', '#8f5e12', '#55748a'];

/** Several percent lines (e.g. one per subject) by month, with toggle chips. */
export function SeriesChart({ rows, series, height = 280, domain = [0, 100], unit = '%' }: {
  rows: Record<string, any>[]; // { month, [seriesKey]: value }
  series: { key: string; label: string; color: string }[];
  height?: number;
  domain?: [number, number];
  unit?: string;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const data = rows.map((r) => ({ ...r, label: monthLabel(String(r.month)) }));
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {series.map((s) => (
            <button key={s.key} onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
              className={`chip border transition ${hidden[s.key] ? 'border-slate-200 bg-white text-slate-400' : 'border-transparent text-white'}`}
              style={hidden[s.key] ? undefined : { background: s.color }}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: -16, right: 10, top: 5 }}>
          <CartesianGrid stroke="#efe8de" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#877b6d' }} axisLine={false} tickLine={false} />
          <YAxis domain={domain} tick={{ fontSize: 11, fill: '#a99a88' }} axisLine={false} tickLine={false} unit={unit} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (v == null ? '—' : `${v}${unit}`)} />
          {series.filter((s) => !hidden[s.key]).map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal percent bars, e.g. class average per subject. */
export function PercentBars({ items }: { items: { label: string; value: number | null; hint?: string; trend?: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{it.label}</span>
            <span className="flex items-baseline gap-2">
              {it.trend === 'up' && <span className="text-xs text-emerald-600">▲</span>}
              {it.trend === 'down' && <span className="text-xs text-rose-600">▼</span>}
              {it.hint && <span className="text-xs text-slate-400">{it.hint}</span>}
              <b className="font-mono text-slate-800">{it.value == null ? '—' : `${Math.round(it.value)}%`}</b>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{
              width: `${it.value ?? 0}%`,
              background: it.value == null ? '#cdbfab' : it.value >= 85 ? '#6b8d47' : it.value >= 65 ? '#4f8a6d' : it.value >= 45 ? '#d39e45' : '#bc5b42',
            }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Spider chart of the 1–10 scales. */
export function ScaleRadar({ data, height = 300 }: {
  data: { label: string; current?: number | null; teacher?: number | null; ai?: number | null; self?: number | null }[];
  height?: number;
}) {
  const SHORT: Record<string, string> = {
    'Эмоциональное благополучие': 'Благополучие', 'Самостоятельность': 'Самостоят.', 'Ответственность': 'Ответств.', 'Любознательность': 'Любознат.',
  };
  const rows = data.map((d) => ({ ...d, label: SHORT[d.label] || d.label }));
  const hasTeacher = rows.some((d) => d.teacher != null);
  const hasAi = rows.some((d) => d.ai != null);
  const hasSelf = rows.some((d) => d.self != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={rows} outerRadius="66%">
        <PolarGrid stroke="#e4dacb" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#554b40' }} />
        <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 9, fill: '#a99a88' }} axisLine={false} />
        <Radar name="Итог" dataKey="current" stroke="#3f7a5f" fill="#3f7a5f" fillOpacity={0.25} strokeWidth={2} />
        {hasTeacher && <Radar name="Учитель" dataKey="teacher" stroke="#b98128" fill="#b98128" fillOpacity={0.05} strokeDasharray="4 3" />}
        {hasAi && <Radar name="ИИ по материалам" dataKey="ai" stroke="#a4412e" fill="#a4412e" fillOpacity={0.05} strokeDasharray="2 3" />}
        {hasSelf && <Radar name="Самооценка" dataKey="self" stroke="#7a5c99" fill="#7a5c99" fillOpacity={0.05} strokeWidth={2} />}
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
          <CartesianGrid stroke="#efe8de" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#877b6d' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#a99a88' }} axisLine={false} tickLine={false} />
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

/** Average result in percent per month. */
export function PerformanceChart({ data, height = 260 }: { data: { month: string; percent: number | null }[]; height?: number }) {
  const rows = data.filter((d) => d.percent != null).map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ left: -16, right: 10, top: 5 }}>
        <CartesianGrid stroke="#efe8de" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#877b6d' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#a99a88' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (v == null ? '—' : `${v}%`)} />
        <Line type="monotone" dataKey="percent" name="Успеваемость" stroke="#3f7a5f" strokeWidth={2.5} dot={{ r: 4, fill: '#3f7a5f' }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Subjects as a radar: only subjects that actually have grades become axes
 * (subjects not taught at the school don't appear). Falls back to bars for fewer than 3 subjects.
 */
export function SubjectRadar({ items, height = 320, compare }: {
  items: { label: string; value: number | null; compare?: number | null }[];
  height?: number;
  compare?: string; // legend name of the second series, e.g. "Класс"
}) {
  const rows = items.filter((i) => i.value != null);
  if (rows.length < 3) return <PercentBars items={rows} />;
  const short = (l: string) => (l.length > 14 ? l.replace('язык', 'яз.').replace('Обществознание', 'Общество') : l);
  const data = rows.map((r) => ({ ...r, label: short(r.label) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="68%">
        <PolarGrid stroke="#e4dacb" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#554b40' }} />
        <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={{ fontSize: 9, fill: '#a99a88' }} axisLine={false} />
        <Radar name="Успеваемость, %" dataKey="value" stroke="#3f7a5f" fill="#3f7a5f" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: '#3f7a5f' }} />
        {compare && <Radar name={compare} dataKey="compare" stroke="#b98128" fill="#b98128" fillOpacity={0.05} strokeDasharray="4 3" />}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (v == null ? '—' : `${v}%`)} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-48 items-center justify-center rounded-xl bg-slate-50 px-6 py-6 text-center text-sm text-muted">{children}</div>;
}
