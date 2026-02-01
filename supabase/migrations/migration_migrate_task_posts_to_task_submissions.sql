-- Migration: migrate legacy task_posts into task_submissions
--
-- Why:
-- The project historically had two parallel systems:
-- - task_posts (legacy)
-- - task_submissions (current)
--
-- The UI (TaskDetails/ReviewSubmission) expects task_submissions.
-- This script backfills task_submissions from task_posts so in-progress tasks
-- created via the legacy flow still show reports/metrics.
--
-- Safe to run multiple times (skips rows that already exist in task_submissions).

BEGIN;

-- Insert missing rows
INSERT INTO public.task_submissions (
  task_id,
  influencer_id,
  post_url,
  description,
  status,
  revision_comment,
  rejection_reason,
  reviewed_at,
  approved_at,
  approved_by,
  instagram_post_url,
  instagram_media_id,
  initial_metrics,
  current_metrics,
  determined_price,
  metric_deadline,
  paid_tiers,
  submitted_at,
  completed_at,
  created_at,
  updated_at
)
SELECT
  tp.task_id,
  tp.influencer_id,
  tp.post_url,
  COALESCE(tp.client_comment, '') AS description,
  CASE tp.status
    WHEN 'paid' THEN 'completed'
    WHEN 'approved' THEN 'in_progress'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'pending'
  END AS status,
  NULL::text AS revision_comment,
  CASE WHEN tp.status = 'rejected' THEN tp.client_comment ELSE NULL::text END AS rejection_reason,
  CASE WHEN tp.approved_at IS NOT NULL THEN tp.approved_at ELSE NULL::timestamptz END AS reviewed_at,
  tp.approved_at,
  NULL::uuid AS approved_by,
  tp.post_url AS instagram_post_url,
  tp.instagram_media_id,
  jsonb_build_object(
    'views', 0,
    'likes', 0,
    'comments', 0,
    'captured_at', EXTRACT(EPOCH FROM COALESCE(tp.submitted_at, tp.approved_at, NOW()))::bigint
  ) AS initial_metrics,
  jsonb_build_object(
    'views', COALESCE(tp.impressions, tp.reach, 0),
    'likes', COALESCE(tp.likes_count, 0),
    'comments', COALESCE(tp.comments_count, 0),
    'captured_at', EXTRACT(EPOCH FROM COALESCE(tp.last_metrics_update, tp.payment_date, tp.approved_at, tp.submitted_at, NOW()))::bigint
  ) AS current_metrics,
  tp.total_payment AS determined_price,
  NULL::timestamptz AS metric_deadline,
  '[]'::jsonb AS paid_tiers,
  COALESCE(tp.submitted_at, NOW()) AS submitted_at,
  tp.payment_date AS completed_at,
  COALESCE(tp.submitted_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM public.task_posts tp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.task_submissions ts
  WHERE ts.task_id = tp.task_id
    AND ts.influencer_id = tp.influencer_id
    AND ts.post_url = tp.post_url
);

COMMIT;

-- Optional: quick sanity check
-- SELECT COUNT(*) AS migrated_rows
-- FROM public.task_submissions ts
-- WHERE EXISTS (
--   SELECT 1 FROM public.task_posts tp
--   WHERE tp.task_id = ts.task_id
--     AND tp.influencer_id = ts.influencer_id
--     AND tp.post_url = ts.post_url
-- );
