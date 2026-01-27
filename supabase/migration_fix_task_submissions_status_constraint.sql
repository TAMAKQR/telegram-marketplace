-- Миграция: расширить допустимые статусы в task_submissions
-- Причина: текущий CHECK constraint (task_submissions_status_check) слишком узкий
-- и блокирует переходы approve_submission -> in_progress/rejected.
-- Выполните этот файл в Supabase SQL Editor.

DO $$
BEGIN
    -- Удаляем любой старый CHECK constraint, который ограничивает status.
    -- В разных инстансах он может иметь разное имя (или быть создан без имени).
    --
    -- Примечание: этот блок безопасен для повторного запуска.
    FOR r IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'task_submissions'
          AND c.contype = 'c'
          AND (
            pg_get_constraintdef(c.oid) ILIKE '%status%'
            AND pg_get_constraintdef(c.oid) ILIKE '%IN%'
          )
    ) LOOP
        EXECUTE format('ALTER TABLE public.task_submissions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
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
