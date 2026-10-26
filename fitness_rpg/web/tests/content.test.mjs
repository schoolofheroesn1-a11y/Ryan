// Перевод интерфейса, кладбище, новое оружие и доспех Короля-Призрака (логика без отрисовки).
import assert from "node:assert/strict";
import test from "node:test";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};

const { setLang, tr, tf, getLang } = await import("../js/i18n.js");
const { SWORDS, RELICS, SHOP_ORDER, enemyKind, locationFor, priceText, isBossWave } = await import("../js/gear.js");
const { Player } = await import("../js/player.js");

test("i18n: Russian is untouched, English translates exact, numeric and named strings", () => {
  setLang("ru");
  assert.equal(getLang(), "ru");
  assert.equal(tr("Пепел: 100"), "Пепел: 100");
  setLang("en");
  assert.equal(tr("Настройки"), "Settings");
  assert.equal(tr("Пепел: 100"), "Ash: 100");
  assert.equal(tr("КУПИТЬ ЗА 0,99 $"), "BUY FOR 0,99 $");
  assert.equal(tr("12 КРИТ!"), "12 CRIT!");
  assert.equal(tf("Куплено: {name}!", { name: "Гриф от штанги" }), "Bought: Barbell!");
  assert.equal(tr("Рыцарь-1A2B"), "Knight-1A2B");
  assert.equal(tr("Сэр Гарет"), "Сэр Гарет", "имена игроков не переводятся");
  assert.equal(tr("Already English"), "Already English");
  setLang("ru");
});

test("graveyard after the 3rd bandit chief: zombies, bats, skeletons and the Wraith King", () => {
  assert.deepEqual([locationFor(30), locationFor(31)], [2, 3]);
  assert.equal(enemyKind(30), "chief");
  const kinds = new Set([...Array(14).keys()].map((i) => enemyKind(31 + i)));
  assert.deepEqual([...kinds].sort(), ["bat", "skeleton", "wraith", "zombie"]);
  for (const w of [35, 40, 45]) assert.ok(isBossWave(w) && enemyKind(w) === "wraith");
});

test("new weapons and the Wraith King armor are in the forge", () => {
  for (const k of ["giant", "radiator", "barbell", "kingarmor"]) assert.ok(SHOP_ORDER.includes(k), k);
  assert.ok(SWORDS.giant.stun > 0 && SWORDS.giant.stun < 0.3, "ошеломление срабатывает нечасто");
  assert.equal(SWORDS.radiator.burn, 6);
  assert.deepEqual(RELICS.kingarmor.price, [0, 7]);
  assert.equal(priceText("barbell"), "10 $");
});

test("barbell is paid only: gems cannot buy it, the store grants it", () => {
  const p = new Player({ redGems: 999, blueGems: 99 });
  assert.equal(p.buy("barbell"), false);
  assert.ok(!p.owned.includes("barbell"));
  assert.equal(p.grantPaid("barbell"), true);
  assert.equal(p.sword, "barbell");
  assert.equal(p.grantPaid("steel"), false, "бесплатное оружие так не выдаётся");
});

test("Wraith King armor: -35% damage taken and replaces the Bone Knight armor", () => {
  const p = new Player({ blueGems: 8 });
  assert.equal(p.damageTakenMult, 1);
  p.owned.push("armor");
  p.equip("armor");
  assert.equal(p.damageTakenMult, 0.75);
  assert.equal(p.buy("kingarmor"), true);
  assert.equal(p.damageTakenMult, 0.65);
  assert.equal(p.blueGems, 1);
});

test("only one armor is worn at a time and can be switched", () => {
  const p = new Player({ owned: ["rusty", "armor", "kingarmor", "wingarmor", "amulet"] });
  assert.equal(p.armor, "wingarmor", "старое сохранение: надет самый крепкий");
  assert.deepEqual(p.worn, ["rusty", "wingarmor", "amulet"]);
  assert.equal(p.damageTakenMult, 0.55);
  p.equip("armor");
  assert.deepEqual(p.worn, ["rusty", "armor", "amulet"]);
  assert.equal(p.damageTakenMult, 0.75);
});

test("talismans: one worn at a time; wind regen, vampire fang, ember amulet", () => {
  const p = new Player({ blueGems: 20, owned: ["rusty", "amulet"] });
  assert.equal(p.talisman, "amulet", "старое сохранение: надет Амулет Углей");
  const base = p.staminaRegen, estus = p.estusMax;
  assert.equal(p.buy("windcharm"), true);
  assert.equal(p.talisman, "windcharm");
  assert.equal(p.staminaRegen, base * 1.5);
  assert.equal(p.estusMax, estus - 1, "амулет снят — фляг меньше");
  assert.equal(p.vampire, 0);
  assert.equal(p.buy("fang"), true);
  assert.equal(p.vampire, 0.1);
  assert.equal(p.staminaRegen, base);
  assert.deepEqual(p.worn, ["rusty", "fang"]);
  p.equip("amulet");
  assert.equal(p.estusMax, estus);
});
