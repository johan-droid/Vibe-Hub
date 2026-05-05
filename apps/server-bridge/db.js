import pg from 'pg';

const SSL_MODES_WITH_CURRENT_VERIFY_FULL_BEHAVIOR = new Set(['prefer', 'require', 'verify-ca']);

export function normalizeDatabaseUrl(connectionString = process.env.DATABASE_URL, env = process.env) {
  if (!connectionString || env.NODE_ENV !== 'production') return connectionString;

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
    const desiredSslMode = env.DATABASE_SSL_MODE || 'verify-full';

    if (!sslMode || SSL_MODES_WITH_CURRENT_VERIFY_FULL_BEHAVIOR.has(sslMode)) {
      url.searchParams.set('sslmode', desiredSslMode);
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

const pool = new pg.Pool({
  connectionString: normalizeDatabaseUrl(),
  ssl: process.env.NODE_ENV === 'production'
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_SSL_CA && {
          ca: Buffer.from(process.env.DATABASE_SSL_CA, 'base64').toString('utf-8'),
        }),
      }
    : false,
  max: Number.parseInt(process.env.PG_POOL_MAX || '10', 10),
  min: Number.parseInt(process.env.PG_POOL_MIN || '0', 10),
  idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '2000', 10),
});

pool.on('error', () => {
  // Unexpected error on idle client
});

/**
 * Initialize database tables with exponential backoff retry
 */
export async function initDB(retries = 5) {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        avatar_url TEXT,
        provider VARCHAR(50) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ DEFAULT NOW()
      );

      -- LEGACY: Old sessions table (renamed to avoid conflict)
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_url TEXT,
        effort_level VARCHAR(20) DEFAULT 'standard',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- SAAS-GRADE: User Sessions with device tracking
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL, -- Hashed session identifier
        device_fingerprint VARCHAR(255), -- Browser/device fingerprint
        device_info JSONB DEFAULT '{}'::jsonb, -- { browser, os, device, userAgent }
        ip_address INET,
        ip_geo JSONB DEFAULT '{}'::jsonb, -- { country, city, region }
        is_active BOOLEAN DEFAULT true,
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_reason VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

      -- SAAS-GRADE: Refresh Tokens with rotation
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed refresh token
        previous_token_hash VARCHAR(255), -- For detecting token reuse (rotation detection)
        is_revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMPTZ,
        revoked_reason VARCHAR(100),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_at TIMESTAMPTZ -- When the token was consumed
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id);

      -- SAAS-GRADE: Login Audit Log
      CREATE TABLE IF NOT EXISTS login_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('login', 'logout', 'refresh', 'revoke', 'expired', 'failed')),
        provider VARCHAR(50), -- google, github
        device_info JSONB DEFAULT '{}'::jsonb,
        ip_address INET,
        ip_geo JSONB DEFAULT '{}'::jsonb,
        details JSONB DEFAULT '{}'::jsonb, -- Additional event details
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_audit_event ON login_audit_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit_log(created_at DESC);

      CREATE TABLE IF NOT EXISTS project_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_name VARCHAR(255) NOT NULL,
        user_memory TEXT DEFAULT '',
        brain_journal JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, project_name)
      );

      CREATE TABLE IF NOT EXISTS semantic_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768), -- Gemini text-embedding-004 is 768 dims
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) DEFAULT 'New Chat',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        thoughts JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS github_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id BIGINT UNIQUE NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        account_id BIGINT NOT NULL,
        account_type VARCHAR(50), -- 'User' or 'Organization'
        repository_selection VARCHAR(50), -- 'all' or 'selected'
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS codespaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_owner VARCHAR(255) NOT NULL,
        repo_name VARCHAR(255) NOT NULL,
        ref VARCHAR(255),
        status VARCHAR(50),
        machine_type VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- V6: Organizational Constraints (rigid rules: CI/CD, lint, security, deployment)
      CREATE TABLE IF NOT EXISTS org_constraints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_name VARCHAR(255) NOT NULL,
        constraint_type VARCHAR(50) NOT NULL CHECK (constraint_type IN ('ci_cd', 'lint', 'security', 'deployment', 'architectural', 'compliance')),
        content JSONB NOT NULL,
        priority INT DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_org_constraints_project ON org_constraints(project_name);
      CREATE INDEX IF NOT EXISTS idx_org_constraints_type ON org_constraints(constraint_type);

      -- V6: User Preferences (flexible: language, aesthetic, env - restricted to EN/HI/OR)
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        preference_type VARCHAR(50) NOT NULL CHECK (preference_type IN ('language', 'aesthetic', 'env', 'workflow', 'ui_theme')),
        content JSONB NOT NULL,
        allowed_languages VARCHAR(10)[] DEFAULT ARRAY['en'],
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, preference_type)
      );

      CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(preference_type);

      -- V6: AST Graph Storage for structural memory
      CREATE TABLE IF NOT EXISTS ast_graphs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        graph_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_name, file_path)
      );

      CREATE INDEX IF NOT EXISTS idx_ast_graphs_project ON ast_graphs(project_name);
      CREATE INDEX IF NOT EXISTS idx_ast_graphs_file ON ast_graphs(file_path);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        resource_type VARCHAR(80) NOT NULL DEFAULT 'vfs',
        resource_id TEXT,
        user_id TEXT,
        request_id TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initDB(retries - 1);
    }
    throw err;
  }
}

/**
 * Find or create user from OAuth data
 */
export async function upsertUser({ email, name, avatarUrl, provider, providerId }) {
  const result = await pool.query(
    `INSERT INTO users (email, name, avatar_url, provider, provider_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       avatar_url = EXCLUDED.avatar_url,
       last_login = NOW()
     RETURNING *`,
    [email, name, avatarUrl, provider, providerId]
  );
  return result.rows[0];
}

export async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * SAAS-GRADE: User Session Management Helpers
 */

export async function createUserSession({ userId, sessionToken, deviceFingerprint, deviceInfo, ipAddress, ipGeo, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO user_sessions (user_id, session_token, device_fingerprint, device_info, ip_address, ip_geo, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, sessionToken, deviceFingerprint, JSON.stringify(deviceInfo || {}), ipAddress, JSON.stringify(ipGeo || {}), expiresAt]
  );
  return result.rows[0];
}

export async function getUserSessionByToken(sessionToken) {
  const result = await pool.query(
    `SELECT s.*, u.email, u.name, u.avatar_url, u.provider, u.provider_id
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionToken]
  );
  return result.rows[0] || null;
}

export async function updateSessionActivity(sessionId) {
  await pool.query(
    'UPDATE user_sessions SET last_activity_at = NOW() WHERE id = $1',
    [sessionId]
  );
}

export async function revokeUserSession(sessionId, userId, reason) {
  await pool.query(
    `UPDATE user_sessions
     SET is_active = false, revoked_at = NOW(), revoked_reason = $1
     WHERE id = $2 AND user_id = $3`,
    [reason, sessionId, userId]
  );
}

export async function revokeAllUserSessions(userId, exceptSessionId = null, reason = 'logout_all') {
  await pool.query(
    `UPDATE user_sessions
     SET is_active = false, revoked_at = NOW(), revoked_reason = $1
     WHERE user_id = $2 AND is_active = true ${exceptSessionId ? 'AND id != $3' : ''}`,
    exceptSessionId ? [reason, userId, exceptSessionId] : [reason, userId]
  );
}

export async function listUserSessions(userId) {
  const result = await pool.query(
    `SELECT id, device_info, ip_geo, is_active, last_activity_at, expires_at, created_at, revoked_at, revoked_reason
     FROM user_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function countActiveUserSessions(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND is_active = true AND expires_at > NOW()',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * SAAS-GRADE: Refresh Token Helpers
 */

export async function createRefreshToken({ userId, sessionId, tokenHash, previousTokenHash = null, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, session_id, token_hash, previous_token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, sessionId, tokenHash, previousTokenHash, expiresAt]
  );
  return result.rows[0];
}

export async function getRefreshTokenByHash(tokenHash) {
  const result = await pool.query(
    `SELECT rt.*, u.email, u.name, u.avatar_url, u.provider
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

export async function revokeRefreshToken(tokenHash, reason = 'consumed') {
  await pool.query(
    `UPDATE refresh_tokens
     SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1
     WHERE token_hash = $2`,
    [reason, tokenHash]
  );
}

export async function revokeRefreshTokenFamily(sessionId, reason = 'suspicious_activity') {
  await pool.query(
    `UPDATE refresh_tokens
     SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1
     WHERE session_id = $2`,
    [reason, sessionId]
  );
}

export async function markRefreshTokenUsed(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET used_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
}

/**
 * SAAS-GRADE: Login Audit Log Helpers
 */

export async function logAuthEvent({ userId, sessionId, eventType, provider, deviceInfo, ipAddress, ipGeo, details = {} }) {
  await pool.query(
    `INSERT INTO login_audit_log (user_id, session_id, event_type, provider, device_info, ip_address, ip_geo, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, sessionId, eventType, provider, JSON.stringify(deviceInfo || {}), ipAddress, JSON.stringify(ipGeo || {}), JSON.stringify(details)]
  );
}

export async function getUserAuthHistory(userId, limit = 50) {
  const result = await pool.query(
    `SELECT event_type, provider, device_info, ip_geo, details, created_at
     FROM login_audit_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * GitHub Installation Helpers
 */
export async function upsertInstallation({ installation_id, account_name, account_id, account_type, repository_selection }) {
  const result = await pool.query(
    `INSERT INTO github_installations (installation_id, account_name, account_id, account_type, repository_selection)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (installation_id) DO UPDATE SET
       repository_selection = EXCLUDED.repository_selection,
       updated_at = NOW()
     RETURNING *`,
    [installation_id, account_name, account_id, account_type, repository_selection]
  );
  return result.rows[0];
}

/**
 * Codespaces Helpers
 */
export async function trackCodespace({ name, user_id, repo_owner, repo_name, ref, status, machine_type }) {
  const result = await pool.query(
    `INSERT INTO codespaces (name, user_id, repo_owner, repo_name, ref, status, machine_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, user_id, repo_owner, repo_name, ref, status, machine_type]
  );
  return result.rows[0];
}

/**
 * V6: Organization Constraints Helpers
 */
export async function getOrgConstraints(projectName, constraintType = null) {
  let query = `SELECT * FROM org_constraints WHERE project_name = $1 AND is_active = true`;
  let params = [projectName];
  
  if (constraintType) {
    query += ` AND constraint_type = $2`;
    params.push(constraintType);
  }
  
  query += ` ORDER BY priority DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function upsertOrgConstraint({ project_name, constraint_type, content, priority = 100 }) {
  const result = await pool.query(
    `INSERT INTO org_constraints (project_name, constraint_type, content, priority)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_name, constraint_type) DO UPDATE SET
       content = EXCLUDED.content,
       priority = EXCLUDED.priority,
       updated_at = NOW()
     RETURNING *`,
    [project_name, constraint_type, JSON.stringify(content), priority]
  );
  return result.rows[0];
}

/**
 * V6: User Preferences Helpers
 * Language restricted to: English (en), Hindi (hi), Odia (oria)
 */
const ALLOWED_LANGUAGES = ['en', 'hi', 'oria'];

function validateLanguage(lang) {
  const normalized = (lang || 'en').toLowerCase().trim();
  return ALLOWED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

export async function getUserPreferences(userId) {
  const result = await pool.query(
    `SELECT * FROM user_preferences WHERE user_id = $1`,
    [userId]
  );
  return result.rows;
}

export async function getUserPreference(userId, preferenceType) {
  const result = await pool.query(
    `SELECT * FROM user_preferences WHERE user_id = $1 AND preference_type = $2`,
    [userId, preferenceType]
  );
  return result.rows[0] || null;
}

export async function upsertUserPreference({ user_id, preference_type, content }) {
  // Enforce language restriction
  if (preference_type === 'language') {
    const requestedLang = content?.code || content?.language || 'en';
    const validatedLang = validateLanguage(requestedLang);
    content = { ...content, code: validatedLang };
    
    // If language is not allowed, reject
    if (validatedLang !== requestedLang.toLowerCase().trim()) {
      throw new Error(`Language '${requestedLang}' not allowed. Only English (en), Hindi (hi), and Odia (oria) are permitted.`);
    }
  }
  
  const result = await pool.query(
    `INSERT INTO user_preferences (user_id, preference_type, content, allowed_languages)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, preference_type) DO UPDATE SET
       content = EXCLUDED.content,
       allowed_languages = EXCLUDED.allowed_languages,
       updated_at = NOW()
     RETURNING *`,
    [user_id, preference_type, JSON.stringify(content), ALLOWED_LANGUAGES]
  );
  return result.rows[0];
}

/**
 * Chat History Helpers
 */
export async function createChatSession(userId, title = 'New Chat') {
  const result = await pool.query(
    'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
    [userId, title]
  );
  return result.rows[0];
}

export async function getChatSessions(userId) {
  const result = await pool.query(
    'SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

export async function getChatSession(sessionId, userId) {
  const result = await pool.query(
    'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

export async function addChatMessage(sessionId, role, contentStr, thoughts = []) {
  const result = await pool.query(
    'INSERT INTO chat_messages (session_id, role, content, thoughts) VALUES ($1, $2, $3, $4) RETURNING *',
    [sessionId, role, contentStr, JSON.stringify(thoughts)]
  );
  
  // Update session updated_at
  await pool.query(
    'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
    [sessionId]
  );
  
  return result.rows[0];
}

export async function getChatMessages(sessionId) {
  const result = await pool.query(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  return result.rows;
}

export default pool;
