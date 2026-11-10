/** Class-level analytics and AI recommendations for the class teacher. */
import { all, get } from './db';
import { aiModelName, aiProvider, callModel, extractJson } from './ai';
import { callClaude } from './ai-claude';
import { computeScaleStats, computeStudentStats } from './stats';
import { nameRedactor } from './privacy';
import { SCALES } from './scales';

const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function classAnalytics(classId: number) {
  const students = all<any>('SELECT id, full_name FROM students WHERE class_id = ? ORDER BY full_name', classId);
  const rows = students.map((s) => {
    const st = computeStudentStats(s.id);
    const sc = computeScaleStats(s.id);
    const scales: Record<string, number | null> = {};
    const trends: Record<string, string> = {};
    for (const x of sc.scales) {
      scales[x.key] = x.current;
      trends[x.key] = x.trend;
    }
    const known = sc.scales.filter((x) => x.current != null).map((x) => x.current!);
    const up = sc.scales.filter((x) => x.trend === 'up').length + st.subjects.filter((x) => x.trend === 'up').length;
    const down = sc.scales.filter((x) => x.trend === 'down').length + st.subjects.filter((x) => x.trend === 'down').length;
    return {
      id: s.id,
      full_name: s.full_name,
      average: st.average,
      attendanceRate: st.attendance.rate,
      achievements: st.achievementsCount,
      materials: st.filesCount,
      risk: st.risk,
      riskReasons: st.riskReasons,
      scales,
      trends,
      scaleAverage: mean(known),
      momentum: up - down, // >0 growing, <0 declining
    };
  });

  const radar = SCALES.map((s) => ({
    key: s.key,
    label: s.label,
    value: mean(rows.map((r) => r.scales[s.key]).filter((v): v is number => v != null)),
  }));

  // Month-by-month: class average grade, attendance and scale levels.
  const ids = students.map((s) => s.id);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const gradeMonths = all<any>(
    `SELECT substr(date, 1, 7) AS month, ROUND(AVG(value), 2) AS grade FROM grades WHERE student_id IN (${ph}) GROUP BY month ORDER BY month`,
    ...ids,
  );
  const attMonths = all<any>(
    `SELECT substr(date, 1, 7) AS month, ROUND(100.0 * SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS attendance
     FROM attendance WHERE student_id IN (${ph}) GROUP BY month ORDER BY month`,
    ...ids,
  );
  // Each student's monthly scale values, carried forward into months without new data,
  // so the class average isn't skewed by who happened to have materials that month.
  const perStudent = students.map((s) => computeScaleStats(s.id).monthly);
  const scaleMonthKeys = [...new Set(perStudent.flatMap((m) => m.map((r) => String(r.month))))].sort();
  const scaleMonths = new Map<string, Record<string, number[]>>();
  for (const series of perStudent) {
    const last: Record<string, number> = {};
    for (const month of scaleMonthKeys) {
      const row = series.find((r) => r.month === month);
      for (const sc of SCALES) if (row && typeof row[sc.key] === 'number') last[sc.key] = row[sc.key] as number;
      const acc = scaleMonths.get(month) || {};
      for (const sc of SCALES) if (last[sc.key] != null) (acc[sc.key] ||= []).push(last[sc.key]);
      scaleMonths.set(month, acc);
    }
  }
  const months = [...new Set([...gradeMonths.map((g) => g.month), ...attMonths.map((a) => a.month), ...scaleMonths.keys()])].sort();
  const monthly = months.map((month) => {
    const row: Record<string, any> = {
      month,
      grade: gradeMonths.find((g) => g.month === month)?.grade ?? null,
      attendance: attMonths.find((a) => a.month === month)?.attendance ?? null,
    };
    const acc = scaleMonths.get(month) || {};
    const all = SCALES.flatMap((s) => acc[s.key] || []);
    row.scales = mean(all);
    for (const s of SCALES) row[s.key] = mean(acc[s.key] || []);
    return row;
  });

  return { students: rows, radar, monthly };
}

export interface ClassReport {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: { title: string; details: string }[];
  attention: { student: string; reason: string; action: string }[];
  groups: { title: string; students: string[]; idea: string }[];
}

export async function analyzeClass(classId: number, focus: string): Promise<{ report: ClassReport; source: string }> {
  const cls = get<any>('SELECT * FROM classes WHERE id = ?', classId);
  const a = classAnalytics(classId);
  // Students are sent as codes (У1, У2…) and names are put back into the answer afterwards.
  const codes = new Map<string, string>();
  a.students.forEach((s, i) => codes.set(`У${i + 1}`, s.full_name));

  const data = a.students.map((s, i) => {
    const redact = nameRedactor(s.full_name);
    const latest = all<any>(
      `SELECT category, ai_summary FROM files WHERE student_id = ? AND ai_summary IS NOT NULL
       ORDER BY COALESCE(material_date, created_at) DESC LIMIT 3`,
      s.id,
    ).map((f) => `${f.category || 'материал'}: ${redact(f.ai_summary)}`);
    return {
      код: `У${i + 1}`,
      средний_балл: s.average,
      посещаемость: s.attendanceRate,
      достижений: s.achievements,
      риски: s.riskReasons,
      шкалы_1_10: Object.fromEntries(SCALES.map((sc) => [sc.label, s.scales[sc.key]])),
      тренды_шкал: Object.fromEntries(SCALES.map((sc) => [sc.label, s.trends[sc.key]])),
      последние_материалы: latest,
    };
  });

  if (aiProvider() === 'rules') return { report: ruleReport(a, codes), source: 'rules' };

  const system = `Ты — опытный школьный психолог и методист. Ты помогаешь классному руководителю увидеть картину
по всему классу и спланировать работу. Опирайся только на данные, не выдумывай. Учеников называй только кодами (У1, У2…).
Пиши по-русски, конкретно и практично. Отвечай только валидным JSON.`;
  const user = `Класс: ${cls?.name || ''}. Учеников: ${a.students.length}.
Средние по шкалам (1–10): ${JSON.stringify(Object.fromEntries(a.radar.map((r) => [r.label, r.value])))}
Динамика класса по месяцам: ${JSON.stringify(a.monthly)}
Ученики:
${JSON.stringify(data, null, 1)}
${focus ? `\nКлассный руководитель просит обратить внимание на: ${focus}\n` : ''}
Верни JSON:
{
  "summary": "3–5 предложений: общая картина класса и главные тенденции",
  "strengths": ["сильные стороны класса"],
  "concerns": ["что вызывает беспокойство"],
  "recommendations": [{"title": "название", "details": "что делать классному руководителю, как часто, как проверить"}],
  "attention": [{"student": "У3", "reason": "почему нужен фокус", "action": "что сделать"}],
  "groups": [{"title": "группа для совместной работы", "students": ["У1", "У4"], "idea": "чем их занять вместе"}]
}
Дай 3–5 рекомендаций, до 6 учеников в attention, 1–3 группы.`;

  const raw = aiProvider() === 'claude' ? await callClaude(system, user) : await callModel(system, user);
  const r = extractJson(raw);
  const name = (code: string) => codes.get(String(code).trim()) || String(code);
  const withNames = (t: string) => String(t || '').replace(/У(\d+)/g, (m) => codes.get(m) || m);
  const arr = (x: any) => (Array.isArray(x) ? x : []);
  return {
    source: aiModelName()!,
    report: {
      summary: withNames(r.summary),
      strengths: arr(r.strengths).map(withNames),
      concerns: arr(r.concerns).map(withNames),
      recommendations: arr(r.recommendations).map((x: any) => ({ title: withNames(x?.title), details: withNames(x?.details) })),
      attention: arr(r.attention).map((x: any) => ({ student: name(x?.student), reason: withNames(x?.reason), action: withNames(x?.action) })),
      groups: arr(r.groups).map((g: any) => ({ title: withNames(g?.title), students: arr(g?.students).map(name), idea: withNames(g?.idea) })),
    },
  };
}

function ruleReport(a: ReturnType<typeof classAnalytics>, _codes: Map<string, string>): ClassReport {
  const risky = a.students.filter((s) => s.risk === 'high');
  const weakScales = a.radar.filter((r) => r.value != null && r.value < 6);
  const strong = a.radar.filter((r) => r.value != null && r.value >= 7.5);
  return {
    summary: `В классе ${a.students.length} учеников. Нужна поддержка: ${risky.length}. ` +
      (weakScales.length ? `Ниже среднего по шкалам: ${weakScales.map((w) => w.label).join(', ')}.` : 'Заметных проседаний по шкалам нет.'),
    strengths: strong.map((s) => `${s.label}: ${s.value}`),
    concerns: weakScales.map((s) => `${s.label}: ${s.value}`),
    recommendations: [{ title: 'Индивидуальные беседы', details: 'Провести короткие беседы с учениками из списка «Нужна поддержка» в течение двух недель.' }],
    attention: risky.slice(0, 6).map((s) => ({ student: s.full_name, reason: s.riskReasons.join('; '), action: 'Индивидуальная беседа и план поддержки' })),
    groups: [],
  };
}
