-- Добавляем минимальную вовлеченность в requirements
-- Теперь requirements будет содержать: minFollowers и minEngagementRate

-- Пример структуры:
-- requirements: {
--   "minFollowers": 1000,
--   "minEngagementRate": 2.5
-- }

-- Обновление существующих заданий (опционально)
-- UPDATE tasks
-- SET requirements = jsonb_set(
--   COALESCE(requirements, '{}'::jsonb),
--   '{minEngagementRate}',
--   '0'::jsonb
-- )
-- WHERE requirements IS NULL OR NOT requirements ? 'minEngagementRate';
