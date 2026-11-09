# Портфолио учеников с ИИ 🎓🤖

Сайт для школы: учителя ведут портфолио учеников (оценки, посещаемость, достижения, файлы, заметки),
а ИИ анализирует данные и даёт персональные советы по росту и развитию каждого ученика.

## Возможности

- **Роли:** администрация (вся школа, управление учителями/классами/предметами) и учителя (только назначенные классы).
- **Портфолио ученика:** оценки (1–5), посещаемость, достижения (олимпиады, конкурсы, спорт, творчество, проекты) с грамотами,
  файлы (фото, PDF, работы), заметки учителей, графики успеваемости и динамики.
- **Документы и сообщения:** Word (.doc/.docx), PDF, TXT, RTF, HTML, фото и сканы, а также вставленный текст
  (переписка с родителями, отзыв тренера). Текст документов извлекается при загрузке и передаётся ИИ;
  фото и сканы (страницы PDF без текста) Claude просматривает как изображения.
- **Журнал класса:** быстро выставить оценки или отметить посещаемость всему классу, добавить список учеников вставкой из Excel.
- **ИИ-советы:** сводка, сильные стороны, зоны роста, рекомендации для учителя / ученика / родителей,
  подходящие кружки и олимпиады, цели с критериями, риски, готовое сообщение для родителей. История анализов сохраняется.
- **Автоматическое выявление учеников в зоне риска:** низкий балл, падение оценок, пропуски.
- **Приватность:** в ИИ не передаются ФИО и дата рождения — только класс, возраст и учебные данные.
  ⚠️ Заметки учителей передаются как есть — не пишите в них фамилии и личные данные.

## Запуск

Нужен Node.js **22.13+** (база данных SQLite встроена в Node, ничего ставить не нужно).

```bash
npm install
cp .env.example .env      # и впишите ключ ИИ (см. ниже)
npm run seed              # необязательно: демо-данные
npm run dev               # http://localhost:3000
```

Демо-доступы после `npm run seed`: `admin@school.ru / admin123`, `teacher@school.ru / teacher123`.
Без демо-данных при первом входе сайт предложит создать администратора.

Продакшен:

```bash
npm run build
npm start
```

Все данные (база `school.db` и загруженные файлы) лежат в папке `data/` — её и нужно бэкапить.

## Подключение ИИ

### Claude (рекомендуется)

В `.env` достаточно указать ключ Anthropic (он начинается с `sk-ant-api03-…`, создаётся на platform.claude.com → API Keys):

```
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-opus-5-5
```

Через посредника **starimg** (работает с серверов в России):

```
ANTHROPIC_API_KEY=sk-star-...
ANTHROPIC_BASE_URL=https://ai.starimg.ru
CLAUDE_MODEL=claude-opus-5-5
```

Список доступных моделей и баланс — в личном кабинете https://ai.starimg.ru. Один анализ занимает около минуты.

Один анализ ученика стоит примерно 5–10 ₽ (около $0.05–0.10). Если Claude задан, он используется в первую очередь.

> Anthropic API не обслуживает запросы из России. Если сервер стоит в РФ, укажите в `AI_PROXY`
> адрес HTTP-прокси за рубежом (например, свой недорогой VPS с Squid/3proxy) или разместите сайт на зарубежном VPS.

### Другие провайдеры

Подходит любой OpenAI-совместимый API — достаточно трёх строк в `.env`:

| Провайдер | AI_BASE_URL | Пример AI_MODEL | Цена |
|---|---|---|---|
| OpenAI (ChatGPT) | `https://api.openai.com/v1` | `gpt-4.1-mini` | платно, недорого |
| Kimi (Moonshot) | `https://api.moonshot.ai/v1` | `kimi-k2-0905-preview` | стартовые бонусы, далее платно |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | очень дёшево |
| OpenRouter | `https://openrouter.ai/api/v1` | модели с суффиксом `:free` | есть бесплатные (с лимитами) |

Названия моделей у провайдеров меняются — актуальные смотрите в их документации.
Если `AI_API_KEY` пустой, сайт работает и выдаёт базовый анализ по правилам (без нейросети).

## Размещение на coach-sl.ru

Нужен VPS (Ubuntu 22.04/24.04), а не обычный «PHP-хостинг» — сайт работает на Node.js.

1. В панели регистратора домена создайте A-записи `coach-sl.ru` и `www` → IP сервера.
2. На сервере:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
sudo git clone https://github.com/schoolofheroesn1-a11y/Ryan.git /var/www/coach-sl && cd /var/www/coach-sl
sudo npm ci && sudo npm run build
sudo cp .env.example .env && sudo nano .env   # ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, COOKIE_SECURE=true
sudo chown -R www-data:www-data /var/www/coach-sl
sudo cp deploy/school-portfolio.service /etc/systemd/system/ && sudo systemctl enable --now school-portfolio
sudo cp deploy/coach-sl.ru.nginx.conf /etc/nginx/sites-available/coach-sl.ru
sudo ln -s /etc/nginx/sites-available/coach-sl.ru /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d coach-sl.ru -d www.coach-sl.ru
```

3. Откройте https://coach-sl.ru — сайт предложит создать администратора.

Обновление (с резервной копией данных): `cd /var/www/coach-sl && sudo bash deploy/update.sh`.
Бэкап: регулярно копируйте папку `data/`.

## Материалы для школы

В папке `templates/`:
- **Памятка для учителей.docx** — как пользоваться сайтом и что загружать.
- **Шаблон характеристики ученика.docx** — учитель заполняет и загружает во вкладку «Документы».

## Структура

```
server/   Express API: index.ts (маршруты), db.ts (схема SQLite), auth.ts (вход, права),
          stats.ts (статистика и риски), ai.ts (запрос к ИИ и анализ по правилам), seed.ts (демо)
client/   React + Tailwind: pages/ (главная, класс, ученик, управление), components/
```
