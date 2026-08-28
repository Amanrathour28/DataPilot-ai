import asyncio
import json
import logging
import uuid
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
from app.core.config import settings
from app.api.dependencies import get_current_user
from app.worker import InvestigationWorker, utcnow
from sqlalchemy import select, or_

logger = logging.getLogger("datapilot.investigations_route")
router = APIRouter(prefix="/investigations", tags=["investigations"])


import os


@router.api_route("/cron-worker", methods=["GET", "POST"])
async def cron_worker_trigger(request: Request):
    """Vercel Cron / Serverless background worker trigger endpoint.
    Scans for PENDING or stale RUNNING investigations and executes them.
    Strictly protected by atomic DB lease locking and optional CRON_SECRET verification.
    """
    cron_secret = getattr(settings, "cron_secret", None) or os.environ.get("CRON_SECRET")
    if cron_secret:
        auth_header = request.headers.get("Authorization", "")
        expected = f"Bearer {cron_secret}"
        if auth_header != expected and request.headers.get("x-vercel-cron") != "1" and request.query_params.get("secret") != cron_secret:
            raise HTTPException(status_code=401, detail="Unauthorized cron invocation")

    logger.info("Cron worker endpoint triggered.")
    worker = InvestigationWorker(worker_id="vercel_cron_worker")
    async with AsyncSessionLocal() as db:
        now = utcnow()
        res = await db.execute(
            select(Investigation.id)
            .where(
                Investigation.status.notin_(["COMPLETED", "FAILED", "CANCELLED"]),
                or_(
                    Investigation.status.in_(["PENDING", "QUEUED"]),
                    Investigation.lock_expires_at == None,
                    Investigation.lock_expires_at < now,
                ),
            )
            .order_by(Investigation.created_at.asc())
            .limit(5)
        )
        pending_ids = res.scalars().all()

        executed = []
        for inv_id in pending_ids:
            success = await worker.run_investigation(inv_id)
            executed.append({"investigation_id": inv_id, "success": success})

        return {
            "status": "OK",
            "worker_id": worker.worker_id,
            "claimed_count": len(executed),
            "results": executed
        }


async def _assert_workspace_access(
    workspace_id: str, user: User, db: AsyncSession
) -> Workspace:
    """Verify workspace exists and user is a member or owner. Returns the workspace."""
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.is_deleted == False,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")

    if workspace.owner_id == user.id:
        return workspace

    member = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied to this workspace")

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
    workspace_id: Optional[str] = Query(None, description="Target workspace ID"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an autonomous investigation on a workspace."""
    target_workspace_id = workspace_id or payload.workspace_id
    if not target_workspace_id:
        raise HTTPException(
            status_code=422,
            detail="workspace_id is required either as a query parameter or in the request body"
        )

    logger.info(f"Investigation request received for workspace {target_workspace_id}")
    await _assert_workspace_access(target_workspace_id, current_user, db)

    investigation = Investigation(
        workspace_id=target_workspace_id,
        created_by=current_user.id,
        objective=payload.objective,
        status="QUEUED",
    )
    db.add(investigation)
    await db.commit()
    await db.refresh(investigation)

    # Persist initial QUEUED event
    worker = InvestigationWorker(worker_id="system_init")
    await worker.record_event(
        db,
        investigation.id,
        agent="Supervisor Agent",
        event_type="STARTED",
        message="Investigation initialized and queued for worker execution.",
        details={"status": "QUEUED"},
    )

    logger.info(f"Investigation created & queued: {investigation.id}")
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
    if inv.status not in ["PENDING", "QUEUED"] and inv.lock_expires_at and inv.lock_expires_at > now:
        return {
            "status": "ALREADY_RUNNING",
            "investigation_id": inv.id,
            "execution_id": inv.execution_id,
            "locked_by": inv.locked_by,
            "lock_expires_at": inv.lock_expires_at.isoformat() if inv.lock_expires_at else None,
            "message": "Workflow is already running under an active execution lease."
        }

    inv.status = "QUEUED"
    await db.commit()

    ensure_worker_running(investigation_id)
    background_tasks.add_task(_run_worker_async, investigation_id)
    return {
        "status": "QUEUED",
        "investigation_id": inv.id,
        "message": "Durable background execution queued for worker claim."
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
    evidence_res = await db.execute(
        select(EvidenceItem)
        .where(EvidenceItem.investigation_id == investigation_id)
        .order_by(EvidenceItem.created_at.asc())
    )
    evidence_items = evidence_res.scalars().all()

    critic_res = await db.execute(
        select(CriticReview)
        .where(CriticReview.investigation_id == investigation_id)
        .order_by(CriticReview.created_at.asc())
    )
    critic_list = critic_res.scalars().all()

    events_res = await db.execute(
        select(InvestigationEvent)
        .where(InvestigationEvent.investigation_id == investigation_id)
        .order_by(InvestigationEvent.seq.asc())
    )
    events = events_res.scalars().all()

    # Reconstruct durable evidence ledger if missing on Investigation model
    evidence_ledger = investigation.evidence_ledger or []
    if not evidence_ledger and evidence_items:
        evidence_ledger = [
            {
                "evidence_id": item.id,
                "claim": item.claim,
                "source_type": item.source_type,
                "source_name": item.source_name,
                "result_summary": item.result_summary,
                "statistical_metrics": item.statistical_metrics,
                "document_citation": item.document_citation,
                "causal_classification": item.causal_classification,
                "confidence": item.confidence,
                "supports_claim": item.supports_claim,
                "created_by_agent": item.created_by_agent,
            }
            for item in evidence_items
        ]

    # Reconstruct critic reviews if missing on Investigation model
    critic_reviews = investigation.critic_reviews or []
    if not critic_reviews and critic_list:
        critic_reviews = [
            {
                "id": c.id,
                "round_number": c.round_number,
                "verdict": c.verdict,
                "overall_confidence_justified": c.overall_confidence_justified,
                "issues": c.issues,
                "critique_notes": c.critique_notes,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in critic_list
        ]

    # Reconstruct historical agent activity feed from durable events
    agent_activity = [
        {
            "id": evt.id,
            "agent": evt.agent,
            "action": evt.message,
            "finding": evt.details.get("finding") if evt.details else None,
            "status": "completed" if evt.event_type in ["COMPLETED", "PROGRESS"] else ("failed" if evt.event_type == "FAILED" else "running"),
            "timestamp": evt.created_at.isoformat() if evt.created_at else None,
        }
        for evt in events
    ]

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
        evidence_ledger=evidence_ledger,
        root_causes=investigation.root_causes,
        confidence_breakdown=investigation.confidence_breakdown,
        applied_memories=investigation.applied_memories,
        critic_reviews=critic_reviews,
        agent_activity=agent_activity,
        reinvestigation_count=investigation.reinvestigation_count,
        execution_id=investigation.execution_id,
        locked_by=investigation.locked_by,
        last_completed_stage=investigation.last_completed_stage,
        failure_reason=investigation.failure_reason,
        attempt_number=investigation.attempt_number,
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
                inv_res = await s_db.execute(
                    select(
                        Investigation.status,
                        Investigation.failure_reason,
                        Investigation.last_completed_stage,
                        Investigation.execution_id,
                        Investigation.summary,
                        Investigation.confidence_score,
                    ).where(Investigation.id == investigation_id)
                )
                curr_inv = inv_res.first()
                if curr_inv and curr_inv.status in ["COMPLETED", "FAILED", "CANCELLED"] and len(events) == 0:
                    status_payload = {
                        "type": "status",
                        "status": curr_inv.status,
                        "failure_reason": curr_inv.failure_reason,
                        "stage": curr_inv.last_completed_stage or curr_inv.status,
                        "execution_id": curr_inv.execution_id,
                        "summary": curr_inv.summary,
                        "confidence_score": curr_inv.confidence_score,
                        "message": (
                            f"Workflow failed: {curr_inv.failure_reason}"
                            if curr_inv.status == "FAILED"
                            else f"Workflow concluded with status {curr_inv.status}"
                        ),
                    }
                    yield f"data: {json.dumps(status_payload)}\n\n"
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

    now = utcnow()
    lease_active = False
    if inv.lock_expires_at and inv.lock_expires_at > now:
        lease_active = True

    return {
        "investigation_id": inv.id,
        "execution_id": inv.execution_id,
        "status": inv.status,
        "current_stage": inv.last_completed_stage or inv.status,
        "locked_by": inv.locked_by,
        "lease_status": "ACTIVE" if lease_active else ("EXPIRED" if inv.lock_expires_at else "NONE"),
        "lock_expires_at": inv.lock_expires_at.isoformat() if inv.lock_expires_at else None,
        "heartbeat_at": inv.heartbeat_at.isoformat() if inv.heartbeat_at else None,
        "last_completed_stage": inv.last_completed_stage,
        "attempt_number": inv.attempt_number,
        "failure_reason": inv.failure_reason,
        "latest_event_sequence": max([e.seq for e in events], default=0),
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
        ],
    }
