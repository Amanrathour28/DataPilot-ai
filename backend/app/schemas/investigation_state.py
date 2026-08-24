from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# Causal Classification Hierarchy
CausalStrength = Literal[
    "OBSERVATION",
    "CORRELATION",
    "STRONG_ASSOCIATION",
    "LIKELY_CONTRIBUTING_FACTOR",
    "CAUSAL_EVIDENCE",
    "INSUFFICIENT_EVIDENCE"
]

HypothesisStatus = Literal[
    "PROPOSED",
    "TESTING",
    "SUPPORTED",
    "PARTIALLY_SUPPORTED",
    "REJECTED",
    "INSUFFICIENT_EVIDENCE"
]

InvestigationLifecycle = Literal[
    "PLANNING",
    "ANALYZING",
    "TESTING",
    "RETRIEVING",
    "VERIFYING",
    "REPORTING",
    "REINVESTIGATING",
    "COMPLETED",
    "FAILED",
    "PAUSED",
    "CANCELLED"
]


class StatisticalMetric(BaseModel):
    test_name: str
    statistic: float
    p_value: Optional[float] = None
    effect_size: Optional[float] = None
    effect_size_type: Optional[str] = None  # e.g., "Cohen's d", "Cramer's V"
    confidence_interval: Optional[List[float]] = None
    interpretation: str
    sample_sizes: Optional[Dict[str, int]] = None


class DocumentCitation(BaseModel):
    document_id: str
    document_name: str
    chunk_id: Optional[str] = None
    section: Optional[str] = None
    excerpt: str
    relevance_score: float


class EvidenceItemSchema(BaseModel):
    evidence_id: str
    claim: str
    source_type: Literal["dataset", "statistical", "document", "calculation"]
    source_id: Optional[str] = None
    source_name: str
    analysis_type: Optional[str] = None  # e.g., "sql", "python", "scipy", "rag_vector"
    query_or_method: Optional[str] = None
    result_summary: str
    statistical_metrics: Optional[StatisticalMetric] = None
    document_citation: Optional[DocumentCitation] = None
    causal_classification: CausalStrength = "CORRELATION"
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    supports_claim: bool = True
    created_by_agent: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class HypothesisSchema(BaseModel):
    hypothesis_id: str
    title: str
    statement: str
    category: Optional[str] = "business_driver"
    variables: List[str] = Field(default_factory=list)
    expected_relationship: Optional[str] = None
    rationale: Optional[str] = None
    status: HypothesisStatus = "PROPOSED"
    evidence_ids: List[str] = Field(default_factory=list)
    statistical_results: Optional[Dict[str, Any]] = None
    confidence_score: float = 0.5
    causal_classification: CausalStrength = "CORRELATION"
    critic_notes: Optional[str] = None


class InvestigationPlanStep(BaseModel):
    step_id: str
    step_number: int
    name: str
    objective: str
    assigned_agent: str
    status: Literal["PENDING", "RUNNING", "COMPLETED", "FAILED", "SKIPPED", "REINVESTIGATING"] = "PENDING"
    estimated_duration_s: Optional[int] = 5
    actual_duration_ms: Optional[int] = None
    depends_on: List[str] = Field(default_factory=list)
    produced_evidence_ids: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None


class CriticReviewSchema(BaseModel):
    review_id: str
    round_number: int
    verdict: Literal["PASS", "REINVESTIGATE", "REQUEST_MORE_EVIDENCE", "DOWNGRADE_CONFIDENCE"]
    overall_confidence_justified: bool
    issues: List[Dict[str, Any]] = Field(default_factory=list)  # { severity, claim, reason, recommended_action }
    critique_notes: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class RootCauseItem(BaseModel):
    title: str
    explanation: str
    classification: Literal[
        "PRIMARY_ROOT_CAUSE",
        "CONTRIBUTING_FACTOR",
        "CORRELATED_OBSERVATION",
        "REJECTED_HYPOTHESIS",
        "INSUFFICIENT_EVIDENCE"
    ]
    confidence_score: float
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    contradictory_evidence_ids: List[str] = Field(default_factory=list)
    statistical_summary: Optional[str] = None
    related_document_citations: List[str] = Field(default_factory=list)
    recommended_actions: List[Dict[str, Any]] = Field(default_factory=list)  # { priority, action, impact, evidence_basis }


class ConfidenceCalibrationBreakdown(BaseModel):
    statistical_evidence_score: float  # out of 35%
    data_coverage_score: float         # out of 20%
    evidence_consistency_score: float   # out of 15%
    document_context_score: float      # out of 10%
    critic_validation_score: float     # out of 10%
    contradiction_penalty: float       # out of -10%
    final_calibrated_confidence: float # 0.0 to 1.0


class MemoryAppliedMetadata(BaseModel):
    memory_id: str
    content: str
    category: str
    used_by_agents: List[str] = Field(default_factory=list)
    used_in_steps: List[str] = Field(default_factory=list)


class InvestigationState(BaseModel):
    """Centralized, serializable, immutable-friendly state of an autonomous investigation."""
    investigation_id: str
    workspace_id: str
    question: str
    parent_investigation_id: Optional[str] = None  # for replay / re-investigation tracking

    lifecycle_stage: InvestigationLifecycle = "PLANNING"
    execution_status: str = "PENDING"

    # Datasets and Documents Context
    dataset_ids: List[str] = Field(default_factory=list)
    document_ids: List[str] = Field(default_factory=list)
    dataset_schemas: Dict[str, Any] = Field(default_factory=dict)
    semantic_context: Dict[str, Any] = Field(default_factory=dict)
    dataset_relationships: List[Dict[str, Any]] = Field(default_factory=list)
    applied_memories: List[MemoryAppliedMetadata] = Field(default_factory=list)

    # Agenda & Execution Plan
    investigation_plan: List[InvestigationPlanStep] = Field(default_factory=list)
    active_step_id: Optional[str] = None

    # Hypotheses & Evidence
    hypotheses: List[HypothesisSchema] = Field(default_factory=list)
    evidence_ledger: List[EvidenceItemSchema] = Field(default_factory=list)
    findings: List[Dict[str, Any]] = Field(default_factory=list)

    # Verification & Re-investigation
    critic_reviews: List[CriticReviewSchema] = Field(default_factory=list)
    reinvestigation_count: int = 0
    max_reinvestigations: int = 2

    # Synthesis & Results
    root_causes: List[RootCauseItem] = Field(default_factory=list)
    confidence_breakdown: Optional[ConfidenceCalibrationBreakdown] = None
    overall_confidence: float = 0.0

    # Traces & Audit
    execution_trace: List[Dict[str, Any]] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    final_report: Optional[Dict[str, Any]] = None
