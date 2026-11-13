// Морской поход: корабль идёт через шторм — пять стычек на палубе (утопленники, краб, наги), затем из моря поднимается Кракен.
// Здоровье и зелья переносятся между боями (после каждой победы — немного здоровья), сила врагов растёт
// от передовой героя. Награды за бои, Сундук Прилива с Кракена (и иногда с команды утопленников).
// Здесь только чистая логика (без отрисовки) — её проверяют тесты.

export const VOYAGE = ["drowned", "crab", "naga", "drowned", "naga", "kraken"];
export const SEA_HEAL = 0.25; // доля здоровья после каждой победы
export const SEA_ESTUS = 3;
export const SEA_CHEST = 0.15; // шанс Сундука Прилива с обычного врага
/** Строки появления Кракена: по одной, под нарастающую качку. */
export const KRAKEN_RHYME = ["Появилось к нам из моря", "вдруг чудовище морское,", "на корабль вцепился друг", "гигантский осьминог!"];
export const EMERGE_TIME = 8.0; // секунд длится появление Кракена

/** Сила стычки в «раундах»: от передовой героя (не ниже 8), Кракен — на 6 раундов сильнее. */
export function seaWave(step, frontier) {
  const base = Math.max(8, Number(frontier) || 1);
  return base + (VOYAGE[step] === "kraken" ? 6 : step);
}

/** Награда за стычку: [пепел, алые, синие]. */
export function seaReward(step, frontier) {
  const w = seaWave(step, frontier);
  if (VOYAGE[step] === "kraken") return [400 + 60 * w, 8 + Math.floor(w / 6), 2];
  return [80 + 30 * w, 2 + Math.floor(w / 10), 0];
}

/** Сундук за стычку: с Кракена — всегда, с команды — иногда. */
export function seaChest(step, rnd = Math.random) {
  return VOYAGE[step] === "kraken" || rnd() < SEA_CHEST ? "sea" : null;
}

/** Время, когда появляется каждая строка стиха, и долю подъёма щупалец/головы — для сцены появления. */
export function emergeState(t) {
  const lines = KRAKEN_RHYME.map((_, i) => Math.max(0, Math.min(1, (t - 0.5 - i * 1.5) / 0.4)));
  const tentacles = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(1, (t - 1.5 - i * 0.6) / 1.0)));
  const head = Math.max(0, Math.min(1, (t - 4.6) / 1.8));
  const eyes = t >= 6.4;
  const rock = Math.min(1, t / 6);
  return { lines, tentacles, head, eyes, rock, done: t >= EMERGE_TIME };
}
