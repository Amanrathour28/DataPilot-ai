from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    uploaded_by: Optional[str] = None
    title: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    file_extension: str
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: Optional[int] = None
    chunk_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkResponse] = []


class DocumentSearchRequest(BaseModel):
    query: str
    limit: int = 5


class DocumentSearchResult(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    content: str
    similarity_score: float
    chunk_index: int
    chunk_metadata: Optional[Dict[str, Any]] = None
