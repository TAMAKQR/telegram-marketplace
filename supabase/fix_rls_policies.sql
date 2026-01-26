-- Проверка что колонки существуют
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'influencer_profiles'
  AND column_name LIKE '%instagram%'
ORDER BY column_name;

-- Удалим старые политики и создадим новые с полным доступом
DROP POLICY IF EXISTS "Enable all for influencer_profiles" ON influencer_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON influencer_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON influencer_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON influencer_profiles;

-- Создаем простую политику с полным доступом
CREATE POLICY "Enable all for influencer_profiles" 
ON influencer_profiles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Тоже для users
DROP POLICY IF EXISTS "Enable all for users" ON users;
CREATE POLICY "Enable all for users" 
ON users 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Проверка политик
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('influencer_profiles', 'users')
ORDER BY tablename, policyname;
