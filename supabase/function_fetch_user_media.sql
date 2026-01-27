-- Функция для получения списка медиа пользователя из Instagram
-- Возвращает последние посты/рилсы пользователя

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
    -- https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25
    
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
