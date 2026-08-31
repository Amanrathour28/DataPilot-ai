import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import get_db
from app.db.models.user import User
from app.db.models.dataset import Dataset, DatasetProfile
from app.schemas.dataset import DatasetResponse, DatasetProfileResponse
from app.api.dependencies import get_current_user
from app.services import dataset_service
from app.services.profiling_service import run_profiling
from app.services.dataset_relationship_service import dataset_relationship_service
from app.services.semantic_dataset_service import semantic_dataset_service

logger = logging.getLogger("datapilot.datasets_route")

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    workspace_id: str = Query(..., description="Target workspace ID"),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a single dataset file (CSV, XLSX, JSON) to a workspace."""
    logger.info(
        f"[Dataset Upload] Initiated filename='{file.filename}' workspace_id={workspace_id} user_id={current_user.id}"
    )
    dataset = await dataset_service.save_dataset_file(
        file=file,
        workspace_id=workspace_id,
        user_id=current_user.id,
        db=db,
    )

    # Schedule detailed profiling in the background to keep the HTTP upload fast and resilient
    background_tasks.add_task(run_profiling, dataset.id)
    
    logger.info(
        f"[Dataset Upload] Successfully saved dataset id={dataset.id} name='{dataset.name}' rows={dataset.row_count} cols={dataset.column_count}"
    )
    return dataset


@router.post("/upload-batch", status_code=201)
async def upload_datasets_batch(
    workspace_id: str = Query(..., description="Target workspace ID"),
    files: List[UploadFile] = File(..., description="List of dataset files to upload"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload multiple dataset files concurrently with per-file isolation. Partial failures do not break the batch."""
    logger.info(
        f"[Batch Upload] Initiated {len(files)} files for workspace_id={workspace_id} user_id={current_user.id}"
    )
    successful = []
    failed = []

    for file in files:
        filename = file.filename or "unknown"
        try:
            dataset = await dataset_service.save_dataset_file(
                file=file,
                workspace_id=workspace_id,
                user_id=current_user.id,
                db=db,
            )
            background_tasks.add_task(run_profiling, dataset.id)
            successful.append({
                "id": dataset.id,
                "name": dataset.name,
                "original_filename": dataset.original_filename,
                "file_size_bytes": dataset.file_size_bytes,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
                "status": dataset.status,
            })
            logger.info(f"[Batch Upload] Successfully saved file: {filename} (id={dataset.id})")
        except Exception as e:
            err_msg = getattr(e, "detail", str(e))
            logger.warning(f"[Batch Upload] Failed to process file '{filename}': {err_msg}")
            failed.append({
                "filename": filename,
                "error": str(err_msg),
            })

    logger.info(
        f"[Batch Upload] Completed for workspace_id={workspace_id}: {len(successful)} successful, {len(failed)} failed"
    )
    return {
        "successful": successful,
        "failed": failed,
        "total_uploaded": len(successful),
        "total_failed": len(failed),
    }


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all datasets in a workspace. Returns 200 OK with [] when empty."""
    logger.info(f"[Dataset List] Fetching datasets for workspace_id={workspace_id} user_id={current_user.id}")
    datasets = await dataset_service.get_datasets_for_workspace(
        workspace_id=workspace_id,
        user_id=current_user.id,
        db=db,
    )
    logger.info(f"[Dataset List] Returned {len(datasets)} datasets for workspace_id={workspace_id}")
    return datasets


@router.get("/relationships")
async def get_workspace_dataset_relationships(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Discover primary/foreign key relationships across datasets in a workspace."""
    return await dataset_relationship_service.discover_workspace_relationships(
        workspace_id=workspace_id,
        db=db,
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single dataset by ID."""
    return await dataset_service.get_dataset_by_id(dataset_id, current_user.id, db)


@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
async def get_dataset_profile(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the profiling results for a dataset. Generates and persists on-demand if missing."""
    dataset = await dataset_service.get_dataset_by_id(dataset_id, current_user.id, db)
    result = await db.execute(
        select(DatasetProfile).where(DatasetProfile.dataset_id == dataset_id)
    )
    profile = result.scalar_one_or_none()

    # Self-healing on-demand generation if profile was not yet created or column_profiles is missing
    if not profile or not profile.column_profiles:
        try:
            from app.services.profiling_service import generate_and_persist_profile
            profile = await generate_and_persist_profile(dataset, db)
        except Exception as prof_err:
            logger.warning(f"Could not auto-generate profile for {dataset_id}: {prof_err}")
            raise HTTPException(
                status_code=404,
                detail=f"Profiling information could not be generated: {str(prof_err)}",
            )

    return profile


@router.get("/{dataset_id}/semantic")
async def get_dataset_semantic_layer(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get or infer semantic metadata (entities, dimensions, metrics) for a dataset."""
    await dataset_service.get_dataset_by_id(dataset_id, current_user.id, db)
    return await semantic_dataset_service.get_or_create_semantic_metadata(
        dataset_id=dataset_id,
        db=db,
    )


@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a dataset."""
    await dataset_service.delete_dataset(dataset_id, current_user.id, db)


@router.post("/{dataset_id}/reprofile", response_model=DatasetProfileResponse)
async def reprofile_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-trigger and compute profiling for an existing dataset synchronously."""
    dataset = await dataset_service.get_dataset_by_id(dataset_id, current_user.id, db)
    from app.services.profiling_service import generate_and_persist_profile
    try:
        profile = await generate_and_persist_profile(dataset, db)
        return profile
    except Exception as e:
        logger.error(f"Reprofiling failed for {dataset_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reprofile dataset '{dataset.name}': {str(e)}"
        )


@router.get("/{dataset_id}/preview")
async def get_dataset_preview(
    dataset_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch raw tabular rows preview for the dataset."""
    return await dataset_service.preview_dataset_rows(
        dataset_id=dataset_id,
        user_id=current_user.id,
        db=db,
        limit=limit,
        offset=offset,
    )


@router.post("/{dataset_id}/query")
async def query_dataset(
    dataset_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute ad-hoc SQL query against the dataset."""
    query = payload.get("query", "")
    if not query:
        raise HTTPException(status_code=400, detail="Query string is required")
    return await dataset_service.query_dataset_sql(
        dataset_id=dataset_id,
        query=query,
        user_id=current_user.id,
        db=db,
    )
