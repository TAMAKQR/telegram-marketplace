-- =============================================================================
-- ВЫПОЛНЕНИЕ МИГРАЦИЙ ДЛЯ СИСТЕМЫ ОТСЛЕЖИВАНИЯ ПОСТОВ И АДМИНИСТРИРОВАНИЯ
-- =============================================================================
-- Этот файл нужно выполнить в Supabase SQL Editor
-- Он создает:
-- 1. Таблицу task_posts для отслеживания публикаций
-- 2. Функции для расчета бонусов и автообновления метрик
-- 3. Функцию transfer_funds для переводов между пользователями
-- 4. Админ-функции: admin_delete_task, get_admin_statistics
-- =============================================================================

-- ШАБЛОН 1: Таблица task_posts с метриками и автоматическими бонусами
-- -----------------------------------------------------------------------------

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
CREATE INDEX IF NOT EXISTS idx_task_posts_task_id ON task_posts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_posts_influencer_id ON task_posts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_task_posts_status ON task_posts(status);

-- ШАБЛОН 2: Функции для расчета бонусов
-- -----------------------------------------------------------------------------

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
DROP TRIGGER IF EXISTS trigger_update_task_post_payment ON task_posts;
CREATE TRIGGER trigger_update_task_post_payment
BEFORE UPDATE OF reach, engagement, base_payment ON task_posts
FOR EACH ROW
EXECUTE FUNCTION update_task_post_payment();

-- ШАБЛОН 3: Функция перевода средств
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION transfer_funds(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount DECIMAL(10,2),
  p_task_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_from_balance DECIMAL(10,2);
BEGIN
  -- Проверяем баланс отправителя
  SELECT balance INTO v_from_balance
  FROM users
  WHERE id = p_from_user_id
  FOR UPDATE;
  
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Списываем у отправителя
  UPDATE users
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_from_user_id;
  
  -- Начисляем получателю
  UPDATE users
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_to_user_id;
  
  -- Создаем транзакцию
  INSERT INTO transactions (
    from_user_id,
    to_user_id,
    task_id,
    amount,
    type,
    status,
    description
  ) VALUES (
    p_from_user_id,
    p_to_user_id,
    p_task_id,
    p_amount,
    'task_payment',
    'completed',
    COALESCE(p_description, 'Payment for task completion')
  );
END;
$$ LANGUAGE plpgsql;

-- ШАБЛОН 4: Админ-функции
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_delete_task(
  p_task_id UUID,
  p_admin_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_task RECORD;
  v_refund_amount DECIMAL(10,2) := 0;
  v_result JSON;
BEGIN
  -- Получаем информацию о задании
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- Проверяем есть ли оплаченные посты
  SELECT COALESCE(SUM(total_payment), 0) INTO v_refund_amount
  FROM task_posts
  WHERE task_id = p_task_id
    AND status = 'paid';
  
  -- Если есть оплаченные посты, возвращаем деньги заказчику
  IF v_refund_amount > 0 THEN
    UPDATE users
    SET balance = balance + v_refund_amount,
        updated_at = NOW()
    WHERE id = v_task.client_id;
    
    -- Создаем транзакцию возврата
    INSERT INTO transactions (
      to_user_id,
      task_id,
      amount,
      type,
      status,
      description
    ) VALUES (
      v_task.client_id,
      p_task_id,
      v_refund_amount,
      'task_refund',
      'completed',
      'Refund by admin: ' || COALESCE(p_admin_reason, 'Task deleted')
    );
  END IF;
  
  -- Удаляем все связанные данные (каскадно удалятся через ON DELETE CASCADE)
  DELETE FROM tasks WHERE id = p_task_id;
  
  -- Формируем результат
  v_result := json_build_object(
    'success', true,
    'task_id', p_task_id,
    'refunded_amount', v_refund_amount,
    'reason', p_admin_reason
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_admin_statistics()
RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users),
    'clients', (SELECT COUNT(*) FROM users WHERE user_type = 'client'),
    'influencers', (SELECT COUNT(*) FROM users WHERE user_type = 'influencer'),
    'tasks', (SELECT COUNT(*) FROM tasks),
    'active_tasks', (SELECT COUNT(*) FROM tasks WHERE status IN ('open', 'in_progress')),
    'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'completed'),
    'total_posts', (SELECT COUNT(*) FROM task_posts),
    'pending_posts', (SELECT COUNT(*) FROM task_posts WHERE status = 'pending'),
    'transactions', (SELECT COUNT(*) FROM transactions),
    'revenue', (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'task_payment'),
    'platform_balance', (SELECT COALESCE(SUM(balance), 0) FROM users)
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- ШАБЛОН 5: Автообновление метрик (для будущего использования)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_update_post_metrics()
RETURNS void AS $$
DECLARE
  v_post RECORD;
BEGIN
  -- Обновляем метрики для постов, которые одобрены но еще не оплачены
  -- и обновлялись более 6 часов назад
  FOR v_post IN
    SELECT tp.*, ip.instagram_access_token
    FROM task_posts tp
    JOIN influencer_profiles ip ON ip.user_id = tp.influencer_id
    WHERE tp.status IN ('approved')
      AND tp.instagram_media_id IS NOT NULL
      AND (tp.last_metrics_update IS NULL OR tp.last_metrics_update < NOW() - INTERVAL '6 hours')
  LOOP
    -- Здесь в продакшене нужно вызывать внешний сервис для обновления метрик
    -- Пока просто обновляем время
    UPDATE task_posts
    SET last_metrics_update = NOW()
    WHERE id = v_post.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ЗАВЕРШЕНИЕ
-- =============================================================================
-- После выполнения этого скрипта:
-- 1. Таблица task_posts будет создана
-- 2. Все функции будут доступны
-- 3. Автоматический расчет бонусов будет работать
-- 4. Админ-панель сможет удалять заказы и показывать статистику
-- =============================================================================
