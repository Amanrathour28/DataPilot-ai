"""DataPilot AI — FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import engine, Base, _is_sqlite

# Import models so SQLAlchemy registers them on the metadata
import app.db.models  # noqa: F401

from app.api.routes import auth, workspaces, datasets, investigations, documents, memories, analytics

setup_logging()
logger = logging.getLogger("datapilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Ensure upload directory exists
    try:
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.warning(f"Could not create upload directory: {e}")

    logger.info(f"DataPilot AI starting — env={settings.app_env}")

    # In Postgres, enable pgvector extension if not already present
    if not _is_sqlite:
        try:
            from sqlalchemy import text
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            logger.info("pgvector extension verified/enabled")
        except Exception as e:
            logger.warning(f"Could not enable pgvector extension: {e}")

    # Auto-create tables if they don't exist (gracefully retry on query if cold starting)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Ensure newly added columns exist in tables (Postgres auto-migration)
            if not _is_sqlite:
                from sqlalchemy import text
                migrations = [
                    "DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT c.relname FROM pg_class c WHERE c.relkind = 'S' AND c.relname LIKE '%investigation_events%' LOOP EXECUTE 'SELECT setval(' || quote_literal(r.relname) || ', 1000, true)'; END LOOP; END $$;",
                    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT;",
                    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS error_message TEXT;",
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
                    "ALTER TABLE investigation_tasks ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;",
                    "SELECT setval(pg_get_serial_sequence('investigation_events', 'seq'), COALESCE((SELECT MAX(seq) FROM investigation_events), 1) + 100, true);",
                ]
                for stmt in migrations:
                    try:
                        await conn.execute(text(stmt))
                    except Exception as col_err:
                        logger.warning(f"Column migration skipped: {col_err}")
            else:
                from sqlalchemy import text
                sqlite_migrations = [
                    "ALTER TABLE datasets ADD COLUMN description TEXT;",
                    "ALTER TABLE datasets ADD COLUMN is_deleted BOOLEAN DEFAULT 0;",
                    "ALTER TABLE datasets ADD COLUMN error_message TEXT;",
                    "ALTER TABLE investigations ADD COLUMN parent_id VARCHAR(36);",
                    "ALTER TABLE investigations ADD COLUMN reinvestigation_count INTEGER DEFAULT 0;",
                    "ALTER TABLE investigations ADD COLUMN confidence_breakdown JSON;",
                    "ALTER TABLE investigations ADD COLUMN applied_memories JSON;",
                    "ALTER TABLE investigations ADD COLUMN critic_reviews JSON;",
                    "ALTER TABLE investigations ADD COLUMN plan JSON;",
                    "ALTER TABLE investigations ADD COLUMN evidence_ledger JSON;",
                    "ALTER TABLE investigations ADD COLUMN root_causes JSON;",
                    "ALTER TABLE investigations ADD COLUMN agent_activity JSON;",
                    "ALTER TABLE investigations ADD COLUMN execution_id VARCHAR(36);",
                    "ALTER TABLE investigations ADD COLUMN locked_by VARCHAR(100);",
                    "ALTER TABLE investigations ADD COLUMN lock_expires_at TIMESTAMP;",
                    "ALTER TABLE investigations ADD COLUMN heartbeat_at TIMESTAMP;",
                    "ALTER TABLE investigations ADD COLUMN last_completed_stage VARCHAR(50);",
                    "ALTER TABLE investigations ADD COLUMN failure_reason TEXT;",
                    "ALTER TABLE investigations ADD COLUMN attempt_number INTEGER DEFAULT 1;",
                    "ALTER TABLE workspaces ADD COLUMN is_deleted BOOLEAN DEFAULT 0;",
                    "ALTER TABLE workspaces ADD COLUMN description TEXT;",
                    "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;",
                    "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0;",
                    "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512);",
                    "ALTER TABLE investigation_tasks ADD COLUMN step_number INTEGER;",
                    "ALTER TABLE investigation_tasks ADD COLUMN duration_ms INTEGER;",
                    "ALTER TABLE investigation_tasks ADD COLUMN execution_id VARCHAR(36);",
                    "ALTER TABLE investigation_tasks ADD COLUMN started_at TIMESTAMP;",
                    "ALTER TABLE investigation_tasks ADD COLUMN completed_at TIMESTAMP;",
                    "ALTER TABLE investigation_tasks ADD COLUMN error TEXT;",
                    "ALTER TABLE investigation_tasks ADD COLUMN retry_count INTEGER DEFAULT 0;",
                    "ALTER TABLE investigation_tasks ADD COLUMN max_retries INTEGER DEFAULT 2;",
                    "ALTER TABLE investigation_tasks ADD COLUMN next_retry_at TIMESTAMP;",
                    "ALTER TABLE agent_runs ADD COLUMN agent_role VARCHAR(64);",
                    "ALTER TABLE agent_runs ADD COLUMN error_message TEXT;",
                    "ALTER TABLE agent_runs ADD COLUMN duration_ms INTEGER;",
                    "ALTER TABLE findings ADD COLUMN causal_classification VARCHAR(64);",
                    "ALTER TABLE hypotheses ADD COLUMN causal_classification VARCHAR(64);",
                    "ALTER TABLE hypotheses ADD COLUMN statistical_results JSON;",
                    "ALTER TABLE hypotheses ADD COLUMN details JSON;",
                ]
                for stmt in sqlite_migrations:
                    try:
                        await conn.execute(text(stmt))
                    except Exception:
                        pass

        logger.info("Database tables and columns verified/synchronized")
    except Exception as e:
        logger.warning(f"Database initialization warning on startup (will connect on query): {e}")

    # NOTE: On Vercel serverless, we do NOT launch a background worker loop here.
    # asyncio.create_task() has no persistent event loop on serverless and will crash.
    # Worker execution is handled exclusively by the /cron-worker endpoint (Vercel Cron).
    import os
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        logger.info("Serverless environment detected — skipping background worker loop (cron handles execution).")
    else:
        import asyncio
        from app.worker import run_worker_loop
        worker_loop_task = asyncio.create_task(run_worker_loop(poll_interval=3.0))
        logger.info("Local dev: background worker loop launched.")

    yield

    # Shutdown
    import os
    try:
        if not (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")):
            worker_loop_task.cancel()
    except Exception:
        pass
    try:
        await engine.dispose()
    except Exception:
        pass
    logger.info("DataPilot AI shutting down")


app = FastAPI(
    title="DataPilot AI",
    description="Autonomous Multi-Agent Data Investigation Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handlers ─────────────────────────────────────────────────
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc) if (settings.debug or settings.app_env != "production") else "An internal server error occurred. Please try again later."},
    )


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


# ── Health & Schema Check ────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "version": "0.1.0"}


@app.get("/api/v1/system/sync-schema", tags=["health"])
async def sync_schema_endpoint():
    """Endpoint to explicitly verify and migrate all database columns."""
    from sqlalchemy import text
    results = {}
    migrations = [
        "DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT c.relname FROM pg_class c WHERE c.relkind = 'S' AND c.relname LIKE '%investigation_events%' LOOP EXECUTE 'SELECT setval(' || quote_literal(r.relname) || ', 1000, true)'; END LOOP; END $$;",
        "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS error_message TEXT;",
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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);",
    ]
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            for stmt in migrations:
                try:
                    await conn.execute(text(stmt))
                    results[stmt[:30]] = "OK"
                except Exception as ex:
                    results[stmt[:30]] = str(ex)
        return {"status": "success", "results": results}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
