-- Миграция для добавления защиты от мошенничества с метриками
-- Добавляем initial_metrics для отслеживания прироста метрик

-- Добавляем поле для сохранения начальных метрик при отправке публикации
ALTER TABLE task_submissions 
ADD COLUMN IF NOT EXISTS initial_metrics JSONB DEFAULT NULL;

-- Добавляем комментарий для понимания
COMMENT ON COLUMN task_submissions.initial_metrics IS 'Метрики на момент отправки публикации (views, likes, comments). Используется для расчета прироста.';

-- Функция для записи начальных метрик при отправке публикации
-- Вызывается автоматически при создании submission с post_url
CREATE OR REPLACE FUNCTION capture_initial_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_post_id TEXT;
    v_metrics JSONB;
    v_access_token TEXT := 'YOUR_INSTAGRAM_ACCESS_TOKEN'; -- Заменить на реальный токен
BEGIN
    -- Если post_url установлен и initial_metrics еще нет
    IF NEW.post_url IS NOT NULL AND NEW.initial_metrics IS NULL THEN
        -- Извлекаем ID поста из URL
        v_post_id := (regexp_matches(NEW.post_url, '/(?:p|reel)/([A-Za-z0-9_-]+)'))[1];
        
        IF v_post_id IS NOT NULL THEN
            -- Получаем метрики с Instagram API
            v_metrics := fetch_instagram_post_metrics(v_access_token, v_post_id);
            
            -- Сохраняем начальные метрики
            IF v_metrics IS NOT NULL THEN
                NEW.initial_metrics := v_metrics;
            ELSE
                -- Если API недоступен, сохраняем нулевые метрики
                NEW.initial_metrics := jsonb_build_object(
                    'views', 0,
                    'likes', 0,
                    'comments', 0,
                    'captured_at', EXTRACT(EPOCH FROM NOW())
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматической записи initial_metrics
DROP TRIGGER IF EXISTS capture_initial_metrics_trigger ON task_submissions;
CREATE TRIGGER capture_initial_metrics_trigger
    BEFORE INSERT OR UPDATE OF post_url ON task_submissions
    FOR EACH ROW
    EXECUTE FUNCTION capture_initial_metrics();

-- Обновляем функцию auto_check_submissions_metrics для учета прироста
-- Эта функция будет изменена для вычисления delta = current - initial
CREATE OR REPLACE FUNCTION auto_check_submissions_metrics()
RETURNS VOID AS $$
DECLARE
    v_submission RECORD;
    v_post_id TEXT;
    v_current_metrics JSONB;
    v_initial_metrics JSONB;
    v_delta_views INTEGER;
    v_delta_likes INTEGER;
    v_delta_comments INTEGER;
    v_access_token TEXT := 'YOUR_INSTAGRAM_ACCESS_TOKEN';
BEGIN
    -- Перебираем все submissions со статусом in_progress и непустым post_url
    FOR v_submission IN
        SELECT 
            ts.id,
            ts.post_url,
            ts.initial_metrics,
            t.id as task_id
        FROM task_submissions ts
        JOIN tasks t ON ts.task_id = t.id
        JOIN users u ON ts.influencer_id = u.id
        WHERE ts.status = 'in_progress'
          AND ts.post_url IS NOT NULL
          AND u.instagram_connected = true
    LOOP
        -- Извлекаем ID поста из URL Instagram
        v_post_id := (regexp_matches(v_submission.post_url, '/(?:p|reel)/([A-Za-z0-9_-]+)'))[1];
        
        IF v_post_id IS NOT NULL THEN
            -- Получаем ТЕКУЩИЕ метрики с Instagram
            v_current_metrics := fetch_instagram_post_metrics(v_access_token, v_post_id);
            
            IF v_current_metrics IS NOT NULL THEN
                -- Получаем начальные метрики
                v_initial_metrics := v_submission.initial_metrics;
                
                -- Если initial_metrics нет (старые submissions), используем нули
                IF v_initial_metrics IS NULL THEN
                    v_initial_metrics := jsonb_build_object('views', 0, 'likes', 0, 'comments', 0);
                END IF;
                
                -- Вычисляем ПРИРОСТ метрик (delta)
                v_delta_views := COALESCE((v_current_metrics->>'views')::INTEGER, 0) - 
                                COALESCE((v_initial_metrics->>'views')::INTEGER, 0);
                v_delta_likes := COALESCE((v_current_metrics->>'likes')::INTEGER, 0) - 
                                COALESCE((v_initial_metrics->>'likes')::INTEGER, 0);
                v_delta_comments := COALESCE((v_current_metrics->>'comments')::INTEGER, 0) - 
                                   COALESCE((v_initial_metrics->>'comments')::INTEGER, 0);
                
                -- Защита от отрицательных значений (если метрики уменьшились)
                v_delta_views := GREATEST(v_delta_views, 0);
                v_delta_likes := GREATEST(v_delta_likes, 0);
                v_delta_comments := GREATEST(v_delta_comments, 0);
                
                -- Обновляем прогресс с ПРИРОСТОМ метрик
                PERFORM update_submission_progress(
                    v_submission.id,
                    v_delta_views,
                    v_delta_likes,
                    v_delta_comments
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Комментарии для документации
COMMENT ON FUNCTION capture_initial_metrics IS 'Автоматически записывает метрики публикации при первой отправке для защиты от мошенничества';
COMMENT ON FUNCTION auto_check_submissions_metrics IS 'Проверяет ПРИРОСТ метрик (текущие - начальные) для всех активных публикаций';

-- Для существующих submissions без initial_metrics можно установить текущие значения как начальные
-- UPDATE task_submissions 
-- SET initial_metrics = current_metrics 
-- WHERE initial_metrics IS NULL AND current_metrics IS NOT NULL;
