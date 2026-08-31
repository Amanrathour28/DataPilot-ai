from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

import os as _os

# SQLite doesn't support pool parameters
_is_sqlite = settings.async_database_url.startswith("sqlite")
_is_serverless = bool(_os.getenv("VERCEL") or _os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

_engine_kwargs = {
    "echo": settings.debug,
}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
elif _is_serverless:
    # Vercel serverless: use NullPool — no persistent connections between invocations
    from sqlalchemy.pool import NullPool
    _engine_kwargs["poolclass"] = NullPool
    _engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
    }
else:
    _engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {
            "statement_cache_size": 0,
        },
    })

engine = create_async_engine(settings.async_database_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


_schema_initialized = False


async def ensure_schema_initialized():
    """Idempotently creates all database tables and applies migrations."""
    global _schema_initialized
    if _schema_initialized:
        return

    import app.db.models  # Ensure all models are registered on metadata
    from sqlalchemy import text

    # Step 1: Create all tables in an isolated transaction
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        import logging
        logging.getLogger("datapilot.db").warning(f"Metadata create_all note: {e}")

    # Step 2: In PostgreSQL, enable vector extension and migrate columns
    if not _is_sqlite:
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception:
            pass

        postgres_migrations = [
            "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS error_message TEXT;",
            "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS raw_data TEXT;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS parent_id VARCHAR(36);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS reinvestigation_count INTEGER DEFAULT 0;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS confidence_breakdown JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS applied_memories JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS critic_reviews JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS plan JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS evidence_ledger JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS root_causes JSON;",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS step_number INTEGER;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS duration_ms INTEGER;",
            "ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_role VARCHAR(64);",
            "ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS error_message TEXT;",
            "ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;",
            "ALTER TABLE findings ADD COLUMN IF NOT EXISTS causal_classification VARCHAR(64);",
            "ALTER TABLE hypotheses ADD COLUMN IF NOT EXISTS causal_classification VARCHAR(64);",
            "ALTER TABLE hypotheses ADD COLUMN IF NOT EXISTS statistical_results JSON;",
            "ALTER TABLE hypotheses ADD COLUMN IF NOT EXISTS details JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS agent_activity JSON;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS execution_id VARCHAR(36);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS locked_by VARCHAR(100);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS last_completed_stage VARCHAR(50);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS failure_reason TEXT;",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS execution_id VARCHAR(36);",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS error TEXT;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;",
            "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 2;",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(36);",
            "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) DEFAULT 'WORKSPACE';",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) DEFAULT 'email';",
            "CREATE TABLE IF NOT EXISTS password_reset_tokens (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash VARCHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, used_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE NOT NULL);",
            "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id);",
            "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);",
            "CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id);",
        ]
        for stmt in postgres_migrations:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(stmt))
            except Exception:
                pass

    _schema_initialized = True


async def init_db():
    """Initializes database tables for all metadata models."""
    await ensure_schema_initialized()


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session, ensuring schema is initialized."""
    if not _schema_initialized:
        await ensure_schema_initialized()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
