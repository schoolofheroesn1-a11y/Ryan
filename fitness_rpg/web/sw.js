// Офлайн-кэш: после первого запуска с сетью игра открывается и без интернета.
const CACHE = "ash-and-iron-v5";
const CORE = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/game.js", "js/motion.js", "js/exercises.js", "js/player.js", "js/sfx.js", "js/gear.js",
  "fonts/press-start-2p-cyrillic-400-normal.woff2", "fonts/press-start-2p-latin-400-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Сначала сеть (чтобы обновления доходили), при её отсутствии — кэш.
// Картинки, модель позы и wasm кэшируются по мере загрузки.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
