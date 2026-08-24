# app/db/models/__init__.py
# Import all models here so Alembic autogenerate can discover them.
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.investigation import Investigation, InvestigationTask, AgentRun, Finding, Hypothesis
from app.db.models.document import Document, DocumentChunk
from app.db.models.memory import Memory, MemoryCategory

__all__ = [
    "User",
    "Workspace",
    "WorkspaceMember",
    "Dataset",
    "DatasetProfile",
    "Investigation",
    "InvestigationTask",
    "AgentRun",
    "Finding",
    "Hypothesis",
    "Document",
    "DocumentChunk",
    "Memory",
    "MemoryCategory",
]
