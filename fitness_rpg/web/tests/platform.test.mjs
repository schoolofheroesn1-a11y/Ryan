// Платформа (сайт / приложение), покупки через RevenueCat (подменённый плагин), рейтинг в iOS
// и резервная копия сохранений. Настоящий iOS здесь не запускается — только логика.
import assert from "node:assert/strict";
import test from "node:test";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  get length() { return mem.size; },
  key: (i) => [...mem.keys()][i] ?? null,
};

const platform = await import("../js/platform.js");
const { Store, TIPS, modeForKey, productId } = await import("../js/store.js");
const { Leaderboard } = await import("../js/leaderboard.js");
const { Profile } = await import("../js/profile.js");

/** Подделка моста Capacitor: window.Capacitor с заголовками плагинов и nativePromise. */
function fakeNative(name, plugins) {
  const calls = [];
  globalThis.window = {
    Capacitor: {
      getPlatform: () => name,
      PluginHeaders: Object.keys(plugins).map((p) => ({ name: p })),
      nativePromise: async (p, m, o) => {
        calls.push([p, m, o]);
        return plugins[p][m](o);
      },
    },
  };
  return calls;
}

test("browser: platform is web, no native plugins", () => {
  delete globalThis.window;
  assert.equal(platform.platform(), "web");
  assert.equal(platform.isNative(), false);
  assert.equal(platform.hasPlugin("Haptics"), false);
});

test("store mode by key: real payments stay off without explicit permission", () => {
  assert.equal(modeForKey(""), "test");
  assert.equal(modeForKey("test_abc"), "revenuecat-test");
  assert.equal(modeForKey("appl_abc", false), "test");
  assert.equal(modeForKey("appl_abc", true), "live");
});

test("web: store keeps the game's test mode and ignores keys", async () => {
  delete globalThis.window;
  mem.clear();
  const store = new Store(async () => true);
  assert.equal(await store.init("test_abc"), "test");
  assert.equal(store.badge, "ТЕСТ: оплата не списывается");
  assert.equal(await store.buy({ id: "sword_void", name: "x" }), true);
  assert.ok(store.owns("sword_void"));
});

test("iOS with Test Store key: purchases, prices and restore go through RevenueCat", async () => {
  mem.clear();
  const products = [
    { identifier: productId("sword_void"), priceString: "0,99 $" },
    { identifier: productId("support_ale"), priceString: "0,99 $" },
  ];
  const bought = [];
  const calls = fakeNative("ios", {
    Purchases: {
      configure: () => undefined,
      getProducts: () => ({ products }),
      getCustomerInfo: () => ({ customerInfo: { nonSubscriptionTransactions: [] } }),
      purchaseStoreProduct: ({ product }) => {
        bought.push(product.identifier);
        return { productIdentifier: product.identifier };
      },
      restorePurchases: () => ({ customerInfo: { nonSubscriptionTransactions: bought.map((productIdentifier) => ({ productIdentifier })) } }),
    },
  });
  const store = new Store(async () => assert.fail("в режиме RevenueCat окно игры не показывается"));
  assert.equal(await store.init("test_key"), "revenuecat-test");
  assert.equal(store.badge, "ТЕСТ: RevenueCat Test Store");
  assert.equal(store.price("sword_void"), "0,99 $");
  assert.equal(store.tipPrice(TIPS[0]), "0,99 $");
  assert.equal(await store.buy({ id: "sword_void", name: "Клинок Бездны" }), true);
  assert.equal(await store.tip(TIPS[0]), true);
  assert.equal(store.tips, 1);
  // товара нет в магазине — понятная ошибка, ничего не выдано
  assert.equal(await store.buy({ id: "sword_sun", name: "Клинок Рассвета" }), false);
  assert.match(store.lastError, /недоступен/);
  // восстановление: косметика возвращается, поддержка — нет (расходуемая)
  mem.clear();
  const again = new Store(async () => false);
  await again.init("test_key");
  const owned = await again.restore();
  assert.deepEqual(owned, ["sword_void"]);
  assert.ok(calls.some(([p, m, o]) => p === "Purchases" && m === "configure" && o.apiKey === "test_key"));
});

test("iOS: cancelled purchase is not an error and grants nothing", async () => {
  mem.clear();
  fakeNative("ios", {
    Purchases: {
      configure: () => undefined,
      getProducts: () => ({ products: [{ identifier: productId("hit_storm"), priceString: "0,99 $" }] }),
      getCustomerInfo: () => ({ customerInfo: {} }),
      purchaseStoreProduct: () => { throw Object.assign(new Error("Purchase was cancelled"), { code: "1", userCancelled: true }); },
    },
  });
  const store = new Store(async () => false);
  await store.init("test_key");
  assert.equal(await store.buy({ id: "hit_storm", name: "Гнев грозы" }), false);
  assert.equal(store.lastError, "");
  assert.equal(store.owns("hit_storm"), false);
});

test("iOS with App Store key but real payments off: stays in the game's test mode", async () => {
  mem.clear();
  const calls = fakeNative("ios", { Purchases: { configure: () => undefined } });
  const store = new Store(async () => true);
  assert.equal(await store.init("appl_key", false), "test");
  assert.equal(calls.length, 0, "RevenueCat даже не настраивается");
});

test("iOS first build: leaderboard stays on device and never calls the server", async () => {
  mem.clear();
  fakeNative("ios", {});
  let fetched = false;
  const lb = new Leaderboard({ url: "https://x.supabase.co", anonKey: "anon", table: "leaderboard" }, async () => { fetched = true; });
  assert.equal(lb.offline, true);
  const p = new Profile({ name: "Рыцарь" });
  lb.submit(p);
  const res = await lb.top(p);
  assert.equal(res.source, "local");
  assert.equal(fetched, false);
  // Android-приложение и сайт не затронуты
  fakeNative("android", {});
  assert.equal(new Leaderboard({ url: "https://x", anonKey: "a", table: "t" }, async () => ({ ok: true })).offline, false);
  delete globalThis.window;
});

test("native backup: saves are mirrored and restored after the web storage is cleared", async () => {
  mem.clear();
  const prefs = new Map();
  fakeNative("ios", {
    Preferences: {
      set: ({ key, value }) => { prefs.set(key, value); },
      remove: ({ key }) => { prefs.delete(key); },
      get: ({ key }) => ({ value: prefs.has(key) ? prefs.get(key) : null }),
      keys: () => ({ keys: [...prefs.keys()] }),
    },
  });
  const { saveJSON, loadJSON } = await import("../js/storage.js");
  saveJSON("ash-and-iron-save", { level: 7 });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(prefs.get("ash-and-iron-save"), JSON.stringify({ level: 7 }));
  mem.clear(); // система очистила данные встроенного браузера
  assert.equal(await platform.restoreBackup(), 1);
  assert.deepEqual(loadJSON("ash-and-iron-save", null), { level: 7 });
  // старые сохранения без копии переносятся в нативное хранилище
  prefs.clear();
  mem.set("ash-and-iron-settings", "{\"volume\":0.5}");
  await platform.restoreBackup();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(prefs.get("ash-and-iron-settings"), "{\"volume\":0.5}");
  delete globalThis.window;
});

test("haptics: iOS uses the native plugin, browser uses navigator.vibrate", async () => {
  const calls = fakeNative("ios", { Haptics: { impact: () => undefined } });
  platform.vibrate([120, 40, 120]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls[0], ["Haptics", "impact", { style: "HEAVY" }]);
  delete globalThis.window;
  let got = null;
  Object.defineProperty(globalThis, "navigator", { value: { vibrate: (p) => { got = p; } }, configurable: true });
  platform.vibrate(150);
  assert.equal(got, 150);
});
