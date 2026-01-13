-- SQL функция для безопасного пополнения баланса
CREATE OR REPLACE FUNCTION increment_balance(user_id bigint, amount numeric)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET balance = COALESCE(balance, 0) + amount,
        updated_at = now()
    WHERE id = user_id;
    
    -- Проверяем, что пользователь существует
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь с ID % не найден', user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Добавляем колонку is_blocked если её нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE users ADD COLUMN is_blocked boolean DEFAULT false;
    END IF;
END $$;