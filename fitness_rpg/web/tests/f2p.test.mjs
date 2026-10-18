// Рейтинг (онлайн, без сети, без сервера), профиль и тестовые покупки.
import assert from "node:assert/strict";
import test from "node:test";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};

const { Leaderboard } = await import("../js/leaderboard.js");
const { Profile, cleanName } = await import("../js/profile.js");
const { Store } = await import("../js/store.js");
const { Player } = await import("../js/player.js");

const CFG = { url: "https://x.supabase.co", anonKey: "anon", table: "leaderboard" };

function fakeServer() {
  const rows = new Map([["other", { player_id: "other", name: "Соперник", bosses: 2, level: 9, wave: 11 }]]);
  let up = true;
  const fetch = async (url, opts = {}) => {
    if (!up) throw new TypeError("Failed to fetch");
    if (opts.method === "POST") {
      const r = JSON.parse(opts.body);
      rows.set(r.player_id, r);
      return { ok: true, status: 201, json: async () => null, headers: new Map() };
    }
    const list = [...rows.values()].sort((a, b) => b.bosses - a.bosses || b.level - a.level);
    return { ok: true, status: 200, json: async () => list, headers: new Map() };
  };
  return { rows, fetch, setUp: (v) => { up = v; } };
}

test("no server configured: game shows only own result", async () => {
  mem.clear();
  const lb = new Leaderboard({ url: "", anonKey: "", table: "leaderboard" }, null);
  const p = new Profile({ name: "Тест" });
  const res = await lb.top(p);
  assert.equal(res.source, "local");
  assert.equal(res.rows[0].name, "Тест");
});

test("online: submit and top", async () => {
  mem.clear();
  const srv = fakeServer();
  const lb = new Leaderboard(CFG, srv.fetch);
  const p = new Profile({ name: "Рыцарь" });
  p.record(new Player({ bossesDefeated: 3, strength: 4, wave: 16 }));
  assert.equal(await lb.submit(p), true);
  const res = await lb.top(p);
  assert.equal(res.source, "online");
  assert.equal(res.rows[0].name, "Рыцарь");
  assert.equal(res.rank, 1);
});

test("offline: result waits in queue, cached table is shown, then syncs", async () => {
  mem.clear();
  const srv = fakeServer();
  const lb = new Leaderboard(CFG, srv.fetch);
  const p = new Profile({ name: "Беглец" });
  await lb.top(p); // кэшируем таблицу, пока сеть есть
  srv.setUp(false);
  p.record(new Player({ bossesDefeated: 5, wave: 26 }));
  assert.equal(await lb.submit(p), false);
  const offline = await lb.top(p);
  assert.equal(offline.source, "cache");
  assert.equal(offline.pending, true);
  assert.equal(offline.rows[0].name, "Беглец"); // свой свежий результат виден сразу
  // очередь переживает перезапуск игры
  const again = new Leaderboard(CFG, srv.fetch);
  assert.equal(again.pending.bosses, 5);
  srv.setUp(true);
  assert.equal(await again.flush(), true);
  assert.equal(srv.rows.get(p.id).bosses, 5);
});

test("best result never goes down after a new game", () => {
  const p = new Profile({});
  p.record(new Player({ bossesDefeated: 4, strength: 6, wave: 21 }));
  assert.equal(p.record(new Player()), false);
  assert.equal(p.best.bosses, 4);
});

test("names are cleaned for the public leaderboard", () => {
  assert.equal(cleanName("  Сэр <b>Ланс</b>!!  "), "Сэр bЛансb");
  assert.equal(cleanName("a"), null);
  assert.equal(cleanName("fuck you"), null);
  assert.equal(cleanName("x".repeat(40)).length, 16);
});

test("test store: purchase only after confirmation, persists", async () => {
  mem.clear();
  let answer = false;
  const store = new Store(async () => answer);
  const item = { id: "sword_void", name: "Клинок Бездны" };
  assert.equal(await store.buy(item), false);
  assert.equal(store.owns("sword_void"), false);
  answer = true;
  assert.equal(await store.buy(item), true);
  assert.equal(new Store(async () => false).owns("sword_void"), true);
  assert.deepEqual(await store.restore(), ["sword_void"]);
});
