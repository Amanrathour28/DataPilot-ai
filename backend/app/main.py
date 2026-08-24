"""DataPilot AI — FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import engine, Base

# Import models so SQLAlchemy registers them on the metadata
import app.db.models  # noqa: F401

from app.api.routes import auth, workspaces, datasets, investigations, documents, memories, analytics

setup_logging()
logger = logging.getLogger("datapilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Ensure upload directory exists
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    logger.info(f"DataPilot AI starting — env={settings.app_env}")

    # In development, auto-create tables if they don't exist.
    # In production, always use Alembic migrations instead.
    if settings.app_env == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created")

    yield

    # Shutdown
    await engine.dispose()
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handlers ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "version": "0.1.0"}
