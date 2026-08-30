# app/db/models/__init__.py
# Import all models here so Alembic autogenerate and Base.metadata can discover them.
from app.db.models.user import User, PasswordResetToken
from app.db.models.organization import Organization, OrganizationMember, OrganizationInvitation, OrganizationRole
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.investigation import (
    Investigation,
    InvestigationTask,
    AgentRun,
    Finding,
    Hypothesis,
    EvidenceItem,
    CriticReview,
    InvestigationEvent,
    InvestigationMember,
    InvestigationComment,
    FindingReview,
)
from app.db.models.collaboration import Notification, AuditLog
from app.db.models.document import Document, DocumentChunk
from app.db.models.memory import Memory, MemoryCategory

__all__ = [
    "User",
    "PasswordResetToken",
    "Organization",
    "OrganizationMember",
    "OrganizationInvitation",
    "OrganizationRole",
    "Workspace",
    "WorkspaceMember",
    "WorkspaceMemberRole",
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
    "InvestigationMember",
    "InvestigationComment",
    "FindingReview",
    "Notification",
    "AuditLog",
    "Document",
    "DocumentChunk",
    "Memory",
    "MemoryCategory",
]
