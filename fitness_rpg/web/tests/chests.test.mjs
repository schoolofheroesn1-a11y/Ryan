import test from "node:test";
import assert from "node:assert/strict";
import { CHESTS, CHEST_ORDER, addChest, chestFor, chestWeapons, openChest, rollDrop } from "../js/chests.js";
import { SWORDS } from "../js/gear.js";
import { Player } from "../js/player.js";

test("у каждой земли свой сундук и своё оружие; дальше — больше повторений", () => {
  assert.deepEqual([1, 16, 31, 46].map(chestFor), CHEST_ORDER);
  const reps = CHEST_ORDER.map((k) => CHESTS[k].reps);
  assert.deepEqual([...reps].sort((a, b) => a - b), reps);
  for (const k of CHEST_ORDER) assert.equal(SWORDS[CHESTS[k].weapon].chest, k);
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
