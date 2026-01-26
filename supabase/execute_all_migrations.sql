-- Execute ALL pending migrations in one go
-- Run this in Supabase SQL Editor

-- 1. Add Instagram OAuth columns
ALTER TABLE influencer_profiles 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMP WITH TIME ZONE;

-- 2. Make instagram_username nullable (may already be done)
ALTER TABLE influencer_profiles 
ALTER COLUMN instagram_username DROP NOT NULL;

-- 3. Add is_blocked column for user blocking feature
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 4. Create instagram_post_stats table
CREATE TABLE IF NOT EXISTS instagram_post_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  influencer_profile_id UUID REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  post_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  reach_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, influencer_profile_id)
);

-- 5. Add indexes
CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_profile ON instagram_post_stats(influencer_profile_id);
CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_task ON instagram_post_stats(task_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_connected ON influencer_profiles(instagram_connected);

-- 6. Add trigger for instagram_post_stats (if update_updated_at_column function exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instagram_post_stats_updated_at ON instagram_post_stats;
CREATE TRIGGER update_instagram_post_stats_updated_at 
BEFORE UPDATE ON instagram_post_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable RLS and add policies
ALTER TABLE instagram_post_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for instagram_post_stats" ON instagram_post_stats;
CREATE POLICY "Enable all for instagram_post_stats" ON instagram_post_stats 
FOR ALL USING (true) WITH CHECK (true);

-- Verify migrations
SELECT 
    'influencer_profiles columns' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'influencer_profiles'
  AND column_name IN ('instagram_access_token', 'instagram_token_expires_at', 'instagram_user_id', 'instagram_connected', 'last_stats_update', 'instagram_username')
ORDER BY column_name;

SELECT 
    'users is_blocked column' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'is_blocked';

SELECT 
    'instagram_post_stats table exists' as check_type,
    COUNT(*) as exists
FROM information_schema.tables
WHERE table_name = 'instagram_post_stats';
