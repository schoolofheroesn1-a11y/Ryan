/**
 * Заполняет базу демонстрационными данными.
 * Запуск: npm run seed
 * Создаёт: admin@school.ru / admin123 и teacher@school.ru / teacher123
 */
import 'dotenv/config';
import { all, get, run, tx } from './db';
import { hashPassword } from './auth';

if (get<{ c: number }>('SELECT COUNT(*) AS c FROM users')!.c > 0) {
  console.log('В базе уже есть пользователи — демо-данные не добавлены.');
  process.exit(0);
}

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(xs: T[]) => xs[rnd(0, xs.length - 1)];
const day = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

tx(() => {
  const admin = Number(run("INSERT INTO users (email, name, password_hash, role) VALUES ('admin@school.ru', 'Ирина Петровна Смирнова', ?, 'admin')", hashPassword('admin123')).lastInsertRowid);
  const teacher = Number(run("INSERT INTO users (email, name, password_hash, role) VALUES ('teacher@school.ru', 'Алексей Викторович Орлов', ?, 'teacher')", hashPassword('teacher123')).lastInsertRowid);

  const c7 = Number(run("INSERT INTO classes (name, year) VALUES ('7А', '2026/2027')").lastInsertRowid);
  const c9 = Number(run("INSERT INTO classes (name, year) VALUES ('9Б', '2026/2027')").lastInsertRowid);
  run('INSERT INTO class_teachers (class_id, user_id) VALUES (?, ?)', c7, teacher);

  const subjects = all<{ id: number; name: string }>(
    "SELECT id, name FROM subjects WHERE name IN ('Русский язык','Математика','Английский язык','История','Биология','Информатика','Физкультура')",
  );

  const students: [number, string, string, string, number][] = [
    [c7, 'Иванов Артём', '2013-04-12', 'робототехника, шахматы', 4.6],
    [c7, 'Кузнецова Мария', '2013-09-03', 'рисование, английский', 4.2],
    [c7, 'Соколов Дмитрий', '2013-01-25', 'футбол', 3.0],
    [c7, 'Попова Анна', '2013-06-18', 'биология, волонтёрство', 4.8],
    [c7, 'Лебедев Никита', '2012-12-02', 'компьютерные игры, программирование', 3.6],
    [c9, 'Новикова Елизавета', '2011-03-14', 'литература, театр', 4.4],
    [c9, 'Морозов Кирилл', '2011-07-29', 'хоккей', 2.9],
    [c9, 'Волкова София', '2011-11-08', 'математика, олимпиады', 4.9],
  ];

  for (const [cls, name, birth, interests, base] of students) {
    const sid = Number(run('INSERT INTO students (class_id, full_name, birth_date, interests) VALUES (?, ?, ?, ?)', cls, name, birth, interests).lastInsertRowid);
    for (const sub of subjects) {
      const bias = rnd(-5, 5) / 10;
      for (let i = 0; i < rnd(6, 10); i++) {
        const offset = rnd(1, 75);
        const drift = name.includes('Соколов') && offset < 30 ? -0.6 : name.includes('Лебедев') && offset < 30 ? 0.6 : 0;
        const v = Math.max(2, Math.min(5, Math.round(base + bias + drift + (Math.random() - 0.5) * 1.6)));
        run('INSERT INTO grades (student_id, subject_id, value, kind, date, teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
          sid, sub.id, v, pick(['Работа на уроке', 'Домашнее задание', 'Самостоятельная работа', 'Контрольная работа']), day(offset), teacher);
      }
    }
    const absentProb = base < 3.2 ? 0.18 : 0.05;
    for (let d = 1; d <= 60; d++) {
      const dt = new Date(Date.now() - d * 864e5);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue;
      const r = Math.random();
      const status = r < absentProb ? pick(['absent', 'sick']) : r < absentProb + 0.04 ? 'late' : 'present';
      run('INSERT INTO attendance (student_id, date, status, teacher_id) VALUES (?, ?, ?, ?)', sid, day(d), status, teacher);
    }
  }

  const id = (n: string) => get<{ id: number }>('SELECT id FROM students WHERE full_name = ?', n)!.id;
  const ach = (n: string, title: string, category: string, level: string, result: string, offset: number) =>
    run('INSERT INTO achievements (student_id, title, category, level, result, date, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id(n), title, category, level, result, day(offset), teacher);
  ach('Иванов Артём', 'Турнир по робототехнике «РобоФест»', 'Конкурс', 'Региональный', 'Призёр, 3 место', 40);
  ach('Иванов Артём', 'Школьный этап ВсОШ по математике', 'Олимпиада', 'Школьный', 'Победитель', 20);
  ach('Попова Анна', 'Экологический проект «Чистый берег»', 'Проект', 'Муниципальный', 'Победитель', 35);
  ach('Попова Анна', 'Олимпиада по биологии', 'Олимпиада', 'Муниципальный', 'Призёр', 10);
  ach('Кузнецова Мария', 'Конкурс рисунков «Мой город»', 'Творчество', 'Школьный', '1 место', 50);
  ach('Соколов Дмитрий', 'Городское первенство по футболу', 'Спорт', 'Муниципальный', '2 место (команда)', 25);
  ach('Волкова София', 'Региональный этап ВсОШ по математике', 'Олимпиада', 'Региональный', 'Победитель', 15);
  ach('Новикова Елизавета', 'Конкурс чтецов «Живая классика»', 'Творчество', 'Муниципальный', 'Финалист', 30);

  const note = (n: string, category: string, text: string) =>
    run('INSERT INTO notes (student_id, category, text, teacher_id) VALUES (?, ?, ?, ?)', id(n), category, text, teacher);
  note('Соколов Дмитрий', 'Поведение', 'Часто отвлекается на уроках в последние недели, жалуется на усталость после тренировок.');
  note('Соколов Дмитрий', 'Учёба', 'Не сдал две домашние работы по математике, но хорошо отвечает устно.');
  note('Лебедев Никита', 'Интересы', 'Сам написал небольшую игру на Python, показал классу — очень увлечён.');
  note('Иванов Артём', 'Учёба', 'Быстро решает задачи, иногда скучает — нужны задания посложнее.');
  note('Кузнецова Мария', 'Социальное', 'Стесняется выступать перед классом, хотя материал знает хорошо.');
  note('Морозов Кирилл', 'Учёба', 'Пропуски из-за соревнований, отстаёт по алгебре.');
  // General assessments (1–10) over the last three months — feeds the charts.
  const scaleBase: Record<string, number> = {
    'Иванов Артём': 8, 'Кузнецова Мария': 7, 'Соколов Дмитрий': 5, 'Попова Анна': 9, 'Лебедев Никита': 6,
    'Новикова Елизавета': 8, 'Морозов Кирилл': 5, 'Волкова София': 9,
  };
  for (const [n, base] of Object.entries(scaleBase)) {
    for (const [offset, drift] of [[80, 0], [50, 0], [15, n.includes('Соколов') ? -2 : n.includes('Лебедев') ? 2 : 0]] as const) {
      const scores: Record<string, number> = {};
      for (const k of ['motivation', 'independence', 'responsibility', 'communication', 'wellbeing', 'curiosity']) {
        scores[k] = Math.max(1, Math.min(10, base + drift + rnd(-1, 1) + (k === 'communication' && n.includes('Кузнецова') ? -2 : 0)));
      }
      run('INSERT INTO assessments (student_id, date, scores, comment, teacher_id) VALUES (?, ?, ?, ?, ?)',
        id(n), day(offset), JSON.stringify(scores), '', teacher);
    }
  }
  void admin;
});

console.log('Демо-данные добавлены.');
console.log('Администратор: admin@school.ru / admin123');
console.log('Учитель (класс 7А): teacher@school.ru / teacher123');
