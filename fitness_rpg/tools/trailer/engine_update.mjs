// Кадры из настоящего движка игры: пошаговая отрисовка (30 к/с), без реального времени.
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", locale: "ru-RU" });
await ctx.addInitScript(() => {
  let seed = 12345; Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.requestAnimationFrame = () => 0; // кадры шагаем сами
});
const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.stack));
await page.goto("http://localhost:8765/?v=" + Date.now()); await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForSelector("#gate.ready"); await page.click("#start-manual"); await page.waitForTimeout(300);
await page.evaluate(() => { const g = window.game; g.cameraWidget = () => {}; g.manualButtons = () => {}; });

async function shot(name, n, setup, events = {}) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate(async (setup) => { const m = await import("./js/game.js"); const g = window.game; window.__m = m; eval(setup); }, setup);
  for (let f = 0; f < n; f++) {
    const [ui, world] = await page.evaluate(({ f, code }) => {
      const g = window.game, m = window.__m, s = g.scene;
      if (code) eval(code);
      g.frame(1 / 30);
      return [g.canvas.toDataURL("image/png"), g.world.toDataURL("image/png")];
    }, { f, code: events[f] || "" });
    fs.writeFileSync(`${OUT}/${name}/ui_${String(f).padStart(4, "0")}.png`, Buffer.from(ui.split(",")[1], "base64"));
    fs.writeFileSync(`${OUT}/${name}/w_${String(f).padStart(4, "0")}.png`, Buffer.from(world.split(",")[1], "base64"));
  }
}

const W31 = (sw, extra="") => `g.player.owned.push('${sw}'${extra}); g.player.sword='${sw}';`;
// радиатор: постоянный урон огнём по зомби
await shot("gy_radiator", 60, `${W31("radiator")} g.player.wave=33; const s=new m.BattleScene(g); s.ready=0; s.enemy.set('idle',99); s.stamina=999; g.scene=s;`,
  { 6: "s.act('pushup')", 30: "s.act('pushup')" });
// гигантский меч: ошеломление (редкий шанс, здесь он выпал) и крит
await shot("gy_giant", 60, `${W31("giant")} g.player.wave=32; const s=new m.BattleScene(g); s.ready=0; s.enemy.set('idle',99); s.stamina=999; g.scene=s;`,
  { 6: "const r=Math.random; Math.random=()=>0.01; s.act('pushup'); Math.random=r;", 28: "s.act('pushup')" });
// гриф от штанги против летучей мыши
await shot("gy_barbell", 60, `${W31("barbell")} g.player.wave=31; const s=new m.BattleScene(g); s.ready=0; s.enemy.set('idle',99); s.stamina=999; g.scene=s;`,
  { 6: "s.act('pushup')", 30: "s.act('pushup')" });
// Король-Призрак: замах на героя в доспехе короля, затем возрождение
await shot("gy_wraith", 70, `${W31("giant", ",'armor','kingarmor'")} g.player.wave=35; const s=new m.BattleScene(g); s.ready=0; s.enemy.set('windup',0.6); s.stamina=999; g.scene=s;`,
  { 4: "s.act('squat_down')", 34: "s.enemy.hp=1; s.enemy.set('idle',99); s.act('pushup')" });
console.log("errors:", errs);
await browser.close();
