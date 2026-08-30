from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    default_workspace_name: Optional[str] = "General"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    logo_url: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    created_by: Optional[str] = None
    user_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    name: str
    email: str
    role: str
    status: str
    joined_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(OWNER|ADMIN|MEMBER|VIEWER)$")


class OrganizationInvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field("MEMBER", pattern="^(ADMIN|MEMBER|VIEWER)$")
    workspace_id: Optional[str] = None


class OrganizationInvitationResponse(BaseModel):
    id: str
    organization_id: str
    organization_name: Optional[str] = None
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    email: str
    role: str
    token: str
    invited_by_name: Optional[str] = None
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AcceptInvitationRequest(BaseModel):
    token: str
