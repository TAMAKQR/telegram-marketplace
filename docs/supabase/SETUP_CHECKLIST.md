# Чеклист настройки Supabase Database

## ✅ Обязательные расширения
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "http";
```

## Порядок выполнения SQL файлов

### 1. Базовая схема (ПЕРВЫМ ДЕЛОМ)
- [ ] `schema.sql` - Основные таблицы (users, tasks, influencer_profiles, task_applications)

### 2. Миграции структуры таблиц
- [ ] `supabase/migrations/migration_balance.sql` - Добавление таблицы transactions
- [ ] `supabase/migrations/migration_submissions.sql` - Таблица task_submissions
- [ ] `supabase/migrations/migration_pricing_tiers.sql` - Pricing tiers + функции approve_submission
- [ ] `supabase/migrations/migration_initial_metrics.sql` - Добавление initial_metrics в task_submissions
- [ ] `supabase/migrations/migration_instagram_oauth.sql` - Instagram OAuth токены
- [ ] `supabase/migrations/migration_soft_delete_users.sql` - **НЕ ВЫПОЛНЕН** Soft delete для users
- [ ] `supabase/migrations/migration_add_is_blocked.sql` - Флаг is_blocked для users

### 3. Функции
- [ ] `increment_balance_function.sql` - Функция пополнения баланса
- [ ] `functions_payments.sql` - Функции оплаты (transfer_funds и др.)
- [ ] `function_fetch_user_media.sql` - **НЕ ВЫПОЛНЕН** Получение постов из Instagram
- [ ] `client_delete_task.sql` - Удаление задач клиентом

### 4. Автоматизация (pg_cron)
- [ ] `auto_metrics_check.sql` - **ОБНОВИТЬ** Автопроверка метрик каждый час

### 5. Политики безопасности (RLS)
- [ ] `fix_rls_policies.sql` - Row Level Security политики

---

## 🔴 СРОЧНО ВЫПОЛНИТЬ:

### 1️⃣ Включить расширение HTTP (если еще не включено)
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

### 2️⃣ Создать функцию fetch_user_instagram_media
Выполнить файл: `supabase/function_fetch_user_media.sql`

### 3️⃣ Обновить функцию auto_check_submissions_metrics (ownership verification)
Выполнить файл: `supabase/auto_metrics_check.sql`

### 4️⃣ Выполнить миграцию soft delete
Выполнить файл: `supabase/migrations/migration_soft_delete_users.sql`

---

## 📋 Проверка текущего состояния

### Проверить существующие таблицы:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Проверить существующие функции:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

### Проверить pg_cron задачи:
```sql
SELECT * FROM cron.job;
```

### Проверить расширения:
```sql
SELECT * FROM pg_extension;
```

### Проверить колонки в task_submissions:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_submissions';
```

### Проверить колонки в users:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users';
```

---

## 🛠️ Быстрая диагностика проблем

### Проблема: fetch_user_instagram_media возвращает null
**Решение:** Выполнить `function_fetch_user_media.sql` и убедиться что расширение http включено

### Проблема: Ownership verification не работает
**Решение:** Обновить `auto_metrics_check.sql` - там добавлена проверка username

### Проблема: Удаленные пользователи видны в балансе
**Решение:** Выполнить `supabase/migrations/migration_soft_delete_users.sql`
**Файл:** `supabase/migrations/migration_soft_delete_users.sql`

### Проблема: Нет автопроверки метрик
**Решение:** Проверить `SELECT * FROM cron.job;` - должна быть задача с jobid=1

---

## 📞 Instagram API Requirements

### Необходимые поля в influencer_profiles:
- `instagram_access_token` - Long-lived access token
- `instagram_username` - Имя пользователя Instagram
- `instagram_user_id` - ID пользователя Instagram

### Необходимые permissions для Instagram App:
- `instagram_basic`
- `instagram_manage_insights`
- `pages_read_engagement`

### Проверка токена:
```sql
SELECT 
  id,
  user_id,
  instagram_username,
  LENGTH(instagram_access_token) as token_length,
  instagram_access_token IS NOT NULL as has_token
FROM influencer_profiles
WHERE instagram_username IS NOT NULL;
```
