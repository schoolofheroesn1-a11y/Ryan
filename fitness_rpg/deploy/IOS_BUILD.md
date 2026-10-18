# Ash & Iron — iOS-приложение (этап A: подготовка)

Состояние: iOS-проект подготовлен и проверяется сборкой **для симулятора без подписи** на облачном
Mac (GitHub Actions, задача `ios-check`). Это проверка компиляции. Приложение ещё **не запускалось на
iPhone**, не подписывалось и не отправлялось в TestFlight или App Store. Реальные платежи выключены.

## Что где лежит

| Путь | Что это |
|---|---|
| `web/` | Игра (HTML5 Canvas + JavaScript). Одна и та же для сайта, Android и iOS |
| `web/js/platform.js` | Определяет сайт / Android / iOS. Нативная вибрация, «экран не гаснет», внешние ссылки, резервная копия сохранений. На сайте ничего не меняет |
| `web/js/store.js` | Покупки: тестовый режим игры или RevenueCat Test Store (iOS). Реальные платежи заблокированы |
| `web/js/config.js` | `REVENUECAT.iosApiKey` всегда пустой в репозитории (ключ подставляет сборка). `IOS.leaderboardOnline = false` — в iOS рейтинг только на устройстве |
| `mobile/package.json` | Capacitor 8.5.3 + плагины: haptics, preferences, keep-awake, RevenueCat 13.7.4 |
| `mobile/ios/` | Нативный Xcode-проект (Swift Package Manager, без CocoaPods) |
| `mobile/build_ios.sh` | Подготовка `www/` и `cap sync ios`; с `--simulator` — проверочная сборка (macOS) |
| `mobile/build_android.sh` | Сборка Android APK (как раньше) |
| `tools/make_ios_icons.py` | Иконка App Store 1024×1024 и заставка из пиксельного арта |
| `deploy/privacy.html` | Черновик политики конфиденциальности (публикуется на GitHub Pages) |
| `.github/workflows/fitness-rpg.yml` | Тесты → Android APK, сайт, проверка iOS-сборки |

Что настроено в iOS-проекте (`mobile/ios/App/App`):
- `Info.plist`: объяснение доступа к камере (на русском), только iPhone, портрет + альбом,
  без строки статуса, `ITSAppUsesNonExemptEncryption = NO` (только HTTPS), архитектура arm64;
- `AppDelegate.swift`: звук игры слышен при переключателе «Без звука» и не останавливает музыку;
- `PrivacyInfo.xcprivacy`: без слежения и сбора данных (рейтинг в этой сборке выключен);
- иконка и заставка — рыцарь у костра.

## Перенести проект в свой репозиторий

Загрузка через сайт GitHub с телефона теряет папки, поэтому используйте git (на компьютере):

```bash
git clone --branch claude/charming-rubin-nsdtze https://github.com/schoolofheroesn1-a11y/Ryan.git ash-src
mkdir ash-and-iron && cp -r ash-src/fitness_rpg/. ash-and-iron/
mkdir -p ash-and-iron/.github/workflows
cp ash-src/.github/workflows/fitness-rpg.yml ash-and-iron/.github/workflows/
cd ash-and-iron
# в своём репозитории проект лежит в корне, а не в папке fitness_rpg:
sed -i.bak 's#fitness_rpg/##g; s#working-directory: fitness_rpg#working-directory: .#' .github/workflows/fitness-rpg.yml && rm .github/workflows/fitness-rpg.yml.bak
git init && git add . && git commit -m "Ash & Iron: полный проект"
git branch -M main
git remote add origin https://github.com/ВАШ-ЛОГИН/ИМЯ-РЕПОЗИТОРИЯ.git
git push -u origin main
```

Без командной строки: GitHub Desktop → File → Add local repository → Publish repository.
Репозиторий лучше сделать **публичным**: тогда облачные Mac в GitHub Actions бесплатны.
Ключей и паролей в проекте нет. Секреты добавляются только в Settings → Secrets.

> Если вы уже вписали ключ Supabase в `config.js` на своём сайте, перенесите эти значения в новый
> `config.js`: в нём появились разделы `REVENUECAT` и `IOS`, без них новые файлы игры не запустятся.

## Установить зависимости (локально, по желанию)

- Node.js 22+ (npm входит в комплект).
- Подготовка проекта (работает на Linux, macOS, Windows/WSL):
  ```bash
  cd mobile
  sh build_ios.sh              # копирует веб-версию в ios/App/App/public и обновляет плагины
  ```
- Сборка и запуск — только на macOS с Xcode 26+:
  ```bash
  sh build_ios.sh --simulator  # компиляция для симулятора без подписи
  npx cap open ios             # открыть проект в Xcode
  ```
  Файлы `fetch_vendor.sh` скачивает сам (MediaPipe и модель позы, около 45 МБ, один раз).

## Проверка компиляции на облачном Mac

Задача `ios-check` запускается при каждом пуше в `fitness_rpg/` (вкладка Actions). Она выбирает самый
новый Xcode на образе `macos-15` и выполняет `sh mobile/build_ios.sh --simulator`. Ничего не
подписывает, ни с кем из Apple не связывается и ничего никуда не загружает.

## Тестовые покупки (RevenueCat Test Store) — бесплатно, без аккаунта Apple

1. Зарегистрируйтесь на revenuecat.com (бесплатно на старте) → создайте проект.
2. Добавьте **Test Store** и создайте в нём товары с идентификаторами из таблицы ниже.
3. Скопируйте публичный ключ Test Store (начинается с `test_`).
4. В GitHub: Settings → Secrets and variables → Actions → `REVENUECAT_IOS_KEY` = этот ключ.
   Сборка подставит его только в копию `config.js` внутри приложения. Ключ, который начинается
   не с `test_`, сборка отклонит.

Без ключа игра работает в прежнем тестовом режиме (окно «ТЕСТОВАЯ ПОКУПКА», деньги не списываются).

| Идентификатор товара | Тип | Что это |
|---|---|---|
| `com.ashandiron.fitnessrpg.sword_void` | разовая покупка | Клинок Бездны |
| `com.ashandiron.fitnessrpg.sword_sun` | разовая покупка | Клинок Рассвета |
| `com.ashandiron.fitnessrpg.sword_frost` | разовая покупка | Ледяной Клык |
| `com.ashandiron.fitnessrpg.hit_storm` | разовая покупка | Гнев грозы |
| `com.ashandiron.fitnessrpg.hit_souls` | разовая покупка | Призраки павших |
| `com.ashandiron.fitnessrpg.win_crown` | разовая покупка | Королевский триумф |
| `com.ashandiron.fitnessrpg.win_pyre` | разовая покупка | Синее пламя |
| `com.ashandiron.fitnessrpg.support_ale` | расходуемая | Поддержка 1 $ |
| `com.ashandiron.fitnessrpg.support_torch` | расходуемая | Поддержка 3 $ |
| `com.ashandiron.fitnessrpg.support_forge` | расходуемая | Поддержка 5 $ |

В App Store ровно 1 $ поставить нельзя: ближайшие цены — 0,99 $, 2,99 $ и 4,99 $.

## Следующие шаги (каждый — только после вашего отдельного подтверждения)

**Этап B — аккаунт Apple (платно: 99 $ в год):**
1. Apple Developer Program (developer.apple.com/programs). Частному лицу D-U-N-S не нужен.
2. Certificates, IDs & Profiles → Identifiers → зарегистрировать `com.ashandiron.fitnessrpg`.
   Если ID занят, выберите другой, например `com.ВАШЕИМЯ.ashandiron`, и замените его в
   `mobile/capacitor.config.json`, `web/js/config.js` (STORE.bundleId) и в Xcode-проекте.
3. App Store Connect → Мои приложения → «+» → новое приложение (iOS, «Ash & Iron», этот ID).
4. Пользователи и доступ → Интеграции → ключ App Store Connect API (роль App Manager).
   В секреты GitHub: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (содержимое файла .p8).
5. Для реальных платежей позже: соглашение о платных приложениях, банковские и налоговые данные,
   товары встроенных покупок, ключ App Store в RevenueCat и `allowRealPayments: true`.

**Этап C — TestFlight:**
1. Задача сборки для TestFlight (архив, подпись по ключу API, загрузка). Её добавим отдельно,
   после вашего подтверждения.
2. Через 10–30 минут сборка появится в App Store Connect → TestFlight.
3. Добавьте себя во «Внутреннее тестирование» (до 100 человек, без проверки Apple).
4. На iPhone поставьте приложение **TestFlight** из App Store, откройте приглашение → «Установить».

**Что проверить на iPhone:**
- разрешение камеры и распознавание отжиманий, приседаний, «звёздочки»;
- после сворачивания приложения камера включается сама (или кнопкой в «Камера и советы»);
- звук и сигнал «приседай» при включённом переключателе «Без звука»;
- вибрация при ударах и прокачке;
- экран не гаснет во время боя;
- тестовые покупки и «Восстановить покупки»;
- игра в авиарежиме;
- рейтинг показывает только ваш результат;
- поворот экрана и вырез экрана (чёлка).

## Что ещё не сделано и до публичного релиза обязательно

- **Онлайн-рейтинг выключен в iOS.** Перед включением:
  - правила Supabase через анонимный вход (игрок меняет только свою строку);
  - «пожаловаться» и «скрыть игрока»;
  - удаление своих данных из рейтинга;
  - обновить `PrivacyInfo.xcprivacy` и ответы о приватности в App Store Connect.
- Политика конфиденциальности (`deploy/privacy.html`) — черновик, его нужно проверить и опубликовать.
- Скриншоты для App Store (iPhone 6,9"), описание, возрастной рейтинг, пояснения для проверяющих
  (камеру можно заменить кнопками ОТЖИМ/ПРИСЕД/ЗВЕЗДА).
- Отладка WKWebView через Safari Web Inspector возможна только с Mac.

## Откат

Состояние до этапа A — коммит `c65662f` в ветке `claude/charming-rubin-nsdtze`
(`git checkout c65662f -- fitness_rpg .github`).
