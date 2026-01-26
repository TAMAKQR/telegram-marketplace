-- Добавление поля is_blocked в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Создаем индекс для быстрой фильтрации заблокированных пользователей
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
