# Деплой на Render (из GitHub) + домен dasmart.xyz

Этот проект лучше деплоить на Render как **Web Service (Docker)**, а не как Static Site, потому что нам нужен runtime-конфиг `/env.js` (можно менять `VITE_*` без пересборки фронта).

## 1) Подключить репозиторий

Render Dashboard → **New** → **Web Service** → подключи GitHub репозиторий.

Важно:
- **Environment**: `Docker`
- Render сам соберёт образ из `Dockerfile`.

## 2) Переменные окружения в Render

В Render → Service → **Environment** добавь:

- `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `<anon key>`

- `VITE_INSTAGRAM_APP_ID` = `<instagram app id>`
- `VITE_INSTAGRAM_REDIRECT_URI` = `https://dasmart.xyz/instagram/callback`

Опционально (кнопка «Вернуться в Telegram» после OAuth):
- `VITE_TELEGRAM_BOT_USERNAME` = `<bot_username_without_@>`
- `VITE_TELEGRAM_WEBAPP_SHORT_NAME` = `<short_name>` (если есть)

## 3) Подключить домен dasmart.xyz

Render → Service → **Settings** → **Custom Domains**:
- добавь `dasmart.xyz`

Render покажет DNS записи (обычно CNAME/A) — добавь их у регистратора домена.

## 4) Проверка после деплоя

Открой:
- `https://dasmart.xyz/`
- `https://dasmart.xyz/env.js`

`/env.js` должен вернуть `window.__ENV__ = { ... }`.

## 5) Где менять секреты в Supabase (важно)

**App Secret нельзя хранить в Render как VITE_*** (это клиентские переменные).

Supabase Dashboard → твой проект → **Edge Functions** → **Secrets**.

Поставь/обнови:
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI` = `https://dasmart.xyz/instagram/callback`

Эти значения использует Edge Function `instagram-oauth`.

## 6) Meta (Instagram Login) redirect URI

В Meta Dashboard (Instagram API with Instagram Login) добавь:
- Valid OAuth Redirect URI: `https://dasmart.xyz/instagram/callback`

## 7) Telegram BotFather

BotFather → `/myapps` → выбрать бота → Web App URL:
- `https://dasmart.xyz`

