// «Ash & Iron» — мобильная (браузерная) версия. Порт game/core.py + game/scenes.py.
// Мир рисуется в 320×180 и масштабируется ×2; интерфейс — в логических координатах 640×H.
// В портретной ориентации под игрой появляется большая панель камеры.
import { NAMES } from "./exercises.js";
import { Motion } from "./motion.js";
import {
  ABYSS_FROM_WAVE, BOSS_EVERY, CASTLE_FROM_WAVE, GRAVEYARD_FROM_WAVE, LAST_LOCATION, LOCATIONS, RELICS, SHOP_TABS, SWORDS, enemyKind, isBossWave, item,
  locationFor, locationStart, priceText, rewards,
} from "./gear.js";
import { ARMORS, Player, STATS, TALISMANS, setSaveSlot } from "./player.js";
import { initAudio, setAudio, sfx } from "./sfx.js";
import { COSMETIC, COSMETICS, HitFx, KIND_TITLES, OutfitFx, SwordAura, VictoryFx, drawSkinSlash } from "./cosmetics.js";
import { Leaderboard } from "./leaderboard.js";
import { Profile } from "./profile.js";
import { FLAME_TIERS, dayKey, shiftDay } from "./streak.js";
import { Store, TIPS } from "./store.js";
import { loadJSON, saveJSON } from "./storage.js";
import { isNative, keepAwake, openAppSettings, openUrl, restoreBackup, vibrate } from "./platform.js";
import { LANGS, getLang, setLang, tf, tr } from "./i18n.js";
import { choiceDialog, confirmDialog, modalOpen, promptAccount, promptName, promptText } from "./ui.js";
import { Online, errorText, heroSnapshot, inviteLink, savedRef } from "./online.js";

const CW = 320, CH = 180;
const W = 640, GAME_H = 360;
// Бой на телефоне вертикально: мир крупнее (×3), по бокам срезается пустое место
const ZOOM = { sx: 44, sw: 640 / 3, k: 3, h: 540 };
const SIDE_MIN = 56; // ширина боковой панели с кнопками (широкий экран без камеры), меньше — кнопки внутри картинки
const SIDE_MAX = 96; // шире не нужно: остальное поле — просто тёмная рамка
const GROUND_TITLE = 150, GROUND_ARENA = 140;
const FONT = '"PressStart2P", monospace';

const COL = {
  text: "rgb(226,214,190)", dim: "rgb(150,138,128)", gold: "rgb(232,190,92)",
  red: "rgb(200,40,36)", green: "rgb(70,160,70)", shadow: "rgb(8,6,12)",
};

// Облик героя по реликвиям: доспех Костяного Рыцаря (рога, тёмные латы) или Короля-Призрака
// (корона, бирюзовые латы — надевается поверх костяного) и/или Амулет Углей
function heroLook(owned) {
  const armor = owned.includes("armor"), amulet = owned.includes("amulet");
  if (owned.includes("wingarmor")) return amulet ? "wing_amulet" : "wing"; // доспех Серафима — поверх остальных
  if (owned.includes("kingarmor")) return amulet ? "king_amulet" : "king";
  return armor && amulet ? "both" : armor ? "armor" : amulet ? "amulet" : "base";
}
/** Медитация у костра (игрок в планке — копится аура): герой сидит, скрестив ноги, и парит над землёй. */
const meditateSprite = (owned, outfit, t) => anim(`hero_meditate_${outfit || heroLook(owned)}`, t, 1.2, 2);
const meditateLift = (t) => 5 + Math.round(Math.sin(t * 2) * 1.5); // высота парения, медленно покачивается
function drawMeditating(c, spr, x, ground, t, k = 1) {
  const lift = meditateLift(t) * k;
  c.fillStyle = "rgba(0,0,0,0.35)"; // тень на земле — видно, что парит
  c.beginPath();
  c.ellipse(x + 12 * k, ground - k, (9 - lift / k / 3) * k, 2 * k, 0, 0, Math.PI * 2);
  c.fill();
  c.drawImage(spr, x, ground - lift - spr.height * k, spr.width * k, spr.height * k);
}
/** Значок талисмана, если надет Талисман Ветра или Клык Вампира (Амулет Углей нарисован в самом облике). */
const talismanTag = (owned) => (owned.includes("windcharm") ? "+wind" : owned.includes("fang") ? "+fang" : "");
/** Префикс спрайтов героя: меч (или купленный облик меча skin), облик по реликвиям (или облик доспеха outfit) и талисман. */
const heroSprite = (sword, owned, skin = null, outfit = null) => `hero_${skin || sword}_${outfit || heroLook(owned)}${talismanTag(owned)}`;

// След удара для каждого меча
const SLASH_TIME = 0.18;
const SLASH_COLORS = {
  rusty: [190, 140, 100], steel: [235, 240, 250], great: [200, 210, 230], ash: [255, 150, 60],
  giant: [210, 220, 240], barbell: [170, 180, 200], radiator: [255, 170, 60], seraph: [230, 60, 50],
};

/** Дуга следа удара: k от 0 (начало) до 1 (исчезла). Двуручник — шире, пепельный — огненный. */
function drawSlash(c, x, y, sword, k, skin = null) {
  if (skin) return drawSkinSlash(c, x, y, skin, k);
  const big = sword === "great" || sword === "giant" || sword === "barbell";
  const radius = big ? 22 : 16;
  const base = SLASH_COLORS[sword];
  const fade = Math.max(0, 1 - k);
  for (const [width, shrink, mix] of [[big ? 3 : 2, 0, 0], [1, 3, 0.5]]) {
    const col = base.map((ch) => Math.floor((ch + (255 - ch) * mix) * fade + 20 * (1 - fade)));
    c.fillStyle = `rgb(${col.join(",")})`;
    const sweep = -70 + 140 * Math.min(1, k * 2.5); // дуга быстро «прочерчивается» сверху вниз
    for (let a = -70; a <= sweep; a += 5) {
      const rad = (a * Math.PI) / 180;
      c.fillRect(Math.floor(x + Math.cos(rad) * (radius - shrink) * 0.55), Math.floor(y + Math.sin(rad) * (radius - shrink)), width, width);
    }
  }
  if (sword === "ash" || sword === "radiator" || sword === "seraph") {
    c.fillStyle = sword === "seraph" ? "rgb(255,90,60)" : "rgb(255,200,90)";
    for (let i = 0; i < 4; i++) c.fillRect(x + Math.floor(rand(-4, 10)), y + Math.floor(rand(-radius, radius)), 1, 1);
  }
}

/**
 * Спрайты по имени. Герой с талисманом («hero_steel_king+fang_idle_0») собирается по запросу:
 * к готовому спрайту без талисмана дорисовывается значок на груди (атлас не растёт).
 */
const IMG = new Proxy({}, {
  get(t, k) {
    if (k in t || typeof k !== "string" || !k.includes("+")) return t[k];
    const m = /^(.*)\+(\w+)(_[a-z]+_\d+)$/.exec(k);
    const base = m && t[m[1] + m[3]];
    if (!base) return undefined;
    const cv = document.createElement("canvas");
    cv.width = base.width;
    cv.height = base.height;
    const c = cv.getContext("2d");
    c.drawImage(base, 0, 0);
    if (!m[3].startsWith("_dead")) drawTalisman(c, m[2], base.height - 32);
    return (t[k] = cv);
  },
});

/** Значок талисмана на груди героя (те же клетки, что у Амулета Углей), oy — сдвиг тела вниз. */
const TALISMAN_PIXELS = {
  // Талисман Ветра: бирюзовый вихрь на золотой цепочке
  wind: [[11, 9, "rgb(176,140,60)"], [15, 9, "rgb(176,140,60)"], [12, 10, "rgb(80,190,205)"], [13, 10, "rgb(225,252,255)"],
    [14, 10, "rgb(80,190,205)"], [13, 11, "rgb(40,120,140)"], [14, 11, "rgb(150,235,240)"]],
  // Клык Вампира: белый изогнутый клык с алой каплей на кожаном шнурке
  fang: [[11, 9, "rgb(96,62,50)"], [15, 9, "rgb(96,62,50)"], [11, 10, "rgb(24,14,18)"], [14, 10, "rgb(24,14,18)"],
    [12, 11, "rgb(24,14,18)"], [14, 11, "rgb(24,14,18)"], [12, 12, "rgb(24,14,18)"], [14, 12, "rgb(24,14,18)"],
    [12, 10, "rgb(240,234,212)"], [13, 10, "rgb(240,234,212)"], [13, 11, "rgb(240,234,212)"], [13, 12, "rgb(214,28,44)"]],
};
function drawTalisman(c, tag, oy) {
  for (const [x, y, col] of TALISMAN_PIXELS[tag] || []) {
    c.fillStyle = col;
    c.fillRect(x, y + oy, 1, 1);
  }
}

/** Все спрайты лежат в одном атласе (assets/atlas.png + atlas.json, см. tools/export_web_assets.py). */
async function loadImages() {
  const [rects, sheet] = await Promise.all([
    fetch("assets/atlas.json").then((r) => r.json()),
    new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = fail;
      im.src = "assets/atlas.png";
    }),
  ]);
  for (const [name, [x, y, w, h]] of Object.entries(rects)) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d").drawImage(sheet, x, y, w, h, 0, 0, w, h);
    IMG[name] = cv;
  }
}

function anim(prefix, t, fps, n) {
  return IMG[`${prefix}_${((Math.floor(t * fps) % n) + n) % n}`];
}

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Аура героя (планка): мягкое светлое свечение за спиной и редкие искры, растущие с силой ауры.
 * Заметна, но неброско: сильнее всего — к +12% и дальше не ярче. cx — центр героя, foot — земля, k — масштаб.
 */
function drawPlankAura(c, cx, foot, bonus, t, k = 1) {
  if (!(bonus > 0)) return;
  const s = Math.min(1, bonus / 0.12), pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
  // мягкое свечение: ярче у тела, к краям плавно гаснет (вытянуто по росту героя)
  const r = (13 + 6 * s) * k, a = (0.1 + 0.16 * s) * (0.8 + 0.2 * pulse);
  c.save();
  c.translate(cx, foot - 15 * k);
  c.scale(1, 1.5);
  const grad = c.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, `rgba(255,236,180,${a})`);
  grad.addColorStop(0.6, `rgba(255,226,160,${a * 0.45})`);
  grad.addColorStop(1, "rgba(255,220,150,0)");
  c.fillStyle = grad;
  c.fillRect(-r, -r, 2 * r, 2 * r);
  c.restore();
  const motes = 1 + Math.floor(4 * s);
  for (let i = 0; i < motes; i++) { // искры поднимаются от земли и тают
    const ph = (t * 0.35 + i / motes) % 1;
    c.fillStyle = `rgba(255,240,190,${(1 - ph) * (0.35 + 0.35 * s)})`;
    c.fillRect(Math.round(cx + Math.sin(i * 2.4 + t) * 9 * k), Math.round(foot - ph * 34 * k), k, k);
  }
}
/**
 * Костёр серии огоньков: чем больше огоньков, тем крупнее пламя; если сегодня огонёк ещё не зажжён —
 * пламя гаснет (меньше, тусклее, неровно мерцает). cx — центр, ground — низ, k — масштаб пикселя.
 */
function drawStreakFire(c, streak, cx, ground, t, k = 1, glow = true) {
  const fade = streak.fading(), out = streak.points <= 0 && streak.lost > 0; // погасло — тлеют угли
  let z = FLAME_TIERS[streak.tier][2] * k;
  if (fade) z *= 0.78 + 0.08 * Math.sin(t * 9) * Math.sin(t * 3.7);
  if (out) z *= 0.55;
  if (glow) {
    const r = (17 + Math.sin(t * 6)) * z * (fade || out ? 0.7 : 1);
    c.fillStyle = out ? "rgba(140,140,150,0.12)" : fade ? "rgba(255,90,40,0.12)" : "rgba(255,120,40,0.16)";
    c.beginPath();
    c.ellipse(cx, ground - 2 * k, r, 4 * z, 0, 0, Math.PI * 2);
    c.fill();
  }
  const spr = anim("bonfire", t, fade ? 5 : 8, 4), w = spr.width * z, h = spr.height * z;
  c.save();
  if (fade || out) c.globalAlpha = out ? 0.45 : 0.75 + 0.2 * Math.sin(t * 11);
  if (out) c.filter = "grayscale(1) brightness(0.6)";
  c.drawImage(spr, Math.round(cx - w / 2), Math.round(ground - h), Math.round(w), Math.round(h));
  c.restore();
}
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
    this.mode = useCamera ? "cam" : "btn"; // у режимов отдельные прогресс, рекорд и рейтинг
    setSaveSlot(this.mode);
    this.player = Player.load();
    this.cloudReady = false; // облачное сохранение сверено — можно отправлять прогресс в аккаунт
    this.cloudT = null;
    Player.onSave = () => this.cloudQueue();
    this.profile = Profile.load(); // имя в рейтинге, рекорд и облик — переживают «Новую игру»
    this.profile.mode = this.mode;
    this.store = new Store(confirmDialog, { offer: (it, kind) => this.offerCode(it, kind) });
    this.store.init().then(() => this.syncPaid()); // RevenueCat в iOS-приложении; иначе — тестовый режим
    this.syncPaid();
    this.leaderboard = new Leaderboard();
    this.settings = { volume: 0.8, alert: 1, vibrate: true, ...loadJSON(SETTINGS_KEY, {}) };
    setAudio(this.settings);
    this.leaderboard.flush(); // результат, накопленный без сети, уходит при запуске
    this.online = new Online(); // мультиплеер: аккаунт, рейтинг, вызовы, дуэли, коды
    this.online.mode = this.mode;
    if (this.online.loggedIn) {
      this.online.me().then((r) => this.onAccount(r.account)).catch(() => {});
      this.cloudSync();
      this.accountSync();
    }
    this.motion = new Motion();
    this.useCamera = useCamera;
    this.wideMode = !useCamera; // без камеры — всегда горизонтально, по бокам картинки крупные кнопки
    this.touch = !!(globalThis.matchMedia && matchMedia("(pointer: coarse)").matches); // телефон или планшет
    this.side = 0;
    this.time = 0;
    this.shake = 0;
    this.keys = [];
    this.taps = [];
    this.manualCounts = { pushup: 0, squat: 0, jack: 0 };
    this.run = null; // здоровье/зелья между боями (null — полные, после костра)
    this.resize();
    addEventListener("resize", () => this.resize());
    this.codes = []; // физические клавиши (e.code) — J/K/L работают на любой раскладке
    this.toast = "";
    this.toastT = 0;
    addEventListener("keydown", (e) => {
      if (modalOpen()) return; // открыто окно (имя, покупка) — игра клавиши не слушает
      if (["F2", "F3", "F4", "Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
      if (e.repeat) return; // автоповтор не считается новым повторением упражнения
      this.keys.push({ KeyW: "ArrowUp", KeyS: "ArrowDown" }[e.code] || e.key);
      this.codes.push(e.code);
    });
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect(), cw = W + 2 * this.side;
      if (this.rotated) { // холст повёрнут на 90° по часовой: его верх — у правого края экрана
        this.taps.push({ x: ((e.clientY - r.top) / r.height) * cw - this.side, y: ((r.right - e.clientX) / r.width) * this.H });
      } else {
        this.taps.push({ x: ((e.clientX - r.left) / r.width) * cw - this.side, y: ((e.clientY - r.top) / r.height) * this.H });
      }
      e.preventDefault();
    });
  }

  /** Аура: с камерой каждая секунда в планке у костра (медитация) копится навсегда; в бою аура работает сама.
   *  Сохраняется раз в несколько секунд и по выходу из планки. */
  plankTick(dt) {
    const d = this.motion.ok ? this.motion.detector : null;
    const plank = this.mode === "cam" && this.scene && this.scene.meditate && !this.scene.ritual
      && d && d.posture === "планка" && document.visibilityState !== "hidden";
    if (plank) {
      this.player.plankSeconds += dt;
      this.plankUnsaved = (this.plankUnsaved || 0) + dt;
    }
    if (this.plankUnsaved && (this.plankUnsaved >= 5 || !plank)) {
      this.plankUnsaved = 0;
      this.player.save();
    }
    this.inPlank = !!plank;
  }

  /** Хардкор: без камеры — всегда, с камерой — если выбран в настройках. */
  get hard() {
    return this.mode === "btn" || !!this.settings.hard;
  }

  /** Нужна ли сцене нижняя часть экрана в портрете (камера или крупное меню). */
  get usesPanel() {
    const s = this.scene;
    return !!s && (s.needsCamera || s.ownsPanel);
  }

  /** Бой с камерой на телефоне вертикально: кнопок упражнений нет, всё — движениями. */
  get noBtns() {
    return this.zoomed && !this.scene.manual;
  }

  /** Сейчас бой на телефоне вертикально: картинка мира увеличена. */
  get zoomed() {
    return this.portrait && !!this.scene && !!this.scene.zoomWorld;
  }

  /** Мир -> экран: x, y в пикселях мира 320×180 переводятся в координаты интерфейса. */
  wx(x) {
    return this.zoomed ? (x - ZOOM.sx) * ZOOM.k : x * 2;
  }
  wy(y) {
    return this.zoomed ? y * ZOOM.k : y * 2;
  }

  resize() {
    // доступная область — без «чёлки» iPhone, полосы жестов и вырезов (поля body = safe-area-inset)
    const cs = getComputedStyle(document.body);
    const pad = (k) => parseFloat(cs[k]) || 0;
    let vw = Math.max(200, innerWidth - pad("paddingLeft") - pad("paddingRight"));
    let vh = Math.max(200, innerHeight - pad("paddingTop") - pad("paddingBottom"));
    // без камеры игра горизонтальная: если телефон держат вертикально (поворот экрана заблокирован),
    // картинка поворачивается сама — достаточно повернуть телефон
    this.rotated = this.wideMode && vh > vw;
    if (this.rotated) [vw, vh] = [vh, vw];
    document.body.classList.toggle("rot", this.rotated);
    this.portrait = !this.wideMode && vh > vw * 1.05;
    this.zoomedNow = this.zoomed;
    this.gameH = this.zoomedNow ? ZOOM.h : GAME_H; // высота картинки игры над панелью камеры
    // камера видна только там, где нужны упражнения; иначе экран — одна картинка игры
    this.panelOn = this.portrait && this.usesPanel;
    this.H = this.panelOn ? Math.min(1400, Math.max(GAME_H + 200, Math.round((W * vh) / vw))) : GAME_H;
    // широкий экран телефона: поля по бокам картинки 16:9 — панели с кнопками, как у приставки
    const side = this.wideMode && !this.portrait ? Math.min(SIDE_MAX, Math.floor((Math.round((GAME_H * vw) / vh) - W) / 2)) : 0;
    this.side = side >= SIDE_MIN ? side : 0;
    const cw = W + 2 * this.side;
    this.canvas.width = cw;
    this.canvas.height = this.H;
    const scale = Math.min(vw / cw, vh / this.H);
    this.canvas.style.width = `${Math.floor(cw * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.H * scale)}px`;
    this.canvas.style.transform = this.rotated ? "rotate(90deg)" : "";
    this.ctx.imageSmoothingEnabled = false;
    // Раскладка панели камеры и кнопок ручного ввода
    if (this.portrait) {
      // в бою — крупные кнопки под палец; с камерой кнопок в бою нет — окно камеры больше
      this.noBtnsNow = this.noBtns;
      const top = this.gameH + 8, btnH = this.zoomedNow ? (this.noBtnsNow ? 0 : 112) : 56;
      const camH = this.H - top - btnH - 24;
      const camW = Math.min(W - 16, Math.round((camH * 4) / 3));
      this.cam = [(W - camW) / 2, top, camW, camH];
      const y = this.H - btnH - 8, bw = (W - 32) / 3;
      this.manual = ["pushup", "squat", "jack"].map((ex, i) => [ex, [8 + i * (bw + 8), y, bw, btnH]]);
    } else if (this.side) { // поля по бокам: слева удар, справа уворот и зелье — под большими пальцами, не во всю высоту
      const sw = this.side - 12;
      this.cam = [W - 136, 12, 120, 90];
      this.manual = [["pushup", [-this.side + 6, 150, sw, 120]], ["squat", [W + 6, 120, sw, 100]], ["jack", [W + 6, 230, sw, 74]]];
    } else if (this.wideMode && this.touch) { // узкий экран без полей: кнопки поверх картинки по углам
      this.cam = [W - 136, 12, 120, 90];
      this.manual = [["pushup", [10, 196, 100, 64]], ["squat", [W - 110, 168, 100, 64]], ["jack", [W - 110, 240, 100, 46]]];
    } else {
      this.cam = [W - 136, 12, 120, 90];
      this.manual = ["pushup", "squat", "jack"].map((ex, i) => [ex, [W - 136, 110 + i * 30, 120, 26]]);
    }
  }

  // --- рисование
  text(s, x, y, size = 8, color = COL.text, align = "left", shadow = true, c = this.ctx) {
    s = tr(s); // язык интерфейса
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
    s = tr(s); // переводим до переноса строк
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

  button(r, label, { selected = false, size = 8, color, fill, border } = {}) {
    this.rect(r, fill || (selected ? "rgba(70,40,30,0.85)" : "rgba(12,8,16,0.75)"));
    const c = this.ctx;
    c.strokeStyle = border || (selected ? COL.gold : "rgb(90,64,50)");
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

  /** Клавиши тестировщика: F2 — камни и пепел, F3 — следующий бой с боссом, F4 — следующая локация. */
  testKeys() {
    if (isNative()) return; // клавиши тестировщика только в браузерной версии
    const p = this.player;
    if (this.codes.includes("F2")) {
      p.redGems += 10;
      p.blueGems += 1;
      p.souls += 300;
      this.say("Тест: +10 алых, +1 синий, +300 пепла");
    }
    if (this.codes.includes("F3")) {
      p.wave = Math.ceil(p.wave / BOSS_EVERY) * BOSS_EVERY;
      this.say(`Тест: следующий бой - босс (#${p.wave})`);
    }
    if (this.codes.includes("F4")) {
      const loc = Math.min(LAST_LOCATION, locationFor(p.wave) + 1);
      p.wave = Math.max(p.wave, locationStart(loc));
      this.say(tf("Тест: {loc} (#{n})", { loc: LOCATIONS[loc].name, n: p.wave }));
    }
    if (["F2", "F3", "F4"].some((k) => this.codes.includes(k))) {
      p.frontier = Math.max(p.frontier, p.wave);
      p.save();
    }
  }

  say(text, t = 2.5) {
    this.toast = text;
    this.toastT = t;
  }

  /** Оплаченное оружие (гриф) остаётся у персонажа и после «Новой игры» и восстановления покупок. */
  syncPaid() {
    for (const [key, sw] of Object.entries(SWORDS)) {
      if (sw.paid && this.store.owns(sw.productId) && !this.player.owned.includes(key)) {
        this.player.grantPaid(key, false);
        this.player.save();
      }
    }
  }

  /** Купленный и надетый облик данного типа (sword / hit / victory) или null. */
  style(kind) {
    const id = this.profile.style[kind];
    return id && this.store.owns(id) ? id : null;
  }

  get skin() {
    const id = this.style("sword");
    return id ? COSMETIC[id].skin : null;
  }

  /** Надетый облик доспеха из лавки (например, самурайский) или null. */
  get outfit() {
    const id = this.style("armor");
    return id ? COSMETIC[id].outfit : null;
  }

  /** Сохраняет рекорд и отправляет его в рейтинг (без сети — в очередь). */
  recordProgress() {
    if (this.profile.record(this.player)) {
      this.profile.save();
      if (this.mode === "cam") this.leaderboard.submit(this.profile); // старый общий рейтинг — только для игры с камерой
      this.accountSync();
    }
  }

  /** Рекорд и характеристики героя — в аккаунт (для рейтинга и боёв с этим героем). Без сети — молча позже. */
  accountSync() {
    if (this.online.loggedIn) { // ответ сервера несёт и награды (например, облик за друга)
      this.online.sync(this.profile.best, heroSnapshot(this.player, this.skin, this.outfit)).then((r) => this.onAccount(r.account)).catch(() => {});
    }
  }

  /**
   * Облачное сохранение основного сюжета: при входе сверяем телефон и аккаунт — остаётся более свежее.
   * Пустой прогресс (новый телефон, очищенный браузер) никогда не затирает сохранение в аккаунте.
   */
  async cloudSync() {
    const o = this.online;
    if (!o.loggedIn) return;
    this.cloudReady = false;
    try {
      const r = await o.saveGet();
      const local = this.player, server = r.save ? new Player(r.save) : null, me = o.account && o.account.id;
      const foreign = !!(local.owner && me && local.owner !== me); // на телефоне — прогресс другого аккаунта
      const serverNewer = server && (foreign || (local.pristine && !server.pristine) ||
        (r.at > (local.savedAt || 0) && !(server.pristine && !local.pristine)));
      if (serverNewer) {
        this.player = Player.replace({ ...r.save, savedAt: r.at, owner: me });
        this.syncPaid();
        this.run = null;
        this.say(tf("Прогресс загружен из аккаунта: раунд {wave}, уровень {lv}", { wave: this.player.wave, lv: this.player.level }), 5);
        if (this.scene instanceof TitleScene || this.scene instanceof BonfireScene || this.scene instanceof ShopScene) this.change(new TitleScene(this));
      }
      this.cloudReady = true;
      if (!serverNewer) {
        if (this.player.owner !== me) {
          this.player.owner = me;
          this.player.save(); // прогресс с этого телефона теперь принадлежит аккаунту и уходит в него
        } else if (!local.pristine && (local.savedAt || 0) > r.at) this.cloudPush();
      }
    } catch (e) {
      this.cloudReady = false; // без сети — сверим при следующем входе
    }
  }

  /** Прогресс изменился: отправить в аккаунт (не чаще раза в пару секунд). */
  cloudQueue() {
    if (!this.cloudReady || !this.online.loggedIn) return;
    clearTimeout(this.cloudT);
    this.cloudT = setTimeout(() => this.cloudPush(), 2000);
  }

  cloudPush() {
    if (!this.cloudReady || !this.online.loggedIn) return;
    const p = this.player;
    this.online.savePut(JSON.parse(JSON.stringify(p)), p.savedAt || Date.now()).catch(() => {});
  }

  /** Вход в аккаунт: имя из аккаунта, покупки и активированные коды — на этом устройстве. */
  onAccount(acc) {
    if (!acc) return;
    if (acc.name && this.profile.rename(acc.name)) this.profile.save();
    const fresh = this.applyUnlocks(acc.unlocks || []);
    if (fresh.length) this.say(tf("Новый облик: {name}! Наденьте в Лавке образов", { name: fresh.join(", ") }), 5);
  }

  /** Платный контент, открытый кодом: облики, эффекты и гриф. Возвращает названия новых вещей. */
  applyUnlocks(ids) {
    const fresh = [];
    for (const id of ids) {
      if (!(COSMETIC[id] || id === "weapon_barbell") || this.store.owns(id)) continue;
      this.store.grant(id);
      fresh.push(COSMETIC[id] ? COSMETIC[id].name : SWORDS.barbell.name);
    }
    this.syncPaid();
    return fresh;
  }

  /** Платные вещи открываются уникальным кодом: где его получить — в Telegram. */
  async offerCode(it, kind) {
    if (kind === "tip") {
      const go = await choiceDialog({
        title: "ПОДДЕРЖАТЬ ПРОЕКТ",
        text: "Поддержать разработку можно через наш Telegram: там всё подробно.",
        buttons: [[null, "ОТМЕНА"], ["tg", "ОТКРЫТЬ TELEGRAM", true]],
      });
      if (go === "tg") openUrl(TELEGRAM_URL);
      return;
    }
    const go = await choiceDialog({
      title: "НУЖЕН КОД",
      text: tf("Чтобы получить «{name}», нужен уникальный код. Как его приобрести — подробнее в нашем Telegram.", { name: it.name }),
      note: "Код вводится здесь или в Настройках: «Ввести код».",
      buttons: [[null, "ОТМЕНА"], ["code", "ВВЕСТИ КОД"], ["tg", "ОТКРЫТЬ TELEGRAM", true]],
    });
    if (go === "tg") openUrl(TELEGRAM_URL);
    if (go === "code") await this.redeemCode();
  }

  /** Ввод кода активации (настройки). */
  async redeemCode() {
    if (!this.online.configured) return this.say("Коды пока не работают в этой версии");
    const code = await promptText({ title: "КОД АКТИВАЦИИ", text: "Введите код, например ASH-XXXX-XXXX-XXXX.", maxLength: 24, ok: "АКТИВИРОВАТЬ" });
    if (!code) return;
    try {
      const r = await this.online.redeem(code);
      const fresh = this.applyUnlocks([r.item]);
      const name = COSMETIC[r.item] ? COSMETIC[r.item].name : SWORDS.barbell.name;
      if (!fresh.length) this.say(tf("Уже есть: {name}", { name }), 4);
      else this.say(tf(COSMETIC[r.item] ? "Открыто: {name}. Наденьте в Лавке образов" : "Открыто: {name}", { name }), 4);
    } catch (e) {
      this.say(errorText(e), 4);
    }
  }

  /** Пиксельный камень 8×10: алый или синий. */
  gem(x, y, kind) {
    const c = this.ctx;
    const [dark, mid, light] = kind === "red"
      ? ["rgb(110,14,24)", "rgb(210,40,50)", "rgb(255,150,150)"]
      : ["rgb(20,40,120)", "rgb(60,110,230)", "rgb(170,210,255)"];
    const poly = (pts, color) => {
      c.fillStyle = color;
      c.beginPath();
      pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.closePath();
      c.fill();
    };
    poly([[x + 5, y + 1], [x + 9, y + 5], [x + 5, y + 11], [x + 1, y + 5]], COL.shadow);
    poly([[x + 4, y], [x + 8, y + 4], [x + 4, y + 10], [x, y + 4]], mid);
    poly([[x + 4, y + 10], [x + 8, y + 4], [x + 4, y + 5]], dark);
    c.fillStyle = light;
    c.fillRect(x + 2, y + 3, 2, 1);
  }

  /** Счётчик камней «◆ 12  ◆ 1»; align "right" — по правому краю. */
  gems(x, y, p, align = "left") {
    const c = this.ctx;
    c.font = `8px ${FONT}`;
    const red = `${p.redGems}`, blue = `${p.blueGems}`;
    const width = 12 + c.measureText(red).width + 14 + 12 + c.measureText(blue).width;
    if (align === "right") x -= width;
    this.gem(x, y - 1, "red");
    x += 12 + this.text(red, x + 12, y, 8, "rgb(240,110,110)") + 14;
    this.gem(x, y - 1, "blue");
    this.text(blue, x + 12, y, 8, "rgb(130,170,255)");
  }

  cameraWidget() {
    if (this.wideMode) return; // игра без камеры: окошко камеры не нужно
    const [x, y, w, h] = this.cam;
    this.rect([x - 2, y - 2, w + 4, h + 4], COL.shadow);
    this.ctx.strokeStyle = "rgb(60,46,50)";
    this.ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    const big = this.portrait;
    const inset = (big && this.scene.camInset) || 0; // сцена рисует поверх камеры свою «чёлку»
    if (this.motion.drawPreview(this.ctx, x, y, w, h)) {
      const d = this.motion.detector;
      this.text(d.posture, x + 4, y + h - (big ? 20 : 12), big ? 16 : 8, COL.gold);
      if (this.inPlank) { // планка — копится аура
        const sec = Math.floor(this.player.plankSeconds);
        this.text(tf("АУРА {t}", { t: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` }), x + w - 4, y + h - (big ? 20 : 12), big ? 16 : 8, "rgb(255,236,170)", "right");
      }
      if (big && !inset) {
        const c = d.counts;
        this.text(`Отжим ${c.pushup}  Присед ${c.squat}  Звезда ${c.jack}`, x + 4, y + 4, 8, COL.text);
      }
    } else {
      this.text("КАМЕРА", x + w / 2, y + inset + 8, big ? 16 : 8, COL.dim, "center");
      const lines = this.wrap(this.motion.status, big ? 36 : 14);
      lines.forEach((l, i) => this.text(l, x + w / 2, y + inset + (big ? 40 : 24) + i * 12, 8, COL.dim, "center"));
      if (big) {
        this.wrap("Поставьте телефон на пол у стены, отойдите на 2–3 м, чтобы тело было целиком в кадре.", 36)
          .forEach((l, i) => this.text(l, x + w / 2, y + inset + 100 + i * 12, 8, COL.dim, "center"));
      }
    }
  }

  /** Кнопки «ручного» упражнения: без камеры — основной ввод, с камерой — запасной. */
  manualButtons() {
    if (!this.portrait && this.motion.ok) return;
    if (this.side || (this.wideMode && this.touch && !this.portrait)) return this.sideButtons();
    const labels = this.portrait
      ? { pushup: "ОТЖИМ", squat: "ПРИСЕД", jack: "ЗВЕЗДА" }
      : { pushup: "ОТЖИМ [J]", squat: "ПРИСЕД [K]", jack: "ЗВЕЗДА [L]" };
    for (const [ex, r] of this.manual) this.button(r, labels[ex], { size: this.portrait ? (this.zoomedNow ? 24 : 16) : 8 });
  }

  /** Боковые кнопки широкого экрана: крупные, во всю высоту панели. */
  sideButtons() {
    const labels = { pushup: ["ОТЖИМ", "удар"], squat: ["ПРИСЕД", "уворот"], jack: ["ЗВЕЗДА", "зелье"] };
    const cols = { pushup: "rgb(255,170,110)", squat: "rgb(140,200,255)", jack: "rgb(150,230,140)" };
    const over = !this.side; // поверх картинки — полупрозрачные, чтобы не закрывать бой
    for (const [ex, r] of this.manual) {
      this.button(r, "", over ? { fill: "rgba(12,8,16,0.45)" } : {});
      const [a, b] = labels[ex].map(tr);
      const size = [16, 12, 8].find((sz) => a.length * sz <= r[2] - 8) || 8;
      const cy = r[1] + r[3] / 2;
      this.text(a, r[0] + r[2] / 2, cy - size, size, cols[ex], "center");
      this.text(b, r[0] + r[2] / 2, cy + 6, 8, COL.dim, "center");
    }
  }

  change(scene) {
    this.scene = scene;
  }

  frame(dt) {
    if (this.portrait && (this.usesPanel !== this.panelOn || this.zoomed !== this.zoomedNow || this.noBtns !== this.noBtnsNow)) this.resize();
    let moves = this.motion.poll();
    // клавиатура (браузер на ПК) и экранные кнопки
    const pushup = ["pushup"], squat = ["squat_down", "squat"], jack = ["jack"];
    const keyMap = {
      KeyJ: pushup, Digit1: pushup, Numpad1: pushup,
      KeyK: squat, Digit2: squat, Numpad2: squat,
      KeyL: jack, Digit3: jack, Numpad3: jack,
    };
    for (const code of this.codes) if (keyMap[code]) moves.push(...keyMap[code]);
    this.testKeys();
    if (this.portrait || !this.motion.ok) {
      for (const [ex, r] of this.manual) {
        if (this.scene.manual && this.scene.needsCamera && this.tapped(r)) {
          moves.push(...(ex === "squat" ? ["squat_down", "squat"] : [ex]));
          this.manualCounts[ex] += 1;
        }
      }
    }
    for (const m of moves) this.player.addRep(m);
    this.time += dt;
    this.plankTick(dt);
    this.scene.handle(moves);
    this.scene.update(dt);

    const w = this.wctx;
    w.imageSmoothingEnabled = false;
    w.fillStyle = "#000";
    w.fillRect(0, 0, CW, CH);
    this.scene.draw(w);

    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.side) { // боковые панели широкого экрана
      c.fillStyle = "rgb(6,4,8)";
      c.fillRect(0, 0, W + 2 * this.side, this.H);
      c.setTransform(1, 0, 0, 1, this.side, 0); // дальше всё рисуется в координатах картинки 640×360
    }
    c.fillStyle = "rgb(10,6,12)";
    c.fillRect(0, 0, W, this.H);
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      ox = Math.round(rand(-2, 2)) * 2;
      oy = Math.round(rand(-2, 2)) * 2;
    }
    if (this.zoomedNow) c.drawImage(this.world, ZOOM.sx, 0, ZOOM.sw, CH, ox, oy, W, ZOOM.h);
    else c.drawImage(this.world, ox, oy, W, GAME_H);
    this.scene.drawUi();
    if (this.side && this.scene.manual && this.scene.needsCamera) this.sideButtons();
    if (this.portrait && this.scene.needsCamera) {
      this.cameraWidget();
      if (this.scene.manual) this.manualButtons();
      if (this.scene.drawOverlay) this.scene.drawOverlay(); // кнопки и подписи поверх камеры
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      this.text(this.toast, W / 2, 4, 8, "rgb(120,220,255)", "center");
    }
    this.keys.length = 0;
    this.codes.length = 0;
    this.taps.length = 0;
  }
}

class Scene {
  constructor(game) {
    this.game = game;
    this.manual = false; // показывать кнопки ручных упражнений
  }
  /** Сейчас нужны упражнения: показать камеру и кнопки ручного ввода. */
  get needsCamera() {
    return false;
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
      ["Карта приключений", () => g.change(new MapScene(g))],
      ["Костёр: прокачка", () => g.change(new BonfireScene(g))],
      ["Лавка образов", () => g.change(new CosmeticsScene(g))],
      ["Мультиплеер", () => g.change(new MultiplayerScene(g))],
      ["Настройки", () => g.change(new SettingsScene(g))],
      ["Новая игра", () => this.newGame()],
    ];
    this.aura = new SwordAura();
    this.outfitFx = new OutfitFx(); // лепестки сакуры доспеха самурая
    this.confirmT = 0;
    this.ownsPanel = true; // в портрете меню занимает место панели камеры
    const st = game.profile.streak;
    if (st.refresh()) game.profile.save(); // пропущен день — пламя гаснет
    // окно серии огоньков — при входе в игру (раз за запуск) и сразу, если серия только что сгорела
    this.popup = !game.streakShown || st.lost > 0;
    this.popupT = 0;
    game.streakShown = true;
  }
  closePopup() {
    const g = this.game;
    this.popup = false;
    if (g.profile.streak.lost) { // «пламя погасло» показали — больше не напоминаем
      g.profile.streak.lost = 0;
      g.profile.save();
    }
    sfx.click();
  }
  newGame() {
    // Защита от случайного касания: прогресс стирается только со второго нажатия
    if (this.confirmT <= 0) {
      this.confirmT = 3;
      return;
    }
    const g = this.game;
    // сознательный сброс — уйдёт и в аккаунт; аура (время в планке) не сбрасывается
    g.player = new Player({ reset: true, plankSeconds: g.player.plankSeconds });
    g.syncPaid();
    g.player.save();
    g.run = null;
    g.change(new BonfireScene(g));
  }
  /** Крупные кнопки: на телефоне меню должно читаться с вытянутой руки. */
  rects() {
    const g = this.game, n = this.items.length;
    if (g.portrait) {
      // под картинкой: от строки статуса до низа экрана
      const top = GAME_H + 44, gap = 14;
      const h = Math.min(104, Math.floor((g.H - top - 16 - gap * (n - 1)) / n));
      const y0 = top + Math.max(0, Math.floor((g.H - top - 16 - n * h - gap * (n - 1)) / 2));
      return this.items.map((_, i) => [40, y0 + i * (h + gap), W - 80, h]);
    }
    return this.items.map((_, i) => [24, 90 + i * 41, 290, 35]);
  }
  textSize(r) {
    return this.game.portrait ? (r[3] >= 64 ? 24 : 16) : 12;
  }
  /** Иконка профиля в левом верхнем углу. */
  profileRect() {
    return this.game.portrait ? [12, 12, 76, 76] : [8, 8, 42, 42];
  }
  handle() {
    const g = this.game;
    if (this.popup) { // окно серии: любое касание или клавиша закрывает (не сразу — чтобы не смахнуть случайно)
      if (this.popupT > 0.4 && (g.taps.length || g.key("Enter", " ", "Escape"))) {
        g.taps.length = 0;
        this.closePopup();
      }
      return;
    }
    if (g.key("ArrowUp")) this.index = (this.index + this.items.length - 1) % this.items.length;
    if (g.key("ArrowDown")) this.index = (this.index + 1) % this.items.length;
    const activate = (i) => {
      sfx.click();
      this.index = i;
      this.items[i][1]();
    };
    if (g.key("Enter", " ")) return activate(this.index);
    if (g.tapped(this.profileRect()) || g.key("p", "P", "з", "З")) { sfx.click(); return g.change(new ProfileScene(g)); }
    this.rects().forEach((r, i) => { if (g.tapped(r)) activate(i); });
  }
  update(dt) {
    this.embers.update(dt);
    this.aura.update(dt, this.game.skin, "idle", 172, GROUND_TITLE - 32);
    this.outfitFx.update(dt, this.game.outfit, 172, GROUND_TITLE - 32);
    this.confirmT -= dt;
    this.popupT += dt;
  }
  draw(c) {
    const t = this.game.time;
    c.drawImage(IMG.title_bg, 0, 0);
    drawStreakFire(c, this.game.profile.streak, 208, GROUND_TITLE, t); // пламя растёт с серией огоньков
    const p = this.game.player;
    const heroIdle = anim(`${heroSprite(p.sword, p.worn, this.game.skin, this.game.outfit)}_idle`, t, 1.5, 2);
    drawPlankAura(c, 184, GROUND_TITLE, p.aura, t);
    this.aura.drawBehind(c, this.game.skin, "idle", 172, GROUND_TITLE - 32, t); // огненные крылья Феникса
    c.drawImage(heroIdle, 172, GROUND_TITLE - heroIdle.height);
    this.aura.draw(c, this.game.skin, "idle", 172, GROUND_TITLE - 32, t);
    this.outfitFx.draw(c);
    const sx = 270, sy = GROUND_TITLE - 32;
    c.drawImage(IMG.skeleton_dark_0, sx, sy);
    if (Math.floor(t * 1.3) % 5 !== 0) {
      c.fillStyle = "rgb(255,70,40)";
      c.fillRect(sx + 9, sy + 6, 1, 1);
      c.fillRect(sx + 14, sy + 6, 1, 1);
    }
    this.embers.draw(c);
    if (this.game.hard) { // хардкор: меню мрачнее — кровавая тьма и виньетка
      c.fillStyle = "rgba(14,0,4,0.5)";
      c.fillRect(0, 0, CW, CH);
      const v = c.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, 210);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(70,0,6,${0.55 + 0.08 * Math.sin(t * 1.5)})`);
      c.fillStyle = v;
      c.fillRect(0, 0, CW, CH);
      c.fillStyle = "rgba(255,40,30,0.22)"; // костёр тлеет багровым
      c.beginPath();
      c.ellipse(208, GROUND_TITLE - 2, 26, 6, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  /** Иконка профиля: герой в рамке со скруглёнными углами, спокойного цвета. */
  drawProfileIcon() {
    const g = this.game, p = g.player, [x, y, w, h] = this.profileRect(), c = g.ctx;
    const rad = g.portrait ? 14 : 8;
    const path = () => { // скруглённый прямоугольник (своим путём — работает и в старых браузерах)
      c.beginPath();
      c.moveTo(x + rad, y);
      c.arcTo(x + w, y, x + w, y + h, rad);
      c.arcTo(x + w, y + h, x, y + h, rad);
      c.arcTo(x, y + h, x, y, rad);
      c.arcTo(x, y, x + w, y, rad);
      c.closePath();
    };
    path();
    c.fillStyle = "rgba(16,12,18,0.82)";
    c.fill();
    c.save();
    path();
    c.clip(); // герой не вылезает за скруглённые углы
    const spr = anim(`${heroSprite(p.sword, p.worn, g.skin, g.outfit)}_idle`, g.time, 1.5, 2);
    const k = g.portrait ? 2 : 1, sh = Math.min(spr.height, 28); // голова и плечи
    c.drawImage(spr, 0, Math.max(0, spr.height - 32), spr.width, sh, x + (w - spr.width * k) / 2, y + 4, spr.width * k, sh * k);
    c.restore();
    path();
    c.strokeStyle = "rgb(140,128,118)";
    c.lineWidth = g.portrait ? 3 : 2;
    c.stroke();
    c.lineWidth = 1;
    g.text(`${p.level}`, x + w - (g.portrait ? 8 : 5), y + h - (g.portrait ? 22 : 12), g.portrait ? 14 : 8, "rgb(220,210,196)", "right");
  }
  drawUi() {
    const g = this.game, p = g.player, hard = g.hard;
    g.text("ASH & IRON", W / 2 + 3, 19, 40, hard ? "rgb(60,0,6)" : "rgb(120,30,26)", "center", false);
    g.text("ASH & IRON", W / 2, 16, 40, hard ? "rgb(214,60,48)" : "rgb(232,206,160)", "center", false);
    if (hard) g.text(g.mode === "btn" ? "ХАРДКОР · БЕЗ КАМЕРЫ" : "ХАРДКОР", W / 2, 66, 8, "rgb(255,80,60)", "center");
    else g.text("фитнес-RPG: тренируй тело, чтобы выжить во тьме", W / 2, 66, 8, COL.dim, "center");
    this.drawProfileIcon();
    this.rects().forEach((r, i) => {
      const confirm = i === this.items.length - 1 && this.confirmT > 0;
      g.button(r, confirm ? "Стереть? Ещё раз" : this.items[i][0],
        { selected: i === this.index, color: confirm ? COL.red : undefined, size: this.textSize(r) });
    });
    const foe = isBossWave(p.wave) ? tr("БОСС") : tr(Skeleton.NAMES[enemyKind(p.wave)]).toLowerCase();
    const status = `${tf("Ур.{lv} Пепел:{ash}", { lv: p.level, ash: p.souls })} ${tr(LOCATIONS[locationFor(p.wave)].name)}: ${foe} #${p.wave}`;
    if (g.portrait) g.text(status, W / 2, GAME_H + 14, status.length * 12 <= W - 24 ? 12 : 8, COL.text, "center");
    else g.text(status, 12, GAME_H - 16, 8, COL.dim);
    if (!g.portrait && !isNative()) g.text("ПК: J K L, тест F2-F4", W - 12, GAME_H - 16, 8, COL.dim, "right");
    const st = g.profile.streak; // подпись под костром: огоньки серии
    const fade = st.fading();
    g.text(tf("Огоньки: {n}", { n: st.points }), 416, GROUND_TITLE * 2 + 6, 8, fade ? "rgb(255,120,90)" : "rgb(255,200,110)", "center");
    if (fade) g.text("пламя гаснет!", 416, GROUND_TITLE * 2 + 18, 8, "rgb(255,120,90)", "center");
    if (this.popup) this.drawPopup();
  }
  /** Окно серии огоньков: костёр, огоньки, последние 7 дней и что делать дальше. */
  drawPopup() {
    const g = this.game, P = g.portrait, st = g.profile.streak, t = g.time, c = g.ctx;
    const today = dayKey(), lit = st.litToday(today), fade = st.fading(today), out = st.points <= 0 && st.lost > 0;
    c.fillStyle = "rgba(4,2,8,0.78)";
    c.fillRect(0, 0, W, g.H);
    const [x, y, w, h] = P ? [28, 110, W - 56, Math.min(g.H - 180, 820)] : [120, 14, 400, 332];
    g.rect([x, y, w, h], "rgba(18,12,20,0.97)");
    c.strokeStyle = fade ? "rgb(200,80,60)" : out ? "rgb(110,110,120)" : COL.gold;
    c.lineWidth = P ? 3 : 2;
    c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.lineWidth = 1;
    const cx = x + w / 2, fs = P ? 16 : 8;
    let yy = y + (P ? 24 : 12);
    g.text("СЕРИЯ ОГОНЬКОВ", cx, yy, P ? 32 : 16, COL.gold, "center");
    yy += P ? 54 : 26;
    // костёр крупно
    const fireK = P ? 6.5 : 2.5, ground = yy + (P ? 250 : 76);
    c.imageSmoothingEnabled = false;
    drawStreakFire(c, st, cx, ground, t, fireK);
    yy = ground + (P ? 14 : 8);
    const big = `${st.points}`;
    g.text(big, cx, yy, P ? 64 : 32, out ? COL.dim : fade ? "rgb(255,120,90)" : "rgb(255,200,110)", "center");
    yy += P ? 72 : 36;
    g.text(tf("огоньков в серии · дней подряд: {d}", { d: st.days }), cx, yy, fs, COL.text, "center");
    yy += P ? 26 : 14;
    g.text(tf("Рекорд: {b}", { b: st.best }), cx, yy, fs, COL.dim, "center");
    yy += P ? 40 : 20;
    // последние 7 дней: сегодня — справа
    const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"], bw = P ? 64 : 34, gap = P ? 10 : 6;
    const x0 = cx - (7 * bw + 6 * gap) / 2;
    for (let i = 0; i < 7; i++) {
      const key = shiftDay(today, i - 6), pts = st.hist[key] || 0, bx = x0 + i * (bw + gap);
      const [yr, mo, dd] = key.split("-").map(Number);
      g.rect([bx, yy, bw, bw], pts ? "rgba(90,40,16,0.9)" : "rgba(30,24,34,0.9)");
      c.strokeStyle = i === 6 ? (lit ? COL.gold : "rgb(255,120,90)") : "rgb(70,56,60)";
      c.strokeRect(bx + 0.5, yy + 0.5, bw - 1, bw - 1);
      if (pts) {
        const f = anim("bonfire", t + i * 0.13, 8, 4), k = P ? 2 : 1;
        c.drawImage(f, bx + (bw - f.width * k) / 2, yy + bw - 4 - f.height * k, f.width * k, f.height * k);
        if (pts > 1) g.text("x2", bx + bw - 3, yy + 3, P ? 12 : 8, "rgb(255,230,160)", "right");
      }
      g.text(DAYS[new Date(yr, mo - 1, dd).getDay()], bx + bw / 2, yy + bw + (P ? 6 : 3), P ? 12 : 8, i === 6 ? COL.text : COL.dim, "center");
    }
    yy += bw + (P ? 40 : 18);
    // что сейчас с пламенем
    let msg, col = COL.text;
    if (out) [msg, col] = [tf("Пламя погасло: серия из {n} огоньков сгорела. Победите врага — зажгите новый огонёк!", { n: st.lost }), "rgb(190,190,200)"];
    else if (lit) [msg, col] = ["Огонёк сегодня горит! Приходите завтра, чтобы пламя не погасло.", "rgb(150,240,150)"];
    else if (fade) [msg, col] = ["Пламя гаснет! Победите врага сегодня, иначе серия сгорит.", "rgb(255,120,90)"];
    else msg = "Победите врага — зажгите первый огонёк. Босс даёт 2 огонька.";
    for (const line of g.wrap(msg, P ? 32 : 46)) {
      g.text(line, cx, yy, fs, col, "center");
      yy += P ? 24 : 12;
    }
    yy += P ? 12 : 6;
    const tier = st.tier, next = FLAME_TIERS[tier + 1];
    const tierText = next ? tf("Пламя: {name}. До «{next}» — {n}", { name: tr(FLAME_TIERS[tier][1]), next: tr(next[1]), n: next[0] - st.points })
      : tf("Пламя: {name} — сильнее не бывает!", { name: tr(FLAME_TIERS[tier][1]) });
    g.text(tierText, cx, yy, fs, COL.gold, "center");
    g.text("Враг — 1 огонёк в день, босс — 2", cx, y + h - (P ? 64 : 30), P ? 12 : 8, COL.dim, "center");
    if (this.popupT > 0.4) g.text("Касание — продолжить", cx, y + h - (P ? 34 : 16), P ? 14 : 8, `rgba(220,210,196,${0.6 + 0.4 * Math.sin(t * 4)})`, "center");
  }
}

// ------------------------------------------------------------------ Карта приключений
const MAP_BOSS = { 1: "boss", 2: "chief", 3: "wraith", 4: "seraph" }; // кто сторожит землю (спрайт)
const MAP_SLOTS = 8; // 4 земли открыты, ещё 4 — в будущих обновлениях («?»)
const MAP_ROUNDS = 15; // раундов в земле: 3 по 5, каждый пятый — босс

/** Карта: тапнул землю — выбрал раунд — в бой. Пройденные раунды можно переиграть (без синих камней и новых боссов). */
class MapScene extends Scene {
  constructor(game) {
    super(game);
    this.ownsPanel = true;
    this.pick = null; // выбранная земля: окно с раундами
    this.msg = "";
    this.msgT = 0;
  }
  get player() {
    return this.game.player;
  }
  /** Центры земель по порядку пути и размер рамки. Горизонтально — змейкой в 2 ряда, вертикально — в 4. */
  layout() {
    const g = this.game;
    if (!g.portrait) {
      const xs = [90, 250, 410, 570];
      return { fw: 128, fh: 72, spots: Array.from({ length: MAP_SLOTS }, (_, i) => [i < 4 ? xs[i] : xs[7 - i], i < 4 ? 104 : 228]) };
    }
    const top = 190, step = Math.min(250, Math.floor((g.H - top - 300) / 3));
    const xs = [170, 470];
    return { fw: 240, fh: 135, spots: Array.from({ length: MAP_SLOTS }, (_, i) => {
      const row = Math.floor(i / 2), col = row % 2 ? 1 - (i % 2) : i % 2;
      return [xs[col], top + row * step];
    }) };
  }
  frame(i) {
    const { fw, fh, spots } = this.layout(), [x, y] = spots[i];
    return [x - fw / 2, y - fh / 2, fw, fh];
  }
  /** Раунды земли: первые три земли — по 15, Бездна бесконечна — окно из 15 вокруг передовой. */
  rounds(loc) {
    const p = this.player;
    let start = locationStart(loc);
    if (loc === LAST_LOCATION) start = Math.max(start, Math.ceil(p.frontier / BOSS_EVERY) * BOSS_EVERY - MAP_ROUNDS + 1);
    return Array.from({ length: MAP_ROUNDS }, (_, i) => start + i);
  }
  open(loc) {
    return locationStart(loc) <= this.player.frontier;
  }
  buttons() {
    const g = this.game;
    if (g.portrait) return { go: [40, g.H - 220, W - 80, 90], back: [40, g.H - 116, W - 80, 80] };
    return { go: [150, GAME_H - 42, 300, 32], back: [470, GAME_H - 42, 150, 32] };
  }
  /** Окно раундов: рамка и клетки 5×3. */
  pickLayout() {
    const g = this.game, P = g.portrait;
    const box = P ? [30, 220, W - 60, 660] : [90, 34, 460, 290];
    const cw = P ? 100 : 72, ch = P ? 110 : 50, gap = P ? 12 : 10;
    const x0 = box[0] + (box[2] - (5 * cw + 4 * gap)) / 2, y0 = box[1] + (P ? 150 : 64);
    const cells = this.rounds(this.pick).map((w, i) => [w, [x0 + (i % 5) * (cw + gap), y0 + Math.floor(i / 5) * (ch + gap), cw, ch]]);
    const close = P ? [box[0] + 40, box[1] + box[3] - 110, box[2] - 80, 80] : [box[0] + 150, box[1] + box[3] - 40, 160, 28];
    return { box, cells, close };
  }
  fight(wave) {
    const g = this.game, p = this.player;
    if (wave !== p.wave) {
      p.wave = wave;
      g.run = null; // другой раунд — бой с начала
      p.save();
    }
    sfx.click();
    g.change(new BattleScene(g));
  }
  say(msg) {
    this.msg = msg;
    this.msgT = 2.5;
  }
  handle() {
    const g = this.game, p = this.player;
    if (this.pick) {
      const L = this.pickLayout();
      for (const [w, r] of L.cells) {
        if (!g.tapped(r)) continue;
        if (w > p.frontier) { sfx.deny(); this.say(tf("Сначала пройдите раунд {n}", { n: p.frontier })); return; }
        return this.fight(w);
      }
      if (g.key("Escape") || g.tapped(L.close) || g.taps.some((t) => !inRect(t, L.box))) {
        g.taps.length = 0;
        this.pick = null;
        sfx.click();
      }
      if (g.key("Enter", " ")) return this.fight(Math.min(p.frontier, this.rounds(this.pick)[MAP_ROUNDS - 1]));
      return;
    }
    const b = this.buttons();
    if (g.key("Escape") || g.tapped(b.back)) { sfx.click(); return g.change(new TitleScene(g)); }
    if (g.key("Enter", " ") || g.tapped(b.go)) return this.fight(p.wave);
    for (let i = 0; i < MAP_SLOTS; i++) {
      if (!g.tapped(this.frame(i))) continue;
      const loc = i + 1;
      if (!LOCATIONS[loc]) { sfx.deny(); return this.say("Эта земля откроется в будущих обновлениях"); }
      if (!this.open(loc)) { sfx.deny(); return this.say(tf("Закрыто: победите босса раунда {n}", { n: locationStart(loc) - 1 })); }
      sfx.click();
      this.pick = loc;
    }
  }
  update(dt) {
    this.msgT -= dt;
  }
  draw(c) {
    c.drawImage(IMG.title_bg, 0, 0);
  }
  drawUi() {
    const g = this.game, c = g.ctx, P = g.portrait, t = g.time, p = this.player;
    c.fillStyle = "rgb(14,10,16)";
    c.fillRect(0, 0, W, g.H);
    c.imageSmoothingEnabled = false;
    g.text("КАРТА ПРИКЛЮЧЕНИЙ", W / 2, P ? 40 : 10, P ? 32 : 16, COL.gold, "center");
    g.text(tf("Передовая: раунд {n}", { n: p.frontier }), W / 2, P ? 86 : 32, P ? 16 : 8, COL.dim, "center");
    const { spots } = this.layout(), cur = locationFor(p.wave);
    // путь между землями: пунктир, к закрытым — бледнее
    for (let i = 0; i + 1 < MAP_SLOTS; i++) {
      const [x0, y0] = spots[i], [x1, y1] = spots[i + 1], n = Math.round(Math.hypot(x1 - x0, y1 - y0) / (P ? 16 : 9));
      const lit = LOCATIONS[i + 2] && this.open(i + 2);
      c.fillStyle = lit ? "rgb(150,110,70)" : "rgb(60,50,56)";
      for (let k = 1; k < n; k += 2) {
        const s = P ? 5 : 3;
        c.fillRect(Math.round(x0 + (x1 - x0) * k / n) - s / 2, Math.round(y0 + (y1 - y0) * k / n) - s / 2, s, s);
      }
    }
    for (let i = 0; i < MAP_SLOTS; i++) this.drawSpot(i, i + 1 === cur);
    const b = this.buttons();
    g.button(b.go, tf("В БОЙ: раунд {n}", { n: p.wave }), { size: P ? 24 : 12, ...GO_STYLE });
    g.button(b.back, "НАЗАД", { size: P ? 24 : 12 });
    if (this.pick) this.drawPick();
    if (this.msgT > 0) {
      const y = P ? g.H - 270 : GAME_H - 62;
      g.rect([0, y - 4, W, P ? 30 : 16], "rgba(0,0,0,0.75)");
      g.text(this.msg, W / 2, y, P ? 16 : 8, "rgb(255,140,110)", "center");
    }
  }
  /** Земля на карте: картинка локации в рамке, босс в углу, подпись; будущие — туман и «?». */
  drawSpot(i, here) {
    const g = this.game, c = g.ctx, P = g.portrait, t = g.time, p = this.player;
    const loc = i + 1, L = LOCATIONS[loc], [x, y, w, h] = this.frame(i), fs = P ? 14 : 8;
    if (!L) { // будущая земля
      g.rect([x, y, w, h], "rgb(26,22,30)");
      for (let k = 0; k < 6; k++) { // туман
        c.fillStyle = `rgba(90,84,100,${0.08 + 0.04 * Math.sin(t + k)})`;
        c.fillRect(x + ((k * 37 + t * 6) % w), y + (k * 13) % h, w / 3, h / 4);
      }
      c.strokeStyle = "rgb(70,62,74)";
      c.setLineDash([P ? 8 : 4, P ? 6 : 3]);
      c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      c.setLineDash([]);
      g.text("?", x + w / 2, y + h / 2 - (P ? 28 : 14), P ? 56 : 28, `rgba(200,190,210,${0.6 + 0.25 * Math.sin(t * 2 + i)})`, "center");
      g.text("Скоро", x + w / 2, y + h + (P ? 8 : 4), fs, COL.dim, "center");
      return;
    }
    const open = this.open(loc), rs = this.rounds(loc);
    const bg = IMG[L.bg];
    c.drawImage(bg, 40, 30, 240, 135, x, y, w, h);
    const boss = IMG[`${MAP_BOSS[loc]}_idle_0`];
    if (boss) { // страж земли — в правом нижнем углу
      const k = P ? 2 : 1, bh = Math.min(boss.height * k, h - 6), bw = boss.width * bh / boss.height;
      c.drawImage(boss, x + w - bw - 4, y + h - bh - 2, bw, bh);
    }
    const done = p.frontier > rs[MAP_ROUNDS - 1] && loc !== LAST_LOCATION;
    if (!open) {
      g.rect([x, y, w, h], "rgba(0,0,0,0.7)");
      g.text("ЗАКРЫТО", x + w / 2, y + h / 2 - fs, fs, COL.dim, "center");
      g.text(tf("после раунда {n}", { n: locationStart(loc) - 1 }), x + w / 2, y + h / 2 + fs / 2, P ? 12 : 8, COL.dim, "center");
    }
    if (done) { // значок «пройдено» в углу рамки
      const bw = P ? 110 : 64, bh = P ? 24 : 12;
      g.rect([x + w - bw - 2, y + 2, bw, bh], "rgba(20,50,20,0.9)");
      g.text("ПРОЙДЕНО", x + w - bw / 2 - 2, y + 2 + (P ? 5 : 2), P ? 12 : 8, "rgb(150,230,140)", "center");
    }
    c.strokeStyle = here ? COL.gold : done ? "rgb(110,170,100)" : open ? "rgb(140,110,80)" : "rgb(60,52,58)";
    c.lineWidth = here ? (P ? 4 : 2) : P ? 2 : 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.lineWidth = 1;
    g.text(L.name, x + w / 2, y + h + (P ? 8 : 4), fs, open ? COL.text : COL.dim, "center");
    const range = loc === LAST_LOCATION ? `${locationStart(loc)}+` : `${rs[0]}–${rs[MAP_ROUNDS - 1]}`;
    g.text(tf("раунды {r}", { r: range }), x + w / 2, y + h + (P ? 28 : 14), P ? 12 : 8, done ? "rgb(150,220,140)" : COL.dim, "center");
    if (here) { // герой стоит на своей земле
      const spr = anim(`${heroSprite(p.sword, p.worn, g.skin, g.outfit)}_idle`, t, 1.5, 2), k = P ? 2 : 1;
      c.drawImage(spr, x + 4, y + h - 2 - spr.height * k - Math.round(Math.abs(Math.sin(t * 3)) * 2 * k), spr.width * k, spr.height * k);
    }
  }
  /** Окно выбора раунда в земле. */
  drawPick() {
    const g = this.game, c = g.ctx, P = g.portrait, t = g.time, p = this.player, L = this.pickLayout();
    c.fillStyle = "rgba(4,2,8,0.75)";
    c.fillRect(0, 0, W, g.H);
    const [x, y, w, h] = L.box;
    g.rect(L.box, "rgba(20,14,22,0.98)");
    c.strokeStyle = COL.gold;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.text(tr(LOCATIONS[this.pick].name).toUpperCase(), x + w / 2, y + (P ? 30 : 12), P ? 28 : 16, COL.gold, "center");
    g.text("Выберите раунд. Каждый пятый — босс", x + w / 2, y + (P ? 80 : 36), P ? 14 : 8, COL.dim, "center");
    for (const [wv, [cx, cy, cw, ch]] of L.cells) {
      const boss = isBossWave(wv), locked = wv > p.frontier, front = wv === p.frontier, cur = wv === p.wave;
      g.rect([cx, cy, cw, ch], locked ? "rgba(26,22,30,0.9)" : front ? "rgba(80,56,20,0.95)" : boss ? "rgba(60,16,18,0.95)" : "rgba(30,44,30,0.95)");
      c.strokeStyle = cur ? COL.gold : front ? `rgba(255,210,120,${0.6 + 0.4 * Math.sin(t * 5)})` : "rgb(80,66,62)";
      c.lineWidth = cur || front ? (P ? 3 : 2) : 1;
      c.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
      c.lineWidth = 1;
      g.text(`${wv}`, cx + cw / 2, cy + (P ? 14 : 6), P ? 24 : 12, locked ? COL.dim : boss ? "rgb(255,120,100)" : COL.text, "center");
      const note = locked ? "закрыто" : front ? "новый" : boss ? "БОСС" : "пройден";
      g.text(note, cx + cw / 2, cy + ch - (P ? 30 : 14), P ? 12 : 8,
        locked ? "rgb(90,84,96)" : front ? COL.gold : boss ? "rgb(255,120,100)" : "rgb(140,200,130)", "center");
    }
    g.button(L.close, "ЗАКРЫТЬ", { size: P ? 24 : 12 });
  }
}

// ------------------------------------------------------------------ Профиль игрока
class ProfileScene extends Scene {
  constructor(game) {
    super(game);
    this.rank = null; // место в рейтинге своего режима (с сервера)
    this.ownsPanel = true;
    const o = game.online;
    if (o.loggedIn) {
      o.me().then((r) => game.onAccount(r.account)).catch(() => {});
      o.top(game.mode).then((r) => (this.rank = r.rank)).catch(() => {});
    }
  }
  buttons() {
    const g = this.game;
    if (g.portrait) return { back: [24, g.H - 196, W - 48, 80], exit: [24, g.H - 100, W - 48, 80] };
    return { back: [24, GAME_H - 40, 200, 30], exit: [W - 224, GAME_H - 40, 200, 30] };
  }
  /** Выйти из игры: в приложении — закрыть его, в браузере — вернуться на стартовый экран. */
  async exitGame() {
    const ok = await confirmDialog({ title: "ВЫЙТИ ИЗ ИГРЫ?", text: "Прогресс сохранён. Вернуться на стартовый экран?", ok: "ВЫЙТИ" });
    if (!ok) return;
    const app = globalThis.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (app && app.exitApp) return app.exitApp();
    location.reload();
  }
  handle() {
    const g = this.game, b = this.buttons();
    if (g.key("Escape") || g.tapped(b.back)) { sfx.click(); return g.change(new TitleScene(g)); }
    if (g.tapped(b.exit)) { sfx.click(); this.exitGame(); }
  }
  draw(c) {
    c.drawImage(IMG.title_bg, 0, 0);
    c.fillStyle = this.game.hard ? "rgba(20,0,6,0.78)" : "rgba(0,0,0,0.72)";
    c.fillRect(0, 0, CW, CH);
  }
  /** Строки статистики: [подпись, значение, цвет]. */
  rows() {
    const g = this.game, p = g.player, o = g.online, acc = o.loggedIn ? o.account : null, best = g.profile.best;
    const A = COL.gold, B = "rgb(150,190,255)", R = "rgb(255,110,90)", Gr = "rgb(150,230,140)";
    const rows = [
      ["Режим", `${tr(g.mode === "cam" ? "С камерой" : "Без камеры")} · ${tr(g.hard ? "хардкор" : "обычная")}`, g.hard ? R : COL.text],
      ["Уровень", `${p.level}`, A],
      ["Навыки", `${tr("Сила")} ${p.strength} · ${tr("Живучесть")} ${p.vigor} · ${tr("Выносливость")} ${p.endurance}`, A],
      ["Локация", `${tr(LOCATIONS[locationFor(p.wave)].name)}, ${tr("раунд")} ${p.wave}`, COL.text],
      ["Боссов побеждено", `${p.bossesDefeated}`, R],
      ["Рекорд", `${tr("раунд")} ${best.wave} · ${tr("ур.")} ${best.level} · ${tr("боссы")} ${best.bosses}`, A],
      ["Место в рейтинге", !acc ? tr("войдите в аккаунт") : this.rank ? `#${this.rank}` : "...", B],
    ];
    if (acc) {
      rows.push(["Медали дуэлей", `${acc.medals || 0}`, A]);
      rows.push(["Лестница вызовов", `#${acc.arena_pos}`, B]);
    }
    const st = g.profile.streak;
    rows.push(["Серия огоньков", tf("{n} · дней подряд: {d} · рекорд {b}", { n: st.points, d: st.days, b: st.best }), "rgb(255,200,110)"]);
    rows.push(["Пепел · камни", `${p.souls} · ${tr("алые")} ${p.redGems} · ${tr("синие")} ${p.blueGems}`, COL.text]);
    rows.push(["Снаряжение", `${tr(p.weapon.name)}${p.armor ? ` · ${tr(RELICS[p.armor].name)}` : ""}`, COL.text]);
    if (g.mode === "cam") { // аура — за время в планке
      const sec = Math.floor(p.plankSeconds), mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, "0");
      rows.push(["Аура (время в планке)", tf("{t} · +{pct}% к урону, здоровью и силам", { t: `${mm}:${ss}`, pct: (p.aura * 100).toFixed(1) }), "rgb(255,230,160)"]);
    }
    if (g.mode === "cam") { // упражнения считаются только с камерой
      const r = p.totalReps, sum = r.pushup + r.squat + r.jack;
      rows.push(["Отжимания", `${r.pushup}`, Gr]);
      rows.push(["Приседания", `${r.squat}`, Gr]);
      rows.push(["Звёздочки", `${r.jack}`, Gr]);
      rows.push(["Всего упражнений", `${sum}`, Gr]);
    }
    return rows;
  }
  drawUi() {
    const g = this.game, P = g.portrait, o = g.online, b = this.buttons();
    if (P) g.rect([0, GAME_H, W, g.H - GAME_H], "rgba(10,6,14,1)");
    g.text("ПРОФИЛЬ", W / 2, P ? 18 : 12, P ? 36 : 20, g.hard ? "rgb(214,60,48)" : COL.gold, "center");
    const who = o.loggedIn ? tf("{name} · аккаунт {login}", { name: g.profile.name, login: o.account.login }) : g.profile.name;
    g.text(who, W / 2, P ? 64 : 38, P ? 16 : 8, "rgb(150,220,150)", "center");
    // герой крупно
    const p = g.player, spr = anim(`${heroSprite(p.sword, p.worn, g.skin, g.outfit)}_idle`, g.time, 1.5, 2), k = P ? 5 : 3;
    const hx = P ? W - 30 - spr.width * k : W - 40 - spr.width * k, hy = P ? 300 - spr.height * k : 300 - spr.height * k;
    g.ctx.drawImage(spr, hx, hy, spr.width * k, spr.height * k);
    const rows = this.rows(), fs = P ? 20 : 8, step = P ? Math.min(66, Math.floor((g.H - 330 - 216) / rows.length))
      : Math.min(18, Math.floor((GAME_H - 46 - 56) / rows.length)); // все строки — над кнопками
    const x = P ? 24 : 24, vx = P ? 24 : 210;
    let y = P ? 330 : 56; // в портрете строки — под героем
    for (const [label, value, col] of rows) {
      if (P) {
        g.text(label, x, y, 14, COL.dim);
        g.text(value, vx, y + 20, value.length * fs <= W - 48 ? fs : value.length * 16 <= W - 48 ? 16 : 12, col);
      } else {
        g.text(label, x, y, fs, COL.dim);
        g.text(value, vx, y, fs, col);
      }
      y += step;
    }
    g.button(b.back, "НАЗАД", { size: P ? 24 : 12 });
    g.button(b.exit, "ВЫЙТИ ИЗ ИГРЫ", { size: P ? 24 : 12, color: "rgb(255,120,100)", border: "rgb(150,40,40)" });
  }
}

// ------------------------------------------------------------------ Костёр
const BONFIRE_BUTTONS = [[[20, 216, 92, 26], "В БОЙ"], [[118, 216, 96, 26], "КУЗНИЦА"], [[220, 216, 90, 26], "МЕНЮ"]];
const GO_STYLE = { fill: "rgba(24,70,30,0.92)", border: "rgb(110,220,110)", color: "rgb(150,250,150)" }; // «В БОЙ»
const RITUAL_TAB_H = 92; // «чёлка» с повторениями поверх окна камеры
const PUNCHES_TO_FIGHT = 3; // столько ударов (бокс) подряд у костра — и в бой
const PUNCH_WINDOW = 3; // ...за столько секунд

class BonfireScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = true;
    this.meditate = true; // планка у костра — медитация, копится аура
    this.embers = new Particles(216, 116, 26);
    this.ritual = null; // {stat, ex, need, done}
    this.punches = []; // время последних ударов (бокс): серия — «В БОЙ»
    this.denyAt = -9;
    this.say("Костёр зажжён. Здоровье и зелья восстановлены.");
    this.index = 0;
    game.run = null; // отдых у костра
  }
  say(msg, t = 3.5) {
    this.message = msg;
    this.msgT = t;
  }
  get needsCamera() {
    // на телефоне вертикально костёр — место прокачки: камера внизу, кнопки под ней;
    // в альбомной ориентации окошко камеры появляется только на время ритуала
    return this.game.portrait || !!this.ritual;
  }
  get camInset() {
    return this.ritual ? RITUAL_TAB_H : 0;
  }
  /** В портрете — крупные панели навыков, кнопки переезжают под камеру. */
  statRows() {
    if (this.game.portrait) return Object.keys(STATS).map((st, i) => [st, [16, 66 + i * 98, 400, 90]]);
    return Object.keys(STATS).map((st, i) => [st, [20, 92 + i * 40, 290, 36]]);
  }
  /** «В БОЙ», «КУЗНИЦА», «МЕНЮ»: в портрете — на месте кнопок упражнений под камерой. */
  navButtons() {
    const g = this.game;
    if (!g.portrait) return BONFIRE_BUTTONS;
    return g.manual.map(([, r], j) => [r, BONFIRE_BUTTONS[j][1]]);
  }
  cancelRect() {
    const g = this.game;
    if (!g.portrait) return [W / 2 - 70, GAME_H - 26, 140, 22];
    const [x, y, w, h] = g.cam;
    return [x + w / 2 - 120, y + h - 62, 240, 50];
  }
  startRitual(stat, auto = false) {
    const p = this.game.player;
    if (!p.canLevel()) {
      if (auto && this.game.time - this.denyAt < 2.5) return; // упражнение без пепла: сигнал не на каждый повтор
      this.denyAt = this.game.time;
      sfx.deny();
      return this.say(`Нужно ${p.levelCost()} пепла, у вас ${p.souls}. Победите скелетов!`);
    }
    this.ritual = { stat, ex: STATS[stat][1], need: p.repsNeeded(stat), done: 0 };
    return true;
  }
  /** Подсказка для игры с камерой: упражнение — прокачка, бокс — в бой (и сколько ударов уже было). */
  camHint(x, y, size, center = true) {
    const g = this.game;
    if (!g.motion.ok || this.ritual) return;
    const t = g.time, hits = this.punches.filter((p) => t - p < PUNCH_WINDOW).length;
    const marks = Array.from({ length: PUNCHES_TO_FIGHT }, (_, i) => (i < hits ? "#" : "-")).join(" ");
    const align = center ? "center" : "left";
    if (g.inPlank) g.text(tf("Медитация: аура +{pct}%", { pct: (g.player.aura * 100).toFixed(1) }), x, y, size, "rgb(255,236,170)", align);
    else g.text(g.mode === "cam" ? "Упражнение — навык, планка — аура" : "Упражнение — прокачка навыка", x, y, size, COL.text, align);
    g.text(tf("Бокс: {n} удара — в бой!  {m}", { n: PUNCHES_TO_FIGHT, m: marks }), x, y + size + 6, size, hits ? "rgb(150,250,150)" : COL.gold, align);
  }
  /** Бокс у костра: PUNCHES_TO_FIGHT ударов за PUNCH_WINDOW секунд — в бой. */
  punch() {
    const g = this.game, t = g.time;
    this.punches = this.punches.filter((x) => t - x < PUNCH_WINDOW).concat(t);
    sfx.hit();
    if (this.punches.length < PUNCHES_TO_FIGHT) return false;
    this.punches = [];
    sfx.alert();
    g.change(new BattleScene(g));
    return true;
  }
  handle(moves) {
    const g = this.game, p = g.player;
    if (this.ritual) {
      if (g.key("Escape") || g.tapped(this.cancelRect())) {
        this.ritual = null;
        return this.say("Ритуал прерван. Пепел не потрачен.");
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
        g.recordProgress();
        this.ritual = null;
        this.say(tf("{stat} повышена до {n}!", { stat: STATS[st][0], n: p[st] }), 4);
        this.embers.rate = 120;
        sfx.level();
        vibrate([60, 40, 120]);
      }
      return;
    }
    // с камерой: начал упражнение — сразу начинается прокачка навыка (как нажатие на навык),
    // бокс — серия ударов — ведёт в бой
    for (const m of moves) {
      if (m === "punch" && this.punch()) return;
      const stat = Object.keys(STATS).find((st) => STATS[st][1] === m);
      if (stat && this.startRitual(stat, true)) {
        this.ritual.done = 1; // это повторение уже засчитано
        this.index = Object.keys(STATS).indexOf(stat);
        sfx.rep();
        return;
      }
    }
    const rows = this.statRows();
    const n = rows.length + 3;
    if (g.key("ArrowUp")) this.index = (this.index + n - 1) % n;
    if (g.key("ArrowDown")) this.index = (this.index + 1) % n;
    const activate = (i) => {
      sfx.click();
      this.index = i;
      if (i < rows.length) this.startRitual(rows[i][0]);
      else if (i === rows.length) g.change(new BattleScene(g));
      else if (i === rows.length + 1) g.change(new ShopScene(g));
      else g.change(new TitleScene(g));
    };
    if (g.key("Enter", " ")) return activate(this.index);
    if (g.key("Escape")) return g.change(new TitleScene(g));
    rows.forEach(([, r], i) => { if (g.tapped(r)) activate(i); });
    this.navButtons().forEach(([r], j) => { if (g.tapped(r)) activate(rows.length + j); });
  }
  update(dt) {
    this.manual = !!this.ritual; // кнопки ОТЖИМ/ПРИСЕД/ЗВЕЗДА нужны только в ритуале
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
    if (this.game.portrait) return; // на телефоне вертикально костёр и рыцарь рисуются крупно рядом с панелями
    c.drawImage(anim("bonfire", t, 8, 4), 200, GROUND_TITLE - 44, 32, 44);
    const p = this.game.player, hs = heroSprite(p.sword, p.worn, this.game.skin, this.game.outfit);
    if (this.game.inPlank) {
      drawPlankAura(c, 180, GROUND_TITLE - meditateLift(t), p.aura, t);
      drawMeditating(c, meditateSprite(p.worn, this.game.outfit, t), 168, GROUND_TITLE, t);
    } else {
      const hero = this.ritual && this.ritual.done % 2 ? IMG[`${hs}_attack_0`] : IMG[`${hs}_idle_0`];
      drawPlankAura(c, 180, GROUND_TITLE, p.aura, t);
      c.drawImage(hero, 168, GROUND_TITLE - hero.height);
    }
    this.embers.draw(c);
  }
  drawUi() {
    if (this.game.portrait) return this.drawPortrait();
    const g = this.game, p = g.player;
    g.rect([12, 12, 306, 260], "rgba(10,6,14,0.8)");
    g.ctx.strokeStyle = "rgb(90,64,50)";
    g.ctx.strokeRect(12.5, 12.5, 305, 259);
    g.text("КОСТЁР", 22, 22, 16, COL.gold);
    g.text(`Уровень ${p.level}`, 22, 46, 8);
    g.text(`Пепел: ${p.souls}`, 160, 46, 8, COL.gold);
    g.text(`Цена уровня: ${p.levelCost()} пепла`, 22, 62, 8, COL.dim);
    g.gems(310, 22, p, "right");
    g.text("Нажмите на навык:", 22, 78, 8, COL.dim);
    this.statRows().forEach(([st, r], i) => {
      const [name, ex, desc] = STATS[st];
      g.button(r, "", { selected: this.index === i });
      g.text(`${name} ${p[st]}`, r[0] + 8, r[1] + 7, 8, this.index === i ? COL.gold : COL.text);
      g.text(`${NAMES[ex]} x${p.repsNeeded(st)}: ${desc}`, r[0] + 8, r[1] + 21, 8, COL.dim);
    });
    BONFIRE_BUTTONS.forEach(([r, label], j) => g.button(r, label, { selected: this.index === 3 + j, ...(j === 0 ? GO_STYLE : {}) }));
    g.text(`Урон ${p.damage}  Здоровье ${p.maxHp}  Силы ${p.maxStamina}`, 22, 248, 8, COL.dim);
    const tr = p.totalReps;
    g.text(`Всего: отжим ${tr.pushup} присед ${tr.squat} звезда ${tr.jack}`, 22, 260, 8, COL.text);
    if (!g.portrait && this.needsCamera) {
      g.cameraWidget();
      g.manualButtons();
    }

    if (this.ritual) {
      const { stat, ex, need, done } = this.ritual;
      g.rect([0, GAME_H - 84, W, 84], "rgba(0,0,0,0.85)");
      g.text(tf("Ритуал: {stat}", { stat: STATS[stat][0] }), W / 2, GAME_H - 78, 8, COL.dim, "center");
      g.text(`${NAMES[ex]}: ${done} / ${need}`, W / 2, GAME_H - 64, 16, COL.gold, "center");
      g.bar(W / 2 - 150, GAME_H - 40, 300, 8, done / need, "rgb(230,140,50)");
      g.button([W / 2 - 70, GAME_H - 26, 140, 22], "ПРЕРВАТЬ");
    } else {
      this.camHint(W / 2, 284, 8);
      if (this.msgT > 0) g.wrap(this.message, 76).forEach((l, i) => g.text(l, W / 2, GAME_H - 36 + i * 12, 8, COL.gold, "center"));
    }
  }

  /** Телефон вертикально: панель навыков сверху, камера с «чёлкой» ритуала и кнопки внизу. */
  drawPortrait() {
    const g = this.game, p = g.player;
    g.rect([8, 8, W - 16, GAME_H - 12], "rgba(10,6,14,0.6)"); // костёр просвечивает сквозь панель
    g.text("КОСТЁР", 18, 14, 24, COL.gold);
    g.text(`Ур. ${p.level}  Пепел: ${p.souls}`, 18, 44, 12, COL.gold);
    g.gems(W - 18, 14, p, "right");
    g.text(`Урон ${p.damage}  Здоровье ${p.maxHp}  Силы ${p.maxStamina}`, W - 18, 32, 8, COL.dim, "right");
    g.text(`Цена уровня: ${p.levelCost()} пепла`, W - 18, 48, 8, COL.dim, "right");
    this.statRows().forEach(([st, r], i) => {
      const [name, ex, desc] = STATS[st];
      const active = this.ritual ? this.ritual.stat === st : this.index === i;
      g.button(r, "", { selected: active, fill: active ? "rgba(70,40,30,0.85)" : "rgba(12,8,16,0.8)" });
      g.text(`${name} ${p[st]}`, r[0] + 14, r[1] + 10, 24, active ? COL.gold : COL.text);
      g.text(`${NAMES[ex]} x${p.repsNeeded(st)}`, r[0] + 14, r[1] + 42, 16, COL.text);
      g.text(desc, r[0] + 14, r[1] + 66, 12, COL.dim);
    });
    this.drawCamp(g.ctx, 424, 326);
  }

  /** Рыцарь у костра справа от панелей (крупно, ×3), во время ритуала «тренируется». */
  drawCamp(c, x, ground) {
    const g = this.game, t = g.time, p = g.player;
    const r = 92 + Math.round(Math.sin(t * 5) * 6);
    c.fillStyle = "rgba(255,120,40,0.22)";
    c.beginPath();
    c.ellipse(x + 130, ground - 4, r, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.imageSmoothingEnabled = false;
    const hs = heroSprite(p.sword, p.worn, g.skin, g.outfit);
    if (g.inPlank) {
      drawPlankAura(c, x + 48, ground - meditateLift(t) * 3, p.aura, t, 3);
      drawMeditating(c, meditateSprite(p.worn, g.outfit, t), x + 12, ground, t, 3);
    } else {
      const hero = this.ritual && this.ritual.done % 2 ? IMG[`${hs}_attack_0`] : IMG[`${hs}_idle_0`];
      drawPlankAura(c, x + 48, ground, p.aura, t, 3);
      c.drawImage(hero, x + 12, ground - hero.height * 3, hero.width * 3, hero.height * 3);
    }
    const fire = anim("bonfire", t, 8, 4);
    c.drawImage(fire, x + 112, ground - fire.height * 3, fire.width * 3, fire.height * 3);
  }

  drawOverlay() {
    const g = this.game;
    const [x, y, w] = g.cam;
    if (this.msgT > 0 && !this.ritual) { // сообщение костра — плашкой у верхнего края камеры
      const lines = g.wrap(this.message, 34);
      g.rect([x + 20, y, w - 40, 16 + lines.length * 22], "rgba(10,6,14,0.88)");
      lines.forEach((l, i) => g.text(l, x + w / 2, y + 10 + i * 22, 16, COL.gold, "center"));
    }
    if (this.ritual) {
      // «чёлка» поверх верхнего края окна камеры: сколько повторений осталось
      const { stat, ex, need, done } = this.ritual;
      const tw = Math.min(w - 40, 460), tx = x + (w - tw) / 2;
      g.rect([tx, y, tw, RITUAL_TAB_H], "rgba(10,6,14,0.88)");
      g.ctx.strokeStyle = COL.gold;
      g.ctx.strokeRect(tx + 0.5, y + 0.5, tw - 1, RITUAL_TAB_H - 1);
      g.text(tf("Ритуал: {stat}", { stat: STATS[stat][0] }), x + w / 2, y + 8, 12, COL.dim, "center");
      g.text(`${NAMES[ex]}: ${done} / ${need}`, x + w / 2, y + 28, 24, COL.gold, "center");
      g.bar(tx + 24, y + 64, tw - 48, 12, done / need, "rgb(230,140,50)");
      g.button(this.cancelRect(), "ПРЕРВАТЬ", { size: 16 });
    } else {
      if (g.motion.ok) {
        const [, , , h] = g.cam;
        g.rect([x + 20, y + h - 64, w - 40, 56], "rgba(10,6,14,0.8)");
        this.camHint(x + w / 2, y + h - 56, 14);
      }
      this.navButtons().forEach(([r, label], j) =>
        g.button(r, label, { size: 16, selected: this.index === 3 + j, ...(j === 0 ? GO_STYLE : {}) }));
    }
  }
}

// ------------------------------------------------------------------ Бой
/** Враг волны: скелет, разбойник, зомби, летучая мышь или босс локации. */
class Skeleton {
  static NAMES = {
    skeleton: "Скелет-страж", bandit: "Разбойник", knight: "Костяной Рыцарь", chief: "Глава разбойников",
    zombie: "Зомби", bat: "Летучая мышь", wraith: "Король-Призрак",
    imp: "Бес", hound: "Адская гончая", husk: "Пустой", seraph: "Алый Серафим",
  };
  static BOSSES = ["knight", "chief", "wraith", "seraph"];
  static FLYING = ["bat", "imp"]; // висят в воздухе и пикируют при атаке

  constructor(wave) {
    this.wave = wave;
    this.kind = enemyKind(wave);
    this.boss = Skeleton.BOSSES.includes(this.kind);
    this.name = Skeleton.NAMES[this.kind];
    // баланс под обычного человека без спортивной подготовки
    const baseHp = 50 + 15 * (wave - 1);
    const baseDmg = 12 + 2 * (wave - 1);
    this.windupTime = Math.max(1.6, 2.3 - 0.04 * wave); // время на реакцию (присед)
    this.maxPoise = 3;
    this.comboChance = wave >= 4 ? 0.25 : 0;
    this.maxCombo = 1;
    this.maxHp = baseHp;
    this.damage = baseDmg;
    this.steal = 0; // сколько пепла крадёт удар
    this.potion = false; // глава разбойников один раз пьёт зелье
    this.reincarnate = false; // Король-Призрак один раз встаёт после смерти
    this.hard = false; // хардкор (makeHard)
    this.jitter = 0; // разброс длины замаха
    this.idleRange = [1.6, 3]; // пауза между атаками
    this.windupNow = 0; // длина текущего замаха
    this.aura = 0; // доля здоровья героя, которую аура сжигает каждую секунду (Алый Серафим)
    this.stage2 = false; // Алый Серафим: вторая стадия с половины здоровья
    this.transforms = false;
    this.homeX = 200;
    if (this.kind === "bandit") { // быстрый и хлипкий, крадёт пепел
      this.maxHp = Math.floor(baseHp * 0.8);
      this.damage = Math.floor(baseDmg * 0.9);
      this.windupTime = Math.max(1.5, this.windupTime * 0.9);
      this.comboChance = 0.35;
      this.steal = 10 + wave;
    } else if (this.kind === "knight") {
      this.maxHp = Math.floor(baseHp * 1.6);
      this.damage = Math.floor(baseDmg * 1.15);
      this.windupTime += 0.3; // тяжёлый двуручник замахивается дольше
      this.maxPoise = 5;
      this.comboChance = 0.4; // серии до трёх ударов
      this.maxCombo = 2;
      this.homeX = 188;
    } else if (this.kind === "chief") {
      this.maxHp = Math.floor(baseHp * 1.6);
      this.damage = Math.floor(baseDmg * 0.75); // бьёт всегда дважды, поэтому каждый удар слабее
      this.maxPoise = 5;
      this.comboChance = 0.7; // две сабли — чаще всего двойной удар
      this.steal = 20 + 2 * wave;
      this.potion = true;
      this.homeX = 184;
    } else if (this.kind === "zombie") { // медленный и живучий
      this.maxHp = Math.floor(baseHp * 1.3);
      this.damage = Math.floor(baseDmg * 1.1);
      this.windupTime += 0.2;
      this.comboChance = 0.15;
    } else if (this.kind === "bat") { // хрупкая, но кусает быстро и сериями
      this.maxHp = Math.floor(baseHp * 0.6);
      this.damage = Math.floor(baseDmg * 0.8);
      this.windupTime = Math.max(1.5, this.windupTime * 0.85);
      this.comboChance = 0.4;
    } else if (this.kind === "wraith") { // Король-Призрак: серии ударов и одно возрождение
      this.maxHp = Math.floor(baseHp * 1.6);
      this.damage = Math.floor(baseDmg * 1.1);
      this.windupTime += 0.2;
      this.maxPoise = 5;
      this.comboChance = 0.4;
      this.maxCombo = 2;
      this.reincarnate = true;
      this.homeX = 184;
    } else if (this.kind === "imp") { // бес: хрупкий, быстрый, кусает сериями
      this.maxHp = Math.floor(baseHp * 0.65);
      this.damage = Math.floor(baseDmg * 0.85);
      this.windupTime = Math.max(1.5, this.windupTime * 0.85);
      this.comboChance = 0.45;
      this.maxCombo = 2;
    } else if (this.kind === "hound") { // гончая: короткий бросок и тяжёлый укус
      this.maxHp = baseHp;
      this.damage = Math.floor(baseDmg * 1.3);
      this.windupTime = Math.max(1.5, this.windupTime * 0.9);
      this.comboChance = 0.1;
    } else if (this.kind === "husk") { // Пустой: живучий, бьёт когтями
      this.maxHp = Math.floor(baseHp * 1.4);
      this.damage = Math.floor(baseDmg * 1.05);
      this.windupTime += 0.1;
      this.comboChance = 0.25;
    } else if (this.kind === "seraph") { // Алый Серафим: аура жжёт героя, с половины здоровья — вторая стадия
      this.maxHp = Math.floor(baseHp * 1.8);
      this.damage = Math.floor(baseDmg * 1.1);
      this.windupTime += 0.1;
      this.maxPoise = 5;
      this.comboChance = 0.35;
      this.maxCombo = 2;
      this.aura = SERAPH_AURA;
      this.transforms = true;
      this.homeX = 160; // широкое крыло не заходит под окошко камеры справа
    }
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.state = "idle";
    this.timer = rand(1.5, 2.5);
    this.flash = 0;
    this.comboLeft = 0;
    this.enraged = false;
    this.drinkHits = 0;
    this.x = this.homeX;
  }
  set(state, timer) {
    this.state = state;
    this.timer = timer;
  }
  recoverTime() {
    return RECOVER_TIME * (this.enraged ? 0.8 : 1) * (this.hard && this.boss ? 0.8 : 1);
  }
  /**
   * Хардкор: боссы бьют сильнее и чаще, серии длиннее, замах каждый раз разной длины;
   * обычные враги — немного злее.
   */
  makeHard() {
    const boss = this.boss;
    this.hard = true;
    this.damage = Math.floor(this.damage * (boss ? 1.35 : 1.15));
    this.windupTime *= boss ? 0.85 : 0.95;
    this.comboChance = Math.min(0.85, this.comboChance + (boss ? 0.3 : 0.15));
    this.maxCombo += boss ? 1 : 0;
    this.jitter = boss ? 0.3 : 0.2;
    this.idleRange = boss ? [0.7, 1.6] : [1.1, 2.4];
    return this;
  }
  /** Длина очередного замаха: в хардкоре — то короче, то длиннее (не подстроиться под ритм). */
  nextWindup(base = this.windupTime) {
    const t = base * (1 + (this.jitter ? rand(-this.jitter, this.jitter) : 0));
    this.windupNow = Math.max(0.6, t);
    return this.windupNow;
  }
}

const DRINK_TIME = 2.5; // сколько глава разбойников пьёт зелье
const AUTO_BONFIRE = 3; // через сколько секунд после победы бой сам уходит к костру
const SERAPH_AURA = 0.03; // аура Алого Серафима: 3% здоровья героя в секунду
const TRANSFORM_TIME = 2.2; // перерождение Серафима во вторую стадию (неуязвим)
const REVIVE_TIME = 2.5; // Король-Призрак встаёт после первой смерти
const STUN_TIME = 2.0; // ошеломление гигантским мечом (враг открыт для крита)
const BURN_EVERY = 1; // жар Радиатора: урон раз в секунду
const HIT_X = { knight: 30, chief: 28, wraith: 31, seraph: 42, hound: 12, husk: 10 }; // центр врага для эффектов и «!»
const HEAD_Y = { knight: 58, chief: 56, wraith: 64, bat: 56, imp: 56, seraph: 96, hound: 30, husk: 40 };
const SERAPH_HOVER = 12; // Серафим парит над землёй
/** Высота «центра» врага над землёй для эффектов удара. */
const hitY = (en) => (en.boss ? (en.kind === "seraph" ? 66 : 24) : Skeleton.FLYING.includes(en.kind) ? 34 : en.kind === "hound" ? 10 : 18);
const DRINK_HITS = 3; // ударов, чтобы выбить зелье
const READY_TIME = 4; // секунд на то, чтобы отойти от телефона
const DODGE_COST = 10; // присед тратит немного сил: нельзя увёртываться без конца
const DODGE_GUARD = 1.0; // присед защищает столько секунд, потом нужно встать и присесть снова
const RECOVER_TIME = 1.6; // окно для удара после атаки скелета
const ABSENT_PAUSE = 1.0; // пауза, если игрока нет в кадре дольше этого

class BattleScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = !game.motion.ok;
    const p = game.player;
    this.HERO_X = 86;
    this.enemy = new Skeleton(p.wave);
    if (game.hard) this.enemy.makeHard(); // хардкор (без камеры — всегда)
    this.location = locationFor(p.wave);
    this.newLand = [CASTLE_FROM_WAVE, GRAVEYARD_FROM_WAVE, ABYSS_FROM_WAVE].includes(p.wave) && p.wave === p.frontier; // первый бой на новой земле
    this.auraT = 0; // аура Алого Серафима: урон герою раз в секунду
    this.burnT = 0;
    this.ghosts = []; // призрачное пламя Короля-Призрака
    // Здоровье и зелья переносятся между боями до отдыха у костра
    const run = game.run || { hp: p.maxHp, estus: p.estusMax };
    this.hp = Math.min(run.hp, p.maxHp);
    this.estus = Math.min(run.estus, p.estusMax);
    this.stamina = p.maxStamina;
    this.action = "idle";
    this.actionT = 0;
    this.invuln = 0;
    this.guardHint = false; // защита приседа кончилась, а игрок ещё внизу — подсказать встать
    this.guardCap = Infinity; // присед во время замаха защищает до самого удара (в дуэли — не дольше секунды)
    this.regenPause = 0;
    this.hurtT = 0;
    this.texts = [];
    this.result = null;
    this.resultT = 0;
    this.reward = [0, 0, 0]; // пепел, алые, синие
    this.ready = READY_TIME;
    this.absentT = 0;
    this.paused = false;
    this.torchL = new Particles(64, 58, 8, 2);
    this.torchR = new Particles(256, 58, 8, 2);
    this.slashT = 0;
    this.bladeEmbers = new Particles(0, 0, 14, 2);
    this.aura = new SwordAura();
    this.outfitFx = new OutfitFx(); // лепестки сакуры доспеха самурая
    this.hitFx = new HitFx();
    this.victory = null;
  }
  get needsCamera() {
    return true;
  }
  get zoomWorld() {
    return true; // на телефоне вертикально бой показывается крупнее
  }
  /** Кнопка «< КОСТЁР» / «< СДАТЬСЯ»: в портрете — крупная, справа сверху. */
  backRect() {
    const g = this.game;
    return g.portrait ? [W - 212, 12, 200, 60] : [12, GAME_H - 30, 104, 22];
  }

  /** Где сейчас стоит герой (верхний левый угол спрайта) и в какой он позе. */
  heroPose() {
    const hx = this.HERO_X + (this.action === "attack" ? 10 : this.action === "dodge" ? -6 : 0);
    const pose = this.result === "dead" || this.hurtT > 0 ? "hurt" : this.action;
    return [hx, GROUND_ARENA - 32, pose];
  }

  float(text, x, y, color, size = 16) {
    this.texts.push({ text, x, y, color, size, ttl: 1 });
  }

  /** Звук усталости: не чаще раза в секунду, чтобы не сливался при частых попытках удара. */
  exhaustedSound() {
    const now = this.game.time;
    if (now - (this.exhaustedAt ?? -9) < 1) return;
    this.exhaustedAt = now;
    sfx.exhausted();
    sfx.deny(); // громкий сигнал: усталое дыхание не слышно, если стоишь в 2–3 м от телефона
  }

  saveRun() {
    this.game.run = { hp: this.hp, estus: this.estus };
  }

  act(move) {
    const p = this.game.player, en = this.enemy;
    if (move === "pushup") {
      if (en.state === "revive" || en.state === "transform") return this.float("НЕУЯЗВИМ", en.x + 12, 90, "rgb(120,255,230)", 8);
      if (this.stamina < p.attackCost) {
        this.exhaustedSound();
        return this.float("Нет сил!", this.HERO_X + 10, 90, COL.green, 8);
      }
      this.stamina -= p.attackCost;
      if (this.stamina < p.attackCost) this.exhaustedSound(); // сил на следующий удар уже нет
      this.regenPause = 0.6;
      this.action = "attack";
      this.actionT = 0.35;
      this.slashT = SLASH_TIME;
      this.outfitFx.burst(this.game.outfit, this.HERO_X + 44, GROUND_ARENA - 19);
      const crit = en.state === "recover";
      let dmg = p.damage;
      if (crit) dmg = Math.floor(dmg * p.critMult);
      else if (en.kind === "knight") dmg = Math.floor(dmg * 0.7); // латы рыцаря: вне окна уязвимости гасят 30% урона
      en.hp -= dmg;
      en.flash = 0.15;
      this.game.shake = 0.12;
      crit ? sfx.crit() : sfx.hit();
      if (crit && this.game.skin === "phoenix") { // Клинок Феникса: на крите из острия бьёт струя пламени
        const cx = HIT_X[en.kind] || 12, cy = hitY(en);
        this.aura.jet(this.HERO_X + 10 + 37, GROUND_ARENA - 19, Math.round(en.x) + cx, GROUND_ARENA - cy);
        sfx.flame();
      }
      const label = crit ? `${dmg} КРИТ!` : en.kind === "knight" ? `${dmg} БРОНЯ` : `${dmg}`;
      this.float(label, en.x + 12, 90, crit ? COL.gold : COL.text);
      const hit = this.game.style("hit");
      if (hit) { // купленный эффект удара
        const cx = HIT_X[en.kind] || 12, cy = hitY(en);
        this.hitFx.spawn(hit, Math.round(en.x) + cx, GROUND_ARENA - cy);
        hit === "hit_storm" ? sfx.thunder() : sfx.souls();
      }
      if (p.lifesteal && this.hp < p.maxHp) this.hp = Math.min(p.maxHp, this.hp + p.lifesteal);
      if (p.vampire && this.hp < p.maxHp) { // Клык Вампира: часть урона возвращается здоровьем
        const heal = Math.max(1, Math.round(dmg * p.vampire));
        this.hp = Math.min(p.maxHp, this.hp + heal);
        this.float(`+${heal}`, this.HERO_X + 4, 96, "rgb(220,60,90)", 8);
      }
      if (en.state === "windup") {
        en.poise -= 1;
        if (en.poise <= 0) {
          en.comboLeft = 0;
          en.set("recover", en.recoverTime());
          this.float("ПРЕРВАН!", en.x + 12, 74, COL.gold);
        }
      }
      if (en.state === "drink" && ++en.drinkHits >= DRINK_HITS) {
        en.set("recover", en.recoverTime());
        this.float("ЗЕЛЬЕ ВЫБИТО!", en.x + 12, 60, COL.gold);
        sfx.crit();
      }
      if (en.kind === "knight" && !en.enraged && en.hp > 0 && en.hp <= en.maxHp / 2) {
        en.enraged = true; // ярость: быстрее замах, короче окно уязвимости
        en.windupTime *= 0.85;
        this.float("ЯРОСТЬ!", en.x + 12, 60, "rgb(255,60,40)");
      }
      if (en.potion && en.hp > 0 && en.hp <= en.maxHp / 2 && en.state !== "windup") {
        en.potion = false; // глава разбойников тянется к зелью — выбей его ударами
        en.drinkHits = 0;
        en.set("drink", DRINK_TIME);
        this.float("ПЬЁТ ЗЕЛЬЕ!", en.x + 12, 60, "rgb(255,90,90)");
      }
      // гигантский меч иногда ошеломляет: враг теряет замах и открыт для крита
      const stun = p.weapon.stun || 0;
      if (stun && en.hp > 0 && en.state !== "drink" && Math.random() < stun) {
        en.comboLeft = 0;
        en.set("recover", STUN_TIME);
        this.float("ОШЕЛОМЛЁН!", en.x + 12, 66, "rgb(255,230,120)");
        sfx.crit();
      }
      if (en.hp <= 0) this.defeat();
    } else if (move === "squat_down" || move === "pushup_down") {
      // Уворот: присед стоит немного сил и защищает DODGE_GUARD секунд — сидеть внизу бесполезно,
      // нужно встать и присесть снова. Низ отжимания — часть удара, за него силы не берутся.
      // Если уже идёт замах — игрок пригнулся заранее и защищён до самого удара.
      if (move === "squat_down") {
        if (this.stamina < DODGE_COST) {
          this.exhaustedSound();
          return this.float("Нет сил!", this.HERO_X + 10, 90, COL.green, 8);
        }
        this.stamina -= DODGE_COST;
        this.regenPause = Math.max(this.regenPause, 0.3);
      }
      const untilStrike = en.state === "windup" ? Math.min(en.timer + 0.25, this.guardCap) : 0;
      this.invuln = Math.max(this.invuln, DODGE_GUARD, untilStrike);
      this.action = "dodge";
      this.actionT = this.invuln;
      this.guardHint = true;
      sfx.dodge();
    } else if (move === "jack") {
      if (this.estus <= 0) return this.float("Зелья кончились", this.HERO_X + 10, 90, COL.dim, 8);
      if (this.hp >= p.maxHp && this.stamina >= p.maxStamina) return this.float("Здоровье и силы полные", this.HERO_X + 10, 90, COL.dim, 8);
      this.estus -= 1;
      const heal = Math.floor(p.maxHp * 0.45);
      this.hp = Math.min(p.maxHp, this.hp + heal);
      this.stamina = p.maxStamina; // зелье восстанавливает и выносливость
      this.float("+СИЛЫ", this.HERO_X + 10, 74, COL.green, 8);
      this.action = "heal";
      this.actionT = 0.8;
      sfx.heal();
      this.float(`+${heal}`, this.HERO_X + 10, 90, "rgb(255,170,60)");
    }
  }

  /** Здоровье врага кончилось: Король-Призрак один раз возрождается, остальные погибают. */
  defeat() {
    const en = this.enemy;
    if (en.transforms && !en.stage2) { // Серафима не убить в первой стадии: сначала перерождение
      en.hp = Math.max(1, Math.floor(en.maxHp * 0.3));
      return;
    }
    if (en.reincarnate) {
      en.reincarnate = false;
      en.hp = 0;
      en.comboLeft = 0;
      en.set("revive", REVIVE_TIME);
      this.float("ВОЗРОЖДЕНИЕ!", en.x + 12, 56, "rgb(120,255,230)");
      sfx.souls();
      return;
    }
    this.win();
  }

  win() {
    const p = this.game.player, en = this.enemy;
    en.set("dead", 0);
    this.result = "won";
    this.resultT = 0;
    const first = en.wave >= p.frontier; // впервые (не повтор пройденного раунда с карты)
    let [ash, red, blue] = rewards(en.wave);
    if (!first) blue = 0; // синие камни за босса — только за первую победу
    if (p.lostSouls && p.lostAtWave === en.wave) {
      ash += p.lostSouls;
      p.lostSouls = 0;
    }
    p.souls += ash;
    p.redGems += red;
    p.blueGems += blue;
    this.reward = [ash, red, blue];
    p.wave += 1;
    p.frontier = Math.max(p.frontier, p.wave);
    if (en.boss && first) p.bossesDefeated += 1; // в рейтинг — только новые боссы
    p.save();
    this.saveRun();
    this.game.recordProgress();
    const st = this.game.profile.streak, lit = st.award(en.boss); // огонёк дня: враг — 1, босс — 2
    this.streakLine = "";
    if (lit.add) {
      this.game.profile.save();
      this.streakLine = tf(lit.fresh ? "Огонёк дня зажжён! +{n} · в серии {p}" : "Пламя разгорается! +{n} · в серии {p}", { n: lit.add, p: st.points });
    }
    const style = this.game.style("victory");
    if (style) { // купленное оформление победы
      this.victory = new VictoryFx(style);
      style === "win_crown" ? sfx.fanfare() : sfx.pyre();
    } else {
      sfx.win();
    }
    vibrate([40, 30, 40]);
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

  /** Выход из боя кнопкой «< КОСТЁР» (в вызове и дуэли — сдаться). */
  leave() {
    this.saveRun();
    this.game.change(new BonfireScene(this.game));
  }

  handle(moves) {
    const g = this.game;
    if (this.result) {
      if (this.resultT < 1) return;
      // Звёздочка — следующий бой без подхода к телефону; касание/Enter — к костру
      if (this.result === "won" && moves.includes("jack")) return g.change(new BattleScene(g));
      if (this.result === "won" && this.resultT >= AUTO_BONFIRE) return g.change(new BonfireScene(g)); // сам уходит к костру — прокачка
      if (g.taps.length || g.key("Enter", " ", "Escape") || (this.result === "dead" && moves.includes("jack"))) {
        g.taps.length = 0;
        g.change(new BonfireScene(g));
      }
      return;
    }
    if (g.key("Escape") || g.tapped(this.backRect())) return this.leave();
    if (this.ready > 0 || this.paused) return;
    for (const m of moves) if (m !== "squat") this.act(m); // в бою важен сам момент приседа
  }

  update(dt) {
    this.manual = !this.game.motion.ok; // с камерой бой — только движениями: кнопок ОТЖИМ/ПРИСЕД/ЗВЕЗДА нет
    const g = this.game, p = g.player, en = this.enemy;
    this.torchL.update(dt);
    this.torchR.update(dt);
    this.bladeEmbers.update(dt);
    this.slashT = Math.max(0, this.slashT - dt);
    for (const ft of this.texts) {
      ft.y -= 18 * dt;
      ft.ttl -= dt;
    }
    this.texts = this.texts.filter((ft) => ft.ttl > 0);
    en.flash = Math.max(0, en.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    const [hx, hy, pose] = this.heroPose();
    this.aura.update(dt, this.game.skin, pose, hx, hy);
    this.outfitFx.update(dt, this.game.outfit, hx, hy);
    this.hitFx.update(dt);
    if (en.kind === "wraith" || en.kind === "seraph") this.updateGhosts(dt);
    this.auraHitT = Math.max(0, (this.auraHitT || 0) - dt);
    if (this.result) {
      this.resultT += dt;
      if (this.victory) this.victory.update(dt);
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
    if (this.guardHint && this.invuln <= 0) {
      this.guardHint = false;
      if (d && d.low) this.float("Встаньте и присядьте снова", this.HERO_X + 10, 80, COL.dim, 8);
    }
    this.regenPause -= dt;
    if (this.regenPause <= 0) this.stamina = Math.min(p.maxStamina, this.stamina + p.staminaRegen * dt);
    this.updateEnemy(dt);
  }

  /** Враг: жар Радиатора и ИИ (в дуэли врагом управляет соперник по сети). */
  updateEnemy(dt) {
    const p = this.game.player, en = this.enemy;
    // Радиатор: жар обжигает врага каждую секунду; Крыло Серафима — аура, доля здоровья врага (не во время возрождения)
    const pct = p.weapon.aura || 0;
    const burn = (p.weapon.burn || 0) + (pct ? Math.max(1, Math.ceil(en.maxHp * pct)) : 0);
    if (burn && en.state !== "revive" && en.state !== "transform" && en.state !== "dead") {
      this.burnT += dt;
      if (this.burnT >= BURN_EVERY) {
        this.burnT -= BURN_EVERY;
        en.hp -= burn;
        this.float(`-${burn}`, en.x + 20, 100, pct ? "rgb(255,80,60)" : "rgb(255,150,60)", 8);
        if (en.hp <= 0) return this.defeat();
      }
    }

    // Аура Алого Серафима: каждую секунду жжёт долю здоровья героя (броня не спасает)
    if (en.aura && en.state !== "dead") {
      this.auraT += dt;
      if (this.auraT >= 1) {
        this.auraT -= 1;
        const ward = p.armor === "wingarmor" ? 0.5 : 1; // доспех Серафима вдвое ослабляет ауру
        const dmg = Math.max(1, Math.ceil(p.maxHp * en.aura * ward));
        this.hp -= dmg;
        this.auraHitT = 0.25;
        this.float(`-${dmg}`, this.HERO_X + 4, 100, "rgb(255,70,50)", 8);
        if (this.hp <= 0) {
          this.hp = 0;
          return this.die();
        }
      }
    }
    // Серафим на половине здоровья перерождается: второе крыло, рога, раскалённые метки — и злее
    if (en.transforms && !en.stage2 && en.state !== "transform" && en.hp > 0 && en.hp <= en.maxHp / 2) {
      en.comboLeft = 0;
      en.set("transform", TRANSFORM_TIME);
      this.float("ВТОРАЯ СТАДИЯ!", en.x + 12, 50, "rgb(255,90,50)");
      this.game.shake = 0.5;
      sfx.thunder();
      sfx.alert();
    }

    // ИИ скелета: ожидание -> замах (окно для приседа) -> удар -> уязвимость
    en.timer -= dt;
    if (en.state === "idle" && en.timer <= 0) {
      en.poise = en.maxPoise;
      en.comboLeft = 0;
      for (let i = 0; i < en.maxCombo; i++) if (Math.random() < en.comboChance) en.comboLeft += 1;
      en.set("windup", en.nextWindup());
      sfx.alert();
    } else if (en.state === "windup" && en.timer <= 0) {
      en.set("attack", 0.35);
      this.resolveHit();
    } else if (en.state === "attack" && en.timer <= 0) {
      if (en.comboLeft > 0) {
        en.comboLeft -= 1; // следующий, более быстрый замах сразу после удара
        en.set("windup", en.nextWindup(en.windupTime * 0.85));
        this.float("ЕЩЁ УДАР!", en.x + 12, 70, "rgb(255,120,60)", 8);
        sfx.alert();
      } else {
        en.set("recover", en.recoverTime());
      }
    } else if (en.state === "recover" && en.timer <= 0) {
      en.set("idle", rand(...en.idleRange));
    } else if (en.state === "revive") {
      en.hp = Math.min(en.maxHp * 0.5, en.hp + (en.maxHp * 0.5 * dt) / REVIVE_TIME); // полоска заполняется
      if (en.timer <= 0) {
        en.hp = Math.floor(en.maxHp * 0.5);
        en.enraged = true; // вернулся злее: быстрее замах
        en.windupTime *= 0.9;
        en.set("idle", 1);
      }
    } else if (en.state === "transform" && en.timer <= 0) {
      en.stage2 = true;
      en.enraged = true;
      en.windupTime = Math.max(1.3, en.windupTime * 0.8); // быстрее замах
      en.damage = Math.floor(en.damage * 1.25);
      en.comboChance = 0.6;
      en.maxCombo = 2;
      this.game.shake = 0.4;
      sfx.crit();
      en.set("idle", 0.6);
    } else if (en.state === "drink" && en.timer <= 0) {
      const heal = Math.floor(en.maxHp * 0.2);
      en.hp = Math.min(en.maxHp, en.hp + heal);
      this.float(`+${heal} ЗЕЛЬЕ`, en.x + 12, 70, "rgb(120,220,120)");
      en.enraged = true; // подлечился и озверел
      en.windupTime *= 0.9;
      en.set("idle", 1);
    }
    const target = en.state === "attack" ? this.HERO_X + 30 : en.homeX;
    en.x += (target - en.x) * Math.min(1, dt * (en.state === "attack" ? 18 : 5));
  }

  /** Призрачное бирюзовое пламя вокруг Короля-Призрака. */
  updateGhosts(dt) {
    const en = this.enemy;
    const rate = en.state === "revive" || en.state === "transform" ? 60 : en.stage2 ? 34 : 18;
    if (en.state !== "dead" && Math.random() < dt * rate) {
      const [x0, x1, y1] = en.kind === "seraph" ? [24, 90, 92] : [14, 48, 46];
      this.ghosts.push({ x: en.x + rand(x0, x1), y: GROUND_ARENA - rand(4, y1), vy: -rand(8, 20), life: rand(0.6, 1.3) });
    }
    for (const gp of this.ghosts) {
      gp.y += gp.vy * dt;
      gp.x += rand(-6, 6) * dt;
      gp.life -= dt;
    }
    this.ghosts = this.ghosts.filter((gp) => gp.life > 0);
  }

  resolveHit() {
    const en = this.enemy;
    if (this.invuln > 0) {
      sfx.dodge();
      return this.float("УВОРОТ!", this.HERO_X + 10, 80, "rgb(140,200,255)");
    }
    const dmg = Math.round(en.damage * this.game.player.damageTakenMult);
    this.hp -= dmg;
    this.hurtT = 0.3;
    this.game.shake = en.boss ? 0.4 : 0.3;
    sfx.hurt();
    vibrate(en.boss ? 250 : 150);
    this.float(`-${dmg}`, this.HERO_X + 10, 86, COL.red);
    const p = this.game.player;
    if (en.steal && p.souls > 0) { // разбойники крадут пепел
      const stolen = Math.min(p.souls, en.steal);
      p.souls -= stolen;
      this.float(`-${stolen} пепла`, this.HERO_X + 10, 72, "rgb(200,170,120)", 8);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  draw(c) {
    const t = this.game.time, en = this.enemy;
    if (this.location === 1) {
      c.drawImage(IMG.arena_bg, 0, 0);
      for (const tx of [60, 252]) c.drawImage(anim("torch", t, 8, 4), tx, 56);
      this.torchL.draw(c);
      this.torchR.draw(c);
    } else {
      c.drawImage(IMG[LOCATIONS[this.location].bg], 0, 0);
    }

    let spr;
    const kind = en.kind === "seraph" && en.stage2 ? "seraph2" : { knight: "boss" }[en.kind] || en.kind;
    if (en.aura && en.state !== "dead") this.drawAura(c, en, t); // багровое марево за Серафимом
    if (en.hero) spr = rivalSprite(en, t);
    else if (en.state === "drink") spr = anim("chief_drink", t, 4, 2);
    else if (en.state === "revive") spr = anim("wraith_revive", t, 4, 2);
    else if (en.state === "transform") spr = anim("seraph_transform", t, 5, 2);
    else if (en.state === "dead") spr = IMG[`${kind}_dead_0`];
    else if (en.flash > 0) spr = IMG[`${kind}_hurt_0`];
    else if (en.state === "windup") spr = anim(`${kind}_windup`, t, 8, 2);
    else if (en.state === "attack") spr = IMG[`${kind}_attack_0`];
    else if (en.boss && en.enraged) spr = anim(`${kind}_enraged`, t, 1.5, 2);
    else if (en.kind === "seraph") spr = anim(`${kind}_idle`, t, 4, 4); // медленные взмахи крыла
    else spr = anim(`${kind}_idle`, t, Skeleton.FLYING.includes(en.kind) ? 8 : 1.5, 2); // крылья машут
    const ex = Math.round(en.x) - (en.state === "attack" ? 8 : 0);
    // летучая мышь висит в воздухе и пикирует при атаке, погибшая лежит на земле
    let lift = !Skeleton.FLYING.includes(en.kind) || en.state === "dead" ? 0 : en.state === "attack" ? 10 : 30 + Math.round(Math.sin(t * 4) * 3);
    if (en.kind === "seraph" && en.state !== "dead") { // парит, покачиваясь; для выпада снижается
      lift = en.state === "attack" ? 4 : SERAPH_HOVER + Math.round(Math.sin(t * 1.8) * 3);
      c.fillStyle = "rgba(8,4,8,0.55)"; // тень на земле
      c.beginPath();
      c.ellipse(Math.round(en.x) + 41, GROUND_ARENA - 1, 18 - lift / 3, 2, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (en.hero) drawFlipped(c, spr, Math.round(en.x) + 24 - spr.width, GROUND_ARENA - spr.height); // герой-соперник смотрит влево
    else c.drawImage(spr, ex, GROUND_ARENA - spr.height - lift);
    if (en.kind === "wraith" || en.kind === "seraph") {
      const pal = en.kind === "seraph" ? ["rgb(255,220,150)", "rgb(255,110,50)", "rgb(140,20,20)"] : ["rgb(200,255,240)", "rgb(110,240,200)", "rgb(40,120,110)"];
      for (const gp of this.ghosts) {
        c.fillStyle = gp.life > 0.8 ? pal[0] : gp.life > 0.4 ? pal[1] : pal[2];
        c.fillRect(Math.floor(gp.x), Math.floor(gp.y), 1, 1);
      }
    }

    const p = this.game.player;
    const skin = this.game.skin;
    const hero = heroSprite(p.sword, p.worn, skin, this.game.outfit); // меч (или его облик) и облик по реликвиям
    if (this.result === "dead") spr = IMG[`${hero}_dead_0`];
    else if (this.hurtT > 0) spr = IMG[`${hero}_hurt_0`];
    else if (this.action === "idle") spr = anim(`${hero}_idle`, t, 1.5, 2);
    else spr = IMG[`${hero}_${this.action}_0`];
    const hx = this.HERO_X + (this.action === "attack" ? 10 : this.action === "dodge" ? -6 : 0);
    drawPlankAura(c, hx + 12, GROUND_ARENA, p.aura, t); // аура за время в планке
    this.aura.drawBehind(c, skin, this.action === "attack" ? "attack" : this.action === "idle" ? "idle" : "", hx, GROUND_ARENA - 32, t);
    if (this.action === "dodge") {
      c.globalAlpha = 0.3;
      c.drawImage(spr, hx + 8, GROUND_ARENA - spr.height);
      c.globalAlpha = 1;
    }
    c.drawImage(spr, hx, GROUND_ARENA - spr.height);
    const [, hy, pose] = this.heroPose();
    this.aura.draw(c, skin, pose, hx, hy, t);
    this.outfitFx.draw(c);
    if (this.slashT > 0) drawSlash(c, hx + 34, GROUND_ARENA - 19, p.sword, 1 - this.slashT / SLASH_TIME, skin); // след удара
    this.hitFx.draw(c);
    if ((p.sword === "ash" || p.sword === "radiator" || p.sword === "seraph") && !skin) { // раскалённый клинок искрит
      [this.bladeEmbers.x, this.bladeEmbers.y] = this.action === "attack" ? [hx + 30, GROUND_ARENA - 20] : [hx + 20, GROUND_ARENA - 10];
      this.bladeEmbers.draw(c);
    }

    if (en.state === "windup") {
      const k = Math.max(0, Math.min(1, 1 - en.timer / (en.windupNow || en.windupTime)));
      c.strokeStyle = `rgba(200,20,20,${(40 + 80 * k) / 255})`;
      c.lineWidth = 6;
      c.strokeRect(3, 3, CW - 6, CH - 6);
    }
  }

  /** Аура Серафима: пульсирующее багровое марево и жар, доходящий до героя. */
  drawAura(c, en, t) {
    const cx = Math.round(en.x) + 50, cy = GROUND_ARENA - 50;
    const pulse = 0.5 + 0.5 * Math.sin(t * (en.stage2 ? 6 : 3.5));
    const big = en.state === "transform" ? 1.4 : en.stage2 ? 1.15 : 1;
    for (const [r, a] of [[44, 0.07], [34, 0.1], [24, 0.13]]) {
      c.fillStyle = `rgba(${en.stage2 ? 230 : 190},${en.stage2 ? 60 : 30},30,${a * 0.8 + 0.04 * pulse})`;
      c.beginPath();
      c.ellipse(cx, cy, r * big, r * 0.9 * big, 0, 0, Math.PI * 2);
      c.fill();
    }
    // волна жара по земле к герою
    c.fillStyle = `rgba(255,60,30,${0.12 + 0.1 * pulse})`;
    c.fillRect(this.HERO_X - 6, GROUND_ARENA - 2, Math.round(en.x) + 41 - this.HERO_X + 6, 2);
  }

  drawUi() {
    const g = this.game, p = g.player, en = this.enemy;
    this.hitFx.drawFlash(g.ctx, W, g.gameH);
    if (this.auraHitT > 0) g.rect([0, 0, W, g.gameH], `rgba(255,30,20,${this.auraHitT * 0.5})`); // жар ауры — краснеет экран
    const P = g.portrait; // на телефоне вертикально — полоски и зелья крупнее
    g.bar(16, 16, Math.min(P ? 400 : 999, Math.floor(p.maxHp * 1.4)), P ? 16 : 8, this.hp / p.maxHp, COL.red);
    g.bar(16, P ? 40 : 28, Math.min(P ? 400 : 999, Math.floor(p.maxStamina * 1.6)), P ? 12 : 6, this.stamina / p.maxStamina, COL.green);
    const ek = P ? 2 : 1, ey = P ? 60 : 39;
    for (let i = 0; i < (this.estusCap ?? p.estusMax); i++) { // в дуэли — одна фляга
      g.rect([15 + i * 12 * ek, ey, 10 * ek, 14 * ek], COL.shadow);
      g.rect([16 + i * 12 * ek, ey + 3 * ek, 8 * ek, 10 * ek], i < this.estus ? "rgb(240,150,50)" : "rgb(60,50,50)");
      g.rect([18 + i * 12 * ek, ey + ek, 4 * ek, 2 * ek], "rgb(140,120,100)");
    }
    if (!g.portrait) {
      g.cameraWidget();
      g.manualButtons();
    }

    // враг: в портрете полоска во всю ширину и крупное имя
    const [bx, bw, bh, nfs] = P ? [16, W - 32, 16, 16] : [140, 340, 8, 8];
    const by = g.gameH - (P ? 30 : 32), ny = by - (P ? 24 : 14);
    if (en.boss) { // полоска босса — в золотой рамке
      g.ctx.strokeStyle = COL.gold;
      g.ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, bh + 3);
      const extra = en.state === "drink" ? ` - ЗЕЛЬЕ ${en.drinkHits}/${DRINK_HITS}` : en.state === "revive" ? " - ВОССТАЁТ"
        : en.state === "transform" ? " - ПЕРЕРОЖДЕНИЕ" : en.stage2 ? " - II СТАДИЯ" : en.enraged ? " - ЯРОСТЬ" : en.aura ? " - АУРА" : "";
      const hot = en.enraged || en.state === "drink" || en.state === "revive" || en.state === "transform";
      g.text(`${tr("БОСС")}: ${tr(en.name)} #${en.wave}${tr(extra)}`, bx, ny - 2, P ? 12 : 8, hot ? "rgb(255,120,80)" : COL.gold);
    } else {
      g.text(en.hero ? en.name : `${tr(en.name)} #${en.wave}`, bx, ny, nfs);
    }
    g.bar(bx, by, bw, bh, Math.max(0, en.hp) / en.maxHp, "rgb(150,20,20)");
    if (P) { // в портрете пепел и камни — под кнопкой выхода, чтобы не мешать полоске врага
      g.text(`Пепел: ${p.souls}`, W - 16, 84, 12, COL.gold, "right");
      g.gems(W - 16, 104, p, "right");
    } else {
      g.text(`Пепел: ${p.souls}`, W - 12, g.gameH - 16, 8, COL.gold, "right");
      g.gems(W - 12, g.gameH - 32, p, "right");
    }
    g.button(this.backRect(), this.backLabel || "< КОСТЁР", { size: g.portrait ? 16 : 8 });

    if (!g.portrait && !g.side && !g.touch) { // подсказки клавиш — только на компьютере
      [["J", "ОТЖИМАНИЕ", "удар"], ["K", "ПРИСЕД/ВНИЗ", "уворот"], ["L", "ЗВЕЗДОЧКА", "зелье"]]
        .forEach(([k, a, b], i) => g.text(`[${k}] ${tr(a)}: ${tr(b)}`, 16, 62 + i * 12, 8, COL.dim));
    }

    const plank = g.motion.ok && g.motion.detector.posture === "планка";
    if (this.paused) {
      g.rect([0, g.gameH / 2 - 30, W, 60], "rgba(0,0,0,0.75)");
      g.text("ПАУЗА: ВСТАНЬТЕ В КАДР", W / 2, g.gameH / 2 - 12, 16, COL.gold, "center");
      g.text("Камера не видит вас, скелет ждёт", W / 2, g.gameH / 2 + 10, 8, COL.dim, "center");
    } else if (this.ready > 0) {
      const tips = {
        knight: "Латы держат удары: бей в окно уязвимости",
        chief: "Крадёт пепел. На половине здоровья пьёт зелье: выбей 3 ударами",
        bandit: "Быстрый удар и крадёт пепел: не пропускай",
        zombie: "Медленный, но живучий",
        bat: "Хрупкая, но кусает сериями",
        wraith: "Один раз восстанет из мёртвых: добей дважды",
        seraph: "Аура жжёт 3% здоровья в секунду. С половины здоровья — вторая стадия",
        imp: "Мелкий и быстрый: кусает сериями",
        hound: "Короткий бросок и тяжёлый укус",
        husk: "Живучий, бьёт когтями",
        rival: "Соперник бьётся снаряжением и силой своего героя",
      };
      if (this.newLand) g.text(`${tr("НОВАЯ ЗЕМЛЯ")}: ${tr(LOCATIONS[this.location].name).toUpperCase()}`, W / 2, 44, 8, "rgb(150,200,140)", "center");
      if (en.boss) g.text(`${tr("БОСС")}: ${tr(en.name).toUpperCase()}`, W / 2, 34, 16, "rgb(255,90,60)", "center");
      if (tips[en.kind]) g.text(tips[en.kind], W / 2, 140, 8, COL.dim, "center");
      g.text("ПРИГОТОВЬТЕСЬ", W / 2, 60, 16, COL.gold, "center");
      g.text(`${Math.ceil(this.ready)}`, W / 2, 84, 32, COL.text, "center");
      g.text(g.useCamera ? "Отойдите, чтобы тело было в кадре" : "Бой начинается", W / 2, 124, 8, COL.dim, "center");
    } else if (en.state === "windup" && !this.result) {
      const k = Math.max(0, Math.min(1, en.timer / (en.windupNow || en.windupTime)));
      const pulse = 0.5 + 0.5 * Math.sin(g.time * 14);
      g.text(plank ? "ОПУСТИСЬ!" : "ПРИСЕДАЙ!", W / 2, 56, 32, `rgb(255,${Math.floor(60 + 120 * pulse)},40)`, "center");
      g.bar(W / 2 - 80, 96, 160, 5, k, "rgb(255,90,50)");
      const top = GROUND_ARENA - (HEAD_Y[en.kind] || 44);
      g.text("!", g.wx(Math.round(en.x + (HIT_X[en.kind] || 12))), g.wy(top), 24, "rgb(255,200,60)", "center");
    } else if (en.state === "recover" && !this.result) {
      g.text("Окно для удара: ОТЖИМАЙСЯ!", W / 2, 70, 8, COL.gold, "center");
    } else if (en.state === "drink" && !this.result) {
      g.text(`ВЫБЕЙ ЗЕЛЬЕ! ${en.drinkHits}/${DRINK_HITS}`, W / 2, 60, 16, "rgb(255,120,90)", "center");
      g.bar(W / 2 - 80, 86, 160, 5, en.timer / DRINK_TIME, "rgb(120,220,120)");
    }

    for (const ft of this.texts) g.text(ft.text, Math.round(g.wx(ft.x)), Math.round(g.wy(ft.y)), ft.size, ft.color, "center");
    if (this.result) this.drawResult();
  }

  /** Подсказка после победы: звёздочка — следующий бой, иначе через пару секунд — к костру. */
  autoHint() {
    return tf("Звёздочка: следующий бой. К костру через {n}", { n: Math.max(1, Math.ceil(AUTO_BONFIRE - this.resultT)) });
  }

  /** Экран победы или гибели. */
  drawResult() {
    const g = this.game, en = this.enemy;
    if (this.result === "won" && this.victory) {
      const [ash, red, blue] = this.reward;
      this.victory.draw(g.ctx, (ctx, ...a) => g.text(a[0], a[1], a[2], a[3], a[4], a[5], a[6] ?? true, ctx), {
        title: en.boss ? "БОСС ПОВЕРЖЕН" : "ВРАГ ПОВЕРЖЕН",
        loot: `+${ash} пепла  +${red} алых${blue ? `  +${blue} синий` : ""}`,
        hint: this.autoHint(),
      });
      if (this.streakLine) g.text(this.streakLine, W / 2, 8, 8, "rgb(255,200,110)", "center");
    } else if (this.result) {
      g.rect([0, g.gameH / 2 - 45, W, 90], `rgba(0,0,0,${Math.min(0.8, this.resultT * 1.2)})`);
      if (this.result === "dead") {
        g.text("ВЫ ПОГИБЛИ", W / 2, g.gameH / 2 - 28, 32, "rgb(170,20,20)", "center");
        g.text("Пепел остался на месте гибели: победите", W / 2, g.gameH / 2 + 14, 8, COL.dim, "center");
        g.text("этого скелета, чтобы вернуть его. Касание: к костру", W / 2, g.gameH / 2 + 26, 8, COL.dim, "center");
      } else {
        const [ash, red, blue] = this.reward;
        g.text(en.boss ? "БОСС ПОВЕРЖЕН" : "ВРАГ ПОВЕРЖЕН", W / 2, g.gameH / 2 - 28, 32, COL.gold, "center");
        g.text(`+${ash} пепла  +${red} алых${blue ? `  +${blue} синий` : ""}`, W / 2, g.gameH / 2 + 12, 8, COL.gold, "center");
        g.text(this.autoHint(), W / 2, g.gameH / 2 + 26, 8, COL.text, "center");
        if (this.streakLine) g.text(this.streakLine, W / 2, g.gameH / 2 + 37, 8, "rgb(255,200,110)", "center");
      }
    }
  }
}

// ------------------------------------------------------------------ Мультиплеер: соперник-герой
/** Спрайт, отражённый по горизонтали: герой-соперник смотрит на нашего героя. */
function drawFlipped(c, spr, x, y) {
  c.save();
  c.translate(x + spr.width, y);
  c.scale(-1, 1);
  c.drawImage(spr, 0, 0);
  c.restore();
}

/** Поза героя-соперника: тот же набор спрайтов, что у нашего героя. */
function rivalSprite(en, t) {
  const h = heroSprite(en.hero.sword, en.hero.looks || [], en.hero.skin, en.hero.outfit);
  if (en.state === "dead") return IMG[`${h}_dead_0`];
  if (en.flash > 0) return IMG[`${h}_hurt_0`];
  if (en.state === "windup") return IMG[`${h}_dodge_0`]; // пригнулся перед выпадом
  if (en.state === "attack") return IMG[`${h}_attack_0`];
  if (en.state === "drink") return IMG[`${h}_heal_0`];
  return anim(`${h}_idle`, t, 1.5, 2);
}

/**
 * Соперник с характеристиками героя игрока. В вызове им управляет бот (обычный ИИ врага):
 * больше здоровья, чем у героя, потому что бьёт он реже, чем игрок отжимается.
 * В дуэли им управляет живой соперник по сети.
 */
function makeRival(hero, name, pos, duel = false) {
  const en = new Skeleton(1);
  Object.assign(en, {
    kind: "rival", boss: false, name, wave: pos, hero, homeX: 196, x: 196, maxPoise: 3, poise: 3, steal: 0,
    reincarnate: false, comboChance: 0.25, maxCombo: 1, potion: !duel && hero.estus > 0,
    windupTime: Math.max(1.5, 2.1 - hero.level * 0.01),
  });
  en.maxHp = duel ? hero.maxHp : Math.round(hero.maxHp * 1.3);
  en.damage = Math.round(hero.damage * 0.8);
  en.hp = en.maxHp;
  return en;
}

/** «Бросить вызов»: бой с ботом, который играет снаряжением и силой соперника из списка. */
class ChallengeScene extends BattleScene {
  constructor(game, data) {
    super(game);
    const p = game.player, o = data.opponent;
    this.fight = data.fight;
    this.enemy = makeRival(o.hero, o.name, o.pos);
    this.location = 2;
    this.newLand = false;
    this.hp = p.maxHp; // в вызове — полное здоровье и зелья, путь героя не меняется
    this.estus = p.estusMax;
    this.backLabel = "< СДАТЬСЯ";
    this.outcome = null;
  }
  report(won) {
    this.game.online.challengeEnd(this.fight, won)
      .then((r) => (this.outcome = r))
      .catch((e) => (this.outcome = { error: errorText(e) }));
  }
  win() {
    this.enemy.set("dead", 0);
    this.result = "won";
    this.resultT = 0;
    sfx.win();
    vibrate([40, 30, 40]);
    this.report(true);
  }
  die() {
    this.result = "dead";
    this.resultT = 0;
    sfx.die();
    this.report(false);
  }
  leave() {
    if (!this.result) this.report(false); // сдался — попытка потрачена
    this.game.change(new MultiplayerScene(this.game, "challenge"));
  }
  handle(moves) {
    const g = this.game;
    if (!this.result) return super.handle(moves);
    if (this.resultT >= 1 && (g.taps.length || g.key("Enter", " ", "Escape") || moves.includes("jack"))) {
      g.taps.length = 0;
      g.change(new MultiplayerScene(g, "challenge"));
    }
  }
  drawResult() {
    const g = this.game, o = this.outcome, won = this.result === "won";
    g.rect([0, g.gameH / 2 - 45, W, 90], `rgba(0,0,0,${Math.min(0.8, this.resultT * 1.2)})`);
    g.text(won ? "ПОБЕДА!" : "ПОРАЖЕНИЕ", W / 2, g.gameH / 2 - 28, 32, won ? COL.gold : "rgb(170,20,20)", "center");
    let line = "Отправка результата...";
    if (o && o.error) line = o.error;
    else if (o && o.moved) line = tf("Вы заняли {pos} место соперника!", { pos: o.account.arena_pos });
    else if (o) line = won ? "Место не изменилось" : "Место не изменилось. Попробуйте ещё раз";
    g.text(line, W / 2, g.gameH / 2 + 12, 8, COL.text, "center");
    g.text("Касание: к списку соперников", W / 2, g.gameH / 2 + 26, 8, COL.dim, "center");
  }
}

const DUEL_WINDUP = 0.8; // столько видно выпад соперника: успей присесть
const DUEL_DAMAGE = 1.5; // в дуэли удары сильнее — бой не затягивается
const DUEL_ESTUS = 1; // в дуэли у каждого одна фляга зелья
const DUEL_POLL = 0.3; // обмен с сервером ~3 раза в секунду
const DUEL_LOST = 20; // нет связи дольше — дуэль прерывается

/**
 * Дуэль в реальном времени. Отжимание — выпад: соперник видит замах и может присесть.
 * Попал ли удар, решает телефон защищающегося (он знает, присел ли игрок), и сообщает своё здоровье.
 * Связь — через api.php: события копятся и уходят пачкой несколько раз в секунду.
 */
class DuelScene extends BattleScene {
  constructor(game, room) {
    super(game);
    const p = game.player;
    this.room = room;
    this.enemy = makeRival(room.opponent.hero, room.opponent.name, 0, true);
    this.enemy.set("idle", 0);
    this.location = 2;
    this.newLand = false;
    this.hp = p.maxHp;
    this.estus = DUEL_ESTUS;
    this.estusCap = DUEL_ESTUS;
    this.guardCap = DODGE_GUARD + 0.25; // замах соперника короткий: ранний присед не спасает от следующего
    this.backLabel = "< СДАТЬСЯ";
    this.outbox = [];
    this.sent = 0; // номер последнего своего события (повтор после сбоя связи не применится дважды)
    this.seen = 0; // номер последнего события соперника
    this.ack = 0;
    this.pollT = 0;
    this.inflight = false;
    this.lastOk = game.time;
    this.myAtks = []; // до удара своих выпадов: каждое отжимание — выпад, без ожидания предыдущего
    this.incoming = []; // выпады соперника в очереди
    this.reason = "";
    this.medals0 = game.online.account ? game.online.account.medals || 0 : 0; // медали до боя
    this.medals = null; // после боя — с сервера
    this.meReady = false; // бой начинается, когда оба подтвердили готовность
    this.oppReady = false;
    this.send({ t: "hp", hp: this.hp, max: p.maxHp });
  }
  get started() {
    return this.meReady && this.oppReady;
  }
  /** Кнопка «Я ГОТОВ» поверх картинки боя. */
  readyRect() {
    const g = this.game;
    return g.portrait ? [60, g.gameH - 200, W - 120, 110] : [170, 250, 300, 40];
  }
  setReady() {
    if (this.meReady) return;
    this.meReady = true;
    this.send({ t: "ready" });
    sfx.click();
  }
  send(e) {
    this.outbox.push({ ...e, n: ++this.sent });
  }
  act(move) {
    const p = this.game.player;
    if (move === "pushup") {
      if (this.stamina < p.attackCost) {
        this.exhaustedSound();
        return this.float("Нет сил!", this.HERO_X + 10, 90, COL.green, 8);
      }
      this.stamina -= p.attackCost;
      if (this.stamina < p.attackCost) this.exhaustedSound();
      this.regenPause = 0.6;
      this.myAtks.push(DUEL_WINDUP);
      this.action = "dodge"; // замах: герой пригибается перед выпадом
      this.actionT = DUEL_WINDUP;
      this.send({ t: "atk", dmg: Math.round(p.damage * DUEL_DAMAGE) });
      this.float("ВЫПАД!", this.HERO_X + 10, 90, COL.gold, 8);
    } else if (move === "jack") {
      const before = this.estus;
      super.act("jack");
      if (this.estus < before) {
        this.send({ t: "heal" });
        this.send({ t: "hp", hp: this.hp, max: p.maxHp });
      }
    } else {
      super.act(move);
    }
  }
  startIncoming(dmg) {
    const en = this.enemy;
    en.damage = dmg;
    en.windupTime = DUEL_WINDUP;
    en.windupNow = DUEL_WINDUP;
    en.set("windup", DUEL_WINDUP);
    sfx.alert();
  }
  receive(e) {
    if (!e || !(e.n > this.seen)) return;
    this.seen = e.n;
    const en = this.enemy;
    if (e.t === "atk") this.incoming.push(Math.max(1, Math.min(600, e.dmg | 0)));
    else if (e.t === "hp") {
      const was = en.hp;
      en.hp = e.hp;
      en.maxHp = Math.max(1, e.max);
      if (e.dodged) {
        this.float("УВОРОТ!", en.x + 12, 80, "rgb(140,200,255)");
        sfx.dodge();
      } else if (e.hp < was) {
        en.flash = 0.15;
        this.game.shake = 0.12;
        sfx.hit();
        this.float(`${was - e.hp}`, en.x + 12, 90, COL.text);
      }
    } else if (e.t === "heal") {
      en.set("drink", 0.8);
      this.float("ЗЕЛЬЕ", en.x + 12, 70, "rgb(120,220,120)", 8);
      sfx.heal();
    } else if (e.t === "ready") {
      if (!this.oppReady) sfx.alert();
      this.oppReady = true;
    } else if (e.t === "dead" && !this.result) {
      en.set("dead", 0);
      this.end("won", e.forfeit ? "Соперник сдался" : "");
    }
  }
  /** Обмен с сервером: свои события — туда, события соперника — сюда. */
  net() {
    const g = this.game;
    if (this.inflight || g.time < this.pollT) return;
    if (this.result && !this.outbox.length) return; // после итога отправляем только последнее
    this.pollT = g.time + DUEL_POLL;
    this.inflight = true;
    const events = this.outbox.splice(0);
    g.online.duelSync(this.room.code, this.ack, events)
      .then((r) => {
        this.lastOk = g.time;
        for (const { seq, e } of r.events) {
          this.ack = Math.max(this.ack, seq);
          this.receive(e);
        }
        if (r.opponent_gone && !this.result) this.end("won", "Соперник вышел из дуэли");
      })
      .catch(() => this.outbox.unshift(...events)) // повторим; номера событий защищают от дублей
      .finally(() => (this.inflight = false));
  }
  update(dt) {
    this.net();
    if (!this.result && this.game.time - this.lastOk > DUEL_LOST) this.end("lost", "Нет связи с сервером");
    if (!this.started) this.ready = READY_TIME; // отсчёт пойдёт у обоих, когда оба готовы
    super.update(dt);
  }
  updateEnemy(dt) {
    const en = this.enemy;
    en.timer -= dt;
    if (en.state === "windup" && en.timer <= 0) {
      en.set("attack", 0.2); // короткий удар: следующий выпад из очереди начинается сразу
      const before = this.hp;
      this.resolveHit();
      this.send({ t: "hp", hp: Math.max(0, this.hp), max: this.game.player.maxHp, dodged: this.hp === before });
    } else if ((en.state === "attack" || en.state === "drink") && en.timer <= 0) {
      en.set("idle", 0);
    }
    if (en.state === "idle" && this.incoming.length) this.startIncoming(this.incoming.shift());
    for (let i = 0; i < this.myAtks.length; i++) {
      this.myAtks[i] -= dt;
      if (this.myAtks[i] <= 0) { // выпад: соперник узнает, успел ли присесть
        this.action = "attack";
        this.actionT = 0.3;
        this.slashT = SLASH_TIME;
        this.outfitFx.burst(this.game.outfit, this.HERO_X + 44, GROUND_ARENA - 19);
      }
    }
    this.myAtks = this.myAtks.filter((t) => t > 0);
    const target = en.state === "attack" ? this.HERO_X + 30 : en.homeX;
    en.x += (target - en.x) * Math.min(1, dt * (en.state === "attack" ? 18 : 5));
  }
  end(result, reason = "") {
    if (this.result) return;
    this.result = result;
    this.resultT = 0;
    this.reason = reason;
    if (result !== "lost") this.fetchMedals();
    if (result === "won") {
      this.enemy.set("dead", 0);
      sfx.win();
      vibrate([40, 30, 40]);
    }
  }
  /** Медали после боя: сервер засчитывает итог, когда проигравший сообщил о поражении. */
  fetchMedals(tries = 4) {
    const g = this.game;
    setTimeout(() => {
      if (g.scene !== this) return;
      g.online.me()
        .then((r) => {
          const m = r.account.medals || 0;
          if (m !== this.medals0 || tries <= 1 || this.medals0 === 0) this.medals = m;
          else this.fetchMedals(tries - 1); // итог ещё не дошёл до сервера — спросим снова
        })
        .catch(() => { if (tries > 1) this.fetchMedals(tries - 1); });
    }, 1200);
  }
  die() {
    this.send({ t: "dead" });
    this.end("dead");
    sfx.die();
  }
  leave() {
    if (!this.result) { // сдаться: соперник сразу узнает о победе
      this.send({ t: "dead", forfeit: true });
      this.game.online.duelSync(this.room.code, this.ack, this.outbox.splice(0)).catch(() => {});
    }
    this.game.change(new MultiplayerScene(this.game, "duel"));
  }
  handle(moves) {
    const g = this.game;
    if (!this.result && !this.started) {
      if (g.key("Escape") || g.tapped(this.backRect())) return this.leave();
      if (g.tapped(this.readyRect()) || g.key("Enter", " ") || moves.includes("jack")) this.setReady();
      return;
    }
    if (!this.result) return super.handle(moves);
    if (this.resultT >= 1 && (g.taps.length || g.key("Enter", " ", "Escape"))) {
      g.taps.length = 0;
      g.change(new MultiplayerScene(g, "duel"));
    }
  }
  drawUi() {
    super.drawUi();
    if (this.started || this.result) return;
    const g = this.game, P = g.portrait, r = this.readyRect();
    g.rect([0, 0, W, g.gameH], "rgba(6,4,10,0.78)");
    g.text(tf("ДУЭЛЬ: {name}", { name: this.enemy.name }), W / 2, P ? 110 : 60, P ? 24 : 16, COL.gold, "center");
    const me = this.meReady ? ["Вы: ГОТОВЫ", "rgb(120,220,120)"] : ["Вы: не готовы", COL.dim];
    const op = this.oppReady ? ["Соперник: ГОТОВ", "rgb(120,220,120)"] : ["Соперник: ждём...", COL.dim];
    g.text(me[0], W / 2, P ? 170 : 104, P ? 20 : 12, me[1], "center");
    g.text(op[0], W / 2, P ? 206 : 124, P ? 20 : 12, op[1], "center");
    g.wrap("Поставьте телефон и отойдите: бой начнётся, когда оба готовы", P ? 40 : 70)
      .forEach((line, i) => g.text(line, W / 2, (P ? 250 : 150) + i * (P ? 20 : 11), P ? 14 : 8, COL.dim, "center"));
    g.button(r, this.meReady ? "ЖДЁМ СОПЕРНИКА..." : "Я ГОТОВ", { selected: !this.meReady, size: P ? 28 : 12, color: this.meReady ? COL.dim : COL.gold });
    if (!this.meReady) g.text("или сделайте звёздочку", W / 2, r[1] + r[3] + (P ? 14 : 6), P ? 14 : 8, COL.dim, "center");
  }
  drawResult() {
    const g = this.game;
    const [title, col] = { won: ["ПОБЕДА!", COL.gold], dead: ["ПОРАЖЕНИЕ", "rgb(170,20,20)"], lost: ["ДУЭЛЬ ПРЕРВАНА", COL.dim] }[this.result];
    g.rect([0, g.gameH / 2 - 45, W, 90], `rgba(0,0,0,${Math.min(0.8, this.resultT * 1.2)})`);
    g.text(title, W / 2, g.gameH / 2 - 28, 32, col, "center");
    if (this.reason) g.text(this.reason, W / 2, g.gameH / 2 + 4, 8, COL.text, "center");
    if (this.result !== "lost") {
      const d = this.medals == null ? null : this.medals - this.medals0;
      const t = d == null ? "Медали: подсчёт..." : d > 0 ? tf("+{d} медаль · всего {n}", { d, n: this.medals })
        : d < 0 ? tf("-1 медаль · всего {n}", { n: this.medals }) : tf("Медалей: {n}", { n: this.medals });
      const P = g.portrait, fs = P ? 14 : 8;
      drawMedal(g, W / 2 - tr(t).length * fs / 2 - (P ? 30 : 16), g.gameH / 2 + (P ? 8 : 11), P ? 2 : 1);
      g.text(t, W / 2, g.gameH / 2 + 15, fs, d > 0 ? COL.gold : d < 0 ? "rgb(255,130,100)" : COL.text, "center");
    }
    g.text("Касание: к дуэлям", W / 2, g.gameH / 2 + (g.portrait ? 36 : 30), 8, COL.dim, "center");
  }
}

// ------------------------------------------------------------------ Мультиплеер: рейтинг, вызов, дуэль
const MP_TABS = [["rating", "РЕЙТИНГ"], ["challenge", "ВЫЗОВ"], ["duel", "ДУЭЛЬ"], ["friends", "ДРУЗЬЯ"]];

/** Раскладка мультиплеера: альбомная или вертикальная во весь экран телефона (крупно, под палец). */
function mpLayout(g) {
  const P = g.portrait;
  const tabY = P ? 72 : 30, tabH = P ? 76 : 24, tw = (W - 24 - 8 * (MP_TABS.length - 1)) / MP_TABS.length;
  const tabs = MP_TABS.map((_, i) => [12 + i * (tw + 8), tabY, tw, tabH]);
  const btnH = P ? 100 : 26, btnY = P ? g.H - btnH - 14 : 326;
  const top = P ? 236 : 88;
  return {
    P, tabs, btnY, btnH, top, fs: P ? 20 : 8, small: P ? 14 : 8, head: top - (P ? 30 : 16), info: P ? 162 : 54,
    infoFs: P ? 14 : 8, tabFs: P ? 16 : 8, btnFs: P ? 20 : 8, title: P ? [20, 36] : [8, 16], bottom: btnY - (P ? 24 : 12),
  };
}

/** Высота строки списка: в портрете строки растягиваются на весь экран (до 104 px). */
function mpStep(L, n, reserve = 0) {
  if (!L.P) return 20;
  return Math.max(60, Math.min(104, Math.floor((L.bottom - reserve - L.top) / Math.max(n, 7))));
}

/** Кнопки внизу экрана: делят ширину поровну. */
function bottomButtons(L, labels) {
  const gap = 8, w = (W - 24 - gap * (labels.length - 1)) / labels.length;
  return labels.map((l, i) => [[12 + i * (w + gap), L.btnY, w, L.btnH], l]);
}

/** Пиксельная медаль дуэли 12×16 (×k): красно-синяя лента и золотой диск со звездой. */
function drawMedal(g, x, y, k = 1, dim = false) {
  const px = (cx, cy, w, h, col) => g.rect([x + cx * k, y + cy * k, w * k, h * k], col);
  px(2, 0, 3, 6, dim ? "rgb(90,60,60)" : "rgb(200,40,50)");
  px(7, 0, 3, 6, dim ? "rgb(60,70,90)" : "rgb(60,110,230)");
  px(1, 5, 10, 10, "rgb(60,40,20)");
  px(2, 6, 8, 8, dim ? "rgb(130,120,100)" : "rgb(232,190,92)");
  px(3, 7, 3, 2, dim ? "rgb(170,160,140)" : "rgb(255,240,170)");
  px(5, 8, 2, 4, dim ? "rgb(100,90,70)" : "rgb(170,110,30)");
  px(4, 9, 4, 2, dim ? "rgb(100,90,70)" : "rgb(170,110,30)");
}

/** Иконка игрока в списке: его герой с мечом, доспехами и обликами. В альбомной — голова и плечи. */
function drawAvatar(g, look, x, y, rowH, portrait) {
  const lk = look || { sword: "rusty", looks: [] };
  const spr = anim(`${heroSprite(lk.sword, lk.looks || [], lk.skin, lk.outfit)}_idle`, g.time, 1.5, 2);
  if (!spr) return;
  const c = g.ctx;
  if (!portrait) { // голова 18 px (с рогами самурая и плечом гигантского меча — сверху лишнее срезается)
    const top = Math.max(0, spr.height - 32 - 4);
    c.drawImage(spr, 0, top, spr.width, 18, x, y - 4, spr.width, 18);
    return;
  }
  const k = Math.max(1, Math.floor((rowH - 6) / spr.height * 2) / 2); // ×1, ×1.5, ×2…
  c.drawImage(spr, x, y + rowH - 4 - spr.height * k, spr.width * k, spr.height * k);
}

class MultiplayerScene extends Scene {
  constructor(game, tab = "rating") {
    super(game);
    this.tab = tab;
    this.data = {};
    this.busy = false;
    this.error = "";
    this.room = null; // своя комната дуэли, пока ждём соперника
    this.ratingMode = game.mode; // какой рейтинг смотрим: с камерой или без (по умолчанию — своего режима)
    this.waitT = 0;
    game.accountSync();
    if (this.online.configured && !this.online.loggedIn) this.account(); // без входа — сразу окно авторизации
    this.load();
  }
  get ownsPanel() {
    return this.game.portrait;
  }
  get online() {
    return this.game.online;
  }
  async run(job) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      await job();
    } catch (e) {
      this.error = errorText(e);
    } finally {
      this.busy = false;
    }
  }
  load() {
    const o = this.online;
    if (!o.configured) return;
    if (this.tab === "rating") this.run(async () => (this.data.rating = await o.top(this.ratingMode)));
    if (this.tab === "challenge" && o.loggedIn) this.run(async () => (this.data.arena = await o.arena()));
    if ((this.tab === "friends" || this.tab === "duel") && o.loggedIn) this.run(async () => this.game.onAccount((await o.me()).account));
  }
  /** Вход или выход. Окно входа висит, пока вход не удался; «Отмена» — в главное меню. */
  async account() {
    const g = this.game, o = this.online;
    if (o.loggedIn) {
      const ok = await confirmDialog({ title: "АККАУНТ", text: tf("Выйти из аккаунта {login}?", { login: o.account.login }), ok: "ВЫЙТИ" });
      if (!ok) return;
      g.cloudReady = false; // прогресс больше не уходит в аккаунт, из которого вышли
      await o.logout();
      this.data = {};
    }
    const best = g.profile.best, hero = heroSnapshot(g.player, g.skin, g.outfit);
    const ok = await promptAccount({
      name: g.profile.name,
      ref: savedRef(),
      submit: async (a) => {
        try {
          const acc = a.mode === "register" ? await o.register(a.login, a.password, a.name, best, hero, a.ref) : await o.login(a.login, a.password);
          g.onAccount(acc);
          g.cloudSync(); // прогресс сюжета: из аккаунта или в аккаунт
          g.accountSync();
          g.say(tf("Вы вошли как {name}", { name: acc.name }));
          return null;
        } catch (e) {
          return errorText(e);
        }
      },
    });
    if (!ok) {
      this.cancelRoom();
      if (g.scene === this) g.change(new TitleScene(g));
      return;
    }
    this.data = {};
    this.load();
  }
  async rename() {
    const g = this.game;
    const raw = await promptName({ title: "ИМЯ В ИГРЕ", text: "2-16 символов: буквы, цифры, пробел. Имя видят другие игроки.", value: g.profile.name });
    if (raw == null) return;
    if (!g.profile.rename(raw)) return g.say("Такое имя не подходит");
    g.profile.save();
    if (this.online.loggedIn) await this.run(() => this.online.sync(g.profile.best, heroSnapshot(g.player, g.skin, g.outfit), g.profile.name));
    this.load();
  }
  challenge(row) {
    const g = this.game;
    this.run(async () => {
      g.accountSync();
      const r = await this.online.challengeStart(row.id);
      g.change(new ChallengeScene(g, r));
    });
  }
  createRoom() {
    const g = this.game;
    this.run(async () => {
      const r = await this.online.duelCreate(g.profile.best, heroSnapshot(g.player, g.skin, g.outfit));
      this.room = r.code;
      this.waitT = 0;
    });
  }
  async joinRoom() {
    const g = this.game;
    const code = await promptText({ title: "ВОЙТИ ПО КОДУ", text: "Код комнаты из 4 символов: его видит на экране создатель дуэли.", maxLength: 4, ok: "ВОЙТИ" });
    if (!code) return;
    this.run(async () => {
      const r = await this.online.duelJoin(code.trim().toUpperCase(), g.profile.best, heroSnapshot(g.player, g.skin, g.outfit));
      g.change(new DuelScene(g, r));
    });
  }
  cancelRoom() {
    if (this.room) this.online.duelLeave(this.room).catch(() => {});
    this.room = null;
  }
  switchTab(tab) {
    if (tab === this.tab) return;
    this.cancelRoom();
    this.tab = tab;
    this.error = "";
    this.load();
  }
  buttons() {
    const L = mpLayout(this.game), o = this.online;
    const acc = o.loggedIn ? "ВЫЙТИ" : "ВОЙТИ";
    if (this.tab === "rating") return bottomButtons(L, [acc, "ИМЯ", this.ratingMode === "btn" ? "КНОПКИ" : "КАМЕРА", "НАЗАД"]);
    if (this.tab === "challenge" || this.tab === "friends") return bottomButtons(L, [acc, "ОБНОВИТЬ", "НАЗАД"]);
    return bottomButtons(L, [acc, "НАЗАД"]);
  }
  /** «Бросить вызов»: строки списка (окно вокруг игрока) и их высота. */
  arenaView(L) {
    const a = this.data.arena, top = L.top + this.podiumH(L);
    if (!a) return { rows: [], step: mpStep(L, 7), top };
    const reserve = (L.P ? 64 : 24) + (top - L.top); // место под тройку лидеров и подсказку
    const pos = a.pos;
    const rows = a.rows.filter((r) => Math.abs(r.pos - pos) <= 8); // окно вокруг игрока (тройка — отдельно, сверху)
    const step = mpStep(L, Math.min(rows.length, 11), reserve);
    const room = Math.max(4, Math.floor((L.bottom - reserve - L.top) / step));
    const me = rows.findIndex((r) => r.me);
    const from = Math.max(0, Math.min(me - Math.floor(room / 2), rows.length - room));
    return { rows: rows.slice(from, from + room), step, top };
  }
  /** Высота панели «тройка лидеров» над списком соперников. */
  podiumH(L) {
    return L.P ? 186 : 50;
  }
  challengeButton(L, i, step) {
    const bw = L.P ? 170 : 90;
    return [W - 14 - bw, this.arenaView(L).top + i * step + 4, bw, step - 10];
  }
  /** Первые 3 места лестницы: карточки с героем, именем и уровнем. */
  drawPodium(L, a) {
    const g = this.game, P = L.P, y = L.head - (P ? -6 : 2), h = this.podiumH(L) - (P ? 16 : 8);
    const gap = 8, w = (W - 24 - gap * 2) / 3;
    const cols = ["rgb(255,215,90)", "rgb(210,215,225)", "rgb(220,150,90)"];
    if (!P) g.text("ТОП-3", W / 2, y - 11, 8, COL.gold, "center"); // в портрете места подписаны на карточках
    for (let i = 0; i < 3; i++) {
      const row = a.rows.find((r) => r.pos === i + 1), x = 12 + i * (w + gap);
      g.rect([x, y, w, h], row && row.me ? "rgba(232,190,92,0.25)" : "rgba(255,255,255,0.06)");
      g.rect([x, y, w, P ? 4 : 2], cols[i]);
      if (!row) continue;
      g.text(`${i + 1}`, x + (P ? 10 : 4), y + (P ? 14 : 6), P ? 28 : 8, cols[i]);
      if (P) drawAvatar(g, row.look, x + 10, y + 48, h - 48, true);
      else drawAvatar(g, row.look, x + 16, y + 8, 18, false);
      const tx = P ? x + 86 : x + 40, fs = P ? (row.name.length > 7 ? 12 : 16) : 8;
      const name = row.name.length > (P ? 10 : 12) ? row.name.slice(0, P ? 9 : 11) + "." : row.name;
      g.text(row.bot ? `${name}*` : name, tx, y + (P ? 60 : 8), fs, row.me ? COL.gold : COL.text);
      g.text(tf("ур. {n}", { n: row.level }), tx, y + (P ? 92 : 22), P ? 14 : 8, COL.dim);
    }
  }
  friendButtons(L) {
    const h = L.P ? 96 : 30, y = L.P ? L.top + 340 : L.top + 150, w = (W - 24 - 12) / 2;
    return { copy: [12, y, w, h], share: [24 + w, y, w, h] };
  }
  /** Ссылка-приглашение: в буфер обмена или через «Поделиться» телефона. */
  async invite(how) {
    const g = this.game, inv = this.online.account && this.online.account.invite;
    if (!inv || !inv.code) return;
    const url = inviteLink(inv.code);
    const text = tf("Тренируйся и сражайся со мной в Ash & Iron! Мой код друга: {code}", { code: inv.code });
    try {
      if (how === "share" && navigator.share) await navigator.share({ title: "Ash & Iron", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        g.say("Ссылка-приглашение скопирована", 3);
      }
    } catch (e) {
      if (!(e && e.name === "AbortError")) g.say(tf("Ваш код друга: {code}", { code: inv.code }), 5);
    }
  }
  duelButtons(L) {
    const h = L.P ? 120 : 34, w = W - 80, y = L.top + (L.P ? 300 : 96);
    if (this.room) return { cancel: [40, y + h + 24, w, h] };
    return { create: [40, y, w, h], join: [40, y + h + 24, w, h] };
  }
  handle() {
    const g = this.game, L = mpLayout(g);
    L.tabs.forEach((r, i) => { if (g.tapped(r)) { sfx.click(); this.switchTab(MP_TABS[i][0]); } });
    for (const [r, label] of this.buttons()) {
      if (!g.tapped(r)) continue;
      sfx.click();
      if (label === "НАЗАД") { this.cancelRoom(); return g.change(new TitleScene(g)); }
      if (label === "ВОЙТИ" || label === "ВЫЙТИ") return this.account();
      if (label === "ИМЯ") return this.rename();
      if (label === "ОБНОВИТЬ") return this.load();
      if (label === "КАМЕРА" || label === "КНОПКИ") { // переключить рейтинг: с камерой / без камеры
        this.ratingMode = this.ratingMode === "btn" ? "cam" : "btn";
        this.data.rating = null;
        return this.load();
      }
    }
    if (g.key("Escape")) { this.cancelRoom(); return g.change(new TitleScene(g)); }
    if (!this.online.loggedIn || this.busy) return;
    if (this.tab === "challenge" && this.data.arena && this.data.arena.attempts > 0) {
      const v = this.arenaView(L);
      v.rows.forEach((row, i) => { if (row.can && g.tapped(this.challengeButton(L, i, v.step))) this.challenge(row); });
    }
    if (this.tab === "friends") {
      const b = this.friendButtons(L);
      if (g.tapped(b.copy)) { sfx.click(); this.invite("copy"); }
      if (g.tapped(b.share)) { sfx.click(); this.invite("share"); }
    }
    if (this.tab === "duel") {
      const b = this.duelButtons(L);
      if (b.create && g.tapped(b.create)) this.createRoom();
      if (b.join && g.tapped(b.join)) this.joinRoom();
      if (b.cancel && g.tapped(b.cancel)) this.cancelRoom();
    }
  }
  update(dt) {
    if (!this.room || this.busy) return;
    this.waitT -= dt;
    if (this.waitT > 0) return;
    this.waitT = 1; // ждём соперника: раз в секунду спрашиваем сервер
    const g = this.game, code = this.room;
    this.busy = true;
    this.online.duelSync(code, 0, [])
      .then((r) => { if (r.opponent && this.room === code && g.scene === this) g.change(new DuelScene(g, { code, side: 0, opponent: r.opponent })); })
      .catch((e) => { this.error = errorText(e); })
      .finally(() => (this.busy = false));
  }
  draw(c) {
    c.drawImage(IMG.castle_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.66)";
    c.fillRect(0, 0, CW, CH);
  }
  drawUi() {
    const g = this.game, L = mpLayout(g), o = this.online;
    if (L.P) g.rect([0, GAME_H, W, g.H - GAME_H], "rgba(10,6,12,1)");
    g.text("МУЛЬТИПЛЕЕР", W / 2, L.title[0], L.title[1], COL.gold, "center");
    L.tabs.forEach((r, i) => g.button(r, MP_TABS[i][1], { selected: this.tab === MP_TABS[i][0], size: L.tabFs }));
    let info;
    if (!o.configured) info = "Мультиплеер недоступен в этой версии игры";
    else if (o.loggedIn) info = tf("Аккаунт: {login} · имя: {name}", { login: o.account.login, name: g.profile.name });
    else info = "Войдите или зарегистрируйтесь: результат и покупки сохранятся в аккаунте";
    g.wrap(info, L.P ? 42 : 76).slice(0, 2).forEach((line, i) => g.text(line, 14, L.info + i * (L.infoFs + 6), L.infoFs, o.loggedIn ? "rgb(150,220,150)" : COL.dim));
    const msgY = L.btnY - (L.P ? 22 : 12);
    if (this.error) g.text(this.error, W / 2, msgY, L.small, "rgb(255,130,100)", "center");
    else if (this.busy) g.text("Связь с сервером...", W / 2, msgY, L.small, COL.dim, "center");
    if (o.configured) {
      if (this.tab === "rating") this.drawRating(L);
      else if (this.tab === "challenge") this.drawChallenge(L);
      else if (this.tab === "friends") this.drawFriends(L);
      else this.drawDuel(L);
    }
    for (const [r, label] of this.buttons()) g.button(r, label, { size: L.btnFs });
  }
  /** Строка списка: подсветка своей строки, место, иконка игрока, имя. */
  drawRowBase(L, y, step, rank, row, isMe, nameCol) {
    const g = this.game;
    if (isMe) g.rect([12, y, W - 24, step - 4], "rgba(232,190,92,0.2)");
    else if (L.P) g.rect([12, y, W - 24, step - 4], "rgba(255,255,255,0.04)");
    const ty = y + (step - 4 - L.fs) / 2;
    g.text(`${rank}`, 18, ty, L.fs, nameCol);
    drawAvatar(g, row.look, L.P ? 66 : 40, L.P ? y : y + 2, step, L.P);
    return ty;
  }
  drawRating(L) {
    const g = this.game, r = this.data.rating, myId = this.online.account && this.online.account.id;
    const cols = L.P ? [[18, "#"], [138, "ИМЯ"], [410, "БОССЫ"], [500, "УР."], [566, "РАУНД"]] : [[20, "#"], [68, "ИМЯ"], [400, "БОССЫ"], [486, "УР."], [560, "РАУНД"]];
    cols.forEach(([x, h], i) => {
      if (i === 1) h = `${tr(h)} · ${tr(this.ratingMode === "btn" ? "БЕЗ КАМЕРЫ" : "С КАМЕРОЙ")}`; // чей это рейтинг
      g.text(h, x, L.head, L.small, i === 1 ? COL.gold : COL.dim);
    });
    g.rect([12, L.top - 6, W - 24, 1], "rgb(90,64,50)");
    if (!r) return;
    const step = mpStep(L, Math.min(r.rows.length + 1, 12));
    const cap = Math.max(4, Math.floor((L.bottom - L.top) / step));
    const show = r.rows.slice(0, cap).map((row, i) => [i + 1, row]);
    const mine = r.rows.findIndex((x) => x.id === myId);
    if ((r.rank && mine < 0) || mine >= cap) { // своё место — последней строкой
      show.length = Math.min(show.length, cap - 1);
      const acc = this.online.account, best = this.ratingMode === "btn" ? acc.best_btn || g.profile.bests.btn : acc.best;
      show.push([r.rank, { id: myId, name: g.profile.name, look: heroSnapshot(g.player, g.skin, g.outfit), ...best }]);
    }
    show.forEach(([rank, row], i) => {
      const y = L.top + i * step, isMe = row.id === myId;
      const col = isMe ? COL.gold : rank <= 3 ? "rgb(255,220,150)" : COL.text;
      const ty = this.drawRowBase(L, y, step, rank, row, isMe, col);
      const nameFs = L.P ? (row.name.length > 12 ? 14 : 16) : 8;
      g.text(row.name, cols[1][0], ty + (L.fs - nameFs) / 2, nameFs, col);
      [[2, row.bosses], [3, row.level], [4, row.wave]].forEach(([c, v]) => g.text(`${v}`, cols[c][0], ty, L.fs, col));
    });
    if (!r.rows.length) g.text("Пока никого: станьте первым!", W / 2, L.top + 40, L.fs, COL.dim, "center");
  }
  drawChallenge(L) {
    const g = this.game, a = this.data.arena;
    if (!this.online.loggedIn) return this.drawLoginHint(L);
    const nameX = L.P ? 138 : 68, lvX = L.P ? 400 : 400;
    const v = this.arenaView(L), head = v.top - (L.top - L.head);
    if (a) this.drawPodium(L, a);
    g.text("#", 18, head, L.small, COL.dim);
    g.text("СОПЕРНИК", nameX, head, L.small, COL.dim);
    g.text("УР.", lvX, head, L.small, COL.dim);
    if (a) {
      const t = tf("Попыток сегодня: {n}/{max}", { n: a.attempts, max: a.per_day }), col = a.attempts ? COL.gold : COL.red;
      if (L.P) g.text(t, 14, L.info + 24, 14, col);
      else g.text(t, W - 14, head, 8, col, "right");
    }
    g.rect([12, v.top - 6, W - 24, 1], "rgb(90,64,50)");
    if (!a) return;
    v.rows.forEach((row, i) => {
      const y = v.top + i * v.step;
      const col = row.me ? COL.gold : row.bot ? "rgb(170,160,150)" : COL.text;
      const ty = this.drawRowBase(L, y, v.step, row.pos, row, row.me, col);
      const nameFs = L.P ? (row.name.length > 11 ? 14 : 16) : 8;
      g.text(row.bot ? `${row.name} *` : row.name, nameX, ty + (L.fs - nameFs) / 2, nameFs, col);
      g.text(`${row.level}`, lvX + (L.P ? 0 : 0), ty, L.fs, col);
      if (row.can) g.button(this.challengeButton(L, i, v.step), "ВЫЗОВ", { size: L.P ? 16 : 8, color: a.attempts ? "rgb(255,140,100)" : COL.dim });
    });
    const hint = "* бот. Вызов — тем, кто до 3 мест выше или ниже. Победа: вы встаёте на место соперника";
    g.wrap(hint, L.P ? 50 : 78).slice(0, 2).forEach((line, i) => g.text(line, 14, L.bottom - (L.P ? 52 : 22) + i * (L.P ? 20 : 10), L.P ? 12 : 8, COL.dim));
  }
  drawDuel(L) {
    const g = this.game;
    if (!this.online.loggedIn) return this.drawLoginHint(L);
    const lines = [
      "Бой с живым игроком в реальном времени: у каждого свой телефон и камера.",
      "Отжимание — выпад, соперник видит замах. Присед — уворот на секунду, тратит немного сил. Звёздочка — зелье.",
    ];
    let y = L.top;
    for (const t of lines) for (const line of g.wrap(t, L.P ? 38 : 76)) { g.text(line, 20, y, L.P ? 16 : 8, COL.text); y += L.P ? 28 : 12; }
    const b = this.duelButtons(L);
    if (this.room) {
      g.text("КОД КОМНАТЫ", W / 2, b.cancel[1] - (L.P ? 260 : 96), L.P ? 20 : 8, COL.dim, "center");
      g.text(this.room, W / 2, b.cancel[1] - (L.P ? 220 : 84), L.P ? 80 : 32, COL.gold, "center");
      g.text("Скажите код сопернику. Ждём его...", W / 2, b.cancel[1] - (L.P ? 100 : 40), L.P ? 16 : 8, COL.dim, "center");
      g.button(b.cancel, "ОТМЕНА", { size: L.btnFs });
    } else {
      const m = (this.online.account && this.online.account.medals) || 0, k = L.P ? 3 : 1;
      const my = y + (L.P ? 6 : 2);
      drawMedal(g, 20, my, k);
      g.text(tf("Медали дуэлей: {n}", { n: m }), 20 + 16 * k, my + (L.P ? 8 : 4), L.P ? 22 : 8, COL.gold);
      g.wrap("Победа: +1 медаль. Поражение: -1 (не ниже нуля)", L.P ? 34 : 70)
        .forEach((line, i) => g.text(line, 20 + 16 * k, my + (L.P ? 38 + i * 20 : 14 + i * 10), L.P ? 13 : 8, COL.dim));
      g.button(b.create, "СОЗДАТЬ КОМНАТУ", { size: L.P ? 24 : 8, color: COL.gold });
      g.button(b.join, "ВОЙТИ ПО КОДУ", { size: L.P ? 24 : 8 });
    }
  }
  /** «Друзья»: свой код, ссылка, награда — «Клинок Побратима» на своём герое. */
  drawFriends(L) {
    const g = this.game, P = L.P, inv = this.online.account && this.online.account.invite;
    if (!this.online.loggedIn) return this.drawLoginHint(L);
    let y = L.top;
    g.wrap("Пригласи друга — получите оба облик «Клинок Побратима». Его нельзя купить!", P ? 38 : 76)
      .forEach((line, i) => g.text(line, W / 2, y + i * (P ? 26 : 12), P ? 16 : 8, COL.gold, "center"));
    y += P ? 64 : 28;
    // герой с наградой
    const p = g.player, hs = heroSprite(p.sword, p.worn, "kin", g.outfit), spr = anim(`${hs}_idle`, g.time, 1.5, 2);
    const k = P ? 5 : 2, hx = P ? 60 : 40, hy = y + (P ? 230 : 100) - spr.height * k;
    g.ctx.drawImage(spr, hx, hy, spr.width * k, spr.height * k);
    for (let i = 0; i < 2; i++) { // духи-побратимы кружат вокруг
      const a = g.time * 2.4 + i * Math.PI, cx = hx + 12 * k + Math.cos(a) * 14 * k, cy = hy + 18 * k + Math.sin(a) * 6 * k;
      g.rect([cx - k, cy - k, 2 * k, 2 * k], i ? "rgb(255,220,110)" : "rgb(120,255,220)");
    }
    const tx = P ? 260 : 120;
    g.text("ТВОЙ КОД ДРУГА", tx, y + (P ? 10 : 4), P ? 14 : 8, COL.dim);
    g.text(inv && inv.code ? inv.code : "...", tx, y + (P ? 40 : 18), P ? 48 : 24, "rgb(120,255,220)");
    if (inv) {
      g.text(tf("Пришло друзей: {n}", { n: inv.invited }), tx, y + (P ? 120 : 52), P ? 16 : 8, COL.text);
      g.text(tf("Победили босса: {n}", { n: inv.done }), tx, y + (P ? 150 : 66), P ? 16 : 8, inv.done ? "rgb(120,220,120)" : COL.text);
      if (inv.by_friend) {
        const t = inv.friend_done ? "Вас пригласил друг: облик уже получен" : "Вас пригласил друг: победите первого босса — облик получите вы оба";
        g.wrap(t, P ? 24 : 40).forEach((line, i) => g.text(line, tx, y + (P ? 186 : 82) + i * (P ? 20 : 10), P ? 12 : 8, "rgb(255,200,120)"));
      }
    }
    const b = this.friendButtons(L);
    g.button(b.copy, "СКОПИРОВАТЬ ССЫЛКУ", { size: P ? 16 : 8, color: COL.gold });
    g.button(b.share, "ПОДЕЛИТЬСЯ", { size: P ? 16 : 8 });
    const how = [
      "1. Отправь другу ссылку или код.",
      "2. Друг регистрируется: код подставится сам (или ввести вручную).",
      "3. Друг побеждает первого босса — облик получаете вы оба.",
    ];
    let hy2 = b.copy[1] + b.copy[3] + (P ? 30 : 12);
    for (const t of how) for (const line of g.wrap(t, P ? 42 : 80)) { g.text(line, 20, hy2, P ? 14 : 8, COL.dim); hy2 += P ? 24 : 11; }
  }
  drawLoginHint(L) {
    const g = this.game;
    g.wrap("Вызовы и дуэли доступны после входа в аккаунт: кнопка ВОЙТИ внизу.", L.P ? 32 : 60)
      .forEach((line, i) => g.text(line, W / 2, L.top + 60 + i * (L.P ? 32 : 14), L.P ? 20 : 8, COL.gold, "center"));
  }
}

// ------------------------------------------------------------------ Кузница
// Вкладки кузницы: оружие, броня, талисманы. n — число вещей во вкладке (последняя строка — «назад»).
const shopTabRect = (j) => [18 + j * 130, 40, 124, 24];
const shopRect = (i, n) => [18, 70 + i * 29, 384, i === n ? 22 : 27];
/** Телефон вертикально: вкладки и список во весь экран под «чёлкой» с героем. */
function shopTabRectTall(g, j) {
  const w = (W - 32 - 16) / 3;
  return [16 + j * (w + 8), GAME_H + 12, w, 64];
}
function shopRectTall(g, i, n) {
  const top = GAME_H + 92, gap = 10, backH = 60, msgH = 40;
  const h = Math.max(44, Math.min(110, Math.floor((g.H - top - 16 - backH - msgH - gap * n) / n)));
  if (i === n) return [W / 2 - 160, top + n * (h + gap) + msgH, 320, backH];
  return [16, top + i * (h + gap), W - 32, h];
}

/** Мечи за алые камни, уникальное снаряжение за синие (с боссов). */
class ShopScene extends Scene {
  constructor(game) {
    super(game);
    this.index = 0;
    this.tab = 0; // вкладка: оружие, броня, талисманы
    this.embers = new Particles(300, 120, 10);
    this.previewEmbers = new Particles(548, 236, 16, 6); // искры пепельного клинка в превью
    this.say("Алые камни дают за каждого врага, синие за боссов.", 4);
  }
  get ownsPanel() {
    return this.game.portrait;
  }
  /** Строки текущей вкладки: вещи и «назад». */
  get rows() {
    return [...SHOP_TABS[this.tab][2], "back"];
  }
  rect(i) {
    const n = this.rows.length - 1;
    return this.game.portrait ? shopRectTall(this.game, i, n) : shopRect(i, n);
  }
  tabRect(j) {
    return this.game.portrait ? shopTabRectTall(this.game, j) : shopTabRect(j);
  }
  setTab(j) {
    if (j === this.tab) return;
    this.tab = j;
    this.index = 0;
    sfx.click();
  }
  drawTabs() {
    const g = this.game;
    SHOP_TABS.forEach(([, label], j) => g.button(this.tabRect(j), label, { selected: j === this.tab, size: g.portrait ? 16 : 8 }));
  }
  say(msg, t = 3) {
    this.message = msg;
    this.msgT = t;
  }
  /** Платное оружие (гриф): оплата в магазине, вещь выдаётся персонажу. */
  async buyPaid(key) {
    const g = this.game, p = g.player, it = item(key);
    if (this.busy) return;
    this.busy = true;
    const ok = await g.store.buy({ id: it.productId, name: it.name });
    this.busy = false;
    if (!ok) return g.store.lastError && this.say(g.store.lastError);
    p.grantPaid(key);
    p.save();
    sfx.buy();
    this.say(tf("Куплено: {name}! Оружие надето.", { name: it.name }));
  }
  async choose(key) {
    const g = this.game, p = g.player, it = item(key);
    if (key === "back") return g.change(new BonfireScene(g));
    if (this.busy) return;
    if (it.paid && !p.owned.includes(key)) return this.buyPaid(key);
    if (p.owned.includes(key)) {
      if (SWORDS[key] || ARMORS.includes(key) || TALISMANS.includes(key)) {
        p.equip(key); // доспех и талисман, как и меч, надеваются по одному: прежний снимается
        this.say(tf("Надет: {name}", { name: it.name }));
      } else {
        this.say(tf("{name} уже действует", { name: it.name }));
      }
    } else {
      if (!p.canAfford(key)) {
        sfx.deny();
        const [red, blue] = it.price;
        return this.say(`Не хватает камней: нужно ${blue ? `${blue} синих` : `${red} алых`}`);
      }
      this.busy = true; // покупку нужно подтвердить: камни тратятся безвозвратно
      const ok = await confirmDialog({ title: "КУПИТЬ?", text: tf("{name} за {price} — {desc}", { name: it.name, price: priceText(key), desc: it.desc }), ok: "КУПИТЬ" });
      this.busy = false;
      if (!ok || !p.buy(key)) return;
      sfx.level();
      this.say(tf(SWORDS[key] ? "Куплено: {name}! Меч надет." : ARMORS.includes(key) ? "Куплено: {name}! Доспех надет."
        : TALISMANS.includes(key) ? "Куплено: {name}! Талисман надет." : "Куплено: {name}!", { name: it.name }));
    }
    p.save();
  }
  handle() {
    const g = this.game, rows = this.rows, n = rows.length;
    if (g.key("Escape")) return g.change(new BonfireScene(g));
    if (g.key("ArrowLeft")) this.setTab((this.tab + SHOP_TABS.length - 1) % SHOP_TABS.length);
    if (g.key("ArrowRight")) this.setTab((this.tab + 1) % SHOP_TABS.length);
    SHOP_TABS.forEach((_, j) => { if (g.tapped(this.tabRect(j))) this.setTab(j); });
    if (g.key("ArrowUp")) this.index = (this.index + n - 1) % n;
    if (g.key("ArrowDown")) this.index = (this.index + 1) % n;
    const activate = (i) => {
      sfx.click();
      this.index = i;
      this.choose(rows[i]);
    };
    if (g.key("Enter", " ")) return activate(this.index);
    rows.forEach((_, i) => { if (g.tapped(this.rect(i))) activate(i); });
  }
  update(dt) {
    this.embers.update(dt);
    this.previewEmbers.update(dt);
    this.msgT -= dt;
  }
  draw(c) {
    c.drawImage(IMG.arena_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.43)";
    c.fillRect(0, 0, CW, CH);
    c.drawImage(anim("bonfire", this.game.time, 8, 4), 292, GROUND_ARENA - 22); // горн
    this.embers.draw(c);
  }
  /** Статус вещи в кузнице: [текст, цвет]. */
  status(key) {
    const p = this.game.player, it = item(key);
    if (p.owned.includes(key)) {
      if (p.sword === key || p.armor === key || p.talisman === key) return ["НАДЕТ", COL.gold];
      return SWORDS[key] ? ["ВЗЯТЬ", COL.text] : ["НАДЕТЬ", COL.text];
    }
    if (it.paid) return [this.game.store.price(it.productId), "rgb(120,220,255)"];
    let scol = it.price[1] ? "rgb(130,170,255)" : "rgb(240,110,110)";
    if (!p.canAfford(key)) scol = it.price[1] ? "rgb(65,85,128)" : "rgb(120,55,55)";
    return [priceText(key), scol];
  }
  /** Герой в выбранном снаряжении; на непокупленной вещи — примерка. */
  drawHero(x, ground, scale) {
    const g = this.game, p = g.player, key = this.rows[this.index];
    const sword = SWORDS[key] ? key : p.sword;
    // примерка доспеха или талисмана — только он (вместе такие не надеваются)
    const slot = ARMORS.includes(key) ? ARMORS : TALISMANS.includes(key) ? TALISMANS : null;
    const owned = slot ? [...p.worn.filter((k) => !slot.includes(k)), key] : p.worn;
    const hero = anim(`${heroSprite(sword, owned, null, g.outfit)}_idle`, g.time, 1.5, 2);
    g.ctx.drawImage(hero, x, ground - hero.height * scale, hero.width * scale, hero.height * scale);
    if (key !== "back" && !p.owned.includes(key)) {
      g.text("ПРИМЕРКА", x + (hero.width * scale) / 2, ground - hero.height * scale - 20, g.portrait ? 16 : 8, "rgb(120,220,255)", "center");
    }
    return sword;
  }
  drawTall() {
    const g = this.game, p = g.player, w = p.weapon;
    // «чёлка»: заголовок, оружие и крупный герой у горна
    g.text("КУЗНИЦА", 18, 16, 24, COL.gold);
    g.gems(W - 18, 18, p, "right");
    g.text(w.name, 18, 52, 16, COL.text);
    g.text(`урон ${p.damage}  крит x${w.crit}  удар ${w.cost} сил`, 18, 76, 12, COL.dim);
    const relics = Object.keys(RELICS).filter((k) => p.worn.includes(k)).map((k) => RELICS[k].name);
    relics.forEach((name, i) => g.text(name, 18, 96 + i * 16, 12, "rgb(150,190,255)"));
    Object.assign(this.previewEmbers, { x: W / 2 + 157, y: 2 * GROUND_ARENA - 42, spread: 9 });
    if (this.drawHero(W / 2 + 40, 2 * GROUND_ARENA + 24, 6) === "ash") this.previewEmbers.draw(g.ctx);
    this.drawTabs();
    this.rows.forEach((key, i) => {
      const r = this.rect(i), sel = this.index === i;
      if (key === "back") return g.button(r, "НАЗАД К КОСТРУ", { selected: sel, size: 16 });
      const it = item(key), [status, scol] = this.status(key);
      g.button(r, "", { selected: sel });
      const big = r[3] >= 70, nameFs = big ? 24 : 16;
      g.text(it.name, r[0] + 14, r[1] + r[3] / 2 - nameFs - 2, nameFs, it.paid ? "rgb(255,150,150)" : it.unique ? "rgb(150,190,255)" : sel ? COL.gold : COL.text);
      g.text(it.desc, r[0] + 14, r[1] + r[3] / 2 + 4, 12, COL.dim);
      g.text(status, r[0] + r[2] - 14, r[1] + r[3] / 2 + 2, 16, scol, "right");
    });
    if (this.msgT > 0) {
      const b = this.rect(this.rows.length - 1);
      g.text(this.message, W / 2, b[1] - 30, this.message.length * 12 <= W - 32 ? 12 : 8, COL.gold, "center");
    }
  }
  drawUi() {
    if (this.game.portrait) return this.drawTall();
    const g = this.game, p = g.player;
    g.rect([10, 6, 400, 352], "rgba(10,6,14,0.85)");
    g.ctx.strokeStyle = "rgb(90,64,50)";
    g.ctx.strokeRect(10.5, 6.5, 399, 351);
    g.text("КУЗНИЦА", 22, 20, 16, COL.gold);
    g.gems(400, 24, p, "right");
    this.drawTabs();
    this.rows.forEach((key, i) => {
      const r = this.rect(i), sel = this.index === i;
      if (key === "back") return g.button(r, "НАЗАД К КОСТРУ", { selected: sel });
      const it = item(key), [status, scol] = this.status(key);
      g.button(r, "", { selected: sel });
      g.text(it.name, r[0] + 8, r[1] + 3, 8, it.paid ? "rgb(255,150,150)" : it.unique ? "rgb(150,190,255)" : sel ? COL.gold : COL.text);
      g.text(it.desc, r[0] + 8, r[1] + 13, 8, COL.dim);
      g.text(status, r[0] + r[2] - 8, r[1] + 8, 8, scol, "right");
    });
    // крупное превью героя; на непокупленной вещи — примерка
    if (this.drawHero(470, 2 * GROUND_ARENA, 4) === "ash") this.previewEmbers.draw(g.ctx);
    const w = p.weapon;
    g.text(w.name, W - 12, 20, 8, COL.text, "right");
    g.text(`урон ${p.damage} крит x${w.crit}`, W - 12, 34, 8, COL.dim, "right");
    g.text(`удар ${w.cost} сил`, W - 12, 46, 8, COL.dim, "right");
    const relics = Object.keys(RELICS).filter((k) => p.worn.includes(k)).map((k) => RELICS[k].name);
    relics.forEach((name, i) => g.text(name, W - 12, 62 + i * 12, 8, "rgb(150,190,255)", "right"));
    if (this.msgT > 0) g.wrap(this.message, 26).forEach((l, i) => g.text(l, W - 12, GAME_H - 52 + i * 12, 8, COL.gold, "right"));
  }
}

// ------------------------------------------------------------------ Лавка образов (косметика за 1 $)
const COS_KINDS = ["sword", "armor", "hit", "victory"];
const COS_LAYOUT = (() => {
  const rows = [];
  let y = 38;
  for (const kind of COS_KINDS) {
    rows.push({ head: KIND_TITLES[kind], y });
    y += 12;
    for (const item of COSMETICS.filter((c) => c.kind === kind)) {
      rows.push({ item, rect: [12, y, 318, 22] });
      y += 23;
    }
  }
  return rows;
})();
const COS_ITEMS = COS_LAYOUT.filter((r) => r.item);
const COS_PREVIEW = [340, 40, 288, 200];
const COS_ACTION = [340, 322, 288, 26];
const COS_RESTORE = [12, 322, 186, 26];
const COS_BACK = [206, 322, 124, 26];
const COS_WIDE = { rows: COS_LAYOUT, preview: COS_PREVIEW, action: COS_ACTION, restore: COS_RESTORE, back: COS_BACK };

/** Телефон вертикально: превью с героем в «чёлке», список и кнопки во весь экран. */
function cosLayoutTall(g) {
  const preview = [84, 10, 472, 328]; // пропорции сцены превью 144×100
  const bottom = g.H - 12;
  const back = [W - 216, bottom - 52, 200, 52], restore = [16, bottom - 52, W - 248, 52];
  const action = [16, bottom - 52 - 12 - 60, W - 32, 60];
  const top = GAME_H + 70, headH = 26, gap = 8, n = COS_ITEMS.length;
  const h = Math.max(40, Math.min(84, Math.floor((action[1] - 16 - top - COS_KINDS.length * headH - gap * n) / n)));
  const rows = [];
  let y = top;
  for (const kind of COS_KINDS) {
    rows.push({ head: KIND_TITLES[kind], y });
    y += headH;
    for (const item of COSMETICS.filter((c) => c.kind === kind)) {
      rows.push({ item, rect: [16, y, W - 32, h] });
      y += h + gap;
    }
  }
  return { rows, preview, action, restore, back, tall: true };
}

/** Витрина: живое превью меча, удара по манекену и оформления победы; покупка и «надеть». */
class CosmeticsScene extends Scene {
  constructor(game) {
    super(game);
    this.index = 0;
    this.busy = false;
    this.pc = document.createElement("canvas"); // пиксельная сцена превью 144×100 (×2 на экране)
    this.pc.width = 144;
    this.pc.height = 100;
    this.pctx = this.pc.getContext("2d");
    this.vc = document.createElement("canvas"); // превью победы рисуется в полный экран и уменьшается
    this.vc.width = W;
    this.vc.height = GAME_H;
    this.aura = new SwordAura();
    this.outfitFx = new OutfitFx(); // лепестки сакуры доспеха самурая
    this.hitFx = new HitFx();
    this.demoT = 0;
    this.msgT = 0;
    this.resetPreview();
  }
  get item() {
    return COS_ITEMS[this.index].item;
  }
  get ownsPanel() {
    return this.game.portrait;
  }
  layout() {
    return this.game.portrait ? cosLayoutTall(this.game) : COS_WIDE;
  }
  say(msg, t = 3) {
    this.message = msg;
    this.msgT = t;
  }
  resetPreview() {
    this.demoT = 0;
    this.victory = this.item.kind === "victory" ? new VictoryFx(this.item.id) : null;
  }
  select(i) {
    if (i === this.index) return;
    this.index = i;
    sfx.click();
    this.resetPreview();
  }
  async action() {
    const g = this.game, it = this.item;
    if (this.busy) return;
    if (it.invite && !g.store.owns(it.id)) { // облик за друга: купить нельзя — ведём во вкладку «Друзья»
      const go = await choiceDialog({
        title: "ОБЛИК ЗА ДРУГА",
        text: tf("«{name}» нельзя купить: его получают за приглашённого друга. Друг регистрируется по вашему коду и побеждает первого босса — облик получаете вы оба.", { name: it.name }),
        buttons: [[null, "ОТМЕНА"], ["go", "ПРИГЛАСИТЬ ДРУГА", true]],
      });
      if (go === "go") g.change(new MultiplayerScene(g, "friends"));
      return;
    }
    if (!g.store.owns(it.id)) {
      this.busy = true;
      const bought = await g.store.buy(it);
      this.busy = false;
      if (!bought) return g.store.lastError && this.say(g.store.lastError, 4);
      sfx.buy();
      g.profile.style[it.kind] = it.id; // купленное сразу надевается
      g.profile.save();
      return this.say(tf("Куплено и надето: {name}", { name: it.name }), 4);
    }
    const on = g.profile.style[it.kind] === it.id;
    g.profile.style[it.kind] = on ? null : it.id;
    g.profile.save();
    sfx.click();
    this.say(tf(on ? "Снято: {name}" : "Надето: {name}", { name: it.name }));
  }
  async restore() {
    const ids = await this.game.store.restore();
    this.game.syncPaid();
    this.say(this.game.store.lastError || (ids.length ? `Покупки восстановлены: ${ids.length}` : "Покупок пока нет"));
  }
  handle() {
    const g = this.game, n = COS_ITEMS.length, L = this.layout();
    if (g.key("Escape") || g.tapped(L.back)) return g.change(new TitleScene(g));
    if (g.key("ArrowUp")) this.select((this.index + n - 1) % n);
    if (g.key("ArrowDown")) this.select((this.index + 1) % n);
    if (g.key("Enter", " ") || g.tapped(L.action)) return this.action();
    if (g.tapped(L.restore)) return this.restore();
    L.rows.filter((r) => r.item).forEach((r, i) => { if (g.tapped(r.rect)) this.select(i); });
  }
  update(dt) {
    this.msgT -= dt;
    this.demoT += dt;
    // демо: каждые 2,4 с герой бьёт манекен
    const phase = this.demoT % 2.4;
    this.attacking = phase > 1.0 && phase < 1.35;
    if (phase > 1.0 && phase - dt <= 1.0) {
      this.slashT = SLASH_TIME;
      const hit = this.item.kind === "hit" ? this.item.id : this.game.style("hit");
      if (hit) this.hitFx.spawn(hit, 108, 64);
      this.demoHits = (this.demoHits || 0) + 1;
      if (this.previewSkin === "phoenix" && this.demoHits % 2 === 0) { // показать струю пламени на крите
        this.aura.jet(34 + 37, 61, 108, 62);
        sfx.flame();
      }
      this.outfitFx.burst(this.previewOutfit, 72, 61);
      this.dummyFlash = 0.15;
    }
    this.slashT = Math.max(0, (this.slashT || 0) - dt);
    this.dummyFlash = Math.max(0, (this.dummyFlash || 0) - dt);
    this.aura.update(dt, this.previewSkin, this.attacking ? "attack" : "idle", this.attacking ? 34 : 28, 48);
    this.outfitFx.update(dt, this.previewOutfit, 28, 48);
    this.hitFx.update(dt);
    if (this.victory) {
      this.victory.update(dt);
      if (this.victory.t > 4.5) this.victory = new VictoryFx(this.item.id);
    }
  }
  /** Облик доспеха в превью: выбранный в списке (примерка) или надетый. */
  get previewOutfit() {
    return this.item.kind === "armor" ? this.item.outfit : this.game.outfit;
  }
  /** Облик меча в превью: выбранный в списке (примерка) или надетый. */
  get previewSkin() {
    return this.item.kind === "sword" ? this.item.skin : this.game.skin;
  }
  draw(c) {
    c.drawImage(IMG.arena_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(0, 0, CW, CH);
  }
  drawPreview() {
    const g = this.game, p = g.player, c = this.pctx, t = g.time;
    c.imageSmoothingEnabled = false;
    c.drawImage(IMG.arena_bg, 60, 60, 144, 100, 0, 0, 144, 100);
    const skin = this.previewSkin, outfit = this.previewOutfit; // примерка доспеха
    const hs = heroSprite(p.sword, p.worn, skin, outfit);
    const pose = this.attacking ? "attack" : "idle", hx = this.attacking ? 34 : 28;
    const dummy = this.dummyFlash > 0 ? IMG.skeleton_hurt_0 : IMG.skeleton_idle_0;
    c.drawImage(dummy, 96, 80 - dummy.height);
    const heroSpr = this.attacking ? IMG[`${hs}_attack_0`] : anim(`${hs}_idle`, t, 1.5, 2);
    this.aura.drawBehind(c, skin, pose, hx, 48, t);
    c.drawImage(heroSpr, hx, 80 - heroSpr.height);
    this.aura.draw(c, skin, pose, hx, 48, t);
    this.outfitFx.draw(c);
    if (this.slashT > 0) drawSlash(c, hx + 34, 61, p.sword, 1 - this.slashT / SLASH_TIME, skin);
    this.hitFx.draw(c);
    const [x, y, w, h] = this.layout().preview;
    g.ctx.drawImage(this.pc, x, y, w, h);
    if (this.victory) {
      const vc = this.vc.getContext("2d");
      vc.clearRect(0, 0, W, GAME_H);
      vc.drawImage(this.pc, 0, 0, W, GAME_H);
      this.victory.draw(vc, (ctx, ...a) => g.text(a[0], a[1], a[2], a[3], a[4], a[5], a[6] ?? true, ctx), {
        title: "БОСС ПОВЕРЖЕН", loot: "+560 пепла  +5 алых  +1 синий", hint: "",
      });
      g.ctx.drawImage(this.vc, x, y, w, h);
    }
    g.ctx.strokeStyle = COL.gold;
    g.ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }
  drawTall() {
    const g = this.game, it = this.item, owned = g.store.owns(it.id), L = this.layout();
    this.drawPreview();
    const [px, py, pw] = L.preview;
    g.rect([px, py, pw, 30], "rgba(10,6,14,0.75)");
    g.text("ЛАВКА ОБРАЗОВ", px + 10, py + 7, 16, COL.gold);
    if (g.store.badge) g.text(g.store.badge, px + pw - 10, py + 11, 8, "rgb(120,220,255)", "right");
    // выбранная вещь — под «чёлкой» с превью
    g.text(it.name, 16, GAME_H + 8, 24, `rgb(${it.color.join(",")})`);
    g.text(this.msgT > 0 ? this.message : tf("{desc} · только облик", { desc: it.desc }), 16, GAME_H + 40, 12, this.msgT > 0 ? COL.gold : COL.dim);
    for (const row of L.rows) {
      if (row.head) {
        g.text(row.head, 18, row.y + 6, 12, COL.dim);
        continue;
      }
      const ci = COS_ITEMS.findIndex((r) => r.item === row.item), sel = ci === this.index, r = row.rect, c = row.item;
      g.button(r, "", { selected: sel });
      g.rect([r[0] + 8, r[1] + 8, 8, r[3] - 16], `rgb(${c.color.join(",")})`);
      g.text(c.name, r[0] + 28, r[1] + r[3] / 2 - 20, 16, sel ? COL.gold : COL.text);
      g.text(c.desc, r[0] + 28, r[1] + r[3] / 2 + 4, 12, COL.dim);
      const on = g.profile.style[c.kind] === c.id && g.store.owns(c.id);
      const status = on ? "НАДЕТО" : g.store.owns(c.id) ? "ЕСТЬ" : c.invite ? "ДРУГ" : g.store.price(c.id);
      g.text(status, r[0] + r[2] - 14, r[1] + r[3] / 2 - 8, 16, on ? COL.gold : g.store.owns(c.id) ? COL.text : "rgb(120,220,255)", "right");
    }
    const on = g.profile.style[it.kind] === it.id && owned;
    const label = !owned ? (it.invite ? "ПОЛУЧИТЬ ЗА ДРУГА" : `КУПИТЬ ЗА ${g.store.price(it.id)}`) : on ? "СНЯТЬ" : "НАДЕТЬ";
    g.button(L.action, label, { selected: true, size: 24, color: owned ? COL.gold : "rgb(120,220,255)" });
    g.button(L.restore, "ВОССТАНОВИТЬ ПОКУПКИ", { size: 16 });
    g.button(L.back, "НАЗАД", { size: 16 });
  }
  drawUi() {
    if (this.game.portrait) return this.drawTall();
    const g = this.game, it = this.item, owned = g.store.owns(it.id);
    g.text("ЛАВКА ОБРАЗОВ", 14, 14, 16, COL.gold);
    if (g.store.badge) g.text(g.store.badge, W - 12, 18, 8, "rgb(120,220,255)", "right");
    for (const row of COS_LAYOUT) {
      if (row.head) {
        g.text(row.head, 14, row.y + 3, 8, COL.dim);
        continue;
      }
      const ci = COS_ITEMS.indexOf(row), sel = ci === this.index, r = row.rect, c = row.item;
      g.button(r, "", { selected: sel });
      g.rect([r[0] + 6, r[1] + 3, 4, 16], `rgb(${c.color.join(",")})`);
      g.text(c.name, r[0] + 16, r[1] + 2, 8, sel ? COL.gold : COL.text);
      g.text(c.desc, r[0] + 16, r[1] + 12, 8, c.price ? "rgb(255,170,80)" : c.invite ? "rgb(120,255,220)" : COL.dim);
      const on = g.profile.style[c.kind] === c.id && g.store.owns(c.id);
      const status = on ? "НАДЕТО" : g.store.owns(c.id) ? "ЕСТЬ" : c.invite ? "ДРУГ" : g.store.price(c.id);
      g.text(status, r[0] + r[2] - 8, r[1] + 7, 8, on ? COL.gold : g.store.owns(c.id) ? COL.text : "rgb(120,220,255)", "right");
    }
    this.drawPreview();
    const [x, y, w, h] = COS_PREVIEW;
    g.text(it.name, x, y + h + 10, 8, `rgb(${it.color.join(",")})`);
    g.text(it.desc, x, y + h + 24, 8, COL.text);
    g.text("Только облик: сила героя не меняется", x, y + h + 38, 8, COL.dim);
    if (this.msgT > 0) g.text(this.message, x, y + h + 56, 8, COL.gold);
    const on = g.profile.style[it.kind] === it.id && owned;
    const label = !owned ? (it.invite ? "ПОЛУЧИТЬ ЗА ДРУГА" : `КУПИТЬ ЗА ${g.store.price(it.id)}`) : on ? "СНЯТЬ" : "НАДЕТЬ";
    g.button(COS_ACTION, label, { selected: true, color: owned ? COL.gold : "rgb(120,220,255)" });
    g.button(COS_RESTORE, "ВОССТАНОВИТЬ ПОКУПКИ");
    g.button(COS_BACK, "НАЗАД");
  }
}

// ------------------------------------------------------------------ Рейтинг
const LB_NAME = [12, 322, 250, 26];
const LB_REFRESH = [270, 322, 170, 26];
const LB_BACK = [448, 322, 180, 26];
const LB_ROWS = 10;

/** Раскладка рейтинга: альбомная или вертикальная во весь экран телефона. */
function lbLayout(g) {
  if (!g.portrait) {
    return {
      name: LB_NAME, refresh: LB_REFRESH, back: LB_BACK, rows: LB_ROWS, fs: 8, btnFs: 8, head: 56, top: 76, step: 21,
      cols: [22, 64, 400, 486, 560], status: [290, 76, 12, 8],
    };
  }
  const back = [W / 2 + 8, g.H - 88, W / 2 - 24, 72], refresh = [16, g.H - 88, W / 2 - 24, 72];
  const name = [16, g.H - 172, W - 32, 72];
  const status = [name[1] - 64, 36, 24, 16];
  const top = GAME_H + 52, step = 40;
  const rows = Math.max(5, Math.min(20, Math.floor((status[0] - 12 - top) / step)));
  return { name, refresh, back, rows, fs: 16, btnFs: 16, head: GAME_H + 16, top, step, cols: [20, 76, 380, 476, 548], status };
}

/** Рейтинг по побеждённым боссам и уровню. Без сети — сохранённая таблица, игра не ждёт сервер. */
class LeaderboardScene extends Scene {
  constructor(game) {
    super(game);
    this.res = null;
    this.load();
  }
  async load() {
    this.loading = true;
    const g = this.game;
    g.recordProgress();
    try {
      this.res = await g.leaderboard.top(g.profile);
    } finally {
      this.loading = false;
    }
  }
  async rename() {
    const g = this.game;
    const raw = await promptName({
      title: "ИМЯ В РЕЙТИНГЕ",
      text: "2-16 символов: буквы, цифры, пробел. Имя видят другие игроки.",
      value: g.profile.name,
    });
    if (raw == null) return;
    if (!g.profile.rename(raw)) return g.say("Такое имя не подходит");
    g.profile.save();
    g.leaderboard.submit(g.profile);
    this.load();
  }
  handle() {
    const g = this.game;
    const L = lbLayout(g);
    if (g.key("Escape") || g.tapped(L.back)) return g.change(new TitleScene(g));
    if (g.tapped(L.refresh) || g.key("Enter")) return this.load();
    if (g.tapped(L.name)) return this.rename();
  }
  get ownsPanel() {
    return this.game.portrait;
  }
  /** «Чёлка» в портрете: заголовок и ваш результат крупно, на фоне замка. */
  drawHeader() {
    const g = this.game, b = g.profile.best, r = this.res;
    g.text("РЕЙТИНГ", W / 2, 24, 40, COL.gold, "center");
    g.text("по побеждённым боссам, затем по уровню", W / 2, 76, 12, COL.dim, "center");
    const hs = heroSprite(g.player.sword, g.player.worn, g.skin, g.outfit), hero = anim(`${hs}_idle`, g.time, 1.5, 2);
    g.ctx.drawImage(hero, 28, 324 - hero.height * 4, hero.width * 4, hero.height * 4); // рыцарь у карточки игрока
    const cx = 136, cw = W - 16 - cx, mid = cx + cw / 2;
    g.rect([cx, 120, cw, 200], "rgba(10,6,14,0.8)");
    g.ctx.strokeStyle = COL.gold;
    g.ctx.strokeRect(cx + 0.5, 120.5, cw - 1, 199);
    g.text(g.profile.name, mid, 138, 24, COL.gold, "center");
    g.text(r && r.rank ? `${r.rank} место` : "место: ...", mid, 180, 32, COL.text, "center");
    const line = `Боссы ${b.bosses}  Ур. ${b.level}  Раунд ${b.wave}`;
    g.text(line, mid, 240, line.length * 16 <= cw - 24 ? 16 : 12, COL.text, "center");
  }
  draw(c) {
    c.drawImage(IMG.castle_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.62)";
    c.fillRect(0, 0, CW, CH);
  }
  drawUi() {
    const g = this.game, me = g.profile.id, L = lbLayout(g), fs = L.fs;
    if (g.portrait) this.drawHeader();
    else {
      g.text("РЕЙТИНГ", 14, 14, 16, COL.gold);
      g.text("по побеждённым боссам, затем по уровню", 14, 36, 8, COL.dim);
    }
    const r = this.res;
    let status = "Загрузка...", scol = COL.dim;
    if (r) {
      if (r.source === "online") [status, scol] = ["Онлайн", "rgb(120,220,120)"];
      else if (r.source === "cache") {
        const when = r.at ? new Date(r.at).toLocaleDateString("ru-RU") : "";
        [status, scol] = [tf("Нет сети: сохранённая таблица {when}", { when }).trim(), "rgb(230,180,90)"];
      } else if (g.leaderboard.offline) [status, scol] = ["Онлайн-рейтинг появится в следующей версии: показан ваш результат", "rgb(230,180,90)"];
      else [status, scol] = ["Сервер рейтинга не подключён: показан ваш результат", "rgb(230,180,90)"];
      if (r.pending) status = tr(status) + tr(" · ваш результат отправится при появлении сети");
    }
    const [sy, swrap, sstep, ssize] = L.status;
    g.wrap(status, swrap).forEach((line, i) => g.text(line, 14, sy + i * sstep, ssize, scol));
    const [c0, c1, c2, c3, c4] = L.cols;
    const cols = [[c0, "#"], [c1, "ИМЯ"], [c2, "БОССЫ"], [c3, "УР."], [c4, "РАУНД"]];
    cols.forEach(([x, h]) => g.text(h, x, L.head, g.portrait ? 12 : 8, COL.dim));
    g.rect([14, L.top - 8, W - 28, 1], "rgb(90,64,50)");
    if (r) {
      const rows = r.rows.slice(0, L.rows);
      const mine = r.rows.findIndex((x) => x.player_id === me);
      const show = rows.map((row, i) => [i + 1, row]);
      if (mine >= L.rows || (mine < 0 && r.rank)) {
        show.length = Math.min(show.length, L.rows - 1);
        const own = r.rows[mine] || { name: g.profile.name, ...g.profile.best, player_id: me };
        show.push([r.rank || mine + 1, own]);
      }
      show.forEach(([rank, row], i) => {
        const y = L.top + i * L.step, isMe = row.player_id === me;
        if (isMe) g.rect([14, y - L.step * 0.2, W - 28, L.step * 0.9], "rgba(232,190,92,0.18)");
        const col = isMe ? COL.gold : rank <= 3 ? "rgb(255,220,150)" : COL.text;
        g.text(`${rank}`, c0, y, fs, col);
        g.text(row.name, c1, y, fs, col);
        g.text(`${row.bosses}`, c2, y, fs, col);
        g.text(`${row.level}`, c3, y, fs, col);
        g.text(`${row.wave}`, c4, y, fs, col);
      });
    }
    g.button(L.name, tf("ИМЯ: {name}", { name: g.profile.name }), { size: L.btnFs });
    g.button(L.refresh, this.loading ? "..." : "ОБНОВИТЬ", { size: L.btnFs });
    g.button(L.back, "НАЗАД", { size: L.btnFs });
  }
}

// ------------------------------------------------------------------ Камера и советы
class CameraScene extends Scene {
  constructor(game) {
    super(game);
    this.manual = true;
  }
  get needsCamera() {
    return true;
  }

  handle(moves) {
    const g = this.game;
    if (moves.some((m) => m === "pushup" || m === "squat" || m === "jack")) sfx.rep();
    if (g.key("Escape", "Enter") || g.tapped([W / 2 - 60, GAME_H - 30, 120, 22])) g.change(new SettingsScene(g));
    if (g.tapped([240, 300, 160, 24])) { sfx.click(); return g.change(new TutorialScene(g, new CameraScene(g))); }
    if (g.tapped([20, 300, 200, 24])) {
      if (g.motion.denied && isNative()) openAppSettings(); // доступ запрещён — включается только в Настройках iOS
      else if (!g.motion.ok && !g.motion.starting) g.motion.start();
      else if (g.motion.ok && g.motion.status !== "камера активна") g.motion.resume();
    }
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
    g.text(tf("Статус: {status}", { status: g.motion.status }), x, 40, 8);
    g.text(tf("Поза: {pose}", { pose: d.posture }), x, 54, 8);
    g.text(tf("Колени {knee}  Локти {elbow}  Наклон {tilt}", { knee: fmt(d.knee), elbow: fmt(d.elbow), tilt: fmt(d.tilt) }), x, 68, 8, COL.dim);
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
    if (g.motion.denied && isNative()) g.button([20, 300, 200, 24], "РАЗРЕШИТЬ В НАСТРОЙКАХ");
    else if ((!g.motion.ok && !g.motion.starting) || (g.motion.ok && g.motion.status !== "камера активна")) {
      g.button([20, 300, 200, 24], "ВКЛЮЧИТЬ КАМЕРУ");
    }
    g.button([240, 300, 160, 24], "ОБУЧЕНИЕ", { color: COL.gold });
    g.button([W / 2 - 60, GAME_H - 30, 120, 22], "НАЗАД");
    if (!g.portrait) {
      g.cameraWidget();
      g.manualButtons();
    }
  }
}

// ------------------------------------------------------------------ Обучение движениям (первый вход с камерой)
const TUTORIAL_KEY = "ash-and-iron-tutorial";
const TUTORIAL = [
  { ex: "stand", title: "ВСТАНЬТЕ В КАДР", pose: "idle", lines: [
    "Поставьте телефон на пол у стены и отойдите на 2-3 м.",
    "Всё тело — от головы до ног — должно быть в кадре.",
    "В бою кнопок нет: играете только движениями." ] },
  { ex: "squat", need: 2, title: "ПРИСЕД — УВОРОТ", pose: "dodge", lines: [
    "Встаньте к телефону боком и присядьте 2 раза.",
    "В бою присед спасает от удара на 1 секунду и тратит немного сил.",
    "Сидеть внизу бесполезно: встаньте и присядьте снова." ] },
  { ex: "pushup", need: 2, title: "ОТЖИМАНИЕ — УДАР", pose: "attack", lines: [
    "Боком к телефону отожмитесь 2 раза.",
    "Каждое отжимание — удар мечом.",
    "Удар тратит силы: следите за зелёной полоской." ] },
  { ex: "jack", need: 1, title: "ЗВЁЗДОЧКА — ЗЕЛЬЕ", pose: "heal", lines: [
    "Встаньте лицом к телефону и сделайте звёздочку:",
    "руки над головой, ноги в стороны.",
    "Зелье лечит и восстанавливает силы." ] },
  { ex: "punch", need: 3, title: "БОКС — В БОЙ", pose: "attack", lines: [
    "Кулаки у лица, затем 3 резких удара вперёд.",
    "Лучше встать боком или вполоборота.",
    "У костра бокс начинает бой — не нужно подходить к телефону." ] },
  { ex: "done", title: "ГОТОВО!", pose: "idle", lines: [
    "У костра просто начните упражнение — начнётся прокачка навыка.",
    "Встаньте у костра в планку — герой медитирует и копит ауру.",
    "Звук «бзз-бзз» — нельзя: не хватает пепла или сил.",
    "Удачи, рыцарь!" ] },
];

class TutorialScene extends Scene {
  constructor(game, back = null) {
    super(game);
    this.back = back; // куда вернуться (по умолчанию — главное меню)
    this.step = 0;
    this.done = 0;
    this.standT = 0;
    this.okT = 0; // «ОТЛИЧНО!» перед следующим шагом
  }
  get needsCamera() {
    return true;
  }
  get cur() {
    return TUTORIAL[this.step];
  }
  buttons() {
    const g = this.game;
    const last = this.cur.ex === "done";
    if (g.portrait) {
      const [a, , c] = g.manual.map(([, r]) => r);
      return [[a, last ? "В ИГРУ" : "ПРОПУСТИТЬ"], [c, "ЗАКРЫТЬ"]];
    }
    return [[[20, GAME_H - 34, 180, 24], last ? "В ИГРУ" : "ПРОПУСТИТЬ"], [[210, GAME_H - 34, 120, 24], "ЗАКРЫТЬ"]];
  }
  finish() {
    saveJSON(TUTORIAL_KEY, true);
    const g = this.game;
    g.change(this.back || new TitleScene(g));
  }
  next() {
    this.step = Math.min(TUTORIAL.length - 1, this.step + 1);
    this.done = 0;
    this.standT = 0;
  }
  passed() {
    sfx.level();
    vibrate([60, 40, 120]);
    this.okT = 1.2;
  }
  handle(moves) {
    const g = this.game;
    for (const [r, label] of this.buttons()) {
      if (!g.tapped(r)) continue;
      sfx.click();
      if (label === "ЗАКРЫТЬ" || label === "В ИГРУ") return this.finish();
      return this.next();
    }
    if (g.key("Escape")) return this.finish();
    if (g.key("Enter", " ")) return this.cur.ex === "done" ? this.finish() : this.next();
    if (this.okT > 0) return;
    const st = this.cur;
    for (const m of moves) {
      if (m !== st.ex) continue;
      this.done += 1;
      m === "punch" ? sfx.hit() : sfx.rep();
      if (this.done >= st.need) return this.passed();
    }
  }
  update(dt) {
    const g = this.game, st = this.cur;
    if (this.okT > 0) {
      this.okT -= dt;
      if (this.okT <= 0) this.next();
      return;
    }
    if (st.ex === "stand") { // в кадре полторы секунды подряд
      const inFrame = g.motion.ok && g.motion.detector.posture !== "нет человека";
      this.standT = inFrame ? this.standT + dt : 0;
      if (this.standT >= 1.5) this.passed();
    }
  }
  draw(c) {
    c.drawImage(IMG.title_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(0, 0, CW, CH);
  }
  drawUi() {
    const g = this.game, P = g.portrait, st = this.cur, t = g.time;
    const fs = P ? 14 : 8, chars = P ? 40 : 48; // в портрете — крупно: читать приходится издалека
    g.text(tf("ОБУЧЕНИЕ · шаг {n} из {all}", { n: this.step + 1, all: TUTORIAL.length }), 20, P ? 14 : 12, P ? 12 : 8, COL.dim);
    g.text(st.title, 20, P ? 34 : 28, P ? 24 : 16, COL.gold);
    let y = P ? 74 : 54;
    for (const t0 of st.lines) for (const line of g.wrap(tr(t0), chars)) { g.text(line, 20, y, fs, COL.text); y += fs + (P ? 8 : 4); }
    // герой показывает движение
    const p = g.player, hs = heroSprite(p.sword, p.worn, g.skin, g.outfit);
    const pose = st.pose === "idle" || Math.floor(t * 2) % 2 ? `${hs}_idle_0` : `${hs}_${st.pose}_0`;
    const spr = IMG[pose] || IMG[`${hs}_idle_0`], k = 3;
    const hx = P ? W - 30 - spr.width * k : 440, hy = (P ? 330 : 250) - spr.height * k;
    g.ctx.drawImage(spr, hx, hy, spr.width * k, spr.height * k);
    // прогресс шага
    let status = "";
    if (this.okT > 0) status = "ОТЛИЧНО!";
    else if (st.ex === "stand") status = !g.motion.ok ? g.motion.status : this.standT > 0 ? "Вижу вас! Стойте так..." : "Жду, пока вы встанете в кадр";
    else if (st.need) status = tf("Сделано: {done} из {need}", { done: this.done, need: st.need });
    const sy = P ? 260 : 210;
    if (status) g.text(status, 20, sy, P ? 16 : 12, this.okT > 0 ? "rgb(150,250,150)" : COL.gold);
    if (st.need) g.bar(20, sy + (P ? 26 : 18), P ? 300 : 260, 8, this.done / st.need, "rgb(230,140,50)");
    if (!P) g.cameraWidget();
    for (const [r, label] of this.buttons()) g.button(r, label, { size: P ? 16 : 8, color: label === "В ИГРУ" ? COL.gold : undefined });
  }
}

// ------------------------------------------------------------------ Настройки
const SETTINGS_KEY = "ash-and-iron-settings";
const ALERT_LEVELS = [[0, "ВЫКЛ"], [0.5, "ТИХО"], [1, "НОРМА"], [1.5, "ГРОМКО"]];
const TELEGRAM_URL = "https://t.me/ashe_and_iron";

/** Раскладка настроек: альбомная (640×360) или вертикальная во весь экран телефона. */
function settingsLayout(g) {
  if (!g.portrait) {
    const row = (y) => ({ label: [40, y + 12], minus: [300, y, 44, 36], plus: [556, y, 44, 36], bar: [352, y + 8, 196, 20] });
    return {
      title: 16, fs: { title: 24, label: 12, btn: 12, sign: 16 },
      volume: row(60), alert: row(108), vibLabel: [40, 168], vib: [300, 156, 140, 36], diff: [448, 156, 152, 36],
      test: [40, 204, 170, 34], code: [218, 204, 180, 34], tg: [406, 204, 194, 34], camera: [40, 256, 270, 36], support: [330, 256, 270, 36],
      lang: [330, 308, 270, 34], back: [40, 308, 270, 34],
    };
  }
  const row = (y) => ({ label: [24, y], minus: [24, y + 36, 88, 72], plus: [W - 112, y + 36, 88, 72], bar: [128, y + 52, W - 256, 40] });
  const btn = (i) => [24, 572 + i * 88, W - 48, 74];
  return {
    title: 36, fs: { title: 32, label: 24, btn: 24, sign: 32 },
    volume: row(110), alert: row(250), vibLabel: [24, 392], vib: [24, 428, W - 48, 74],
    test: btn(0), tg: btn(1), camera: btn(2), support: btn(3), lang: btn(4), code: btn(5), diff: btn(6),
    back: [W / 2 - 160, Math.max(btn(7)[1] + 16, g.H - 100), 320, 74],
  };
}

class SettingsScene extends Scene {
  get ownsPanel() {
    return this.game.portrait;
  }
  set(key, value) {
    const g = this.game;
    g.settings[key] = value;
    saveJSON(SETTINGS_KEY, g.settings);
    setAudio(g.settings);
  }
  handle() {
    const g = this.game, st = g.settings, L = settingsLayout(g);
    const step = (i, d) => ALERT_LEVELS[Math.max(0, Math.min(ALERT_LEVELS.length - 1, i + d))][0];
    const ai = Math.max(0, ALERT_LEVELS.findIndex(([v]) => v === st.alert));
    if (g.tapped(L.volume.minus)) { this.set("volume", Math.max(0, Math.round(st.volume * 10 - 1) / 10)); sfx.click(); }
    if (g.tapped(L.volume.plus)) { this.set("volume", Math.min(1, Math.round(st.volume * 10 + 1) / 10)); sfx.click(); }
    if (g.tapped(L.alert.minus)) { this.set("alert", step(ai, -1)); sfx.alert(); }
    if (g.tapped(L.alert.plus)) { this.set("alert", step(ai, 1)); sfx.alert(); }
    if (g.tapped(L.vib)) { this.set("vibrate", !st.vibrate); sfx.click(); }
    if (g.tapped(L.diff)) { // сложность: с камерой — на выбор, без камеры — всегда хардкор
      if (g.mode === "btn") { sfx.deny(); g.say("Без камеры игра всегда на хардкоре", 3); }
      else { this.set("hard", !st.hard); st.hard ? sfx.thunder() : sfx.click(); }
    }
    if (g.tapped(L.test)) sfx.alert();
    if (g.tapped(L.tg)) {
      sfx.click();
      openUrl(TELEGRAM_URL); // на телефоне откроется приложение Telegram
    }
    if (g.tapped(L.lang)) { // русский <-> английский
      this.set("lang", getLang() === "ru" ? "en" : "ru");
      setLang(g.settings.lang);
      sfx.click();
    }
    if (g.tapped(L.code)) { sfx.click(); return g.redeemCode(); }
    if (g.tapped(L.camera)) return g.change(new CameraScene(g));
    if (g.tapped(L.support)) return g.change(new SupportScene(g));
    if (g.key("Escape") || g.tapped(L.back)) g.change(new TitleScene(g));
  }
  draw(c) {
    c.drawImage(IMG.arena_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(0, 0, CW, CH);
  }
  /** Строка-шкала: подпись, «−», деления, «+». */
  slider(row, fs, label, k, value) {
    const g = this.game;
    value = tr(value); // ширина подложки — по переведённому слову
    g.text(label, row.label[0], row.label[1], fs.label);
    g.button(row.minus, "-", { size: fs.sign });
    g.button(row.plus, "+", { size: fs.sign });
    const [x0, y, w, h] = row.bar, segs = 10, sw = w / segs;
    for (let i = 0; i < segs; i++) {
      g.rect([x0 + i * sw + 1, y, sw - 3, h], i < Math.round(k * segs) ? COL.gold : "rgb(50,36,40)");
    }
    const tw = value.length * fs.label + fs.label; // подложка, чтобы значение читалось поверх делений
    g.rect([x0 + w / 2 - tw / 2, y - 2, tw, h + 4], "rgba(10,6,14,0.92)");
    g.text(value, x0 + w / 2, y + (h - fs.label) / 2, fs.label, COL.gold, "center");
  }
  drawUi() {
    const g = this.game, st = g.settings, L = settingsLayout(g), fs = L.fs;
    g.text("НАСТРОЙКИ", W / 2, L.title, fs.title, COL.gold, "center");
    this.slider(L.volume, fs, "Громкость", st.volume, `${Math.round(st.volume * 100)}%`);
    const al = ALERT_LEVELS.find(([v]) => v === st.alert) || ALERT_LEVELS[2];
    this.slider(L.alert, fs, "Сигнал «приседай»", st.alert / 1.5, al[1]);
    g.text(isNative() ? "Вибрация" : "Вибрация (Android)", L.vibLabel[0], L.vibLabel[1], fs.label);
    const hard = g.hard, dl = g.portrait ? (hard ? "СЛОЖНОСТЬ: ХАРДКОР" : "СЛОЖНОСТЬ: ОБЫЧНАЯ") : hard ? "ХАРДКОР" : "ОБЫЧНАЯ";
    g.button(L.diff, dl, { size: fs.btn, color: hard ? "rgb(255,90,70)" : COL.text, border: hard ? "rgb(150,30,30)" : undefined });
    g.button(L.vib, st.vibrate ? "ВКЛ" : "ВЫКЛ", { size: fs.btn, selected: st.vibrate });
    g.button(L.test, g.portrait ? "ПРОВЕРИТЬ СИГНАЛ" : "СИГНАЛ", { size: fs.btn });
    g.button(L.code, "ВВЕСТИ КОД", { size: fs.btn, color: COL.gold });
    g.button(L.tg, "Наш Telegram", { size: fs.btn, color: "rgb(120,200,255)", border: "rgb(70,140,200)" });
    g.button(L.camera, "Камера и советы", { size: fs.btn });
    g.button(L.support, "Поддержать проект", { size: fs.btn, color: "rgb(255,150,150)" });
    g.button(L.lang, `${tr("Язык")}: ${LANGS[getLang()]}`, { size: fs.btn, color: "rgb(150,220,150)" });
    g.button(L.back, "НАЗАД", { size: fs.btn });
  }
}

// ------------------------------------------------------------------ Поддержать проект
const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];

function supportLayout(g) {
  if (!g.portrait) {
    return {
      title: [14, 24], heart: [48, 6], text: [98, 8, 70, 14], tips: TIPS.map((_, i) => [40, 150 + i * 46, 560, 40]),
      fs: { name: 12, desc: 8, price: 12 }, msg: [292, 8], back: [W / 2 - 90, 314, 180, 32], backFs: 12,
    };
  }
  const tips = TIPS.map((_, i) => [24, 372 + i * 128, W - 48, 114]);
  const end = tips[tips.length - 1][1] + 114;
  return {
    title: [36, 32], heart: [104, 14], text: [222, 16, 36, 26], tips,
    fs: { name: 24, desc: 16, price: 32 }, msg: [end + 28, 16],
    back: [W / 2 - 160, Math.max(end + 80, g.H - 100), 320, 74], backFs: 24,
  };
}

class SupportScene extends Scene {
  constructor(game) {
    super(game);
    this.msgT = 0;
    this.busy = false;
  }
  get ownsPanel() {
    return this.game.portrait;
  }
  handle() {
    const g = this.game, L = supportLayout(g);
    L.tips.forEach((r, i) => {
      if (!this.busy && g.tapped(r)) {
        this.busy = true;
        g.store.tip(TIPS[i]).then((ok) => {
          this.busy = false;
          if (!ok) return;
          sfx.fanfare();
          this.msgT = 4;
          this.burst = 1.2;
        });
      }
    });
    if (g.key("Escape") || g.tapped(L.back)) g.change(new SettingsScene(g));
  }
  update(dt) {
    this.msgT -= dt;
    this.burst = Math.max(0, (this.burst || 0) - dt);
  }
  draw(c) {
    c.drawImage(IMG.title_bg, 0, 0);
    c.fillStyle = "rgba(0,0,0,0.65)";
    c.fillRect(0, 0, CW, CH);
  }
  drawUi() {
    const g = this.game, t = g.time, L = supportLayout(g), fs = L.fs;
    g.text("ПОДДЕРЖАТЬ ПРОЕКТ", W / 2, L.title[0], L.title[1], COL.gold, "center");
    // пиксельное сердце, бьётся сильнее после поддержки
    const base = L.heart[1];
    const px = base + Math.round(((Math.sin(t * 4) + 1) * 0.5 + (this.burst || 0) * 2) * (base / 6));
    const hx = W / 2 - 3.5 * px, hy = L.heart[0];
    HEART.forEach((row, y) => [...row].forEach((v, x) => {
      if (v === "1") g.rect([hx + x * px, hy + y * px, px, px], y < 2 && x > 0 && x < 3 ? "rgb(255,150,150)" : "rgb(200,40,50)");
    }));
    const text = "Игра бесплатна: без рекламы и без платной силы. Если Ash & Iron помогает вам тренироваться, поддержите разработку.";
    const [ty, tsize, twrap, tstep] = L.text;
    g.wrap(text, twrap).forEach((l, i) => g.text(l, W / 2, ty + i * tstep, tsize, COL.text, "center"));
    TIPS.forEach((tip, i) => {
      const r = L.tips[i];
      g.button(r, "", { selected: i === 0 });
      g.text(tip.name, r[0] + 16, r[1] + r[3] / 2 - fs.name - 2, fs.name, COL.gold);
      g.text(tip.desc, r[0] + 16, r[1] + r[3] / 2 + 6, fs.desc, COL.dim);
      g.text(g.store.tipPrice(tip), r[0] + r[2] - 16, r[1] + (r[3] - fs.price) / 2, fs.price, "rgb(120,220,255)", "right");
    });
    const [my, msize] = L.msg;
    if (this.msgT > 0) g.text("Спасибо, рыцарь! Костёр горит ярче.", W / 2, my, msize, COL.gold, "center");
    else if (g.store.tips > 0) g.text(`Вы поддержали проект: ${g.store.tips} раз. Спасибо!`, W / 2, my, msize, "rgb(255,150,150)", "center");
    g.button(L.back, "НАЗАД", { size: L.backFs });
  }
}

// ------------------------------------------------------------------ Запуск
export async function boot() {
  const canvas = document.getElementById("game");
  const gate = document.getElementById("gate");
  const gateStatus = document.getElementById("gate-status");
  try {
    // в приложении: вернуть сохранения из нативной копии, если данные браузера очищены
    await Promise.all([loadImages(), document.fonts.load(`16px ${FONT}`, "АБВ"), document.fonts.load(`16px ${FONT}`, "ABC"), restoreBackup()]);
  } catch (e) {
    gateStatus.textContent = tr("Не удалось загрузить графику. Обновите страницу.");
    return;
  }
  gateStatus.textContent = "";
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = tr(el.textContent.trim().replace(/\s+/g, " "));
  gate.classList.add("ready");

  const start = async (useCamera) => {
    gate.hidden = true;
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    } catch (e) { /* iOS Safari не умеет — не страшно */ }
    // без камеры — горизонтально: Android в полноэкранном режиме разворачивает экран сам,
    // иначе (iOS, поворот заблокирован) игра поворачивает картинку
    if (!useCamera && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
    initAudio();
    // Экран не гаснет на тренировке; после сворачивания блокировку нужно взять заново
    const lockScreen = () => keepAwake();
    lockScreen();
    document.addEventListener("visibilitychange", lockScreen);
    const game = new Game(canvas, useCamera);
    window.game = game; // для отладки и автотестов
    // первый вход с камерой — обучение движениям
    game.change(useCamera && !loadJSON(TUTORIAL_KEY, false) ? new TutorialScene(game) : new TitleScene(game));
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

export { MapScene, BattleScene, BonfireScene, ProfileScene, CameraScene, ChallengeScene, CosmeticsScene, DuelScene, LeaderboardScene, MultiplayerScene, SettingsScene, ShopScene, SupportScene, TitleScene, TutorialScene };
