// «Ash & Iron» — мобильная (браузерная) версия. Порт game/core.py + game/scenes.py.
// Мир рисуется в 320×180 и масштабируется ×2; интерфейс — в логических координатах 640×H.
// В портретной ориентации под игрой появляется большая панель камеры.
import { NAMES } from "./exercises.js";
import { Motion } from "./motion.js";
import { ESTUS_MAX, Player, STATS } from "./player.js";
import { initAudio, sfx } from "./sfx.js";

const CW = 320, CH = 180;
const W = 640, GAME_H = 360;
const GROUND_TITLE = 150, GROUND_ARENA = 140;
const FONT = '"PressStart2P", monospace';

const COL = {
  text: "rgb(226,214,190)", dim: "rgb(150,138,128)", gold: "rgb(232,190,92)",
  red: "rgb(200,40,36)", green: "rgb(70,160,70)", shadow: "rgb(8,6,12)",
};

const SPRITES = [
  "title_bg", "arena_bg", "skeleton_dark_0", "hero_dead_0",
  "hero_idle_0", "hero_idle_1", "hero_attack_0", "hero_dodge_0", "hero_hurt_0", "hero_heal_0",
  "skeleton_idle_0", "skeleton_idle_1", "skeleton_windup_0", "skeleton_windup_1",
  "skeleton_attack_0", "skeleton_hurt_0", "skeleton_dead_0",
  "bonfire_0", "bonfire_1", "bonfire_2", "bonfire_3", "torch_0", "torch_1", "torch_2", "torch_3",
];
const IMG = {};

function loadImages() {
  return Promise.all(SPRITES.map((name) => new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => { IMG[name] = im; ok(); };
    im.onerror = fail;
    im.src = `assets/${name}.png`;
  })));
}

function anim(prefix, t, fps, n) {
  return IMG[`${prefix}_${((Math.floor(t * fps) % n) + n) % n}`];
}

const rand = (a, b) => a + Math.random() * (b - a);
const inRect = (p, r) => p.x >= r[0] && p.x < r[0] + r[2] && p.y >= r[1] && p.y < r[1] + r[3];

class Particles {
  constructor(x, y, rate = 18, spread = 5) {
    Object.assign(this, { x, y, rate, spread });
    this.items = [];
    this.acc = 0;
  }
  update(dt) {
    this.acc += dt * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.items.push([this.x + rand(-this.spread, this.spread), this.y, rand(-6, 6), rand(-26, -12), rand(1, 2.2)]);
    }
    for (const p of this.items) {
      p[0] += p[2] * dt + rand(-0.3, 0.3);
      p[1] += p[3] * dt;
      p[4] -= dt;
    }
    this.items = this.items.filter((p) => p[4] > 0);
  }
  draw(c) {
    for (const [x, y, , , life] of this.items) {
      c.fillStyle = life > 1.4 ? "rgb(255,200,90)" : life > 0.6 ? "rgb(230,110,40)" : "rgb(120,50,30)";
      c.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  }
}

// ------------------------------------------------------------------ Ядро
class Game {
  constructor(canvas, useCamera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = document.createElement("canvas");
    this.world.width = CW;
    this.world.height = CH;
    this.wctx = this.world.getContext("2d");
    this.player = Player.load();
    this.motion = new Motion();
    this.useCamera = useCamera;
    this.time = 0;
    this.shake = 0;
    this.keys = [];
    this.taps = [];
    this.manualCounts = { pushup: 0, squat: 0, jack: 0 };
    this.run = null; // здоровье/эстус между боями (null — полные, после костра)
    this.resize();
    addEventListener("resize", () => this.resize());
    addEventListener("keydown", (e) => this.keys.push(e.key));
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      this.taps.push({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * this.H });
      e.preventDefault();
    });
  }

  resize() {
    const vw = innerWidth, vh = innerHeight;
    this.portrait = vh > vw * 1.05;
    this.H = this.portrait ? Math.min(1400, Math.max(GAME_H + 200, Math.round((W * vh) / vw))) : GAME_H;
    this.canvas.width = W;
    this.canvas.height = this.H;
    const scale = Math.min(vw / W, vh / this.H);
    this.canvas.style.width = `${Math.floor(W * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.H * scale)}px`;
    this.ctx.imageSmoothingEnabled = false;
    // Раскладка панели камеры и кнопок ручного ввода
    if (this.portrait) {
      const top = GAME_H + 8, btnH = 56;
      const camH = this.H - top - btnH - 24;
      const camW = Math.min(W - 16, Math.round((camH * 4) / 3));
      this.cam = [(W - camW) / 2, top, camW, camH];
      const y = this.H - btnH - 8, bw = (W - 32) / 3;
      this.manual = ["pushup", "squat", "jack"].map((ex, i) => [ex, [8 + i * (bw + 8), y, bw, btnH]]);
    } else {
      this.cam = [W - 136, 12, 120, 90];
      this.manual = ["pushup", "squat", "jack"].map((ex, i) => [ex, [W - 136, 110 + i * 30, 120, 26]]);
    }
  }

  // --- рисование
  text(s, x, y, size = 8, color = COL.text, align = "left", shadow = true) {
    const c = this.ctx;
    c.font = `${size}px ${FONT}`;
    c.textBaseline = "top";
    c.textAlign = align;
    if (shadow) {
      c.fillStyle = COL.shadow;
      c.fillText(s, x + Math.max(1, size / 8), y + Math.max(1, size / 8));
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
    return c.measureText(s).width;
  }

  wrap(s, maxChars) {
    const lines = [];
    let cur = "";
    for (const w of s.split(" ")) {
      if (cur && cur.length + w.length + 1 > maxChars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  rect(r, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(...r);
  }

  bar(x, y, w, h, frac, color) {
    frac = Math.max(0, Math.min(1, frac));
    this.rect([x - 1, y - 1, w + 2, h + 2], COL.shadow);
    this.rect([x, y, w, h], "rgb(30,20,26)");
    this.rect([x, y, Math.floor(w * frac), h], color);
    this.rect([x, y, Math.floor(w * frac), 1], "rgba(255,255,255,0.3)");
  }

  button(r, label, { selected = false, size = 8, color } = {}) {
    this.rect(r, selected ? "rgba(70,40,30,0.85)" : "rgba(12,8,16,0.75)");
    const c = this.ctx;
    c.strokeStyle = selected ? COL.gold : "rgb(90,64,50)";
    c.lineWidth = 1;
    c.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1);
    this.text(label, r[0] + r[2] / 2, r[1] + (r[3] - size) / 2, size, color || (selected ? COL.gold : COL.text), "center");
  }

  /** Было ли нажатие в прямоугольнике в этом кадре (нажатие «съедается»). */
  tapped(r) {
    const i = this.taps.findIndex((p) => inRect(p, r));
    if (i < 0) return false;
    this.taps.splice(i, 1);
    return true;
  }

  key(...names) {
    return this.keys.some((k) => names.includes(k));
  }

  cameraWidget() {
    const [x, y, w, h] = this.cam;
    this.rect([x - 2, y - 2, w + 4, h + 4], COL.shadow);
    this.ctx.strokeStyle = "rgb(60,46,50)";
    this.ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    const big = this.portrait;
    if (this.motion.drawPreview(this.ctx, x, y, w, h)) {
      const d = this.motion.detector;
      this.text(d.posture, x + 4, y + h - (big ? 20 : 12), big ? 16 : 8, COL.gold);
      if (big) {
        const c = d.counts;
        this.text(`Отжим ${c.pushup}  Присед ${c.squat}  Звезда ${c.jack}`, x + 4, y + 4, 8, COL.text);
      }
    } else {
      this.text("КАМЕРА", x + w / 2, y + 8, big ? 16 : 8, COL.dim, "center");
      const lines = this.wrap(this.motion.status, big ? 36 : 14);
      lines.forEach((l, i) => this.text(l, x + w / 2, y + (big ? 40 : 24) + i * 12, 8, COL.dim, "center"));
      if (big) {
        this.wrap("Поставьте телефон на пол у стены, отойдите на 2–3 м, чтобы тело было целиком в кадре.", 36)
          .forEach((l, i) => this.text(l, x + w / 2, y + 100 + i * 12, 8, COL.dim, "center"));
      }
    }
  }

  /** Кнопки «ручного» упражнения: без камеры — основной ввод, с камерой — запасной. */
  manualButtons() {
    if (!this.portrait && this.motion.ok) return;
    const labels = { pushup: "ОТЖИМ", squat: "ПРИСЕД", jack: "ЗВЕЗДА" };
    for (const [ex, r] of this.manual) this.button(r, labels[ex], { size: this.portrait ? 16 : 8 });
  }

  change(scene) {
    this.scene = scene;
  }

  frame(dt) {
    let moves = this.motion.poll();
    // клавиатура (браузер на ПК) и экранные кнопки
    const keyMap = { 1: ["pushup"], 2: ["squat_down", "squat"], 3: ["jack"] };
    for (const k of this.keys) if (keyMap[k]) moves.push(...keyMap[k]);
    if (this.portrait || !this.motion.ok) {
      for (const [ex, r] of this.manual) {
        if (this.scene.manual && this.tapped(r)) {
          moves.push(...(ex === "squat" ? ["squat_down", "squat"] : [ex]));
          this.manualCounts[ex] += 1;
        }
      }
    }
    for (const m of moves) this.player.addRep(m);
    this.time += dt;
    this.scene.handle(moves);
    this.scene.update(dt);

    const w = this.wctx;
    w.imageSmoothingEnabled = false;
    w.fillStyle = "#000";
    w.fillRect(0, 0, CW, CH);
    this.scene.draw(w);

    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "rgb(10,6,12)";
    c.fillRect(0, 0, W, this.H);
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      ox = Math.round(rand(-2, 2)) * 2;
      oy = Math.round(rand(-2, 2)) * 2;
    }
    c.drawImage(this.world, ox, oy, W, GAME_H);
    this.scene.drawUi();
    if (this.portrait) {
      this.cameraWidget();
      if (this.scene.manual) this.manualButtons();
    }
    this.keys.length = 0;
    this.taps.length = 0;
  }
}

class Scene {
  constructor(game) {
    this.game = game;
    this.manual = false; // показывать кнопки ручных упражнений
  }
  handle(moves) {}
  update(dt) {}
  draw(c) {}
  drawUi() {}
}

// ------------------------------------------------------------------ Главный экран
class TitleScene extends Scene {
  constructor(game) {
    super(game);
    this.embers = new Particles(208, 132, 22);
    this.index = 0;
    const g = game;
    this.items = [
      ["Продолжить путь", () => g.change(new BattleScene(g))],
      ["Костёр: прокачка", () => g.change(new BonfireScene(g))],
      ["Камера и советы", () => g.change(new CameraScene(g))],
      ["Новая игра", () => this.newGame()],
    ];
    this.confirmT = 0;
  }
  newGame() {
    // Защита от случайного касания: прогресс стирается только со второго нажатия
    if (this.confirmT <= 0) {
      this.confirmT = 3;
      return;
    }
    const g = this.game;
    g.player = new Player();
    g.player.save();
    g.run = null;
    g.change(new BonfireScene(g));
  }
  rects() {
    return this.items.map((_, i) => [32, 112 + i * 36, 232, 28]);
  }
  handle() {
    const g = this.game;
    if (g.key("ArrowUp")) this.index = (this.index + this.items.length - 1) % this.items.length;
    if (g.key("ArrowDown")) this.index = (this.index + 1) % this.items.length;
    const activate = (i) => {
      sfx.click();
      this.index = i;
      this.items[i][1]();
    };
    if (g.key("Enter", " ")) return activate(this.index);
    this.rects().forEach((r, i) => { if (g.tapped(r)) activate(i); });
  }
  update(dt) {
    this.embers.update(dt);
    this.confirmT -= dt;
  }
  draw(c) {
    const t = this.game.time;
    c.drawImage(IMG.title_bg, 0, 0);
    const r = 34 + Math.round(Math.sin(t * 6) * 2);
    c.fillStyle = "rgba(255,120,40,0.16)";
    c.beginPath();
    c.ellipse(208, GROUND_TITLE - 2, r, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(anim("bonfire", t, 8, 4), 200, GROUND_TITLE - 22);
    c.drawImage(anim("hero_idle", t, 1.5, 2), 172, GROUND_TITLE - 32);
    const sx = 270, sy = GROUND_TITLE - 32;
    c.drawImage(IMG.skeleton_dark_0, sx, sy);
    if (Math.floor(t * 1.3) % 5 !== 0) {
      c.fillStyle = "rgb(255,70,40)";
      c.fillRect(sx + 9, sy + 6, 1, 1);
      c.fillRect(sx + 14, sy + 6, 1, 1);
    }
    this.embers.draw(c);
  }
  drawUi() {
    const g = this.game, p = g.player;
    g.text("ASH & IRON", W / 2 + 3, 19, 40, "rgb(120,30,26)", "center", false);
    g.text("ASH & IRON", W / 2, 16, 40, "rgb(232,206,160)", "center", false);
    g.text("фитнес-RPG: тренируй тело, чтобы выжить во тьме", W / 2, 66, 8, COL.dim, "center");
    this.rects().forEach((r, i) => {
      const confirm = i === 3 && this.confirmT > 0;
      g.button(r, confirm ? "Стереть? Ещё раз" : this.items[i][0], { selected: i === this.index, color: confirm ? COL.red : undefined });
    });
    g.text(`Ур. ${p.level}  Души: ${p.souls}  Враг: скелет #${p.wave}`, 12, GAME_H - 16, 8, COL.dim);
    if (!g.portrait) g.text("Нажмите на пункт меню", W - 12, GAME_H - 16, 8, COL.dim, "right");
  }
}

// ------------------------------------------------------------------ Костёр
class BonfireScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = true;
    this.embers = new Particles(216, 116, 26);
    this.ritual = null; // {stat, ex, need, done}
    this.say("Костёр зажжён. Здоровье и эстус восстановлены.");
    this.index = 0;
    game.run = null; // отдых у костра
  }
  say(msg, t = 3.5) {
    this.message = msg;
    this.msgT = t;
  }
  statRows() {
    return Object.keys(STATS).map((st, i) => [st, [20, 92 + i * 40, 290, 36]]);
  }
  startRitual(stat) {
    const p = this.game.player;
    if (!p.canLevel()) return this.say(`Нужно ${p.levelCost()} душ, у вас ${p.souls}. Победите скелетов!`);
    this.ritual = { stat, ex: STATS[stat][1], need: p.repsNeeded(stat), done: 0 };
  }
  handle(moves) {
    const g = this.game, p = g.player;
    if (this.ritual) {
      if (g.key("Escape") || g.tapped([W / 2 - 70, GAME_H - 26, 140, 22])) {
        this.ritual = null;
        return this.say("Ритуал прерван. Души не потрачены.");
      }
      for (const m of moves) {
        if (m === this.ritual.ex) {
          this.ritual.done += 1;
          sfx.rep();
        }
      }
      if (this.ritual.done >= this.ritual.need) {
        const st = this.ritual.stat;
        p.levelUp(st);
        p.save();
        this.ritual = null;
        this.say(`${STATS[st][0]} повышена до ${p[st]}!`, 4);
        this.embers.rate = 120;
        sfx.level();
        if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
      }
      return;
    }
    const rows = this.statRows();
    const n = rows.length + 2;
    if (g.key("ArrowUp")) this.index = (this.index + n - 1) % n;
    if (g.key("ArrowDown")) this.index = (this.index + 1) % n;
    const activate = (i) => {
      sfx.click();
      this.index = i;
      if (i < rows.length) this.startRitual(rows[i][0]);
      else if (i === rows.length) g.change(new BattleScene(g));
      else g.change(new TitleScene(g));
    };
    if (g.key("Enter", " ")) return activate(this.index);
    if (g.key("Escape")) return g.change(new TitleScene(g));
    rows.forEach(([, r], i) => { if (g.tapped(r)) activate(i); });
    if (g.tapped([20, 216, 140, 26])) activate(rows.length);
    if (g.tapped([170, 216, 140, 26])) activate(rows.length + 1);
  }
  update(dt) {
    this.embers.update(dt);
    this.embers.rate += (26 - this.embers.rate) * Math.min(1, dt * 1.5);
    this.msgT -= dt;
  }
  draw(c) {
    const t = this.game.time;
    c.drawImage(IMG.title_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.47)";
    c.fillRect(0, 0, CW, CH);
    const r = 46 + Math.round(Math.sin(t * 5) * 3);
    c.fillStyle = "rgba(255,120,40,0.2)";
    c.beginPath();
    c.ellipse(216, GROUND_TITLE - 4, r, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(anim("bonfire", t, 8, 4), 200, GROUND_TITLE - 44, 32, 44);
    const hero = this.ritual && this.ritual.done % 2 ? IMG.hero_attack_0 : IMG.hero_idle_0;
    c.drawImage(hero, 168, GROUND_TITLE - 32);
    this.embers.draw(c);
  }
  drawUi() {
    const g = this.game, p = g.player;
    g.rect([12, 12, 306, 260], "rgba(10,6,14,0.8)");
    g.ctx.strokeStyle = "rgb(90,64,50)";
    g.ctx.strokeRect(12.5, 12.5, 305, 259);
    g.text("КОСТЁР", 22, 22, 16, COL.gold);
    g.text(`Уровень ${p.level}`, 22, 46, 8);
    g.text(`Души: ${p.souls}`, 160, 46, 8, COL.gold);
    g.text(`Цена уровня: ${p.levelCost()} душ`, 22, 62, 8, COL.dim);
    g.text("Нажмите на навык:", 22, 78, 8, COL.dim);
    this.statRows().forEach(([st, r], i) => {
      const [name, ex, desc] = STATS[st];
      g.button(r, "", { selected: this.index === i });
      g.text(`${name} ${p[st]}`, r[0] + 8, r[1] + 7, 8, this.index === i ? COL.gold : COL.text);
      g.text(`${NAMES[ex]} x${p.repsNeeded(st)}: ${desc}`, r[0] + 8, r[1] + 21, 8, COL.dim);
    });
    g.button([20, 216, 140, 26], "В БОЙ", { selected: this.index === 3 });
    g.button([170, 216, 140, 26], "МЕНЮ", { selected: this.index === 4 });
    g.text(`Урон ${p.damage}  Здоровье ${p.maxHp}  Силы ${p.maxStamina}`, 22, 248, 8, COL.dim);
    const tr = p.totalReps;
    g.text(`Всего: отжим ${tr.pushup} присед ${tr.squat} звезда ${tr.jack}`, 22, 260, 8, COL.text);
    if (!g.portrait) {
      g.cameraWidget();
      g.manualButtons();
    }

    if (this.ritual) {
      const { stat, ex, need, done } = this.ritual;
      g.rect([0, GAME_H - 84, W, 84], "rgba(0,0,0,0.85)");
      g.text(`Ритуал: ${STATS[stat][0]}`, W / 2, GAME_H - 78, 8, COL.dim, "center");
      g.text(`${NAMES[ex]}: ${done} / ${need}`, W / 2, GAME_H - 64, 16, COL.gold, "center");
      g.bar(W / 2 - 150, GAME_H - 40, 300, 8, done / need, "rgb(230,140,50)");
      g.button([W / 2 - 70, GAME_H - 26, 140, 22], "ПРЕРВАТЬ");
    } else if (this.msgT > 0) {
      g.wrap(this.message, 76).forEach((l, i) => g.text(l, W / 2, GAME_H - 36 + i * 12, 8, COL.gold, "center"));
    }
  }
}

// ------------------------------------------------------------------ Бой
class Skeleton {
  constructor(wave) {
    this.wave = wave;
    this.maxHp = 90 + 35 * (wave - 1);
    this.hp = this.maxHp;
    this.damage = 16 + 4 * (wave - 1);
    this.windupTime = Math.max(1.3, 1.9 - 0.05 * wave); // время на реакцию (присед)
    this.comboChance = wave >= 3 ? 0.35 : 0; // с 3-го скелета — двойной удар
    this.maxPoise = 3;
    this.poise = this.maxPoise;
    this.state = "idle";
    this.timer = rand(1.5, 2.5);
    this.flash = 0;
    this.combo = false;
    this.x = this.homeX = 200;
  }
  set(state, timer) {
    this.state = state;
    this.timer = timer;
  }
}

const ATTACK_COST = 20;
const READY_TIME = 4; // секунд на то, чтобы отойти от телефона
const RECOVER_TIME = 1.6; // окно для удара после атаки скелета
const ABSENT_PAUSE = 1.0; // пауза, если игрока нет в кадре дольше этого

class BattleScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = true;
    const p = game.player;
    this.HERO_X = 86;
    this.enemy = new Skeleton(p.wave);
    // Здоровье и эстус переносятся между боями до отдыха у костра
    const run = game.run || { hp: p.maxHp, estus: ESTUS_MAX };
    this.hp = Math.min(run.hp, p.maxHp);
    this.estus = run.estus;
    this.stamina = p.maxStamina;
    this.action = "idle";
    this.actionT = 0;
    this.invuln = 0;
    this.regenPause = 0;
    this.hurtT = 0;
    this.texts = [];
    this.result = null;
    this.resultT = 0;
    this.reward = 0;
    this.ready = READY_TIME;
    this.absentT = 0;
    this.paused = false;
    this.torchL = new Particles(64, 58, 8, 2);
    this.torchR = new Particles(256, 58, 8, 2);
  }

  float(text, x, y, color, size = 16) {
    this.texts.push({ text, x, y, color, size, ttl: 1 });
  }

  saveRun() {
    this.game.run = { hp: this.hp, estus: this.estus };
  }

  act(move) {
    const p = this.game.player, en = this.enemy;
    if (move === "pushup") {
      if (this.stamina < ATTACK_COST) return this.float("Нет сил!", this.HERO_X + 10, 90, COL.green, 8);
      this.stamina -= ATTACK_COST;
      this.regenPause = 0.6;
      this.action = "attack";
      this.actionT = 0.35;
      const crit = en.state === "recover";
      const dmg = crit ? Math.floor(p.damage * 1.5) : p.damage;
      en.hp -= dmg;
      en.flash = 0.15;
      this.game.shake = 0.12;
      crit ? sfx.crit() : sfx.hit();
      this.float(`${dmg}${crit ? " КРИТ!" : ""}`, en.x + 12, 90, crit ? COL.gold : COL.text);
      if (en.state === "windup") {
        en.poise -= 1;
        if (en.poise <= 0) {
          en.set("recover", RECOVER_TIME);
          this.float("ПРЕРВАН!", en.x + 12, 74, COL.gold);
        }
      }
      if (en.hp <= 0) this.win();
    } else if (move === "squat_down" || move === "pushup_down") {
      // Уворот бесплатный: приседать/опускаться можно сколько угодно.
      // Если уже идёт замах — игрок пригнулся заранее и защищён до самого удара.
      this.action = "dodge";
      this.actionT = 0.9;
      const untilStrike = en.state === "windup" ? en.timer + 0.25 : 0;
      this.invuln = Math.max(this.invuln, 0.9, untilStrike);
      sfx.dodge();
    } else if (move === "jack") {
      if (this.estus <= 0) return this.float("Эстус пуст", this.HERO_X + 10, 90, COL.dim, 8);
      if (this.hp >= p.maxHp) return this.float("Здоровье полное", this.HERO_X + 10, 90, COL.dim, 8);
      this.estus -= 1;
      const heal = Math.floor(p.maxHp * 0.45);
      this.hp = Math.min(p.maxHp, this.hp + heal);
      this.action = "heal";
      this.actionT = 0.8;
      sfx.heal();
      this.float(`+${heal}`, this.HERO_X + 10, 90, "rgb(255,170,60)");
    }
  }

  win() {
    const p = this.game.player, en = this.enemy;
    en.set("dead", 0);
    this.result = "won";
    this.resultT = 0;
    this.reward = 80 + 40 * en.wave;
    p.souls += this.reward;
    if (p.lostSouls && p.lostAtWave === en.wave) {
      this.reward += p.lostSouls;
      p.souls += p.lostSouls;
      p.lostSouls = 0;
    }
    p.wave += 1;
    p.save();
    this.saveRun();
    sfx.win();
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  }

  die() {
    const p = this.game.player;
    this.result = "dead";
    this.resultT = 0;
    p.lostSouls = p.souls;
    p.lostAtWave = p.wave;
    p.souls = 0;
    p.save();
    this.game.run = null; // возрождение у костра с полным здоровьем
    sfx.die();
  }

  handle(moves) {
    const g = this.game;
    if (this.result) {
      if (this.resultT < 1) return;
      // Звёздочка — следующий бой без подхода к телефону; касание/Enter — к костру
      if (this.result === "won" && moves.includes("jack")) return g.change(new BattleScene(g));
      if (g.taps.length || g.key("Enter", " ", "Escape") || (this.result === "dead" && moves.includes("jack"))) {
        g.taps.length = 0;
        g.change(new BonfireScene(g));
      }
      return;
    }
    if (g.key("Escape") || g.tapped([12, GAME_H - 30, 104, 22])) {
      this.saveRun();
      return g.change(new BonfireScene(g));
    }
    if (this.ready > 0 || this.paused) return;
    for (const m of moves) if (m !== "squat") this.act(m); // в бою важен сам момент приседа
  }

  update(dt) {
    const g = this.game, p = g.player, en = this.enemy;
    this.torchL.update(dt);
    this.torchR.update(dt);
    for (const ft of this.texts) {
      ft.y -= 18 * dt;
      ft.ttl -= dt;
    }
    this.texts = this.texts.filter((ft) => ft.ttl > 0);
    en.flash = Math.max(0, en.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.result) {
      this.resultT += dt;
      return;
    }
    // С камерой: бой ждёт, пока игрок встанет в кадр, и замирает, если он вышел
    const d = g.motion.ok ? g.motion.detector : null;
    const present = !d || d.posture !== "нет человека";
    this.absentT = present ? 0 : this.absentT + dt;
    this.paused = !!d && this.absentT > ABSENT_PAUSE;
    if (this.paused) return;
    if (this.ready > 0) {
      const before = Math.ceil(this.ready);
      if (present) this.ready -= dt;
      if (Math.ceil(this.ready) !== before && this.ready > 0) sfx.warn();
      return;
    }

    this.actionT -= dt;
    if (this.actionT <= 0) this.action = "idle";
    this.invuln = Math.max(0, this.invuln - dt);
    if (d && d.low) this.invuln = Math.max(this.invuln, 0.15); // пока игрок внизу — он под ударом не стоит
    this.regenPause -= dt;
    if (this.regenPause <= 0) this.stamina = Math.min(p.maxStamina, this.stamina + p.staminaRegen * dt);

    // ИИ скелета: ожидание -> замах (окно для приседа) -> удар -> уязвимость
    en.timer -= dt;
    if (en.state === "idle" && en.timer <= 0) {
      en.poise = en.maxPoise;
      en.set("windup", en.windupTime);
      sfx.warn();
    } else if (en.state === "windup" && en.timer <= 0) {
      en.set("attack", 0.35);
      this.resolveHit();
    } else if (en.state === "attack" && en.timer <= 0) {
      if (!en.combo && Math.random() < en.comboChance) {
        en.combo = true; // второй, более быстрый замах сразу после первого
        en.set("windup", en.windupTime * 0.75);
        this.float("ЕЩЁ УДАР!", en.x + 12, 70, "rgb(255,120,60)", 8);
        sfx.warn();
      } else {
        en.combo = false;
        en.set("recover", RECOVER_TIME);
      }
    } else if (en.state === "recover" && en.timer <= 0) {
      en.set("idle", rand(1.6, 3));
    }
    const target = en.state === "attack" ? this.HERO_X + 30 : en.homeX;
    en.x += (target - en.x) * Math.min(1, dt * (en.state === "attack" ? 18 : 5));
  }

  resolveHit() {
    const en = this.enemy;
    if (this.invuln > 0) {
      sfx.dodge();
      return this.float("УВОРОТ!", this.HERO_X + 10, 80, "rgb(140,200,255)");
    }
    this.hp -= en.damage;
    this.hurtT = 0.3;
    this.game.shake = 0.3;
    sfx.hurt();
    if (navigator.vibrate) navigator.vibrate(150);
    this.float(`-${en.damage}`, this.HERO_X + 10, 86, COL.red);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  draw(c) {
    const t = this.game.time, en = this.enemy;
    c.drawImage(IMG.arena_bg, 0, 0);
    for (const tx of [60, 252]) c.drawImage(anim("torch", t, 8, 4), tx, 56);
    this.torchL.draw(c);
    this.torchR.draw(c);

    let spr;
    if (en.state === "dead") spr = IMG.skeleton_dead_0;
    else if (en.flash > 0) spr = IMG.skeleton_hurt_0;
    else if (en.state === "windup") spr = anim("skeleton_windup", t, 8, 2);
    else if (en.state === "attack") spr = IMG.skeleton_attack_0;
    else spr = anim("skeleton_idle", t, 1.5, 2);
    const ex = Math.round(en.x) - (en.state === "attack" ? 8 : 0);
    c.drawImage(spr, ex, GROUND_ARENA - spr.height);

    if (this.result === "dead") spr = IMG.hero_dead_0;
    else if (this.hurtT > 0) spr = IMG.hero_hurt_0;
    else if (this.action === "idle") spr = anim("hero_idle", t, 1.5, 2);
    else spr = IMG[`hero_${this.action}_0`];
    const hx = this.HERO_X + (this.action === "attack" ? 10 : this.action === "dodge" ? -6 : 0);
    if (this.action === "dodge") {
      c.globalAlpha = 0.3;
      c.drawImage(spr, hx + 8, GROUND_ARENA - spr.height);
      c.globalAlpha = 1;
    }
    c.drawImage(spr, hx, GROUND_ARENA - spr.height);

    if (en.state === "windup") {
      const k = Math.max(0, Math.min(1, 1 - en.timer / en.windupTime));
      c.strokeStyle = `rgba(200,20,20,${(40 + 80 * k) / 255})`;
      c.lineWidth = 6;
      c.strokeRect(3, 3, CW - 6, CH - 6);
    }
  }

  drawUi() {
    const g = this.game, p = g.player, en = this.enemy;
    g.bar(16, 16, Math.floor(p.maxHp * 1.4), 8, this.hp / p.maxHp, COL.red);
    g.bar(16, 28, Math.floor(p.maxStamina * 1.6), 6, this.stamina / p.maxStamina, COL.green);
    for (let i = 0; i < ESTUS_MAX; i++) {
      g.rect([15 + i * 12, 39, 10, 14], COL.shadow);
      g.rect([16 + i * 12, 42, 8, 10], i < this.estus ? "rgb(240,150,50)" : "rgb(60,50,50)");
      g.rect([18 + i * 12, 40, 4, 2], "rgb(140,120,100)");
    }
    if (!g.portrait) {
      g.cameraWidget();
      g.manualButtons();
    }

    g.text(`Скелет-страж #${en.wave}`, 140, GAME_H - 46, 8);
    g.bar(140, GAME_H - 32, 340, 8, Math.max(0, en.hp) / en.maxHp, "rgb(150,20,20)");
    g.text(`Души: ${p.souls}`, W - 12, GAME_H - 16, 8, COL.gold, "right");
    g.button([12, GAME_H - 30, 104, 22], "< КОСТЁР");

    [["ОТЖИМАНИЕ", "удар"], ["ПРИСЕД/ВНИЗ", "уворот"], ["ЗВЕЗДОЧКА", "эстус"]]
      .forEach(([a, b], i) => g.text(`${a}: ${b}`, 16, 62 + i * 12, 8, COL.dim));

    const plank = g.motion.ok && g.motion.detector.posture === "планка";
    if (this.paused) {
      g.rect([0, GAME_H / 2 - 30, W, 60], "rgba(0,0,0,0.75)");
      g.text("ПАУЗА: ВСТАНЬТЕ В КАДР", W / 2, GAME_H / 2 - 12, 16, COL.gold, "center");
      g.text("Камера не видит вас, скелет ждёт", W / 2, GAME_H / 2 + 10, 8, COL.dim, "center");
    } else if (this.ready > 0) {
      g.text("ПРИГОТОВЬТЕСЬ", W / 2, 60, 16, COL.gold, "center");
      g.text(`${Math.ceil(this.ready)}`, W / 2, 84, 32, COL.text, "center");
      g.text("Отойдите, чтобы тело было в кадре", W / 2, 124, 8, COL.dim, "center");
    } else if (en.state === "windup" && !this.result) {
      const k = Math.max(0, Math.min(1, en.timer / en.windupTime));
      const pulse = 0.5 + 0.5 * Math.sin(g.time * 14);
      g.text(plank ? "ОПУСТИСЬ!" : "ПРИСЕДАЙ!", W / 2, 56, 32, `rgb(255,${Math.floor(60 + 120 * pulse)},40)`, "center");
      g.bar(W / 2 - 80, 96, 160, 5, k, "rgb(255,90,50)");
      g.text("!", Math.round(en.x + 12) * 2, 2 * (GROUND_ARENA - 44), 24, "rgb(255,200,60)", "center");
    } else if (en.state === "recover" && !this.result) {
      g.text("Окно для удара: ОТЖИМАЙСЯ!", W / 2, 70, 8, COL.gold, "center");
    }

    for (const ft of this.texts) g.text(ft.text, Math.round(ft.x * 2), Math.round(ft.y * 2), ft.size, ft.color, "center");

    if (this.result) {
      g.rect([0, GAME_H / 2 - 45, W, 90], `rgba(0,0,0,${Math.min(0.8, this.resultT * 1.2)})`);
      if (this.result === "dead") {
        g.text("ВЫ ПОГИБЛИ", W / 2, GAME_H / 2 - 28, 32, "rgb(170,20,20)", "center");
        g.text("Души остались на месте гибели: победите", W / 2, GAME_H / 2 + 14, 8, COL.dim, "center");
        g.text("этого скелета, чтобы вернуть их. Касание: к костру", W / 2, GAME_H / 2 + 26, 8, COL.dim, "center");
      } else {
        g.text("ВРАГ ПОВЕРЖЕН", W / 2, GAME_H / 2 - 28, 32, COL.gold, "center");
        g.text(`+${this.reward} душ`, W / 2, GAME_H / 2 + 12, 8, COL.gold, "center");
        g.text("Звёздочка: следующий бой. Касание: к костру", W / 2, GAME_H / 2 + 26, 8, COL.text, "center");
      }
    }
  }
}

// ------------------------------------------------------------------ Камера и советы
class CameraScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = true;
  }
  handle(moves) {
    const g = this.game;
    if (moves.some((m) => m === "pushup" || m === "squat" || m === "jack")) sfx.rep();
    if (g.key("Escape", "Enter") || g.tapped([W / 2 - 60, GAME_H - 30, 120, 22])) g.change(new TitleScene(g));
    if (!g.motion.ok && !g.motion.starting && g.tapped([20, 300, 200, 24])) g.motion.start();
  }
  draw(c) {
    c.drawImage(IMG.arena_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(0, 0, CW, CH);
  }
  drawUi() {
    const g = this.game, d = g.motion.detector;
    g.text("КАМЕРА И СОВЕТЫ", W / 2, 12, 16, COL.gold, "center");
    const fmt = (v) => (v == null ? "-" : `${Math.round(v)}°`);
    const x = 20;
    g.text(`Статус: ${g.motion.status}`, x, 40, 8);
    g.text(`Поза: ${d.posture}`, x, 54, 8);
    g.text(`Колени ${fmt(d.knee)}  Локти ${fmt(d.elbow)}  Наклон ${fmt(d.tilt)}`, x, 68, 8, COL.dim);
    const counts = g.motion.ok ? d.counts : g.manualCounts;
    ["pushup", "squat", "jack"].forEach((ex, i) => g.text(`${NAMES[ex]}: ${counts[ex]}`, x, 88 + i * 14, 8));
    const tips = [
      "Поставьте телефон на пол, прислонив к стене, и отойдите на 2-3 м.",
      "Отжимания и приседания: встаньте к телефону БОКОМ.",
      "Звёздочка: встаньте ЛИЦОМ, руки поднимайте над головой.",
      "Всё тело должно быть в кадре. Экран не гаснет во время игры.",
      "Без камеры жмите кнопки ОТЖИМ / ПРИСЕД / ЗВЕЗДА.",
    ];
    let y = 140;
    for (const tip of tips) for (const l of g.wrap(tip, g.portrait ? 74 : 56)) { g.text(l, x, y, 8, COL.dim); y += 12; }
    if (!g.motion.ok && !g.motion.starting) g.button([20, 300, 200, 24], "ВКЛЮЧИТЬ КАМЕРУ");
    g.button([W / 2 - 60, GAME_H - 30, 120, 22], "НАЗАД");
    if (!g.portrait) {
      g.cameraWidget();
      g.manualButtons();
    }
  }
}

// ------------------------------------------------------------------ Запуск
export async function boot() {
  const canvas = document.getElementById("game");
  const gate = document.getElementById("gate");
  const gateStatus = document.getElementById("gate-status");
  try {
    await Promise.all([loadImages(), document.fonts.load(`16px ${FONT}`, "АБВ")]);
  } catch (e) {
    gateStatus.textContent = "Не удалось загрузить графику. Обновите страницу.";
    return;
  }
  gateStatus.textContent = "";
  gate.classList.add("ready");

  const start = async (useCamera) => {
    gate.hidden = true;
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    } catch (e) { /* iOS Safari не умеет — не страшно */ }
    initAudio();
    // Экран не гаснет на тренировке; после сворачивания блокировку нужно взять заново
    const lockScreen = async () => {
      try {
        if (navigator.wakeLock && document.visibilityState === "visible") await navigator.wakeLock.request("screen");
      } catch (e) { /* не поддерживается */ }
    };
    lockScreen();
    document.addEventListener("visibilitychange", lockScreen);
    const game = new Game(canvas, useCamera);
    window.game = game; // для отладки и автотестов
    game.change(new TitleScene(game));
    if (useCamera) game.motion.start();
    else game.motion.status = "камера выключена: используйте кнопки";
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05)); // первый кадр rAF бывает «из прошлого»
      last = now;
      game.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  document.getElementById("start-camera").onclick = () => start(true);
  document.getElementById("start-manual").onclick = () => start(false);
}

export { BattleScene, BonfireScene, CameraScene, TitleScene };
