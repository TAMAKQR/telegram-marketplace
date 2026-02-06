-- Migration: server-side refresh of Instagram stats into instagram_stats
-- Purpose:
-- - Avoid calculating stats in the frontend
-- - Avoid exposing instagram_access_token in frontend queries
-- - Provide a single source of truth for stats shown to clients

CREATE EXTENSION IF NOT EXISTS http;

-- Resolve instagram_user_id if missing (best-effort; mirrors legacy frontend fallback)
CREATE OR REPLACE FUNCTION resolve_instagram_user_id_from_token(
    p_access_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_json JSONB;
    v_instagram_id TEXT;
BEGIN
    IF p_access_token IS NULL OR length(p_access_token) = 0 THEN
        RETURN NULL;
    END IF;

    -- Instagram API with Instagram Login: /me returns user_id directly
    SELECT * INTO v_response
    FROM http((
        'GET',
        'https://graph.instagram.com/v22.0/me?fields=user_id,username&access_token=' || p_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);

    IF v_response.status = 200 THEN
        v_json := v_response.content::jsonb;
        -- Response can be { data: [{ user_id, username }] } or { user_id, username }
        IF v_json->'data' IS NOT NULL AND jsonb_array_length(COALESCE(v_json->'data', '[]'::jsonb)) > 0 THEN
            v_instagram_id := v_json->'data'->0->>'user_id';
        ELSE
            v_instagram_id := COALESCE(v_json->>'user_id', v_json->>'id');
        END IF;

        IF v_instagram_id IS NOT NULL AND length(v_instagram_id) > 0 THEN
            RETURN v_instagram_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION resolve_instagram_user_id_from_token IS 'Best-effort resolver for instagram_user_id using Graph API and access token.';

-- Refresh and snapshot Instagram stats for a given app user_id
CREATE OR REPLACE FUNCTION refresh_instagram_stats_for_user(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_instagram_user_id TEXT;

    v_profile_resp http_response;
    v_media_resp http_response;
    v_profile_json JSONB;
    v_media_json JSONB;
    v_post JSONB;

    v_followers INTEGER := 0;
    v_following INTEGER := 0;
    v_media_count INTEGER := 0;
    v_username TEXT;
    v_biography TEXT;

    v_posts_count INTEGER := 0;
    v_total_likes NUMERIC := 0;
    v_total_comments NUMERIC := 0;
    v_avg_likes NUMERIC := 0;
    v_avg_comments NUMERIC := 0;
    v_engagement_rate NUMERIC := 0;
    v_recorded_at TIMESTAMPTZ := NOW();
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id is required';
    END IF;

    SELECT * INTO v_profile
    FROM influencer_profiles
    WHERE user_id = p_user_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Influencer profile not found for user_id=%', p_user_id;
    END IF;

    IF COALESCE(v_profile.instagram_connected, FALSE) IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_not_connected');
    END IF;

    IF v_profile.instagram_access_token IS NULL OR length(v_profile.instagram_access_token) = 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'missing_access_token');
    END IF;

    v_instagram_user_id := v_profile.instagram_user_id;

    IF v_instagram_user_id IS NULL OR length(v_instagram_user_id) = 0 THEN
        v_instagram_user_id := resolve_instagram_user_id_from_token(v_profile.instagram_access_token);
        IF v_instagram_user_id IS NOT NULL THEN
            UPDATE influencer_profiles
            SET instagram_user_id = v_instagram_user_id
            WHERE id = v_profile.id;
        END IF;
    END IF;

    IF v_instagram_user_id IS NULL OR length(v_instagram_user_id) = 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'missing_instagram_user_id');
    END IF;

    -- Fetch profile
    SELECT * INTO v_profile_resp
    FROM http((
        'GET',
        'https://graph.instagram.com/v22.0/' || v_instagram_user_id ||
            '?fields=id,username,biography,followers_count,follows_count,media_count&access_token=' || v_profile.instagram_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);

    IF v_profile_resp.status <> 200 THEN
        RAISE WARNING 'Instagram profile API error: % - %', v_profile_resp.status, v_profile_resp.content;
        RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_profile_api_error', 'status', v_profile_resp.status);
    END IF;

    v_profile_json := v_profile_resp.content::jsonb;
    v_followers := COALESCE((v_profile_json->>'followers_count')::INTEGER, 0);
    v_following := COALESCE((v_profile_json->>'follows_count')::INTEGER, 0);
    v_media_count := COALESCE((v_profile_json->>'media_count')::INTEGER, 0);
    v_username := v_profile_json->>'username';
    v_biography := v_profile_json->>'biography';

    -- Fetch recent media
    SELECT * INTO v_media_resp
    FROM http((
        'GET',
        'https://graph.instagram.com/v22.0/' || v_instagram_user_id ||
            '/media?fields=id,like_count,comments_count,permalink,timestamp&limit=25&access_token=' || v_profile.instagram_access_token,
        NULL,
        'application/json',
        NULL
    )::http_request);

    IF v_media_resp.status <> 200 THEN
        RAISE WARNING 'Instagram media API error: % - %', v_media_resp.status, v_media_resp.content;
        RETURN jsonb_build_object('success', FALSE, 'error', 'instagram_media_api_error', 'status', v_media_resp.status);
    END IF;

    v_media_json := v_media_resp.content::jsonb;

    FOR v_post IN
        SELECT * FROM jsonb_array_elements(COALESCE(v_media_json->'data', '[]'::jsonb))
    LOOP
        v_posts_count := v_posts_count + 1;
        v_total_likes := v_total_likes + COALESCE((v_post->>'like_count')::NUMERIC, 0);
        v_total_comments := v_total_comments + COALESCE((v_post->>'comments_count')::NUMERIC, 0);
    END LOOP;

    IF v_posts_count > 0 THEN
        v_avg_likes := v_total_likes / v_posts_count;
        v_avg_comments := v_total_comments / v_posts_count;
    END IF;

    IF v_followers > 0 THEN
        v_engagement_rate := ((v_avg_likes + v_avg_comments) / v_followers) * 100;
    END IF;

    -- Update influencer_profiles summary fields (for requirements checks, etc.)
    UPDATE influencer_profiles
    SET instagram_username = COALESCE(v_username, instagram_username),
        instagram_url = CASE WHEN v_username IS NOT NULL AND length(v_username) > 0 THEN 'https://instagram.com/' || v_username ELSE instagram_url END,
        followers_count = v_followers,
        engagement_rate = ROUND(v_engagement_rate::numeric, 2),
        description = COALESCE(NULLIF(v_biography, ''), description),
        last_stats_update = v_recorded_at
    WHERE id = v_profile.id;

    -- Insert snapshot for clients
    INSERT INTO instagram_stats (
        influencer_profile_id,
        followers_count,
        following_count,
        posts_count,
        avg_likes,
        avg_comments,
        engagement_rate,
        recorded_at
    ) VALUES (
        v_profile.id,
        v_followers,
        v_following,
        v_media_count,
        ROUND(v_avg_likes::numeric, 2),
        ROUND(v_avg_comments::numeric, 2),
        ROUND(v_engagement_rate::numeric, 2),
        v_recorded_at
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'influencer_profile_id', v_profile.id,
        'followers_count', v_followers,
        'following_count', v_following,
        'posts_count', v_media_count,
        'avg_likes', ROUND(v_avg_likes::numeric, 2),
        'avg_comments', ROUND(v_avg_comments::numeric, 2),
        'engagement_rate', ROUND(v_engagement_rate::numeric, 2),
        'recorded_at', v_recorded_at
    );
END;
$$;

COMMENT ON FUNCTION refresh_instagram_stats_for_user(UUID) IS 'Refresh Instagram stats server-side and store a snapshot in instagram_stats. Returns computed values.';
