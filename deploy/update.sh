#!/usr/bin/env bash
# Обновление сайта на сервере: sudo bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Резервная копия данных"
mkdir -p ../backups
tar -czf "../backups/data-$(date +%Y%m%d-%H%M%S).tar.gz" data

echo "→ Загрузка новой версии"
git pull

echo "→ Установка зависимостей и сборка"
npm ci
npm run build

chown -R www-data:www-data .
echo "→ Перезапуск"
systemctl restart school-portfolio
sleep 2
systemctl --no-pager --lines=5 status school-portfolio
echo "Готово. Откройте https://coach-sl.ru"
