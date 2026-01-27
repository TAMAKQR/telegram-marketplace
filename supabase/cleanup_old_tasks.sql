-- Шаг 1: Найти все задания (особенно старые или без client_id)
SELECT 
  id,
  title,
  client_id,
  status,
  budget,
  created_at,
  updated_at
FROM tasks
ORDER BY created_at DESC;

-- Шаг 2: Найти задания без владельца (client_id IS NULL)
SELECT 
  id,
  title,
  status,
  budget,
  created_at
FROM tasks
WHERE client_id IS NULL;

-- Шаг 3: Удалить конкретное задание по ID (замените 'your-task-id' на реальный ID)
-- DELETE FROM tasks WHERE id = 'your-task-id';

-- Шаг 4: Удалить ВСЕ задания без владельца (ОСТОРОЖНО!)
-- DELETE FROM tasks WHERE client_id IS NULL;

-- Шаг 5: Удалить старые тестовые задания (созданные до определенной даты)
-- DELETE FROM tasks WHERE created_at < '2026-01-27' AND status = 'open';
