# Сервер рейтинга (leaderboard.php)

Один PHP-файл для обычного хостинга (PHP 7.1+, MySQL). Таблицы `lb_players` и `lb_hits`
создаются сами при первом запросе.

- `leaderboard.php` — кладётся рядом с `index.html` (входит в архив для хостинга).
- `lb_config.example.php` — образец настроек. На сервере из него делается `lb_config.php`
  с данными базы. Файл с паролем в git не хранится (`.gitignore`), снаружи закрыт `.htaccess`.

Защита: строку игрока меняет только его устройство (секрет, на сервере — хэш), результат
не уменьшается, имя очищается, не больше 20 записей в минуту с одного адреса (IP хранится хэшем).

Проверка на своём компьютере (нужен PHP с pdo_sqlite):
```sh
mkdir /tmp/lb && cp server/leaderboard.php /tmp/lb/
echo "<?php return ['dsn' => 'sqlite:/tmp/lb/lb.sqlite', 'salt' => 'test'];" > /tmp/lb/lb_config.php
(cd /tmp/lb && php -S 127.0.0.1:8799) &
node server/e2e.test.mjs   # на чистой базе
```
