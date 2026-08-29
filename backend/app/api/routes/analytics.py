from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.investigation import Investigation, InvestigationTask, AgentRun, Finding, Hypothesis
from app.db.models.dataset import Dataset
from app.db.models.document import Document
from app.db.models.memory import Memory
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _assert_workspace_access(workspace_id: str, user: User, db: AsyncSession) -> Workspace:
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


@router.get("/summary")
async def get_workspace_analytics_summary(
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get aggregated analytics and metrics for a workspace."""
    await _assert_workspace_access(workspace_id, current_user, db)

    # 1. Investigations stats
    inv_res = await db.execute(
        select(Investigation).where(
            Investigation.workspace_id == workspace_id,
            Investigation.is_deleted == False,
        )
    )
    investigations = inv_res.scalars().all()
    total_investigations = len(investigations)
    completed_investigations = sum(1 for inv in investigations if inv.status == "COMPLETED")
    failed_investigations = sum(1 for inv in investigations if inv.status == "FAILED")
    running_investigations = sum(1 for inv in investigations if inv.status in ("RUNNING", "PLANNING", "ANALYZING"))

    success_rate = (
        round((completed_investigations / total_investigations) * 100, 1)
        if total_investigations > 0
        else 100.0
    )

    # 2. Datasets stats
    ds_res = await db.execute(
        select(Dataset).where(
            Dataset.workspace_id == workspace_id,
            Dataset.is_deleted == False,
        )
    )
    datasets = ds_res.scalars().all()
    total_datasets = len(datasets)
    total_rows = sum(ds.row_count or 0 for ds in datasets)
    total_size_bytes = sum(ds.file_size_bytes or 0 for ds in datasets)

    # 3. Documents stats
    doc_res = await db.execute(
        select(Document).where(
            Document.workspace_id == workspace_id,
            Document.is_deleted == False,
        )
    )
    docs = doc_res.scalars().all()
    total_documents = len(docs)
    total_doc_chunks = sum(d.chunk_count or 0 for d in docs)

    # 4. Memories stats
    mem_res = await db.execute(
        select(Memory).where(
            Memory.workspace_id == workspace_id,
            Memory.is_deleted == False,
        )
    )
    memories = mem_res.scalars().all()
    total_memories = len(memories)

    # 5. Agent runs & task metrics across workspace investigations
    inv_ids = [inv.id for inv in investigations]
    agent_roles_distribution: Dict[str, int] = {}
    total_agent_runs = 0
    total_findings = 0
    total_hypotheses = 0

    if inv_ids:
        agent_res = await db.execute(
            select(AgentRun).where(AgentRun.investigation_id.in_(inv_ids))
        )
        agent_runs = agent_res.scalars().all()
        total_agent_runs = len(agent_runs)
        for ar in agent_runs:
            role = ar.agent_role or "unknown"
            agent_roles_distribution[role] = agent_roles_distribution.get(role, 0) + 1

        findings_res = await db.execute(
            select(func.count(Finding.id)).where(Finding.investigation_id.in_(inv_ids))
        )
        total_findings = findings_res.scalar() or 0

        hyp_res = await db.execute(
            select(func.count(Hypothesis.id)).where(Hypothesis.investigation_id.in_(inv_ids))
        )
        total_hypotheses = hyp_res.scalar() or 0

    # Metrics based on actual completed investigations
    estimated_tokens = total_agent_runs * 1200 + completed_investigations * 800
    # Benchmark: 1 completed autonomous investigation saves ~1.5 manual analyst hours ($50/hr equivalent)
    estimated_analyst_hours = round(completed_investigations * 1.5, 1)
    estimated_cost_saved_usd = round(estimated_analyst_hours * 50.0, 2)

    return {
        "workspace_id": workspace_id,
        "investigations": {
            "total": total_investigations,
            "completed": completed_investigations,
            "failed": failed_investigations,
            "running": running_investigations,
            "success_rate_percent": success_rate,
            "recent": [
                {
                    "id": inv.id,
                    "objective": inv.objective,
                    "status": inv.status,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                }
                for inv in sorted(investigations, key=lambda x: x.created_at, reverse=True)[:5]
            ]
        },
        "datasets": {
            "total_datasets": total_datasets,
            "total_rows": total_rows,
            "total_size_mb": round(total_size_bytes / (1024 * 1024), 2),
        },
        "knowledge_base": {
            "total_documents": total_documents,
            "total_chunks": total_doc_chunks,
        },
        "memories": {
            "total_memories": total_memories,
        },
        "agents": {
            "total_runs": total_agent_runs,
            "total_findings": total_findings,
            "total_hypotheses": total_hypotheses,
            "roles_distribution": agent_roles_distribution,
            "estimated_tokens_processed": estimated_tokens,
            "estimated_analyst_hours_saved": round(total_investigations * 2.5, 1),
            "estimated_cost_saved_usd": estimated_cost_saved_usd,
        }
    }


@router.get("/agents-activity")
async def get_agents_activity(
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get recent agent execution activity across all investigations in the workspace."""
    await _assert_workspace_access(workspace_id, current_user, db)

    inv_res = await db.execute(
        select(Investigation).where(
            Investigation.workspace_id == workspace_id,
            Investigation.is_deleted == False,
        )
    )
    investigations = {inv.id: inv for inv in inv_res.scalars().all()}
    if not investigations:
        return []

    agent_res = await db.execute(
        select(AgentRun)
        .where(AgentRun.investigation_id.in_(list(investigations.keys())))
        .order_by(AgentRun.created_at.desc())
        .limit(50)
    )
    runs = agent_res.scalars().all()

    activity = []
    for run in runs:
        inv = investigations.get(run.investigation_id)
        activity.append({
            "id": run.id,
            "investigation_id": run.investigation_id,
            "investigation_objective": inv.objective if inv else "Unknown",
            "agent_role": run.agent_role,
            "status": run.status,
            "tool_calls": run.tool_calls or [],
            "error_message": run.error_message,
            "duration_ms": run.duration_ms,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        })

    return activity
