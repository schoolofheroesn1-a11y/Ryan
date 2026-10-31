// Достижения и титулы. Каждое достижение даёт титул — его можно выбрать в профиле,
// он виден рядом с именем в профиле и в рейтинге. Хранятся в профиле устройства (оба режима).
//
// Счётные достижения проверяются по статистике (ctx), подвиги в бою — по событиям победы (events).

/** Категории: [название, значок]. */
export const ACH_CATS = {
  reps: ["Тренировки", "fist"],
  fire: ["Огоньки", "flame"],
  aura: ["Аура", "lotus"],
  path: ["Путь", "skull"],
  feat: ["Подвиги", "sword"],
  arena: ["Арена", "medal"],
  gear: ["Снаряжение", "gem"],
};

const total = (c) => c.reps.pushup + c.reps.squat + c.reps.jack;

/**
 * [id, категория, название, описание, титул, цель, значение(ctx)] — для счётных;
 * у подвигов значения нет: они открываются событием победы с тем же id.
 */
const LIST = [
  ["push100", "reps", "Первая сотня", "100 отжиманий", "Новобранец", 100, (c) => c.reps.pushup],
  ["push1000", "reps", "Тысяча отжиманий", "1000 отжиманий", "Железный Кулак", 1000, (c) => c.reps.pushup],
  ["push5000", "reps", "Пять тысяч", "5000 отжиманий", "Несокрушимый", 5000, (c) => c.reps.pushup],
  ["squat1000", "reps", "Тысяча приседаний", "1000 приседаний", "Стальные Ноги", 1000, (c) => c.reps.squat],
  ["jack500", "reps", "Звездопад", "500 звёздочек", "Звездопад", 500, (c) => c.reps.jack],
  ["total10000", "reps", "Десять тысяч", "10 000 упражнений всего", "Неутомимый", 10000, total],
  ["streak3", "fire", "Три дня огня", "Огоньки 3 дня подряд", "Хранитель Искры", 3, (c) => c.streakDays],
  ["streak7", "fire", "Неделя огоньков", "Огоньки 7 дней подряд", "Хранитель Огня", 7, (c) => c.streakDays],
  ["streak30", "fire", "Месяц огня", "Огоньки 30 дней подряд", "Вечное Пламя", 30, (c) => c.streakDays],
  ["flames100", "fire", "Сто огоньков", "100 огоньков в одной серии", "Повелитель Пламени", 100, (c) => c.flames],
  ["plank10", "aura", "Тихий ум", "10 минут в планке", "Ученик Медитации", 600, (c) => c.plank],
  ["plank60", "aura", "Час покоя", "Час в планке", "Просветлённый", 3600, (c) => c.plank],
  ["knight", "path", "Костяной Рыцарь", "Победить первого босса", "Убийца Костей", 6, (c) => c.frontier],
  ["crypt", "path", "Склеп пройден", "Пройти Склеп", "Расхититель Склепа", 16, (c) => c.frontier],
  ["wraith", "path", "Король-Призрак", "Пройти Кладбище", "Цареубийца", 46, (c) => c.frontier],
  ["seraph", "path", "Падение Серафима", "Победить Алого Серафима", "Губитель Серафима"],
  ["spire5", "path", "Тыквенный страж", "Пройти 5 этажей Шпиля Самайна", "Тыквенный Страж", 5, (c) => c.tower],
  ["eyequeen", "path", "Око закрыто", "Победить Королеву Тринадцатого Ока", "Ослепивший Око"],
  ["spire26", "path", "Повелитель Самайна", "Пройти 26 этажей Шпиля", "Повелитель Самайна", 26, (c) => c.tower],
  ["bosses25", "path", "Охота на боссов", "Победить 25 боссов", "Охотник на Боссов", 25, (c) => c.bosses],
  ["level25", "path", "Ветеран", "Достичь 25 уровня", "Ветеран", 25, (c) => c.level],
  ["level60", "path", "Легенда", "Достичь 60 уровня", "Легенда", 60, (c) => c.level],
  ["flawless", "feat", "Без единой царапины", "Победить, не получив урона", "Неуязвимый"],
  ["boss_nopot", "feat", "Аскет", "Победить босса без зелий", "Аскет"],
  ["seraph_nopot", "feat", "Несломленный", "Победить Серафима без зелий", "Несломленный"],
  ["fast", "feat", "Молниеносный", "Победить быстрее 8 секунд", "Молния"],
  ["clutch", "feat", "На волоске", "Победить, когда здоровья меньше 10%", "Бессмертный"],
  ["hard_boss", "feat", "Хардкор", "Победить босса в хардкоре", "Безумец"],
  ["night", "feat", "Полуночник", "Победить врага с полуночи до 5 утра", "Полуночник"],
  ["morning", "feat", "Ранняя пташка", "Победить врага с 5 до 8 утра", "Ранняя Пташка"],
  ["duel1", "arena", "Первая медаль", "Выиграть медаль дуэлей", "Дуэлянт", 1, (c) => c.medals],
  ["duel10", "arena", "Гроза арены", "10 медалей дуэлей", "Гроза Арены", 10, (c) => c.medals],
  ["talismans", "gear", "Собиратель", "Купить все талисманы", "Собиратель", 3, (c) => c.talismans],
  ["seraph_gear", "gear", "Крылатый", "Крыло и Доспех Серафима", "Крылатый", 2, (c) => c.seraphGear],
  ["chests10", "gear", "Кладоискатель", "Открыть 10 сундуков", "Кладоискатель", 10, (c) => c.chestsOpened],
  ["chests100", "gear", "Сто сундуков", "Открыть 100 сундуков", "Король Сокровищ", 100, (c) => c.chestsOpened],
  ["legend", "gear", "Легендарная находка", "Найти оружие в сундуке", "Избранный Судьбой", 1, (c) => c.chestWeapons],
  ["relics4", "gear", "Хранитель реликвий", "Найти оружие всех 4 сундуков", "Хранитель Реликвий", 4, (c) => c.chestWeapons],
];

export const ACHIEVEMENTS = LIST.map(([id, cat, name, desc, title, goal, value]) => ({ id, cat, name, desc, title, goal: goal || 0, value: value || null }));
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Статистика для проверки из героя, профиля и аккаунта. */
export function achContext(player, profile, account = null) {
  const o = player.owned || [];
  return {
    reps: { pushup: 0, squat: 0, jack: 0, ...(player.totalReps || {}) },
    plank: player.plankSeconds || 0,
    frontier: Math.max(Number(player.frontier) || 1, player.wave || 1),
    bosses: player.bossesDefeated || 0,
    level: player.level || 1,
    streakDays: profile.streak ? profile.streak.days : 0,
    flames: profile.streak ? Math.max(profile.streak.best, profile.streak.points) : 0,
    medals: account ? account.medals || 0 : 0,
    talismans: ["amulet", "windcharm", "fang"].filter((k) => o.includes(k)).length,
    seraphGear: ["seraph", "wingarmor"].filter((k) => o.includes(k)).length,
    chestsOpened: player.chestsOpened || 0,
    tower: profile.tower ? profile.tower.best || 0 : 0,
    chestWeapons: ["bonewail", "rogueking", "moonreap", "abyssheart"].filter((k) => o.includes(k)).length,
  };
}

/** [сейчас, цель] для полоски прогресса; у подвигов — [0|1, 1]. */
export function achProgress(a, ctx, unlocked) {
  if (!a.value) return [unlocked ? 1 : 0, 1];
  return [Math.min(a.goal, Math.floor(a.value(ctx))), a.goal];
}

/**
 * Проверка: что открылось (по статистике и событиям). Пишет в ach { id: день } и возвращает новые достижения.
 */
export function checkAchievements(ach, ctx, events = [], day = "") {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (ach[a.id]) continue;
    const ok = a.value ? a.value(ctx) >= a.goal : events.includes(a.id);
    if (ok) {
      ach[a.id] = day || true;
      fresh.push(a);
    }
  }
  return fresh;
}

/** Подвиги, заслуженные этой победой. f — итоги боя. */
export function battleEvents(f) {
  const ev = [];
  if (!f.tookDamage) ev.push("flawless");
  if (f.time < 8) ev.push("fast");
  if (f.hpFrac < 0.1) ev.push("clutch");
  if (f.boss && !f.potions) ev.push("boss_nopot");
  if (f.kind === "seraph") ev.push("seraph");
  if (f.kind === "seraph" && !f.potions) ev.push("seraph_nopot");
  if (f.boss && f.hard) ev.push("hard_boss");
  if (f.hour >= 0 && f.hour < 5) ev.push("night");
  if (f.hour >= 5 && f.hour < 8) ev.push("morning");
  return ev;
}
