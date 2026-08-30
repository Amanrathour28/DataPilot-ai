import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.organization import Organization, OrganizationMember, OrganizationInvitation, OrganizationRole
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
from app.db.models.collaboration import AuditLog
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationMemberResponse,
    OrganizationMemberRoleUpdate,
    OrganizationInvitationCreate,
    OrganizationInvitationResponse,
    AcceptInvitationRequest,
)
from app.schemas.collaboration import AuditLogResponse
from app.api.dependencies import (
    get_current_user,
    assert_org_access,
    log_audit_event,
    create_notification,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])
invitations_public_router = APIRouter(prefix="/invitations", tags=["invitations"])


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:64]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all organizations the current user is a member of."""
    stmt = (
        select(Organization, OrganizationMember.role)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == "ACTIVE",
            Organization.is_deleted == False,
        )
        .order_by(Organization.created_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    orgs = []
    for org, role in rows:
        resp = OrganizationResponse.model_validate(org)
        resp.user_role = str(role)
        orgs.append(resp)
    return orgs


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new organization, adds creator as OWNER, and provisions a default workspace."""
    base_slug = slugify(payload.name)
    slug = f"{base_slug}-{secrets.token_hex(3)}"

    org = Organization(
        id=str(uuid.uuid4()),
        name=payload.name,
        slug=slug,
        created_by=current_user.id,
    )
    db.add(org)
    await db.flush()

    # Add user as OWNER
    member = OrganizationMember(
        id=str(uuid.uuid4()),
        organization_id=org.id,
        user_id=current_user.id,
        role=OrganizationRole.OWNER,
        status="ACTIVE",
    )
    db.add(member)

    # Auto-provision default workspace
    ws_name = payload.default_workspace_name or "General"
    ws_slug = f"{slugify(ws_name)}-{org.id[:6]}"
    workspace = Workspace(
        id=str(uuid.uuid4()),
        organization_id=org.id,
        name=ws_name,
        slug=ws_slug,
        description=f"Default {ws_name} workspace for {org.name}",
        owner_id=current_user.id,
    )
    db.add(workspace)
    await db.flush()

    ws_member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=WorkspaceMemberRole.OWNER,
    )
    db.add(ws_member)

    # Log audit
    await log_audit_event(
        db,
        organization_id=org.id,
        user=current_user,
        action="organization.created",
        resource_type="organization",
        resource_id=org.id,
        metadata_json={"name": org.name, "default_workspace": workspace.name},
        workspace_id=workspace.id,
    )

    await db.commit()
    await db.refresh(org)

    resp = OrganizationResponse.model_validate(org)
    resp.user_role = "OWNER"
    return resp


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves organization details if the user is an authorized member."""
    mem = await assert_org_access(org_id, current_user, db, min_role="VIEWER")
    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    resp = OrganizationResponse.model_validate(org)
    resp.user_role = str(mem.role)
    return resp


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    payload: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates organization name or branding (ADMIN/OWNER only)."""
    mem = await assert_org_access(org_id, current_user, db, min_role="ADMIN")
    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    if payload.name is not None:
        org.name = payload.name
    if payload.logo_url is not None:
        org.logo_url = payload.logo_url

    await log_audit_event(
        db,
        organization_id=org.id,
        user=current_user,
        action="organization.updated",
        resource_type="organization",
        resource_id=org.id,
        metadata_json={"updated_fields": payload.model_dump(exclude_unset=True)},
    )
    await db.commit()
    await db.refresh(org)

    resp = OrganizationResponse.model_validate(org)
    resp.user_role = str(mem.role)
    return resp


@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def list_organization_members(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all active members in the organization."""
    await assert_org_access(org_id, current_user, db, min_role="VIEWER")

    stmt = (
        select(OrganizationMember, User.name, User.email)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.status == "ACTIVE",
        )
        .order_by(OrganizationMember.created_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    members = []
    for mem, name, email in rows:
        members.append(
            OrganizationMemberResponse(
                id=mem.id,
                organization_id=mem.organization_id,
                user_id=mem.user_id,
                name=name,
                email=email,
                role=str(mem.role),
                status=mem.status,
                joined_at=mem.joined_at,
            )
        )
    return members


@router.patch("/{org_id}/members/{user_id}", response_model=OrganizationMemberResponse)
async def update_member_role(
    org_id: str,
    user_id: str,
    payload: OrganizationMemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates a member's role (OWNER or ADMIN only)."""
    curr_mem = await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    if user_id == current_user.id and payload.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself.",
        )

    target_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    target_mem = target_res.scalar_one_or_none()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Member not found.")

    if target_mem.role == OrganizationRole.OWNER and curr_mem.role != OrganizationRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an organization OWNER can modify an OWNER account.",
        )

    old_role = target_mem.role
    target_mem.role = OrganizationRole(payload.role)

    await log_audit_event(
        db,
        organization_id=org_id,
        user=current_user,
        action="member.role_updated",
        resource_type="organization_member",
        resource_id=target_mem.id,
        metadata_json={"target_user_id": user_id, "old_role": str(old_role), "new_role": payload.role},
    )

    await db.commit()

    u_res = await db.execute(select(User).where(User.id == user_id))
    u = u_res.scalar_one()

    return OrganizationMemberResponse(
        id=target_mem.id,
        organization_id=target_mem.organization_id,
        user_id=target_mem.user_id,
        name=u.name,
        email=u.email,
        role=str(target_mem.role),
        status=target_mem.status,
        joined_at=target_mem.joined_at,
    )


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Removes a member from the organization (ADMIN/OWNER only)."""
    curr_mem = await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the organization.")

    target_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    target_mem = target_res.scalar_one_or_none()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Member not found.")

    if target_mem.role == OrganizationRole.OWNER and curr_mem.role != OrganizationRole.OWNER:
        raise HTTPException(status_code=403, detail="Only an OWNER can remove another OWNER.")

    await db.delete(target_mem)

    await log_audit_event(
        db,
        organization_id=org_id,
        user=current_user,
        action="member.removed",
        resource_type="organization_member",
        resource_id=target_mem.id,
        metadata_json={"removed_user_id": user_id},
    )
    await db.commit()


@router.post("/{org_id}/invitations", response_model=OrganizationInvitationResponse)
async def create_invitation(
    org_id: str,
    payload: OrganizationInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a secure token invitation to join the organization (ADMIN/OWNER only)."""
    await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    # Check if target email already in organization
    existing_user_res = await db.execute(select(User).where(User.email == payload.email.lower()))
    existing_user = existing_user_res.scalar_one_or_none()
    if existing_user:
        existing_mem_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == existing_user.id,
            )
        )
        if existing_mem_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{payload.email}' is already an active member of this organization.",
            )

    # Generate secure 64-char token valid for 7 days
    token = secrets.token_urlsafe(32)
    expires_at = utcnow() + timedelta(days=7)

    invitation = OrganizationInvitation(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        workspace_id=payload.workspace_id,
        email=payload.email.lower(),
        role=payload.role,
        token=token,
        invited_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invitation)

    await log_audit_event(
        db,
        organization_id=org_id,
        user=current_user,
        action="member.invited",
        resource_type="invitation",
        resource_id=invitation.id,
        metadata_json={"email": payload.email, "role": payload.role, "workspace_id": payload.workspace_id},
    )

    await db.commit()
    await db.refresh(invitation)

    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_res.scalar_one()

    return OrganizationInvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        organization_name=org.name,
        workspace_id=invitation.workspace_id,
        email=invitation.email,
        role=invitation.role,
        token=invitation.token,
        invited_by_name=current_user.name,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


@router.get("/{org_id}/invitations", response_model=List[OrganizationInvitationResponse])
async def list_invitations(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists pending invitations for the organization (ADMIN/OWNER only)."""
    await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    stmt = (
        select(OrganizationInvitation, User.name)
        .outerjoin(User, User.id == OrganizationInvitation.invited_by)
        .where(
            OrganizationInvitation.organization_id == org_id,
            OrganizationInvitation.accepted_at == None,
            OrganizationInvitation.expires_at > utcnow(),
        )
        .order_by(OrganizationInvitation.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    invites = []
    for inv, inviter_name in rows:
        invites.append(
            OrganizationInvitationResponse(
                id=inv.id,
                organization_id=inv.organization_id,
                workspace_id=inv.workspace_id,
                email=inv.email,
                role=inv.role,
                token=inv.token,
                invited_by_name=inviter_name,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
            )
        )
    return invites


@router.delete("/{org_id}/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    org_id: str,
    invite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revokes a pending invitation (ADMIN/OWNER only)."""
    await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    res = await db.execute(
        select(OrganizationInvitation).where(
            OrganizationInvitation.id == invite_id,
            OrganizationInvitation.organization_id == org_id,
        )
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    await db.delete(inv)
    await log_audit_event(
        db,
        organization_id=org_id,
        user=current_user,
        action="invitation.revoked",
        resource_type="invitation",
        resource_id=invite_id,
    )
    await db.commit()


@router.get("/{org_id}/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    org_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves organization audit logs (ADMIN/OWNER only)."""
    await assert_org_access(org_id, current_user, db, min_role="ADMIN")

    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


# --- Public Invitation Endpoints ---


@invitations_public_router.get("/{token}", response_model=OrganizationInvitationResponse)
async def get_invitation_details(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Validates and returns details for an invitation token."""
    res = await db.execute(
        select(OrganizationInvitation, Organization.name, User.name)
        .join(Organization, Organization.id == OrganizationInvitation.organization_id)
        .outerjoin(User, User.id == OrganizationInvitation.invited_by)
        .where(OrganizationInvitation.token == token)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    inv, org_name, inviter_name = row
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="This invitation has already been accepted.")
    if inv.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This invitation has expired.")

    return OrganizationInvitationResponse(
        id=inv.id,
        organization_id=inv.organization_id,
        organization_name=org_name,
        workspace_id=inv.workspace_id,
        email=inv.email,
        role=inv.role,
        token=inv.token,
        invited_by_name=inviter_name,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
    )


@invitations_public_router.post("/{token}/accept", response_model=OrganizationResponse)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accepts an invitation, creating organization and workspace memberships idempotently."""
    res = await db.execute(
        select(OrganizationInvitation).where(OrganizationInvitation.token == token)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="This invitation has already been accepted.")
    if inv.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This invitation has expired.")

    # Check if already a member
    mem_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == inv.organization_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    mem = mem_res.scalar_one_or_none()
    if not mem:
        mem = OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=inv.organization_id,
            user_id=current_user.id,
            role=OrganizationRole(inv.role),
            status="ACTIVE",
        )
        db.add(mem)

    # Join assigned workspace or default workspace
    target_ws_id = inv.workspace_id
    if not target_ws_id:
        ws_res = await db.execute(
            select(Workspace.id).where(
                Workspace.organization_id == inv.organization_id,
                Workspace.is_deleted == False,
            ).limit(1)
        )
        target_ws_id = ws_res.scalar_one_or_none()

    if target_ws_id:
        wm_res = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == target_ws_id,
                WorkspaceMember.user_id == current_user.id,
            )
        )
        if not wm_res.scalar_one_or_none():
            db.add(WorkspaceMember(
                id=str(uuid.uuid4()),
                workspace_id=target_ws_id,
                user_id=current_user.id,
                role=WorkspaceMemberRole.MEMBER,
            ))

    inv.accepted_at = utcnow()

    # Log audit
    await log_audit_event(
        db,
        organization_id=inv.organization_id,
        user=current_user,
        action="member.joined",
        resource_type="organization_member",
        resource_id=mem.id,
        metadata_json={"invitation_id": inv.id, "email": inv.email},
        workspace_id=target_ws_id,
    )

    # Notify inviter if exists
    if inv.invited_by:
        await create_notification(
            db,
            user_id=inv.invited_by,
            organization_id=inv.organization_id,
            type="INVITATION_ACCEPTED",
            title="Invitation Accepted",
            message=f"{current_user.name} ({current_user.email}) accepted the invitation to join your organization.",
            resource_type="organization",
            resource_id=inv.organization_id,
        )

    await db.commit()

    org_res = await db.execute(select(Organization).where(Organization.id == inv.organization_id))
    org = org_res.scalar_one()

    resp = OrganizationResponse.model_validate(org)
    resp.user_role = str(mem.role)
    return resp
