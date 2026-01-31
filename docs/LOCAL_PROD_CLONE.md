# Локальная копия продакшена (Supabase DB)

Цель: поднять локальный Supabase и загрузить в него **ту же схему** и (опционально) **те же данные**, что в продакшене — чтобы локальная разработка была 1:1.

> Важно про безопасность: не коммитьте дампы/seed с реальными данными. Лучше делать обезличенный экспорт или использовать тестовые данные.

## Что нужно

- Docker Desktop (обязательно, Supabase CLI поднимает контейнеры)
- Supabase CLI (любым способом):
  - `scoop install supabase`
  - `choco install supabase`
  - или без установки через `npx supabase@latest ...`

Проверка:
- `docker info`
- `supabase --version`

## 1) Поднять локальный Supabase

В корне проекта:

- `supabase start` (или `npx supabase@latest start`)
- `supabase status` (или `npx supabase@latest status`)

`supabase status` покажет локальные:
- API URL (обычно `http://127.0.0.1:54321`)
- DB URL (обычно порт `54322`)
- anon key / service_role key

## 2) Подтянуть схему из продакшена (рекомендуется)

1) Линкуем проект (вставьте `project-ref` из Supabase Dashboard → Project Settings):
- `supabase link --project-ref <YOUR_PROJECT_REF>`
- `supabase link --project-ref <YOUR_PROJECT_REF>` (или `npx supabase@latest link --project-ref <...>`)

2) Генерируем миграцию из текущей прод-схемы:
- `supabase db pull`
- `supabase db pull` (или `npx supabase@latest db pull`)

3) Применяем миграции к локальной базе:
- `supabase db reset`
- `supabase db reset` (или `npx supabase@latest db reset`)

После этого **схема** локально будет как в проде.

## 3) Клонировать данные из продакшена (опционально)

Самый простой путь — `pg_dump` прод-базы и `psql` в локальную.

Рекомендованный безопасный способ: хранить URL в переменных окружения, а не в командной строке.

### 3.1 Получить прод DB URL

В Supabase Dashboard:
- Project Settings → Database → Connection string

Создайте переменную окружения в PowerShell:

- `$env:SUPABASE_DB_URL = "postgresql://..."`

### 3.2 Получить локальный DB URL

Запустите:
- `supabase status`

и задайте:
- `$env:LOCAL_DB_URL = "postgresql://..."`

Примечание: скрипт импорта использует `psql` внутри Docker. Поэтому если в URL хост `127.0.0.1`/`localhost`,
скрипт автоматически заменит его на `host.docker.internal`.

### 3.3 Дамп и восстановление через Docker (без установки Postgres локально)

Самый надёжный вариант для «1:1 и без конфликтов» — дампить только `public` (данные приложения):

PowerShell-редирект `> file` может испортить дамп (перекодировать в UTF-16). Поэтому используйте volume mount:

- `docker run --rm -v "${PWD}\\supabase:/out" postgres:17-alpine pg_dump --schema=public --no-owner --no-privileges "$env:SUPABASE_DB_URL" -f /out/seed.prod.sql`
- `docker run --rm -v "${PWD}\\supabase\\seed.prod.sql:/dump.sql:ro" postgres:17-alpine psql "$env:LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f /dump.sql`

То же самое автоматизирует скрипт: [scripts/clone-prod-db.ps1](scripts/clone-prod-db.ps1)

- По умолчанию скрипт **очищает локальную схему `public`** (DROP SCHEMA public CASCADE) перед восстановлением, чтобы избежать конфликтов (дамп создаст `public` заново).
- Для отключения очистки: `-CleanLocalPublicSchema:$false`
- Для запуска без интерактивного подтверждения: `-Force`

## 4) Подключить фронтенд к локальному Supabase

Создайте `.env.local` (или временно правьте `.env`) и укажите значения из `supabase status`:

- `VITE_SUPABASE_URL=http://127.0.0.1:54321`
- `VITE_SUPABASE_ANON_KEY=<local anon key>`

Запуск:
- `npm run dev`

Если используете уведомления/Instagram OAuth через Supabase Edge Functions, запустите локальный рантайм:
- `supabase functions serve` (или `npx supabase@latest functions serve`)

## 5) Примечания по вашей текущей архитектуре

- Авторизация в приложении **телеграмная** (по `telegram_id`), Supabase Auth на фронте сейчас не используется.
- Привязка Instagram для инфлюенсера идёт через Facebook OAuth (Graph API).

## 6) Важно про секреты (Render/Vite)

Если переменная начинается с `VITE_`, она попадает в frontend bundle и считается **публичной**.

Секреты вроде Telegram Bot Token и Instagram App Secret должны жить в Supabase Edge Functions secrets.
Шаблон: [supabase/functions/SECRETS.example](supabase/functions/SECRETS.example)

Если хотите, я могу добавить отдельный «режим dev без Telegram» (mock user) — это сильно ускоряет локальную отладку.
