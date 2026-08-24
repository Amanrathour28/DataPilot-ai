from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse
from app.api.dependencies import get_current_user
from app.services import memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


async def _assert_workspace_access(
    workspace_id: str, user: User, db: AsyncSession
) -> Workspace:
    """Verify workspace exists and user is a member."""
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


@router.get("", response_model=List[MemoryResponse])
async def list_memories(
    workspace_id: str = Query(..., description="Target workspace ID"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all memories for a workspace."""
    await _assert_workspace_access(workspace_id, current_user, db)
    return await memory_service.list_memories(workspace_id=workspace_id, category=category, db=db)


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemoryCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new memory entry."""
    await _assert_workspace_access(workspace_id, current_user, db)
    return await memory_service.create_memory(
        workspace_id=workspace_id,
        payload=payload,
        user_id=current_user.id,
        db=db,
    )


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    payload: MemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a memory item (content, category, or toggle active status)."""
    updated = await memory_service.update_memory(memory_id=memory_id, payload=payload, db=db)
    if not updated:
        raise HTTPException(status_code=404, detail="Memory not found")
    return updated


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a memory item."""
    deleted = await memory_service.delete_memory(memory_id=memory_id, db=db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
