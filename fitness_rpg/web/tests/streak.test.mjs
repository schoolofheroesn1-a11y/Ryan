import test from "node:test";
import assert from "node:assert/strict";
import { Streak, daysBetween, shiftDay, FLAME_TIERS } from "../js/streak.js";

test("огонёк за день: враг — 1, босс — до 2, больше 2 в день нельзя", () => {
  const s = new Streak();
  assert.deepEqual(s.award(false, "2026-10-01"), { add: 1, fresh: true });
  assert.deepEqual(s.award(false, "2026-10-01"), { add: 0, fresh: false });
  assert.deepEqual(s.award(true, "2026-10-01"), { add: 1, fresh: false });
  assert.deepEqual(s.award(true, "2026-10-01"), { add: 0, fresh: false });
  assert.equal(s.points, 2);
  assert.equal(s.days, 1);
  assert.deepEqual(s.award(true, "2026-10-02"), { add: 2, fresh: true });
  assert.equal(s.points, 4);
  assert.equal(s.days, 2);
});

test("пропущенный день — пламя гаснет, сгоревшая серия запоминается", () => {
  const s = new Streak();
  s.award(false, "2026-10-01");
  s.award(true, "2026-10-02");
  assert.equal(s.refresh("2026-10-03"), false); // сегодня ещё можно зажечь
  assert.ok(s.fading("2026-10-03"));
  assert.equal(s.refresh("2026-10-04"), true);
  assert.equal(s.points, 0);
  assert.equal(s.lost, 3);
  assert.equal(s.best, 3);
  s.award(false, "2026-10-04");
  assert.equal(s.points, 1);
  assert.equal(s.days, 1);
});

test("ступени пламени и сохранение", () => {
  const s = new Streak({ points: 16 });
  assert.equal(FLAME_TIERS[s.tier][1], "Костёр");
  assert.equal(new Streak({ points: 0 }).tier, 0);
  const back = new Streak(JSON.parse(JSON.stringify(s.toJSON())));
  assert.equal(back.points, 16);
});

test("даты: через границу месяца и года", () => {
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  const s = new Streak();
  for (let i = 0; i < 20; i++) s.award(false, shiftDay("2026-01-01", i));
  assert.ok(Object.keys(s.hist).length <= 14);
  assert.equal(s.days, 20);
});
