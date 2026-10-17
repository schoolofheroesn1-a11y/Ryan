#!/bin/sh
# Резервная копия базы и загруженных файлов в папку backups/. Хранится 14 последних копий.
# Запуск вручную: sh deploy/backup.sh   •   ежедневно: см. deploy/README.md, раздел «Резервные копии»
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H-%M)
docker compose exec -T db pg_dump -U pedlab -d pedlab | gzip > "backups/db_$STAMP.sql.gz"
docker compose exec -T app tar -czf - -C /app/storage uploads > "backups/uploads_$STAMP.tar.gz"
ls -1t backups/db_*.sql.gz | tail -n +15 | xargs -r rm --
ls -1t backups/uploads_*.tar.gz | tail -n +15 | xargs -r rm --
echo "Готово: backups/db_$STAMP.sql.gz и backups/uploads_$STAMP.tar.gz"
