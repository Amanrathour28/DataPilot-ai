import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, BigInteger, Text, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DatasetStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    PROFILING = "PROFILING"
    PROFILED = "PROFILED"
    ERROR = "ERROR"


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_extension: Mapped[str] = mapped_column(String(16), nullable=False)
    row_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    column_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[DatasetStatus] = mapped_column(
        String(20), default=DatasetStatus.UPLOADED.value, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Dataset id={self.id} name={self.name} status={self.status}>"


class DatasetProfile(Base):
    __tablename__ = "dataset_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # Structured profile stored as JSON for flexibility
    schema_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    column_profiles: Mapped[list | None] = mapped_column(JSON, nullable=True)
    quality_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sample_rows: Mapped[list | None] = mapped_column(JSON, nullable=True)
    profiled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<DatasetProfile dataset_id={self.dataset_id}>"


class DatasetRelationship(Base):
    __tablename__ = "dataset_relationships"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    source_dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    source_column: Mapped[str] = mapped_column(String(255), nullable=False)
    target_dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    target_column: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_type: Mapped[str] = mapped_column(
        String(50), default="MANY_TO_ONE", nullable=False  # ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE
    )
    confidence_score: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)
    value_overlap_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_user_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<DatasetRelationship {self.source_column} -> {self.target_column} ({self.confidence_score})>"


class SemanticDatasetMetadata(Base):
    __tablename__ = "semantic_dataset_metadata"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    business_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entities: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["customer", "order", "product"]
    dimensions: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["region", "channel", "plan_type"]
    metrics: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{"name": "revenue", "formula": "SUM(amount)"}]
    time_columns: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["created_at", "order_date"]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<SemanticDatasetMetadata dataset_id={self.dataset_id}>"
