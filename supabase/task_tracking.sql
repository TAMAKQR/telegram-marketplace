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

-- Функция для обновления прогресса задания
CREATE OR REPLACE FUNCTION update_submission_progress(
    p_submission_id UUID,
    p_current_metrics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission task_submissions;
    v_task tasks;
    v_progress DECIMAL(5, 2);
    v_completed BOOLEAN := FALSE;
    v_views_progress DECIMAL(5, 2) := 0;
    v_likes_progress DECIMAL(5, 2) := 0;
    v_comments_progress DECIMAL(5, 2) := 0;
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

    -- Проверяем что у задания есть целевые метрики
    IF v_task.target_metrics IS NULL THEN
        RAISE EXCEPTION 'Task has no target metrics';
    END IF;

    -- Рассчитываем прогресс для каждой метрики
    IF v_task.target_metrics ? 'views' THEN
        v_views_progress := LEAST(
            (COALESCE((p_current_metrics->>'views')::DECIMAL, 0) / 
             NULLIF((v_task.target_metrics->>'views')::DECIMAL, 0)) * 100,
            100
        );
    END IF;

    IF v_task.target_metrics ? 'likes' THEN
        v_likes_progress := LEAST(
            (COALESCE((p_current_metrics->>'likes')::DECIMAL, 0) / 
             NULLIF((v_task.target_metrics->>'likes')::DECIMAL, 0)) * 100,
            100
        );
    END IF;

    IF v_task.target_metrics ? 'comments' THEN
        v_comments_progress := LEAST(
            (COALESCE((p_current_metrics->>'comments')::DECIMAL, 0) / 
             NULLIF((v_task.target_metrics->>'comments')::DECIMAL, 0)) * 100,
            100
        );
    END IF;

    -- Общий прогресс = среднее по всем метрикам
    v_progress := (v_views_progress + v_likes_progress + v_comments_progress) / 
                  NULLIF((CASE WHEN v_task.target_metrics ? 'views' THEN 1 ELSE 0 END +
                         CASE WHEN v_task.target_metrics ? 'likes' THEN 1 ELSE 0 END +
                         CASE WHEN v_task.target_metrics ? 'comments' THEN 1 ELSE 0 END), 0);

    -- Проверяем достижение цели (все метрики >= 100%)
    IF v_views_progress >= 100 AND 
       (NOT v_task.target_metrics ? 'likes' OR v_likes_progress >= 100) AND
       (NOT v_task.target_metrics ? 'comments' OR v_comments_progress >= 100) THEN
        v_completed := TRUE;
    END IF;

    -- Обновляем сабмишен
    UPDATE task_submissions
    SET current_metrics = p_current_metrics,
        progress = v_progress,
        status = CASE WHEN v_completed THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN v_completed THEN NOW() ELSE completed_at END,
        last_checked_at = NOW()
    WHERE id = p_submission_id;

    -- Если завершено - обновляем задание и выплачиваем
    IF v_completed THEN
        UPDATE tasks SET status = 'completed' WHERE id = v_task.id;
        
        -- Выплата инфлюенсеру
        UPDATE users 
        SET balance = balance + v_task.budget
        WHERE id = v_submission.influencer_id;

        -- Записываем транзакцию
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (
            v_submission.influencer_id,
            v_task.budget,
            'task_payment',
            'Выплата за выполнение задания: ' || v_task.title
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'progress', v_progress,
        'completed', v_completed,
        'current_metrics', p_current_metrics
    );
END;
$$;
