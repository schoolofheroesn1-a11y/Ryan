import { test } from "node:test";
import assert from "node:assert/strict";
import { MOVES, buttonsScale, extraHits, minWind, moveTable, pickMove, windFor } from "../js/moves.js";

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test("с камерой обычные враги бьют только обычным ударом", () => {
  for (const k of ["skeleton", "knight", "zombie", "seraph"]) assert.deepEqual(moveTable(k, 20, false).map((m) => m[0]), ["strike"]);
});

test("без камеры — быстрые, тяжёлые удары, серии и финты", () => {
  const ids = moveTable("skeleton", 10, true).map((m) => m[0]);
  for (const id of ["strike", "quick", "heavy", "flurry", "feint"]) assert.ok(ids.includes(id), id);
  assert.ok(!moveTable("skeleton", 1, true).some((m) => m[0] === "feint")); // финты — не с первого боя
});

test("у вампира четыре приёма в обоих режимах; в ярости кусает чаще", () => {
  assert.deepEqual(moveTable("vampire", 12, false).map((m) => m[0]), ["claw", "bite", "swarm", "mist"]);
  const w = (en) => moveTable("vampire", 12, false, true, en).find((m) => m[0] === "bite")[1];
  assert.ok(w(true) > w(false));
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pickMove("vampire", 12, false, true));
  assert.equal(seen.size, 4);
});

test("тыквоголов бросает бомбы", () => {
  assert.equal(pickMove("pumpkin", 3, false, false, false, seq(0.99)), "bomb");
  assert.ok(MOVES.bomb.burn > 0);
});

test("замах не короче минимума; с камерой — не меньше секунды", () => {
  assert.equal(windFor("quick", 0.5, true), minWind(true));
  assert.ok(windFor("quick", 2, false) >= 1);
  assert.ok(windFor("heavy", 1.2, true) > windFor("strike", 1.2, true));
});

test("серии: стая мышей и серия — 3–4 удара", () => {
  for (const r of [0, 0.5, 0.99]) {
    const n = extraHits("swarm", () => r);
    assert.ok(n >= 2 && n <= 3);
  }
  assert.equal(extraHits("strike"), 0);
});

test("без камеры враги крепче с каждым раундом", () => {
  assert.ok(buttonsScale(1).hp > 1.2);
  assert.ok(buttonsScale(40).hp > buttonsScale(1).hp);
  assert.ok(buttonsScale(60).wind >= 0.85 && buttonsScale(1).wind <= 1.25);
});

test("Полуночный Охотник: в Полночь — пике и ночная охота", () => {
  const day = moveTable("stalker", 20, false, true, false).map((m) => m[0]);
  const night = moveTable("stalker", 20, false, true, true).map((m) => m[0]);
  assert.ok(!day.includes("dive") && night.includes("dive") && night.includes("frenzy"));
  assert.ok(MOVES.howl.fear > 0 && MOVES.dive.armor);
});
