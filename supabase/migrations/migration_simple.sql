-- Простая миграция по шагам
-- Скопируйте каждый блок отдельно и выполните по очереди в Supabase SQL Editor

-- ШАГ 1: Добавить Instagram OAuth колонки
ALTER TABLE influencer_profiles 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMP WITH TIME ZONE;

-- ШАГ 2: Сделать instagram_username необязательным
ALTER TABLE influencer_profiles 
ALTER COLUMN instagram_username DROP NOT NULL;

-- ШАГ 3: Добавить is_blocked
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- ШАГ 4: Проверка - должны увидеть все новые колонки
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'influencer_profiles'
  AND column_name LIKE '%instagram%'
ORDER BY column_name;
