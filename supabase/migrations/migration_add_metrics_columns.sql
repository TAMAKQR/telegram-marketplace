-- Добавляем колонки для отслеживания метрик в task_submissions

-- 1. Добавляем колонку для текущих метрик
ALTER TABLE task_submissions 
ADD COLUMN IF NOT EXISTS current_metrics JSONB DEFAULT NULL;

-- 2. Колонка initial_metrics уже должна быть (из migration_initial_metrics.sql)
-- Проверяем и добавляем если нет
ALTER TABLE task_submissions 
ADD COLUMN IF NOT EXISTS initial_metrics JSONB DEFAULT NULL;

-- 3. Добавляем колонку для хранения Instagram Post URL (если еще нет)
ALTER TABLE task_submissions 
ADD COLUMN IF NOT EXISTS instagram_post_url TEXT;

-- 3.1 Добавляем колонку для хранения Instagram media_id (нужна для Graph API /{media-id}/insights)
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

-- 4. Переносим данные из post_url в instagram_post_url (если есть старые данные)
UPDATE task_submissions 
SET instagram_post_url = post_url 
WHERE instagram_post_url IS NULL AND post_url IS NOT NULL;

-- 5. Добавляем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_influencer_id ON task_submissions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_instagram_media_id ON task_submissions(instagram_media_id);

-- 6. Проверяем результат
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'task_submissions' 
  AND column_name IN ('current_metrics', 'initial_metrics', 'instagram_post_url', 'instagram_media_id', 'post_url')
ORDER BY column_name;

-- 7. Показываем текущие submissions
SELECT 
    id,
    task_id,
    status,
    COALESCE(instagram_post_url, post_url) as post_url,
    initial_metrics,
    current_metrics,
    created_at
FROM task_submissions
ORDER BY created_at DESC
LIMIT 5;
