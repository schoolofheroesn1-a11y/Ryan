// Персонаж игрока: характеристики, прокачка, сохранение в памяти телефона (localStorage).
// Порт game/player.py.

import { RELICS, SWORDS, item } from "./gear.js";
import { loadJSON, saveJSON } from "./storage.js";

// У каждого режима своя «карьера»: с камерой — основное сохранение, без камеры (хардкор) — отдельное.
const SAVE_KEYS = { cam: "ash-and-iron-save", btn: "ash-and-iron-save-btn" };
let SAVE_KEY = SAVE_KEYS.cam;

/** Выбрать сохранение режима. Первый запуск без камеры начинается с копии прежнего прогресса. */
export function setSaveSlot(mode) {
  SAVE_KEY = SAVE_KEYS[mode] || SAVE_KEYS.cam;
  if (mode === "btn" && loadJSON(SAVE_KEY, null) === null) {
    const legacy = loadJSON(SAVE_KEYS.cam, null);
    if (legacy) saveJSON(SAVE_KEY, legacy);
  }
}

export const STATS = {
  strength: ["СИЛА", "pushup", "урон атаки"],
  vigor: ["ЖИВУЧЕСТЬ", "squat", "здоровье"],
  endurance: ["ВЫНОСЛИВОСТЬ", "jack", "запас сил"],
};

export const ESTUS_MAX = 3; // без Амулета Углей
// доспехи: надет только один (выбирается в кузнице, как меч); слабее -> сильнее
export const ARMORS = ["armor", "kingarmor", "wingarmor"];
const ARMOR_TAKEN = { armor: 0.75, kingarmor: 0.65, wingarmor: 0.55 };
// талисманы: надет один
export const TALISMANS = ["amulet", "windcharm", "fang"];
export const VAMPIRE = 0.1; // Клык Вампира: доля урона удара, которая лечит
export const WIND_REGEN = 1.5; // Талисман Ветра: восполнение сил быстрее

/**
 * Аура (режим с камерой): пассивный прирост к урону, здоровью и запасу сил за время в планке.
 * Предела нет, но растёт медленно: каждое удвоение времени даёт ещё +2% (1 мин — +2%, 3 мин — +4%,
 * 7 мин — +6%, 15 мин — +8%, полчаса — +10%, час — +12%).
 */
export const auraBonus = (seconds) => 0.02 * Math.log2(1 + Math.max(0, seconds) / 60);

export class Player {
  constructor(data = {}) {
    this.strength = 1;
    this.vigor = 1;
    this.endurance = 1;
    this.souls = 100; // пепел — валюта прокачки (поле зовётся souls ради старых сохранений)
    this.wave = 1; // раунд следующего боя (на карте можно вернуться в пройденные земли)
    this.frontier = 1; // передовая: самый дальний открытый раунд
    this.lostSouls = 0;
    this.lostAtWave = 0;
    this.totalReps = { pushup: 0, squat: 0, jack: 0 };
    this.bossesDefeated = 0; // для рейтинга
    this.redGems = 0; // алые камни — за каждого врага, тратятся в кузнице
    this.blueGems = 0; // синие камни — за боссов, на уникальное снаряжение
    this.owned = ["rusty"];
    this.sword = "rusty";
    this.savedAt = 0; // когда сохранено (мс) — в аккаунте побеждает более свежее сохранение
    this.reset = false; // начата «Новая игра»: пустой прогресс сохранён сознательно
    this.owner = null; // аккаунт, к которому привязан этот прогресс
    this.armor = null; // надетый доспех (из купленных)
    this.talisman = null; // надетый талисман (из купленных)
    this.plankSeconds = 0; // аура: сколько секунд простоял в планке (только с камерой, не сбрасывается)
    this.chests = {}; // сундуки в инвентаре: id земли → сколько
    this.chestPity = {}; // сколько сундуков земли открыто подряд без её оружия
    this.chestsOpened = 0;
    // дары забега по Шпилю Самайна (урон, здоровье, силы, крит): не сохраняются и сгорают с забегом
    Object.defineProperty(this, "mods", { value: null, writable: true, enumerable: false });
    for (const k of Object.keys(data)) if (k in this) this[k] = data[k];
    // старые или испорченные сохранения
    this.frontier = Math.max(Number(this.frontier) || 1, this.wave);
    if (!this.chests || typeof this.chests !== "object") this.chests = {};
    if (!this.chestPity || typeof this.chestPity !== "object") this.chestPity = {};
    this.owned = Array.isArray(this.owned) ? this.owned.filter((k) => SWORDS[k] || RELICS[k]) : [];
    if (!this.owned.includes("rusty")) this.owned.unshift("rusty");
    if (!SWORDS[this.sword] || !this.owned.includes(this.sword)) this.sword = "rusty";
    if (!ARMORS.includes(this.armor) || !this.owned.includes(this.armor)) { // старые сохранения: самый крепкий из купленных
      this.armor = [...ARMORS].reverse().find((k) => this.owned.includes(k)) || null;
    }
    if (!TALISMANS.includes(this.talisman) || !this.owned.includes(this.talisman)) { // старые сохранения: Амулет Углей
      this.talisman = TALISMANS.find((k) => this.owned.includes(k)) || null;
    }
  }

  get level() { return this.strength + this.vigor + this.endurance - 2; }
  /** Прирост ауры (доля): к урону, здоровью и запасу сил. */
  get aura() { return auraBonus(this.plankSeconds); }
  get maxHp() { return Math.round((80 + 12 * this.vigor) * (1 + this.aura) * (1 + (this.mods ? this.mods.hp : 0))); }
  get maxStamina() { return Math.round((60 + 8 * this.endurance) * (1 + this.aura)); }
  get staminaRegen() { return (10 + 2 * this.endurance) * (this.talisman === "windcharm" ? WIND_REGEN : 1) * (1 + (this.mods ? this.mods.regen : 0)); }
  get weapon() { return SWORDS[this.sword]; }
  get damage() { return Math.round((10 + 3 * this.strength + this.weapon.dmg) * (1 + this.aura) * (1 + (this.mods ? this.mods.dmg : 0))); }
  get attackCost() { return this.weapon.cost; }
  get critMult() { return this.weapon.crit + (this.mods ? this.mods.crit : 0); }
  get lifesteal() { return this.weapon.lifesteal; }
  get damageTakenMult() { return ARMOR_TAKEN[this.armor] || 1; }
  /** Что на герое: купленное, кроме доспехов, которые сейчас не надеты (облик и защита — по надетому). */
  get worn() {
    return this.owned.filter((k) => (!ARMORS.includes(k) || k === this.armor) && (!TALISMANS.includes(k) || k === this.talisman));
  }
  get estusMax() { return ESTUS_MAX + (this.talisman === "amulet" ? 1 : 0); }
  /** Доля урона удара, которая лечит героя (Клык Вампира). */
  get vampire() { return this.talisman === "fang" ? VAMPIRE : 0; }

  // --- Кузница ---
  canAfford(key) {
    const [red, blue] = item(key).price;
    return this.redGems >= red && this.blueGems >= blue;
  }

  /** Покупает вещь (меч сразу надевается). false — уже есть или не хватает камней. */
  buy(key) {
    if (item(key).paid) return false; // платные вещи выдаёт только магазин (grantPaid)
    if (item(key).chest) return false; // оружие сундуков только выпадает
    if (this.owned.includes(key) || !this.canAfford(key)) return false;
    const [red, blue] = item(key).price;
    this.redGems -= red;
    this.blueGems -= blue;
    this.owned.push(key);
    if (SWORDS[key]) this.sword = key;
    if (ARMORS.includes(key)) this.armor = key; // новый доспех сразу надевается
    if (TALISMANS.includes(key)) this.talisman = key; // и талисман
    return true;
  }

  /** Вещь, оплаченная в магазине (поддержка проекта): выдаётся без камней и сразу надевается. */
  grantPaid(key, equip = true) {
    if (!item(key) || !item(key).paid) return false;
    if (!this.owned.includes(key)) this.owned.push(key);
    if (equip && SWORDS[key]) this.sword = key;
    return true;
  }

  equip(key) {
    if (SWORDS[key] && this.owned.includes(key)) this.sword = key;
    if (ARMORS.includes(key) && this.owned.includes(key)) this.armor = key;
    if (TALISMANS.includes(key) && this.owned.includes(key)) this.talisman = key;
  }

  levelCost() { return 60 + 30 * (this.level - 1); }
  repsNeeded(stat) { return Math.min(4 + this[stat], 20); }
  canLevel() { return this.souls >= this.levelCost(); }

  levelUp(stat) {
    this.souls -= this.levelCost();
    this[stat] += 1;
  }

  addRep(ex) {
    if (ex in this.totalReps) this.totalReps[ex] += 1;
  }

  /** Ничего ещё не сделано (новый телефон, очищенный браузер) — такой прогресс не затирает облачный. */
  get pristine() {
    return !this.reset && this.wave <= 1 && this.level <= 1 && !this.bossesDefeated;
  }

  save() {
    this.savedAt = Date.now();
    saveJSON(SAVE_KEY, this); // в приватном режиме браузера — играем без сохранения
    if (Player.onSave) Player.onSave(this); // и в аккаунт (облачное сохранение), если вошли
  }

  /** Заменить сохранение на этом устройстве (из аккаунта). */
  static replace(data) {
    saveJSON(SAVE_KEY, data);
    return Player.load();
  }

  static load() {
    try {
      return new Player(loadJSON(SAVE_KEY, {}));
    } catch (e) {
      return new Player();
    }
  }
}
