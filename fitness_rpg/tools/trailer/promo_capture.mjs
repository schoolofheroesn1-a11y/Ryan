// Запуск: php -S 127.0.0.1:8797 в папке сайта (с api.php и тестовой базой), затем
//   LB_TOKEN=<токен тестового аккаунта> node promo_capture.mjs OUT_DIR
// Кадры для ролика об обновлении: настоящий движок, пошагово (30 к/с).
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2]; // папка для кадров; LB_TOKEN — вход тестового аккаунта на локальном сервере
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
async function open(viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.addInitScript((token) => {
    let seed = 777; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    window.requestAnimationFrame = () => 0;
    localStorage.setItem("ash-and-iron-token", JSON.stringify(token));
    localStorage.setItem("ash-and-iron-account", JSON.stringify({ id: "x", login: "samurai", name: "Сэр Гарет", best: { bosses: 7, level: 27, wave: 36 }, unlocks: [], arena_pos: 7, attempts: 10 }));
    localStorage.setItem("ash-and-iron-save", JSON.stringify({ strength: 10, vigor: 9, endurance: 9, wave: 36, bossesDefeated: 7, owned: ["rusty", "steel", "great", "giant", "armor", "kingarmor"], sword: "giant", redGems: 12, blueGems: 3, souls: 940 }));
    localStorage.setItem("ash-and-iron-profile", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", name: "Сэр Гарет", best: { bosses: 7, level: 27, wave: 36 }, style: { armor: "armor_samurai" } }));
    localStorage.setItem("ash-and-iron-purchases", JSON.stringify(["armor_samurai"]));
  }, process.env.LB_TOKEN);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(process.env.SITE || "http://127.0.0.1:8797/index.html"); await page.waitForSelector("#gate.ready"); await page.click("#start-manual"); await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const g = window.game; window.__m = await import("./js/game.js");
    g.online.url = location.origin + "/api.php";
    g.cameraWidget = () => {}; g.manualButtons = () => {}; g.say = () => {};
  });
  return page;
}
async function shot(page, name, n, setup, events = {}, waitFor = null) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate((setup) => { const g = window.game, m = window.__m; eval(setup); }, setup);
  if (waitFor) await page.waitForFunction(waitFor, null, { timeout: 10000, polling: 100 });
  for (let f = 0; f < n; f++) {
    const ui = await page.evaluate(({ f, code }) => {
      const g = window.game, m = window.__m, s = g.scene;
      if (code) eval(code);
      g.frame(1 / 30);
      return g.canvas.toDataURL("image/png");
    }, { f, code: events[f] || "" });
    fs.writeFileSync(`${OUT}/${name}/ui_${String(f).padStart(4, "0")}.png`, Buffer.from(ui.split(",")[1], "base64"));
  }
}
// --- вертикальные экраны мультиплеера
const P = await open({ width: 390, height: 844 });
await shot(P, "mp_rating", 24, "g.change(new m.MultiplayerScene(g, 'rating')); g.resize();", {}, "window.game.scene.data.rating && !window.game.scene.busy");
await shot(P, "mp_challenge", 24, "g.change(new m.MultiplayerScene(g, 'challenge')); g.resize();", {}, "window.game.scene.data.arena && !window.game.scene.busy");
await shot(P, "mp_room", 24, "g.change(new m.MultiplayerScene(g, 'duel')); g.resize(); g.scene.room = 'H9X4'; g.scene.update = () => {};");
// --- бои (альбомная картинка игры)
const L = await open({ width: 1280, height: 720 });
const opp = "{ name: 'Ронин', hero: { sword: 'great', looks: ['armor'], skin: null, outfit: null, level: 31, maxHp: 260, damage: 46, crit: 1.75, taken: 0.75, estus: 3, stamina: 140, cost: 28, regen: 30 } }";
await shot(L, "duel", 120, `g.change(new m.DuelScene(g, { code: 'H9X4', side: 0, opponent: ${opp} })); g.scene.net = () => {}; g.scene.ready = 0; g.scene.stamina = 999;`, {
  6: "s.receive({ t: 'atk', dmg: 40, n: 1 })",
  30: "s.act('squat_down')",
  52: "s.act('pushup')",
  92: "s.receive({ t: 'hp', hp: 196, max: 260, n: 2 })",
  104: "s.receive({ t: 'atk', dmg: 40, n: 3 })",
});
await shot(L, "challenge", 96, `g.change(new m.ChallengeScene(g, { fight: 'x', opponent: { pos: 5, ${opp.slice(1)} })); g.online.challengeEnd = async () => ({ moved: true, won: true, account: { arena_pos: 5 } }); const s0 = g.scene; s0.ready = 0; s0.stamina = 999; s0.enemy.set('idle', 99); s0.enemy.potion = false;`, {
  8: "s.act('pushup')", 22: "s.act('pushup')", 34: "s.enemy.hp = 20; s.act('pushup')",
});
await shot(L, "samurai_fight", 84, "g.player.wave = 35; g.change(new m.BattleScene(g)); g.scene.ready = 0; g.scene.stamina = 999; g.scene.enemy.set('idle', 99);", {
  12: "s.act('pushup')", 36: "s.act('pushup')", 60: "s.act('pushup')",
});
await shot(L, "samurai_title", 60, "g.change(new m.TitleScene(g));");
console.log("errors:", errs);
await browser.close();
