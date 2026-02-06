-- Проверка данных и RLS
SELECT * FROM influencer_profiles WHERE user_id = '21b252a1-5fcf-48b8-8f88-7adb3f17a21e';

-- Проверка RLS включен
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'influencer_profiles';

-- Проверка политик
SELECT * FROM pg_policies WHERE tablename = 'influencer_profiles';
