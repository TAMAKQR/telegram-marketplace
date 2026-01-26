-- Разрешить NULL для instagram_username, так как он не обязателен до подключения Instagram
ALTER TABLE influencer_profiles 
ALTER COLUMN instagram_username DROP NOT NULL;

-- Очистить старые данные Instagram username для повторной загрузки из API
UPDATE influencer_profiles
SET 
    instagram_username = NULL,
    instagram_url = NULL
WHERE instagram_connected = true
  AND instagram_access_token IS NOT NULL;

-- Проверка результата
SELECT 
    id,
    user_id, 
    instagram_username,
    instagram_connected,
    instagram_user_id,
    instagram_access_token IS NOT NULL as has_token
FROM influencer_profiles
WHERE instagram_connected = true;
