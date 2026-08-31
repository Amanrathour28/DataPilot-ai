"""Profiling service — generates a detailed column-level profile of uploaded datasets.

This runs as a FastAPI background task immediately after a successful upload.
It uses Pandas for all analysis — no LLM is involved in Phase 1.

Output is stored as structured JSON in the dataset_profiles table.
"""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import pandas as pd
except ImportError:
    np = None
    pd = None
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import AsyncSessionLocal
from app.db.models.dataset import Dataset, DatasetProfile, DatasetStatus

logger = logging.getLogger("datapilot.profiling")

# PII column name patterns
PII_PATTERNS = re.compile(
    r"(email|phone|mobile|ssn|passport|national_id|credit_card|dob|birth|address|zip|postal|ip_address|latitude|longitude)",
    re.IGNORECASE,
)


def _infer_column_type(series: pd.Series) -> dict[str, bool]:
    """Determine the semantic type of a column."""
    is_boolean = pd.api.types.is_bool_dtype(series)
    is_numeric = pd.api.types.is_numeric_dtype(series) and not is_boolean
    is_datetime = False
    is_categorical = False
    is_identifier = False

    dtype_str = str(series.dtype).lower()

    # Try to detect boolean from string/integer values
    if not is_boolean and not is_numeric:
        clean_non_null = series.dropna().astype(str).str.strip().str.lower()
        if len(clean_non_null) > 0 and clean_non_null.isin(["true", "false", "0", "1", "yes", "no", "t", "f", "y", "n"]).all():
            if clean_non_null.nunique() <= 2:
                is_boolean = True

    # Try to detect datetime
    if not is_numeric and not is_boolean and "datetime" not in dtype_str:
        sample = series.dropna().head(100)
        if len(sample) > 0:
            try:
                pd.to_datetime(sample, infer_datetime_format=True, errors="raise")
                is_datetime = True
            except Exception:
                pass

    if "datetime" in dtype_str or "timestamp" in dtype_str:
        is_datetime = True

    # Categorical: low unique ratio or object dtype with few unique values
    if not is_numeric and not is_datetime and not is_boolean:
        unique_ratio = series.nunique() / max(len(series), 1)
        if unique_ratio < 0.05 or series.nunique() < 30:
            is_categorical = True

    # Identifier: high uniqueness, numeric or string-like
    if not is_boolean:
        unique_ratio = series.nunique() / max(len(series), 1)
        if unique_ratio > 0.95 and len(series) > 10:
            is_identifier = True

    return {
        "is_numeric": is_numeric,
        "is_datetime": is_datetime,
        "is_categorical": is_categorical,
        "is_identifier": is_identifier,
        "is_boolean": is_boolean,
    }


def _map_to_sql_type(series: pd.Series, type_flags: dict[str, bool]) -> str:
    """Map pandas series and semantic flags to standard SQL / DuckDB data types."""
    dtype_str = str(series.dtype).lower()
    if type_flags.get("is_boolean"):
        return "BOOLEAN"
    if "int" in dtype_str:
        return "BIGINT" if ("64" in dtype_str or "int" == dtype_str) else "INTEGER"
    if "float" in dtype_str or "double" in dtype_str or "decimal" in dtype_str:
        return "DOUBLE"
    if type_flags.get("is_datetime") or "datetime" in dtype_str or "timestamp" in dtype_str:
        return "TIMESTAMP"
    if "date" in dtype_str:
        return "DATE"
    return "VARCHAR"


def _compute_numeric_stats(series: pd.Series) -> dict[str, Any]:
    """Compute descriptive statistics for a numeric column."""
    clean = series.dropna()
    if len(clean) == 0:
        return {}

    try:
        return {
            "mean": round(float(clean.mean()), 4),
            "median": round(float(clean.median()), 4),
            "std": round(float(clean.std()), 4) if len(clean) > 1 else 0.0,
            "min": round(float(clean.min()), 4),
            "max": round(float(clean.max()), 4),
            "q25": round(float(clean.quantile(0.25)), 4),
            "q75": round(float(clean.quantile(0.75)), 4),
            "skewness": round(float(clean.skew()), 4) if len(clean) > 2 else 0.0,
            "kurtosis": round(float(clean.kurtosis()), 4) if len(clean) > 3 else 0.0,
            "zeros": int((clean == 0).sum()),
            "negatives": int((clean < 0).sum()),
        }
    except Exception as e:
        logger.warning(f"Error computing numeric stats: {e}")
        return {}


def _get_sample_values(series: pd.Series, n: int = 5) -> list[Any]:
    """Return sample non-null unique values, JSON-serializable."""
    sample = series.dropna().unique()[:n].tolist()
    result = []
    for v in sample:
        if isinstance(v, (np.integer,)):
            result.append(int(v))
        elif isinstance(v, (np.floating,)):
            result.append(float(v))
        elif isinstance(v, (pd.Timestamp, datetime)):
            result.append(str(v))
        else:
            result.append(str(v) if not isinstance(v, str) else v)
    return result


def _load_dataframe(file_path: str, file_extension: str) -> pd.DataFrame:
    """Load a dataset file into a Pandas DataFrame safely."""
    path = Path(file_path)
    ext = file_extension.lower()

    if ext == ".csv":
        df = pd.read_csv(path, low_memory=False)
    elif ext in (".xlsx", ".xls"):
        engine = "openpyxl" if ext == ".xlsx" else None
        xl_file = pd.ExcelFile(path, engine=engine)
        sheet_names = xl_file.sheet_names
        target_sheet = sheet_names[0] if sheet_names else 0
        df = xl_file.parse(sheet_name=target_sheet)
    elif ext == ".json":
        df = pd.read_json(path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    # Ensure all column names are non-empty strings
    df.columns = [str(c).strip() if pd.notna(c) else f"Column_{i+1}" for i, c in enumerate(df.columns)]
    return df


def profile_dataframe(df: pd.DataFrame, dataset_name: str) -> dict[str, Any]:
    """Generate a comprehensive profile from a DataFrame.

    Args:
        df: The loaded pandas DataFrame.
        dataset_name: Human-readable name for logging.

    Returns:
        Dictionary with schema_info, column_profiles, quality_report, and sample_rows.
    """
    total_rows, total_cols = df.shape
    duplicate_rows = int(df.duplicated().sum()) if total_rows > 0 else 0
    missing_cells = int(df.isnull().sum().sum()) if total_rows > 0 else 0
    total_cells = total_rows * total_cols
    missing_pct = round(missing_cells / max(total_cells, 1) * 100, 2)
    duplicate_pct = round(duplicate_rows / max(total_rows, 1) * 100, 2)

    # Quality score: penalize missing and duplicates
    quality_score = max(0.0, round(
        100 - (missing_pct * 0.5) - (duplicate_pct * 0.3), 1
    ))

    # Schema info
    schema_info = {
        "columns": list(df.columns),
        "dtypes": {col: str(df[col].dtype) for col in df.columns},
    }

    # Column profiles
    column_profiles = []
    for col in df.columns:
        series = df[col]
        null_count = int(series.isnull().sum())
        null_pct = round(null_count / max(total_rows, 1) * 100, 2)
        unique_count = int(series.nunique())
        unique_pct = round(unique_count / max(total_rows, 1) * 100, 2)
        type_flags = _infer_column_type(series)
        sql_type = _map_to_sql_type(series, type_flags)
        pii_risk = bool(PII_PATTERNS.search(col))

        profile: dict[str, Any] = {
            "name": col,
            "dtype": str(series.dtype),
            "sql_type": sql_type,
            "null_count": null_count,
            "null_pct": null_pct,
            "unique_count": unique_count,
            "unique_pct": unique_pct,
            "pii_risk": pii_risk,
            "sample_values": _get_sample_values(series),
            **type_flags,
        }

        if type_flags["is_numeric"]:
            profile["stats"] = _compute_numeric_stats(series)
        elif type_flags["is_datetime"]:
            try:
                valid_dt = pd.to_datetime(series.dropna(), errors="coerce").dropna()
                if len(valid_dt) > 0:
                    profile["min_date"] = str(valid_dt.min())
                    profile["max_date"] = str(valid_dt.max())
            except Exception:
                pass
        elif type_flags["is_categorical"] or type_flags["is_boolean"]:
            top = series.value_counts().head(5)
            profile["top_values"] = {str(k): int(v) for k, v in top.items()}

        column_profiles.append(profile)

    # Sample rows (first 500 rows, JSON-safe for persistent database preview)
    sample = df.head(500).replace({np.nan: None})
    sample_rows = []
    for _, row in sample.iterrows():
        row_dict = {}
        for k, v in row.items():
            if isinstance(v, (np.integer,)):
                row_dict[k] = int(v)
            elif isinstance(v, (np.floating,)):
                row_dict[k] = float(v)
            elif isinstance(v, (pd.Timestamp, datetime)):
                row_dict[k] = str(v)
            else:
                row_dict[k] = v
        sample_rows.append(row_dict)

    quality_report = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": duplicate_pct,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "quality_score": quality_score,
    }

    return {
        "schema_info": schema_info,
        "column_profiles": column_profiles,
        "quality_report": quality_report,
        "sample_rows": sample_rows,
    }


async def generate_and_persist_profile(dataset: Dataset, db: AsyncSession) -> DatasetProfile:
    """Loads dataset from disk or database raw_data, generates profile, and persists DatasetProfile."""
    import io

    df = None
    if dataset.file_path and Path(dataset.file_path).exists():
        try:
            df = _load_dataframe(dataset.file_path, dataset.file_extension)
        except Exception as file_err:
            logger.warning(f"Failed to load dataset file from disk ({dataset.file_path}): {file_err}")

    if df is None and dataset.raw_data:
        try:
            ext = (dataset.file_extension or ".csv").lower()
            if ext == ".json":
                df = pd.read_json(io.StringIO(dataset.raw_data))
            else:
                df = pd.read_csv(io.StringIO(dataset.raw_data))
            # Clean column names
            df.columns = [str(c).strip() if pd.notna(c) else f"Column_{i+1}" for i, c in enumerate(df.columns)]
        except Exception as raw_err:
            logger.warning(f"Failed to load dataset from raw_data: {raw_err}")

    if df is None:
        raise ValueError(
            f"Dataset '{dataset.name}' could not be located on disk ({dataset.file_path}) or database raw_data."
        )

    # Persist raw_data representation if not already saved
    if not dataset.raw_data and len(df) > 0 and len(df) <= 50000:
        try:
            dataset.raw_data = df.to_csv(index=False)
        except Exception:
            pass

    profile_data = profile_dataframe(df, dataset.name)

    # Update dataset row/column counts and status
    dataset.row_count = profile_data["quality_report"]["total_rows"]
    dataset.column_count = profile_data["quality_report"]["total_columns"]
    dataset.status = DatasetStatus.PROFILED.value
    dataset.error_message = None

    # Upsert DatasetProfile
    existing = await db.execute(
        select(DatasetProfile).where(DatasetProfile.dataset_id == dataset.id)
    )
    dp = existing.scalar_one_or_none()

    if dp:
        dp.schema_info = profile_data["schema_info"]
        dp.column_profiles = profile_data["column_profiles"]
        dp.quality_report = profile_data["quality_report"]
        dp.sample_rows = profile_data["sample_rows"]
        dp.profiled_at = datetime.now(timezone.utc)
    else:
        dp = DatasetProfile(
            dataset_id=dataset.id,
            schema_info=profile_data["schema_info"],
            column_profiles=profile_data["column_profiles"],
            quality_report=profile_data["quality_report"],
            sample_rows=profile_data["sample_rows"],
        )
        db.add(dp)

    await db.commit()
    await db.refresh(dp)
    logger.info(f"Successfully generated and persisted profile for '{dataset.name}' ({dataset.id}): {dataset.row_count} rows, {dataset.column_count} cols")
    return dp


async def run_profiling(dataset_id: str) -> None:
    """Background task entry point.
    
    Uses AsyncSessionLocal for DB operations.
    Updates the Dataset status and writes a DatasetProfile record.
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
            dataset = result.scalar_one_or_none()

            if not dataset:
                logger.error(f"Profiling: Dataset {dataset_id} not found")
                return

            await generate_and_persist_profile(dataset, db)
        except Exception as e:
            logger.exception(f"Background profiling failed for dataset {dataset_id}: {e}")
            try:
                result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
                dataset = result.scalar_one_or_none()
                if dataset:
                    dataset.status = DatasetStatus.ERROR.value
                    dataset.error_message = str(e)
                    await db.commit()
            except Exception:
                pass
