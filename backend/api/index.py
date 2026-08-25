"""Vercel Serverless entrypoint for FastAPI backend."""

import sys
from pathlib import Path

# Add backend directory and parent directories to sys.path
api_dir = Path(__file__).resolve().parent
backend_dir = api_dir.parent
root_dir = backend_dir.parent

for p in [backend_dir, root_dir, root_dir / "backend"]:
    if str(p) not in sys.path and p.exists():
        sys.path.insert(0, str(p))

from app.main import app  # noqa: E402

__all__ = ["app"]
