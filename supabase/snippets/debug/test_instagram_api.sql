-- ========================================
-- ТЕСТ INSTAGRAM API
-- Проверка, что возвращает Instagram Graph API
-- ========================================

-- 1. Получить токен из базы
SELECT 
    instagram_access_token,
    instagram_username,
    LEFT(instagram_access_token, 50) || '...' as token_preview
FROM influencer_profiles
WHERE instagram_access_token IS NOT NULL
LIMIT 1;

-- 2. Протестировать HTTP запрос напрямую (замените YOUR_TOKEN на реальный токен)
-- ВНИМАНИЕ: Скопируйте токен из результата выше и вставьте ниже

SELECT 
    status,
    content::jsonb as response_body,
    content_type,
    headers
FROM http((
    'GET',
    'https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=5&access_token=YOUR_TOKEN_HERE',
    NULL,
    'application/json',
    NULL
)::http_request);

-- 3. Если нужно проверить, что токен валиден - проверьте /me
SELECT 
    status,
    content::jsonb as user_info
FROM http((
    'GET',
    'https://graph.instagram.com/me?fields=id,username&access_token=YOUR_TOKEN_HERE',
    NULL,
    'application/json',
    NULL
)::http_request);
