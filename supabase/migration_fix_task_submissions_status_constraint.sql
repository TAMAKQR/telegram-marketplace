-- Миграция: расширить допустимые статусы в task_submissions
-- Причина: текущий CHECK constraint (task_submissions_status_check) слишком узкий
-- и блокирует переходы approve_submission -> in_progress/rejected.
-- Выполните этот файл в Supabase SQL Editor.

DO $$
BEGIN
    -- Удаляем старый constraint (если он существует)
    ALTER TABLE task_submissions
        DROP CONSTRAINT IF EXISTS task_submissions_status_check;

    -- На некоторых инстансах constraint мог быть создан с другим именем.
    -- Если после выполнения всё равно будет 23514, проверьте имя constraint в information_schema.table_constraints.
END;
$$;

ALTER TABLE task_submissions
    ADD CONSTRAINT task_submissions_status_check
    CHECK (
        status IN (
            'pending',
            'pending_approval',
            'in_progress',
            'approved',
            'revision_requested',
            'rejected',
            'completed',
            'failed'
        )
    );
