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

from app.api.routes import (
    auth,
    organizations,
    workspaces,
    datasets,
    investigations,
    documents,
    memories,
    analytics,
    collaboration,
)

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

    # Auto-create tables and verify schema
    try:
        from app.db.base import ensure_schema_initialized
        await ensure_schema_initialized()
        logger.info("Database tables and columns verified/synchronized")
    except Exception as e:
        logger.warning(f"Database initialization warning on startup (will connect on query): {e}")

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "User-Agent", "DNT", "Cache-Control", "X-Mx-ReqToken", "X-Requested-With", "*"],
    expose_headers=["*"],
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
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(organizations.invitations_public_router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")
app.include_router(collaboration.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


# ── Health & Schema Check ────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
@app.get("/api/v1/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "app": settings.app_name, "version": "0.1.0"}


@app.get("/api/v1/system/sync-schema", tags=["health"])
async def sync_schema_endpoint():
    """Endpoint to explicitly verify and migrate all database tables and columns."""
    try:
        from app.db.base import ensure_schema_initialized
        await ensure_schema_initialized()
        return {"status": "success", "detail": "All tables and schemas successfully synchronized."}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
