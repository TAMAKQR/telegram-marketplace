-- Добавление полей для Instagram OAuth в таблицу influencer_profiles
ALTER TABLE influencer_profiles 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMP WITH TIME ZONE;

-- Таблица для хранения статистики постов Instagram
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

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_profile ON instagram_post_stats(influencer_profile_id);
CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_task ON instagram_post_stats(task_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_connected ON influencer_profiles(instagram_connected);

-- Триггер для автообновления updated_at
CREATE TRIGGER update_instagram_post_stats_updated_at BEFORE UPDATE ON instagram_post_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS политики
ALTER TABLE instagram_post_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for instagram_post_stats" ON instagram_post_stats FOR ALL USING (true) WITH CHECK (true);
