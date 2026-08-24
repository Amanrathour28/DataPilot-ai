from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.document import Document, DocumentChunk
from app.schemas.document import (
    DocumentResponse,
    DocumentDetailResponse,
    DocumentSearchRequest,
    DocumentSearchResult,
)
from app.api.dependencies import get_current_user
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


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


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    workspace_id: str = Query(..., description="Target workspace ID"),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a business document (PDF, TXT, MD, DOCX) to a workspace for RAG retrieval."""
    await _assert_workspace_access(workspace_id, current_user, db)

    doc = await document_service.save_document_file(
        file=file,
        workspace_id=workspace_id,
        user_id=current_user.id,
        db=db,
    )
    # Schedule background text extraction, chunking, and embedding
    background_tasks.add_task(document_service.process_document_background, doc.id)
    return doc


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all documents in a workspace."""
    await _assert_workspace_access(workspace_id, current_user, db)

    result = await db.execute(
        select(Document)
        .where(
            Document.workspace_id == workspace_id,
            Document.is_deleted == False,
        )
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a document by ID with its indexed chunks."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await _assert_workspace_access(doc.workspace_id, current_user, db)

    chunks_res = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
    )
    chunks = chunks_res.scalars().all()

    return DocumentDetailResponse(
        id=doc.id,
        workspace_id=doc.workspace_id,
        uploaded_by=doc.uploaded_by,
        title=doc.title,
        original_filename=doc.original_filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        file_extension=doc.file_extension,
        chunk_count=doc.chunk_count,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        chunks=chunks,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a document."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await _assert_workspace_access(doc.workspace_id, current_user, db)

    doc.is_deleted = True
    await db.commit()


@router.post("/search", response_model=list[DocumentSearchResult])
async def search_documents(
    payload: DocumentSearchRequest,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic vector search across workspace knowledge base."""
    await _assert_workspace_access(workspace_id, current_user, db)

    results = await document_service.search_workspace_documents(
        workspace_id=workspace_id,
        query=payload.query,
        limit=payload.limit,
        db=db,
    )
    return results
