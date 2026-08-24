import asyncio
import os
import sys
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import asyncpg
from app.core.config import settings

DDL_QUERIES = [
    "CREATE EXTENSION IF NOT EXISTS vector;",
    
    """
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS datasets (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        uploaded_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(1024) NOT NULL,
        file_size_bytes BIGINT NOT NULL DEFAULT 0,
        mime_type VARCHAR(128) NOT NULL,
        file_extension VARCHAR(16) NOT NULL,
        row_count INTEGER,
        column_count INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
        error_message TEXT,
        profile_summary JSONB,
        semantic_metadata JSONB,
        inferred_relationships JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        uploaded_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(512) NOT NULL,
        original_filename VARCHAR(512) NOT NULL,
        file_path VARCHAR(1024) NOT NULL,
        file_size_bytes BIGINT NOT NULL DEFAULT 0,
        mime_type VARCHAR(128) NOT NULL,
        file_extension VARCHAR(16) NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
        error_message TEXT,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS document_chunks (
        id VARCHAR(36) PRIMARY KEY,
        document_id VARCHAR(36) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        chunk_metadata JSONB,
        embedding JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS investigations (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(512) NOT NULL,
        objective TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        confidence_breakdown JSONB,
        evidence_ledger JSONB,
        evidence_audit JSONB,
        replay_history JSONB,
        dataset_ids JSONB,
        document_ids JSONB,
        root_cause_report TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS investigation_tasks (
        id VARCHAR(36) PRIMARY KEY,
        investigation_id VARCHAR(36) NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        assigned_agent VARCHAR(50) NOT NULL,
        objective TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        input_data JSONB,
        output_data JSONB,
        error_message TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS agent_runs (
        id VARCHAR(36) PRIMARY KEY,
        investigation_id VARCHAR(36) NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
        task_id VARCHAR(36) REFERENCES investigation_tasks(id) ON DELETE SET NULL,
        agent_role VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
        input_state JSONB,
        output_state JSONB,
        tool_calls JSONB,
        error_message TEXT,
        execution_time_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS hypotheses (
        id VARCHAR(36) PRIMARY KEY,
        investigation_id VARCHAR(36) NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
        title VARCHAR(512) NOT NULL,
        statement TEXT NOT NULL,
        causal_classification VARCHAR(50) NOT NULL DEFAULT 'CORRELATION',
        confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
        status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
        variables JSONB,
        evidence JSONB,
        rationale TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    
    """
    CREATE TABLE IF NOT EXISTS memories (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        rule_text TEXT NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'business_rule',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        confidence_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        metadata_context JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
]


async def init_postgres(db_url: str):
    """Run all schema initialization queries."""
    # Ensure URL is in standard postgres:// format for asyncpg
    url = db_url
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://"):]
    
    # Strip unnecessary parameters
    if "&channel_binding=require" in url:
        url = url.replace("&channel_binding=require", "")
    if "?channel_binding=require" in url:
        url = url.replace("?channel_binding=require", "")
    if "sslmode=require" not in url and "ssl=require" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}ssl=require"

    print(f"Connecting to Postgres database at: {url.split('@')[-1]}...")
    conn = await asyncpg.connect(url, statement_cache_size=0)
    
    for query in DDL_QUERIES:
        await conn.execute(query)
        
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    print("Database schema successfully initialized! Tables present:")
    for t in tables:
        print(f"  - {t['table_name']}")
        
    await conn.close()


if __name__ == "__main__":
    import sys
    target_url = sys.argv[1] if len(sys.argv) > 1 else settings.database_url
    asyncio.run(init_postgres(target_url))
