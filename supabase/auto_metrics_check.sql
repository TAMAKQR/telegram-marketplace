-- Автоматическая проверка метрик и выплаты
-- Эта функция должна вызываться периодически (например, каждый час)
-- через pg_cron или внешний сервис

CREATE OR REPLACE FUNCTION auto_check_submissions_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_post_data JSONB;
    v_instagram_id TEXT;
    v_views INTEGER;
    v_likes INTEGER;
    v_comments INTEGER;
BEGIN
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
    LOOP
        BEGIN
            -- Извлекаем Instagram post ID из URL
            -- Формат: https://www.instagram.com/p/POST_ID/ или https://instagram.com/reel/POST_ID/
            v_instagram_id := regexp_replace(v_submission.post_url, '^https?://(?:www\.)?instagram\.com/(?:p|reel)/([^/]+).*$', '\1');
            
            IF v_instagram_id IS NULL OR v_instagram_id = v_submission.post_url THEN
                -- Не удалось извлечь ID
                RAISE NOTICE 'Cannot extract Instagram post ID from URL: %', v_submission.post_url;
                CONTINUE;
            END IF;

            -- ПРИМЕЧАНИЕ: Фактический вызов Instagram API должен происходить в бэкенде
            -- Здесь мы только подготавливаем структуру
            -- В реальной реализации нужно использовать Edge Function или внешний сервис
            
            -- Для тестирования можно использовать случайные значения:
            -- v_views := floor(random() * 10000 + 1000)::INTEGER;
            -- v_likes := floor(random() * 500 + 50)::INTEGER;
            -- v_comments := floor(random() * 50 + 5)::INTEGER;
            
            -- Обновляем метрики (в реальности здесь должны быть данные из Instagram API)
            -- PERFORM update_submission_progress(
            --     v_submission.id,
            --     v_views,
            --     v_likes,
            --     v_comments
            -- );
            
            RAISE NOTICE 'Would update metrics for submission %: post %', v_submission.id, v_instagram_id;
            
        EXCEPTION WHEN OTHERS THEN
            -- Логируем ошибку но продолжаем обработку других submissions
            RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Комментарий
COMMENT ON FUNCTION auto_check_submissions_metrics IS 'Автоматически проверяет метрики всех активных submissions через Instagram API';

-- ============================================
-- Настройка периодического выполнения
-- ============================================

-- ВАРИАНТ 1: Использование pg_cron (если доступно на Supabase)
-- Требует расширение pg_cron
-- SELECT cron.schedule(
--     'check-submissions-metrics',
--     '0 * * * *',  -- Каждый час
--     $$ SELECT auto_check_submissions_metrics(); $$
-- );

-- ВАРИАНТ 2: Использование Supabase Edge Functions
-- Создать Edge Function которая вызывается по расписанию через GitHub Actions или Vercel Cron

-- ВАРИАНТ 3: Внешний cron сервис (например, cron-job.org)
-- Вызывает HTTP endpoint который запускает эту функцию


-- ============================================
-- Helper функция для обновления метрик вручную
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
