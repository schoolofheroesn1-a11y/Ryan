// Сундуки: иногда выпадают с врагов (с босса — всегда), открываются упражнением в инвентаре у костра.
// У каждой земли свой сундук и своё уникальное оружие — выпадает редко, но после pity сундуков без него — точно.
import { SWORDS, locationFor, rewards } from "./gear.js";

/** Сундуки земель: чем дальше земля, тем больше повторений и богаче добыча. */
export const CHESTS = {
  crypt: { loc: 1, name: "Костяной сундук", ex: "jack", reps: 5, weapon: "bonewail", chance: 0.03, pity: 40 },
  castle: { loc: 2, name: "Сундук разбойников", ex: "squat", reps: 10, weapon: "rogueking", chance: 0.025, pity: 45 },
  grave: { loc: 3, name: "Гробовой ковчег", ex: "pushup", reps: 15, weapon: "moonreap", chance: 0.02, pity: 50 },
  abyss: { loc: 4, name: "Адский ковчег", ex: "jack", reps: 20, weapon: "abyssheart", chance: 0.015, pity: 60 },
};
export const CHEST_ORDER = ["crypt", "castle", "grave", "abyss"];
export const CHEST_DROP = 0.12; // шанс сундука с обычного врага
const LOC_START = { 1: 1, 2: 16, 3: 31, 4: 46 };
const TALISMANS = ["amulet", "windcharm", "fang"];

/** Редкость добычи: подпись и цвет. */
export const RARITY = {
  common: ["обычное", [210, 200, 186]],
  rare: ["редкое", [120, 180, 255]],
  epic: ["эпическое", [200, 130, 255]],
  legendary: ["ЛЕГЕНДАРНОЕ", [255, 190, 60]],
};

/** Поля сундуков у героя (старые сохранения — без них). */
export function chestState(p) {
  if (!p.chests || typeof p.chests !== "object") p.chests = {};
  if (!p.chestPity || typeof p.chestPity !== "object") p.chestPity = {};
  if (!(p.chestsOpened >= 0)) p.chestsOpened = 0;
  return p;
}

export const chestCount = (p) => CHEST_ORDER.reduce((n, k) => n + ((p.chests && p.chests[k]) || 0), 0);
export const chestFor = (wave) => CHEST_ORDER[locationFor(wave) - 1];

/** Выпал ли сундук с врага этой волны: id сундука или null. */
export function rollDrop(wave, boss, rnd = Math.random) {
  return boss || rnd() < CHEST_DROP ? chestFor(wave) : null;
}

export function addChest(p, kind, n = 1) {
  chestState(p).chests[kind] = (p.chests[kind] || 0) + n;
}

/**
 * Что внутри: [{ kind: "ash"|"red"|"blue"|"item", n?, key?, rarity }]. Уникальное оружие — с шансом chance
 * или наверняка на pity-м сундуке подряд без него; талисман — если какого-то ещё нет.
 */
export function rollLoot(p, kind, rnd = Math.random) {
  const C = CHESTS[kind], loc = C.loc, owned = p.owned || [];
  chestState(p);
  const base = rewards(LOC_START[loc] + 7)[0];
  const loot = [
    { kind: "ash", n: Math.round(base * (1 + rnd())), rarity: "common" },
    { kind: "red", n: 3 * loc + Math.floor(rnd() * 4 * loc), rarity: "common" },
  ];
  if (rnd() < 0.3 + 0.1 * loc) loot.push({ kind: "blue", n: 1 + (rnd() < 0.25 ? 1 : 0), rarity: "rare" });
  const missing = TALISMANS.filter((k) => !owned.includes(k));
  if (rnd() < 0.06) {
    loot.push(missing.length ? { kind: "item", key: missing[Math.floor(rnd() * missing.length)], rarity: "epic" }
      : { kind: "blue", n: 2, rarity: "rare" });
  }
  if (!owned.includes(C.weapon)) {
    const pity = (p.chestPity[kind] || 0) + 1;
    if (rnd() < C.chance || pity >= C.pity) {
      loot.push({ kind: "item", key: C.weapon, rarity: "legendary" });
      p.chestPity[kind] = 0;
    } else {
      p.chestPity[kind] = pity;
    }
  }
  return loot;
}

/** Забрать добычу: в запас героя. */
export function applyLoot(p, loot) {
  for (const it of loot) {
    if (it.kind === "ash") p.souls += it.n;
    else if (it.kind === "red") p.redGems += it.n;
    else if (it.kind === "blue") p.blueGems += it.n;
    else if (it.kind === "item" && !p.owned.includes(it.key)) p.owned.push(it.key);
  }
}

/** Открыть один сундук: списывает его, возвращает добычу (уже в запасе героя) или null. */
export function openChest(p, kind, rnd = Math.random) {
  chestState(p);
  if (!(p.chests[kind] > 0)) return null;
  p.chests[kind] -= 1;
  p.chestsOpened += 1;
  const loot = rollLoot(p, kind, rnd);
  applyLoot(p, loot);
  return loot;
}

/** Сколько уникального оружия сундуков уже у героя. */
export const chestWeapons = (p) => CHEST_ORDER.filter((k) => (p.owned || []).includes(CHESTS[k].weapon)).length;
export const isChestWeapon = (key) => !!(SWORDS[key] && SWORDS[key].chest);
