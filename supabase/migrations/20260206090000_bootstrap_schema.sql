-- Bootstrap migration for local development
--
-- Why: Supabase CLI only runs migrations named as "<timestamp>_name.sql".
-- This project currently has several "migration_*.sql" files that are skipped,
-- so a fresh local database starts without the app schema.
--
-- This migration is intended to be idempotent and safe to re-run.

-- Required for uuid_generate_v4() used across the schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core app schema (tables, indexes, triggers, RLS)
-- Inlined from supabase/schema.sql

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('client', 'influencer')),
  balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Дополнительные поля (используются в приложении)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Таблица профилей инфлюенсеров
CREATE TABLE IF NOT EXISTS influencer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  instagram_username TEXT UNIQUE NOT NULL,
  instagram_url TEXT,
  followers_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  category TEXT, -- beauty, lifestyle, tech, etc.
  description TEXT,
  price_per_post DECIMAL(10,2),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram OAuth / connection fields
ALTER TABLE influencer_profiles
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMP WITH TIME ZONE;

-- В текущей логике instagram_username может быть пустым до подключения
ALTER TABLE influencer_profiles
ALTER COLUMN instagram_username DROP NOT NULL;

-- Таблица заданий от заказчиков
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  category TEXT,
  requirements JSONB, -- требования к инфлюенсеру (мин. подписчики, категория и т.д.)
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  accepted_influencer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Метрики и «лесенка»
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS target_metrics JSONB,
ADD COLUMN IF NOT EXISTS work_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS metric_deadline_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS max_influencers INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accepted_count INTEGER DEFAULT 0;

-- Таблица откликов инфлюенсеров на задания
CREATE TABLE IF NOT EXISTS task_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  proposed_price DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, influencer_id)
);

-- Таблица сабмишенов (отправка поста + трекинг/проверка)
CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  influencer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  post_url TEXT NOT NULL,
  description TEXT DEFAULT '',

  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (
    status IN (
      'pending',
      'pending_approval',
      'in_progress',
      'approved',
      'revision_requested',
      'rejected',
      'completed',
      'failed'
    )
  ),

  revision_comment TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Instagram tracking
  instagram_post_url TEXT,
  instagram_media_id TEXT,
  initial_metrics JSONB,
  current_metrics JSONB,

  -- Payments / deadlines
  determined_price DECIMAL(10,2),
  metric_deadline TIMESTAMP WITH TIME ZONE,
  paid_tiers JSONB DEFAULT '[]'::jsonb,

  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Если task_submissions уже существовала (старый вариант), то CREATE TABLE IF NOT EXISTS не добавит новые поля.
-- Этот блок гарантирует наличие колонок, которые использует приложение/индексы/триггеры.
ALTER TABLE task_submissions
  ADD COLUMN IF NOT EXISTS post_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS revision_comment TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS instagram_post_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_media_id TEXT,
  ADD COLUMN IF NOT EXISTS initial_metrics JSONB,
  ADD COLUMN IF NOT EXISTS current_metrics JSONB,
  ADD COLUMN IF NOT EXISTS determined_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS metric_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS paid_tiers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- FK для approved_by (если колонка появилась через ALTER)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_submissions' AND column_name = 'approved_by'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'task_submissions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'task_submissions_approved_by_fkey'
  ) THEN
    ALTER TABLE task_submissions
      ADD CONSTRAINT task_submissions_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_influencer_id ON task_submissions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_task_submissions_instagram_media_id ON task_submissions(instagram_media_id);

-- Таблица статистики Instagram (обновляется периодически)
CREATE TABLE IF NOT EXISTS instagram_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  influencer_profile_id UUID REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  avg_likes DECIMAL(10,2),
  avg_comments DECIMAL(10,2),
  engagement_rate DECIMAL(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица транзакций (для учета движения денег)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'task_payment', 'task_refund', 'task_hold')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'held')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_applications_task_id ON task_applications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_applications_influencer_id ON task_applications(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_user_id ON influencer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_task ON transactions(task_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления timestamps
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_influencer_profiles_updated_at ON influencer_profiles;
CREATE TRIGGER update_influencer_profiles_updated_at BEFORE UPDATE ON influencer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_applications_updated_at ON task_applications;
CREATE TRIGGER update_task_applications_updated_at BEFORE UPDATE ON task_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_submissions_updated_at ON task_submissions;
CREATE TRIGGER update_task_submissions_updated_at BEFORE UPDATE ON task_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Отключаем RLS для упрощения, так как используем Telegram authentication
-- В production рекомендуется настроить через service_role или custom JWT
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Политики доступа - разрешаем все операции с anon key
-- Telegram ID используется для аутентификации на уровне приложения
DROP POLICY IF EXISTS "Enable all for users" ON users;
CREATE POLICY "Enable all for users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for influencer_profiles" ON influencer_profiles;
CREATE POLICY "Enable all for influencer_profiles" ON influencer_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for tasks" ON tasks;
CREATE POLICY "Enable all for tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for task_applications" ON task_applications;
CREATE POLICY "Enable all for task_applications" ON task_applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for instagram_stats" ON instagram_stats;
CREATE POLICY "Enable all for instagram_stats" ON instagram_stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for transactions" ON transactions;
CREATE POLICY "Enable all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for task_submissions" ON task_submissions;
CREATE POLICY "Enable all for task_submissions" ON task_submissions FOR ALL USING (true) WITH CHECK (true);

-- Additional table used by Instagram tracking
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

CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_profile ON instagram_post_stats(influencer_profile_id);
CREATE INDEX IF NOT EXISTS idx_instagram_post_stats_task ON instagram_post_stats(task_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_connected ON influencer_profiles(instagram_connected);

DROP TRIGGER IF EXISTS update_instagram_post_stats_updated_at ON instagram_post_stats;
CREATE TRIGGER update_instagram_post_stats_updated_at
BEFORE UPDATE ON instagram_post_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE instagram_post_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for instagram_post_stats" ON instagram_post_stats;
CREATE POLICY "Enable all for instagram_post_stats" ON instagram_post_stats
FOR ALL USING (true) WITH CHECK (true);

-- Server-side RPC to refresh influencer instagram_stats
-- Inlined from supabase/migrations/migration_instagram_stats_refresh_rpc.sql

-- Migration: server-side refresh of Instagram stats into instagram_stats
-- Purpose:
-- - Avoid calculating stats in the frontend
-- - Avoid exposing instagram_access_token in frontend queries
-- - Provide a single source of truth for stats shown to clients

CREATE EXTENSION IF NOT EXISTS http;

-- Resolve instagram_user_id if missing (best-effort; mirrors legacy frontend fallback)
CREATE OR REPLACE FUNCTION resolve_instagram_user_id_from_token(
  p_access_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response http_response;
  v_json JSONB;
  v_instagram_id TEXT;
BEGIN
  IF p_access_token IS NULL OR length(p_access_token) = 0 THEN
    RETURN NULL;
  END IF;

  -- Instagram API with Instagram Login: /me returns user_id directly
  SELECT * INTO v_response
  FROM http((
    'GET',
    'https://graph.instagram.com/v22.0/me?fields=user_id,username&access_token=' || p_access_token,
    NULL,
    'application/json',
    NULL
  )::http_request);

  IF v_response.status = 200 THEN
    v_json := v_response.content::jsonb;
    -- Response can be { data: [{ user_id, username }] } or { user_id, username }
    IF v_json->'data' IS NOT NULL AND jsonb_array_length(COALESCE(v_json->'data', '[]'::jsonb)) > 0 THEN
      v_instagram_id := v_json->'data'->0->>'user_id';
    ELSE
      v_instagram_id := COALESCE(v_json->>'user_id', v_json->>'id');
    END IF;

    IF v_instagram_id IS NOT NULL AND length(v_instagram_id) > 0 THEN
      RETURN v_instagram_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION resolve_instagram_user_id_from_token IS 'Best-effort resolver for instagram_user_id using Graph API and access token.';

-- Refresh and snapshot Instagram stats for a given app user_id
CREATE OR REPLACE FUNCTION refresh_instagram_stats_for_user(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_instagram_user_id TEXT;

  v_profile_resp http_response;
  v_media_resp http_response;
  v_profile_json JSONB;
  v_media_json JSONB;
  v_post JSONB;

  v_followers INTEGER := 0;
  v_following INTEGER := 0;
  v_media_count INTEGER := 0;
  v_username TEXT;
  v_biography TEXT;

  v_posts_count INTEGER := 0;
  v_total_likes NUMERIC := 0;
  v_total_comments NUMERIC := 0;
  v_avg_likes NUMERIC := 0;
  v_avg_comments NUMERIC := 0;
  v_engagement_rate NUMERIC := 0;
  v_recorded_at TIMESTAMPTZ := NOW();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT * INTO v_profile
  FROM influencer_profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Influencer profile not found for user_id=%', p_user_id;
  END IF;

  IF COALESCE(v_profile.instagram_connected, FALSE) IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_not_connected');
  END IF;

  IF v_profile.instagram_access_token IS NULL OR length(v_profile.instagram_access_token) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'missing_access_token');
  END IF;

  v_instagram_user_id := v_profile.instagram_user_id;

  IF v_instagram_user_id IS NULL OR length(v_instagram_user_id) = 0 THEN
    v_instagram_user_id := resolve_instagram_user_id_from_token(v_profile.instagram_access_token);
    IF v_instagram_user_id IS NOT NULL THEN
      UPDATE influencer_profiles
      SET instagram_user_id = v_instagram_user_id
      WHERE id = v_profile.id;
    END IF;
  END IF;

  IF v_instagram_user_id IS NULL OR length(v_instagram_user_id) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'missing_instagram_user_id');
  END IF;

  -- Fetch profile
  SELECT * INTO v_profile_resp
  FROM http((
    'GET',
    'https://graph.instagram.com/v22.0/' || v_instagram_user_id ||
      '?fields=id,username,biography,followers_count,follows_count,media_count&access_token=' || v_profile.instagram_access_token,
    NULL,
    'application/json',
    NULL
  )::http_request);

  IF v_profile_resp.status <> 200 THEN
    RAISE WARNING 'Instagram profile API error: % - %', v_profile_resp.status, v_profile_resp.content;
    RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_profile_api_error', 'status', v_profile_resp.status);
  END IF;

  v_profile_json := v_profile_resp.content::jsonb;
  v_followers := COALESCE((v_profile_json->>'followers_count')::INTEGER, 0);
  v_following := COALESCE((v_profile_json->>'follows_count')::INTEGER, 0);
  v_media_count := COALESCE((v_profile_json->>'media_count')::INTEGER, 0);
  v_username := v_profile_json->>'username';
  v_biography := v_profile_json->>'biography';

  -- Fetch recent media
  SELECT * INTO v_media_resp
  FROM http((
    'GET',
    'https://graph.instagram.com/v22.0/' || v_instagram_user_id ||
      '/media?fields=id,like_count,comments_count,permalink,timestamp&limit=25&access_token=' || v_profile.instagram_access_token,
    NULL,
    'application/json',
    NULL
  )::http_request);

  IF v_media_resp.status <> 200 THEN
    RAISE WARNING 'Instagram media API error: % - %', v_media_resp.status, v_media_resp.content;
    RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_media_api_error', 'status', v_media_resp.status);
  END IF;

  v_media_json := v_media_resp.content::jsonb;

  FOR v_post IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_media_json->'data', '[]'::jsonb))
  LOOP
    v_posts_count := v_posts_count + 1;
    v_total_likes := v_total_likes + COALESCE((v_post->>'like_count')::NUMERIC, 0);
    v_total_comments := v_total_comments + COALESCE((v_post->>'comments_count')::NUMERIC, 0);
  END LOOP;

  IF v_posts_count > 0 THEN
    v_avg_likes := v_total_likes / v_posts_count;
    v_avg_comments := v_total_comments / v_posts_count;
  END IF;

  IF v_followers > 0 THEN
    v_engagement_rate := ((v_avg_likes + v_avg_comments) / v_followers) * 100;
  END IF;

  -- Update influencer_profiles summary fields (for requirements checks, etc.)
  UPDATE influencer_profiles
  SET instagram_username = COALESCE(v_username, instagram_username),
    instagram_url = CASE WHEN v_username IS NOT NULL AND length(v_username) > 0 THEN 'https://instagram.com/' || v_username ELSE instagram_url END,
    followers_count = v_followers,
    engagement_rate = ROUND(v_engagement_rate::numeric, 2),
    description = COALESCE(NULLIF(v_biography, ''), description),
    last_stats_update = v_recorded_at
  WHERE id = v_profile.id;

  -- Insert snapshot for clients
  INSERT INTO instagram_stats (
    influencer_profile_id,
    followers_count,
    following_count,
    posts_count,
    avg_likes,
    avg_comments,
    engagement_rate,
    recorded_at
  ) VALUES (
    v_profile.id,
    v_followers,
    v_following,
    v_media_count,
    ROUND(v_avg_likes::numeric, 2),
    ROUND(v_avg_comments::numeric, 2),
    ROUND(v_engagement_rate::numeric, 2),
    v_recorded_at
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'influencer_profile_id', v_profile.id,
    'followers_count', v_followers,
    'following_count', v_following,
    'posts_count', v_media_count,
    'avg_likes', ROUND(v_avg_likes::numeric, 2),
    'avg_comments', ROUND(v_avg_comments::numeric, 2),
    'engagement_rate', ROUND(v_engagement_rate::numeric, 2),
    'recorded_at', v_recorded_at
  );
END;
$$;

COMMENT ON FUNCTION refresh_instagram_stats_for_user(UUID) IS 'Refresh Instagram stats server-side and store a snapshot in instagram_stats. Returns computed values.';

-- Background metrics updater + helpers (uses http + optional pg_cron)
-- Inlined from supabase/migrations/migration_auto_metrics_check_cron.sql

-- Migration: automatic metrics refresh for task_submissions via Instagram Graph API
-- Installs/updates:
-- - resolve_instagram_media_id_from_shortcode(access_token, instagram_user_id, shortcode)
-- - fetch_instagram_post_metrics(access_token, media_id)
-- - auto_check_submissions_metrics() + optional pg_cron schedule
--
-- Purpose: keep task_submissions.current_metrics (delta views/likes/comments) updated on production.

-- Safety: ensure required extensions exist (may be restricted by plan).
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure required columns exist (no-op if already present)
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Resolve media_id from shortcode by scanning recent media list
DO $do$
BEGIN
  PERFORM 'public.resolve_instagram_media_id_from_shortcode(text,text,text)'::regprocedure;
EXCEPTION WHEN undefined_function THEN
  EXECUTE $create$
    CREATE FUNCTION resolve_instagram_media_id_from_shortcode(
      p_access_token TEXT,
      p_instagram_user_id TEXT,
      p_shortcode TEXT
    )
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $fn$
    DECLARE
      v_response http_response;
      v_json JSONB;
      v_item JSONB;
      v_media_id TEXT;
    BEGIN
      IF p_access_token IS NULL OR p_instagram_user_id IS NULL OR p_shortcode IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT * INTO v_response
      FROM http((
        'GET',
        'https://graph.instagram.com/v22.0/' || p_instagram_user_id ||
          '/media?fields=id,shortcode,permalink&limit=100&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
      )::http_request);

      IF v_response.status <> 200 THEN
        RAISE WARNING 'Instagram media list API error: % - %', v_response.status, v_response.content;
        RETURN NULL;
      END IF;

      v_json := v_response.content::jsonb;

      FOR v_item IN
        SELECT * FROM jsonb_array_elements(COALESCE(v_json->'data', '[]'::jsonb))
      LOOP
        IF v_item->>'shortcode' = p_shortcode THEN
          v_media_id := v_item->>'id';
          EXIT;
        END IF;

        IF v_media_id IS NULL AND (v_item->>'permalink') ILIKE ('%' || p_shortcode || '%') THEN
          v_media_id := v_item->>'id';
          EXIT;
        END IF;
      END LOOP;

      RETURN v_media_id;
    END;
    $fn$;
  $create$;
END;
$do$;

-- Fetch basic metrics + insights (views/reach) for a media_id
CREATE OR REPLACE FUNCTION fetch_instagram_post_metrics(
  p_access_token TEXT,
  p_post_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response http_response;
  v_insights_response http_response;
  v_insights_fallback_response http_response;
  v_result JSONB;
  v_insights JSONB;
  v_metric JSONB;
  v_views INTEGER;
  v_reach INTEGER;
  v_plays INTEGER;
  v_impressions INTEGER;
BEGIN
  SELECT * INTO v_response
  FROM http((
    'GET',
    'https://graph.instagram.com/v22.0/' || p_post_id ||
      '?fields=like_count,comments_count,media_product_type,owner{username},timestamp&access_token=' || p_access_token,
    NULL,
    'application/json',
    NULL
  )::http_request);

  IF v_response.status = 200 THEN
    v_result := v_response.content::jsonb;

    -- Attempt to fetch views/reach via insights
    SELECT * INTO v_insights_response
    FROM http((
      'GET',
      'https://graph.instagram.com/v22.0/' || p_post_id ||
        '/insights?metric=views,reach&access_token=' || p_access_token,
      NULL,
      'application/json',
      NULL
    )::http_request);

    v_views := NULL;
    v_reach := NULL;
    v_plays := NULL;
    v_impressions := NULL;

    IF v_insights_response.status = 200 THEN
      v_insights := v_insights_response.content::jsonb;

      FOR v_metric IN
        SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
      LOOP
        IF v_metric->>'name' = 'views' THEN
          v_views := (v_metric->'values'->0->>'value')::INTEGER;
        ELSIF v_metric->>'name' = 'reach' THEN
          v_reach := (v_metric->'values'->0->>'value')::INTEGER;
        END IF;
      END LOOP;
    ELSE
      RAISE WARNING 'Instagram insights API error: % - %', v_insights_response.status, v_insights_response.content;

      -- Fallback: some media types (often REELS) may not support "views"; try "plays".
      SELECT * INTO v_insights_fallback_response
      FROM http((
        'GET',
        'https://graph.instagram.com/v22.0/' || p_post_id ||
          '/insights?metric=reach&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
      )::http_request);

      IF v_insights_fallback_response.status = 200 THEN
        v_insights := v_insights_fallback_response.content::jsonb;

        FOR v_metric IN
          SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
        LOOP
          IF v_metric->>'name' = 'plays' THEN
            v_plays := (v_metric->'values'->0->>'value')::INTEGER;
          ELSIF v_metric->>'name' = 'reach' THEN
            v_reach := COALESCE(v_reach, (v_metric->'values'->0->>'value')::INTEGER);
          ELSIF v_metric->>'name' = 'impressions' THEN
            v_impressions := (v_metric->'values'->0->>'value')::INTEGER;
          END IF;
        END LOOP;

        IF v_views IS NULL THEN
          v_views := v_plays;
        END IF;
      ELSE
        RAISE WARNING 'Instagram insights fallback API error: % - %', v_insights_fallback_response.status, v_insights_fallback_response.content;
      END IF;
    END IF;

    -- normalize keys
    v_result := jsonb_set(v_result, '{views}', to_jsonb(COALESCE(v_views, 0)), TRUE);
    v_result := jsonb_set(v_result, '{reach}', to_jsonb(COALESCE(v_reach, 0)), TRUE);
    IF v_impressions IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{impressions}', to_jsonb(v_impressions), TRUE);
    END IF;

    RETURN v_result;
  ELSE
    RAISE WARNING 'Instagram API error: % - %', v_response.status, v_response.content;
    RETURN NULL;
  END IF;
END;
$$;

-- Main periodic updater
CREATE OR REPLACE FUNCTION auto_check_submissions_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission RECORD;
  v_instagram_id TEXT;
  v_post_url TEXT;
  v_current_metrics JSONB;
  v_initial_metrics JSONB;

  v_current_views INTEGER;
  v_current_likes INTEGER;
  v_current_comments INTEGER;

  v_initial_views INTEGER;
  v_initial_likes INTEGER;
  v_initial_comments INTEGER;

  v_delta_views INTEGER;
  v_delta_likes INTEGER;
  v_delta_comments INTEGER;

  v_result JSONB;
BEGIN
  -- Process all active submissions
  FOR v_submission IN
    SELECT
      ts.*,
      ip.instagram_user_id,
      ip.instagram_access_token,
      ip.instagram_username
    FROM task_submissions ts
    JOIN influencer_profiles ip ON ts.influencer_id = ip.user_id
    WHERE ts.status = 'in_progress'
      AND COALESCE(ts.instagram_post_url, ts.post_url) IS NOT NULL
      AND ip.instagram_connected = TRUE
      AND ip.instagram_access_token IS NOT NULL
  LOOP
    BEGIN
      v_post_url := COALESCE(v_submission.instagram_post_url, v_submission.post_url);

      -- Prefer stored instagram_media_id; fallback resolve by shortcode
      v_instagram_id := v_submission.instagram_media_id;

      IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
        DECLARE v_shortcode TEXT;
        BEGIN
          v_shortcode := regexp_replace(v_post_url, '^https?://(?:www\.)?instagram\.com/(?:p|reel)/([^/]+).*$','\1');
          IF v_shortcode IS NOT NULL AND v_shortcode <> v_post_url THEN
            v_instagram_id := resolve_instagram_media_id_from_shortcode(
              v_submission.instagram_access_token,
              v_submission.instagram_user_id,
              v_shortcode
            );

            IF v_instagram_id IS NOT NULL THEN
              UPDATE task_submissions
              SET instagram_media_id = v_instagram_id
              WHERE id = v_submission.id;
            END IF;
          END IF;
        END;
      END IF;

      IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
        CONTINUE;
      END IF;

      v_current_metrics := fetch_instagram_post_metrics(
        v_submission.instagram_access_token,
        v_instagram_id
      );

      IF v_current_metrics IS NULL THEN
        CONTINUE;
      END IF;

      -- Ownership safety check (best-effort)
      IF (v_current_metrics->'owner'->>'username') IS NOT NULL THEN
        IF LOWER(v_current_metrics->'owner'->>'username') <> LOWER(v_submission.instagram_username) THEN
          UPDATE task_submissions
          SET
            status = 'rejected',
            rejection_reason = 'Публикация не принадлежит вашему аккаунту Instagram',
            reviewed_at = NOW()
          WHERE id = v_submission.id;

          CONTINUE;
        END IF;
      END IF;

      v_current_likes := COALESCE((v_current_metrics->>'like_count')::INTEGER, 0);
      v_current_comments := COALESCE((v_current_metrics->>'comments_count')::INTEGER, 0);
      v_current_views := COALESCE((v_current_metrics->>'views')::INTEGER, 0);

      v_initial_metrics := v_submission.initial_metrics;

      -- If initial_metrics missing: set baseline to current, so delta starts from 0
      IF v_initial_metrics IS NULL THEN
        v_initial_metrics := jsonb_build_object(
          'views', v_current_views,
          'likes', v_current_likes,
          'comments', v_current_comments,
          'captured_at', EXTRACT(EPOCH FROM NOW())
        );

        UPDATE task_submissions
        SET initial_metrics = v_initial_metrics
        WHERE id = v_submission.id;
      END IF;

      v_initial_views := COALESCE((v_initial_metrics->>'views')::INTEGER, 0);
      v_initial_likes := COALESCE((v_initial_metrics->>'likes')::INTEGER, 0);
      v_initial_comments := COALESCE((v_initial_metrics->>'comments')::INTEGER, 0);

      v_delta_views := GREATEST(v_current_views - v_initial_views, 0);
      v_delta_likes := GREATEST(v_current_likes - v_initial_likes, 0);
      v_delta_comments := GREATEST(v_current_comments - v_initial_comments, 0);

      v_result := update_submission_progress(
        v_submission.id,
        v_delta_views,
        v_delta_likes,
        v_delta_comments
      );

      UPDATE task_submissions
      SET last_checked_at = NOW(),
        updated_at = NOW()
      WHERE id = v_submission.id;

      -- If the RPC marked it completed, keep timestamps consistent
      IF (v_result->>'all_completed')::BOOLEAN THEN
        UPDATE task_submissions
        SET completed_at = COALESCE(completed_at, NOW())
        WHERE id = v_submission.id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION auto_check_submissions_metrics IS 'Автоматически обновляет метрики активных submissions (delta views/likes/comments) через Instagram Graph API';

-- Try to schedule hourly via pg_cron when available
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    BEGIN
      PERFORM cron.unschedule('check-submissions-metrics');
    EXCEPTION WHEN OTHERS THEN
      -- ignore
    END;

    BEGIN
      v_job_id := cron.schedule(
        'check-submissions-metrics',
        '0 * * * *',
        $cron$SELECT auto_check_submissions_metrics();$cron$
      );
      RAISE NOTICE 'Scheduled pg_cron job check-submissions-metrics (job_id=%)', v_job_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not schedule pg_cron job check-submissions-metrics: %', SQLERRM;
    END;
  END IF;
END;
$$;
