// Кадры для ролика «Штормовое море»: карта с новой землёй, морские враги, появление Кракена со стихом,
// бой с Кракеном (удар щупальцем, хватка, чернила, волна), Сундук Прилива, Меч Прилива (крит — волна)
// и облик «Новый пират». Настоящий движок игры, пошагово (30 к/с).
// Запуск: php -S 127.0.0.1:8795 в папке сайта (web с js/), затем  node sea_capture.mjs OUT_DIR
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", locale: "ru-RU" });
await ctx.addInitScript(() => {
  let seed = 61061; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.requestAnimationFrame = () => 0;
  localStorage.setItem("ash-and-iron-tutorial", "true");
  localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет",
    best: { bosses: 13, level: 60, wave: 66 }, ach: {}, title: null, tower: { best: 14, runs: 6, queens: 1 } }));
  const save = { strength: 30, vigor: 34, endurance: 24, wave: 61, frontier: 66, bossesDefeated: 13, souls: 5400, redGems: 240, blueGems: 22,
    owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor", "wingarmor", "amulet", "windcharm"], sword: "giant", armor: "kingarmor", talisman: "windcharm",
    plankSeconds: 900, totalReps: { pushup: 2150, squat: 1940, jack: 920 }, chests: { sea: 2 }, chestPity: { sea: 7 } };
  localStorage.setItem("ash-and-iron-save", JSON.stringify(save));
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no camera"));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://127.0.0.1:8795/index.html"); await page.waitForSelector("#gate.ready"); await page.click("#start-camera"); await page.waitForTimeout(500);
await page.evaluate(async () => {
  const g = window.game; window.__m = await import("./js/game.js");
  g.cameraWidget = () => {}; g.manualButtons = () => {}; g.sideButtons = () => {}; g.say = () => {}; g.side = 1e-6;
  g.achQueue.length = 0;
  g.checkAch = () => {}; // плашки достижений не закрывают кадр
  g.mode = "cam";
});
async function shot(name, n, setup, events = {}) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate((setup) => { const g = window.game, m = window.__m; eval(setup); }, setup);
  for (let f = 0; f < n; f++) {
    const ui = await page.evaluate(({ code }) => {
      const g = window.game, m = window.__m, s = g.scene, en = s.enemy;
      if (code) eval(code);
      g.frame(1 / 30);
      return g.canvas.toDataURL("image/png");
    }, { code: events[f] || "" });
    fs.writeFileSync(`${OUT}/${name}/ui_${String(f).padStart(4, "0")}.png`, Buffer.from(ui.split(",")[1], "base64"));
  }
}
// бой на палубе: раунд wave, враг ждёт команды
const fight = (wave, extra = "") => `g.player.wave = ${wave}; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.hp = g.player.maxHp * 9; s0.enemy.set('idle', 99); ${extra}`;
const move = (id, combo = 0) => `en.move = '${id}'; en.comboLeft = ${combo}; en.feinted = false; s.startWindup(en);`;
const strike = "en.timer = 0;";

await shot("map", 46, "g.change(new m.MapScene(g));");
// Краб-громила: клешня-кувалда
await shot("crab", 44, fight(61), { 2: move("smash"), 30: strike });
// Нага: песня сирены и трезубец
await shot("naga", 56, fight(62), { 2: move("song"), 26: strike, 34: "en.set('idle', 99);" + move("trident"), 50: strike });
// Утопленник
await shot("drowned", 30, fight(63), { 2: move("drag"), 24: strike });
// Кракен: появление со стихом (8 с) — без отсчёта
// стих в ролике рисуется крупно поверх кадра — в самой игре его строки скрыты
await shot("emerge", 250, "g.player.wave = 65; g.run = null; g.change(new m.BattleScene(g)); g.scene.ready = 0; g.scene.stamina = 999; g.scene.hp = g.player.maxHp * 9; g.scene.drawEmerge = () => {};",
  { 244: "s.ready = 0;" });
// бой с Кракеном
const kr = "s.ready = 0; s.stamina = 999; en.set('idle', 99); s.inkT = 0; s.heldT = 0;";
await shot("k_slam", 44, "", { 0: kr, 2: move("slam"), 30: strike });
await shot("k_grab", 70, "", { 0: kr, 2: move("grab"), 30: strike, 40: "s.act('pushup')", 48: "s.act('pushup')", 56: "s.act('pushup')", 64: "s.act('pushup')" });
await shot("k_ink", 44, "", { 0: kr + "s.heldT = 0;", 2: move("ink"), 30: strike });
await shot("k_tide", 46, "", { 0: kr + "s.inkT = 0;", 2: move("tide"), 32: strike });
// Сундук Прилива: 20 отжиманий и легенда (гарантия на 8-м сундуке)
await shot("chest_inv", 24, "g.change(new m.InventoryScene(g)); g.scene.sel = 'sea';");
await shot("chest_open", 96, "g.scene.start('sea');", Object.fromEntries([...Array(20)].map((_, i) => [3 + i * 2, "s.handle(['pushup'])"])));
await shot("chest_legend", 60, "");
// Меч Прилива: крит — волна (удар, пока враг открыт после атаки)
await shot("tide", 70, "if (!g.player.owned.includes('tide')) g.player.owned.push('tide'); g.player.sword = 'tide'; g.profile.style.sword = null;" + fight(63),
  { 2: move("strike"), 26: strike, 34: "s.act('pushup')", 52: "en.set('recover', 2); s.act('pushup')" });
// Новый пират: облик поверх доспеха — у костра и в бою
await shot("pirate_camp", 50, "g.store.grant('armor_pirate'); g.profile.style.armor = 'armor_pirate'; g.change(new m.BonfireScene(g));");
await shot("pirate_fight", 50, fight(62), { 4: "en.set('recover', 2); s.act('pushup')", 26: "s.act('pushup')", 40: move("strike") });
await shot("final", 60, "g.change(new m.TitleScene(g)); g.scene.popup = false; g.achQueue.length = 0;");
console.log("errors:", errs.length ? errs : "none");
console.log("loot:", JSON.stringify(await page.evaluate(() => window.game.player.owned)));
await browser.close();
