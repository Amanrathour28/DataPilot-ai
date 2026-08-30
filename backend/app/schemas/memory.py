from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class MemoryCreate(BaseModel):
    workspace_id: Optional[str] = None
    category: str = "PREFERENCE"  # PROFILE, PREFERENCE, INTEREST, GOAL, WORK_CONTEXT
    content: str
    confidence: float = 1.0
    source: Optional[str] = "manual"


class MemoryUpdate(BaseModel):
    category: Optional[str] = None
    content: Optional[str] = None
    confidence: Optional[float] = None
    is_active: Optional[bool] = None


class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: Optional[str] = None
    category: str
    content: str
    confidence: float
    is_active: bool
    source: Optional[str] = None
    created_at: datetime
    updated_at: datetime
