// Кадры для ролика об обновлении: отдельный рейтинг, профиль, движения, аура (медитация), кузница.
// Настоящий движок игры, пошагово (30 к/с); сервер подменён выдуманными игроками.
// Запуск: php -S 127.0.0.1:8795 в папке собранного сайта, затем  node update_capture.mjs OUT_DIR
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", locale: "ru-RU" });
await ctx.addInitScript(() => {
  let seed = 7171; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.requestAnimationFrame = () => 0;
  localStorage.setItem("ash-and-iron-tutorial", "true");
  localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет", best: { bosses: 11, level: 36, wave: 54 } }));
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no camera"));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(process.env.SITE || "http://127.0.0.1:8795/index.html");
await page.waitForSelector("#gate.ready");
await page.click("#start-camera");
await page.waitForTimeout(600);
await page.evaluate(async () => {
  const g = window.game; window.__m = await import("./js/game.js");
  g.say = () => {}; g.side = 1e-6;
  Object.assign(g.player, { strength: 18, vigor: 15, endurance: 14, wave: 52, bossesDefeated: 11, sword: "seraph",
    redGems: 34, blueGems: 7, souls: 2600, plankSeconds: 1260, armor: "wingarmor", talisman: "fang",
    owned: ["rusty", "steel", "great", "giant", "seraph", "armor", "kingarmor", "wingarmor", "amulet", "fang"] });
  Object.assign(g.player.totalReps, { pushup: 1840, squat: 2310, jack: 960 });
  // камера «видит» игрока: силуэт-скелет в окошке, поза задаётся сценарием
  const det = { posture: "стоит", low: false, counts: { pushup: 0, squat: 0, jack: 0 }, update: () => [] };
  Object.defineProperty(g.motion, "ok", { get: () => true, set: () => {} });
  Object.defineProperty(g.motion, "detector", { value: det, writable: true });
  g.motion.poll = () => [];
  g.motion.drawPreview = (c, x, y, w, h) => {
    c.fillStyle = "rgb(18,16,24)"; c.fillRect(x, y, w, h);
    const t = g.time, cx = x + w / 2, s = h / 120, pose = det.posture;
    const P = pose === "планка" ? [[-30, 40], [-10, 38], [10, 36], [28, 34], [28, 52], [-34, 54]] : null;
    c.strokeStyle = "rgb(120,250,140)"; c.lineWidth = Math.max(1, s * 2); c.beginPath();
    if (P) { c.moveTo(cx + P[5][0] * s, y + P[5][1] * s); for (const [a, b] of P.slice(0, 4)) c.lineTo(cx + a * s, y + b * s); c.moveTo(cx + 24 * s, y + 36 * s); c.lineTo(cx + 24 * s, y + 56 * s); }
    else {
      const dip = pose === "присед" ? 18 : 0, arm = Math.sin(t * 12) * 6;
      c.moveTo(cx, y + (30 + dip) * s); c.lineTo(cx, y + (62 + dip / 2) * s); // корпус
      c.moveTo(cx - 14 * s, y + (90) * s); c.lineTo(cx, y + (62 + dip / 2) * s); c.lineTo(cx + 14 * s, y + 90 * s); // ноги
      c.moveTo(cx - 18 * s, y + (46 + dip + arm) * s); c.lineTo(cx, y + (36 + dip) * s); c.lineTo(cx + 20 * s, y + (42 + dip - arm) * s); // руки
    }
    c.stroke();
    c.fillStyle = "rgb(255,200,120)";
    const hd = P ? [cx + 36 * s, y + 30 * s] : [cx, y + (22 + (pose === "присед" ? 18 : 0)) * s];
    c.fillRect(hd[0] - 4 * s, hd[1] - 4 * s, 8 * s, 8 * s);
    return true;
  };
  // сервер: выдуманные игроки, свои у рейтинга с камерой и без
  const names = ["Железный Волк", "Леди Пепла", "Сэр Гарет", "Тёмный Лис", "Медведь", "Северянка", "Ворон", "Кузнец", "Рыжая Сталь", "Монах"];
  const btnNames = ["Быстрый Палец", "Кнопочник", "Ночной Рыцарь", "Тень", "Сэр Гарет", "Стальной", "Ива", "Барон", "Клинок", "Гном"];
  const looks = [["seraph", ["wingarmor"]], ["giant", ["kingarmor"]], ["seraph", ["wingarmor", "amulet"]], ["great", ["armor"]], ["steel", []], ["giant", ["armor", "amulet"]], ["great", ["kingarmor"]], ["steel", ["armor"]], ["rusty", []], ["great", ["amulet"]]];
  const rows = (list, base) => list.map((name, i) => ({ id: name === "Сэр Гарет" ? "me" : `p${i}`, name, look: { sword: looks[i][0], looks: looks[i][1] },
    bosses: Math.max(1, base - i), level: 40 - i * 2 - (base > 10 ? 0 : 3), wave: 60 - i * 3 - (base > 10 ? 0 : 5) }));
  const acc = { id: "me", login: "gareth", name: "Сэр Гарет", best: { bosses: 11, level: 36, wave: 54 }, best_btn: { bosses: 7, level: 28, wave: 40 }, medals: 14, arena_pos: 6, unlocks: [] };
  const o = g.online;
  Object.assign(o, { url: "x", fetch: () => {}, token: "t", account: acc, offline: false });
  o.call = async (action, data) => {
    if (action === "top") return data.mode === "btn" ? { rows: rows(btnNames, 9), rank: 5 } : { rows: rows(names, 13), rank: 3 };
    return { account: acc };
  };
});
async function shot(name, n, setup, events = {}) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate((setup) => { const g = window.game, m = window.__m; eval(setup); }, setup);
  await page.waitForTimeout(50); // промисы подменённого сервера
  for (let f = 0; f < n; f++) {
    const ui = await page.evaluate(({ code }) => {
      const g = window.game, m = window.__m, s = g.scene, det = g.motion.detector;
      if (code) eval(code);
      g.frame(1 / 30);
      return g.canvas.toDataURL("image/png");
    }, { code: events[f] || "" });
    fs.writeFileSync(`${OUT}/${name}/ui_${String(f).padStart(4, "0")}.png`, Buffer.from(ui.split(",")[1], "base64"));
  }
}
await shot("rating_cam", 40, "g.change(new m.MultiplayerScene(g, 'rating'));");
await shot("rating_btn", 40, "g.scene.ratingMode = 'btn'; g.scene.data.rating = null; g.scene.load();");
await shot("profile", 60, "g.change(new m.ProfileScene(g));");
const fight = "g.player.wave = 52; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('idle', 99);";
await shot("moves", 90, fight, {
  0: "det.posture = 'отжимание'", 6: "s.act('pushup')", 26: "s.act('pushup')",
  38: "det.posture = 'стоит'; s.enemy.set('windup', 0.6)", 48: "det.posture = 'присед'; s.act('squat_down')",
  64: "det.posture = 'стоит'", 70: "det.posture = 'отжимание'; s.act('pushup')",
});
await shot("meditate", 90, "g.change(new m.BonfireScene(g)); g.scene.drawUi = () => {}; g.motion.detector.posture = 'планка';");
await shot("forge", 60, "g.motion.detector.posture = 'стоит'; g.change(new m.ShopScene(g)); g.scene.setTab(2); g.scene.msgT = 0;", { 30: "s.index = 1" });
await shot("title", 60, "g.change(new m.TitleScene(g));");
console.log("errors:", errs.length ? errs : "none");
await browser.close();
