// Банк упражнений: новые упражнения распознаются по позам и переводятся в события игры.
import assert from "node:assert/strict";
import test from "node:test";

import * as ex from "../js/exercises.js";

const blank = () => Array.from({ length: 33 }, () => [0.5, 0.5, 0]);
const pose = (pts) => { const lm = blank(); for (const [i, x, y] of pts) lm[i] = [x, y, 0.99]; return lm; };
const legs = (hipY = 0.6, lKnee = [0.45, 0.78], rKnee = [0.55, 0.78], lAnk = [0.45, 0.95], rAnk = [0.55, 0.95]) => [
  [ex.L_HIP, 0.45, hipY], [ex.R_HIP, 0.55, hipY], [ex.L_KNEE, ...lKnee], [ex.R_KNEE, ...rKnee], [ex.L_ANKLE, ...lAnk], [ex.R_ANKLE, ...rAnk]];

// вис на турнике: кисти над головой, руки прямые
const hang = () => pose([[ex.NOSE, 0.5, 0.28], [ex.L_SHOULDER, 0.42, 0.35], [ex.R_SHOULDER, 0.58, 0.35],
  [ex.L_ELBOW, 0.4, 0.22], [ex.R_ELBOW, 0.6, 0.22], [ex.L_WRIST, 0.38, 0.1], [ex.R_WRIST, 0.62, 0.1], ...legs(0.62)]);
// подтянулся: локти согнуты, голова у кистей
const top = () => pose([[ex.NOSE, 0.5, 0.12], [ex.L_SHOULDER, 0.42, 0.18], [ex.R_SHOULDER, 0.58, 0.18],
  [ex.L_ELBOW, 0.32, 0.26], [ex.R_ELBOW, 0.68, 0.26], [ex.L_WRIST, 0.38, 0.08], [ex.R_WRIST, 0.62, 0.08], ...legs(0.45)]);
// брусья: кисти ниже плеч
const dipTop = () => pose([[ex.NOSE, 0.5, 0.2], [ex.L_SHOULDER, 0.42, 0.3], [ex.R_SHOULDER, 0.58, 0.3],
  [ex.L_ELBOW, 0.42, 0.43], [ex.R_ELBOW, 0.58, 0.43], [ex.L_WRIST, 0.42, 0.55], [ex.R_WRIST, 0.58, 0.55], ...legs(0.6)]);
const dipLow = () => pose([[ex.NOSE, 0.5, 0.28], [ex.L_SHOULDER, 0.42, 0.38], [ex.R_SHOULDER, 0.58, 0.38],
  [ex.L_ELBOW, 0.32, 0.4], [ex.R_ELBOW, 0.68, 0.4], [ex.L_WRIST, 0.4, 0.55], [ex.R_WRIST, 0.6, 0.55], ...legs(0.68)]);
const upper = [[ex.NOSE, 0.5, 0.15], [ex.L_SHOULDER, 0.42, 0.25], [ex.R_SHOULDER, 0.58, 0.25],
  [ex.L_ELBOW, 0.4, 0.38], [ex.R_ELBOW, 0.6, 0.38], [ex.L_WRIST, 0.4, 0.5], [ex.R_WRIST, 0.6, 0.5]];
const stand = () => pose([...upper, ...legs(0.5, [0.45, 0.68], [0.55, 0.68], [0.45, 0.86], [0.55, 0.86])]);
// выпад: левое колено согнуто под прямым углом, правое прямое
const lunge = () => pose([...upper, ...legs(0.5, [0.45, 0.68], [0.55, 0.68], [0.63, 0.68], [0.55, 0.86])]);
// высокое колено: левое у пояса, правое внизу (и наоборот)
const kneeL = () => pose([...upper, ...legs(0.5, [0.42, 0.49], [0.55, 0.68], [0.42, 0.66], [0.55, 0.86])]);
const kneeR = () => pose([...upper, ...legs(0.5, [0.45, 0.68], [0.58, 0.49], [0.45, 0.86], [0.58, 0.66])]);
const plank = () => pose([[ex.L_SHOULDER, 0.3, 0.6], [ex.R_SHOULDER, 0.3, 0.6], [ex.L_HIP, 0.6, 0.62], [ex.R_HIP, 0.6, 0.62],
  [ex.L_KNEE, 0.75, 0.64], [ex.R_KNEE, 0.75, 0.64], [ex.L_ANKLE, 0.9, 0.66], [ex.R_ANKLE, 0.9, 0.66],
  [ex.L_ELBOW, 0.3, 0.75], [ex.R_ELBOW, 0.3, 0.75], [ex.L_WRIST, 0.3, 0.9], [ex.R_WRIST, 0.3, 0.9]]);

const run = (bank, frames) => {
  const d = new ex.ExerciseDetector();
  d.bank = ex.cleanBank(bank);
  return frames.flatMap((f, i) => d.update(f, i * 0.5));
};

test("подтягивания: вис → подтянулся = повтор, без виса — нет", () => {
  assert.deepEqual(run({ attack: "pullup" }, [hang(), top(), hang(), top()]).filter((e) => e === "pullup").length, 2);
  assert.equal(run({ attack: "pullup" }, [top(), top()]).filter((e) => e === "pullup").length, 0);
  assert.equal(run({}, [hang(), top()]).filter((e) => e === "pullup").length, 0, "не выбрано — не распознаётся");
});

test("брусья: прямые руки → 90° → прямые", () => {
  assert.equal(run({ attack: "dip" }, [dipTop(), dipLow(), dipTop(), dipLow(), dipTop()]).filter((e) => e === "dip").length, 2);
});

test("выпады: lunge_down на шаге вниз, lunge — когда встал", () => {
  const evs = run({ dodge: "lunge" }, [stand(), lunge(), stand()]);
  assert.ok(evs.includes("lunge_down") && evs.includes("lunge"));
});

test("высокие колени: левое и правое по очереди — повтор", () => {
  assert.equal(run({ heal: "highknee" }, [stand(), kneeL(), stand(), kneeR(), stand(), kneeL(), stand(), kneeR()]).filter((e) => e === "highknee").length, 2);
  assert.equal(run({ heal: "highknee" }, [stand(), kneeL(), stand(), kneeL()]).filter((e) => e === "highknee").length, 0, "одна нога — не считается");
});

test("бёрпи: стоя → упор лёжа → стоя", () => {
  assert.equal(run({ heal: "burpee" }, [stand(), plank(), stand(), plank(), stand()]).filter((e) => e === "burpee").length, 2);
});

test("банк переводит упражнения в события игры; невыбранные не считаются", () => {
  const bank = { attack: "pullup", dodge: "lunge", heal: "burpee" };
  assert.deepEqual(ex.mapBank(["pullup", "pushup", "lunge_down", "lunge", "squat_down", "burpee", "jack", "punch"], bank),
    ["pushup", "squat_down", "squat", "jack", "punch"]);
  assert.deepEqual(ex.mapBank(["pushup", "pushup_down", "squat_down", "squat", "jack"], {}), ["pushup", "pushup_down", "squat_down", "squat", "jack"]);
  assert.deepEqual(ex.cleanBank({ attack: "hack", dodge: "lunge" }), { attack: "pushup", dodge: "lunge", heal: "jack" });
  ex.setBank(bank);
  assert.deepEqual([ex.NAMES.pushup, ex.NAMES.squat, ex.NAMES.jack], ["Подтягивания", "Выпады", "Бёрпи"]);
  ex.setBank(ex.DEFAULT_BANK);
  assert.equal(ex.NAMES.pushup, "Отжимания");
});
