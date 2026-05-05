/**
 * Database Migration Script
 * 
 * Run this to initialize or update the database schema:
 *   node db-migrate.js
 * 
 * This creates all tables needed for the Vibe-Hub application
 * including SaaS-grade authentication tables.
 */

import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    await client.query('BEGIN');
    
    // Create extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('Extensions created');
    
    // Users table
    await client.query(`
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
    `);
    console.log('Users table created');
    
    // Legacy sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_url TEXT,
        effort_level VARCHAR(20) DEFAULT 'standard',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // SaaS User Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        device_fingerprint VARCHAR(255),
        device_info JSONB DEFAULT '{}'::jsonb,
        ip_address INET,
        ip_geo JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_reason VARCHAR(100)
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);');
    console.log('User sessions table created');
    
    // Refresh Tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        previous_token_hash VARCHAR(255),
        is_revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMPTZ,
        revoked_reason VARCHAR(100),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_at TIMESTAMPTZ
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id);');
    console.log('Refresh tokens table created');
    
    // Login Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('login', 'logout', 'refresh', 'revoke', 'expired', 'failed')),
        provider VARCHAR(50),
        device_info JSONB DEFAULT '{}'::jsonb,
        ip_address INET,
        ip_geo JSONB DEFAULT '{}'::jsonb,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit_log(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_login_audit_event ON login_audit_log(event_type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit_log(created_at DESC);');
    console.log('Login audit log table created');
    
    // Project Memory
    await client.query(`
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
    `);
    
    // Semantic Memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_name VARCHAR(255) NOT NULL,
        vector vector(1536),
        text TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Chat Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) DEFAULT 'New Chat',
        model VARCHAR(50) DEFAULT 'claude',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Chat Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // GitHub Installations
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id BIGINT UNIQUE NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        account_id BIGINT NOT NULL,
        account_type VARCHAR(50) NOT NULL,
        repository_selection VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Codespaces
    await client.query(`
      CREATE TABLE IF NOT EXISTS codespaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_url TEXT,
        status VARCHAR(50) DEFAULT 'inactive',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Org Constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_constraints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_name VARCHAR(255) NOT NULL,
        constraint_type VARCHAR(50) NOT NULL CHECK (constraint_type IN ('ci_cd', 'lint', 'security', 'deployment', 'architectural', 'compliance')),
        content JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_org_constraints_project ON org_constraints(project_name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_org_constraints_type ON org_constraints(constraint_type);');
    
    // User Preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        preference_type VARCHAR(50) NOT NULL CHECK (preference_type IN ('language', 'aesthetic', 'env', 'workflow', 'ui_theme')),
        content JSONB NOT NULL,
        allowed_languages VARCHAR(10)[] DEFAULT ARRAY['en'],
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, preference_type)
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(preference_type);');
    
    // AST Graphs
    await client.query(`
      CREATE TABLE IF NOT EXISTS ast_graphs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        graph_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_name, file_path)
      );
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_ast_graphs_project ON ast_graphs(project_name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ast_graphs_file ON ast_graphs(file_path);');
    
    // Audit Logs
    await client.query(`
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
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);');
    console.log('All tables created successfully');
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
