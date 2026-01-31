-- Migration: add completed_at to task_submissions
-- Needed by update_submission_progress() when marking a submission completed.

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
