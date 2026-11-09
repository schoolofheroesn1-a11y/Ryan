import { all, get } from './db';
import { computeStudentStats, type StudentStats } from './stats';
import { callClaude, claudeModel } from './ai-claude';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export interface AiReport {
  summary: string;
  strengths: string[];
  growthAreas: string[];
  recommendations: { title: string; details: string; audience: 'учитель' | 'ученик' | 'родители' }[];
  activities: string[];
  goals: { goal: string; metric: string; term: string }[];
  risks: string[];
  parentMessage: string;
}

export type AiProvider = 'claude' | 'openai' | 'rules';

/** Claude if ANTHROPIC_API_KEY is set, otherwise any OpenAI-compatible API, otherwise rule-based. */
export function aiProvider(): AiProvider {
  const forced = process.env.AI_PROVIDER;
  if (forced === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude';
  if (forced === 'openai' && process.env.AI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.AI_API_KEY) return 'openai';
  return 'rules';
}

export function aiConfig() {
  return {
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4.1-mini',
  };
}

export function aiEnabled() {
  return aiProvider() !== 'rules';
}

export function aiModelName() {
  const p = aiProvider();
  return p === 'claude' ? claudeModel() : p === 'openai' ? aiConfig().model : null;
}

/** Collects an anonymised snapshot of the student: no full name, no birth date. */
function buildContext(studentId: number) {
  const student = get<any>(
    `SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ?`,
    studentId,
  );
  if (!student) throw new Error('Ученик не найден');
  const stats = computeStudentStats(studentId);

  let age: number | null = null;
  if (student.birth_date) {
    const b = new Date(student.birth_date);
    if (!isNaN(b.getTime())) age = Math.floor((Date.now() - b.getTime()) / (365.25 * 864e5));
  }

  const recentGrades = all<any>(
    `SELECT g.date, s.name AS subject, g.value, g.kind, g.comment FROM grades g JOIN subjects s ON s.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.date DESC LIMIT 60`,
    studentId,
  );
  const achievements = all<any>(
    'SELECT title, category, level, result, date, description FROM achievements WHERE student_id = ? ORDER BY date DESC LIMIT 40',
    studentId,
  );
  const notes = all<any>(
    'SELECT category, text, created_at FROM notes WHERE student_id = ? ORDER BY created_at DESC LIMIT 40',
    studentId,
  );
  const files = all<any>(
    'SELECT original_name, description FROM files WHERE student_id = ? ORDER BY created_at DESC LIMIT 30',
    studentId,
  );
  const absences = all<any>(
    `SELECT date, status, comment FROM attendance WHERE student_id = ? AND status != 'present' ORDER BY date DESC LIMIT 30`,
    studentId,
  );

  return { student, stats, age, recentGrades, achievements, notes, files, absences };
}

function buildPrompt(ctx: ReturnType<typeof buildContext>, focus: string) {
  const { student, stats, age } = ctx;
  const data = {
    класс: student.class_name || 'не указан',
    возраст: age,
    интересы: student.interests || 'не указаны',
    о_ученике: student.about || '',
    средний_балл: stats.average,
    предметы: stats.subjects.map((s) => ({
      предмет: s.subject,
      средний: s.average,
      оценок: s.count,
      за_последние_30_дней: s.recentAverage,
      ранее: s.previousAverage,
      тренд: s.trend,
      двоек: s.lowCount,
    })),
    последние_оценки: ctx.recentGrades,
    посещаемость: stats.attendance,
    пропуски_и_опоздания: ctx.absences,
    достижения: ctx.achievements,
    заметки_учителей: ctx.notes,
    файлы_портфолио: ctx.files,
  };

  const system = `Ты — опытный школьный педагог-психолог и тьютор по индивидуальному развитию.
Ты анализируешь портфолио ученика российской школы (оценки по 5-балльной шкале) и даёшь конкретные,
доброжелательные и практичные советы по росту и развитию. Опирайся только на переданные данные,
не выдумывай факты. Если данных мало — прямо скажи об этом и посоветуй, что стоит собрать.
Учитывай возраст. Пиши на русском языке, без канцелярита. Отвечай строго валидным JSON.`;

  const user = `Данные ученика (обезличены):
${JSON.stringify(data, null, 2)}

${focus ? `Учитель просит обратить особое внимание на: ${focus}\n` : ''}
Верни JSON строго такой структуры:
{
  "summary": "3–4 предложения: общая картина, динамика, главное",
  "strengths": ["сильная сторона с опорой на данные", "..."],
  "growthAreas": ["зона роста с опорой на данные", "..."],
  "recommendations": [
    {"title": "короткое название", "details": "что конкретно делать, как часто, как проверить результат", "audience": "учитель | ученик | родители"}
  ],
  "activities": ["конкретные кружки, олимпиады, конкурсы, проекты, подходящие по интересам и успехам"],
  "goals": [{"goal": "цель", "metric": "как измерить", "term": "срок, например 'до конца четверти'"}],
  "risks": ["на что обратить внимание (пустой массив, если рисков нет)"],
  "parentMessage": "короткое тёплое сообщение для родителей, 2–3 предложения"
}
Дай 3–5 сильных сторон, 2–4 зоны роста, 4–7 рекомендаций (для разных адресатов), 3–5 активностей, 2–4 цели.`;

  return { system, user };
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Модель вернула ответ не в формате JSON');
    return JSON.parse(m[0]);
  }
}

function normalize(r: any): AiReport {
  const arr = (x: any) => (Array.isArray(x) ? x.filter(Boolean).map(String) : []);
  const audiences = ['учитель', 'ученик', 'родители'];
  return {
    summary: String(r.summary || ''),
    strengths: arr(r.strengths),
    growthAreas: arr(r.growthAreas),
    recommendations: (Array.isArray(r.recommendations) ? r.recommendations : []).map((x: any) => ({
      title: String(x?.title || ''),
      details: String(x?.details || ''),
      audience: audiences.includes(x?.audience) ? x.audience : 'учитель',
    })),
    activities: arr(r.activities),
    goals: (Array.isArray(r.goals) ? r.goals : []).map((g: any) => ({
      goal: String(g?.goal || ''),
      metric: String(g?.metric || ''),
      term: String(g?.term || ''),
    })),
    risks: arr(r.risks),
    parentMessage: String(r.parentMessage || ''),
  };
}

async function callModel(system: string, user: string): Promise<string> {
  const { baseUrl, apiKey, model } = aiConfig();
  const body: any = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  };
  const proxy = process.env.AI_PROXY;
  const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
  const send = () =>
    undiciFetch(`${baseUrl}/chat/completions`, {
      dispatcher,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

  let res = await send();
  if (res.status === 400) {
    // Some providers/models don't support response_format — retry without it.
    delete body.response_format;
    res = await send();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ошибка ИИ-провайдера (${res.status}): ${text.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('ИИ-провайдер вернул пустой ответ');
  return content;
}

/** Deterministic analysis used when no API key is configured. */
function ruleBasedReport(ctx: ReturnType<typeof buildContext>): AiReport {
  const { stats, student } = ctx;
  const s: StudentStats = stats;
  const best = s.subjects.filter((x) => x.average >= 4.5);
  const weak = s.subjects.filter((x) => x.average < 3.5);
  const up = s.subjects.filter((x) => x.trend === 'up');
  const down = s.subjects.filter((x) => x.trend === 'down');

  const strengths: string[] = [];
  if (best.length) strengths.push(`Высокие результаты: ${best.map((x) => `${x.subject} (${x.average})`).join(', ')}`);
  if (up.length) strengths.push(`Положительная динамика: ${up.map((x) => x.subject).join(', ')}`);
  if (s.attendance.rate !== null && s.attendance.rate >= 95) strengths.push(`Отличная посещаемость — ${s.attendance.rate}%`);
  if (s.achievementsCount) strengths.push(`Есть достижения (${s.achievementsCount}): ${Object.keys(s.achievementsByCategory).join(', ')}`);
  if (!strengths.length) strengths.push('Недостаточно данных для выделения сильных сторон — добавьте оценки, достижения и заметки');

  const growthAreas: string[] = [];
  if (weak.length) growthAreas.push(`Требуют внимания: ${weak.map((x) => `${x.subject} (${x.average})`).join(', ')}`);
  if (down.length) growthAreas.push(`Снижение оценок за последний месяц: ${down.map((x) => x.subject).join(', ')}`);
  if (s.attendance.rate !== null && s.attendance.rate < 90) growthAreas.push(`Посещаемость ${s.attendance.rate}% — ниже желаемых 90%`);
  if (!s.achievementsCount) growthAreas.push('Пока нет внеучебных достижений — стоит попробовать конкурсы или кружки');
  if (!growthAreas.length) growthAreas.push('Явных проблемных зон не выявлено — важно поддерживать темп');

  const recommendations: AiReport['recommendations'] = [];
  for (const w of weak.slice(0, 2))
    recommendations.push({
      title: `Поддержка по предмету «${w.subject}»`,
      details: 'Индивидуальная консультация раз в неделю, разбор типичных ошибок, короткие проверочные задания каждые 2 недели.',
      audience: 'учитель',
    });
  if (best.length)
    recommendations.push({
      title: 'Углубление в сильных предметах',
      details: `Предложить задания повышенной сложности и подготовку к олимпиаде по предмету «${best[0].subject}».`,
      audience: 'учитель',
    });
  recommendations.push({
    title: 'План на неделю',
    details: 'Составлять короткий план домашних заданий и отмечать выполненное — это развивает самоорганизацию.',
    audience: 'ученик',
  });
  recommendations.push({
    title: 'Регулярный интерес к учёбе',
    details: 'Раз в неделю спокойно обсуждать с ребёнком, что получилось и что было трудно, хвалить за усилия, а не только за оценки.',
    audience: 'родители',
  });

  const activities: string[] = [];
  if (best.length) activities.push(`Школьный этап ВсОШ по предмету «${best[0].subject}»`);
  if (student.interests) activities.push(`Кружок или проект по интересам: ${student.interests}`);
  activities.push('Индивидуальный проект (исследование по любимому предмету)');

  const goals: AiReport['goals'] = [];
  if (weak[0]) goals.push({ goal: `Поднять средний балл по предмету «${weak[0].subject}»`, metric: `с ${weak[0].average} до ${Math.min(5, Math.round((weak[0].average + 0.5) * 10) / 10)}`, term: 'до конца четверти' });
  if (s.attendance.rate !== null && s.attendance.rate < 95) goals.push({ goal: 'Улучшить посещаемость', metric: 'не менее 95% учебных дней', term: 'следующий месяц' });
  goals.push({ goal: 'Добавить новое достижение в портфолио', metric: 'участие минимум в 1 конкурсе или олимпиаде', term: 'до конца полугодия' });

  return {
    summary:
      s.gradesCount === 0
        ? 'В портфолио пока мало данных для полноценного анализа. Добавьте оценки, посещаемость, достижения и заметки — рекомендации станут точнее.'
        : `Средний балл — ${s.average}, оценок в системе: ${s.gradesCount}. ` +
          (s.attendance.rate !== null ? `Посещаемость — ${s.attendance.rate}%. ` : '') +
          (best.length ? `Лучшие результаты — ${best.map((x) => x.subject).join(', ')}. ` : '') +
          (weak.length ? `Больше всего поддержки требуют: ${weak.map((x) => x.subject).join(', ')}.` : 'Серьёзных отставаний нет.'),
    strengths,
    growthAreas,
    recommendations,
    activities,
    goals,
    risks: s.riskReasons,
    parentMessage: 'Ваш ребёнок старается, и у него есть сильные стороны, на которые можно опираться. Поддержите его интерес и вовлечённость — вместе мы поможем ему двигаться вперёд.',
  };
}

export async function analyzeStudent(studentId: number, focus: string): Promise<{ report: AiReport; source: string }> {
  const ctx = buildContext(studentId);
  const provider = aiProvider();
  if (provider === 'rules') return { report: ruleBasedReport(ctx), source: 'rules' };
  const { system, user } = buildPrompt(ctx, focus);
  const raw = provider === 'claude' ? await callClaude(system, user) : await callModel(system, user);
  return { report: normalize(extractJson(raw)), source: aiModelName()! };
}
