-- Миграция для добавления "мягкого" удаления пользователей
-- Вместо физического удаления помечаем пользователей как is_deleted = true

-- Добавляем поле is_deleted
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Добавляем индекс для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- Комментарий для понимания
COMMENT ON COLUMN users.is_deleted IS 'Пользователь удален администратором (мягкое удаление)';

-- Функция для "мягкого" удаления пользователя администратором
CREATE OR REPLACE FUNCTION admin_soft_delete_user(
    p_user_id UUID,
    p_admin_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_result JSONB;
BEGIN
    -- Получаем данные пользователя
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь не найден';
    END IF;
    
    -- Помечаем как удаленного
    UPDATE users
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Возвращаем результат
    v_result := jsonb_build_object(
        'success', TRUE,
        'user_id', p_user_id,
        'user_name', v_user.first_name || ' ' || COALESCE(v_user.last_name, ''),
        'telegram_id', v_user.telegram_id,
        'balance', v_user.balance,
        'reason', p_admin_reason
    );
    
    RETURN v_result;
END;
$$;

-- Функция для восстановления пользователя
CREATE OR REPLACE FUNCTION admin_restore_user(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_result JSONB;
BEGIN
    -- Получаем данные пользователя
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь не найден';
    END IF;
    
    -- Восстанавливаем
    UPDATE users
    SET is_deleted = FALSE,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Возвращаем результат
    v_result := jsonb_build_object(
        'success', TRUE,
        'user_id', p_user_id,
        'user_name', v_user.first_name || ' ' || COALESCE(v_user.last_name, ''),
        'telegram_id', v_user.telegram_id
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION admin_soft_delete_user IS 'Администратор помечает пользователя как удаленного (is_deleted=true)';
COMMENT ON FUNCTION admin_restore_user IS 'Администратор восстанавливает удаленного пользователя (is_deleted=false)';

-- Для существующих пользователей устанавливаем is_deleted = false
UPDATE users SET is_deleted = FALSE WHERE is_deleted IS NULL;
