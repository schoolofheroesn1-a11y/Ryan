import test from "node:test";
import assert from "node:assert/strict";
import { CHESTS, CHEST_ORDER, addChest, chestFor, chestWeapons, openChest, rollDrop } from "../js/chests.js";
import { SWORDS } from "../js/gear.js";
import { Player } from "../js/player.js";

test("у каждой земли свой сундук и своё оружие; дальше — больше повторений", () => {
  assert.deepEqual([1, 16, 31, 46].map(chestFor), CHEST_ORDER.slice(0, 4));
  const reps = CHEST_ORDER.slice(0, 4).map((k) => CHESTS[k].reps);
  assert.deepEqual([...reps].sort((a, b) => a - b), reps);
  for (const k of CHEST_ORDER.slice(0, 4)) assert.equal(SWORDS[CHESTS[k].weapon].chest, k);
});

test("сундук: с босса всегда, с обычного врага — иногда", () => {
  assert.equal(rollDrop(5, true, () => 0.99), "crypt");
  assert.equal(rollDrop(47, false, () => 0.99), null);
  assert.equal(rollDrop(47, false, () => 0.01), "abyss");
});

test("открытие: списывает сундук, кладёт добычу; оружие нельзя купить", () => {
  const p = new Player({ souls: 0, redGems: 0, blueGems: 0 });
  assert.equal(openChest(p, "crypt"), null);
  addChest(p, "crypt", 2);
  const loot = openChest(p, "crypt", () => 0.5);
  assert.equal(p.chests.crypt, 1);
  assert.ok(p.souls > 0 && p.redGems > 0);
  assert.ok(loot.every((it) => it.rarity));
  assert.equal(p.buy("bonewail"), false);
});

test("уникальное оружие: редко, но на pity-м сундуке — наверняка, и только один раз", () => {
  const p = new Player();
  addChest(p, "grave", 200);
  let got = 0, opened = 0;
  while (!p.owned.includes("moonreap")) { openChest(p, "grave", () => 0.9); opened += 1; }
  assert.equal(opened, CHESTS.grave.pity);
  assert.equal(chestWeapons(p), 1);
  for (let i = 0; i < 30; i++) got += openChest(p, "grave", () => 0.001).filter((it) => it.key === "moonreap").length;
  assert.equal(got, 0, "второй раз не выпадает");
});

test("сундуки и счётчики сохраняются со старыми сохранениями", () => {
  const p = new Player({ chests: { crypt: 3 }, chestPity: { crypt: 7 } });
  assert.equal(p.chests.crypt, 3);
  assert.equal(new Player({}).chests.crypt || 0, 0);
});

test("сундук Самайна: 25 приседаний, уникальные награды не позже 6-го сундука", async () => {
  const { Player } = await import("../js/player.js");
  const p = new Player();
  const skins = new Set();
  const store = { owns: (id) => skins.has(id), grant: (id) => skins.add(id) };
  assert.equal(CHESTS.samhain.reps, 25);
  addChest(p, "samhain", 12);
  const got = [];
  for (let i = 0; i < 12; i++) {
    const loot = openChest(p, "samhain", () => 0.99, store); // «невезучий» генератор: только гарантия
    for (const it of loot) if (it.rarity === "legendary") got.push([i + 1, it.key]);
  }
  assert.deepEqual(got.map((g) => g[0]), [6, 12]);
  assert.ok(p.owned.includes("pumpkin") || skins.has("sword_bat"));
  assert.ok(p.owned.includes("pumpkin") && skins.has("sword_bat"));
});

test("сундук Самайна щедрее сундука Бездны", async () => {
  const { Player } = await import("../js/player.js");
  let a = 0, b = 0;
  for (let i = 0; i < 200; i++) {
    const p = new Player();
    addChest(p, "samhain");
    addChest(p, "abyss");
    a += openChest(p, "samhain").find((x) => x.kind === "ash").n;
    b += openChest(p, "abyss").find((x) => x.kind === "ash").n;
  }
  assert.ok(a > b);
});

test("Сундук Прилива: Меч Прилива и облик пирата не позже 8-го сундука", async () => {
  const { Player } = await import("../js/player.js");
  const p = new Player();
  const skins = new Set();
  const store = { owns: (id) => skins.has(id), grant: (id) => skins.add(id) };
  addChest(p, "sea", 16);
  const got = [];
  for (let i = 0; i < 16; i++) for (const it of openChest(p, "sea", () => 0.99, store)) if (it.rarity === "legendary") got.push(i + 1);
  assert.deepEqual(got, [8, 16]);
  assert.ok(p.owned.includes("tide") && skins.has("armor_pirate"));
  assert.equal(SWORDS.tide.chest, "sea");
});
