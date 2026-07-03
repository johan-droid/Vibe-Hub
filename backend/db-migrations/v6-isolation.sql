-- V6 Database Migration: Strict Architectural Isolation
-- =======================================================
-- Splits project_memory into org_constraints and user_preferences
-- to prevent bleeding between organizational standards and user preferences.

-- ─── 1. Create Organization Constraints Table ───────────────────────────────
-- Rigid constraints: CI/CD workflows, linting rules, deployment scripts, security policies

CREATE TABLE IF NOT EXISTS org_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(255) NOT NULL,
  constraint_type VARCHAR(50) NOT NULL CHECK (constraint_type IN ('ci_cd', 'lint', 'security', 'deployment', 'architectural', 'compliance')),
  content JSONB NOT NULL,
  priority INT DEFAULT 100, -- Higher = more important (1-1000)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_constraints_project ON org_constraints(project_name);
CREATE INDEX idx_org_constraints_type ON org_constraints(constraint_type);
CREATE INDEX idx_org_constraints_priority ON org_constraints(priority DESC);

-- ─── 2. Create User Preferences Table ─────────────────────────────────────
-- Local preferences: aesthetic choices, language settings (EN/HI/OR only), personal env configs

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type VARCHAR(50) NOT NULL CHECK (preference_type IN ('language', 'aesthetic', 'env', 'workflow', 'ui_theme')),
  content JSONB NOT NULL,
  allowed_languages VARCHAR(10)[] DEFAULT ARRAY['en'], -- Restricted to English, Hindi, Odia
  CONSTRAINT valid_language CHECK (
    allowed_languages <@ ARRAY['en', 'hi', 'oria']::varchar[]
  ),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preference_type)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_type ON user_preferences(preference_type);

-- ─── 3. Migration: Move existing data ─────────────────────────────────────
-- Note: Run this only once after deployment

-- Extract what appears to be org-level configs (CI/CD keywords, lint rules)
INSERT INTO org_constraints (project_name, constraint_type, content, priority)
SELECT 
  project_name,
  CASE 
    WHEN user_memory ILIKE '%ci%' OR user_memory ILIKE '%github actions%' THEN 'ci_cd'
    WHEN user_memory ILIKE '%eslint%' OR user_memory ILIKE '%prettier%' OR user_memory ILIKE '%lint%' THEN 'lint'
    WHEN user_memory ILIKE '%security%' OR user_memory ILIKE '%auth%' THEN 'security'
    WHEN user_memory ILIKE '%deploy%' OR user_memory ILIKE '%build%' THEN 'deployment'
    ELSE 'architectural'
  END,
  jsonb_build_object('legacy_memory', user_memory, 'migrated_from', 'project_memory'),
  100
FROM project_memory 
WHERE user_memory IS NOT NULL 
  AND (
    user_memory ILIKE '%ci%' OR 
    user_memory ILIKE '%lint%' OR 
    user_memory ILIKE '%deploy%' OR
    user_memory ILIKE '%security%' OR
    user_memory ILIKE '%workflow%'
  )
ON CONFLICT DO NOTHING;

-- ─── 4. Helper Functions ──────────────────────────────────────────────────

-- Function to enforce language restriction
CREATE OR REPLACE FUNCTION enforce_language_restriction()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if content contains non-allowed languages
  IF NEW.preference_type = 'language' THEN
    DECLARE
      requested_lang TEXT;
    BEGIN
      requested_lang := NEW.content->>'code';
      IF requested_lang IS NOT NULL AND NOT (requested_lang = ANY(NEW.allowed_languages)) THEN
        RAISE EXCEPTION 'Language % not allowed. Only English (en), Hindi (hi), and Odia (oria) are permitted.', requested_lang;
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_language_restriction ON user_preferences;
CREATE TRIGGER trg_language_restriction
  BEFORE INSERT OR UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION enforce_language_restriction();

-- ─── 5. Updated Timestamps Trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_constraints_updated ON org_constraints;
CREATE TRIGGER trg_org_constraints_updated
  BEFORE UPDATE ON org_constraints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_preferences_updated ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. Context Builder Helper View ────────────────────────────────────────
-- Pre-joins org constraints with priority ordering for context injection

CREATE OR REPLACE VIEW v_org_context AS
SELECT 
  project_name,
  jsonb_agg(
    jsonb_build_object(
      'type', constraint_type,
      'content', content,
      'priority', priority
    ) ORDER BY priority DESC
  ) as constraints
FROM org_constraints
WHERE is_active = true
GROUP BY project_name;

CREATE OR REPLACE VIEW v_user_context AS
SELECT 
  user_id,
  jsonb_object_agg(
    preference_type,
    jsonb_build_object(
      'content', content,
      'allowed_languages', allowed_languages
    )
  ) as preferences
FROM user_preferences
GROUP BY user_id;
