-- Функция для получения списка медиа пользователя из Instagram
-- Возвращает последние посты/рилсы пользователя

-- Удаляем старую версию функции (если существует)
-- Ранее могла существовать версия с другой сигнатурой, поэтому удаляем безопасно несколько вариантов
DROP FUNCTION IF EXISTS fetch_user_instagram_media(TEXT, INTEGER);
DROP FUNCTION IF EXISTS fetch_user_instagram_media(TEXT, TEXT);
DROP FUNCTION IF EXISTS fetch_user_instagram_media(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION fetch_user_instagram_media(
    p_access_token TEXT,
    p_instagram_user_id TEXT,
    p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_result JSONB;
    v_url TEXT;
BEGIN
    -- Получаем список медиа пользователя через Facebook Graph API (правильный endpoint)
    -- https://graph.facebook.com/v18.0/{user-id}/media
    
    v_url := 'https://graph.facebook.com/v18.0/' || p_instagram_user_id || '/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=' || p_limit::TEXT || '&access_token=' || p_access_token;
    
    SELECT * INTO v_response
    FROM http((
        'GET',
        v_url,
        NULL,
        'application/json',
        NULL
    )::http_request);
    
    IF v_response.status = 200 THEN
        v_result := v_response.content::jsonb;
        RETURN v_result;
    ELSE
        -- Возвращаем информацию об ошибке в формате JSONB для отладки
        RAISE WARNING 'Instagram API error: % - %', v_response.status, v_response.content;
        RETURN jsonb_build_object(
            'error', true,
            'status', v_response.status,
            'message', v_response.content,
            'data', NULL
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION fetch_user_instagram_media IS 'Получает список постов пользователя из Instagram для выбора публикации';
