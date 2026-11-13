import { test } from "node:test";
import assert from "node:assert/strict";
import { EMERGE_TIME, KRAKEN_RHYME, emergeState } from "../js/sea.js";
import { LAST_LOCATION, LOCATIONS, SEA_FROM_WAVE, enemyKind, locationFor, locationStart } from "../js/gear.js";
import { chestFor } from "../js/chests.js";

test("Штормовое море — пятая земля приключения после Алой Бездны", () => {
  assert.equal(LAST_LOCATION, 5);
  assert.equal(LOCATIONS[5].bg, "sea_bg");
  assert.deepEqual([locationFor(60), locationFor(61), locationFor(200)], [4, 5, 5]);
  assert.equal(locationStart(5), SEA_FROM_WAVE);
  assert.equal(enemyKind(60), "seraph");
  assert.equal(enemyKind(65), "kraken");
  const kinds = new Set([61, 62, 63, 64, 66, 67].map(enemyKind));
  assert.deepEqual([...kinds].sort(), ["crab", "drowned", "naga"]);
  assert.equal(chestFor(61), "sea");
  assert.equal(chestFor(50), "abyss");
  assert.equal(KRAKEN_RHYME.length, 4);
});

test("появление: строки по очереди, щупальца, потом голова и глаза", () => {
  const s0 = emergeState(0), s1 = emergeState(3), s2 = emergeState(7.5);
  assert.deepEqual(s0.lines, [0, 0, 0, 0]);
  assert.ok(s1.lines[0] === 1 && s1.lines[1] === 1 && s1.lines[3] === 0);
  assert.ok(s1.tentacles[0] === 1 && s1.head === 0);
  assert.ok(s2.head === 1 && s2.eyes && s2.lines.every((x) => x === 1));
  assert.ok(!s2.done && emergeState(EMERGE_TIME).done);
});

test("в сундуках с уникальными наградами нет пустых предметов (у Сундука Прилива нет оружия земли)", async () => {
  const { rollLoot } = await import("../js/chests.js");
  for (const kind of ["samhain", "sea"]) {
    for (let i = 0; i < 300; i++) {
      const p = { owned: [], chests: {}, chestPity: {} };
      let s = i + 1;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (const it of rollLoot(p, kind, rnd)) if (it.kind === "item" || it.kind === "skin") assert.ok(it.key, `${kind}: пустой предмет`);
    }
  }
});
