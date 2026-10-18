// Персонаж игрока: характеристики, прокачка, сохранение в памяти телефона (localStorage).
// Порт game/player.py.

const SAVE_KEY = "ash-and-iron-save";

export const STATS = {
  strength: ["СИЛА", "pushup", "урон атаки"],
  vigor: ["ЖИВУЧЕСТЬ", "squat", "здоровье"],
  endurance: ["ВЫНОСЛИВОСТЬ", "jack", "запас сил"],
};

export const ESTUS_MAX = 3;

export class Player {
  constructor(data = {}) {
    this.strength = 1;
    this.vigor = 1;
    this.endurance = 1;
    this.souls = 100;
    this.wave = 1;
    this.lostSouls = 0;
    this.lostAtWave = 0;
    this.totalReps = { pushup: 0, squat: 0, jack: 0 };
    for (const k of Object.keys(data)) if (k in this) this[k] = data[k];
  }

  get level() { return this.strength + this.vigor + this.endurance - 2; }
  get maxHp() { return 80 + 12 * this.vigor; }
  get maxStamina() { return 60 + 8 * this.endurance; }
  get staminaRegen() { return 10 + 2 * this.endurance; }
  get damage() { return 10 + 3 * this.strength; }

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

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this));
    } catch (e) { /* приватный режим браузера — играем без сохранения */ }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return new Player(raw ? JSON.parse(raw) : {});
    } catch (e) {
      return new Player();
    }
  }
}
