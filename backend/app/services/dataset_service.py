import os
import re
import uuid
import logging
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.models.dataset import Dataset, DatasetStatus
from app.db.models.workspace import Workspace, WorkspaceMember

logger = logging.getLogger("datapilot.datasets")

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}
ALLOWED_MIME_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/json",
    "text/plain",           # Some OS report CSV as text/plain
    "application/octet-stream",  # Generic fallback
}

MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024


async def _assert_workspace_member(workspace_id: str, user_id: str, db: AsyncSession) -> None:
    """Check membership or auto-heal if user is the workspace owner."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if result.scalar_one_or_none():
        return

    # Check if user is the owner or workspace exists
    result2 = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.is_deleted == False)
    )
    workspace = result2.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    if workspace.owner_id == user_id:
        try:
            from app.db.models.workspace import WorkspaceMemberRole
            member = WorkspaceMember(
                workspace_id=workspace_id,
                user_id=user_id,
                role=WorkspaceMemberRole.OWNER,
            )
            db.add(member)
            await db.commit()
            return
        except Exception:
            return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def _get_upload_path(workspace_id: str, dataset_id: str, filename: str) -> Path:
    """Return the absolute path where the file should be saved."""
    upload_root = Path(settings.upload_dir).resolve()
    workspace_dir = upload_root / "workspaces" / workspace_id / "datasets" / dataset_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    return workspace_dir / filename


def _sanitize_filename(filename: str) -> str:
    """Remove path traversal and special characters from filename."""
    filename = os.path.basename(filename)
    filename = re.sub(r"[^\w\s\-.]", "", filename)
    return filename[:255] or "dataset"


async def save_dataset_file(
    file: UploadFile,
    workspace_id: str,
    user_id: str,
    db: AsyncSession,
) -> Dataset:
    """Validate, save the uploaded file, and create a Dataset record.

    Args:
        file: The uploaded file from the multipart form.
        workspace_id: Target workspace UUID.
        user_id: Uploading user UUID.
        db: Async database session.

    Returns:
        The created Dataset ORM object.
    """
    await _assert_workspace_member(workspace_id, user_id, db)

    # Validate extension
    original_name = file.filename or "upload"
    sanitized = _sanitize_filename(original_name)
    ext = Path(sanitized).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read content with size guard
    content = await file.read()
    size = len(content)

    if size == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    if size > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {settings.max_upload_size_mb} MB",
        )

    # Create DB record first to get an ID
    dataset_id = str(uuid.uuid4())
    dataset_name = Path(sanitized).stem  # name without extension

    file_path = _get_upload_path(workspace_id, dataset_id, sanitized)

    dataset = Dataset(
        id=dataset_id,
        workspace_id=workspace_id,
        uploaded_by=user_id,
        name=dataset_name,
        original_filename=original_name,
        file_path=str(file_path),
        file_size_bytes=size,
        mime_type=file.content_type or "application/octet-stream",
        file_extension=ext,
        status=DatasetStatus.UPLOADED.value,
    )
    db.add(dataset)
    await db.commit()

    # Write file to disk after DB record is committed
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    logger.info(f"Dataset {dataset_id} uploaded: {original_name} ({size} bytes)")
    return dataset


async def get_datasets_for_workspace(
    workspace_id: str,
    user_id: str,
    db: AsyncSession,
) -> list[Dataset]:
    """Return all non-deleted datasets in a workspace."""
    await _assert_workspace_member(workspace_id, user_id, db)

    result = await db.execute(
        select(Dataset)
        .where(Dataset.workspace_id == workspace_id, Dataset.is_deleted == False)
        .order_by(Dataset.created_at.desc())
    )
    return result.scalars().all()


async def get_dataset_by_id(
    dataset_id: str,
    user_id: str,
    db: AsyncSession,
) -> Dataset:
    """Return a single dataset, enforcing workspace membership."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    await _assert_workspace_member(dataset.workspace_id, user_id, db)
    return dataset


async def delete_dataset(
    dataset_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """Soft-delete a dataset."""
    dataset = await get_dataset_by_id(dataset_id, user_id, db)
    dataset.is_deleted = True
    await db.commit()
    logger.info(f"Dataset {dataset_id} soft-deleted by user {user_id}")


async def preview_dataset_rows(
    dataset_id: str,
    user_id: str,
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Read a slice of rows from the dataset file for preview and exploration."""
    import pandas as pd

    dataset = await get_dataset_by_id(dataset_id, user_id, db)
    file_path = dataset.file_path

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    try:
        ext = dataset.file_extension.lower()
        if ext == ".csv":
            df = pd.read_csv(file_path, nrows=limit + offset)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path, nrows=limit + offset)
        elif ext == ".json":
            df = pd.read_json(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format for preview: {ext}")

        total_rows = len(df)
        df_slice = df.iloc[offset : offset + limit]

        # Clean NaN/Inf for JSON serialization
        df_slice = df_slice.fillna("")

        columns = list(df_slice.columns)
        rows = df_slice.to_dict(orient="records")

        return {
            "dataset_id": dataset_id,
            "name": dataset.name,
            "columns": columns,
            "rows": rows,
            "total_rows": total_rows,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Error previewing dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to preview dataset: {str(e)}")


async def query_dataset_sql(
    dataset_id: str,
    query: str,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """Execute a read-only SQL query against the dataset using DuckDB."""
    import duckdb

    dataset = await get_dataset_by_id(dataset_id, user_id, db)
    file_path = dataset.file_path

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    # Guard against non-SELECT queries
    cleaned_query = query.strip()
    if not cleaned_query.lower().startswith("select") and not cleaned_query.lower().startswith("with"):
        raise HTTPException(status_code=400, detail="Only SELECT / WITH read-only queries are permitted.")

    try:
        con = duckdb.connect(database=":memory:")
        ext = dataset.file_extension.lower()
        table_name = "df"

        if ext == ".csv":
            con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{file_path.replace(os.sep, '/')}')")
        elif ext in [".xlsx", ".xls"]:
            import pandas as pd
            raw_df = pd.read_excel(file_path)
            con.register(table_name, raw_df)
        elif ext == ".json":
            con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_json_auto('{file_path.replace(os.sep, '/')}')")

        # Replace common placeholder table names with our registered table
        sanitized_sql = re.sub(r"\b(dataset|data|table|df)\b", table_name, cleaned_query, flags=re.IGNORECASE)

        result_df = con.execute(sanitized_sql).fetchdf()
        result_df = result_df.fillna("")

        columns = list(result_df.columns)
        rows = result_df.head(100).to_dict(orient="records")

        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(result_df),
        }
    except Exception as e:
        logger.error(f"Error querying dataset {dataset_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")
