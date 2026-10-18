#!/usr/bin/env sh
# Кладёт MediaPipe (wasm + js) и модель позы рядом с игрой, чтобы не зависеть от CDN.
# Запуск: sh web/fetch_vendor.sh   (нужны npm и curl)
set -e
cd "$(dirname "$0")"
VERSION=1.1.1
rm -rf vendor && mkdir -p vendor/tasks-vision
TMP=$(mktemp -d)
(cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VERSION" >/dev/null && tar xzf ./*.tgz)
cp "$TMP/package/vision_bundle.mjs" vendor/tasks-vision/
cp -r "$TMP/package/wasm" vendor/tasks-vision/
rm -rf "$TMP"
curl -fsSL -o vendor/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
echo "vendor готов"
