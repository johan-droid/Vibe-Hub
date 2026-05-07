-- OAuth Handoff Storage Migration
-- Migrates OAuth state and handoff codes from memory to database
-- This fixes issues with multi-instance deployments and server restarts

-- ─── 1. Create OAuth States Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  return_origin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- ─── 2. Create OAuth Handoffs Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_code VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  user_data JSONB NOT NULL,
  session_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_handoffs_code ON oauth_handoffs(handoff_code);
CREATE INDEX idx_oauth_handoffs_expires ON oauth_handoffs(expires_at);
CREATE INDEX idx_oauth_handoffs_consumed ON oauth_handoffs(consumed_at);

-- ─── 3. Cleanup Job: Remove expired tokens regularly ───────────────────────
-- This can be run periodically via cron or a cleanup job
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
  DELETE FROM oauth_handoffs WHERE expires_at < NOW() AND consumed_at IS NULL;
END;
$$ LANGUAGE plpgsql;
