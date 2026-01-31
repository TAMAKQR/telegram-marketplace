-- Миграция для добавления системы балансов
-- Выполните этот скрипт в Supabase SQL Editor

-- Добавляем поле balance в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0);

-- Добавляем поле accepted_influencer_id в таблицу tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS accepted_influencer_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Создаем таблицу транзакций
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

-- Создаем индексы для транзакций
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_task ON transactions(task_id);

-- Включаем RLS для transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Создаем политику доступа для transactions
CREATE POLICY "Enable all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- Обновляем баланс всех существующих пользователей до 0 (если NULL)
UPDATE users SET balance = 0 WHERE balance IS NULL;
