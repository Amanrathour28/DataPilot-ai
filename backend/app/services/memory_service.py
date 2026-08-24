import logging
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.memory import Memory, MemoryCategory
from app.schemas.memory import MemoryCreate, MemoryUpdate

logger = logging.getLogger("datapilot.memory_service")


async def get_active_memories(
    workspace_id: str,
    user_id: Optional[str] = None,
    db: AsyncSession = None,
) -> List[Memory]:
    """Retrieve all active memories for a workspace and user to inject into investigation context."""
    stmt = (
        select(Memory)
        .where(
            Memory.workspace_id == workspace_id,
            Memory.is_active == True,
        )
        .order_by(Memory.category.asc(), Memory.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_memories(
    workspace_id: str,
    category: Optional[str] = None,
    db: AsyncSession = None,
) -> List[Memory]:
    """List all memories for a workspace with optional category filter."""
    stmt = select(Memory).where(Memory.workspace_id == workspace_id)
    if category:
        stmt = stmt.where(Memory.category == category)
    stmt = stmt.order_by(Memory.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_memory(
    workspace_id: str,
    payload: MemoryCreate,
    user_id: Optional[str] = None,
    db: AsyncSession = None,
) -> Memory:
    """Create a new memory entry."""
    valid_categories = {c.value for c in MemoryCategory}
    cat = payload.category.upper() if payload.category.upper() in valid_categories else MemoryCategory.PREFERENCE.value

    memory = Memory(
        workspace_id=workspace_id,
        user_id=user_id,
        category=cat,
        content=payload.content.strip(),
        confidence=payload.confidence,
        is_active=True,
        source=payload.source or "manual",
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


async def update_memory(
    memory_id: str,
    payload: MemoryUpdate,
    db: AsyncSession = None,
) -> Optional[Memory]:
    """Update an existing memory entry."""
    stmt = select(Memory).where(Memory.id == memory_id)
    result = await db.execute(stmt)
    memory = result.scalar_one_or_none()
    if not memory:
        return None

    if payload.category is not None:
        valid_categories = {c.value for c in MemoryCategory}
        cat = payload.category.upper()
        if cat in valid_categories:
            memory.category = cat
    if payload.content is not None:
        memory.content = payload.content.strip()
    if payload.confidence is not None:
        memory.confidence = payload.confidence
    if payload.is_active is not None:
        memory.is_active = payload.is_active

    await db.commit()
    await db.refresh(memory)
    return memory


async def delete_memory(
    memory_id: str,
    db: AsyncSession = None,
) -> bool:
    """Permanently delete a memory entry."""
    stmt = select(Memory).where(Memory.id == memory_id)
    result = await db.execute(stmt)
    memory = result.scalar_one_or_none()
    if not memory:
        return False

    await db.delete(memory)
    await db.commit()
    return True
