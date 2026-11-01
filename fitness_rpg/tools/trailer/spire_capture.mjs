// Кадры для ролика «Хеллоуин: Шпиль Самайна»: зал с правилами, Пухоглот, Королева Ока, Граф Пепельной Крови,
// Полуночный Охотник (обе стадии), тыквенные дары, Сундук Самайна, Клинок Нетопыря и бой без камеры.
// Настоящий движок игры, пошагово (30 к/с).
// Запуск: php -S 127.0.0.1:8795 в папке сайта (web с js/), затем  node spire_capture.mjs OUT_DIR
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", locale: "ru-RU" });
await ctx.addInitScript(() => {
  let seed = 31031; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.requestAnimationFrame = () => 0;
  localStorage.setItem("ash-and-iron-tutorial", "true");
  localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет",
    best: { bosses: 11, level: 40, wave: 52 }, ach: {}, title: null, tower: { best: 12, runs: 4, queens: 0 } }));
  const save = { strength: 18, vigor: 22, endurance: 14, wave: 40, frontier: 52, bossesDefeated: 11, souls: 2400, redGems: 140, blueGems: 12,
    owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor", "amulet", "windcharm"], sword: "giant", armor: "kingarmor", talisman: "windcharm",
    plankSeconds: 900, totalReps: { pushup: 1150, squat: 940, jack: 520 }, chests: { samhain: 2, abyss: 1 }, chestPity: { samhain: 5 } };
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
// этаж Шпиля: враг ждёт, пока не скомандуем приём
const floor = (n, mode = "cam") => `g.mode = '${mode}'; g.player.mods = null;
  g.change(new m.TowerScene(g, { floor: ${n}, seed: 3, prevBest: 0, hp: 9999, estus: 2, mods: { dmg: 0, hp: 0, regen: 0, crit: 0 }, earned: [0, 0, 0], chests: [], gifts: [] }));
  const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('idle', 99); s0.enemy.gazeT = 99;`;
const move = (id, combo = 0) => `en.move = '${id}'; en.comboLeft = ${combo}; en.feinted = false; s.startWindup(en);`;
const strike = "en.timer = 0;";
const dodge = "s.act('squat_down');";

await shot("hall", 50, "g.change(new m.SpireHallScene(g));");
// Пухоглот: укус парой, высасывает силы; герой отвечает
await shot("fluff", 60, floor(1), { 4: move("strike", 1), 24: strike, 40: strike, 52: "s.act('pushup')" });
// Королева: Око открывается, удар отражается в героя
await shot("queen", 60, floor(13), { 4: "en.gazeT = 0; en.set('idle', 0);", 22: "s.act('pushup')", 40: "s.act('pushup')" });
// Граф Пепельной Крови: стая мышей и укус
await shot("vamp", 70, floor(8), { 4: move("swarm", 2), 22: strike, 36: strike, 50: strike });
await shot("vamp_bite", 40, "", { 2: move("bite"), 22: strike });
// Полуночный Охотник: вой ужаса → наступает Полночь → пике из тьмы
await shot("hunt1", 40, floor(11), { 4: move("howl"), 26: strike });
await shot("hunt_tr", 76, "", { 2: "en.hp = en.maxHp * 0.45; en.set('idle', 0.05);" });
await shot("hunt2", 56, "", { 2: "en.set('idle', 99);", 18: move("dive"), 46: strike });
// тыквенные дары
await shot("gift", 40, "g.change(new m.TowerGiftScene(g, { floor: 7, seed: 5, prevBest: 0, hp: 120, estus: 1, mods: { dmg: 0, hp: 0, regen: 0, crit: 0 }, earned: [0, 0, 0], chests: [], gifts: [] }));");
// Сундук Самайна: 25 приседаний и легенда (гарантия — 6-й сундук)
await shot("chest_inv", 24, "g.mode = 'cam'; g.change(new m.InventoryScene(g)); g.scene.sel = 'samhain';");
await shot("chest_open", 120, "g.scene.start('samhain');", Object.fromEntries([...Array(25)].map((_, i) => [3 + i * 2, "s.handle(['squat'])"])));
await shot("chest_legend", 60, "");
// Клинок Нетопыря
await shot("bat", 50, "g.store.grant('sword_bat'); g.profile.style.sword = 'sword_bat'; g.mode = 'cam'; g.player.wave = 30; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('recover', 99);",
  { 4: "s.act('pushup')", 20: "s.act('pushup')", 36: "s.act('pushup')" });
// без камеры: тяжёлый удар (ЖДИ...), серия, финт
const btn = (wave) => `g.profile.style.sword = null; g.mode = 'btn'; g.player.wave = ${wave}; g.run = null; g.change(new m.BattleScene(g)); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.hp = g.player.maxHp; s0.enemy.set('idle', 99);`;
await shot("hard_heavy", 52, btn(12), { 2: move("heavy"), 38: dodge });
await shot("hard_flurry", 66, "", { 2: "en.set('idle', 99);" + move("flurry", 3), 12: dodge, 34: dodge, 58: dodge });
await shot("hard_feint", 50, "", { 2: "en.set('idle', 99);" + move("feint") });
await shot("final", 60, "g.mode = 'cam'; g.change(new m.TitleScene(g)); g.scene.popup = false; g.achQueue.length = 0;");
console.log("errors:", errs.length ? errs : "none");
await browser.close();
