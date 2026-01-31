-- Обновление схемы для отслеживания выполнения задания

-- 1. Добавляем целевые метрики в таблицу tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS target_metrics JSONB; 
-- Пример: {"views": 100000, "likes": 5000, "comments": 500}

-- 2. Создаем таблицу для отправленных публикаций
CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    influencer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Ссылка на публикацию
    post_url TEXT NOT NULL,
    instagram_media_id TEXT, -- ID медиа из Instagram API
    
    -- Текущие метрики
    current_metrics JSONB, -- {"views": 50000, "likes": 2500, "comments": 200}
    
    -- Статус
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'in_progress', 'completed', 'failed')),
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    
    -- Прогресс в процентах
    progress DECIMAL(5, 2) DEFAULT 0,
    
    CONSTRAINT fk_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES applications(id),
    CONSTRAINT fk_influencer FOREIGN KEY (influencer_id) REFERENCES users(id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_submissions_task ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_influencer ON task_submissions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status);

-- RLS policies
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Инфлюенсеры видят только свои сабмишены
CREATE POLICY "Influencers can view own submissions"
    ON task_submissions
    FOR SELECT
    USING (auth.uid() = influencer_id);

-- Инфлюенсеры могут создавать свои сабмишены
CREATE POLICY "Influencers can create submissions"
    ON task_submissions
    FOR INSERT
    WITH CHECK (auth.uid() = influencer_id);

-- Инфлюенсеры могут обновлять свои сабмишены
CREATE POLICY "Influencers can update own submissions"
    ON task_submissions
    FOR UPDATE
    USING (auth.uid() = influencer_id);

-- Клиенты видят сабмишены своих заданий
CREATE POLICY "Clients can view task submissions"
    ON task_submissions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_submissions.task_id
            AND tasks.client_id = auth.uid()
        )
    );

-- Клиенты могут обновлять сабмишены своих заданий (для одобрения)
CREATE POLICY "Clients can update task submissions"
    ON task_submissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_submissions.task_id
            AND tasks.client_id = auth.uid()
        )
    );

-- Функция для одобрения публикации заказчиком
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
    v_submission task_submissions;
    v_task tasks;
BEGIN
    -- Получаем сабмишен
    SELECT * INTO v_submission FROM task_submissions WHERE id = p_submission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    -- Получаем задание
    SELECT * INTO v_task FROM tasks WHERE id = v_submission.task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    -- Проверяем что это заказчик этого задания
    IF v_task.client_id != p_client_id THEN
        RAISE EXCEPTION 'Only task owner can approve submission';
    END IF;

    -- Проверяем что статус pending_approval
    IF v_submission.status != 'pending_approval' THEN
        RAISE EXCEPTION 'Submission is not pending approval';
    END IF;

    IF p_approved THEN
        -- Одобряем - меняем статус на in_progress
        UPDATE task_submissions
        SET status = 'in_progress',
            last_checked_at = NOW()
        WHERE id = p_submission_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'approved',
            'message', 'Submission approved, tracking started'
        );
    ELSE
        -- Отклоняем
        UPDATE task_submissions
        SET status = 'rejected'
        WHERE id = p_submission_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'rejected',
            'message', 'Submission rejected',
            'reason', p_rejection_reason
        );
    END IF;
END;
$$;

-- Функция обновления прогресса задания.
-- ВАЖНО: основная бизнес-логика выплат/лесенки живёт в update_submission_progress(uuid, int, int, int)
-- (см. migrations/migration_pricing_tiers_ladder_absolute_price.sql).
-- Этот overload оставлен для совместимости со старыми скриптами, которые передают JSONB.

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS paid_tiers JSONB DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION update_submission_progress(
    p_submission_id UUID,
    p_current_metrics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_views INTEGER := NULL;
    v_likes INTEGER := NULL;
    v_comments INTEGER := NULL;
BEGIN
    IF p_current_metrics IS NOT NULL AND jsonb_typeof(p_current_metrics) = 'object' THEN
        IF p_current_metrics ? 'views' THEN
            v_views := NULLIF(p_current_metrics->>'views', '')::INTEGER;
        END IF;
        IF p_current_metrics ? 'likes' THEN
            v_likes := NULLIF(p_current_metrics->>'likes', '')::INTEGER;
        END IF;
        IF p_current_metrics ? 'comments' THEN
            v_comments := NULLIF(p_current_metrics->>'comments', '')::INTEGER;
        END IF;
    END IF;

    RETURN update_submission_progress(
        p_submission_id,
        v_views,
        v_likes,
        v_comments
    );
END;
$$;
