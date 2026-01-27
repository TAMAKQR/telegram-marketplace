-- Миграция: добавить недостающие колонки для approve_submission
-- Причина: RPC approve_submission обновляет approved_at/approved_by/rejection_reason,
-- а в текущей схеме task_submissions этих колонок может не быть.
-- Выполните этот файл в Supabase SQL Editor.

ALTER TABLE task_submissions
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approved_by UUID DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Связь approved_by -> users(id) (добавляем безопасно)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'task_submissions'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name = 'task_submissions_approved_by_fkey'
    ) THEN
        ALTER TABLE task_submissions
            ADD CONSTRAINT task_submissions_approved_by_fkey
            FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END;
$$;

COMMENT ON COLUMN task_submissions.approved_at IS 'Время одобрения публикации заказчиком (старт трекинга метрик)';
COMMENT ON COLUMN task_submissions.approved_by IS 'Заказчик (users.id), который одобрил публикацию';
COMMENT ON COLUMN task_submissions.rejection_reason IS 'Причина отклонения публикации';
COMMENT ON COLUMN task_submissions.reviewed_at IS 'Время проверки/отклонения публикации';
