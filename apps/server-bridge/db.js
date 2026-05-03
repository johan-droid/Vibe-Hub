import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_SSL_CA && {
          ca: Buffer.from(process.env.DATABASE_SSL_CA, 'base64').toString('utf-8'),
        }),
      }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_url TEXT,
        effort_level VARCHAR(20) DEFAULT 'standard',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

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

export default pool;
