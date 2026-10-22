// Проверка leaderboard.php на настоящем PHP: см. server/README.md (php -S + SQLite).
import assert from "node:assert/strict";
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
const { Leaderboard } = await import("../web/js/leaderboard.js");
const API = process.env.LB_API || "http://127.0.0.1:8799/leaderboard.php";
const cfg = { api: API, url: "", anonKey: "", table: "leaderboard" };
const prof = (id, name, bosses, level, wave) => ({ id, name, best: { bosses, level, wave } });
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const lb = new Leaderboard(cfg, fetch, { offline: false });
assert.equal(await lb.submit(prof(A, "Сэр Гарет", 3, 20, 30)), true);
let t = await lb.top(prof(A, "Сэр Гарет", 3, 20, 30));
assert.equal(t.source, "online"); assert.equal(t.rank, 1); assert.equal(t.rows[0].name, "Сэр Гарет");
// другой игрок выше
mem.delete("ash-and-iron-lb-secret");
const lb2 = new Leaderboard(cfg, fetch, { offline: false });
await lb2.submit(prof(B, "<b>Хакер</b>", 5, 1, 1));
t = await lb.top(prof(A, "Сэр Гарет", 3, 20, 30));
assert.equal(t.rank, 2); assert.equal(t.rows[0].name, "bХакер/b");
// чужое устройство не может переписать строку A
let r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ player_id: A, secret: "x".repeat(20), name: "Вор", bosses: 999, level: 1, wave: 1 }) });
assert.equal(r.status, 403);
// мусор отклоняется
r = await fetch(API, { method: "POST", body: JSON.stringify({ player_id: "nope", secret: "x".repeat(20), name: "ab", bosses: 1, level: 1, wave: 1 }) });
assert.equal(r.status, 400);
// результат не уменьшается
await lb2.submit(prof(B, "Хакер", 0, 1, 1));
t = await lb2.top(prof(B, "Хакер", 0, 1, 1));
assert.equal(t.rows[0].bosses, 5); assert.equal(t.rows[0].name, "Хакер");
// CORS для версии на GitHub
r = await fetch(API + "?player_id=" + A); assert.equal(r.headers.get("access-control-allow-origin"), "*");
// лимит записей
let last; for (let i = 0; i < 25; i++) last = (await fetch(API, { method: "POST", body: "{}" })).status;
assert.equal(last, 429);
console.log("e2e ok");
