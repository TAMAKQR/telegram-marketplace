-- Удалить все дублирующиеся профили, оставить только самый новый
DELETE FROM influencer_profiles
WHERE user_id = '21b252a1-5fcf-48b8-8f88-7adb3f17a21e'
  AND id NOT IN (
    SELECT id 
    FROM influencer_profiles 
    WHERE user_id = '21b252a1-5fcf-48b8-8f88-7adb3f17a21e'
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- Проверка - должен остаться только 1 профиль
SELECT COUNT(*) as count, user_id 
FROM influencer_profiles 
WHERE user_id = '21b252a1-5fcf-48b8-8f88-7adb3f17a21e'
GROUP BY user_id;
