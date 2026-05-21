CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS semantic_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR DEFAULT 'default',
    tenant_id VARCHAR NOT NULL DEFAULT 'shared',
    namespace VARCHAR NOT NULL DEFAULT 'default',
    index_version VARCHAR NOT NULL DEFAULT 'live',
    file_path VARCHAR NOT NULL,
    node_id UUID,
    node_name VARCHAR,
    node_type VARCHAR,
    context_type VARCHAR NOT NULL, -- 'org_core', 'user_env', 'ast_node'
    content TEXT,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for semantic search using HNSW
CREATE INDEX IF NOT EXISTS semantic_embeddings_embedding_idx ON semantic_embeddings USING hnsw (embedding vector_l2_ops);

-- Index for V6 Isolation filtering
CREATE INDEX IF NOT EXISTS semantic_embeddings_context_type_idx ON semantic_embeddings(context_type);
CREATE INDEX IF NOT EXISTS semantic_embeddings_scope_idx ON semantic_embeddings(project_name, tenant_id, namespace, index_version);

-- Defense-in-depth tenant isolation. Application code must still pass tenant_id
-- explicitly; RLS denies relational reads/writes unless the DB session has
-- SET LOCAL app.current_tenant_id = '<tenant-id>'.
ALTER TABLE semantic_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_embeddings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS semantic_embeddings_tenant_isolation ON semantic_embeddings;
CREATE POLICY semantic_embeddings_tenant_isolation ON semantic_embeddings
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE TABLE IF NOT EXISTS semantic_index_registry (
    project_name VARCHAR NOT NULL DEFAULT 'default',
    tenant_id VARCHAR NOT NULL DEFAULT 'shared',
    namespace VARCHAR NOT NULL DEFAULT 'default',
    active_index_version VARCHAR NOT NULL DEFAULT 'live',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_name, tenant_id, namespace)
);

ALTER TABLE semantic_index_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_index_registry FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS semantic_index_registry_tenant_isolation ON semantic_index_registry;
CREATE POLICY semantic_index_registry_tenant_isolation ON semantic_index_registry
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
