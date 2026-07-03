CREATE TABLE IF NOT EXISTS swarm_tasks (
    id UUID PRIMARY KEY,
    intent_type VARCHAR,
    status VARCHAR,
    contract_schema JSONB,
    retry_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS swarm_tasks_contract_schema_idx ON swarm_tasks USING GIN (contract_schema);

CREATE TABLE IF NOT EXISTS solutions_ledger (
    id UUID PRIMARY KEY,
    task_id UUID REFERENCES swarm_tasks(id),
    error_type VARCHAR,
    minified_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_telemetry (
    id UUID PRIMARY KEY,
    provider VARCHAR,
    rate_limit_hits INT DEFAULT 0
);
