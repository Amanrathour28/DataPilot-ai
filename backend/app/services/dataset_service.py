import io
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
from app.db.models.dataset import Dataset, DatasetProfile, DatasetStatus
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

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this workspace")


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
    """Validate, save the uploaded file, and create a Dataset record."""
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
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if size > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {settings.max_upload_size_mb} MB",
        )

    # Extract raw data text representation for persistent storage in serverless environments
    raw_data_str = None
    if size <= 10 * 1024 * 1024:  # up to 10MB stored directly in DB for zero-loss serverless persistence
        try:
            if ext in [".csv", ".json"]:
                raw_data_str = content.decode("utf-8", errors="replace")
            elif ext in [".xlsx", ".xls"]:
                import pandas as pd
                excel_df = pd.read_excel(io.BytesIO(content))
                raw_data_str = excel_df.to_csv(index=False)
        except Exception as conv_err:
            logger.warning(f"Could not convert raw data to text string: {conv_err}")

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
        raw_data=raw_data_str,
        status=DatasetStatus.UPLOADED.value,
    )
    db.add(dataset)
    await db.commit()

    # Write file to disk after DB record is committed
    try:
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
    except Exception as disk_err:
        logger.warning(f"Could not persist file to disk (acceptable on read-only serverless): {disk_err}")

    logger.info(f"Dataset {dataset_id} uploaded: {original_name} ({size} bytes, raw_data_len={len(raw_data_str) if raw_data_str else 0})")
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
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")

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
    """Read a slice of rows from the dataset for preview and exploration."""
    import pandas as pd

    dataset = await get_dataset_by_id(dataset_id, user_id, db)
    file_path = dataset.file_path

    df = None
    load_source = "unknown"

    # 1. Attempt loading from physical file if it exists
    if file_path and os.path.exists(file_path):
        try:
            ext = dataset.file_extension.lower()
            if ext == ".csv":
                df = pd.read_csv(file_path, nrows=limit + offset + 100)
            elif ext in [".xlsx", ".xls"]:
                df = pd.read_excel(file_path, nrows=limit + offset + 100)
            elif ext == ".json":
                df = pd.read_json(file_path)
            if df is not None:
                load_source = "disk_file"
        except Exception as e:
            logger.warning(f"Failed to read disk file {file_path} for preview: {e}")

    # 2. Fallback to persisted raw_data in database (production serverless safe)
    if df is None and dataset.raw_data:
        try:
            ext = dataset.file_extension.lower()
            if ext == ".json":
                df = pd.read_json(io.StringIO(dataset.raw_data))
            else:
                df = pd.read_csv(io.StringIO(dataset.raw_data), nrows=limit + offset + 100)
            if df is not None:
                load_source = "database_raw_data"
        except Exception as raw_err:
            logger.warning(f"Failed to parse dataset.raw_data for preview {dataset_id}: {raw_err}")

    # 3. Fallback to DatasetProfile sample_rows if disk file and raw_data are unavailable
    if df is None:
        prof_res = await db.execute(
            select(DatasetProfile).where(DatasetProfile.dataset_id == dataset_id)
        )
        profile = prof_res.scalar_one_or_none()
        if profile and profile.sample_rows and len(profile.sample_rows) > 0:
            try:
                df = pd.DataFrame(profile.sample_rows)
                load_source = "profile_sample_rows"
            except Exception as prof_err:
                logger.error(f"Failed to convert sample_rows to DataFrame: {prof_err}")

    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset data for '{dataset.name}' ({dataset_id}) could not be located on disk or database profile. Please re-upload or re-profile the dataset."
        )

    try:
        total_rows = int(dataset.row_count) if dataset.row_count is not None else len(df)
        df_slice = df.iloc[offset : offset + limit]

        # Format datetime columns
        for col in df_slice.select_dtypes(include=['datetime64', 'datetimetz']).columns:
            df_slice[col] = df_slice[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        # Clean NaN/Inf for JSON serialization
        df_slice = df_slice.fillna("")

        columns = list(df_slice.columns)
        rows = df_slice.to_dict(orient="records")

        logger.info(f"Dataset preview {dataset_id}: {len(rows)} rows returned (source={load_source}, cols={len(columns)})")

        return {
            "dataset_id": dataset_id,
            "name": dataset.name,
            "columns": columns,
            "rows": rows,
            "total_rows": total_rows,
            "limit": limit,
            "offset": offset,
            "source": load_source,
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
    """Execute a read-only SQL query against the dataset using DuckDB in-memory engine."""
    import time
    import duckdb
    import pandas as pd

    start_time = time.time()
    dataset = await get_dataset_by_id(dataset_id, user_id, db)
    file_path = dataset.file_path

    # Security check: Only allow read-only queries
    cleaned_query = query.strip()
    if not cleaned_query:
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")

    # Strip any comment lines at the start to find the first actionable SQL keyword
    lines = [line.strip() for line in cleaned_query.splitlines() if line.strip() and not line.strip().startswith("--")]
    first_token = lines[0].split()[0].upper() if lines and lines[0].split() else ""

    allowed_starts = ["SELECT", "WITH", "DESCRIBE", "SHOW", "EXPLAIN", "PRAGMA"]
    if first_token not in allowed_starts:
        raise HTTPException(
            status_code=400,
            detail="Only analytical read-only queries (SELECT, WITH, DESCRIBE, SHOW, EXPLAIN) are permitted."
        )

    # Check for forbidden mutation keywords anywhere in query
    forbidden_keywords = [
        "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "ATTACH", "DETACH",
        "COPY", "INSTALL", "LOAD", "EXPORT", "IMPORT", "CREATE SECRET", "CALL"
    ]
    query_tokens = [w.upper().strip("();,") for w in cleaned_query.split()]
    for kw in forbidden_keywords:
        if kw in query_tokens:
            raise HTTPException(
                status_code=400,
                detail=f"Operation '{kw}' is not allowed in read-only SQL console."
            )

    # Initialize DuckDB
    con = duckdb.connect(database=":memory:")

    # Load dataset into DuckDB
    loaded = False
    load_source = "file"

    # 1. Attempt loading from physical file if it exists
    if file_path and os.path.exists(file_path):
        ext = dataset.file_extension.lower()
        cleaned_path = file_path.replace("\\", "/")
        try:
            if ext == ".csv":
                con.execute(f"CREATE TABLE df AS SELECT * FROM read_csv_auto('{cleaned_path}', ignore_errors=true)")
                loaded = True
            elif ext in [".xlsx", ".xls"]:
                raw_df = pd.read_excel(file_path)
                con.register("df", raw_df)
                loaded = True
            elif ext == ".json":
                con.execute(f"CREATE TABLE df AS SELECT * FROM read_json_auto('{cleaned_path}', ignore_errors=true)")
                loaded = True
        except Exception as file_load_err:
            logger.warning(f"DuckDB native load failed for {file_path}: {file_load_err}, falling back to pandas")
            try:
                if ext == ".csv":
                    raw_df = pd.read_csv(file_path)
                elif ext in [".xlsx", ".xls"]:
                    raw_df = pd.read_excel(file_path)
                elif ext == ".json":
                    raw_df = pd.read_json(file_path)
                con.register("df", raw_df)
                loaded = True
            except Exception as pd_err:
                logger.warning(f"Pandas load also failed for {file_path}: {pd_err}")

    # 2. Fallback to persisted raw_data in database (production serverless safe)
    if not loaded and dataset.raw_data:
        try:
            ext = dataset.file_extension.lower()
            if ext == ".json":
                raw_df = pd.read_json(io.StringIO(dataset.raw_data))
            else:
                raw_df = pd.read_csv(io.StringIO(dataset.raw_data))
            con.register("df", raw_df)
            loaded = True
            load_source = "database_raw_data"
            logger.info(f"Loaded dataset {dataset_id} into DuckDB from raw_data ({len(raw_df)} rows)")
        except Exception as raw_load_err:
            logger.warning(f"Failed to load dataset from raw_data: {raw_load_err}")

    # 3. Fallback to DatasetProfile sample_rows
    if not loaded:
        prof_res = await db.execute(
            select(DatasetProfile).where(DatasetProfile.dataset_id == dataset_id)
        )
        profile = prof_res.scalar_one_or_none()
        if profile and profile.sample_rows and len(profile.sample_rows) > 0:
            try:
                sample_df = pd.DataFrame(profile.sample_rows)
                con.register("df", sample_df)
                loaded = True
                load_source = "profile_cache"
                logger.info(f"Loaded dataset {dataset_id} into DuckDB from cached DatasetProfile ({len(profile.sample_rows)} rows)")
            except Exception as sample_err:
                logger.error(f"Failed to load sample_rows for {dataset_id}: {sample_err}")

    if not loaded:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset data for '{dataset.name}' could not be located on disk or profile cache. Please re-upload or re-profile the dataset."
        )

    # 4. Create convenient alias views so queries referencing 'dataset', 'data', 'table' work seamlessly
    try:
        con.execute("CREATE OR REPLACE VIEW dataset AS SELECT * FROM df")
        con.execute("CREATE OR REPLACE VIEW data AS SELECT * FROM df")
        con.execute("CREATE OR REPLACE VIEW sales AS SELECT * FROM df")
        con.execute("CREATE OR REPLACE VIEW transactions AS SELECT * FROM df")
    except Exception:
        pass

    # 5. Execute the SQL query cleanly
    try:
        result_df = con.execute(cleaned_query).fetchdf()
    except Exception as exec_err:
        logger.error(f"DuckDB execution error for dataset {dataset_id} (query='{cleaned_query}'): {exec_err}")
        err_msg = str(exec_err).replace('Catalog Error: ', '').replace('Binder Error: ', '').replace('Parser Error: ', '')
        raise HTTPException(status_code=422, detail=f"SQL Error: {err_msg}")

    # 6. Format results safely for JSON serialization
    try:
        # Format datetime columns to ISO string
        for col in result_df.select_dtypes(include=['datetime64', 'datetimetz']).columns:
            result_df[col] = result_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        # Replace NaN / NaT / Inf
        result_df = result_df.fillna("")

        columns = list(result_df.columns)
        total_matched_rows = len(result_df)
        rows = result_df.head(500).to_dict(orient="records")

        duration_ms = max(1, int((time.time() - start_time) * 1000))
        logger.info(f"DuckDB query executed for {dataset_id} in {duration_ms}ms: {total_matched_rows} rows matched (query='{cleaned_query[:60]}...')")

        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "row_count": total_matched_rows,
            "execution_time_ms": duration_ms,
            "source": load_source,
        }
    except Exception as format_err:
        logger.exception(f"Error formatting query result for dataset {dataset_id}: {format_err}")
        raise HTTPException(status_code=500, detail=f"Error formatting query result: {str(format_err)}")

