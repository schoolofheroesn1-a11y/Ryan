/**
 * Creates a fully populated TEST student (about three months of data) to try every part of the site:
 * percent grades, attendance, bank materials, notes, achievements, general and self assessments,
 * OGE mock exams, goals, mentoring meetings and a cabinet login. It can be deleted like any student.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, tx, UPLOAD_DIR } from './db';
import { hashPassword } from './auth';
import { percentToMark } from './grading';
import { enqueueMaterial } from './material-ai';

const day = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function subjectId(name: string) {
  const s = get<{ id: number }>('SELECT id FROM subjects WHERE name = ?', name);
  return s ? s.id : Number(run('INSERT INTO subjects (name) VALUES (?)', name).lastInsertRowid);
}

function demoExam(userId: number) {
  const title = 'ОГЭ математика (демо)';
  const ex = get<{ id: number }>('SELECT id FROM exams WHERE title = ?', title);
  if (ex) return ex.id;
  const tasks = [
    { max: 1, topic: 'вычисления' }, { max: 1, topic: 'дроби' }, { max: 1, topic: 'степени' }, { max: 1, topic: 'уравнения' },
    { max: 1, topic: 'графики' }, { max: 1, topic: 'вероятность' }, { max: 2, topic: 'текстовая задача' }, { max: 2, topic: 'неравенства' },
    { max: 2, topic: 'геометрия' }, { max: 2, topic: 'доказательство' },
  ].map((t, i) => ({ n: i + 1, ...t }));
  return Number(run(
    'INSERT INTO exams (title, type, subject_id, tasks, thresholds, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    title, 'oge', subjectId('Математика'), JSON.stringify(tasks), JSON.stringify({ 3: 5, 4: 8, 5: 11 }), userId,
  ).lastInsertRowid);
}

function addText(studentId: number, userId: number | null, category: string, source: string, offset: number, text: string, byStudent = false) {
  const stored = crypto.randomBytes(16).toString('hex') + '.txt';
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), text, 'utf8');
  const d = day(offset);
  const r = run(
    `INSERT INTO files (student_id, original_name, stored_name, mime, size, description, uploaded_by, kind, extracted_text, extract_status, category, material_date, by_student, created_at)
     VALUES (?, ?, ?, 'text/plain; charset=utf-8', ?, ?, ?, 'message', ?, 'ok', ?, ?, ?, ?)`,
    studentId, `${category}${source ? ` (${source})` : ''} от ${d.split('-').reverse().join('.')}.txt`, stored, Buffer.byteLength(text),
    source, userId, text, category, d, byStudent ? 1 : 0, `${d} 15:00:00`,
  );
  return Number(r.lastInsertRowid);
}

export function createDemoStudent(classId: number, userId: number) {
  const n = all('SELECT id FROM students WHERE full_name LIKE ?', 'Тест Алиса%').length;
  const fullName = n ? `Тест Алиса ${n + 1} (демо)` : 'Тест Алиса (демо)';
  const fileIds: number[] = [];

  const result = tx(() => {
    const sid = Number(run(
      'INSERT INTO students (class_id, full_name, birth_date, interests, about, mentor_id) VALUES (?, ?, ?, ?, ?, ?)',
      classId, fullName, `${new Date().getFullYear() - 15}-03-14`, 'биология, SUP, фотография, проекты',
      'Тестовый ученик с заполненными данными для проверки сайта. Можно удалить в любой момент.', userId,
    ).lastInsertRowid);

    // ---- Grades in percent, ~3 months; each subject has its own trend ----
    const plan: { name: string; from: number; to: number }[] = [
      { name: 'Математика', from: 55, to: 82 },       // rising
      { name: 'Русский язык', from: 72, to: 74 },     // steady
      { name: 'Английский язык', from: 86, to: 62 },  // falling
      { name: 'Обществознание', from: 66, to: 80 },   // rising
      { name: 'История', from: 68, to: 64 },
      { name: 'Биология', from: 90, to: 94 },         // strong
    ];
    const kinds = ['Работа на уроке', 'Домашнее задание', 'Самостоятельная работа', 'Контрольная работа', 'Тест', 'Проект'];
    for (const p of plan) {
      const sub = subjectId(p.name);
      for (let i = 0; i < 11; i++) {
        const offset = 85 - i * 8 + rnd(-2, 2);
        const t = i / 10;
        const percent = clamp(Math.round(p.from + (p.to - p.from) * t + rnd(-7, 7)), 15, 100);
        const kind = kinds[i % kinds.length];
        const asPoints = kind === 'Контрольная работа' || kind === 'Тест';
        const max = asPoints ? 20 : null;
        const score = asPoints ? Math.round((percent / 100) * 20) : null;
        const pct = asPoints ? Math.round((score! / 20) * 1000) / 10 : percent;
        run('INSERT INTO grades (student_id, subject_id, value, percent, score, max_score, kind, date, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          sid, sub, percentToMark(pct), pct, score, max, kind, day(Math.max(1, offset)), userId);
      }
    }

    // ---- Attendance: school days of the last 3 months ----
    for (let d = 1; d <= 90; d++) {
      const dt = new Date(Date.now() - d * 864e5);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue;
      const r = Math.random();
      const status = d >= 40 && d <= 43 ? 'sick' : r < 0.03 ? 'absent' : r < 0.07 ? 'late' : 'present';
      run('INSERT OR IGNORE INTO attendance (student_id, date, status, teacher_id) VALUES (?, ?, ?, ?)', sid, day(d), status, userId);
    }

    // ---- General assessments (teacher) and self-assessments ----
    const assess = [
      { o: 75, s: { motivation: 6, independence: 5, responsibility: 7, communication: 5, wellbeing: 7, curiosity: 8 }, c: 'Начало четверти' },
      { o: 45, s: { motivation: 6, independence: 6, responsibility: 7, communication: 5, wellbeing: 6, curiosity: 9 }, c: 'После проектной недели' },
      { o: 12, s: { motivation: 8, independence: 7, responsibility: 8, communication: 6, wellbeing: 5, curiosity: 9 }, c: 'Заметен рост по математике, но устаёт' },
    ];
    for (const a of assess) run('INSERT INTO assessments (student_id, date, scores, comment, teacher_id) VALUES (?, ?, ?, ?, ?)', sid, day(a.o), JSON.stringify(a.s), a.c, userId);
    run('INSERT INTO self_assessments (student_id, date, scores, comment) VALUES (?, ?, ?, ?)', sid, day(35),
      JSON.stringify({ motivation: 7, independence: 6, responsibility: 7, communication: 4, wellbeing: 6, curiosity: 9 }), '');
    run('INSERT INTO self_assessments (student_id, date, scores, comment) VALUES (?, ?, ?, ?)', sid, day(5),
      JSON.stringify({ motivation: 8, independence: 7, responsibility: 6, communication: 3, wellbeing: 4, curiosity: 9 }), '');

    // ---- Bank: reflections, characteristic, parent message, observation ----
    fileIds.push(addText(sid, null, 'Рефлексия ученика', 'Ученик (сам)', 30,
      'Что получилось на этой неделе: впервые решила все задачи на уравнения в самостоятельной, защитили с командой план проекта про Москву-реку.\n\n' +
      'Что было трудно: английский — не успеваю учить слова, много домашки в один день.\n\n' +
      'Что сделаю иначе / цель на следующую неделю: учить слова по 15 минут каждый день утром, а не в воскресенье.', true));
    fileIds.push(addText(sid, null, 'Рефлексия ученика', 'Ученик (сам)', 8,
      'Что получилось на этой неделе: пробник по математике лучше прошлого, наконец поняла задачи на вероятность. На SUP-тренировке была помощником инструктора.\n\n' +
      'Что было трудно: перед контрольной по английскому очень волновалась и плохо спала. С одноклассниками в группе по истории не получилось договориться.\n\n' +
      'Что сделаю иначе / цель на следующую неделю: попрошу учителя английского разобрать ошибки, в группе предложу распределить роли заранее.', true));
    fileIds.push(addText(sid, userId, 'Характеристика', 'Классный руководитель', 60,
      'Ученица любознательна, особенно увлечена биологией и экологией, охотно берёт на себя исследовательские задачи в проектах. ' +
      'Аккуратна и ответственна в долгих заданиях. В общении с одноклассниками сдержанна, в спорах уступает, неохотно выступает публично. ' +
      'По математике есть пробелы с дробями и текстовыми задачами, но видна готовность работать. Хорошо проявляет себя на занятиях на открытом воздухе.'));
    fileIds.push(addText(sid, userId, 'Сообщение / переписка', 'Родитель', 20,
      'Здравствуйте! Алиса очень переживает из-за английского: говорит, что не успевает и боится контрольных. При этом про проект по реке рассказывает с горящими глазами. ' +
      'Подскажите, можно ли как-то распределить нагрузку или дать дополнительные материалы для повторения? Дома стараемся помогать.'));
    fileIds.push(addText(sid, userId, 'Наблюдение учителя', 'Учитель', 14,
      'На выезде на Москву-реку Алиса сама предложила методику отбора проб воды и объяснила её группе младших ребят — спокойно и понятно. ' +
      'На воде уверенно держится на SUP-борде, помогала инструктору. Вечером в беседке впервые сама выступила перед всеми с итогами дня.'));

    // ---- Notes and achievements ----
    run(`INSERT INTO notes (student_id, category, text, teacher_id, created_at) VALUES (?, 'Учёба', ?, ?, ?)`,
      sid, 'Стала задавать вопросы на уроке математики, просит дополнительные задачи.', userId, `${day(25)} 12:00:00`);
    run(`INSERT INTO notes (student_id, category, text, teacher_id, created_at) VALUES (?, 'Здоровье', ?, ?, ?)`,
      sid, 'Жалуется на усталость к концу недели, на английском выглядит встревоженной.', userId, `${day(9)} 12:00:00`);
    const ach = (title: string, category: string, level: string, result: string, o: number, description: string) =>
      run('INSERT INTO achievements (student_id, title, category, level, result, date, description, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        sid, title, category, level, result, day(o), description, userId);
    ach('Школьный этап ВсОШ по биологии', 'Олимпиада', 'Школьный', 'Победитель', 40, 'Прошла на муниципальный этап');
    ach('Проект «Чистая Москва-река»', 'Проект', 'Школьный', 'Защищён на «отлично»', 18, 'Исследование проб воды, командный проект из 4 человек');
    ach('SUP-сплав по Москве-реке', 'Спорт', 'Школьный', 'Помощник инструктора', 14, 'Прошла инструктаж по безопасности на воде');

    // ---- OGE mock exams (rising) ----
    const examId = demoExam(userId);
    const mocks = [
      { o: 62, t: 'Пробник №1', s: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0] },
      { o: 33, t: 'Пробник №2', s: [1, 0, 1, 1, 1, 1, 1, 1, 1, 0] },
      { o: 6, t: 'Пробник №3', s: [1, 1, 1, 1, 1, 1, 2, 1, 1, 0] },
    ];
    for (const m of mocks) {
      run('INSERT INTO mock_results (exam_id, student_id, date, title, scores, total, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        examId, sid, day(m.o), m.t, JSON.stringify(m.s), m.s.reduce((a, b) => a + b, 0), userId);
    }

    // ---- Goals (set retroactively) ----
    const goal = (title: string, kind: string, extra: Record<string, any>, created: number, deadlineIn: number, steps: [string, boolean][] = [], source = 'teacher') => {
      const g = Number(run(
        `INSERT INTO goals (student_id, title, kind, subject_id, scale_key, exam_id, start_value, target_value, deadline, source, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sid, title, kind, extra.subjectId ?? null, extra.scaleKey ?? null, extra.examId ?? null, extra.start ?? null, extra.target ?? null,
        day(-deadlineIn), source, source === 'student' ? null : userId, `${day(created)} 08:00:00`,
      ).lastInsertRowid);
      steps.forEach(([t, done], i) => run('INSERT INTO goal_steps (goal_id, text, done, position, done_at) VALUES (?, ?, ?, ?, ?)', g, t, done ? 1 : 0, i, done ? day(created - 5) : null));
    };
    goal('Математика: 80%', 'subject', { subjectId: subjectId('Математика'), start: 58, target: 80 }, 50, 40,
      [['Разобрать дроби с учителем', true], ['Решать по 5 задач в день', true], ['Пройти тест по текстовым задачам', false]]);
    goal('Английский язык: 80%', 'subject', { subjectId: subjectId('Английский язык'), start: 70, target: 80 }, 20, 35,
      [['Учить слова по 15 минут утром', false], ['Разобрать ошибки контрольной', false]]);
    goal('ОГЭ математика (демо) — «5»', 'exam', { examId, start: 6, target: 11 }, 60, 180);
    goal('Общение: 7 из 10', 'scale', { scaleKey: 'communication', start: 5, target: 7 }, 30, 60,
      [['Выступить с итогами проекта', true], ['Взять роль координатора в группе', false]]);
    goal('Пройти муниципальный этап по биологии', 'custom', {}, 38, 25,
      [['Решить задания прошлых лет', true], ['Две консультации у учителя биологии', false], ['Повторить ботанику', false]], 'student');

    // ---- Mentoring ----
    run('INSERT INTO mentor_meetings (student_id, mentor_id, date, went_well, difficulties, agreements, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sid, userId, day(35), 'Рост по математике, интерес к проекту про реку', 'Английский, неуверенность при выступлениях',
      'Учить слова по утрам\nВыступить с итогами проекта перед классом', day(21));
    run('INSERT INTO mentor_meetings (student_id, mentor_id, date, went_well, difficulties, agreements, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sid, userId, day(12), 'Выступила на выезде, пробник лучше', 'Тревога перед английским, конфликт в группе по истории',
      'Обсудить с учителем английского разбор ошибок\nВ группе распределить роли заранее', day(-2));

    // ---- Cabinet access ----
    let login = 'test.alisa';
    for (let i = 2; get('SELECT 1 FROM student_accounts WHERE login = ?', login) || get('SELECT 1 FROM users WHERE email = ?', login); i++) login = `test.alisa${i}`;
    const password = Array.from(crypto.randomBytes(8), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    run('INSERT INTO student_accounts (student_id, login, password_hash) VALUES (?, ?, ?)', sid, login, hashPassword(password));

    return { studentId: sid, name: fullName, login, password };
  });

  // The AI reads the new texts in the background (summary, tags, scale scores).
  for (const f of fileIds) enqueueMaterial(f);
  return result;
}
