-- Автоматическая проверка метрик и выплаты через Instagram API
-- Использует pg_cron для запуска каждый час

-- ============================================
-- ШАГ 1: Включаем необходимые расширения
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- ШАГ 2: Функция для получения метрик из Instagram
-- ============================================

CREATE OR REPLACE FUNCTION fetch_instagram_post_metrics(
    p_access_token TEXT,
    p_post_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_result JSONB;
BEGIN
    -- Вызываем Instagram Graph API для получения метрик поста
    -- https://graph.instagram.com/{media-id}?fields=like_count,comments_count,media_product_type&access_token={access-token}
    
    SELECT * INTO v_response
    FROM http((
        'GET',
        'https://graph.instagram.com/' || p_post_id || '?fields=like_count,comments_count,media_product_type&access_token=' || p_access_token,
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

-- ============================================
-- ШАГ 3: Главная функция автоматической проверки
-- ============================================

CREATE OR REPLACE FUNCTION auto_check_submissions_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_instagram_id TEXT;
    v_metrics JSONB;
    v_views INTEGER;
    v_likes INTEGER;
    v_comments INTEGER;
    v_result JSONB;
BEGIN
    RAISE NOTICE 'Starting automatic metrics check...';
    
    -- Получаем все submissions в статусе 'in_progress'
    FOR v_submission IN 
        SELECT 
            ts.*,
            ip.instagram_user_id,
            ip.instagram_access_token
        FROM task_submissions ts
        JOIN influencer_profiles ip ON ts.influencer_id = ip.user_id
        WHERE ts.status = 'in_progress'
          AND ts.post_url IS NOT NULL
          AND ip.instagram_connected = TRUE
          AND ip.instagram_access_token IS NOT NULL
    LOOP
        BEGIN
            RAISE NOTICE 'Processing submission: %', v_submission.id;
            
            -- Извлекаем Instagram post ID из URL
            -- Формат: https://www.instagram.com/p/POST_ID/ или https://instagram.com/reel/POST_ID/
            v_instagram_id := regexp_replace(v_submission.post_url, '^https?://(?:www\.)?instagram\.com/(?:p|reel)/([^/]+).*$', '\1');
            
            IF v_instagram_id IS NULL OR v_instagram_id = v_submission.post_url THEN
                RAISE WARNING 'Cannot extract Instagram post ID from URL: %', v_submission.post_url;
                CONTINUE;
            END IF;
            
            RAISE NOTICE 'Fetching metrics for post: %', v_instagram_id;
            
            -- Получаем метрики из Instagram API
            v_metrics := fetch_instagram_post_metrics(
                v_submission.instagram_access_token,
                v_instagram_id
            );
            
            IF v_metrics IS NOT NULL THEN
                -- Извлекаем значения
                v_likes := COALESCE((v_metrics->>'like_count')::INTEGER, 0);
                v_comments := COALESCE((v_metrics->>'comments_count')::INTEGER, 0);
                v_views := 0; -- Instagram API не предоставляет views для постов напрямую
                
                RAISE NOTICE 'Metrics for submission %: likes=%, comments=%', v_submission.id, v_likes, v_comments;
                
                -- Обновляем метрики и проверяем достижение целей
                v_result := update_submission_progress(
                    v_submission.id,
                    v_views,
                    v_likes,
                    v_comments
                );
                
                RAISE NOTICE 'Update result: %', v_result;
                
                -- Проверяем, завершилась ли задача
                IF (v_result->>'all_completed')::BOOLEAN THEN
                    RAISE NOTICE 'Submission % completed! Payment: %', 
                        v_submission.id, 
                        v_result->>'determined_price';
                END IF;
            ELSE
                RAISE WARNING 'Failed to fetch metrics for submission %', v_submission.id;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Логируем ошибку но продолжаем обработку других submissions
            RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Automatic metrics check completed';
END;
$$;

COMMENT ON FUNCTION auto_check_submissions_metrics IS 'Автоматически проверяет метрики всех активных submissions через Instagram API каждый час';

-- ============================================
-- ШАГ 4: Настройка расписания pg_cron
-- ============================================

-- Создаем задание - запуск каждый час
-- Если задание уже существует, сначала удалите его:
-- SELECT cron.unschedule('check-submissions-metrics');

SELECT cron.schedule(
    'check-submissions-metrics',  -- имя задания
    '0 * * * *',                   -- каждый час в 0 минут
    $$ SELECT auto_check_submissions_metrics(); $$
);

-- Проверить все запланированные задания:
-- SELECT * FROM cron.job;

-- Посмотреть историю выполнения:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ============================================
-- ШАГ 5: Helper функция для ручного тестирования
-- ============================================

CREATE OR REPLACE FUNCTION manual_update_metrics(
    p_submission_id UUID,
    p_views INTEGER,
    p_likes INTEGER,
    p_comments INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN update_submission_progress(
        p_submission_id,
        p_views,
        p_likes,
        p_comments
    );
END;
$$;

COMMENT ON FUNCTION manual_update_metrics IS 'Ручное обновление метрик для тестирования';
