from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.memory import Memory
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse
from app.api.dependencies import get_current_user, assert_workspace_access
from app.services import memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=List[MemoryResponse])
async def list_memories(
    workspace_id: str = Query(..., description="Target workspace ID"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all memories for a workspace."""
    await assert_workspace_access(workspace_id, current_user, db, min_role="VIEWER")
    return await memory_service.list_memories(workspace_id=workspace_id, category=category, db=db)


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemoryCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new memory entry."""
    await assert_workspace_access(workspace_id, current_user, db, min_role="MEMBER")
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
    mem_res = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = mem_res.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    await assert_workspace_access(memory.workspace_id, current_user, db, min_role="MEMBER")

    updated = await memory_service.update_memory(memory_id=memory_id, payload=payload, db=db)
    return updated


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a memory item."""
    mem_res = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = mem_res.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    await assert_workspace_access(memory.workspace_id, current_user, db, min_role="MEMBER")

    await memory_service.delete_memory(memory_id=memory_id, db=db)
