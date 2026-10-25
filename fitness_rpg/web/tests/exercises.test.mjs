// Тесты мобильного порта распознавания (те же позы, что в tests/test_game.py).
// Запуск: node --test web/tests/
import assert from "node:assert/strict";
import test from "node:test";

import * as ex from "../js/exercises.js";
import { Player } from "../js/player.js";

const blank = () => Array.from({ length: 33 }, () => [0.5, 0.5, 0]);

function standing(kneeDeg = 180, armsUp = false, feetWide = false) {
  const lm = blank();
  const put = (i, x, y) => { lm[i] = [x, y, 0.99]; };
  put(ex.NOSE, 0.5, 0.15);
  put(ex.L_SHOULDER, 0.42, 0.25);
  put(ex.R_SHOULDER, 0.58, 0.25);
  put(ex.L_HIP, 0.45, 0.5);
  put(ex.R_HIP, 0.55, 0.5);
  const thigh = 0.18, bend = ((180 - kneeDeg) * Math.PI) / 180;
  for (const [hip, knee, ankle, sx] of [[ex.L_HIP, ex.L_KNEE, ex.L_ANKLE, -1], [ex.R_HIP, ex.R_KNEE, ex.R_ANKLE, 1]]) {
    const [hx, hy] = lm[hip];
    const spread = feetWide ? 0.12 * sx : 0;
    const kx = hx + spread / 2, ky = hy + thigh;
    put(knee, kx, ky);
    put(ankle, kx + spread / 2 + Math.sin(bend) * thigh, ky + Math.cos(bend) * thigh);
  }
  if (armsUp) {
    put(ex.L_ELBOW, 0.38, 0.12); put(ex.L_WRIST, 0.36, 0.02);
    put(ex.R_ELBOW, 0.62, 0.12); put(ex.R_WRIST, 0.64, 0.02);
  } else {
    put(ex.L_ELBOW, 0.4, 0.38); put(ex.L_WRIST, 0.4, 0.5);
    put(ex.R_ELBOW, 0.6, 0.38); put(ex.R_WRIST, 0.6, 0.5);
  }
  return lm;
}

function plank(elbowDeg) {
  const lm = blank();
  const put = (i, x, y) => { lm[i] = [x, y, 0.99]; };
  for (const [sh, el, wr, hip, knee, ank] of [
    [ex.L_SHOULDER, ex.L_ELBOW, ex.L_WRIST, ex.L_HIP, ex.L_KNEE, ex.L_ANKLE],
    [ex.R_SHOULDER, ex.R_ELBOW, ex.R_WRIST, ex.R_HIP, ex.R_KNEE, ex.R_ANKLE],
  ]) {
    put(sh, 0.3, 0.6); put(hip, 0.6, 0.62); put(knee, 0.75, 0.64); put(ank, 0.9, 0.66);
    put(el, 0.3, 0.75);
    const a = ((180 - elbowDeg) * Math.PI) / 180;
    put(wr, 0.3 - Math.sin(a) * 0.15, 0.75 + Math.cos(a) * 0.15);
  }
  return lm;
}

test("angle", () => {
  assert.ok(Math.abs(ex.angle([1, 0], [0, 0], [0, 1]) - 90) < 1e-9);
});

test("squat rep", () => {
  const d = new ex.ExerciseDetector();
  assert.deepEqual(d.update(standing(175), 0), []);
  assert.deepEqual(d.update(standing(90), 0.5), ["squat_down"]);
  assert.deepEqual(d.update(standing(100), 0.7), []);
  assert.deepEqual(d.update(standing(175), 1.2), ["squat"]);
});

test("half squat is not counted", () => {
  const d = new ex.ExerciseDetector();
  const evs = [175, 130, 175, 130, 175].flatMap((k, t) => d.update(standing(k), t));
  assert.deepEqual(evs, []);
});

test("pushup rep", () => {
  const d = new ex.ExerciseDetector();
  d.update(plank(170), 0);
  assert.equal(d.posture, "планка");
  assert.deepEqual(d.update(plank(80), 0.6), ["pushup_down"]);
  assert.equal(d.low, true);
  assert.deepEqual(d.update(plank(170), 1.2), ["pushup"]);
});

test("jumping jack", () => {
  const d = new ex.ExerciseDetector();
  d.update(standing(), 0);
  assert.deepEqual(d.update(standing(180, true, true), 0.5), []);
  assert.deepEqual(d.update(standing(), 1), ["jack"]);
});

test("debounce", () => {
  const d = new ex.ExerciseDetector();
  d.update(standing(90), 0);
  assert.deepEqual(d.update(standing(175), 0.1), ["squat"]);
  d.update(standing(90), 0.15);
  assert.deepEqual(d.update(standing(175), 0.2), []);
});

test("player level up", () => {
  const p = new Player({ souls: 100 });
  const cost = p.levelCost();
  p.levelUp("strength");
  assert.equal(p.strength, 2);
  assert.equal(p.souls, 100 - cost);
});

import { isBossWave, rewards } from "../js/gear.js";

test("every 5th wave is a boss, bosses give a blue gem", () => {
  assert.deepEqual([...Array(15).keys()].map((i) => i + 1).filter(isBossWave), [5, 10, 15]);
  assert.deepEqual(rewards(1).slice(1), [2, 0]);
  assert.equal(rewards(5)[2], 1);
  assert.ok(rewards(6)[1] > rewards(1)[1]); // алых камней со временем больше
});

test("shop: buy, equip, unique items need blue gems", () => {
  const p = new Player({ redGems: 5 });
  assert.equal(p.buy("steel"), false);
  p.redGems = 6;
  assert.equal(p.buy("steel"), true);
  assert.equal(p.sword, "steel");
  assert.equal(p.damage, 10 + 3 * p.strength + 5);
  p.equip("rusty");
  assert.equal(p.sword, "rusty");
  assert.equal(p.buy("ash"), false);
  p.blueGems = 6;
  assert.ok(p.buy("ash") && p.buy("armor") && p.buy("amulet"));
  assert.equal(p.estusMax, 4);
  assert.equal(p.damageTakenMult, 0.75);
  assert.equal(p.lifesteal, 4);
});

test("old saves without gear load safely", () => {
  const p = new Player({ strength: 3, sword: "bogus", owned: "junk" });
  assert.deepEqual([p.sword, p.owned, p.redGems], ["rusty", ["rusty"], 0]);
});

import { enemyKind, locationFor } from "../js/gear.js";

test("castle location after the 3rd knight: bandits, skeletons and the bandit chief", () => {
  assert.deepEqual([4, 5, 15].map(enemyKind), ["skeleton", "knight", "knight"]);
  assert.deepEqual([locationFor(15), locationFor(16)], [1, 2]);
  const kinds = new Set([...Array(14).keys()].map((i) => enemyKind(16 + i)));
  assert.deepEqual([...kinds].sort(), ["bandit", "chief", "skeleton"]);
  assert.equal(enemyKind(20), "chief");
});

// бокс: рука из стойки у лица резко выпрямляется на уровне плеч
function boxer(rightElbow) {
  const lm = standing();
  const put = (i, x, y) => { lm[i] = [x, y, 0.99]; };
  put(ex.L_ELBOW, 0.38, 0.32); put(ex.L_WRIST, 0.44, 0.2); // левая — в стойке
  const a = (rightElbow * Math.PI) / 180; // плечо (0.58,0.25) → локоть вправо, предплечье под углом
  put(ex.R_ELBOW, 0.7, 0.25);
  put(ex.R_WRIST, 0.7 - Math.cos(a) * 0.12, 0.25 - Math.sin(a) * 0.12);
  return lm;
}

test("бокс: стойка, затем прямой удар — punch", () => {
  const d = new ex.ExerciseDetector();
  assert.deepEqual(d.update(boxer(70), 0), []);
  assert.deepEqual(d.update(boxer(175), 0.2), ["punch"]);
  assert.deepEqual(d.update(boxer(175), 0.4), [], "рука осталась прямой — второй удар не считается");
  d.update(boxer(70), 0.6);
  assert.deepEqual(d.update(boxer(175), 0.8), ["punch"]);
  assert.equal(d.counts.punch, 2);
});

test("звёздочка и приседания — не бокс", () => {
  const d = new ex.ExerciseDetector();
  let t = 0;
  for (let i = 0; i < 3; i++) {
    for (const lm of [standing(180, false, false), standing(180, true, true), standing(80), standing(180)]) {
      assert.ok(!d.update(lm, (t += 0.5)).includes("punch"));
    }
  }
  assert.equal(d.counts.punch, 0);
});
