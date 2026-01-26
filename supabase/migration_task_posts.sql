-- Таблица для отслеживания опубликованных постов по заданиям
CREATE TABLE IF NOT EXISTS task_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  influencer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Информация о посте
  post_url TEXT NOT NULL,
  instagram_media_id TEXT, -- ID медиа из Instagram API
  post_type TEXT CHECK (post_type IN ('POST', 'REEL', 'STORY')),
  
  -- Метрики поста (обновляются автоматически)
  impressions INTEGER DEFAULT 0, -- Показы
  reach INTEGER DEFAULT 0, -- Охват (уникальные пользователи)
  engagement INTEGER DEFAULT 0, -- Взаимодействия (лайки + комментарии)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  
  -- Метрики для Stories
  replies_count INTEGER DEFAULT 0,
  exits_count INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back INTEGER DEFAULT 0,
  
  -- Статус и оплата
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  base_payment DECIMAL(10,2), -- Базовая оплата
  bonus_payment DECIMAL(10,2) DEFAULT 0, -- Бонус за результаты
  total_payment DECIMAL(10,2), -- Итоговая сумма
  
  -- Аудит
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  last_metrics_update TIMESTAMP WITH TIME ZONE,
  payment_date TIMESTAMP WITH TIME ZONE,
  
  -- Комментарий от заказчика
  client_comment TEXT,
  
  UNIQUE(task_id, post_url)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_task_posts_task_id ON task_posts(task_id);
CREATE INDEX idx_task_posts_influencer_id ON task_posts(influencer_id);
CREATE INDEX idx_task_posts_status ON task_posts(status);

-- Функция для расчета бонусной оплаты на основе метрик
CREATE OR REPLACE FUNCTION calculate_bonus_payment(
  p_task_post_id UUID
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_base_payment DECIMAL(10,2);
  v_reach INTEGER;
  v_engagement INTEGER;
  v_bonus DECIMAL(10,2) := 0;
  v_engagement_rate DECIMAL(5,2);
BEGIN
  -- Получаем данные поста
  SELECT base_payment, reach, engagement
  INTO v_base_payment, v_reach, v_engagement
  FROM task_posts
  WHERE id = p_task_post_id;
  
  -- Рассчитываем engagement rate
  IF v_reach > 0 THEN
    v_engagement_rate := (v_engagement::DECIMAL / v_reach) * 100;
  ELSE
    v_engagement_rate := 0;
  END IF;
  
  -- Бонусы за охват (каждые 1000 просмотров = +100 тенге)
  IF v_reach >= 1000 THEN
    v_bonus := v_bonus + ((v_reach / 1000)::INTEGER * 100);
  END IF;
  
  -- Бонус за высокую вовлеченность
  IF v_engagement_rate >= 5 THEN
    v_bonus := v_bonus + (v_base_payment * 0.5); -- +50% к базовой ставке
  ELSIF v_engagement_rate >= 3 THEN
    v_bonus := v_bonus + (v_base_payment * 0.3); -- +30%
  ELSIF v_engagement_rate >= 1 THEN
    v_bonus := v_bonus + (v_base_payment * 0.1); -- +10%
  END IF;
  
  RETURN v_bonus;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического обновления итоговой суммы
CREATE OR REPLACE FUNCTION update_task_post_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Рассчитываем бонус
  NEW.bonus_payment := calculate_bonus_payment(NEW.id);
  
  -- Рассчитываем итоговую сумму
  NEW.total_payment := COALESCE(NEW.base_payment, 0) + COALESCE(NEW.bonus_payment, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления оплаты при изменении метрик
CREATE TRIGGER trigger_update_task_post_payment
BEFORE UPDATE OF reach, engagement, base_payment ON task_posts
FOR EACH ROW
EXECUTE FUNCTION update_task_post_payment();

-- Комментарии к таблице
COMMENT ON TABLE task_posts IS 'Опубликованные посты инфлюенсеров по заданиям с автоматическим отслеживанием метрик';
COMMENT ON COLUMN task_posts.impressions IS 'Количество показов поста';
COMMENT ON COLUMN task_posts.reach IS 'Охват - количество уникальных пользователей, которые увидели пост';
COMMENT ON COLUMN task_posts.engagement IS 'Общее количество взаимодействий (лайки + комментарии + сохранения + репосты)';
COMMENT ON COLUMN task_posts.base_payment IS 'Базовая ставка оплаты за публикацию';
COMMENT ON COLUMN task_posts.bonus_payment IS 'Бонус рассчитывается автоматически на основе метрик';
COMMENT ON COLUMN task_posts.total_payment IS 'Итоговая сумма = базовая ставка + бонус';
