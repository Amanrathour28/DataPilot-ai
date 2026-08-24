from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
