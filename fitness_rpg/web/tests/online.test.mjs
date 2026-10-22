// Мультиплеер: аккаунт и запросы к api.php (без сети, сервер подменён).
import assert from "node:assert/strict";
import test from "node:test";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };

const { Online, errorText, heroSnapshot } = await import("../js/online.js");
const { Player } = await import("../js/player.js");

function server(handler) {
  const calls = [];
  const fetch = async (url, opt) => {
    const body = JSON.parse(opt.body);
    calls.push(body);
    const [status, json] = handler(body);
    return { ok: status === 200, status, json: async () => json };
  };
  return { calls, fetch };
}

test("login keeps the token, every request carries it, auth error logs out", async () => {
  const srv = server((b) => {
    if (b.action === "login") return [200, { token: "t".repeat(64), account: { id: "a1", login: "gareth", name: "Сэр Гарет", unlocks: [] } }];
    if (b.action === "arena") return b.token ? [200, { rows: [], attempts: 10 }] : [401, { error: "auth" }];
    return [401, { error: "auth" }];
  });
  const o = new Online({ api: "https://ash-a-iron.com/api.php" }, srv.fetch, { offline: false });
  assert.equal(o.loggedIn, false);
  await o.login("gareth", "secret123");
  assert.equal(o.loggedIn, true);
  assert.equal((await o.arena()).attempts, 10);
  assert.equal(srv.calls[1].token, "t".repeat(64));
  assert.equal(new Online({ api: "x" }, srv.fetch, { offline: false }).loggedIn, true, "вход переживает перезапуск");
  await assert.rejects(o.me(), /auth/);
  assert.equal(o.loggedIn, false);
});

test("server errors become readable messages; iOS first build stays offline", async () => {
  const srv = server(() => [404, { error: "bad code" }]);
  const o = new Online({ api: "https://ash-a-iron.com/api.php" }, srv.fetch, { offline: false });
  const e = await o.redeem("ASH-0000").catch((x) => x);
  assert.equal(errorText(e), "Неверный код");
  assert.equal(errorText(new Error("whatever")), "Нет связи с сервером");
  assert.equal(new Online({ api: "https://x/api.php" }, srv.fetch, { offline: true }).configured, false);
});

test("hero snapshot carries the gear and stats a bot needs to play as this hero", () => {
  const p = new Player({ strength: 4, vigor: 3, owned: ["rusty", "giant", "armor"], sword: "giant" });
  const h = heroSnapshot(p, "void");
  assert.deepEqual([h.sword, h.looks, h.skin], ["giant", ["armor"], "void"]);
  assert.equal(h.damage, p.damage);
  assert.equal(h.maxHp, p.maxHp);
  assert.equal(h.taken, 0.75);
});
