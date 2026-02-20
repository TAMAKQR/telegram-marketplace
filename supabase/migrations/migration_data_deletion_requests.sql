-- Migration: Create data_deletion_requests table for Meta Platform compliance
-- This table logs all data deletion requests received from Instagram/Meta webhooks.
-- Required for Meta App Review: Data Deletion Callback compliance.

CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id BIGSERIAL PRIMARY KEY,
    instagram_user_id TEXT,
    confirmation_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by confirmation code (users check status)
CREATE INDEX IF NOT EXISTS idx_deletion_requests_code ON data_deletion_requests(confirmation_code);

-- Index for lookup by Instagram user ID
CREATE INDEX IF NOT EXISTS idx_deletion_requests_ig_user ON data_deletion_requests(instagram_user_id);

-- RLS: Only service role can access this table (webhook handler uses service_role key)
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- No public access — only service_role (Supabase Edge Functions) can read/write
-- If you need admin dashboard access, add a policy for admin users.

COMMENT ON TABLE data_deletion_requests IS 'Logs Instagram/Meta data deletion requests for compliance auditing';
COMMENT ON COLUMN data_deletion_requests.confirmation_code IS 'Unique code returned to Meta for deletion tracking';
COMMENT ON COLUMN data_deletion_requests.status IS 'pending = received, completed = data deleted, failed = error during deletion';
