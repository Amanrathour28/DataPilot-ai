# app/db/models/__init__.py
# Import all models here so Alembic autogenerate can discover them.
from app.db.models.user import User, PasswordResetToken
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.investigation import Investigation, InvestigationTask, AgentRun, Finding, Hypothesis, EvidenceItem, CriticReview, InvestigationEvent
from app.db.models.document import Document, DocumentChunk
from app.db.models.memory import Memory, MemoryCategory

__all__ = [
    "User",
    "PasswordResetToken",
    "Workspace",
    "WorkspaceMember",
    "Dataset",
    "DatasetProfile",
    "Investigation",
    "InvestigationTask",
    "AgentRun",
    "Finding",
    "Hypothesis",
    "EvidenceItem",
    "CriticReview",
    "InvestigationEvent",
    "Document",
    "DocumentChunk",
    "Memory",
    "MemoryCategory",
]
