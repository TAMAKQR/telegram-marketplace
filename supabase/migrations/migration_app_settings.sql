-- Миграция: Таблица настроек приложения
-- Добавляет переключатель между автоматическим и ручным режимом метрик Instagram

-- Таблица настроек приложения
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by BIGINT -- telegram_id админа
);

-- Создаём настройку режима метрик
INSERT INTO app_settings (key, value, description) VALUES 
    ('instagram_metrics_mode', '"auto"', 'Режим сбора метрик Instagram: "auto" - автоматически через API, "manual" - ручной ввод админом/заказчиком')
ON CONFLICT (key) DO NOTHING;

-- RLS политики
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Админы могут читать и изменять настройки
CREATE POLICY "Admins can manage settings" ON app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Все могут читать настройки
CREATE POLICY "Anyone can read settings" ON app_settings
    FOR SELECT
    USING (true);

-- Функция для получения настройки
CREATE OR REPLACE FUNCTION get_app_setting(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value
    FROM app_settings
    WHERE key = p_key;
    
    RETURN v_value;
END;
$$;

-- Функция для установки настройки (только для админов, проверка на клиенте)
CREATE OR REPLACE FUNCTION set_app_setting(p_key TEXT, p_value JSONB, p_admin_telegram_id BIGINT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (p_key, p_value, NOW(), p_admin_telegram_id)
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by;
    
    RETURN TRUE;
END;
$$;

-- Функция для проверки режима метрик (удобный shortcut)
CREATE OR REPLACE FUNCTION is_manual_metrics_mode()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_mode TEXT;
BEGIN
    SELECT value::text INTO v_mode
    FROM app_settings
    WHERE key = 'instagram_metrics_mode';
    
    -- Убираем кавычки из JSON строки
    v_mode := TRIM(BOTH '"' FROM v_mode);
    
    RETURN v_mode = 'manual';
END;
$$;

COMMENT ON TABLE app_settings IS 'Глобальные настройки приложения';
COMMENT ON FUNCTION get_app_setting IS 'Получить значение настройки по ключу';
COMMENT ON FUNCTION set_app_setting IS 'Установить значение настройки';
COMMENT ON FUNCTION is_manual_metrics_mode IS 'Проверить, включен ли ручной режим ввода метрик';
