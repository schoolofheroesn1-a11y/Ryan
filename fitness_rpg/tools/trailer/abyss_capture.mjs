// Кадры для ролика «Алая Бездна»: настоящий движок игры, пошагово (30 к/с). Сервер не нужен.
// Запуск: php -S 127.0.0.1:8795 в папке собранного сайта, затем  node abyss_capture.mjs OUT_DIR
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
async function open(viewport, save) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.addInitScript((save) => {
    let seed = 4646; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    window.requestAnimationFrame = () => 0;
    localStorage.setItem("ash-and-iron-save", JSON.stringify(save));
    localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет", best: { bosses: 9, level: 34, wave: 50 } }));
  }, save);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(process.env.SITE || "http://127.0.0.1:8795/index.html"); await page.waitForSelector("#gate.ready"); await page.click("#start-manual"); await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const g = window.game; window.__m = await import("./js/game.js");
    g.cameraWidget = () => {}; g.manualButtons = () => {}; g.sideButtons = () => {}; g.say = () => {};
    g.side = 1e-6; // как на телефоне: без подсказок клавиш J/K/L (сдвиг картинки — миллионная пикселя)
  });
  return page;
}
async function shot(page, name, n, setup, events = {}) {
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
const base = { strength: 14, vigor: 12, endurance: 11, wave: 46, bossesDefeated: 9, sword: "giant", redGems: 20, blueGems: 24, souls: 2400 };
// бой без «ПРИГОТОВЬТЕСЬ»: враг ждёт, пока сценарий не скажет иначе
const fight = (wave, extra = "") => `g.player.wave = ${wave}; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('idle', 99); ${extra}`;
const L = await open({ width: 1280, height: 720 }, { ...base, owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor", "amulet"] });
// мелкие демоны: гончая бросается, герой уворачивается и рубит
await shot(L, "hound", 84, fight(47), {
  6: "s.enemy.set('windup', 1.0); window.__s = 1",
  22: "s.act('squat_down')",
  48: "s.act('pushup')", 66: "s.act('pushup')",
});
await shot(L, "imp", 54, fight(46), { 10: "s.act('pushup')", 30: "s.act('pushup')" });
await shot(L, "husk", 54, fight(48), { 8: "s.enemy.set('windup', 0.8)", 20: "s.act('squat_down')", 40: "s.act('pushup')" });
// Алый Серафим: аура жжёт, герой бьёт
await shot(L, "seraph1", 96, fight(50), { 20: "s.act('pushup')", 44: "s.act('pushup')", 70: "s.enemy.set('windup', 1.2)" });
// перерождение во вторую стадию
await shot(L, "transform", 96, fight(50, "s0.enemy.hp = Math.floor(s0.enemy.maxHp * 0.55);"), { 6: "s.act('pushup')" });
// вторая стадия: замах и удар по герою
await shot(L, "seraph2", 72, fight(50, "s0.enemy.stage2 = true; s0.enemy.enraged = true; s0.enemy.hp = Math.floor(s0.enemy.maxHp * 0.4);"), {
  8: "s.enemy.set('windup', 1.0)", 50: "s.act('pushup')",
});
// новые вещи: кузница и бой в снаряжении Серафима
const G = await open({ width: 1280, height: 720 }, { ...base, wave: 55, sword: "seraph", owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor", "amulet", "seraph", "wingarmor"] });
await shot(G, "shop_sword", 30, "g.change(new m.ShopScene(g)); g.scene.index = 6; g.scene.msgT = 0;");
await shot(G, "shop_armor", 30, "g.scene.index = 10;");
await shot(G, "gear_fight", 90, fight(55, "s0.enemy.stage2 = true; s0.enemy.enraged = true;"), { 10: "s.act('pushup')", 34: "s.act('pushup')", 58: "s.act('pushup')" });
await shot(G, "title", 60, "g.change(new m.TitleScene(g));");
console.log("errors:", errs.length ? errs : "none");
await browser.close();
