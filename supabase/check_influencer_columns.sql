-- Проверить какие колонки есть в таблице influencer_profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'influencer_profiles'
ORDER BY ordinal_position;
