#!/usr/bin/env sh
# Сборка Android APK из веб-версии игры.
# Нужны: Node 22+, JDK 21, Android SDK (ANDROID_HOME). Результат: dist/ash-and-iron.apk
set -e
cd "$(dirname "$0")"

# 1. Веб-версия + MediaPipe и модель позы внутри приложения (работает без сети)
[ -d ../web/vendor ] || sh ../web/fetch_vendor.sh
rm -rf www && mkdir www
cp -r ../web/index.html ../web/style.css ../web/manifest.webmanifest ../web/js ../web/assets ../web/fonts ../web/vendor www/

# 2. Android-проект Capacitor
npm install --no-audit --no-fund
[ -d android ] || npx cap add android
MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
  sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />#' "$MANIFEST"
fi
grep -q "android.permission.CAMERA" "$MANIFEST"
npx cap sync android

# 3. Сборка (debug-подпись — APK можно сразу ставить на телефон)
(cd android && ./gradlew --no-daemon assembleDebug)
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk dist/ash-and-iron.apk
echo "APK: $(pwd)/dist/ash-and-iron.apk"
