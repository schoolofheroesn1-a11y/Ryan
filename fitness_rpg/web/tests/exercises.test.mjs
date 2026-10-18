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
  assert.deepEqual(d.update(plank(80), 0.6), []);
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
