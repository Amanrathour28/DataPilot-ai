from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class InvestigationCreate(BaseModel):
    objective: str


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
    workspace_id: str
    parent_id: Optional[str] = None
    created_by: Optional[str] = None
    objective: str
    status: str
    confidence_score: Optional[float] = None
    summary: Optional[str] = None
    plan: Optional[List[Dict[str, Any]]] = None
    evidence_ledger: Optional[List[Dict[str, Any]]] = None
    root_causes: Optional[List[Dict[str, Any]]] = None
    confidence_breakdown: Optional[Dict[str, Any]] = None
    applied_memories: Optional[List[Dict[str, Any]]] = None
    critic_reviews: Optional[List[Dict[str, Any]]] = None
    reinvestigation_count: int = 0
    created_at: datetime
    updated_at: datetime


class InvestigationDetailResponse(InvestigationResponse):
    tasks: List[InvestigationTaskResponse] = []
    runs: List[AgentRunResponse] = []
    findings: List[FindingResponse] = []
    hypotheses: List[HypothesisResponse] = []
