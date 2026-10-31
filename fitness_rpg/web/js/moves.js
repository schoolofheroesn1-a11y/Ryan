// Приёмы врагов. У каждого замаха — свой приём: урон, длина замаха, серия ударов и особые свойства.
// Вампир и Тыквоголов всегда бьются своими приёмами. В игре без камеры (кнопки) у всех врагов есть
// ещё быстрые, тяжёлые удары, серии и финты — без камеры реакция мгновенная, и бой должен быть злее.
// Чистая логика (без отрисовки) — её проверяют тесты.

/**
 * dmg — множитель урона, wind — множитель длины замаха (от windupTime врага), hits — [мин, макс] ударов
 * в серии, armor — замах не прервать ударами, feint — ложный замах, за ним сразу быстрый удар,
 * drain — враг лечится на нанесённый урон, mist — секунды в тумане (неуязвим) перед ударом,
 * burn — секунды горения героя, pose — особый кадр врага (vampire_bite, vampire_swarm).
 */
export const MOVES = {
  strike: { dmg: 1, wind: 1 },
  quick: { dmg: 0.7, wind: 0.45, label: "БЫСТРЫЙ!" },
  heavy: { dmg: 1.7, wind: 1.45, armor: true, label: "ТЯЖЁЛЫЙ!" },
  flurry: { dmg: 0.55, wind: 0.4, hits: [3, 4], label: "СЕРИЯ!" },
  feint: { dmg: 1, wind: 0.7, feint: true },
  // Граф Тыквенной Крови
  claw: { dmg: 1, wind: 1, label: "КОГТИ" },
  bite: { dmg: 1.2, wind: 0.8, drain: 1, pose: "bite", label: "УКУС!" },
  swarm: { dmg: 0.35, wind: 0.55, hits: [3, 4], pose: "swarm", label: "СТАЯ МЫШЕЙ!" },
  mist: { dmg: 1.3, wind: 0.55, mist: 1.4, label: "ИЗ ТУМАНА!" },
  // Тыквоголов
  sickle: { dmg: 1, wind: 1, label: "СЕРП" },
  bomb: { dmg: 1.1, wind: 1.3, burn: 4, label: "ТЫКВЕННАЯ БОМБА!" },
};

const FAST = ["bandit", "bat", "imp", "fluff"];
const SLOW = ["knight", "zombie", "husk", "hound", "pumpkin"];

/** Самый короткий замах: с камерой нужно успеть присесть всем телом, кнопкой — нажать клавишу. */
export const minWind = (btn) => (btn ? 0.38 : 1.0);
/** Сколько защищает присед кнопкой: присесть заранее нельзя — только поймать момент удара. */
export const BTN_GUARD = 0.6;

/** Таблица приёмов: [[id, вес]]. */
export function moveTable(kind, wave, btn, boss = false, enraged = false) {
  let t;
  if (kind === "vampire") t = [["claw", 3], ["bite", enraged ? 3 : 2], ["swarm", 2], ["mist", enraged ? 2 : 1.2]];
  else if (kind === "pumpkin") t = [["sickle", 3], ["bomb", 2]];
  else t = [["strike", 3]];
  if (!btn) return t;
  // без камеры: всем — быстрые и тяжёлые удары, серии, финты; чем дальше, тем чаще
  const fast = FAST.includes(kind), slow = SLOW.includes(kind);
  t.push(["quick", fast ? 3 : 2]);
  t.push(["heavy", slow || boss ? 2.2 : 1.2]);
  if (wave >= 2) t.push(["flurry", (fast ? 2 : 1.2) + (boss ? 1 : 0)]);
  if (wave >= 4) t.push(["feint", 1 + (boss ? 0.8 : 0)]);
  return t;
}

/** Выбрать приём по весам. r — генератор [0, 1). */
export function pickMove(kind, wave, btn, boss = false, enraged = false, r = Math.random) {
  const t = moveTable(kind, wave, btn, boss, enraged);
  let x = r() * t.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of t) if ((x -= w) < 0) return id;
  return t[t.length - 1][0];
}

/** Длина замаха приёма для врага с базовым замахом base. */
export function windFor(id, base, btn) {
  return Math.max(minWind(btn), base * MOVES[id].wind);
}

/** Сколько ещё ударов в серии после первого. */
export function extraHits(id, r = Math.random) {
  const h = MOVES[id].hits;
  return h ? h[0] - 1 + Math.floor(r() * (h[1] - h[0] + 1)) : 0;
}

/**
 * Враги без камеры: живучее и сильнее с каждым раундом (без прокачки не пройти), замах короче,
 * пауз меньше, серии длиннее, ударами труднее сбить. Множители — для проверки в тестах.
 */
export function buttonsScale(wave) {
  return { hp: 1.3 + 0.02 * wave, dmg: 1.2 + 0.015 * wave, wind: Math.max(0.85, 1.25 - 0.012 * wave) };
}
