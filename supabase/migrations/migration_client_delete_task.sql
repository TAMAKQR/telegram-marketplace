-- Функция для удаления задания клиентом (владельцем)
-- Возвращает бюджет на баланс, если задание еще не выполнено

CREATE OR REPLACE FUNCTION client_delete_task(
  p_task_id UUID,
  p_client_id UUID
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
  
  -- Проверка прав доступа - только владелец может удалить
  IF v_task.client_id != p_client_id THEN
    RAISE EXCEPTION 'Access denied: you are not the owner of this task';
  END IF;
  
  -- Определяем сумму возврата
  -- Если задание открыто или в работе, возвращаем весь бюджет
  -- Если completed - не возвращаем (деньги уже выплачены инфлюенсеру)
  IF v_task.status IN ('open', 'in_progress') THEN
    v_refund_amount := v_task.budget;
    
    -- Возвращаем деньги клиенту (только если есть что возвращать)
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
        'Возврат средств за удаление задания'
      );
    END IF;
  ELSE
    -- Для completed заданий возврат не делаем (деньги уже выплачены)
    v_refund_amount := 0;
  END IF;
  
  -- Удаляем задание (cascade удалит связанные записи)
  DELETE FROM tasks WHERE id = p_task_id;
  
  -- Возвращаем результат
  v_result := json_build_object(
    'success', true,
    'task_id', p_task_id,
    'refund_amount', v_refund_amount,
    'message', 'Task deleted successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting task: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
