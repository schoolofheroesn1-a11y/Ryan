// Шпиль Самайна — хеллоуинский режим выживания. Герой поднимается по этажам башни без отдыха у костра:
// здоровье и зелья переносятся с этажа на этаж, а после каждой победы можно выбрать один из трёх
// «дары Шпиля». Каждый 5-й этаж — элитный страж (босс одной из земель), каждый 13-й — Королева
// Тринадцатого Ока. Забег кончается гибелью или уходом; рекорд — самый высокий пройденный этаж.
// Здесь только чистая логика (без отрисовки) — её проверяют тесты.

export const QUEEN_EVERY = 13;
export const ELITE_EVERY = 5;
export const VAMPIRE_AT = 8; // Граф Пепельной Крови — на 8-м этаже каждого круга из 13
export const STALKER_AT = 11; // Полуночный Охотник — на 11-м (две стадии: Сумерки и Полночь)
export const ELITES = ["knight", "chief", "wraith"];
const EARLY = ["skeleton", "bandit", "zombie", "bat"];
const DEEP = ["imp", "hound", "husk"];
export const START_ESTUS = 2; // в башню берут только две фляги
export const MAX_ESTUS = 5;

/**
 * Равные условия: в Шпиле все герои одинаковы — характеристики растут только с этажом, меч стандартный,
 * аура, доспехи, талисманы и свойства своего меча не действуют. Поэтому рейтинг Шпиля честный.
 */
export const TOWER_SWORD = "steel";
export function towerStats(floor) {
  const s = TOWER_BASE + Math.round(TOWER_GROW * (floor - 1));
  return { strength: s, vigor: s, endurance: s, sword: TOWER_SWORD };
}
export const TOWER_BASE = 2;
export const TOWER_GROW = 0.5;

/** Детерминированный генератор (одинаковый этаж — одинаковый враг в одном забеге). */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

/** Сила этажа в «раундах» обычного пути: враги растут быстрее, чем на карте. */
export const floorWave = (floor) => Math.max(1, Math.round(1.6 * floor - 1));

/** Кто ждёт на этаже: { kind, boss, elite, queen }. */
export function floorPlan(floor, seed = 0) {
  if (floor % QUEEN_EVERY === 0) return { kind: "eyequeen", boss: true, elite: false, queen: true };
  if (floor % QUEEN_EVERY === VAMPIRE_AT) return { kind: "vampire", boss: true, elite: false, queen: false, vampire: true };
  if (floor % QUEEN_EVERY === STALKER_AT) return { kind: "stalker", boss: true, elite: false, queen: false, stalker: true };
  const r = rng(seed * 977 + floor * 131);
  if (floor % ELITE_EVERY === 0) return { kind: ELITES[Math.floor(floor / ELITE_EVERY - 1) % ELITES.length], boss: true, elite: true, queen: false };
  const roll = r();
  if (roll < 0.35) return { kind: "fluff", boss: false, elite: false, queen: false };
  if (roll < 0.55) return { kind: "pumpkin", boss: false, elite: false, queen: false };
  const pool = floor > 6 ? [...EARLY, ...DEEP] : EARLY;
  return { kind: pool[Math.floor(r() * pool.length)], boss: false, elite: false, queen: false };
}

/**
 * Дары Шпиля: [id, название, описание]. mods копятся за забег и сгорают с ним.
 * dmg/hp/regen — доли, crit — прибавка к множителю крита.
 */
export const GIFTS = [
  ["heal", "Целебный отвар", "Лечит 50% здоровья"],
  ["potion", "Фляга ведьмы", "+1 зелье (до 5)"],
  ["fury", "Свечной гнев", "+15% урона"],
  ["vigor", "Сердце башни", "+20% здоровья и лечит столько же"],
  ["wind", "Крылья ветра", "+30% восполнения сил"],
  ["crit", "Коготь кошки", "Крит сильнее на 0.3"],
  ["pact", "Тёмная сделка", "+35% урона, но −15% здоровья"],
];
export const GIFT = Object.fromEntries(GIFTS.map(([id, name, desc]) => [id, { id, name, desc }]));

export const emptyMods = () => ({ dmg: 0, hp: 0, regen: 0, crit: 0 });

/** Три разных дара после этажа. Лечение не предлагается при полном здоровье, фляга — при полных флягах. */
export function offerGifts(floor, seed, run) {
  const r = rng(seed * 31 + floor * 7919);
  const pool = GIFTS.map((g) => g[0]).filter((id) => !(id === "heal" && run.hpFrac >= 0.95) && !(id === "potion" && run.estus >= MAX_ESTUS));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/**
 * Применить дар к забегу. run: { hp, maxHp, estus, mods }. maxHp — до дара (с учётом прежних mods).
 * Возвращает новое состояние; maxHp пересчитывает вызывающий, здесь — только доля и лечение.
 */
export function applyGift(id, run, baseMaxHp) {
  const mods = { ...run.mods };
  let { hp, estus } = run;
  const maxOf = (m) => Math.round(baseMaxHp * (1 + m.hp));
  if (id === "heal") hp = Math.min(maxOf(mods), hp + Math.round(maxOf(mods) * 0.5));
  else if (id === "potion") estus = Math.min(MAX_ESTUS, estus + 1);
  else if (id === "fury") mods.dmg += 0.15;
  else if (id === "vigor") {
    const before = maxOf(mods);
    mods.hp += 0.2;
    hp += maxOf(mods) - before;
  } else if (id === "wind") mods.regen += 0.3;
  else if (id === "crit") mods.crit += 0.3;
  else if (id === "pact") {
    mods.dmg += 0.35;
    mods.hp -= 0.15;
    hp = Math.min(hp, maxOf(mods));
  }
  return { ...run, hp: Math.max(1, hp), estus, mods };
}

/** Награда за этаж: [пепел, алые, синие]. Синий камень — за Королеву. */
export function floorReward(floor) {
  const plan = floorPlan(floor);
  const ash = 60 + 30 * floor;
  if (plan.queen) return [ash * 3, 6 + Math.floor(floor / QUEEN_EVERY) * 2, 2];
  if (plan.stalker) return [ash * 3, 5 + Math.floor(floor / ELITE_EVERY), 2];
  if (plan.elite || plan.vampire) return [ash * 2, 3 + Math.floor(floor / ELITE_EVERY), 1];
  return [ash, 1 + Math.floor(floor / 4), 0];
}

/** Сундук за босса: Граф, Охотник и Королева — Сундук Самайна; элитный страж — сундук земли (выше — богаче). */
export function floorChest(floor) {
  const plan = floorPlan(floor);
  if (plan.queen || plan.vampire || plan.stalker) return "samhain";
  if (plan.elite) return floor >= 20 ? "grave" : floor >= 10 ? "castle" : "crypt";
  return null;
}

// --- Око Королевы: «Взгляд» ---
export const GAZE_TIME = 2.4; // сколько Око открыто
export const GAZE_REFLECT = 0.6; // доля урона удара, которая возвращается герою
/** Через сколько секунд Око откроется снова (в ярости — чаще). */
export const gazeEvery = (enraged) => (enraged ? 5 : 7.5);

// --- Пухоглот ---
export const FLUFF_DRAIN = 18; // сколько сил высасывает укус
