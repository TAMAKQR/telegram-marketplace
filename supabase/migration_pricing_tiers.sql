-- Миграция: Ценовые диапазоны и множественные исполнители
-- Дата: 2026-01-26

-- 1. Добавляем поля для ценовых диапазонов в tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS metric_deadline_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS max_influencers INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accepted_count INTEGER DEFAULT 0;

-- Комментарии к новым полям
COMMENT ON COLUMN tasks.pricing_tiers IS 'Массив ценовых диапазонов: [{min: 2000, max: 10000, price: 2000, metric: "views"}]';
COMMENT ON COLUMN tasks.metric_deadline_days IS 'Количество дней на достижение метрик после одобрения публикации';
COMMENT ON COLUMN tasks.max_influencers IS 'Максимальное количество инфлюенсеров (NULL = без ограничений)';
COMMENT ON COLUMN tasks.accepted_count IS 'Количество принятых откликов';

-- 2. Добавляем поле для определения цены в task_submissions
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS determined_price DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS metric_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN task_submissions.determined_price IS 'Определенная цена на основе достигнутых метрик и pricing_tiers';
COMMENT ON COLUMN task_submissions.metric_deadline IS 'Дедлайн для достижения метрик (approved_at + metric_deadline_days)';

-- 3. Изменяем статус задания - теперь не переходит в completed при одном принятом отклике
-- Задание остается 'in_progress' пока есть активные submissions

-- 4. Обновляем функцию update_submission_progress для определения цены
CREATE OR REPLACE FUNCTION update_submission_progress(
    p_submission_id UUID,
    p_current_views INTEGER DEFAULT NULL,
    p_current_likes INTEGER DEFAULT NULL,
    p_current_comments INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_task RECORD;
    v_target_metrics JSONB;
    v_current_metrics JSONB;
    v_all_completed BOOLEAN := TRUE;
    v_determined_price DECIMAL(10,2);
    v_pricing_tier JSONB;
    v_metric_value INTEGER;
BEGIN
    -- Получаем submission
    SELECT * INTO v_submission
    FROM task_submissions
    WHERE id = p_submission_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    -- Получаем задание
    SELECT * INTO v_task
    FROM tasks
    WHERE id = v_submission.task_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    v_target_metrics := v_task.target_metrics;

    -- Обновляем текущие метрики
    v_current_metrics := COALESCE(v_submission.current_metrics, '{}'::jsonb);
    
    IF p_current_views IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{views}', to_jsonb(p_current_views));
    END IF;
    
    IF p_current_likes IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{likes}', to_jsonb(p_current_likes));
    END IF;
    
    IF p_current_comments IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{comments}', to_jsonb(p_current_comments));
    END IF;

    -- Обновляем submission
    UPDATE task_submissions
    SET current_metrics = v_current_metrics,
        updated_at = NOW()
    WHERE id = p_submission_id;

    -- Проверяем, все ли метрики достигнуты
    IF v_target_metrics IS NOT NULL THEN
        -- Проверка просмотров
        IF (v_target_metrics->>'views')::INTEGER > 0 THEN
            IF (v_current_metrics->>'views')::INTEGER < (v_target_metrics->>'views')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;

        -- Проверка лайков
        IF (v_target_metrics->>'likes')::INTEGER > 0 THEN
            IF (v_current_metrics->>'likes')::INTEGER < (v_target_metrics->>'likes')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;

        -- Проверка комментариев
        IF (v_target_metrics->>'comments')::INTEGER > 0 THEN
            IF (v_current_metrics->>'comments')::INTEGER < (v_target_metrics->>'comments')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;
    END IF;

    -- Если все метрики достигнуты - определяем цену и завершаем
    IF v_all_completed THEN
        -- Определяем цену на основе pricing_tiers
        v_determined_price := 0;
        
        IF v_task.pricing_tiers IS NOT NULL AND jsonb_array_length(v_task.pricing_tiers) > 0 THEN
            -- Проходим по каждому pricing tier
            FOR v_pricing_tier IN SELECT * FROM jsonb_array_elements(v_task.pricing_tiers)
            LOOP
                -- Получаем значение метрики для этого tier
                CASE v_pricing_tier->>'metric'
                    WHEN 'views' THEN v_metric_value := (v_current_metrics->>'views')::INTEGER;
                    WHEN 'likes' THEN v_metric_value := (v_current_metrics->>'likes')::INTEGER;
                    WHEN 'comments' THEN v_metric_value := (v_current_metrics->>'comments')::INTEGER;
                    ELSE v_metric_value := 0;
                END CASE;

                -- Проверяем, попадает ли в диапазон
                IF v_metric_value >= (v_pricing_tier->>'min')::INTEGER 
                   AND v_metric_value <= (v_pricing_tier->>'max')::INTEGER THEN
                    v_determined_price := v_determined_price + (v_pricing_tier->>'price')::DECIMAL;
                END IF;
            END LOOP;
        ELSE
            -- Если pricing_tiers нет, используем budget
            v_determined_price := v_task.budget;
        END IF;

        -- Обновляем submission - завершаем и сохраняем цену
        UPDATE task_submissions
        SET 
            status = 'completed',
            completed_at = NOW(),
            determined_price = v_determined_price
        WHERE id = p_submission_id;

        -- АВТОМАТИЧЕСКАЯ ОПЛАТА
        -- Списываем с заказчика
        UPDATE users
        SET balance = balance - v_determined_price
        WHERE id = v_task.client_id;

        -- Зачисляем инфлюенсеру
        UPDATE users
        SET balance = balance + v_determined_price
        WHERE id = v_submission.influencer_id;

        -- Создаем транзакцию
        INSERT INTO transactions (
            from_user_id,
            to_user_id,
            task_id,
            amount,
            type,
            status,
            description
        ) VALUES (
            v_task.client_id,
            v_submission.influencer_id,
            v_task.id,
            v_determined_price,
            'task_payment',
            'completed',
            'Оплата за выполнение задания: ' || v_task.title
        );

        -- НЕ меняем статус задания - оно остается in_progress для других инфлюенсеров
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'all_completed', v_all_completed,
        'determined_price', v_determined_price,
        'current_metrics', v_current_metrics
    );
END;
$$;

-- 5. Обновляем функцию одобрения submission - добавляем установку дедлайна
CREATE OR REPLACE FUNCTION approve_submission(
    p_submission_id UUID,
    p_client_id UUID,
    p_approved BOOLEAN,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_task RECORD;
    v_metric_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Получаем submission
    SELECT ts.*, t.client_id, t.metric_deadline_days
    INTO v_submission
    FROM task_submissions ts
    JOIN tasks t ON t.id = ts.task_id
    WHERE ts.id = p_submission_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Публикация не найдена';
    END IF;

    -- Проверяем права
    IF v_submission.client_id != p_client_id THEN
        RAISE EXCEPTION 'У вас нет прав для одобрения этой публикации';
    END IF;

    -- Проверяем статус (принимаем как 'pending' так и 'pending_approval')
    IF v_submission.status NOT IN ('pending', 'pending_approval') THEN
        RAISE EXCEPTION 'Публикация уже проверена';
    END IF;

    IF p_approved THEN
        -- Одобряем
        -- Вычисляем дедлайн метрик
        v_metric_deadline := NOW() + (COALESCE(v_submission.metric_deadline_days, 7) || ' days')::INTERVAL;
        
        UPDATE task_submissions
        SET 
            status = 'in_progress',
            approved_at = NOW(),
            approved_by = p_client_id,
            metric_deadline = v_metric_deadline
        WHERE id = p_submission_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'message', 'Публикация одобрена',
            'metric_deadline', v_metric_deadline
        );
    ELSE
        -- Отклоняем
        IF p_rejection_reason IS NULL OR p_rejection_reason = '' THEN
            RAISE EXCEPTION 'Укажите причину отклонения';
        END IF;

        UPDATE task_submissions
        SET 
            status = 'rejected',
            rejection_reason = p_rejection_reason,
            reviewed_at = NOW()
        WHERE id = p_submission_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'message', 'Публикация отклонена'
        );
    END IF;
END;
$$;

-- 6. Функция для проверки просроченных submissions
CREATE OR REPLACE FUNCTION check_expired_submissions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_expired_count INTEGER := 0;
BEGIN
    -- Помечаем просроченные submissions как failed
    UPDATE task_submissions
    SET 
        status = 'failed',
        updated_at = NOW()
    WHERE status = 'in_progress'
      AND metric_deadline IS NOT NULL
      AND metric_deadline < NOW();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    RETURN v_expired_count;
END;
$$;

-- 7. Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_tasks_accepted_count ON tasks(accepted_count);
CREATE INDEX IF NOT EXISTS idx_submissions_deadline ON task_submissions(metric_deadline) WHERE status = 'in_progress';

-- 8. Триггер для подсчета принятых откликов
CREATE OR REPLACE FUNCTION update_task_accepted_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        -- Увеличиваем счетчик при принятии
        UPDATE tasks 
        SET accepted_count = accepted_count + 1
        WHERE id = NEW.task_id;
    ELSIF OLD.status = 'accepted' AND NEW.status != 'accepted' THEN
        -- Уменьшаем счетчик при отмене
        UPDATE tasks 
        SET accepted_count = GREATEST(0, accepted_count - 1)
        WHERE id = OLD.task_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_accepted_count ON task_applications;
CREATE TRIGGER trigger_update_accepted_count
    AFTER INSERT OR UPDATE OF status ON task_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_task_accepted_count();
