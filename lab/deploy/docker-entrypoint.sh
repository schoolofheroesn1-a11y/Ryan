#!/bin/sh
# Запуск контейнера: применяем миграции, при первом запуске наполняем базу, стартуем сайт.
set -e

echo "▶ Применяю миграции базы данных…"
npx prisma migrate deploy

USERS=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>{console.log(c);return p.\$disconnect()}).catch(e=>{console.error(e);process.exit(1)})")
if [ "$USERS" = "0" ]; then
  echo "▶ База пустая — создаю справочники и администратора…"
  npm run db:seed
else
  echo "▶ База уже наполнена (пользователей: $USERS), наполнение пропущено."
fi

echo "▶ Запускаю сайт на порту ${PORT:-3000}"
exec npx next start -p "${PORT:-3000}"
