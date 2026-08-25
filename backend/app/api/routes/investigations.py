import asyncio
import json
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.base import get_db, AsyncSessionLocal
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.investigation import (
    Investigation,
    InvestigationTask,
    InvestigationEvent,
    AgentRun,
    Finding,
    Hypothesis,
    EvidenceItem,
    CriticReview,
)
from app.schemas.investigation import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationDetailResponse,
)
from app.api.dependencies import get_current_user
from app.worker import InvestigationWorker, utcnow

logger = logging.getLogger("datapilot.investigations_route")
router = APIRouter(prefix="/investigations", tags=["investigations"])


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


_active_worker_tasks: Dict[str, asyncio.Task] = {}


async def _run_worker_async(investigation_id: str):
    """Helper to run durable worker task in background."""
    try:
        worker = InvestigationWorker()
        await worker.run_investigation(investigation_id)
    except Exception as e:
        logger.exception(f"Error in background worker execution for {investigation_id}: {e}")
    finally:
        _active_worker_tasks.pop(investigation_id, None)


def ensure_worker_running(investigation_id: str) -> asyncio.Task:
    """Ensures a worker task is active for an uncompleted investigation."""
    if investigation_id in _active_worker_tasks:
        t = _active_worker_tasks[investigation_id]
        if not t.done():
            return t

    t = asyncio.create_task(_run_worker_async(investigation_id))
    _active_worker_tasks[investigation_id] = t
    return t


@router.post("", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    payload: InvestigationCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an autonomous investigation on a workspace."""
    logger.info(f"Investigation request received for workspace {workspace_id}")
    await _assert_workspace_access(workspace_id, current_user, db)

    investigation = Investigation(
        workspace_id=workspace_id,
        created_by=current_user.id,
        objective=payload.objective,
        status="PENDING",
    )
    db.add(investigation)
    await db.commit()
    await db.refresh(investigation)

    logger.info(f"Investigation created: {investigation.id}")
    ensure_worker_running(investigation.id)
    background_tasks.add_task(_run_worker_async, investigation.id)
    return investigation


@router.post("/{investigation_id}/start")
async def start_investigation(
    investigation_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Idempotent workflow start endpoint."""
    result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(inv.workspace_id, current_user, db)

    # Check terminal state protection
    if inv.status in ["COMPLETED", "FAILED", "CANCELLED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Investigation is in terminal status '{inv.status}' and cannot be restarted."
        )

    now = utcnow()
    if inv.status != "PENDING" and inv.lock_expires_at and inv.lock_expires_at > now:
        return {
            "status": "ALREADY_RUNNING",
            "investigation_id": inv.id,
            "execution_id": inv.execution_id,
            "locked_by": inv.locked_by,
            "lock_expires_at": inv.lock_expires_at.isoformat() if inv.lock_expires_at else None,
            "message": "Workflow is already running under an active execution lease."
        }

    ensure_worker_running(investigation_id)
    background_tasks.add_task(_run_worker_async, investigation_id)
    return {
        "status": "TRIGGERED",
        "investigation_id": inv.id,
        "message": "Durable background execution triggered."
    }


@router.get("", response_model=list[InvestigationResponse])
async def list_investigations(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all investigations for a workspace."""
    await _assert_workspace_access(workspace_id, current_user, db)

    result = await db.execute(
        select(Investigation)
        .where(
            Investigation.workspace_id == workspace_id,
            Investigation.is_deleted == False,
        )
        .order_by(Investigation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{investigation_id}", response_model=InvestigationDetailResponse)
async def get_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pure read endpoint. Get detailed investigation report."""
    result = await db.execute(
        select(Investigation).where(
            Investigation.id == investigation_id,
            Investigation.is_deleted == False,
        )
    )
    investigation = result.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(investigation.workspace_id, current_user, db)

    tasks = await db.execute(
        select(InvestigationTask)
        .where(InvestigationTask.investigation_id == investigation_id)
        .order_by(InvestigationTask.step_number.asc(), InvestigationTask.created_at.asc())
    )
    runs = await db.execute(
        select(AgentRun)
        .where(AgentRun.investigation_id == investigation_id)
        .order_by(AgentRun.created_at.asc())
    )
    findings = await db.execute(
        select(Finding)
        .where(Finding.investigation_id == investigation_id)
        .order_by(Finding.created_at.asc())
    )
    hypotheses = await db.execute(
        select(Hypothesis)
        .where(Hypothesis.investigation_id == investigation_id)
        .order_by(Hypothesis.created_at.asc())
    )

    return InvestigationDetailResponse(
        id=investigation.id,
        workspace_id=investigation.workspace_id,
        parent_id=investigation.parent_id,
        created_by=investigation.created_by,
        objective=investigation.objective,
        status=investigation.status,
        confidence_score=investigation.confidence_score,
        summary=investigation.summary,
        plan=investigation.plan,
        evidence_ledger=investigation.evidence_ledger,
        root_causes=investigation.root_causes,
        confidence_breakdown=investigation.confidence_breakdown,
        applied_memories=investigation.applied_memories,
        critic_reviews=investigation.critic_reviews,
        reinvestigation_count=investigation.reinvestigation_count,
        created_at=investigation.created_at,
        updated_at=investigation.updated_at,
        tasks=tasks.scalars().all(),
        runs=runs.scalars().all(),
        findings=findings.scalars().all(),
        hypotheses=hypotheses.scalars().all(),
    )


@router.get("/{investigation_id}/stream")
async def stream_investigation_events(
    investigation_id: str,
    request: Request,
    last_event_id: Optional[int] = Query(None, description="Cursor sequence number for reconnection"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Observation-only cursor-based SSE stream using DB-backed event store."""
    result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    investigation = result.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(investigation.workspace_id, current_user, db)

    # Determine starting cursor from query param or Last-Event-ID header
    header_last_id = request.headers.get("Last-Event-ID")
    cursor = 0
    if last_event_id is not None:
        cursor = last_event_id
    elif header_last_id and header_last_id.isdigit():
        cursor = int(header_last_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        nonlocal cursor
        while True:
            async with AsyncSessionLocal() as s_db:
                events_res = await s_db.execute(
                    select(InvestigationEvent)
                    .where(
                        InvestigationEvent.investigation_id == investigation_id,
                        InvestigationEvent.seq > cursor,
                    )
                    .order_by(InvestigationEvent.seq.asc())
                )
                events = events_res.scalars().all()

                for evt in events:
                    cursor = evt.seq
                    payload = {
                        "id": evt.id,
                        "seq": evt.seq,
                        "agent": evt.agent,
                        "event_type": evt.event_type,
                        "type": "agent_activity",
                        "message": evt.message,
                        "activity": {
                            "id": evt.id,
                            "agent": evt.agent,
                            "action": evt.message,
                            "status": "completed" if evt.event_type in ["COMPLETED", "PROGRESS"] else ("failed" if evt.event_type == "FAILED" else "running"),
                            "timestamp": evt.created_at.isoformat(),
                            "finding": evt.details.get("finding") if evt.details else None
                        },
                        "details": evt.details,
                        "timestamp": evt.created_at.isoformat(),
                    }
                    yield f"id: {evt.seq}\ndata: {json.dumps(payload)}\n\n"

                # Check if investigation has concluded
                inv_res = await s_db.execute(select(Investigation.status).where(Investigation.id == investigation_id))
                curr_status = inv_res.scalar_one_or_none()
                if curr_status in ["COMPLETED", "FAILED", "CANCELLED"] and len(events) == 0:
                    yield f"data: {json.dumps({'type': 'status', 'status': curr_status, 'message': f'Workflow concluded with status {curr_status}'})}\n\n"
                    break

            await asyncio.sleep(1.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{investigation_id}/debug")
async def debug_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin / Debug observability endpoint inspecting active execution lease, tasks, and events."""
    result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(inv.workspace_id, current_user, db)

    tasks_res = await db.execute(
        select(InvestigationTask)
        .where(InvestigationTask.investigation_id == investigation_id)
        .order_by(InvestigationTask.step_number.asc())
    )
    tasks = tasks_res.scalars().all()

    events_res = await db.execute(
        select(InvestigationEvent)
        .where(InvestigationEvent.investigation_id == investigation_id)
        .order_by(InvestigationEvent.seq.asc())
    )
    events = events_res.scalars().all()

    return {
        "investigation_id": inv.id,
        "execution_id": inv.execution_id,
        "status": inv.status,
        "locked_by": inv.locked_by,
        "lock_expires_at": inv.lock_expires_at.isoformat() if inv.lock_expires_at else None,
        "heartbeat_at": inv.heartbeat_at.isoformat() if inv.heartbeat_at else None,
        "last_completed_stage": inv.last_completed_stage,
        "attempt_number": inv.attempt_number,
        "failure_reason": inv.failure_reason,
        "tasks": [
            {
                "task_id": t.id,
                "agent": t.agent,
                "status": t.status,
                "retry_count": t.retry_count,
                "max_retries": t.max_retries,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "duration_ms": t.duration_ms,
                "error": t.error,
            }
            for t in tasks
        ],
        "events": [
            {
                "id": e.id,
                "seq": e.seq,
                "agent": e.agent,
                "event_type": e.event_type,
                "message": e.message,
                "timestamp": e.created_at.isoformat(),
            }
            for e in events
        ]
    }
