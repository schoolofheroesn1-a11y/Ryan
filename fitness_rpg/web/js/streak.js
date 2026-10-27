// Серия огоньков: каждый день, когда игрок побеждает врага, у костра зажигается огонёк.
// Обычный враг — 1 огонёк за день, босс — 2. Пропущенный день — пламя гаснет, серия сгорает.
// Чем больше огоньков в серии, тем больше пламя костра в главном меню.

/** Ступени пламени: [огоньков в серии, название, размер костра]. */
export const FLAME_TIERS = [
  [0, "Искра", 1],
  [5, "Огонёк", 1.2],
  [15, "Костёр", 1.4],
  [30, "Пламя", 1.6],
  [60, "Пожар", 1.8],
];
const HISTORY_DAYS = 14;

/** Местная дата как «ГГГГ-ММ-ДД»: день начинается в полночь у игрока. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Сколько дней от a до b (ключи dayKey). */
export function daysBetween(a, b) {
  const ms = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((ms(b) - ms(a)) / 86400000);
}

/** Ключ дня, сдвинутого на n дней. */
export function shiftDay(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export class Streak {
  constructor(d = {}) {
    this.points = d.points || 0; // огоньков в текущей серии
    this.days = d.days || 0; // дней подряд
    this.last = d.last || null; // последний день с огоньком
    this.todayPts = d.todayPts || 0; // огоньков в тот день (не больше 2)
    this.best = d.best || 0; // рекорд огоньков в серии
    this.lost = d.lost || 0; // сгоревшая серия — показать один раз в окне «Пламя погасло»
    this.hist = { ...(d.hist || {}) }; // день → огоньков (последние две недели)
  }

  /** Проверка при входе: пропущен день — серия сгорает. true — если пламя погасло только что. */
  refresh(today = dayKey()) {
    if (!this.last || this.points <= 0 || daysBetween(this.last, today) <= 1) return false;
    this.lost = this.points;
    this.points = 0;
    this.days = 0;
    return true;
  }

  /** Победа над врагом: зажигает огонёк дня (босс — 2). Возвращает { add, fresh } — сколько добавилось и первый ли за день. */
  award(boss, today = dayKey()) {
    this.refresh(today);
    const fresh = this.last !== today;
    if (fresh) {
      this.days += 1;
      this.last = today;
      this.todayPts = 0;
    }
    const add = Math.max(0, (boss ? 2 : 1) - this.todayPts);
    this.todayPts += add;
    this.points += add;
    this.best = Math.max(this.best, this.points);
    this.hist[today] = this.todayPts;
    for (const k of Object.keys(this.hist)) if (daysBetween(k, today) >= HISTORY_DAYS) delete this.hist[k];
    return { add, fresh };
  }

  litToday(today = dayKey()) {
    return this.last === today;
  }

  /** Огонёк ещё можно сохранить сегодня (вчера горел, сегодня ещё нет). */
  fading(today = dayKey()) {
    return this.points > 0 && !this.litToday(today);
  }

  /** Индекс ступени пламени по огонькам серии. */
  get tier() {
    let i = 0;
    FLAME_TIERS.forEach(([need], j) => { if (this.points >= need) i = j; });
    return i;
  }

  toJSON() {
    const { points, days, last, todayPts, best, lost, hist } = this;
    return { points, days, last, todayPts, best, lost, hist };
  }
}
