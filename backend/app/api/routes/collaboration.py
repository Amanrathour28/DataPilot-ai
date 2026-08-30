import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.investigation import (
    Investigation,
    InvestigationMember,
    InvestigationComment,
    FindingReview,
    InvestigationTask,
    InvestigationEvent,
)
from app.db.models.collaboration import Notification, AuditLog
from app.schemas.collaboration import (
    InvestigationCommentCreate,
    InvestigationCommentResponse,
    FindingReviewCreate,
    FindingReviewResponse,
    InvestigationMemberAdd,
    InvestigationMemberResponse,
    NotificationResponse,
)
from app.api.dependencies import (
    get_current_user,
    assert_investigation_access,
    log_audit_event,
    create_notification,
)

router = APIRouter(tags=["collaboration"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def extract_mentions(text: str) -> List[str]:
    """Finds all @username or @email tokens in a comment."""
    return re.findall(r"@([\w.-]+)", text)


# --- Investigation Collaborators ---


@router.get("/investigations/{investigation_id}/members", response_model=List[InvestigationMemberResponse])
async def list_investigation_members(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists collaborators attached to an investigation."""
    await assert_investigation_access(investigation_id, current_user, db, min_role="VIEWER")

    stmt = (
        select(InvestigationMember, User.name, User.email, User.avatar_url)
        .join(User, User.id == InvestigationMember.user_id)
        .where(InvestigationMember.investigation_id == investigation_id)
        .order_by(InvestigationMember.created_at.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    members = []
    for m, name, email, avatar_url in rows:
        members.append(
            InvestigationMemberResponse(
                id=m.id,
                investigation_id=m.investigation_id,
                user_id=m.user_id,
                name=name,
                email=email,
                avatar_url=avatar_url,
                role=m.role,
                created_at=m.created_at,
            )
        )
    return members


@router.post("/investigations/{investigation_id}/members", response_model=InvestigationMemberResponse)
async def add_investigation_member(
    investigation_id: str,
    payload: InvestigationMemberAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adds a collaborator to an investigation (EDITOR/OWNER only)."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="EDITOR")

    # Check if target user exists
    u_res = await db.execute(select(User).where(User.id == payload.user_id))
    target_user = u_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Check if already added
    im_res = await db.execute(
        select(InvestigationMember).where(
            InvestigationMember.investigation_id == investigation_id,
            InvestigationMember.user_id == payload.user_id,
        )
    )
    existing = im_res.scalar_one_or_none()
    if existing:
        existing.role = payload.role
        await db.commit()
        return InvestigationMemberResponse(
            id=existing.id,
            investigation_id=existing.investigation_id,
            user_id=existing.user_id,
            name=target_user.name,
            email=target_user.email,
            avatar_url=target_user.avatar_url,
            role=existing.role,
            created_at=existing.created_at,
        )

    new_im = InvestigationMember(
        id=str(uuid.uuid4()),
        investigation_id=investigation_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    db.add(new_im)

    if inv.organization_id:
        await log_audit_event(
            db,
            organization_id=inv.organization_id,
            user=current_user,
            action="investigation.collaborator_added",
            resource_type="investigation",
            resource_id=investigation_id,
            metadata_json={"target_user_id": payload.user_id, "role": payload.role},
            workspace_id=inv.workspace_id,
        )

    # Send notification
    if payload.user_id != current_user.id:
        await create_notification(
            db,
            user_id=payload.user_id,
            organization_id=inv.organization_id,
            type="ASSIGNMENT",
            title="Added as Collaborator",
            message=f"{current_user.name} added you as a {payload.role} on investigation: {inv.objective[:60]}",
            resource_type="investigation",
            resource_id=investigation_id,
        )

    await db.commit()

    return InvestigationMemberResponse(
        id=new_im.id,
        investigation_id=new_im.investigation_id,
        user_id=new_im.user_id,
        name=target_user.name,
        email=target_user.email,
        avatar_url=target_user.avatar_url,
        role=new_im.role,
        created_at=new_im.created_at,
    )


@router.delete("/investigations/{investigation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_investigation_member(
    investigation_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Removes a collaborator from an investigation."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="EDITOR")

    im_res = await db.execute(
        select(InvestigationMember).where(
            InvestigationMember.investigation_id == investigation_id,
            InvestigationMember.user_id == user_id,
        )
    )
    im = im_res.scalar_one_or_none()
    if not im:
        raise HTTPException(status_code=404, detail="Collaborator not found on this investigation.")

    await db.delete(im)
    if inv.organization_id:
        await log_audit_event(
            db,
            organization_id=inv.organization_id,
            user=current_user,
            action="investigation.collaborator_removed",
            resource_type="investigation",
            resource_id=investigation_id,
            metadata_json={"removed_user_id": user_id},
            workspace_id=inv.workspace_id,
        )
    await db.commit()


# --- Investigation Discussion Comments ---


@router.get("/investigations/{investigation_id}/comments", response_model=List[InvestigationCommentResponse])
async def list_investigation_comments(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists threaded discussion comments for an investigation."""
    await assert_investigation_access(investigation_id, current_user, db, min_role="VIEWER")

    stmt = (
        select(InvestigationComment, User.name, User.email, User.avatar_url)
        .join(User, User.id == InvestigationComment.user_id)
        .where(
            InvestigationComment.investigation_id == investigation_id,
            InvestigationComment.is_deleted == False,
        )
        .order_by(InvestigationComment.created_at.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    # Build threaded hierarchy
    comment_map = {}
    root_comments = []

    for c, name, email, avatar_url in rows:
        item = InvestigationCommentResponse(
            id=c.id,
            organization_id=c.organization_id,
            workspace_id=c.workspace_id,
            investigation_id=c.investigation_id,
            user_id=c.user_id,
            author_name=name,
            author_email=email,
            author_avatar_url=avatar_url,
            parent_id=c.parent_id,
            content=c.content,
            is_ai_triggered=c.is_ai_triggered,
            created_at=c.created_at,
            updated_at=c.updated_at,
            replies=[],
        )
        comment_map[c.id] = item

    for c_id, item in comment_map.items():
        if item.parent_id and item.parent_id in comment_map:
            comment_map[item.parent_id].replies.append(item)
        else:
            root_comments.append(item)

    return root_comments


@router.post("/investigations/{investigation_id}/comments", response_model=InvestigationCommentResponse)
async def create_investigation_comment(
    investigation_id: str,
    payload: InvestigationCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Posts a comment on an investigation, notifies mentioned users, and logs audit record."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="MEMBER")

    comment = InvestigationComment(
        id=str(uuid.uuid4()),
        organization_id=inv.organization_id,
        workspace_id=inv.workspace_id,
        investigation_id=investigation_id,
        user_id=current_user.id,
        parent_id=payload.parent_id,
        content=payload.content,
        is_ai_triggered=payload.is_ai_triggered or False,
    )
    db.add(comment)
    await db.flush()

    # Record durable event for SSE streaming
    bind = db.bind or getattr(db.sync_session, "bind", None)
    is_sqlite = bind and bind.dialect.name == "sqlite" if bind else True
    seq_val = None
    if is_sqlite:
        from sqlalchemy import func
        seq_res = await db.execute(select(func.coalesce(func.max(InvestigationEvent.seq), 0)))
        seq_val = (seq_res.scalar() or 0) + 1

    event = InvestigationEvent(
        id=f"evt_{uuid.uuid4().hex[:12]}",
        seq=seq_val,
        investigation_id=investigation_id,
        agent="Human Collaborator",
        event_type="COMMENT",
        message=f"{current_user.name}: {payload.content[:80]}",
        details={"comment_id": comment.id, "author": current_user.name, "content": payload.content},
        created_at=utcnow(),
    )
    db.add(event)

    # Process @mentions
    mentions = extract_mentions(payload.content)
    for handle in mentions:
        u_res = await db.execute(
            select(User).where(or_(User.name.ilike(f"%{handle}%"), User.email.ilike(f"{handle}%")))
        )
        mentioned_user = u_res.scalars().first()
        if mentioned_user and mentioned_user.id != current_user.id:
            await create_notification(
                db,
                user_id=mentioned_user.id,
                organization_id=inv.organization_id,
                type="MENTION",
                title="Mentioned in Investigation",
                message=f"{current_user.name} mentioned you: '{payload.content[:80]}'",
                resource_type="investigation",
                resource_id=investigation_id,
            )

    # Notify investigation owner if not the commenter
    if inv.created_by and inv.created_by != current_user.id:
        await create_notification(
            db,
            user_id=inv.created_by,
            organization_id=inv.organization_id,
            type="COMMENT",
            title="New Comment on Investigation",
            message=f"{current_user.name} commented: '{payload.content[:80]}'",
            resource_type="investigation",
            resource_id=investigation_id,
        )

    await db.commit()

    return InvestigationCommentResponse(
        id=comment.id,
        organization_id=comment.organization_id,
        workspace_id=comment.workspace_id,
        investigation_id=comment.investigation_id,
        user_id=comment.user_id,
        author_name=current_user.name,
        author_email=current_user.email,
        author_avatar_url=current_user.avatar_url,
        parent_id=comment.parent_id,
        content=comment.content,
        is_ai_triggered=comment.is_ai_triggered,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=[],
    )


@router.patch("/investigations/{investigation_id}/comments/{comment_id}", response_model=InvestigationCommentResponse)
async def update_investigation_comment(
    investigation_id: str,
    comment_id: str,
    payload: InvestigationCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates the content of an existing comment (author only)."""
    await assert_investigation_access(investigation_id, current_user, db, min_role="MEMBER")

    c_res = await db.execute(
        select(InvestigationComment).where(
            InvestigationComment.id == comment_id,
            InvestigationComment.investigation_id == investigation_id,
            InvestigationComment.is_deleted == False,
        )
    )
    comment = c_res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")

    comment.content = payload.content
    comment.updated_at = utcnow()
    await db.commit()

    return InvestigationCommentResponse(
        id=comment.id,
        organization_id=comment.organization_id,
        workspace_id=comment.workspace_id,
        investigation_id=comment.investigation_id,
        user_id=comment.user_id,
        author_name=current_user.name,
        author_email=current_user.email,
        author_avatar_url=current_user.avatar_url,
        parent_id=comment.parent_id,
        content=comment.content,
        is_ai_triggered=comment.is_ai_triggered,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=[],
    )


@router.delete("/investigations/{investigation_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investigation_comment(
    investigation_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-deletes a comment (author, investigation owner, or org admin only)."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="MEMBER")

    c_res = await db.execute(
        select(InvestigationComment).where(
            InvestigationComment.id == comment_id,
            InvestigationComment.investigation_id == investigation_id,
            InvestigationComment.is_deleted == False,
        )
    )
    comment = c_res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    # Check permission: comment author or investigation creator
    if comment.user_id != current_user.id and inv.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this comment.")

    comment.is_deleted = True
    comment.updated_at = utcnow()
    await db.commit()


@router.post("/investigations/{investigation_id}/comments/{comment_id}/follow-up")
async def trigger_follow_up_from_comment(
    investigation_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Converts a human comment into an autonomous AI follow-up investigation task."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="EDITOR")

    c_res = await db.execute(
        select(InvestigationComment).where(
            InvestigationComment.id == comment_id,
            InvestigationComment.investigation_id == investigation_id,
        )
    )
    comment = c_res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    # Create new InvestigationTask for follow-up
    task = InvestigationTask(
        id=str(uuid.uuid4()),
        investigation_id=investigation_id,
        agent="Supervisor Agent",
        objective=f"Human Follow-up Request: {comment.content}",
        status="PENDING",
        execution_id=inv.execution_id,
    )
    db.add(task)
    comment.is_ai_triggered = True

    # Re-activate investigation if in a terminal or idle state
    if inv.status in ["COMPLETED", "COMPLETED_WITH_LIMITATIONS", "FAILED", "PAUSED"]:
        inv.status = "RUNNING"
        inv.locked_by = None
        inv.lock_expires_at = None

    # Record event
    bind = db.bind or getattr(db.sync_session, "bind", None)
    is_sqlite = bind and bind.dialect.name == "sqlite" if bind else True
    seq_val = None
    if is_sqlite:
        from sqlalchemy import func
        seq_res = await db.execute(select(func.coalesce(func.max(InvestigationEvent.seq), 0)))
        seq_val = (seq_res.scalar() or 0) + 1

    event = InvestigationEvent(
        id=f"evt_{uuid.uuid4().hex[:12]}",
        seq=seq_val,
        investigation_id=investigation_id,
        agent="Supervisor Agent",
        event_type="PROGRESS",
        message=f"Human follow-up requested by {current_user.name}: '{comment.content}'",
        details={"comment_id": comment_id, "user": current_user.name, "task_id": task.id},
        created_at=utcnow(),
    )
    db.add(event)

    if inv.organization_id:
        await log_audit_event(
            db,
            organization_id=inv.organization_id,
            user=current_user,
            action="investigation.follow_up_triggered",
            resource_type="investigation",
            resource_id=investigation_id,
            metadata_json={"comment_id": comment_id, "prompt": comment.content},
            workspace_id=inv.workspace_id,
        )

    await db.commit()

    from app.api.routes.investigations import ensure_worker_running
    ensure_worker_running(investigation_id)

    return {
        "success": True,
        "message": f"Follow-up task queued for Supervisor Agent: '{comment.content}'",
        "task_id": task.id,
    }


# --- Human Review & Finding Verification ---


@router.get("/investigations/{investigation_id}/reviews", response_model=List[FindingReviewResponse])
async def list_finding_reviews(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists human reviews/approvals for findings and root causes on an investigation."""
    await assert_investigation_access(investigation_id, current_user, db, min_role="VIEWER")

    stmt = (
        select(FindingReview, User.name)
        .outerjoin(User, User.id == FindingReview.reviewed_by)
        .where(FindingReview.investigation_id == investigation_id)
        .order_by(FindingReview.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    reviews = []
    for r, name in rows:
        reviews.append(
            FindingReviewResponse(
                id=r.id,
                investigation_id=r.investigation_id,
                finding_id=r.finding_id,
                root_cause_index=r.root_cause_index,
                status=r.status,
                reviewed_by=r.reviewed_by,
                reviewer_name=r.reviewer_name or name,
                reviewer_role_title=r.reviewer_role_title,
                notes=r.notes,
                created_at=r.created_at,
            )
        )
    return reviews


@router.post("/investigations/{investigation_id}/reviews", response_model=FindingReviewResponse)
async def submit_finding_review(
    investigation_id: str,
    payload: FindingReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submits a human approval or rejection review for an AI finding or root cause."""
    inv = await assert_investigation_access(investigation_id, current_user, db, min_role="REVIEWER")

    review = FindingReview(
        id=str(uuid.uuid4()),
        investigation_id=investigation_id,
        finding_id=payload.finding_id,
        root_cause_index=payload.root_cause_index,
        status=payload.status,
        reviewed_by=current_user.id,
        reviewer_name=current_user.name,
        reviewer_role_title=payload.reviewer_role_title or "Domain Reviewer",
        notes=payload.notes,
    )
    db.add(review)
    await db.flush()

    # Record durable event for SSE streaming
    bind = db.bind or getattr(db.sync_session, "bind", None)
    is_sqlite = bind and bind.dialect.name == "sqlite" if bind else True
    seq_val = None
    if is_sqlite:
        from sqlalchemy import func
        seq_res = await db.execute(select(func.coalesce(func.max(InvestigationEvent.seq), 0)))
        seq_val = (seq_res.scalar() or 0) + 1

    event = InvestigationEvent(
        id=f"evt_{uuid.uuid4().hex[:12]}",
        seq=seq_val,
        investigation_id=investigation_id,
        agent="Human Reviewer",
        event_type="REVIEW",
        message=f"Finding review submitted by {current_user.name}: {payload.status}",
        details={
            "review_id": review.id,
            "finding_id": payload.finding_id,
            "root_cause_index": payload.root_cause_index,
            "status": payload.status,
            "reviewer": current_user.name,
        },
        created_at=utcnow(),
    )
    db.add(event)

    if inv.organization_id:
        await log_audit_event(
            db,
            organization_id=inv.organization_id,
            user=current_user,
            action=f"finding.{payload.status.lower()}",
            resource_type="finding_review",
            resource_id=review.id,
            metadata_json={
                "finding_id": payload.finding_id,
                "root_cause_index": payload.root_cause_index,
                "status": payload.status,
                "reviewer": current_user.name,
            },
            workspace_id=inv.workspace_id,
        )

    # Notify creator
    if inv.created_by and inv.created_by != current_user.id:
        await create_notification(
            db,
            user_id=inv.created_by,
            organization_id=inv.organization_id,
            type="FINDING_VERIFIED",
            title=f"Finding {payload.status.title()} by {current_user.name}",
            message=f"{current_user.name} marked a finding as {payload.status}.",
            resource_type="investigation",
            resource_id=investigation_id,
        )

    await db.commit()

    return FindingReviewResponse(
        id=review.id,
        investigation_id=review.investigation_id,
        finding_id=review.finding_id,
        root_cause_index=review.root_cause_index,
        status=review.status,
        reviewed_by=review.reviewed_by,
        reviewer_name=current_user.name,
        reviewer_role_title=review.reviewer_role_title,
        notes=review.notes,
        created_at=review.created_at,
    )


# --- In-App Notifications ---


@router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists notifications for the current authenticated user."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marks an individual notification as read."""
    res = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.read_at = utcnow()
    await db.commit()
    return notif


@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marks all notifications for the current user as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at == None)
        .values(read_at=utcnow())
    )
    await db.commit()
    return {"success": True, "message": "All notifications marked as read."}
