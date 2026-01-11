-- Миграция для добавления системы отчетов и доработок
-- Выполните этот скрипт в Supabase SQL Editor

-- Создаем таблицу для отчетов по заданиям
CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  influencer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_url TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revision_requested')),
  revision_comment TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_submissions_task ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_influencer ON task_submissions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status);

-- Включаем RLS
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Политика доступа: все могут читать и создавать
CREATE POLICY "Enable all for task_submissions" ON task_submissions FOR ALL USING (true) WITH CHECK (true);

-- Добавляем поле work_deadline в таблицу tasks (срок выполнения после принятия)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS work_deadline TIMESTAMP WITH TIME ZONE;
