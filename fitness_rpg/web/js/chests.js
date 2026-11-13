// Сундуки: иногда выпадают с врагов (с босса — всегда), открываются упражнением в инвентаре у костра.
// У каждой земли свой сундук и своё уникальное оружие — выпадает редко, но после pity сундуков без него — точно.
import { RELICS, SWORDS, locationFor, rewards } from "./gear.js";

/** Сундуки земель: чем дальше земля, тем больше повторений и богаче добыча. */
export const CHESTS = {
  crypt: { loc: 1, name: "Костяной сундук", ex: "jack", reps: 5, weapon: "bonewail", chance: 0.03, pity: 40 },
  castle: { loc: 2, name: "Сундук разбойников", ex: "squat", reps: 10, weapon: "rogueking", chance: 0.025, pity: 45 },
  grave: { loc: 3, name: "Гробовой ковчег", ex: "pushup", reps: 15, weapon: "moonreap", chance: 0.02, pity: 50 },
  abyss: { loc: 4, name: "Адский ковчег", ex: "jack", reps: 20, weapon: "abyssheart", chance: 0.015, pity: 60 },
  // Шпиль Самайна: только с боссов башни; открыть труднее (25 приседаний), зато добыча куда щедрее:
  // свои уникальные награды (Тыквенный амулет, облик «Клинок Нетопыря») — 25% и наверняка к 6-му сундуку,
  // легендарное оружие земель и талисманы — чаще, чем в обычных сундуках
  samhain: { loc: 0, spire: true, name: "Сундук Самайна", ex: "squat", reps: 25, uniques: ["pumpkin", "sword_bat"], chance: 0.25, pity: 6 },
  // Штормовое море (5-я земля): с Кракена — всегда, с морских врагов — иногда; Меч Прилива и облик «Новый пират»
  sea: { loc: 5, sea: true, name: "Сундук Прилива", ex: "pushup", reps: 20, uniques: ["tide", "armor_pirate"], chance: 0.2, pity: 8 },
};
export const CHEST_ORDER = ["crypt", "castle", "grave", "abyss", "samhain", "sea"];
export const LAND_CHESTS = ["crypt", "castle", "grave", "abyss", "sea"]; // по номеру земли
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
export const chestFor = (wave) => LAND_CHESTS[locationFor(wave) - 1];

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
export function rollLoot(p, kind, rnd = Math.random, ownsSkin = () => false) {
  const C = CHESTS[kind], loc = C.loc, owned = p.owned || [];
  chestState(p);
  if (C.uniques) return rollUniqueLoot(p, kind, C, rnd, ownsSkin);
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

/** Предмет или облик: облики (sword_*, armor_*) — в покупках лавки, остальное — в вещах героя. */
export const isSkinKey = (key) => !SWORDS[key] && !RELICS[key];

/** Сундуки Самайна и Прилива: щедрый пепел и камни, свои уникальные награды (гарантия), чаще легенды и талисманы. */
function rollUniqueLoot(p, kind, C, rnd, ownsSkin) {
  const owned = p.owned || [];
  const loot = [
    { kind: "ash", n: Math.round(3000 * (1 + rnd())), rarity: "common" },
    { kind: "red", n: 14 + Math.floor(rnd() * 12), rarity: "common" },
  ];
  if (rnd() < 0.7) loot.push({ kind: "blue", n: 1 + (rnd() < 0.4 ? 1 : 0), rarity: "rare" });
  const has = (key) => (isSkinKey(key) ? ownsSkin(key) : owned.includes(key));
  const missing = C.uniques.filter((k) => !has(k));
  if (missing.length) {
    const pity = (p.chestPity[kind] || 0) + 1;
    if (rnd() < C.chance || pity >= C.pity) {
      const key = missing[Math.floor(rnd() * missing.length)];
      loot.push({ kind: isSkinKey(key) ? "skin" : "item", key, rarity: "legendary" });
      p.chestPity[kind] = 0;
    } else {
      p.chestPity[kind] = pity;
    }
  }
  const legends = LAND_CHESTS.map((k) => CHESTS[k].weapon).filter((k) => k && !owned.includes(k)); // у Сундука Прилива нет оружия земли
  if (legends.length && rnd() < 0.08) loot.push({ kind: "item", key: legends[Math.floor(rnd() * legends.length)], rarity: "legendary" });
  const tal = TALISMANS.filter((k) => !owned.includes(k));
  if (tal.length && rnd() < 0.15) loot.push({ kind: "item", key: tal[Math.floor(rnd() * tal.length)], rarity: "epic" });
  return loot;
}

/** Забрать добычу: в запас героя; облик меча — в купленное (grantSkin). */
export function applyLoot(p, loot, grantSkin = () => {}) {
  for (const it of loot) {
    if (it.kind === "skin") grantSkin(it.key);
    if (it.kind === "ash") p.souls += it.n;
    else if (it.kind === "red") p.redGems += it.n;
    else if (it.kind === "blue") p.blueGems += it.n;
    else if (it.kind === "item" && !p.owned.includes(it.key)) p.owned.push(it.key);
  }
}

/** Открыть один сундук: списывает его, возвращает добычу (уже в запасе героя) или null. */
export function openChest(p, kind, rnd = Math.random, skins = null) {
  chestState(p);
  if (!(p.chests[kind] > 0)) return null;
  p.chests[kind] -= 1;
  p.chestsOpened += 1;
  const loot = rollLoot(p, kind, rnd, skins ? (id) => skins.owns(id) : () => false);
  applyLoot(p, loot, skins ? (id) => skins.grant(id) : () => {});
  return loot;
}

/** Сколько уникального оружия сундуков уже у героя. */
export const chestWeapons = (p) => LAND_CHESTS.filter((k) => (p.owned || []).includes(CHESTS[k].weapon)).length;
export const isChestWeapon = (key) => !!(SWORDS[key] && SWORDS[key].chest);
