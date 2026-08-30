import uuid
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.organization import Organization, OrganizationMember, OrganizationRole
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
from app.db.models.investigation import Investigation, InvestigationMember
from app.db.models.dataset import Dataset
from app.db.models.document import Document
from app.db.models.collaboration import AuditLog, Notification
from app.core.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None, description="Auth token for SSE streaming"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that validates the JWT from Bearer header or query parameter and returns the current user.

    Raises 401 if the token is missing, invalid, or the user does not exist.
    """
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decode_access_token(raw_token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


ROLE_HIERARCHY = {
    "VIEWER": 1,
    "MEMBER": 2,
    "REVIEWER": 3,
    "EDITOR": 3,
    "ADMIN": 4,
    "OWNER": 5,
}


async def assert_org_access(
    org_id: str,
    user: User,
    db: AsyncSession,
    min_role: str = "VIEWER"
) -> OrganizationMember:
    """Validates that the user is an active member of the organization with at least min_role."""
    mem_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == "ACTIVE",
        )
    )
    member = mem_res.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not a member of this organization."
        )

    user_level = ROLE_HIERARCHY.get(str(member.role).upper(), 1)
    req_level = ROLE_HIERARCHY.get(min_role.upper(), 1)
    if user_level < req_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Requires at least {min_role} role in this organization."
        )

    return member


async def assert_workspace_access(
    workspace_id: str,
    user: User,
    db: AsyncSession,
    min_role: str = "VIEWER"
) -> Workspace:
    """Validates that the workspace exists and the user has access via workspace or org membership."""
    ws_res = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.is_deleted == False,
        )
    )
    workspace = ws_res.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    # Workspace Owner has full access
    if workspace.owner_id == user.id:
        return workspace

    req_level = ROLE_HIERARCHY.get(min_role.upper(), 1)

    # Check direct workspace membership
    wm_res = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    wm = wm_res.scalar_one_or_none()
    if wm:
        user_level = ROLE_HIERARCHY.get(str(wm.role).upper(), 1)
        if user_level >= req_level:
            return workspace

    # Check parent organization role (OWNER/ADMIN inherits workspace access)
    if workspace.organization_id:
        om_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == workspace.organization_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.status == "ACTIVE",
            )
        )
        om = om_res.scalar_one_or_none()
        if om:
            om_level = ROLE_HIERARCHY.get(str(om.role).upper(), 1)
            if om_level >= 4 or om_level >= req_level:
                return workspace

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not have permission to access this workspace."
    )


async def assert_investigation_access(
    investigation_id: str,
    user: User,
    db: AsyncSession,
    min_role: str = "VIEWER"
) -> Investigation:
    """Validates that the investigation exists and the user is authorized based on visibility and role."""
    inv_res = await db.execute(
        select(Investigation).where(
            Investigation.id == investigation_id,
            Investigation.is_deleted == False,
        )
    )
    investigation = inv_res.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    # Creator has full owner access
    if investigation.created_by == user.id:
        return investigation

    req_level = ROLE_HIERARCHY.get(min_role.upper(), 1)

    # 1. Direct investigation collaborator check
    im_res = await db.execute(
        select(InvestigationMember).where(
            InvestigationMember.investigation_id == investigation_id,
            InvestigationMember.user_id == user.id,
        )
    )
    im = im_res.scalar_one_or_none()
    if im:
        user_level = ROLE_HIERARCHY.get(str(im.role).upper(), 1)
        if user_level >= req_level:
            return investigation
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires at least {min_role} role on this investigation."
            )

    # 2. If visibility is PRIVATE and user is not an explicit collaborator or creator -> block
    if investigation.visibility == "PRIVATE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: This investigation is private."
        )

    # 3. For WORKSPACE or SHARED visibility, verify user has workspace access with min_role
    if investigation.visibility in ("WORKSPACE", "SHARED"):
        try:
            await assert_workspace_access(investigation.workspace_id, user, db, min_role=min_role)
            return investigation
        except HTTPException:
            pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not have permission to access this investigation."
    )


async def assert_dataset_access(
    dataset_id: str,
    user: User,
    db: AsyncSession
) -> Dataset:
    """Validates that dataset exists and user has authorized workspace access."""
    ds_res = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
        )
    )
    dataset = ds_res.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    await assert_workspace_access(dataset.workspace_id, user, db)
    return dataset


async def assert_document_access(
    document_id: str,
    user: User,
    db: AsyncSession
) -> Document:
    """Validates that document exists and user has authorized workspace access."""
    doc_res = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.is_deleted == False,
        )
    )
    document = doc_res.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    await assert_workspace_access(document.workspace_id, user, db)
    return document


async def log_audit_event(
    db: AsyncSession,
    organization_id: str,
    user: Optional[User],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
    workspace_id: Optional[str] = None,
) -> AuditLog:
    """Records an audit log entry for organization compliance."""
    log = AuditLog(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        workspace_id=workspace_id,
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        user_name=user.name if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=metadata_json or {},
    )
    db.add(log)
    await db.flush()
    return log


async def create_notification(
    db: AsyncSession,
    user_id: str,
    organization_id: Optional[str],
    type: str,
    title: str,
    message: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
) -> Notification:
    """Dispatches an in-app notification to a user."""
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        organization_id=organization_id,
        type=type,
        title=title,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(notif)
    await db.flush()
    return notif

