-- Быстрая проверка колонок
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'influencer_profiles'
ORDER BY column_name;
