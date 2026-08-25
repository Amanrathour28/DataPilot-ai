import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON, Float, Integer, Boolean, BigInteger, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Investigation(Base):
    __tablename__ = "investigations"
    __table_args__ = (
        Index("idx_inv_status_lock", "status", "lock_expires_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="SET NULL"), nullable=True
    )  # Tracks replay source
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False
    )  # PENDING, PLANNING, ANALYZING, TESTING, RETRIEVING, VERIFYING, REPORTING, REINVESTIGATING, COMPLETED, FAILED, PAUSED, CANCELLED
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Structured State Snapshots
    plan: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evidence_ledger: Mapped[list | None] = mapped_column(JSON, nullable=True)
    root_causes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    confidence_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    applied_memories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    critic_reviews: Mapped[list | None] = mapped_column(JSON, nullable=True)
    agent_activity: Mapped[list | None] = mapped_column(JSON, nullable=True)
    reinvestigation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Durable Execution Lease & Observability
    execution_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_completed_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Investigation id={self.id} status={self.status} execution_id={self.execution_id}>"


class InvestigationTask(Base):
    __tablename__ = "investigation_tasks"
    __table_args__ = (
        Index("idx_inv_tasks_inv_status", "investigation_id", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    agent: Mapped[str] = mapped_column(String(50), nullable=False)  # supervisor, planner, data_analyst, hypothesis_tester, rag_agent, critic, root_cause
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False
    )  # PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    step_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Task Execution & Retry Fields
    execution_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<InvestigationTask id={self.id} agent={self.agent} status={self.status}>"


class InvestigationEvent(Base):
    __tablename__ = "investigation_events"
    __table_args__ = (
        Index("idx_inv_events_inv_seq", "investigation_id", "seq"),
    )

    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, default=lambda: f"evt_{uuid.uuid4().hex[:12]}"
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    agent: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)  # STARTED, PROGRESS, COMPLETED, FAILED, STATUS_CHANGE
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<InvestigationEvent id={self.id} seq={self.seq} agent={self.agent} type={self.event_type}>"


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("investigation_tasks.id", ondelete="SET NULL"), nullable=True
    )
    agent: Mapped[str] = mapped_column(String(50), nullable=False)
    agent_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # RUNNING, COMPLETED, FAILED
    tool_calls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AgentRun id={self.id} agent={self.agent} status={self.status}>"


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # File citations, query snippets, etc.
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    causal_classification: Mapped[str] = mapped_column(String(50), default="CORRELATION", nullable=False)
    source: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Finding id={self.id} confidence={self.confidence}>"


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="PROPOSED", nullable=False
    )  # PROPOSED, TESTING, SUPPORTED, PARTIALLY_SUPPORTED, REJECTED, INSUFFICIENT_EVIDENCE
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    causal_classification: Mapped[str] = mapped_column(String(50), default="CORRELATION", nullable=False)
    evidence_count: Mapped[str | None] = mapped_column(String(128), nullable=True)
    statistical_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Hypothesis id={self.id} title={self.title[:30]} status={self.status}>"


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)  # dataset, statistical, document, calculation
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    analysis_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    query_or_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_summary: Mapped[str] = mapped_column(Text, nullable=False)
    statistical_metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    document_citation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    causal_classification: Mapped[str] = mapped_column(String(50), default="CORRELATION", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    supports_claim: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_agent: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<EvidenceItem id={self.id} claim={self.claim[:30]} source_type={self.source_type}>"


class CriticReview(Base):
    __tablename__ = "critic_reviews"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    round_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    verdict: Mapped[str] = mapped_column(String(30), nullable=False)  # PASS, REINVESTIGATE, REQUEST_MORE_EVIDENCE, DOWNGRADE_CONFIDENCE
    overall_confidence_justified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    issues: Mapped[list | None] = mapped_column(JSON, nullable=True)
    critique_notes: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<CriticReview id={self.id} verdict={self.verdict} round={self.round_number}>"
