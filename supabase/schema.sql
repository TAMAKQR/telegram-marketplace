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
