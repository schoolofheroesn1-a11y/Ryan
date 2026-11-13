import { test } from "node:test";
import assert from "node:assert/strict";
import { EMERGE_TIME, KRAKEN_RHYME, VOYAGE, emergeState, seaChest, seaReward, seaWave } from "../js/sea.js";

test("поход: пять стычек и Кракен в конце", () => {
  assert.equal(VOYAGE.length, 6);
  assert.equal(VOYAGE.at(-1), "kraken");
  assert.equal(KRAKEN_RHYME.length, 4);
});

test("сила от передовой, Кракен сильнее, награда за Кракена — синие камни и сундук", () => {
  assert.equal(seaWave(0, 1), 8);
  assert.equal(seaWave(0, 30), 30);
  assert.ok(seaWave(5, 30) > seaWave(4, 30));
  assert.equal(seaReward(5, 20)[2], 2);
  assert.equal(seaChest(5, () => 0.99), "sea");
  assert.equal(seaChest(0, () => 0.99), null);
  assert.equal(seaChest(0, () => 0.01), "sea");
});

test("появление: строки по очереди, щупальца, потом голова и глаза", () => {
  const s0 = emergeState(0), s1 = emergeState(3), s2 = emergeState(7.5);
  assert.deepEqual(s0.lines, [0, 0, 0, 0]);
  assert.ok(s1.lines[0] === 1 && s1.lines[1] === 1 && s1.lines[3] === 0);
  assert.ok(s1.tentacles[0] === 1 && s1.head === 0);
  assert.ok(s2.head === 1 && s2.eyes && s2.lines.every((x) => x === 1));
  assert.ok(!s2.done && emergeState(EMERGE_TIME).done);
});
