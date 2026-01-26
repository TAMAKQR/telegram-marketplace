-- Заставить PostgREST обновить кэш схемы
NOTIFY pgrst, 'reload schema';

-- Или альтернативно - обновить версию схемы
COMMENT ON SCHEMA public IS 'Updated schema';
