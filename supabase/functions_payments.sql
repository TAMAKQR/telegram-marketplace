-- Функция для перевода средств между пользователями
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

-- Функция для автоматического обновления метрик постов (вызывается по расписанию)
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

-- Функция для удаления задания администратором
-- Возвращает средства заказчику если задание было оплачено
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
  -- task_posts, task_applications
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

-- Функция для получения статистики для админ-панели
CREATE OR REPLACE FUNCTION get_admin_statistics()
RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users),
    'total_clients', (SELECT COUNT(*) FROM users WHERE user_type = 'client'),
    'total_influencers', (SELECT COUNT(*) FROM users WHERE user_type = 'influencer'),
    'total_tasks', (SELECT COUNT(*) FROM tasks),
    'active_tasks', (SELECT COUNT(*) FROM tasks WHERE status IN ('open', 'in_progress')),
    'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'completed'),
    'total_posts', (SELECT COUNT(*) FROM task_posts),
    'pending_posts', (SELECT COUNT(*) FROM task_posts WHERE status = 'pending'),
    'total_transactions', (SELECT COUNT(*) FROM transactions),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'task_payment'),
    'platform_balance', (SELECT COALESCE(SUM(balance), 0) FROM users)
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;
