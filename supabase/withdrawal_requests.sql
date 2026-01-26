-- Добавляем колонку role в таблицу users (если её ещё нет)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT;
    END IF;
END $$;

-- Таблица заявок на вывод средств
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL, -- 'card', 'kaspi', 'paypal' и т.д.
    payment_details JSONB NOT NULL, -- номер карты, номер телефона и т.д.
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_note TEXT, -- комментарий админа
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    
    CONSTRAINT fk_influencer FOREIGN KEY (influencer_id) REFERENCES users(id),
    CONSTRAINT fk_admin FOREIGN KEY (processed_by) REFERENCES users(id)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_withdrawal_influencer ON withdrawal_requests(influencer_id);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_created ON withdrawal_requests(created_at DESC);

-- RLS policies
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Инфлюенсеры видят только свои заявки
CREATE POLICY "Influencers can view own requests"
    ON withdrawal_requests
    FOR SELECT
    USING (auth.uid() = influencer_id);

-- Инфлюенсеры могут создавать свои заявки
CREATE POLICY "Influencers can create requests"
    ON withdrawal_requests
    FOR INSERT
    WITH CHECK (auth.uid() = influencer_id);

-- Админ или бухгалтер видят все заявки
CREATE POLICY "Admin and accountant can view all requests"
    ON withdrawal_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'accountant')
        )
    );

-- Админ или бухгалтер могут обновлять заявки
CREATE POLICY "Admin and accountant can update requests"
    ON withdrawal_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'accountant')
        )
    );

-- Функция для обработки выплаты (уменьшение баланса)
CREATE OR REPLACE FUNCTION process_withdrawal(
    p_request_id UUID,
    p_admin_id UUID,
    p_status TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request withdrawal_requests;
    v_influencer_balance DECIMAL(10, 2);
BEGIN
    -- Проверка что админ или бухгалтер
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND (role = 'admin' OR role = 'accountant')) THEN
        RAISE EXCEPTION 'Only admin or accountant can process withdrawals';
    END IF;

    -- Получаем заявку
    SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;

    -- Проверка что заявка в статусе pending
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;

    -- Если одобрено - проверяем баланс и списываем
    IF p_status = 'approved' THEN
        -- Получаем текущий баланс
        SELECT balance INTO v_influencer_balance 
        FROM users 
        WHERE id = v_request.influencer_id;

        -- Проверка баланса
        IF v_influencer_balance < v_request.amount THEN
            RAISE EXCEPTION 'Insufficient balance';
        END IF;

        -- Списываем с баланса
        UPDATE users 
        SET balance = balance - v_request.amount,
            updated_at = NOW()
        WHERE id = v_request.influencer_id;

        -- Записываем транзакцию
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (
            v_request.influencer_id,
            -v_request.amount,
            'withdrawal',
            'Вывод средств: ' || p_admin_note
        );
    END IF;

    -- Обновляем статус заявки
    UPDATE withdrawal_requests
    SET status = p_status,
        admin_note = p_admin_note,
        processed_at = NOW(),
        processed_by = p_admin_id
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', p_status,
        'message', 'Withdrawal processed successfully'
    );
END;
$$;
