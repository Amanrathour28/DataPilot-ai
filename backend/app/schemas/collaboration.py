from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class InvestigationMemberAdd(BaseModel):
    user_id: str
    role: str = Field("EDITOR", pattern="^(OWNER|EDITOR|REVIEWER|VIEWER)$")


class InvestigationMemberResponse(BaseModel):
    id: str
    investigation_id: str
    user_id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class InvestigationCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    parent_id: Optional[str] = None
    is_ai_triggered: Optional[bool] = False


class InvestigationCommentResponse(BaseModel):
    id: str
    organization_id: Optional[str] = None
    workspace_id: str
    investigation_id: str
    user_id: str
    author_name: str
    author_email: str
    author_avatar_url: Optional[str] = None
    parent_id: Optional[str] = None
    content: str
    is_ai_triggered: bool
    created_at: datetime
    updated_at: datetime
    replies: List["InvestigationCommentResponse"] = []

    class Config:
        from_attributes = True


class FindingReviewCreate(BaseModel):
    finding_id: Optional[str] = None
    root_cause_index: Optional[int] = None
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    reviewer_role_title: Optional[str] = None
    notes: Optional[str] = None


class FindingReviewResponse(BaseModel):
    id: str
    investigation_id: str
    finding_id: Optional[str] = None
    root_cause_index: Optional[int] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_role_title: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    type: str
    title: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: str
    organization_id: str
    workspace_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
