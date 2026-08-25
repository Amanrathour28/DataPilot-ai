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


async def init_db():
    """Initializes database tables for all metadata models."""
    import app.db.models  # Ensure models imported
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
