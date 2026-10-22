// Мультиплеер: аккаунт (логин и пароль), рейтинг, «Бросить вызов», дуэль и коды активации.
// Сервер — server/api.php на своём хостинге (адрес в config.js). Игра не зависит от сети:
// без неё работает всё, кроме мультиплеера, а результат уходит на сервер при следующем входе.
import { IOS, ONLINE } from "./config.js";
import { isIOS } from "./platform.js";
import { loadJSON, saveJSON } from "./storage.js";

const TOKEN_KEY = "ash-and-iron-token";
const ACCOUNT_KEY = "ash-and-iron-account";
const TIMEOUT_MS = 8000;

/** Понятные игроку тексты ошибок сервера. */
const ERRORS = {
  login: "Логин: 3-20 латинских букв, цифр или _",
  password: "Пароль: от 6 символов",
  "login taken": "Такой логин уже занят",
  "wrong login": "Неверный логин или пароль",
  auth: "Войдите в аккаунт заново",
  name: "Такое имя не подходит",
  "no attempts": "Попытки на сегодня закончились",
  opponent: "Этот соперник уже не рядом с вами в списке",
  fight: "Бой не засчитан",
  "bad code": "Неверный код",
  room: "Комната не найдена",
  "room full": "В комнате уже два игрока",
  "own room": "Это ваша комната: дайте код другу",
  "too many requests": "Слишком много попыток, подождите",
  "not configured": "Сервер ещё не настроен",
  "database unavailable": "Сервер временно недоступен",
  network: "Нет связи с сервером",
};
export const errorText = (e) => ERRORS[e && e.message] || ERRORS.network;

/** Адрес api.php: на своём сайте — относительный (тот же адрес, что и у страницы). */
export function apiUrl(api) {
  if (!api) return "";
  try {
    const here = globalThis.location;
    const host = new URL(api).hostname.replace(/^www\./, "");
    if (here && here.hostname.replace(/^www\./, "") === host) return new URL("api.php", here.href).href;
  } catch (e) { /* не URL — как есть */ }
  return api;
}

/** Снимок героя для боёв с ним: бот играет его снаряжением и характеристиками. */
export function heroSnapshot(player, skin = null) {
  return {
    sword: player.sword,
    looks: player.owned.filter((k) => ["armor", "kingarmor", "amulet"].includes(k)),
    skin,
    level: player.level,
    maxHp: player.maxHp,
    damage: player.damage,
    crit: player.critMult,
    taken: player.damageTakenMult,
    estus: player.estusMax,
    stamina: player.maxStamina,
    cost: player.attackCost,
    regen: player.staminaRegen,
  };
}

export class Online {
  constructor(config = ONLINE, fetchImpl = globalThis.fetch?.bind(globalThis), { offline = isIOS() && !IOS.leaderboardOnline } = {}) {
    this.url = apiUrl(config.api);
    this.fetch = fetchImpl;
    this.offline = offline; // первая iOS-сборка — без онлайна
    this.token = loadJSON(TOKEN_KEY, null);
    this.account = loadJSON(ACCOUNT_KEY, null);
  }

  get configured() {
    return !this.offline && !!(this.url && this.fetch);
  }

  get loggedIn() {
    return this.configured && !!this.token;
  }

  async call(action, data = {}) {
    if (!this.configured) throw new Error("not configured");
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await this.fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token: this.token, ...data }),
        signal: ctrl && ctrl.signal,
      });
    } catch (e) {
      throw new Error("network");
    } finally {
      if (timer) clearTimeout(timer);
    }
    let body = null;
    try {
      body = await res.json();
    } catch (e) { /* не JSON — сервер недоступен */ }
    if (!res.ok || !body || body.error) {
      if (body && body.error === "auth") this.forget();
      throw new Error((body && body.error) || "network");
    }
    if (body.account) this.remember(this.token, body.account);
    return body;
  }

  remember(token, account) {
    this.token = token;
    this.account = account;
    saveJSON(TOKEN_KEY, token);
    saveJSON(ACCOUNT_KEY, account);
  }

  forget() {
    this.remember(null, null);
  }

  /** Результат и герой с этого устройства переносятся в новый аккаунт. */
  async register(login, password, name, best, hero) {
    const r = await this.call("register", { login, password, name, best, hero });
    this.remember(r.token, r.account);
    return r.account;
  }

  async login(login, password) {
    const r = await this.call("login", { login, password });
    this.remember(r.token, r.account);
    return r.account;
  }

  async logout() {
    try {
      await this.call("logout");
    } catch (e) { /* без сети — просто забываем вход */ }
    this.forget();
  }

  sync(best, hero, name) {
    return this.call("sync", name ? { best, hero, name } : { best, hero });
  }

  me() { return this.call("me"); }
  top() { return this.call("top"); }
  arena() { return this.call("arena"); }
  challengeStart(opponent) { return this.call("challenge_start", { opponent }); }
  challengeEnd(fight, won) { return this.call("challenge_end", { fight, won }); }
  redeem(code) { return this.call("redeem", { code }); }
  duelCreate(best, hero) { return this.call("duel_create", { best, hero }); }
  duelJoin(code, best, hero) { return this.call("duel_join", { code, best, hero }); }
  duelSync(code, ack, events) { return this.call("duel_sync", { code, ack, events }); }
  duelLeave(code) { return this.call("duel_leave", { code }); }
}
