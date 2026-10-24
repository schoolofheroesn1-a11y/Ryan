#!/usr/bin/env sh
# Готовый сайт игры для GitHub Pages: dist/ash-and-iron-web/ и dist/ash-and-iron-web.zip.
# Все файлы лежат в одной папке: так их можно загрузить на GitHub через браузер без потерь.
# Запуск: sh tools/build_web_release.sh   (из папки fitness_rpg)
set -e
cd "$(dirname "$0")/.."
[ -d web/vendor/tasks-vision ] || sh web/fetch_vendor.sh
OUT=dist/site-tree
rm -rf "$OUT" dist/ash-and-iron-web dist/ash-and-iron-web.zip
mkdir -p "$OUT/vendor/tasks-vision/wasm"
cp web/index.html web/style.css web/manifest.webmanifest web/sw.js web/og_image.png web/robots.txt web/sitemap.xml "$OUT/"
cp -r web/js web/assets web/fonts "$OUT/"
cp web/vendor/pose_landmarker_lite.task "$OUT/vendor/"
cp web/vendor/tasks-vision/vision_bundle.mjs "$OUT/vendor/tasks-vision/"
# нужны только обычная и no-SIMD сборки wasm (модульную игра не использует)
cp web/vendor/tasks-vision/wasm/vision_wasm_internal.* web/vendor/tasks-vision/wasm/vision_wasm_nosimd_internal.* \
  "$OUT/vendor/tasks-vision/wasm/"
python3 tools/flatten_release.py "$OUT" dist/ash-and-iron-web
rm -rf "$OUT"
OUT=dist/ash-and-iron-web
touch "$OUT/.nojekyll"  # GitHub Pages отдаёт файлы как есть, без Jekyll
cp deploy/README_DEPLOY.md deploy/supabase.sql deploy/privacy.html deploy/offer.html deploy/prices.html deploy/contacts.html "$OUT/"
# архив для своего хостинга (sweb): игра + .htaccess + сервер мультиплеера, всё в корне архива
H=dist/ash-a-iron-hosting
rm -rf "$H" dist/ash-a-iron-hosting.zip && cp -r "$OUT" "$H"
rm -f "$H/README_DEPLOY.md" "$H/supabase.sql" "$H/.nojekyll"
cp deploy/hosting/.htaccess server/api.php server/codes.php server/lb_config.example.php "$H/"
(cd "$H" && zip -qr ../ash-a-iron-hosting.zip .)
(cd dist && zip -qr ash-and-iron-web.zip ash-and-iron-web)
echo "Готово: $(pwd)/dist/ash-and-iron-web.zip ($(du -h dist/ash-and-iron-web.zip | cut -f1))"
find "$OUT" -type f | wc -l | xargs echo "файлов:"
