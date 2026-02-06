# Деплой: Docker image + GHCR (один образ везде)

Цель: локально разрабатывать с Docker + Supabase, а затем деплоить **тот же Docker-образ** и настраивать всё через env (без пересборки фронта).

## 1) Локальная проверка

1) Запусти локальный Supabase:

```bash
npx supabase start
```

2) Положи Supabase Publishable/Anon key в `.env.docker`.

Get it quickly:

```bash
npx supabase status -o env
```

3) Запусти контейнер локально «как в проде»:

```bash
docker compose up -d --build
```

Open: `http://localhost:8080`

## 2) Сборка и пуш образа в GHCR (GitHub Container Registry)

This repo includes a GitHub Actions workflow that builds and publishes `ghcr.io/<OWNER>/<REPO>:latest` on every push to `main`.

Prereqs:
- GitHub repo (public or private)
- GitHub Actions enabled

Notes:
- For private repos/packages, the server must authenticate to pull.
- For public packages, the server can pull without auth.

## 3) Сервер: запуск через docker compose

On the server:

1) Install Docker + Docker Compose.

2) Copy these files to the server (or keep them in the repo on the server):
- `docker-compose.prod.yml`
- `.env.prod` (create from `.env.prod.example`)

3) Edit `.env.prod`:

- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon key>`
- `VITE_INSTAGRAM_APP_ID=<app id>`
- `VITE_INSTAGRAM_REDIRECT_URI=https://<your-domain>/instagram/callback`

4) Start:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

5) Verify runtime env injection:

```bash
curl -sS http://127.0.0.1/env.js
```

You should see `window.__ENV__ = { ... }` with your values.

## 4) HTTPS + Telegram WebApp

Telegram WebApps should be served via HTTPS.

Рекомендуемые варианты:
- Поднять reverse proxy с авто-TLS (Caddy / Nginx + Let's Encrypt)
- Или использовать платформу, где HTTPS выдаётся автоматически

Рецепт для VPS (Caddy + Docker): см. docs/DEPLOY_VPS_CADDY.md.

Also update BotFather Web App URL to your HTTPS domain.

## 5) Instagram redirect URI

Set the same redirect URI in 3 places:
- Meta Dashboard (Instagram Login → Valid OAuth Redirect URIs)
- Frontend runtime env: `VITE_INSTAGRAM_REDIRECT_URI`
- Supabase Edge Function secret: `INSTAGRAM_REDIRECT_URI` (in Supabase secrets)

## Render (деплой из GitHub)

Если используешь Render, деплой этот репозиторий как **Web Service** с окружением **Docker** (не Static Site).

Почему так:
- Нужна runtime-инъекция env (`/env.js`), чтобы менять `VITE_*` без пересборки фронта.
- Render требует, чтобы контейнер слушал `PORT`; nginx-конфиг в этом репо это поддерживает.

Шаги (коротко):
1) Render Dashboard: New → Web Service → подключить GitHub repo.
2) Environment: Docker.
3) Env vars в Render:
	- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
	- `VITE_SUPABASE_ANON_KEY=<anon key>`
	- `VITE_INSTAGRAM_APP_ID=<app id>`
	- `VITE_INSTAGRAM_REDIRECT_URI=https://<your-domain>/instagram/callback`
4) После деплоя проверь:
	- `https://<your-domain>/env.js`

Полный гайд под Render + кастомный домен: см. docs/DEPLOY_RENDER.md.

Важно:
- Не указывай `VITE_SUPABASE_URL` на localhost при деплое в Render.
- Secrets для Edge Functions надо настраивать в Supabase Cloud (потому что фронт вызывает `supabase.functions.invoke`).
