import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.dataset import Dataset, DatasetProfile, SemanticDatasetMetadata

logger = logging.getLogger("datapilot.semantic")


class SemanticDatasetService:
    """Generates and manages business semantic metadata for datasets."""

    @staticmethod
    def infer_semantic_layer(
        dataset_name: str,
        columns: List[str],
        dtypes: Dict[str, str],
    ) -> Dict[str, Any]:
        """Automatically infers business entities, metrics, dimensions, and time columns from schema."""
        entities = []
        dimensions = []
        metrics = []
        time_columns = []
        primary_key = None

        for col in columns:
            col_lower = col.lower()
            dtype = dtypes.get(col, "unknown").lower()

            # Primary Key detection
            if col_lower in ["id", f"{dataset_name.lower()}_id", "uuid", "pk"] and not primary_key:
                primary_key = col

            # Time Columns
            if any(t in col_lower for t in ["date", "time", "created_at", "updated_at", "timestamp", "year", "month"]):
                time_columns.append(col)

            # Entities
            elif any(e in col_lower for e in ["user", "customer", "account", "product", "order", "session", "campaign", "lead"]):
                if col_lower.endswith("_id") or col_lower in ["user", "customer", "product"]:
                    entities.append(col)

            # Metrics (numeric columns)
            elif "int" in dtype or "float" in dtype or "double" in dtype:
                if not col_lower.endswith("_id") and col_lower not in ["zip", "postal", "code"]:
                    metrics.append({
                        "name": col,
                        "formula": f"SUM({col})",
                        "description": f"Aggregate total of {col}"
                    })

            # Dimensions (categorical strings / boolean)
            else:
                dimensions.append(col)

        # Fallback entity
        if not entities:
            entities = [dataset_name.lower()]

        return {
            "business_description": f"Tabular business dataset representing {dataset_name} domain transactions and entities.",
            "primary_key": primary_key or (columns[0] if columns else None),
            "entities": entities,
            "dimensions": dimensions[:10],
            "metrics": metrics[:10],
            "time_columns": time_columns,
        }

    @classmethod
    async def get_or_create_semantic_metadata(
        cls,
        dataset_id: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Fetch existing semantic metadata or generate from dataset profile."""
        meta_res = await db.execute(
            select(SemanticDatasetMetadata).where(SemanticDatasetMetadata.dataset_id == dataset_id)
        )
        metadata = meta_res.scalar_one_or_none()

        if metadata:
            return {
                "dataset_id": dataset_id,
                "business_description": metadata.business_description,
                "primary_key": metadata.primary_key,
                "entities": metadata.entities or [],
                "dimensions": metadata.dimensions or [],
                "metrics": metadata.metrics or [],
                "time_columns": metadata.time_columns or [],
            }

        # Generate from dataset & profile
        ds_res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = ds_res.scalar_one_or_none()
        if not dataset:
            return {}

        prof_res = await db.execute(select(DatasetProfile).where(DatasetProfile.dataset_id == dataset_id))
        profile = prof_res.scalar_one_or_none()

        schema_info = profile.schema_info if profile else {}
        cols = schema_info.get("columns", [])
        dtypes = schema_info.get("dtypes", {})

        inferred = cls.infer_semantic_layer(dataset.name, cols, dtypes)

        new_meta = SemanticDatasetMetadata(
            dataset_id=dataset_id,
            business_description=inferred["business_description"],
            primary_key=inferred["primary_key"],
            entities=inferred["entities"],
            dimensions=inferred["dimensions"],
            metrics=inferred["metrics"],
            time_columns=inferred["time_columns"],
        )
        db.add(new_meta)
        await db.commit()

        return {
            "dataset_id": dataset_id,
            **inferred
        }


semantic_dataset_service = SemanticDatasetService()
