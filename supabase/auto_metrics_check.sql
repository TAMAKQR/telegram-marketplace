-- Автоматическая проверка метрик и выплаты через Instagram API
-- Использует pg_cron для запуска каждый час

-- ============================================
-- ШАГ 1: Включаем необходимые расширения
-- ============================================

-- ============================================
-- ШАГ 0: Hotfix для схемы (локальная среда)
-- ============================================

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- ШАГ 2: Функция для получения метрик из Instagram
-- ============================================

DO $do$
BEGIN
    PERFORM 'public.resolve_instagram_media_id_from_shortcode(text,text,text)'::regprocedure;
EXCEPTION WHEN undefined_function THEN
    EXECUTE $create$
        CREATE FUNCTION resolve_instagram_media_id_from_shortcode(
            p_access_token TEXT,
            p_instagram_user_id TEXT,
            p_shortcode TEXT
        )
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $fn$
        DECLARE
            v_response http_response;
            v_json JSONB;
            v_item JSONB;
            v_media_id TEXT;
        BEGIN
            IF p_access_token IS NULL OR p_instagram_user_id IS NULL OR p_shortcode IS NULL THEN
                RETURN NULL;
            END IF;

            SELECT * INTO v_response
            FROM http((
                'GET',
                'https://graph.facebook.com/v18.0/' || p_instagram_user_id || '/media?fields=id,shortcode,permalink&limit=100&access_token=' || p_access_token,
                NULL,
                'application/json',
                NULL
            )::http_request);

            IF v_response.status <> 200 THEN
                RAISE WARNING 'Instagram media list API error: % - %', v_response.status, v_response.content;
                RETURN NULL;
            END IF;

            v_json := v_response.content::jsonb;

            FOR v_item IN
                SELECT * FROM jsonb_array_elements(COALESCE(v_json->'data', '[]'::jsonb))
            LOOP
                IF v_item->>'shortcode' = p_shortcode THEN
                    v_media_id := v_item->>'id';
                    EXIT;
                END IF;

                IF v_media_id IS NULL AND (v_item->>'permalink') ILIKE ('%' || p_shortcode || '%') THEN
                    v_media_id := v_item->>'id';
                    EXIT;
                END IF;
            END LOOP;

            RETURN v_media_id;
        END;
        $fn$;
    $create$;
END;
$do$;

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
    v_insights_response http_response;
    v_insights_fallback_response http_response;
    v_result JSONB;
    v_insights JSONB;
    v_metric JSONB;
    v_views INTEGER;
    v_reach INTEGER;
    v_plays INTEGER;
    v_impressions INTEGER;
BEGIN
    -- Используем Instagram Graph API (graph.facebook.com) по media_id.
    -- NB: shortcode из URL НЕ является media_id.
    SELECT * INTO v_response
    FROM http((
        'GET',
        'https://graph.facebook.com/v18.0/' || p_post_id || '?fields=like_count,comments_count,media_product_type,owner{username},timestamp&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);
    
    IF v_response.status = 200 THEN
        v_result := v_response.content::jsonb;

        -- Пытаемся получить "views" через insights.
        -- NB: для некоторых типов контента (особенно REELS) метрика "views" может быть недоступна,
        -- тогда используем fallback на "plays" и маппим её в views.
        SELECT * INTO v_insights_response
        FROM http((
            'GET',
            'https://graph.facebook.com/v18.0/' || p_post_id || '/insights?metric=views,reach&access_token=' || p_access_token,
            NULL,
            'application/json',
            NULL
        )::http_request);

        v_views := NULL;
        v_reach := NULL;
        v_plays := NULL;
        v_impressions := NULL;

        IF v_insights_response.status = 200 THEN
            v_insights := v_insights_response.content::jsonb;
            FOR v_metric IN
                SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
            LOOP
                IF v_metric->>'name' = 'views' THEN
                    v_views := (v_metric->'values'->0->>'value')::INTEGER;
                ELSIF v_metric->>'name' = 'reach' THEN
                    v_reach := (v_metric->'values'->0->>'value')::INTEGER;
                END IF;
            END LOOP;
        ELSE
            RAISE WARNING 'Instagram insights API error: % - %', v_insights_response.status, v_insights_response.content;

            -- Fallback: try plays/reach/impressions
            SELECT * INTO v_insights_fallback_response
            FROM http((
                'GET',
                'https://graph.facebook.com/v18.0/' || p_post_id || '/insights?metric=plays,reach,impressions&access_token=' || p_access_token,
                NULL,
                'application/json',
                NULL
            )::http_request);

            IF v_insights_fallback_response.status = 200 THEN
                v_insights := v_insights_fallback_response.content::jsonb;
                FOR v_metric IN
                    SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
                LOOP
                    IF v_metric->>'name' = 'plays' THEN
                        v_plays := (v_metric->'values'->0->>'value')::INTEGER;
                    ELSIF v_metric->>'name' = 'reach' THEN
                        v_reach := COALESCE(v_reach, (v_metric->'values'->0->>'value')::INTEGER);
                    ELSIF v_metric->>'name' = 'impressions' THEN
                        v_impressions := (v_metric->'values'->0->>'value')::INTEGER;
                    END IF;
                END LOOP;

                IF v_views IS NULL THEN
                    v_views := v_plays;
                END IF;
            ELSE
                RAISE WARNING 'Instagram insights fallback API error: % - %', v_insights_fallback_response.status, v_insights_fallback_response.content;
            END IF;
        END IF;

        -- Normalize into consistent keys
        v_result := jsonb_set(v_result, '{views}', to_jsonb(COALESCE(v_views, 0)), TRUE);
        v_result := jsonb_set(v_result, '{reach}', to_jsonb(COALESCE(v_reach, 0)), TRUE);
        IF v_impressions IS NOT NULL THEN
            v_result := jsonb_set(v_result, '{impressions}', to_jsonb(v_impressions), TRUE);
        END IF;

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
    v_current_metrics JSONB;
    v_initial_metrics JSONB;
    v_current_views INTEGER;
    v_current_likes INTEGER;
    v_current_comments INTEGER;
    v_initial_views INTEGER;
    v_initial_likes INTEGER;
    v_initial_comments INTEGER;
    v_delta_views INTEGER;
    v_delta_likes INTEGER;
    v_delta_comments INTEGER;
    v_result JSONB;
BEGIN
    RAISE NOTICE 'Starting automatic metrics check...';
    
    -- Получаем все submissions в статусе 'in_progress'
    FOR v_submission IN 
        SELECT 
            ts.*,
            ip.instagram_user_id,
            ip.instagram_access_token,
            ip.instagram_username
        FROM task_submissions ts
        JOIN influencer_profiles ip ON ts.influencer_id = ip.user_id
        WHERE ts.status = 'in_progress'
          AND ts.post_url IS NOT NULL
          AND ip.instagram_connected = TRUE
          AND ip.instagram_access_token IS NOT NULL
    LOOP
        BEGIN
            RAISE NOTICE 'Processing submission: %', v_submission.id;
            
            -- ВАЖНО: shortcode из URL не равен media_id для Graph API.
            -- Основной путь: используем сохраненный instagram_media_id.
            v_instagram_id := v_submission.instagram_media_id;

            -- Фоллбек для старых записей: пробуем получить media_id по shortcode из URL.
            IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
                DECLARE v_shortcode TEXT;
                BEGIN
                    v_shortcode := regexp_replace(v_submission.post_url, '^https?://(?:www\.)?instagram\.com/(?:p|reel)/([^/]+).*$','\1');
                    IF v_shortcode IS NOT NULL AND v_shortcode <> v_submission.post_url THEN
                        v_instagram_id := resolve_instagram_media_id_from_shortcode(
                            v_submission.instagram_access_token,
                            v_submission.instagram_user_id,
                            v_shortcode
                        );

                        IF v_instagram_id IS NOT NULL THEN
                            UPDATE task_submissions
                            SET instagram_media_id = v_instagram_id
                            WHERE id = v_submission.id;
                        END IF;
                    END IF;
                END;
            END IF;

            IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
                RAISE WARNING 'No instagram_media_id for submission %, cannot fetch metrics (post_url=%)', v_submission.id, v_submission.post_url;
                CONTINUE;
            END IF;
            
            RAISE NOTICE 'Fetching metrics for post: %', v_instagram_id;
            
            -- Получаем ТЕКУЩИЕ метрики из Instagram API
            v_current_metrics := fetch_instagram_post_metrics(
                v_submission.instagram_access_token,
                v_instagram_id
            );
            
            IF v_current_metrics IS NOT NULL THEN
                -- ПРОВЕРКА БЕЗОПАСНОСТИ: Проверяем что пост принадлежит инфлюенсеру
                IF (v_current_metrics->'owner'->>'username') IS NOT NULL THEN
                    IF LOWER(v_current_metrics->'owner'->>'username') != LOWER(v_submission.instagram_username) THEN
                        RAISE WARNING 'Post ownership mismatch for submission %: post owner=%, expected=%. Marking as fraud.', 
                            v_submission.id, 
                            v_current_metrics->'owner'->>'username', 
                            v_submission.instagram_username;
                        
                        -- Помечаем как мошенничество
                        UPDATE task_submissions
                        SET 
                            status = 'rejected',
                            rejection_reason = 'Публикация не принадлежит вашему аккаунту Instagram',
                            reviewed_at = NOW()
                        WHERE id = v_submission.id;
                        
                        CONTINUE; -- Пропускаем эту публикацию
                    END IF;
                END IF;
                
                -- Извлекаем ТЕКУЩИЕ значения
                v_current_likes := COALESCE((v_current_metrics->>'like_count')::INTEGER, 0);
                v_current_comments := COALESCE((v_current_metrics->>'comments_count')::INTEGER, 0);
                v_current_views := COALESCE((v_current_metrics->>'views')::INTEGER, 0);
                
                -- Получаем НАЧАЛЬНЫЕ метрики (записанные при отправке публикации)
                v_initial_metrics := v_submission.initial_metrics;
                
                -- Если initial_metrics нет (старые публикации), сохраняем текущие как начальные
                IF v_initial_metrics IS NULL THEN
                    v_initial_metrics := jsonb_build_object(
                        'views', v_current_views,
                        'likes', v_current_likes,
                        'comments', v_current_comments,
                        'captured_at', EXTRACT(EPOCH FROM NOW())
                    );
                    
                    -- Сохраняем initial_metrics для следующих проверок
                    UPDATE task_submissions 
                    SET initial_metrics = v_initial_metrics
                    WHERE id = v_submission.id;
                    
                    RAISE NOTICE 'Set initial_metrics for submission %: %', v_submission.id, v_initial_metrics;
                END IF;
                
                -- Извлекаем начальные значения
                v_initial_views := COALESCE((v_initial_metrics->>'views')::INTEGER, 0);
                v_initial_likes := COALESCE((v_initial_metrics->>'likes')::INTEGER, 0);
                v_initial_comments := COALESCE((v_initial_metrics->>'comments')::INTEGER, 0);
                
                -- Вычисляем ПРИРОСТ (delta = current - initial)
                v_delta_views := GREATEST(v_current_views - v_initial_views, 0);
                v_delta_likes := GREATEST(v_current_likes - v_initial_likes, 0);
                v_delta_comments := GREATEST(v_current_comments - v_initial_comments, 0);
                
                RAISE NOTICE 'Metrics for submission %: current(views=%, likes=%, comments=%), initial(views=%, likes=%, comments=%), delta(views=%, likes=%, comments=%)', 
                    v_submission.id, 
                    v_current_views, v_current_likes, v_current_comments,
                    v_initial_views, v_initial_likes, v_initial_comments,
                    v_delta_views, v_delta_likes, v_delta_comments;
                
                -- Обновляем метрики с ПРИРОСТОМ и проверяем достижение целей
                v_result := update_submission_progress(
                    v_submission.id,
                    v_delta_views,
                    v_delta_likes,
                    v_delta_comments
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

DO $$
DECLARE
    v_job_id BIGINT;
BEGIN
    -- pg_cron может быть недоступен в некоторых проектах/окружениях.
    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'cron' AND p.proname = 'schedule'
    ) THEN
        BEGIN
            PERFORM cron.unschedule('check-submissions-metrics');
        EXCEPTION WHEN OTHERS THEN
            -- ignore if it doesn't exist or can't be unscheduled
        END;

        BEGIN
            v_job_id := cron.schedule(
                'check-submissions-metrics',  -- имя задания
                '0 * * * *',                   -- каждый час в 0 минут
                $cron$SELECT auto_check_submissions_metrics();$cron$
            );
            RAISE NOTICE 'Scheduled pg_cron job check-submissions-metrics (job_id=%)', v_job_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not schedule pg_cron job check-submissions-metrics: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'pg_cron is not available (cron.schedule missing); skipping schedule setup.';
    END IF;
END;
$$;

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
