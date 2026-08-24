from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any
from app.db.models.dataset import DatasetStatus


class DatasetResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    file_extension: str
    row_count: Optional[int]
    column_count: Optional[int]
    status: DatasetStatus
    error_message: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    null_count: int
    null_pct: float
    unique_count: int
    unique_pct: float
    is_numeric: bool
    is_datetime: bool
    is_categorical: bool
    is_identifier: bool
    pii_risk: bool
    stats: Optional[dict[str, Any]] = None
    sample_values: Optional[list[Any]] = None


class QualityReport(BaseModel):
    total_rows: int
    total_columns: int
    duplicate_rows: int
    duplicate_pct: float
    missing_cells: int
    missing_pct: float
    quality_score: float


class DatasetProfileResponse(BaseModel):
    dataset_id: str
    schema_info: Optional[dict[str, Any]]
    column_profiles: Optional[list[dict[str, Any]]]
    quality_report: Optional[dict[str, Any]]
    sample_rows: Optional[list[dict[str, Any]]]
    profiled_at: datetime

    model_config = {"from_attributes": True}
