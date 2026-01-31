-- Migration: pricing_tiers ladder uses ABSOLUTE tier prices (not incremental)
-- If tier price represents the total payout at that threshold, we should only pay the delta
-- between the newly reached tier price and what has already been paid for that metric.

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS paid_tiers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN task_submissions.paid_tiers IS 'Список уже оплаченных ценовых порогов (лесенка). Элементы: {key, metric, min, price, paid_at}';

CREATE OR REPLACE FUNCTION update_submission_progress(
    p_submission_id UUID,
    p_current_views INTEGER DEFAULT NULL,
    p_current_likes INTEGER DEFAULT NULL,
    p_current_comments INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_task RECORD;
    v_target_metrics JSONB;
    v_current_metrics JSONB;
    v_all_completed BOOLEAN := TRUE;

    -- Ladder / pricing tiers
    v_paid_tiers JSONB;
    v_pricing_tier JSONB;
    v_metric_name TEXT;
    v_min INTEGER;
    v_price NUMERIC(10,2);
    v_metric_value INTEGER;
    v_tier_key TEXT;
    v_new_payment NUMERIC(10,2) := 0;
    v_determined_price NUMERIC(10,2);
    v_client_balance NUMERIC(10,2);

    v_already_paid_for_metric NUMERIC(10,2);
    v_delta_payment NUMERIC(10,2);

    -- Auto-complete when max tier reached
    v_max_min INTEGER;
    v_has_all_max_tiers_paid BOOLEAN := FALSE;
BEGIN
    -- Lock submission row to avoid double-paying on concurrent runs
    SELECT * INTO v_submission
    FROM task_submissions
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    -- Do not process payouts for non-active submissions
    IF v_submission.status NOT IN ('in_progress', 'approved') THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'all_completed', (v_submission.status = 'completed'),
            'determined_price', COALESCE(v_submission.determined_price, 0),
            'current_metrics', COALESCE(v_submission.current_metrics, '{}'::jsonb),
            'paid_tiers', COALESCE(v_submission.paid_tiers, '[]'::jsonb)
        );
    END IF;

    -- Get task
    SELECT * INTO v_task
    FROM tasks
    WHERE id = v_submission.task_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    v_target_metrics := v_task.target_metrics;

    -- Update current metrics (these are deltas in your pipeline)
    v_current_metrics := COALESCE(v_submission.current_metrics, '{}'::jsonb);

    IF p_current_views IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{views}', to_jsonb(p_current_views));
    END IF;

    IF p_current_likes IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{likes}', to_jsonb(p_current_likes));
    END IF;

    IF p_current_comments IS NOT NULL THEN
        v_current_metrics := jsonb_set(v_current_metrics, '{comments}', to_jsonb(p_current_comments));
    END IF;

    UPDATE task_submissions
    SET current_metrics = v_current_metrics,
        updated_at = NOW()
    WHERE id = p_submission_id;

    -- If pricing tiers exist => ladder payouts mode
    IF v_task.pricing_tiers IS NOT NULL
       AND jsonb_typeof(v_task.pricing_tiers) = 'array'
       AND jsonb_array_length(v_task.pricing_tiers) > 0 THEN

        v_all_completed := FALSE;
        v_paid_tiers := COALESCE(v_submission.paid_tiers, '[]'::jsonb);
        v_determined_price := COALESCE(v_submission.determined_price, 0);

        -- Pay tiers in a stable order (by metric, then min)
        FOR v_pricing_tier IN
            SELECT value
            FROM jsonb_array_elements(v_task.pricing_tiers) AS value
            ORDER BY (value->>'metric')::TEXT, COALESCE((value->>'min')::INTEGER, 0)
        LOOP
            v_metric_name := v_pricing_tier->>'metric';
            v_min := COALESCE((v_pricing_tier->>'min')::INTEGER, 0);
            v_price := COALESCE((v_pricing_tier->>'price')::NUMERIC, 0);

            -- milestone key = metric:min
            v_tier_key := v_metric_name || ':' || v_min::TEXT;

            -- current value for that metric (delta)
            v_metric_value := COALESCE((v_current_metrics->>v_metric_name)::INTEGER, 0);

            -- "лесенка": если достигли min, считаем порог достигнутым (max не нужен)
            IF v_metric_value >= v_min THEN
                -- Do not pay the same tier twice
                IF NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(v_paid_tiers) e
                    WHERE e->>'key' = v_tier_key
                ) THEN
                    -- Absolute-tier logic: pay only the delta over what was already paid for this metric
                    SELECT COALESCE(MAX((e->>'price')::NUMERIC), 0)
                    INTO v_already_paid_for_metric
                    FROM jsonb_array_elements(v_paid_tiers) e
                    WHERE e->>'metric' = v_metric_name;

                    v_delta_payment := GREATEST(v_price - v_already_paid_for_metric, 0);

                    -- Pay only if delta > 0 (transactions.amount has > 0 constraint)
                    IF v_delta_payment > 0 THEN
                        -- Ensure client has funds; if not, skip and retry later
                        SELECT balance INTO v_client_balance
                        FROM users
                        WHERE id = v_task.client_id
                        FOR UPDATE;

                        IF v_client_balance >= v_delta_payment THEN
                            UPDATE users
                            SET balance = balance - v_delta_payment
                            WHERE id = v_task.client_id;

                            UPDATE users
                            SET balance = balance + v_delta_payment
                            WHERE id = v_submission.influencer_id;

                            INSERT INTO transactions (
                                from_user_id,
                                to_user_id,
                                task_id,
                                amount,
                                type,
                                status,
                                description
                            ) VALUES (
                                v_task.client_id,
                                v_submission.influencer_id,
                                v_task.id,
                                v_delta_payment,
                                'task_payment',
                                'completed',
                                'Оплата по лесенке (абсолютная): ' || v_metric_name || ' >= ' || v_min::TEXT
                            );

                            v_new_payment := v_new_payment + v_delta_payment;
                            v_determined_price := v_determined_price + v_delta_payment;
                        ELSE
                            RAISE WARNING 'Insufficient client balance for tier payout: task %, client %, need %, have %', v_task.id, v_task.client_id, v_delta_payment, v_client_balance;
                            CONTINUE;
                        END IF;
                    END IF;

                    -- Mark tier as paid (even if delta=0)
                    v_paid_tiers := v_paid_tiers || jsonb_build_array(
                        jsonb_build_object(
                            'key', v_tier_key,
                            'metric', v_metric_name,
                            'min', v_min,
                            'price', v_price,
                            'paid_at', NOW()
                        )
                    );
                END IF;
            END IF;
        END LOOP;

        UPDATE task_submissions
        SET paid_tiers = v_paid_tiers,
            determined_price = v_determined_price
        WHERE id = p_submission_id;

        -- Auto-complete as soon as the maximum tier is reached (and recorded as paid)
        v_has_all_max_tiers_paid := TRUE;
        FOR v_metric_name IN
            SELECT DISTINCT (value->>'metric')::TEXT
            FROM jsonb_array_elements(v_task.pricing_tiers) AS value
            WHERE value ? 'metric'
        LOOP
            SELECT COALESCE(MAX((value->>'min')::INTEGER), 0)
            INTO v_max_min
            FROM jsonb_array_elements(v_task.pricing_tiers) AS value
            WHERE (value->>'metric')::TEXT = v_metric_name;

            v_tier_key := v_metric_name || ':' || v_max_min::TEXT;

            IF NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_paid_tiers) e
                WHERE e->>'key' = v_tier_key
            ) THEN
                v_has_all_max_tiers_paid := FALSE;
                EXIT;
            END IF;
        END LOOP;

        IF v_has_all_max_tiers_paid THEN
            UPDATE task_submissions
            SET status = 'completed',
                completed_at = COALESCE(completed_at, NOW())
            WHERE id = p_submission_id;

            v_all_completed := TRUE;
        END IF;

        -- Finish tracking at deadline (if configured)
        IF NOT v_all_completed AND v_submission.metric_deadline IS NOT NULL AND NOW() >= v_submission.metric_deadline THEN
            UPDATE task_submissions
            SET status = 'completed',
                completed_at = COALESCE(completed_at, NOW())
            WHERE id = p_submission_id;

            v_all_completed := TRUE;
        END IF;

        RETURN jsonb_build_object(
            'success', TRUE,
            'all_completed', v_all_completed,
            'determined_price', v_determined_price,
            'new_payment', v_new_payment,
            'current_metrics', v_current_metrics,
            'paid_tiers', v_paid_tiers
        );
    END IF;

    -- Legacy mode (no pricing tiers): old completion logic
    IF v_target_metrics IS NOT NULL THEN
        IF (v_target_metrics->>'views')::INTEGER > 0 THEN
            IF (v_current_metrics->>'views')::INTEGER < (v_target_metrics->>'views')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;

        IF (v_target_metrics->>'likes')::INTEGER > 0 THEN
            IF (v_current_metrics->>'likes')::INTEGER < (v_target_metrics->>'likes')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;

        IF (v_target_metrics->>'comments')::INTEGER > 0 THEN
            IF (v_current_metrics->>'comments')::INTEGER < (v_target_metrics->>'comments')::INTEGER THEN
                v_all_completed := FALSE;
            END IF;
        END IF;
    END IF;

    IF v_all_completed THEN
        v_determined_price := COALESCE(v_task.budget, 0);

        UPDATE task_submissions
        SET status = 'completed',
            completed_at = NOW(),
            determined_price = v_determined_price
        WHERE id = p_submission_id;

        IF v_determined_price > 0 THEN
            UPDATE users
            SET balance = balance - v_determined_price
            WHERE id = v_task.client_id;

            UPDATE users
            SET balance = balance + v_determined_price
            WHERE id = v_submission.influencer_id;

            INSERT INTO transactions (
                from_user_id,
                to_user_id,
                task_id,
                amount,
                type,
                status,
                description
            ) VALUES (
                v_task.client_id,
                v_submission.influencer_id,
                v_task.id,
                v_determined_price,
                'task_payment',
                'completed',
                'Оплата за задание'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'all_completed', v_all_completed,
        'determined_price', COALESCE(v_determined_price, COALESCE(v_submission.determined_price, 0)),
        'new_payment', v_new_payment,
        'current_metrics', v_current_metrics,
        'paid_tiers', COALESCE(v_paid_tiers, COALESCE(v_submission.paid_tiers, '[]'::jsonb))
    );
END;
$$;
