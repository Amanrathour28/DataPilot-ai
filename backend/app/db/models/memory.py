import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import String, DateTime, ForeignKey, Text, Float, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MemoryCategory(str, enum.Enum):
    PROFILE = "PROFILE"
    PREFERENCE = "PREFERENCE"
    INTEREST = "INTEREST"
    GOAL = "GOAL"
    WORK_CONTEXT = "WORK_CONTEXT"


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[MemoryCategory] = mapped_column(
        String(32), default=MemoryCategory.PREFERENCE.value, nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)  # e.g., "manual", "investigation_extract"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Memory id={self.id} category={self.category} active={self.is_active}>"
