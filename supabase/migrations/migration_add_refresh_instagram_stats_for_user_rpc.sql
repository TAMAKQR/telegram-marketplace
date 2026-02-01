-- Migration: add missing RPC used by the frontend
--
-- Frontend calls: rpc('refresh_instagram_stats_for_user', { p_user_id })
-- Some DB instances don't have this function, causing 404 (Not Found) from PostgREST.
--
-- This is a lightweight compatibility shim. It returns { ok: true }.

CREATE OR REPLACE FUNCTION public.refresh_instagram_stats_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_instagram_stats_for_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_instagram_stats_for_user(uuid) TO authenticated;
