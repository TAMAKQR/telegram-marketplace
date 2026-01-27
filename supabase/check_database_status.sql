-- ========================================
-- ДИАГНОСТИКА БАЗЫ ДАННЫХ SUPABASE
-- Выполните этот скрипт, чтобы проверить текущее состояние
-- ========================================

-- 1. РАСШИРЕНИЯ
SELECT '=== РАСШИРЕНИЯ ===' as info;
SELECT extname as "Расширение", extversion as "Версия"
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pg_cron', 'http', 'pgcrypto')
ORDER BY extname;

-- 2. ТАБЛИЦЫ
SELECT '=== ТАБЛИЦЫ ===' as info;
SELECT 
    table_name as "Таблица",
    (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as "Кол-во колонок"
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. ФУНКЦИИ
SELECT '=== ФУНКЦИИ ===' as info;
SELECT routine_name as "Функция"
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'fetch_user_instagram_media',
    'fetch_instagram_post_metrics',
    'auto_check_submissions_metrics',
    'approve_submission',
    'transfer_funds',
    'increment_balance',
    'admin_soft_delete_user',
    'admin_restore_user'
  )
ORDER BY routine_name;

-- 4. PG_CRON ЗАДАЧИ
SELECT '=== CRON ЗАДАЧИ ===' as info;
SELECT 
    jobid as "ID",
    jobname as "Название",
    schedule as "Расписание",
    active as "Активна"
FROM cron.job
ORDER BY jobid;

-- 5. КОЛОНКИ В USERS
SELECT '=== USERS (ключевые колонки) ===' as info;
SELECT column_name as "Колонка", data_type as "Тип"
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('id', 'telegram_id', 'balance', 'is_blocked', 'is_deleted')
ORDER BY ordinal_position;

-- 6. КОЛОНКИ В TASK_SUBMISSIONS
SELECT '=== TASK_SUBMISSIONS (ключевые колонки) ===' as info;
SELECT column_name as "Колонка", data_type as "Тип"
FROM information_schema.columns 
WHERE table_name = 'task_submissions' 
  AND column_name IN ('id', 'task_id', 'influencer_id', 'status', 'instagram_post_url', 'current_metrics', 'initial_metrics')
ORDER BY ordinal_position;

-- 7. КОЛОНКИ В INFLUENCER_PROFILES
SELECT '=== INFLUENCER_PROFILES (Instagram данные) ===' as info;
SELECT column_name as "Колонка", data_type as "Тип"
FROM information_schema.columns 
WHERE table_name = 'influencer_profiles' 
  AND column_name IN ('id', 'instagram_username', 'instagram_access_token', 'instagram_user_id')
ORDER BY ordinal_position;

-- 8. КОЛОНКИ В TASKS
SELECT '=== TASKS (ключевые колонки) ===' as info;
SELECT column_name as "Колонка", data_type as "Тип"
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name IN ('id', 'status', 'budget', 'pricing_tiers', 'target_metrics', 'deadline')
ORDER BY ordinal_position;

-- 9. СТАТИСТИКА ПО ДАННЫМ
SELECT '=== СТАТИСТИКА ДАННЫХ ===' as info;
SELECT 
    (SELECT COUNT(*) FROM users) as "Пользователи",
    (SELECT COUNT(*) FROM users WHERE user_type = 'client') as "Заказчики",
    (SELECT COUNT(*) FROM users WHERE user_type = 'influencer') as "Инфлюенсеры",
    (SELECT COUNT(*) FROM tasks) as "Задачи",
    (SELECT COUNT(*) FROM task_submissions) as "Отчеты",
    (SELECT COUNT(*) FROM influencer_profiles WHERE instagram_access_token IS NOT NULL) as "Instagram подключен";

-- 10. ПРОВЕРКА КРИТИЧЕСКИХ ФУНКЦИЙ
SELECT '=== ПРОВЕРКА КРИТИЧЕСКИХ ФУНКЦИЙ ===' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'fetch_user_instagram_media') 
        THEN '✅ fetch_user_instagram_media'
        ELSE '❌ fetch_user_instagram_media НЕ НАЙДЕНА'
    END as "Статус функции",
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'auto_check_submissions_metrics') 
        THEN '✅ auto_check_submissions_metrics'
        ELSE '❌ auto_check_submissions_metrics НЕ НАЙДЕНА'
    END,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'admin_soft_delete_user') 
        THEN '✅ admin_soft_delete_user'
        ELSE '❌ admin_soft_delete_user НЕ НАЙДЕНА'
    END;

-- 11. ПРОВЕРКА КОЛОНОК
SELECT '=== ПРОВЕРКА КРИТИЧЕСКИХ КОЛОНОК ===' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') 
        THEN '✅ users.is_deleted'
        ELSE '❌ users.is_deleted НЕ НАЙДЕНА'
    END as "Статус колонки",
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_submissions' AND column_name = 'initial_metrics') 
        THEN '✅ task_submissions.initial_metrics'
        ELSE '❌ task_submissions.initial_metrics НЕ НАЙДЕНА'
    END,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'target_metrics') 
        THEN '✅ tasks.target_metrics'
        ELSE '❌ tasks.target_metrics НЕ НАЙДЕНА'
    END;

-- 12. ПРОВЕРКА РАСШИРЕНИЯ HTTP
SELECT '=== HTTP РАСШИРЕНИЕ ===' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') 
        THEN '✅ HTTP расширение установлено'
        ELSE '❌ HTTP расширение НЕ УСТАНОВЛЕНО - выполните: CREATE EXTENSION IF NOT EXISTS http;'
    END as "Статус HTTP";

-- ИТОГ: Что нужно выполнить
SELECT '=== 🔴 НЕОБХОДИМЫЕ ДЕЙСТВИЯ ===' as info;
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') 
        THEN '1. Включить HTTP расширение: CREATE EXTENSION IF NOT EXISTS http;'
        ELSE '✅ HTTP расширение включено'
    END as "Шаг 1",
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'fetch_user_instagram_media') 
        THEN '2. Выполнить: function_fetch_user_media.sql'
        ELSE '✅ fetch_user_instagram_media создана'
    END as "Шаг 2",
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') 
        THEN '3. Выполнить: migration_soft_delete_users.sql'
        ELSE '✅ Soft delete настроен'
    END as "Шаг 3";
