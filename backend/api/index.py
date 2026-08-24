"""Vercel Serverless entrypoint for FastAPI backend."""

import sys
from pathlib import Path

# Add backend root directory to sys.path so 'app' module resolves correctly
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.main import app  # noqa: E402

# Export 'app' for Vercel @vercel/python builder
__all__ = ["app"]
