-- ========================================
-- БЫСТРОЕ ИСПРАВЛЕНИЕ БАЗЫ ДАННЫХ
-- Выполните этот файл, чтобы установить все недостающие компоненты
-- ========================================

-- ШАГ 1: Включить HTTP расширение (если еще не включено)
CREATE EXTENSION IF NOT EXISTS http;

-- ========================================
-- ШАГ 2: Создать функцию fetch_user_instagram_media
-- ========================================

CREATE OR REPLACE FUNCTION fetch_user_instagram_media(
    p_access_token TEXT,
    p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_result JSONB;
BEGIN
    -- Получаем список медиа пользователя через Instagram Graph API
    SELECT * INTO v_response
    FROM http((
        'GET',
        'https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=' || p_limit::TEXT || '&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);
    
    IF v_response.status = 200 THEN
        v_result := v_response.content::jsonb;
        RETURN v_result;
    ELSE
        RAISE WARNING 'Instagram API error: % - %', v_response.status, v_response.content;
        RETURN NULL;
    END IF;
END;
$$;

COMMENT ON FUNCTION fetch_user_instagram_media IS 'Получает список постов пользователя из Instagram для выбора публикации';

-- ========================================
-- ШАГ 3: Soft delete для пользователей
-- ========================================

-- Добавить колонку is_deleted если еще нет
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Функция для мягкого удаления пользователя
CREATE OR REPLACE FUNCTION admin_soft_delete_user(
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_result JSONB;
BEGIN
    -- Получаем пользователя
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Пользователь не найден'
        );
    END IF;
    
    -- Проверяем баланс
    IF v_user.balance > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Невозможно удалить пользователя с положительным балансом. Сначала обнулите баланс.'
        );
    END IF;
    
    -- Помечаем как удаленного
    UPDATE users 
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Логируем причину (можно добавить таблицу логов позже)
    -- INSERT INTO user_deletion_log (user_id, reason, deleted_at) VALUES (p_user_id, p_reason, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'telegram_id', v_user.telegram_id,
        'username', v_user.username,
        'balance', v_user.balance
    );
END;
$$;

-- Функция для восстановления удаленного пользователя
CREATE OR REPLACE FUNCTION admin_restore_user(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Получаем пользователя
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Пользователь не найден'
        );
    END IF;
    
    -- Восстанавливаем
    UPDATE users 
    SET is_deleted = FALSE,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'telegram_id', v_user.telegram_id,
        'username', v_user.username
    );
END;
$$;

-- ========================================
-- ПРОВЕРКА: Выполнено успешно
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ HTTP расширение: %', 
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') 
        THEN 'установлено' 
        ELSE 'НЕ УСТАНОВЛЕНО' 
        END;
    
    RAISE NOTICE '✅ fetch_user_instagram_media: %', 
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'fetch_user_instagram_media') 
        THEN 'создана' 
        ELSE 'НЕ НАЙДЕНА' 
        END;
    
    RAISE NOTICE '✅ admin_soft_delete_user: %', 
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'admin_soft_delete_user') 
        THEN 'создана' 
        ELSE 'НЕ НАЙДЕНА' 
        END;
    
    RAISE NOTICE '✅ users.is_deleted: %', 
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') 
        THEN 'существует' 
        ELSE 'НЕ НАЙДЕНА' 
        END;
END $$;
