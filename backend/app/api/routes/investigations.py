import asyncio
import json
from typing import AsyncGenerator, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.investigation import (
    Investigation,
    InvestigationTask,
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
from app.services.investigation_service import (
    start_investigation_workflow,
    ensure_investigation_workflow_running,
    subscribe_to_investigation,
    pause_investigation_run,
    resume_investigation_run,
    cancel_investigation_run,
)

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


@router.post("", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    payload: InvestigationCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an autonomous investigation on a workspace."""
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

    background_tasks.add_task(start_investigation_workflow, investigation.id)
    ensure_investigation_workflow_running(investigation.id)
    return investigation


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
    """Get a detailed investigation report including tasks, runs, findings, and hypotheses."""
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

    if investigation.status in ['PENDING', 'PLANNING', 'RUNNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING']:
        ensure_investigation_workflow_running(investigation_id)

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


@router.post("/{investigation_id}/replay", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def replay_investigation(
    investigation_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replay an existing investigation as a new reproducible execution instance."""
    result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id, Investigation.is_deleted == False)
    )
    orig = result.scalar_one_or_none()
    if not orig:
        raise HTTPException(status_code=404, detail="Original investigation not found")

    await _assert_workspace_access(orig.workspace_id, current_user, db)

    replay_inv = Investigation(
        workspace_id=orig.workspace_id,
        parent_id=orig.id,
        created_by=current_user.id,
        objective=orig.objective,
        status="PENDING",
    )
    db.add(replay_inv)
    await db.commit()
    await db.refresh(replay_inv)

    background_tasks.add_task(start_investigation_workflow, replay_inv.id)
    return replay_inv


@router.post("/{investigation_id}/pause")
async def pause_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause an active investigation."""
    pause_investigation_run(investigation_id)
    return {"status": "PAUSED", "investigation_id": investigation_id}


@router.post("/{investigation_id}/resume")
async def resume_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused investigation."""
    resume_investigation_run(investigation_id)
    return {"status": "RESUMED", "investigation_id": investigation_id}


@router.post("/{investigation_id}/cancel")
async def cancel_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an active investigation."""
    cancel_investigation_run(investigation_id)
    return {"status": "CANCELLED", "investigation_id": investigation_id}


@router.get("/{investigation_id}/evidence", response_model=List[Dict[str, Any]])
async def get_investigation_evidence(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full Evidence Ledger items for an investigation."""
    result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id, Investigation.is_deleted == False)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(inv.workspace_id, current_user, db)

    ev_items = await db.execute(
        select(EvidenceItem)
        .where(EvidenceItem.investigation_id == investigation_id)
        .order_by(EvidenceItem.created_at.asc())
    )
    items = ev_items.scalars().all()
    if items:
        return [
            {
                "evidence_id": e.id,
                "claim": e.claim,
                "source_type": e.source_type,
                "source_id": e.source_id,
                "source_name": e.source_name,
                "analysis_type": e.analysis_type,
                "query_or_method": e.query_or_method,
                "result_summary": e.result_summary,
                "statistical_metrics": e.statistical_metrics,
                "document_citation": e.document_citation,
                "causal_classification": e.causal_classification,
                "confidence": e.confidence,
                "supports_claim": e.supports_claim,
                "created_by_agent": e.created_by_agent,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in items
        ]

    return inv.evidence_ledger or []


@router.get("/{investigation_id}/stream")
async def stream_investigation_events(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream live investigation events (SSE)."""
    result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    investigation = result.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    await _assert_workspace_access(investigation.workspace_id, current_user, db)

    # Ensure background workflow task is active
    if investigation.status in ['PENDING', 'PLANNING', 'RUNNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING']:
        ensure_investigation_workflow_running(investigation_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = subscribe_to_investigation(investigation_id)
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")
