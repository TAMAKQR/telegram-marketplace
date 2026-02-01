-- Migration: automatic metrics refresh for task_submissions via Instagram Graph API
-- Installs/updates:
-- - resolve_instagram_media_id_from_shortcode(access_token, instagram_user_id, shortcode)
-- - fetch_instagram_post_metrics(access_token, media_id)
-- - auto_check_submissions_metrics() + optional pg_cron schedule
--
-- Purpose: keep task_submissions.current_metrics (delta views/likes/comments) updated on production.

-- Safety: ensure required extensions exist (may be restricted by plan).
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure required columns exist (no-op if already present)
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Resolve media_id from shortcode by scanning recent media list
DO $do$
BEGIN
    PERFORM 'public.resolve_instagram_media_id_from_shortcode(text,text,text)'::regprocedure;
EXCEPTION WHEN undefined_function THEN
    EXECUTE $create$
        CREATE FUNCTION resolve_instagram_media_id_from_shortcode(
            p_access_token TEXT,
            p_instagram_user_id TEXT,
            p_shortcode TEXT
        )
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $fn$
        DECLARE
            v_response http_response;
            v_json JSONB;
            v_item JSONB;
            v_media_id TEXT;
        BEGIN
            IF p_access_token IS NULL OR p_instagram_user_id IS NULL OR p_shortcode IS NULL THEN
                RETURN NULL;
            END IF;

            SELECT * INTO v_response
            FROM http((
                'GET',
                'https://graph.facebook.com/v18.0/' || p_instagram_user_id ||
                    '/media?fields=id,shortcode,permalink&limit=100&access_token=' || p_access_token,
                NULL,
                'application/json',
                NULL
            )::http_request);

            IF v_response.status <> 200 THEN
                RAISE WARNING 'Instagram media list API error: % - %', v_response.status, v_response.content;
                RETURN NULL;
            END IF;

            v_json := v_response.content::jsonb;

            FOR v_item IN
                SELECT * FROM jsonb_array_elements(COALESCE(v_json->'data', '[]'::jsonb))
            LOOP
                IF v_item->>'shortcode' = p_shortcode THEN
                    v_media_id := v_item->>'id';
                    EXIT;
                END IF;

                IF v_media_id IS NULL AND (v_item->>'permalink') ILIKE ('%' || p_shortcode || '%') THEN
                    v_media_id := v_item->>'id';
                    EXIT;
                END IF;
            END LOOP;

            RETURN v_media_id;
        END;
        $fn$;
    $create$;
END;
$do$;

-- Fetch basic metrics + insights (views/reach) for a media_id
CREATE OR REPLACE FUNCTION fetch_instagram_post_metrics(
    p_access_token TEXT,
    p_post_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_insights_response http_response;
    v_insights_fallback_response http_response;
    v_result JSONB;
    v_insights JSONB;
    v_metric JSONB;
    v_views INTEGER;
    v_reach INTEGER;
    v_plays INTEGER;
    v_impressions INTEGER;
BEGIN
    SELECT * INTO v_response
    FROM http((
        'GET',
        'https://graph.facebook.com/v18.0/' || p_post_id ||
            '?fields=like_count,comments_count,media_product_type,owner{username},timestamp&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);

    IF v_response.status = 200 THEN
        v_result := v_response.content::jsonb;

        -- Attempt to fetch views/reach via insights
        SELECT * INTO v_insights_response
        FROM http((
            'GET',
            'https://graph.facebook.com/v18.0/' || p_post_id ||
                '/insights?metric=views,reach&access_token=' || p_access_token,
            NULL,
            'application/json',
            NULL
        )::http_request);

        v_views := NULL;
        v_reach := NULL;
        v_plays := NULL;
        v_impressions := NULL;

        IF v_insights_response.status = 200 THEN
            v_insights := v_insights_response.content::jsonb;

            FOR v_metric IN
                SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
            LOOP
                IF v_metric->>'name' = 'views' THEN
                    v_views := (v_metric->'values'->0->>'value')::INTEGER;
                ELSIF v_metric->>'name' = 'reach' THEN
                    v_reach := (v_metric->'values'->0->>'value')::INTEGER;
                END IF;
            END LOOP;
        ELSE
            RAISE WARNING 'Instagram insights API error: % - %', v_insights_response.status, v_insights_response.content;

            -- Fallback: some media types (often REELS) may not support "views"; try "plays".
            SELECT * INTO v_insights_fallback_response
            FROM http((
                'GET',
                'https://graph.facebook.com/v18.0/' || p_post_id ||
                    '/insights?metric=plays,reach,impressions&access_token=' || p_access_token,
                NULL,
                'application/json',
                NULL
            )::http_request);

            IF v_insights_fallback_response.status = 200 THEN
                v_insights := v_insights_fallback_response.content::jsonb;

                FOR v_metric IN
                    SELECT * FROM jsonb_array_elements(COALESCE(v_insights->'data', '[]'::jsonb))
                LOOP
                    IF v_metric->>'name' = 'plays' THEN
                        v_plays := (v_metric->'values'->0->>'value')::INTEGER;
                    ELSIF v_metric->>'name' = 'reach' THEN
                        v_reach := COALESCE(v_reach, (v_metric->'values'->0->>'value')::INTEGER);
                    ELSIF v_metric->>'name' = 'impressions' THEN
                        v_impressions := (v_metric->'values'->0->>'value')::INTEGER;
                    END IF;
                END LOOP;

                IF v_views IS NULL THEN
                    v_views := v_plays;
                END IF;
            ELSE
                RAISE WARNING 'Instagram insights fallback API error: % - %', v_insights_fallback_response.status, v_insights_fallback_response.content;
            END IF;
        END IF;

        -- normalize keys
        v_result := jsonb_set(v_result, '{views}', to_jsonb(COALESCE(v_views, 0)), TRUE);
        v_result := jsonb_set(v_result, '{reach}', to_jsonb(COALESCE(v_reach, 0)), TRUE);
        IF v_impressions IS NOT NULL THEN
            v_result := jsonb_set(v_result, '{impressions}', to_jsonb(v_impressions), TRUE);
        END IF;

        RETURN v_result;
    ELSE
        RAISE WARNING 'Instagram API error: % - %', v_response.status, v_response.content;
        RETURN NULL;
    END IF;
END;
$$;

-- Main periodic updater
CREATE OR REPLACE FUNCTION auto_check_submissions_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission RECORD;
    v_instagram_id TEXT;
    v_post_url TEXT;
    v_current_metrics JSONB;
    v_initial_metrics JSONB;

    v_current_views INTEGER;
    v_current_likes INTEGER;
    v_current_comments INTEGER;

    v_initial_views INTEGER;
    v_initial_likes INTEGER;
    v_initial_comments INTEGER;

    v_delta_views INTEGER;
    v_delta_likes INTEGER;
    v_delta_comments INTEGER;

    v_result JSONB;
BEGIN
    -- Process all active submissions
    FOR v_submission IN
        SELECT
            ts.*,
            ip.instagram_user_id,
            ip.instagram_access_token,
            ip.instagram_username
        FROM task_submissions ts
        JOIN influencer_profiles ip ON ts.influencer_id = ip.user_id
        WHERE ts.status = 'in_progress'
          AND COALESCE(ts.instagram_post_url, ts.post_url) IS NOT NULL
          AND ip.instagram_connected = TRUE
          AND ip.instagram_access_token IS NOT NULL
    LOOP
        BEGIN
            v_post_url := COALESCE(v_submission.instagram_post_url, v_submission.post_url);

            -- Prefer stored instagram_media_id; fallback resolve by shortcode
            v_instagram_id := v_submission.instagram_media_id;

            IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
                DECLARE v_shortcode TEXT;
                BEGIN
                    v_shortcode := regexp_replace(v_post_url, '^https?://(?:www\.)?instagram\.com/(?:p|reel)/([^/]+).*$','\1');
                    IF v_shortcode IS NOT NULL AND v_shortcode <> v_post_url THEN
                        v_instagram_id := resolve_instagram_media_id_from_shortcode(
                            v_submission.instagram_access_token,
                            v_submission.instagram_user_id,
                            v_shortcode
                        );

                        IF v_instagram_id IS NOT NULL THEN
                            UPDATE task_submissions
                            SET instagram_media_id = v_instagram_id
                            WHERE id = v_submission.id;
                        END IF;
                    END IF;
                END;
            END IF;

            IF v_instagram_id IS NULL OR length(v_instagram_id) = 0 THEN
                CONTINUE;
            END IF;

            v_current_metrics := fetch_instagram_post_metrics(
                v_submission.instagram_access_token,
                v_instagram_id
            );

            IF v_current_metrics IS NULL THEN
                CONTINUE;
            END IF;

            -- Ownership safety check (best-effort)
            IF (v_current_metrics->'owner'->>'username') IS NOT NULL THEN
                IF LOWER(v_current_metrics->'owner'->>'username') <> LOWER(v_submission.instagram_username) THEN
                    UPDATE task_submissions
                    SET
                        status = 'rejected',
                        rejection_reason = 'Публикация не принадлежит вашему аккаунту Instagram',
                        reviewed_at = NOW()
                    WHERE id = v_submission.id;

                    CONTINUE;
                END IF;
            END IF;

            v_current_likes := COALESCE((v_current_metrics->>'like_count')::INTEGER, 0);
            v_current_comments := COALESCE((v_current_metrics->>'comments_count')::INTEGER, 0);
            v_current_views := COALESCE((v_current_metrics->>'views')::INTEGER, 0);

            v_initial_metrics := v_submission.initial_metrics;

            -- If initial_metrics missing: set baseline to current, so delta starts from 0
            IF v_initial_metrics IS NULL THEN
                v_initial_metrics := jsonb_build_object(
                    'views', v_current_views,
                    'likes', v_current_likes,
                    'comments', v_current_comments,
                    'captured_at', EXTRACT(EPOCH FROM NOW())
                );

                UPDATE task_submissions
                SET initial_metrics = v_initial_metrics
                WHERE id = v_submission.id;
            END IF;

            v_initial_views := COALESCE((v_initial_metrics->>'views')::INTEGER, 0);
            v_initial_likes := COALESCE((v_initial_metrics->>'likes')::INTEGER, 0);
            v_initial_comments := COALESCE((v_initial_metrics->>'comments')::INTEGER, 0);

            v_delta_views := GREATEST(v_current_views - v_initial_views, 0);
            v_delta_likes := GREATEST(v_current_likes - v_initial_likes, 0);
            v_delta_comments := GREATEST(v_current_comments - v_initial_comments, 0);

            v_result := update_submission_progress(
                v_submission.id,
                v_delta_views,
                v_delta_likes,
                v_delta_comments
            );

            UPDATE task_submissions
            SET last_checked_at = NOW(),
                updated_at = NOW()
            WHERE id = v_submission.id;

            -- If the RPC marked it completed, keep timestamps consistent
            IF (v_result->>'all_completed')::BOOLEAN THEN
                UPDATE task_submissions
                SET completed_at = COALESCE(completed_at, NOW())
                WHERE id = v_submission.id;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION auto_check_submissions_metrics IS 'Автоматически обновляет метрики активных submissions (delta views/likes/comments) через Instagram Graph API';

-- Try to schedule hourly via pg_cron when available
DO $$
DECLARE
    v_job_id BIGINT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'cron' AND p.proname = 'schedule'
    ) THEN
        BEGIN
            PERFORM cron.unschedule('check-submissions-metrics');
        EXCEPTION WHEN OTHERS THEN
            -- ignore
        END;

        BEGIN
            v_job_id := cron.schedule(
                'check-submissions-metrics',
                '0 * * * *',
                $cron$SELECT auto_check_submissions_metrics();$cron$
            );
            RAISE NOTICE 'Scheduled pg_cron job check-submissions-metrics (job_id=%)', v_job_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not schedule pg_cron job check-submissions-metrics: %', SQLERRM;
        END;
    END IF;
END;
$$;
