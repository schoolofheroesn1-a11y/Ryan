// Настройки сервера рейтинга (Supabase). Пока поля пустые, рейтинг работает только на устройстве:
// игра полностью играбельна без сети, а результаты отправятся, когда сервер появится.
// Как получить значения — см. README_DEPLOY.md, раздел «Рейтинг».
export const LEADERBOARD = {
  url: "", // например "https://abcdefgh.supabase.co"
  anonKey: "", // публичный anon-ключ проекта (не service_role!)
  table: "leaderboard",
};

// Мультиплеер (аккаунты, рейтинг, вызовы, дуэли, коды активации): server/api.php на своём хостинге.
// На самом ash-a-iron.com запросы идут на тот же адрес, что и страница.
export const ONLINE = {
  api: "https://ash-a-iron.com/api.php",
};

// Покупки. На сайте и в тестовых сборках — тестовый режим: оплата не списывается.
export const STORE = {
  bundleId: "com.ashandiron.fitnessrpg",
};

// Покупки в iOS-приложении через RevenueCat. Ключ сюда НЕ вписывается: его подставляет
// сборка из секрета REVENUECAT_IOS_KEY (mobile/build_ios.sh). Пустой ключ — тестовый режим игры.
// Ключ Test Store (начинается с "test_") — покупки симулируются, деньги не списываются.
// Ключ App Store ("appl_") игра не примет, пока allowRealPayments = false.
export const REVENUECAT = {
  iosApiKey: "",
  allowRealPayments: false,
};

// iOS-приложение. Первая сборка: рейтинг только на устройстве, без сервера —
// до исправления правил Supabase, модерации и удаления данных. Сайт и Android не затронуты.
export const IOS = {
  leaderboardOnline: false,
};
