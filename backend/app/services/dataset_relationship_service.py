import logging
import os
import uuid
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.dataset import Dataset, DatasetRelationship

logger = logging.getLogger("datapilot.relationships")


class DatasetRelationshipService:
    """Discovers likely primary key / foreign key relationships between datasets."""

    @staticmethod
    def _read_dataset_sample(file_path: str, max_rows: int = 10000) -> Optional[pd.DataFrame]:
        if not os.path.exists(file_path):
            return None
        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".csv":
                return pd.read_csv(file_path, nrows=max_rows)
            elif ext in [".xlsx", ".xls"]:
                return pd.read_excel(file_path, nrows=max_rows)
            elif ext == ".json":
                return pd.read_json(file_path)
            return None
        except Exception as e:
            logger.error(f"Failed to read dataset file {file_path}: {e}")
            return None

    @classmethod
    async def discover_workspace_relationships(
        cls,
        workspace_id: str,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        """Scans all non-deleted datasets in a workspace and identifies join candidate relationships."""
        ds_res = await db.execute(
            select(Dataset).where(
                Dataset.workspace_id == workspace_id,
                Dataset.status == "PROFILED",
                Dataset.is_deleted == False,
            )
        )
        datasets = ds_res.scalars().all()
        if len(datasets) < 2:
            return []

        # Load samples into memory
        samples = {}
        for ds in datasets:
            df = cls._read_dataset_sample(ds.file_path)
            if df is not None and not df.empty:
                samples[ds.id] = (ds, df)

        relationships = []
        dataset_ids = list(samples.keys())

        for i in range(len(dataset_ids)):
            for j in range(i + 1, len(dataset_ids)):
                id_a, id_b = dataset_ids[i], dataset_ids[j]
                ds_a, df_a = samples[id_a]
                ds_b, df_b = samples[id_b]

                # Compare all column pairs
                for col_a in df_a.columns:
                    series_a = df_a[col_a].dropna()
                    if len(series_a) == 0:
                        continue

                    for col_b in df_b.columns:
                        series_b = df_b[col_b].dropna()
                        if len(series_b) == 0:
                            continue

                        # Check name similarity (exact match or ID suffix match)
                        norm_a = str(col_a).lower().replace("_", "").replace("-", "")
                        norm_b = str(col_b).lower().replace("_", "").replace("-", "")

                        name_match = (norm_a == norm_b) or (norm_a.endswith("id") and norm_b.endswith("id") and (norm_a in norm_b or norm_b in norm_a))
                        if not name_match:
                            continue

                        # Value overlap analysis
                        set_a = set(series_a.astype(str).unique())
                        set_b = set(series_b.astype(str).unique())

                        intersection = set_a.intersection(set_b)
                        if not intersection:
                            continue

                        overlap_ratio_a = len(intersection) / len(set_a)
                        overlap_ratio_b = len(intersection) / len(set_b)
                        max_overlap = max(overlap_ratio_a, overlap_ratio_b)

                        if max_overlap >= 0.3:
                            # Primary key uniqueness check
                            is_unique_a = len(series_a) == len(set_a)
                            is_unique_b = len(series_b) == len(set_b)

                            if is_unique_a and is_unique_b:
                                rel_type = "ONE_TO_ONE"
                            elif is_unique_a:
                                rel_type = "ONE_TO_MANY"
                            elif is_unique_b:
                                rel_type = "MANY_TO_ONE"
                            else:
                                rel_type = "MANY_TO_MANY"

                            confidence = min(0.98, max_overlap * 0.7 + (0.3 if norm_a == norm_b else 0.15))

                            rel_dict = {
                                "source_dataset_id": ds_a.id,
                                "source_dataset_name": ds_a.name,
                                "source_column": str(col_a),
                                "target_dataset_id": ds_b.id,
                                "target_dataset_name": ds_b.name,
                                "target_column": str(col_b),
                                "relationship_type": rel_type,
                                "confidence_score": round(confidence, 2),
                                "value_overlap_pct": round(max_overlap * 100, 1),
                                "intersection_count": len(intersection),
                            }
                            relationships.append(rel_dict)

        return relationships


dataset_relationship_service = DatasetRelationshipService()
