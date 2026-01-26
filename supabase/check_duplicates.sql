-- Проверка дубликатов для user_id 5810d4a0-2b99-4056-bf4d-14733370562d
SELECT COUNT(*) as total, user_id
FROM influencer_profiles
WHERE user_id = '5810d4a0-2b99-4056-bf4d-14733370562d'
GROUP BY user_id;

-- Показать все записи
SELECT *
FROM influencer_profiles
WHERE user_id = '5810d4a0-2b99-4056-bf4d-14733370562d'
ORDER BY created_at DESC;

-- Удалить ВСЕ дубликаты для этого пользователя
-- DELETE FROM influencer_profiles
-- WHERE user_id = '5810d4a0-2b99-4056-bf4d-14733370562d';
