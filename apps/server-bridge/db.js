import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // BUG #12 FIX: rejectUnauthorized: false disables TLS certificate verification
  // entirely, leaving the connection vulnerable to MITM attacks in production.
  // Correct fix: enable verification and optionally supply a provider CA cert
  // via DATABASE_SSL_CA (base64-encoded PEM from your Neon/Render dashboard).
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

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
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
    `);
    console.log('[DB] Tables initialized successfully.');
  } catch (err) {
    if (retries > 0) {
      console.warn(`[DB] Initialization failed: ${err.message}. Retrying in 5s... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initDB(retries - 1);
    }
    console.error('[DB] Critical Failure: Could not initialize database after multiple attempts.');
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

export default pool;
