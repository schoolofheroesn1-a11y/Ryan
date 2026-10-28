// Кадры для ролика «Большое обновление»: карта земель, бои в 4 землях, огоньки, сундуки и инвентарь,
// легендарное оружие, достижения, кузница. Настоящий движок игры, пошагово (30 к/с).
// Запуск: php -S 127.0.0.1:8795 в папке сайта (web с js/), затем  node update2_capture.mjs OUT_DIR
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", locale: "ru-RU" });
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
await ctx.addInitScript((hist) => {
  let seed = 9191; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.requestAnimationFrame = () => 0;
  localStorage.setItem("ash-and-iron-tutorial", "true");
  localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет",
    best: { bosses: 11, level: 40, wave: 52 }, streak: { points: 23, days: 14, best: 23, last: hist.y, todayPts: 2, hist: hist.h }, ach: {}, title: null }));
  const save = { strength: 16, vigor: 13, endurance: 12, wave: 52, frontier: 52, bossesDefeated: 11, souls: 2400, redGems: 140, blueGems: 12,
    owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor", "amulet", "windcharm"], sword: "giant", armor: "kingarmor", talisman: "windcharm",
    plankSeconds: 900, totalReps: { pushup: 1150, squat: 940, jack: 520 }, chests: { crypt: 2, castle: 3, grave: 1, abyss: 1 }, chestPity: { castle: 44 } };
  localStorage.setItem("ash-and-iron-save-btn", JSON.stringify(save));
  localStorage.setItem("ash-and-iron-save", JSON.stringify(save));
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no camera")); // режим с камерой — обычная сложность
}, { y: day(-1), h: Object.fromEntries([...Array(7)].map((_, i) => [day(-1 - i), i % 3 ? 1 : 2])) });
const page = await ctx.newPage();
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://127.0.0.1:8795/index.html"); await page.waitForSelector("#gate.ready"); await page.click("#start-camera"); await page.waitForTimeout(500);
await page.evaluate(async () => {
  const g = window.game; window.__m = await import("./js/game.js");
  g.cameraWidget = () => {}; g.manualButtons = () => {}; g.sideButtons = () => {}; g.say = () => {}; g.side = 1e-6;
  g.achQueue.length = 0;
});
async function shot(name, n, setup, events = {}) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate((setup) => { const g = window.game, m = window.__m; eval(setup); }, setup);
  for (let f = 0; f < n; f++) {
    const ui = await page.evaluate(({ code }) => {
      const g = window.game, m = window.__m, s = g.scene;
      if (code) eval(code);
      g.frame(1 / 30);
      return g.canvas.toDataURL("image/png");
    }, { code: events[f] || "" });
    fs.writeFileSync(`${OUT}/${name}/ui_${String(f).padStart(4, "0")}.png`, Buffer.from(ui.split(",")[1], "base64"));
  }
}
const fight = (wave) => `g.player.wave = ${wave}; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('idle', 99);`;
// главное меню с окном огоньков (пламя гаснет: сегодня ещё не зажжено)
await shot("streak", 66, "g.streakShown = false; g.change(new m.TitleScene(g)); g.achQueue.length = 0;");
await shot("title", 40, "g.scene.popup = false;");
// карта земель
await shot("map", 70, "g.change(new m.MapScene(g));", { 40: "s.choose(2)" });
// бои в 4 землях — по удару
for (const [name, wave] of [["b1", 4], ["b2", 19], ["b3", 34], ["b4", 49]]) await shot(name, 26, fight(wave), { 4: "s.act('pushup')" });
// победа и сундук, падающий с врага (огонёк дня и достижение — тоже тут)
await shot("drop", 60, fight(20) + " s0.enemy.hp = 1;", { 2: "s.act('pushup')" });
// инвентарь и открытие сундука разбойников (на этот раз — гарантированная легенда)
await shot("inv", 36, "g.achQueue.length = 0; g.change(new m.InventoryScene(g)); g.scene.sel = 'castle';");
await shot("open", 150, "g.scene.start('castle');", Object.fromEntries([...Array(10)].map((_, i) => [4 + i * 3, "s.handle(['squat'])"])));
await shot("legend", 70, "");
// достижения: плашка и вкладка профиля
await shot("ach", 80, "g.scene.open = null; g.achQueue.length = 0; g.change(new m.ProfileScene(g)); g.scene.tab = 'ach';");
// кузница: синие + алые
await shot("forge", 50, "g.change(new m.ShopScene(g)); g.scene.setTab(1); g.scene.index = 2; g.scene.msgT = 0;");
await shot("final", 60, "g.change(new m.TitleScene(g)); g.scene.popup = false; g.achQueue.length = 0;");
console.log("errors:", errs.length ? errs : "none");
await browser.close();
