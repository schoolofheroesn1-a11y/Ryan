import { test } from "node:test";
import assert from "node:assert/strict";
import { GIFTS, MAX_ESTUS, applyGift, emptyMods, floorChest, floorPlan, floorReward, floorWave, offerGifts } from "../js/tower.js";

test("Королева — каждый 13-й этаж, элита — каждый 5-й", () => {
  assert.equal(floorPlan(13).kind, "eyequeen");
  assert.equal(floorPlan(26).queen, true);
  assert.deepEqual([5, 10, 15].map((f) => floorPlan(f).kind), ["knight", "chief", "wraith"]);
  assert.equal(floorPlan(20).kind, "knight");
  for (let f = 1; f < 13; f++) if (f % 5) assert.equal(floorPlan(f, 7).boss, false);
});

test("этаж с одним сидом — тот же враг; Пухоглот встречается часто", () => {
  assert.deepEqual(floorPlan(3, 42), floorPlan(3, 42));
  let fluff = 0, n = 0;
  for (let seed = 1; seed < 60; seed++) for (const f of [1, 2, 3, 4, 6, 7]) {
    n++;
    if (floorPlan(f, seed).kind === "fluff") fluff++;
  }
  assert.ok(fluff / n > 0.25 && fluff / n < 0.55, `доля Пухоглотов ${fluff / n}`);
  for (let seed = 1; seed < 40; seed++) assert.ok(!["imp", "hound", "husk"].includes(floorPlan(2, seed).kind)); // демоны — выше 6-го
});

test("сила растёт с этажом", () => {
  assert.equal(floorWave(1), 1);
  assert.ok(floorWave(13) > floorWave(12));
});

test("три разных дара; лечение не предлагается при полном здоровье", () => {
  for (let seed = 1; seed < 50; seed++) {
    const g = offerGifts(seed % 9 + 1, seed, { hpFrac: 1, estus: MAX_ESTUS });
    assert.equal(g.length, 3);
    assert.equal(new Set(g).size, 3);
    assert.ok(!g.includes("heal") && !g.includes("potion"));
    assert.ok(g.every((id) => GIFTS.some((x) => x[0] === id)));
  }
});

test("дары меняют забег", () => {
  const run = { hp: 50, estus: 2, mods: emptyMods() };
  assert.equal(applyGift("heal", run, 100).hp, 100);
  assert.equal(applyGift("potion", { ...run, estus: MAX_ESTUS }, 100).estus, MAX_ESTUS);
  const v = applyGift("vigor", run, 100);
  assert.equal(v.mods.hp, 0.2);
  assert.equal(v.hp, 70);
  const p = applyGift("pact", { ...run, hp: 100 }, 100);
  assert.equal(p.hp, 85);
  assert.ok(Math.abs(p.mods.dmg - 0.35) < 1e-9);
  assert.equal(run.mods.dmg, 0); // исходный забег не меняется
});

test("награды и сундуки", () => {
  const [a1] = floorReward(1), [a2] = floorReward(2);
  assert.ok(a2 > a1);
  assert.equal(floorReward(13)[2], 2);
  assert.equal(floorReward(5)[2], 1);
  assert.equal(floorReward(4)[2], 0);
  assert.equal(floorChest(4), null);
  assert.equal(floorChest(5), "crypt");
  assert.equal(floorChest(13), "grave");
});
