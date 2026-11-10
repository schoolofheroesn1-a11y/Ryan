#!/usr/bin/env bash
# Установка сайта на чистый VPS (Ubuntu 22.04/24.04) одной командой.
# Запуск из распакованной папки сайта:  sudo bash deploy/install.sh coach-sl.ru
set -euo pipefail

DOMAIN="${1:-coach-sl.ru}"
APP_DIR=/var/www/coach-sl
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Запустите через sudo или от root"; exit 1; fi

echo "→ 1/6 Установка системных пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl ca-certificates >/dev/null

# На серверах с 1 ГБ памяти добавляем файл подкачки, чтобы большие PDF не роняли сайт.
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ] && [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ]; then
  echo "   Создаю файл подкачки 1 ГБ"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "→ 2/6 Проверка Node.js (нужна версия 22.13+)"
need_node=1
if command -v node >/dev/null; then
  ver=$(node -p 'process.versions.node')
  major=${ver%%.*}; minor=$(echo "$ver" | cut -d. -f2)
  if [ "$major" -gt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 13 ]; }; then need_node=0; fi
fi
if [ "$need_node" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "   Node.js $(node -v)"

echo "→ 3/6 Копирование сайта в $APP_DIR"
mkdir -p "$APP_DIR"
if [ "$SRC_DIR" != "$APP_DIR" ]; then
  # Данные (база и загруженные файлы) при повторной установке не трогаем.
  cp -a "$SRC_DIR"/. "$APP_DIR"/
fi
cd "$APP_DIR"
[ -f .env ] || cp .env.example .env
if [ ! -d node_modules ] || [ ! -d node_modules/express ]; then npm ci --omit=dev; fi
mkdir -p data
chown -R www-data:www-data "$APP_DIR"

echo "→ 4/6 Автозапуск сайта"
cp deploy/school-portfolio.service /etc/systemd/system/school-portfolio.service
systemctl daemon-reload
systemctl enable --now school-portfolio >/dev/null
systemctl restart school-portfolio

echo "→ 5/6 Настройка nginx для $DOMAIN"
sed "s/coach-sl\.ru/$DOMAIN/g" deploy/coach-sl.ru.nginx.conf > "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl reload nginx

echo "→ 6/6 HTTPS-сертификат"
if certbot --nginx -n --agree-tos --register-unsafely-without-email --redirect -d "$DOMAIN" -d "www.$DOMAIN"; then
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env
  systemctl restart school-portfolio
  URL="https://$DOMAIN"
else
  echo
  echo "!! Сертификат пока не выпущен: домен ещё не указывает на этот сервер."
  echo "   Когда DNS обновится (до 24 часов), выполните:"
  echo "   sudo certbot --nginx --redirect -d $DOMAIN -d www.$DOMAIN && sudo sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' $APP_DIR/.env && sudo systemctl restart school-portfolio"
  URL="http://$DOMAIN"
fi

sleep 2
if curl -fsS -o /dev/null http://127.0.0.1:3000/api/setup-status; then
  echo
  echo "✅ Готово! Откройте $URL и создайте администратора."
else
  echo "❌ Сайт не ответил. Журнал: journalctl -u school-portfolio -n 50"
  exit 1
fi
