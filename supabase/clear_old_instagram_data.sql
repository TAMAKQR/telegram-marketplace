-- Очистить старые данные Instagram username, которые были введены вручную
-- Это обновит только те профили, где Instagram подключен, 
-- чтобы при следующей загрузке статистики данные обновились автоматически

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
    instagram_user_id
FROM influencer_profiles
WHERE instagram_connected = true;
