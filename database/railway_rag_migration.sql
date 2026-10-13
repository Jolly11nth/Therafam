-- Therafam Railway RAG storage. Run against the Railway PostgreSQL service.
-- Requires a Railway PostgreSQL instance that supports the pgvector extension.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS therafam_knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS therafam_knowledge_source_hash_idx
    ON therafam_knowledge_chunks(source_hash);
