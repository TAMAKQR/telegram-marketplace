# Деплой на VPS: Docker + Caddy (HTTPS)

Этот гайд для деплоя на свой сервер с доменом (пример: `dasmart.xyz`).

## 0) DNS

У провайдера домена (DNS):
- Создай **A record**: `dasmart.xyz` → `<IP_СЕРВЕРА>`
- (Опционально) Создай `www` CNAME → `dasmart.xyz`

Подожди, пока DNS применится.

## 1) Установить Docker + Compose

На Ubuntu/Debian поставь Docker Engine и плагин docker compose по официальной инструкции.

Проверка:

```bash
docker --version
docker compose version
```

## 2) Запуск контейнера (production)

На сервере создай папку (например `/opt/telegram-webapp`) и скопируй туда:
- `docker-compose.prod.yml`
- `.env.prod` (создай из `.env.prod.example`)

### .env.prod (пример)

Минимально нужно:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

VITE_INSTAGRAM_APP_ID=<instagram-app-id>
VITE_INSTAGRAM_REDIRECT_URI=https://dasmart.xyz/instagram/callback

# Опционально (кнопка “Вернуться в Telegram” после OAuth)
VITE_TELEGRAM_BOT_USERNAME=<bot_username_without_@>
VITE_TELEGRAM_WEBAPP_SHORT_NAME=
```

Запуск:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Важно: лучше публиковать контейнер только на localhost, чтобы наружу смотрел только Caddy.
Пример:
- замени `"80:80"` на `"127.0.0.1:8080:80"` в `docker-compose.prod.yml`.

## 3) Установить Caddy (HTTPS)

Поставь Caddy на хост (рекомендовано).

1) Скопируй `Caddyfile.example` в `/etc/caddy/Caddyfile` и укажи свой домен.
2) Применить:

```bash
sudo systemctl reload caddy
```

Caddy сам:
- получит/обновит HTTPS сертификаты
- проксирует `https://dasmart.xyz` → `http://127.0.0.1:8080`

## 4) Проверка

Open:
- `https://dasmart.xyz/`
- `https://dasmart.xyz/env.js`

`/env.js` должен вернуть `window.__ENV__ = { ... }` с твоими значениями.

## 5) Meta (Instagram) настройки

В Meta Dashboard → Instagram Login settings:
- добавь redirect URI: `https://dasmart.xyz/instagram/callback`

## 6) Supabase secrets (server-side)

Supabase Dashboard → проект:
- **Edge Functions** → **Secrets**

Поставь/обнови:
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI` = `https://dasmart.xyz/instagram/callback`

Эти секреты использует Edge Function `instagram-oauth`.

## 7) Telegram BotFather

Обнови Web App URL у бота:
- BotFather → `/myapps` → выбрать бота → Web App URL → `https://dasmart.xyz`

