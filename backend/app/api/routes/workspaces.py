import re
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:64]


async def _assert_workspace_access(
    workspace_id: str, user: User, db: AsyncSession
) -> Workspace:
    """Verify workspace exists and user is a member. Returns the workspace."""
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.is_deleted == False,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    return workspace


from app.db.models.organization import OrganizationMember
from app.api.dependencies import log_audit_event, assert_org_access


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    organization_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workspaces the current user is a member of, optionally filtered by organization."""
    query = (
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            WorkspaceMember.user_id == current_user.id,
            Workspace.is_deleted == False,
        )
    )

    if organization_id:
        query = query.where(Workspace.organization_id == organization_id)

    query = query.order_by(Workspace.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace owned by the current user within an organization."""
    target_org_id = payload.organization_id
    if target_org_id:
        await assert_org_access(target_org_id, current_user, db, min_role="MEMBER")
    else:
        # Fallback to user's active organization
        org_mem_res = await db.execute(
            select(OrganizationMember.organization_id).where(
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == "ACTIVE",
            ).limit(1)
        )
        target_org_id = org_mem_res.scalar_one_or_none()

    base_slug = slugify(payload.name)
    slug = f"{base_slug}-{current_user.id[:8]}"

    workspace = Workspace(
        name=payload.name,
        slug=slug,
        organization_id=target_org_id,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=WorkspaceMemberRole.OWNER,
    )
    db.add(member)

    if target_org_id:
        await log_audit_event(
            db,
            organization_id=target_org_id,
            user=current_user,
            action="workspace.created",
            resource_type="workspace",
            resource_id=workspace.id,
            metadata_json={"name": workspace.name},
            workspace_id=workspace.id,
        )

    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific workspace by ID."""
    return await _assert_workspace_access(workspace_id, current_user, db)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update workspace name or description. Only owner/admin can update."""
    workspace = await _assert_workspace_access(workspace_id, current_user, db)

    # Only owner can update
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can update this workspace")

    if payload.name is not None:
        workspace.name = payload.name
    if payload.description is not None:
        workspace.description = payload.description

    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a workspace. Only the owner can delete."""
    workspace = await _assert_workspace_access(workspace_id, current_user, db)

    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this workspace")

    workspace.is_deleted = True
    await db.commit()
