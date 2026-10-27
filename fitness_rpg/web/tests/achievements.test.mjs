import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, ACH, achContext, achProgress, battleEvents, checkAchievements } from "../js/achievements.js";

const player = (o = {}) => ({ totalReps: { pushup: 0, squat: 0, jack: 0 }, plankSeconds: 0, wave: 1, frontier: 1, bossesDefeated: 0, level: 1, owned: ["rusty"], ...o });
const profile = (days = 0, best = 0) => ({ streak: { days, best, points: best } });

test("у каждого достижения есть титул, id не повторяются", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.title && a.name && a.desc, a.id);
  assert.ok(ACHIEVEMENTS.length >= 25);
});

test("счётные открываются по статистике, один раз", () => {
  const ach = {};
  const ctx = achContext(player({ totalReps: { pushup: 1200, squat: 10, jack: 0 }, plankSeconds: 700 }), profile(7, 20));
  const fresh = checkAchievements(ach, ctx, [], "2026-10-27").map((a) => a.id).sort();
  assert.deepEqual(fresh, ["plank10", "push100", "push1000", "streak3", "streak7"]);
  assert.equal(checkAchievements(ach, ctx).length, 0);
  assert.deepEqual(achProgress(ACH.push5000, ctx, false), [1200, 5000]);
});

test("подвиги боя", () => {
  const ev = battleEvents({ tookDamage: false, time: 5, hpFrac: 0.05, boss: true, potions: 0, kind: "seraph", hard: true, hour: 3 });
  for (const id of ["flawless", "fast", "clutch", "boss_nopot", "seraph", "seraph_nopot", "hard_boss", "night"]) assert.ok(ev.includes(id), id);
  assert.deepEqual(battleEvents({ tookDamage: true, time: 30, hpFrac: 0.5, boss: false, potions: 2, kind: "imp", hard: false, hour: 14 }), []);
  const ach = {};
  assert.deepEqual(checkAchievements(ach, achContext(player(), profile()), ["fast"]).map((a) => a.id), ["fast"]);
});
