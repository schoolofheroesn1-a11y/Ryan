// Снаряжение: мечи за алые камни и уникальные вещи за синие (с боссов).
// Основа — порт game/gear.py; кладбище и новое оружие пока есть только в веб-версии.

// price: [алые, синие]; unique — за синие камни с боссов и ещё алые (оба сразу)
export const SWORDS = {
  rusty: { name: "Ржавый меч", desc: "старый, но свой", dmg: 0, cost: 20, crit: 1.5, lifesteal: 0, price: [0, 0] },
  steel: { name: "Стальной клинок", desc: "+5 урона", dmg: 5, cost: 20, crit: 1.5, lifesteal: 0, price: [6, 0] },
  great: { name: "Двуручный меч", desc: "+12 урона, крит x1.75, удар 28 сил", dmg: 12, cost: 28, crit: 1.75, lifesteal: 0, price: [15, 0] },
  ash: { name: "Пепельный клинок", desc: "+16 урона, крит x2, удар лечит 4", dmg: 16, cost: 20, crit: 2.0, lifesteal: 4, price: [36, 3], unique: true },
  // носится на плече; stun — шанс ошеломить врага ударом
  giant: { name: "Гигантский меч", desc: "+20 урона, иногда ошеломляет", dmg: 20, cost: 32, crit: 1.75, lifesteal: 0, stun: 0.15, price: [25, 0] },
  // burn — урон врагу каждую секунду боя
  radiator: { name: "Радиатор", desc: "+6 урона, жар: 6 урона в секунду", dmg: 6, cost: 20, crit: 1.5, lifesteal: 0, burn: 6, price: [48, 4], unique: true },
  // paid — покупается за деньги (поддержка проекта); productId — товар магазина
  // с босса Алой Бездны: aura — каждую секунду враг теряет эту долю своего здоровья
  seraph: { name: "Крыло Серафима", desc: "+24 урона, крит x2, аура: враг -1%/с", dmg: 24, cost: 26, crit: 2.0, lifesteal: 0, aura: 0.01, price: [108, 9], unique: true },
  // chest — выпадает только из сундука своей земли (редко), в кузнице не продаётся
  bonewail: { name: "Плач Костей", desc: "+15 урона, крит x2, удар лечит 6", dmg: 15, cost: 18, crit: 2.0, lifesteal: 6, price: [0, 0], chest: "crypt" },
  rogueking: { name: "Сабля Короля Разбойников", desc: "+21 урона, крит x2.5, ошеломляет", dmg: 21, cost: 16, crit: 2.5, lifesteal: 0, stun: 0.1, price: [0, 0], chest: "castle" },
  moonreap: { name: "Лунный Серп", desc: "+27 урона, лечит 8, ошеломляет", dmg: 27, cost: 22, crit: 2.0, lifesteal: 8, stun: 0.2, price: [0, 0], chest: "grave" },
  abyssheart: { name: "Сердце Бездны", desc: "+34 урона, жар 10/с, аура 1.5%/с", dmg: 34, cost: 28, crit: 2.25, lifesteal: 0, burn: 10, aura: 0.015, price: [0, 0], chest: "abyss" },
  barbell: { name: "Гриф от штанги", desc: "+18 урона, крит x2, удар 24 сил", dmg: 18, cost: 24, crit: 2.0, lifesteal: 0, price: [0, 0], paid: "10 $", productId: "weapon_barbell" },
};

// Реликвии работают сразу после покупки
export const RELICS = {
  armor: { name: "Доспех Костяного Рыцаря", desc: "получаемый урон -25%", price: [12, 1], unique: true },
  amulet: { name: "Амулет Углей", desc: "+1 зелье лечения", price: [24, 2], unique: true },
  // талисманы: надет один (как и доспех)
  windcharm: { name: "Талисман Ветра", desc: "силы восполняются на 50% быстрее", price: [60, 5], unique: true },
  fang: { name: "Клык Вампира", desc: "вампиризм: 10% урона удара лечит", price: [72, 6], unique: true },
  kingarmor: { name: "Доспех Короля-Призрака", desc: "получаемый урон -35%", price: [84, 7], unique: true },
  wingarmor: { name: "Доспех Серафима", desc: "урон -45%, аура Бездны вдвое слабее", price: [120, 10], unique: true },
};

// вкладки кузницы
export const SHOP_TABS = [
  ["weapons", "ОРУЖИЕ", ["rusty", "steel", "great", "giant", "ash", "radiator", "seraph", "barbell"]],
  ["armor", "БРОНЯ", ["armor", "kingarmor", "wingarmor"]],
  ["talismans", "ТАЛИСМАНЫ", ["amulet", "windcharm", "fang"]],
  // легендарное оружие сундуков: не продаётся — здесь видно характеристики и откуда оно выпадает
  ["legends", "ЛЕГЕНДЫ", ["bonewail", "rogueking", "moonreap", "abyssheart"]],
];
export const SHOP_ORDER = SHOP_TABS.flatMap(([, , keys]) => keys);

export const item = (key) => SWORDS[key] || RELICS[key];

export function priceText(key) {
  const it = item(key);
  if (it.paid) return it.paid;
  const [red, blue] = it.price;
  if (blue) return `${blue} син. + ${red} ал.`; // уникальные вещи — за синие и алые вместе
  return red ? `${red} ал.` : "-";
}

// --- Враги и награды ---
export const BOSS_EVERY = 5;
export const isBossWave = (wave) => wave % BOSS_EVERY === 0;

/** [пепел, алые, синие] за победу над врагом этой волны. */
export function rewards(wave) {
  if (isBossWave(wave)) return [2 * (80 + 40 * wave), 4 + Math.floor(wave / BOSS_EVERY), 1];
  return [80 + 40 * wave, 2 + Math.floor((wave - 1) / BOSS_EVERY), 0];
}

// --- Локации ---
// После 3-го Костяного Рыцаря (раунд 15) открываются подступы к замку,
// после 3-го Главы разбойников (раунд 30) — кладбище, после 3-го Короля-Призрака (раунд 45) — Алая Бездна
export const LOCATIONS = {
  1: { name: "Склеп", bg: "arena_bg" },
  2: { name: "Подступы к замку", bg: "castle_bg" },
  3: { name: "Кладбище", bg: "graveyard_bg" },
  4: { name: "Алая Бездна", bg: "abyss_bg" },
};
export const LAST_LOCATION = 4;
export const CASTLE_FROM_WAVE = 16;
export const GRAVEYARD_FROM_WAVE = 31;
export const ABYSS_FROM_WAVE = 46;
export const locationFor = (wave) =>
  (wave >= ABYSS_FROM_WAVE ? 4 : wave >= GRAVEYARD_FROM_WAVE ? 3 : wave >= CASTLE_FROM_WAVE ? 2 : 1);
/** Первая волна локации. */
export const locationStart = (loc) => ({ 1: 1, 2: CASTLE_FROM_WAVE, 3: GRAVEYARD_FROM_WAVE, 4: ABYSS_FROM_WAVE })[loc];

/**
 * Кто ждёт на этой волне: skeleton / bandit / zombie / bat и боссы локаций —
 * knight (склеп), chief (замок), wraith (кладбище: Король-Призрак), seraph (Алая Бездна: Алый Серафим).
 * В Бездне — бесы (imp), адские гончие (hound) и Пустые (husk).
 */
export function enemyKind(wave) {
  const loc = locationFor(wave);
  if (loc === 1) return isBossWave(wave) ? "knight" : "skeleton";
  if (loc === 2) {
    if (isBossWave(wave)) return "chief";
    return wave % 2 === 0 ? "bandit" : "skeleton";
  }
  if (loc === 3) {
    if (isBossWave(wave)) return "wraith";
    return ["zombie", "bat", "skeleton"][wave % 3];
  }
  if (isBossWave(wave)) return "seraph";
  return ["husk", "imp", "hound"][wave % 3];
}
