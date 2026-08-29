"""
DataPilot Investigation Service
================================
Provides SSE subscription, real-time event broadcasting, and execution control helpers
for the durable worker-based investigation pipeline.

NOTE: The actual investigation execution is handled entirely by worker.py's
InvestigationWorker, which uses the data-driven DatasetContext pipeline.
This module contains ONLY the infrastructure utilities needed for real-time UI updates.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.investigation import Investigation

logger = logging.getLogger("datapilot.investigation_service")

# SSE Subscriber Queues registry
_subscribers: Dict[str, List[asyncio.Queue]] = {}

# Active execution control flags (for pause/cancel)
_execution_controls: Dict[str, Dict[str, bool]] = {}


def subscribe_to_investigation(investigation_id: str) -> asyncio.Queue:
    """Subscribe to real-time events for an investigation."""
    queue = asyncio.Queue()
    if investigation_id not in _subscribers:
        _subscribers[investigation_id] = []
    _subscribers[investigation_id].append(queue)
    return queue


def unsubscribe_from_investigation(investigation_id: str, queue: asyncio.Queue):
    """Remove a subscriber queue."""
    if investigation_id in _subscribers:
        try:
            _subscribers[investigation_id].remove(queue)
        except ValueError:
            pass
        if not _subscribers[investigation_id]:
            del _subscribers[investigation_id]


def broadcast_event(investigation_id: str, event: Dict[str, Any]):
    """Broadcast an event to all subscriber queues for a given investigation."""
    if investigation_id in _subscribers:
        for queue in _subscribers[investigation_id]:
            queue.put_nowait(event)


def pause_investigation_run(investigation_id: str):
    if investigation_id not in _execution_controls:
        _execution_controls[investigation_id] = {}
    _execution_controls[investigation_id]["paused"] = True


def resume_investigation_run(investigation_id: str):
    if investigation_id in _execution_controls:
        _execution_controls[investigation_id]["paused"] = False


def cancel_investigation_run(investigation_id: str):
    if investigation_id not in _execution_controls:
        _execution_controls[investigation_id] = {}
    _execution_controls[investigation_id]["cancelled"] = True


async def record_agent_activity(
    db: AsyncSession,
    investigation_id: str,
    agent_name: str,
    action: str,
    status: str = "running",
    finding: Optional[str] = None
) -> dict:
    """Records a user-safe agent reasoning/activity event, persists it to DB, and broadcasts via SSE."""
    activity_item = {
        "id": f"act_{uuid.uuid4().hex[:10]}",
        "agent": agent_name,
        "action": action,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "finding": finding
    }

    try:
        inv_res = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
        inv = inv_res.scalar_one_or_none()
        if inv:
            current_activities = list(inv.agent_activity or [])
            current_activities.append(activity_item)
            inv.agent_activity = current_activities
            await db.commit()
    except Exception as e:
        logger.warning(f"Could not persist agent activity to DB: {e}")

    broadcast_event(investigation_id, {
        "type": "agent_activity",
        "activity": activity_item
    })

    return activity_item
