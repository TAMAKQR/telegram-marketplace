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
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_applications_task_id ON task_applications(task_id);
CREATE INDEX idx_task_applications_influencer_id ON task_applications(influencer_id);
CREATE INDEX idx_influencer_profiles_user_id ON influencer_profiles(user_id);
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_task ON transactions(task_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_influencer_profiles_updated_at BEFORE UPDATE ON influencer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_applications_updated_at BEFORE UPDATE ON task_applications
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

-- Политики доступа - разрешаем все операции с anon key
-- Telegram ID используется для аутентификации на уровне приложения
CREATE POLICY "Enable all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for influencer_profiles" ON influencer_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for task_applications" ON task_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for instagram_stats" ON instagram_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
