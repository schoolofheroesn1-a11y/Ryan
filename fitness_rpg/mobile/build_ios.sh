#!/usr/bin/env sh
# iOS-приложение из веб-версии игры (Capacitor, плагины через Swift Package Manager).
#   sh build_ios.sh              — подготовить проект: www/ -> ios/App/App/public и плагины (работает и на Linux)
#   sh build_ios.sh --simulator  — плюс проверочная сборка для симулятора без подписи (только macOS + Xcode)
# Секрет REVENUECAT_IOS_KEY (необязательный) подставляется только в копию config.js для сборки.
# Принимается лишь ключ Test Store (test_…): реальные платежи на этом этапе выключены.
set -e
cd "$(dirname "$0")"

# 1. Веб-версия + MediaPipe и модель позы внутри приложения (работает без сети)
[ -d ../web/vendor/tasks-vision ] || sh ../web/fetch_vendor.sh
rm -rf www && mkdir www
cp -r ../web/index.html ../web/style.css ../web/manifest.webmanifest ../web/js ../web/assets ../web/fonts www/
mkdir -p www/vendor/tasks-vision/wasm
cp ../web/vendor/pose_landmarker_lite.task www/vendor/
cp ../web/vendor/tasks-vision/vision_bundle.mjs www/vendor/tasks-vision/
# обычная и no-SIMD сборки wasm (no-SIMD — для iOS старше 16.4)
cp ../web/vendor/tasks-vision/wasm/vision_wasm_internal.* ../web/vendor/tasks-vision/wasm/vision_wasm_nosimd_internal.* \
  www/vendor/tasks-vision/wasm/

if [ -n "$REVENUECAT_IOS_KEY" ]; then
  case "$REVENUECAT_IOS_KEY" in
    test_*) ;;
    *) echo "REVENUECAT_IOS_KEY: нужен ключ Test Store (test_...). Реальные платежи выключены." >&2; exit 1 ;;
  esac
  sed -i.bak "s|iosApiKey: \"\"|iosApiKey: \"$REVENUECAT_IOS_KEY\"|" www/js/config.js && rm www/js/config.js.bak
  grep -q "iosApiKey: \"test_" www/js/config.js
fi

# 2. iOS-проект Capacitor (ios/ хранится в репозитории; sync копирует www и обновляет плагины)
npm install --no-audit --no-fund
npx cap sync ios

# 3. Проверочная сборка: компиляция для симулятора, без подписи и без аккаунта Apple
if [ "$1" = "--simulator" ]; then
  xcodebuild -project ios/App/App.xcodeproj -list
  xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
    -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
  echo "Сборка для симулятора: $(pwd)/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
fi
