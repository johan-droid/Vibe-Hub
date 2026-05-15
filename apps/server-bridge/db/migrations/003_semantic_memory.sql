CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS semantic_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR DEFAULT 'default',
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
