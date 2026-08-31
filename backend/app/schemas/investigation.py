from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class InvestigationCreate(BaseModel):
    objective: str
    workspace_id: Optional[str] = None
    organization_id: Optional[str] = None
    visibility: Optional[str] = "WORKSPACE"
    assigned_to: Optional[str] = None
    dataset_ids: Optional[List[str]] = None
    dataset_id: Optional[str] = None


class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    statement: str
    evidence: Optional[Dict[str, Any]] = None
    confidence: float
    causal_classification: Optional[str] = "CORRELATION"
    source: Optional[str] = None
    created_at: datetime


class HypothesisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    title: str
    description: str
    status: str
    confidence: Optional[float] = None
    causal_classification: Optional[str] = "CORRELATION"
    evidence_count: Optional[str] = None
    statistical_results: Optional[Dict[str, Any]] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime


class InvestigationTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    agent: str
    objective: str
    status: str
    step_number: Optional[int] = None
    duration_ms: Optional[int] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 2
    execution_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    task_id: Optional[str] = None
    agent: str
    agent_role: Optional[str] = None
    status: str
    tool_calls: Optional[Dict[str, Any]] = None
    output_summary: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: datetime


class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: Optional[str] = None
    workspace_id: str
    parent_id: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    visibility: Optional[str] = "WORKSPACE"
    objective: str
    status: str
    confidence_score: Optional[float] = None
    summary: Optional[str] = None
    plan: Optional[List[Dict[str, Any]]] = None
    evidence_ledger: Optional[List[Dict[str, Any]]] = None
    root_causes: Optional[List[Dict[str, Any]]] = None
    confidence_breakdown: Optional[Dict[str, Any]] = None
    structured_analysis: Optional[Dict[str, Any]] = None
    data_quality: Optional[Dict[str, Any]] = None
    is_deterministic: Optional[bool] = False
    applied_memories: Optional[List[Dict[str, Any]]] = None
    critic_reviews: Optional[List[Dict[str, Any]]] = None
    agent_activity: Optional[List[Dict[str, Any]]] = None
    reinvestigation_count: int = 0
    execution_id: Optional[str] = None
    locked_by: Optional[str] = None
    last_completed_stage: Optional[str] = None
    failure_reason: Optional[str] = None
    attempt_number: int = 1
    created_at: datetime
    updated_at: datetime


class InvestigationDetailResponse(InvestigationResponse):
    tasks: List[InvestigationTaskResponse] = []
    runs: List[AgentRunResponse] = []
    findings: List[FindingResponse] = []
    hypotheses: List[HypothesisResponse] = []
    collaborators: List[Dict[str, Any]] = []

