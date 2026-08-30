"""
DataPilot Dataset Context Service
==================================
Provides schema-aware, question-driven dataset context for all investigation agents.

DESIGN PRINCIPLES:
- Never assumes any business domain (no revenue, regions, cohorts, transactions, etc.)
- All analysis is grounded in the actual uploaded dataset
- Explicit failure when data is insufficient — never fabricates results
- Question interpretation is purely schema-driven
- Every finding is traceable to actual dataset rows and column operations
"""

import json
import logging
import os
import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.dataset import Dataset, DatasetProfile

logger = logging.getLogger("datapilot.dataset_context")


# ── DatasetContext ─────────────────────────────────────────────────────────────

class DatasetContext:
    """
    Immutable context object encapsulating the actual dataset and user question.
    Passed to every investigation agent instead of being rebuilt per-agent.
    """

    def __init__(self, **kwargs):
        self.dataset_id: str = kwargs["dataset_id"]
        self.dataset_name: str = kwargs["dataset_name"]
        self.file_path: Optional[str] = kwargs.get("file_path")
        self.row_count: int = kwargs["row_count"]
        self.all_columns: List[str] = kwargs["all_columns"]
        self.column_dtypes: Dict[str, str] = kwargs["column_dtypes"]
        self.numeric_columns: List[str] = kwargs["numeric_columns"]
        self.categorical_columns: List[str] = kwargs["categorical_columns"]
        self.date_columns: List[str] = kwargs["date_columns"]
        self.sample_values: Dict[str, List] = kwargs["sample_values"]
        self.null_counts: Dict[str, int] = kwargs["null_counts"]
        self.unique_counts: Dict[str, int] = kwargs["unique_counts"]
        self.question: str = kwargs["question"]
        self.question_relevant_columns: List[str] = kwargs.get("question_relevant_columns", [])
        self._df: Optional[pd.DataFrame] = kwargs.get("df")

        # Candidate column classifications (derived from actual schema)
        self.candidate_metric_columns: List[str] = kwargs.get("candidate_metric_columns", [])
        self.candidate_dimension_columns: List[str] = kwargs.get("candidate_dimension_columns", [])
        self.candidate_period_columns: List[str] = kwargs.get("candidate_period_columns", [])
        # Question-to-data mapping: {concept: column_name_or_None}
        self.question_mapping: Dict[str, Optional[str]] = kwargs.get("question_mapping", {})
        # Concepts from user question that cannot be mapped to dataset columns
        self.unmappable_concepts: List[str] = kwargs.get("unmappable_concepts", [])

    def get_df(self) -> Optional[pd.DataFrame]:
        """Return the in-memory DataFrame. May be None if not loaded from disk."""
        return self._df

    def schema_summary(self) -> str:
        """
        Returns a human-readable schema summary suitable for LLM prompts.
        Only includes actual column names and sample values — no invented content.
        """
        lines = [
            f"Dataset: {self.dataset_name}",
            f"Total Rows: {self.row_count}",
            f"Columns ({len(self.all_columns)}):",
        ]
        for col in self.all_columns:
            dtype = self.column_dtypes.get(col, "unknown")
            samples = self.sample_values.get(col, [])
            sample_str = ", ".join([repr(s) for s in samples[:3]])
            null_pct = round(self.null_counts.get(col, 0) / max(self.row_count, 1) * 100, 1)
            lines.append(f"  - {col!r} ({dtype}, {null_pct}% null): e.g. {sample_str}")
        lines.append(f"\nNumeric Columns: {', '.join(self.numeric_columns) or 'None'}")
        lines.append(f"Categorical Columns: {', '.join(self.categorical_columns) or 'None'}")
        lines.append(f"Date/Time Columns: {', '.join(self.date_columns) or 'None'}")
        if self.question_relevant_columns:
            lines.append(f"\nColumns Most Relevant to Question: {', '.join(self.question_relevant_columns)}")
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dataset_id": self.dataset_id,
            "dataset_name": self.dataset_name,
            "row_count": self.row_count,
            "all_columns": self.all_columns,
            "column_dtypes": self.column_dtypes,
            "numeric_columns": self.numeric_columns,
            "categorical_columns": self.categorical_columns,
            "date_columns": self.date_columns,
            "sample_values": self.sample_values,
            "null_counts": self.null_counts,
            "unique_counts": self.unique_counts,
            "question": self.question,
            "question_relevant_columns": self.question_relevant_columns,
            "candidate_metric_columns": self.candidate_metric_columns,
            "candidate_dimension_columns": self.candidate_dimension_columns,
            "candidate_period_columns": self.candidate_period_columns,
            "question_mapping": self.question_mapping,
            "unmappable_concepts": self.unmappable_concepts,
        }


# ── Internal Helpers ───────────────────────────────────────────────────────────

def _load_dataframe(dataset: Dataset, profile: Optional[DatasetProfile]) -> Optional[pd.DataFrame]:
    """
    Attempt to load the actual dataset file from disk.
    Falls back to DatasetProfile.sample_rows only if disk file is not available.
    Returns None if neither source is available — never fabricates data.
    """
    df = None

    # 1. Try disk file first
    if dataset.file_path and os.path.exists(dataset.file_path):
        ext = (dataset.file_extension or "").lower()
        try:
            if ext == ".csv":
                df = pd.read_csv(dataset.file_path)
            elif ext in (".xlsx", ".xls"):
                df = pd.read_excel(dataset.file_path)
            elif ext == ".json":
                df = pd.read_json(dataset.file_path)
            elif ext == ".parquet":
                df = pd.read_parquet(dataset.file_path)
            if df is not None:
                logger.info(f"[DatasetContext] Loaded {len(df)} rows from disk: {dataset.file_path}")
                return df
        except Exception as read_err:
            logger.warning(f"[DatasetContext] Failed to read disk file {dataset.file_path}: {read_err}")

    # 2. Try persisted raw_data from database (production serverless safe)
    if df is None and getattr(dataset, "raw_data", None):
        ext = (dataset.file_extension or "").lower()
        try:
            import io
            if ext == ".json":
                df = pd.read_json(io.StringIO(dataset.raw_data))
            else:
                df = pd.read_csv(io.StringIO(dataset.raw_data))
            if df is not None:
                logger.info(f"[DatasetContext] Loaded {len(df)} rows from dataset.raw_data for {dataset.id}")
                return df
        except Exception as raw_err:
            logger.warning(f"[DatasetContext] Failed to parse dataset.raw_data for {dataset.id}: {raw_err}")

    # 3. Fallback to profile sample_rows (Vercel serverless / missing file)
    if df is None and profile and profile.sample_rows:
        sdata = profile.sample_rows
        if isinstance(sdata, str):
            try:
                sdata = json.loads(sdata)
            except Exception:
                pass
        if isinstance(sdata, list) and sdata:
            df = pd.DataFrame(sdata)
            logger.info(f"[DatasetContext] Loaded {len(df)} rows from profile sample_rows for {dataset.id}")
            return df

    logger.warning(f"[DatasetContext] Could not load dataset {dataset.id} — no disk file, no raw_data, and no sample rows available")
    return None


def _profile_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Profile a DataFrame to extract column types, sample values, null counts, unique counts.
    All information is derived from the actual data — nothing is invented.
    """
    column_dtypes: Dict[str, str] = {}
    numeric_columns: List[str] = []
    categorical_columns: List[str] = []
    date_columns: List[str] = []
    sample_values: Dict[str, List] = {}
    null_counts: Dict[str, int] = {}
    unique_counts: Dict[str, int] = {}

    for col in df.columns:
        col_series = df[col]
        null_counts[col] = int(col_series.isna().sum())
        unique_counts[col] = int(col_series.nunique())

        # Check for numeric dtype first (duration columns like 'Lead Time Days' must stay numeric)
        if pd.api.types.is_numeric_dtype(col_series):
            column_dtypes[col] = str(col_series.dtype)
            numeric_columns.append(col)
            sample_values[col] = [v for v in col_series.dropna().head(3).tolist()]
            continue

        # Check for datetime columns by name heuristic + parse attempt
        col_lower = col.lower()
        is_date_name = any(k in col_lower for k in [
            "date", "dt", "created_at", "updated_at",
            "timestamp", "by date", "bydate", "duedate", "due date"
        ]) and not any(k in col_lower for k in ["days", "hours", "mins", "minutes", "duration"])

        if is_date_name or col_series.dtype == "datetime64[ns]":
            try:
                parsed = pd.to_datetime(col_series, errors="coerce")
                if parsed.notna().sum() > len(df) * 0.3:
                    column_dtypes[col] = "datetime"
                    date_columns.append(col)
                    sample_values[col] = [str(v)[:10] for v in parsed.dropna().head(3).tolist()]
                    continue
            except Exception:
                pass

        # Object dtype — try coercing to numeric
        if col_series.dtype == object:
            try:
                coerced = pd.to_numeric(col_series, errors="coerce")
                valid_ratio = coerced.notna().sum() / max(len(df), 1)
                if valid_ratio > 0.6:
                    column_dtypes[col] = "numeric(string)"
                    numeric_columns.append(col)
                    sample_values[col] = [v for v in col_series.dropna().head(3).tolist()]
                    continue
            except Exception:
                pass
            # String/categorical
            column_dtypes[col] = "string"
            categorical_columns.append(col)
            sample_values[col] = [str(v) for v in col_series.dropna().unique()[:3].tolist()]

        else:
            column_dtypes[col] = str(col_series.dtype)
            categorical_columns.append(col)
            sample_values[col] = [str(v) for v in col_series.dropna().head(3).tolist()]

    return {
        "column_dtypes": column_dtypes,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "date_columns": date_columns,
        "sample_values": sample_values,
        "null_counts": null_counts,
        "unique_counts": unique_counts,
    }


def _find_question_relevant_columns(
    question: str,
    all_columns: List[str],
    sample_values: Dict[str, List],
) -> List[str]:
    """
    Identify which dataset columns are most relevant to the user's question.
    Uses token-overlap matching between question words and column names/sample values.
    No business-domain assumptions — purely driven by actual column names.
    """
    q_lower = question.lower()
    q_words = set(re.findall(r"[a-z]+", q_lower))

    scored: Dict[str, int] = {}
    for col in all_columns:
        col_lower = col.lower()
        col_words = set(re.findall(r"[a-z]+", col_lower))

        score = 0
        # Direct word overlap
        score += len(q_words & col_words) * 3
        # Substring match (question word inside column name)
        for qw in q_words:
            if len(qw) >= 3 and qw in col_lower:
                score += 2
        # Substring match (column word inside question)
        for cw in col_words:
            if len(cw) >= 3 and cw in q_lower:
                score += 2
        # Sample value overlap
        for sv in sample_values.get(col, []):
            sv_lower = str(sv).lower()
            sv_words = set(re.findall(r"[a-z]+", sv_lower))
            score += len(q_words & sv_words) * 1

        if score > 0:
            scored[col] = score

    return sorted(scored.keys(), key=lambda c: scored[c], reverse=True)[:12]


# ── Public API ─────────────────────────────────────────────────────────────────

async def build_dataset_context(
    workspace_id: str,
    question: str,
    db: AsyncSession,
    dataset_id: Optional[str] = None,
    dataset_ids: Optional[List[str]] = None,
) -> Optional[DatasetContext]:
    """
    Build a DatasetContext from the actual uploaded dataset in the workspace.
    Returns None if no dataset is available — never fabricates data.

    This is the single source of truth for dataset loading.
    All agents must use this context rather than loading data independently.
    """
    target_ids = list(dataset_ids) if dataset_ids else ([dataset_id] if dataset_id else [])

    # Fetch dataset(s)
    if target_ids:
        ds_res = await db.execute(
            select(Dataset).where(
                Dataset.id.in_(target_ids),
                Dataset.workspace_id == workspace_id,
                Dataset.is_deleted == False
            )
        )
        datasets = ds_res.scalars().all()
    else:
        ds_res = await db.execute(
            select(Dataset).where(
                Dataset.workspace_id == workspace_id,
                Dataset.status.in_(["PROFILED", "UPLOADED"]),
                Dataset.is_deleted == False,
            ).order_by(Dataset.updated_at.desc())
        )
        datasets = ds_res.scalars().all()

    if not datasets:
        logger.warning(f"[DatasetContext] No datasets found for workspace {workspace_id}")
        return None

    primary_ds = datasets[0]

    # Trigger on-demand profiling if still UPLOADED
    if primary_ds.status != "PROFILED":
        try:
            from app.services.profiling_service import run_profiling
            await run_profiling(primary_ds.id)
            await db.refresh(primary_ds)
        except Exception as prof_err:
            logger.warning(f"[DatasetContext] On-demand profiling failed for {primary_ds.id}: {prof_err}")

    # Load profile
    prof_res = await db.execute(
        select(DatasetProfile).where(DatasetProfile.dataset_id == primary_ds.id)
    )
    profile = prof_res.scalar_one_or_none()

    # Load actual DataFrame
    df = _load_dataframe(primary_ds, profile)
    if df is None or len(df) == 0:
        logger.error(f"[DatasetContext] Could not load data for dataset {primary_ds.id}")
        return None

    # Profile the DataFrame from actual data
    profiling = _profile_dataframe(df)

    # Find question-relevant columns
    question_relevant = _find_question_relevant_columns(
        question,
        list(df.columns),
        profiling["sample_values"],
    )

    logger.info(
        f"[DatasetContext] Built context for '{primary_ds.original_filename}': "
        f"{len(df)} rows, {len(df.columns)} columns, "
        f"{len(question_relevant)} question-relevant columns: {question_relevant[:5]}"
    )

    # Classify candidate columns
    metric_kw = ["revenue", "sales", "amount", "value", "price", "cost", "profit", "income",
                 "total", "qty", "quantity", "count", "volume", "units", "sum"]
    dim_kw = ["region", "country", "state", "city", "segment", "category", "type", "group",
              "channel", "product", "department", "division", "section", "status", "priority"]
    period_kw = ["quarter", "month", "year", "period", "cohort", "week", "fiscal"]

    candidate_metric_cols = [c for c in profiling["numeric_columns"]
                             if any(k in c.lower() for k in metric_kw)] or profiling["numeric_columns"][:3]
    candidate_dim_cols = [c for c in profiling["categorical_columns"]
                          if any(k in c.lower() for k in dim_kw)] or profiling["categorical_columns"][:3]
    candidate_period_cols = ([c for c in profiling["categorical_columns"] + profiling["date_columns"]
                              if any(k in c.lower() for k in period_kw)]
                             or profiling["date_columns"][:1])

    # Build question-to-data mapping
    q_mapping, unmappable = _build_question_mapping(
        question, list(df.columns), profiling["sample_values"],
        profiling["numeric_columns"], profiling["categorical_columns"], profiling["date_columns"]
    )

    return DatasetContext(
        dataset_id=primary_ds.id,
        dataset_name=primary_ds.original_filename or primary_ds.name,
        file_path=primary_ds.file_path,
        row_count=len(df),
        all_columns=list(df.columns),
        column_dtypes=profiling["column_dtypes"],
        numeric_columns=profiling["numeric_columns"],
        categorical_columns=profiling["categorical_columns"],
        date_columns=profiling["date_columns"],
        sample_values=profiling["sample_values"],
        null_counts=profiling["null_counts"],
        unique_counts=profiling["unique_counts"],
        question=question,
        question_relevant_columns=question_relevant,
        candidate_metric_columns=candidate_metric_cols,
        candidate_dimension_columns=candidate_dim_cols,
        candidate_period_columns=candidate_period_cols,
        question_mapping=q_mapping,
        unmappable_concepts=unmappable,
        df=df,
    )


# ── Question-Driven Analysis Engine ───────────────────────────────────────────

def perform_question_driven_analysis(ctx: DatasetContext) -> Dict[str, Any]:
    """
    Perform actual pandas analysis on the real dataset, guided by the user's question.

    Returns a structured result containing:
    - analysis_type: what kind of analysis was performed
    - findings: list of data-grounded finding strings
    - primary_table: the main result as list-of-dicts (real rows from real data)
    - aggregations: summary statistics derived from actual data
    - columns_used: which columns were actually used
    - analysis_description: human-readable description of what was computed

    NEVER fabricates values. Returns explicit failure dict when data is insufficient.
    """
    df = ctx.get_df()
    if df is None:
        return {
            "success": False,
            "error": "Dataset not loaded into memory. Analysis cannot proceed.",
            "analysis_type": "FAILED",
            "findings": [],
            "primary_table": [],
            "aggregations": {},
            "columns_used": [],
        }

    q_lower = ctx.question.lower()
    num_cols = ctx.numeric_columns
    cat_cols = ctx.categorical_columns
    date_cols = ctx.date_columns

    # Detect quantity columns by generic keywords
    qty_col_keywords = ["qty", "quantity", "count", "amount", "units", "num", "number"]
    qty_cols = [c for c in num_cols if any(k in c.lower() for k in qty_col_keywords)]

    # Detect ordered/received/required column pairs
    ordered_col = _find_col(qty_cols + num_cols, ["ordered", "order_qty", "orderedqty", "qty_order", "qty ordered", "po_qty"])
    required_col = _find_col(qty_cols + num_cols, ["required", "require", "qty_req", "needed", "demand", "requested"])
    received_col = _find_col(qty_cols + num_cols, ["received", "delivered", "fulfilled", "receipt", "qty_rec"])

    # Detect item identifier columns
    item_name_col = _find_col(cat_cols, ["item name", "item_name", "itemname", "product name", "name", "description", "desc", "material", "item"])
    item_code_col = _find_col(cat_cols, ["item code", "item_code", "itemcode", "sku", "code", "ref", "no", "indent no", "indent_no"])

    # Detect grouping/dimension columns
    category_col = _find_col(cat_cols, ["category", "cat", "type", "group"])
    section_col = _find_col(cat_cols, ["section", "department", "dept", "division", "unit"])
    priority_col = _find_col(cat_cols, ["priority", "urgency", "importance"])

    # Detect revenue/metric columns for period analysis
    revenue_keywords = ["revenue", "sales", "income", "amount", "value", "transaction_value",
                        "transaction_amount", "total", "price", "profit", "cost", "margin"]
    metric_col = _find_col(num_cols, revenue_keywords)

    # Detect region/dimension columns
    region_col = _find_col(cat_cols, ["region", "country", "state", "territory", "area", "location", "geography"])
    segment_col = _find_col(cat_cols, ["segment", "customer_segment", "customer_type", "tier"])
    product_col = _find_col(cat_cols, ["product", "item", "sku", "material", "item_name", "product_name"])

    # ── Route to appropriate analysis based on question intent ──
    is_volume = any(k in q_lower for k in [
        "how many records", "how many rows", "row count", "how many entries",
        "dataset size", "number of rows", "number of records", "total rows", "total records"
    ])
    is_missing = any(k in q_lower for k in [
        "missing value", "missing values", "null count", "null values", "nulls",
        "empty cells", "completeness", "nan values", "what are the missing"
    ])
    is_pending = any(k in q_lower for k in [
        "pending", "not ordered", "unordered", "unfulfilled", "outstanding",
        "open", "yet to order", "still to order", "pending to be ordered",
        "still pending", "not yet ordered", "to be ordered",
    ])
    is_overdue = any(k in q_lower for k in ["overdue", "late", "past due", "delayed", "missed", "due date"])
    is_top_n = any(k in q_lower for k in ["top", "highest", "largest", "most", "greatest", "maximum", "max"])
    is_bottom_n = any(k in q_lower for k in ["bottom", "lowest", "smallest", "least", "minimum", "min"])
    is_gap = any(k in q_lower for k in ["gap", "difference", "shortfall", "deficit", "shortage"])
    is_category = any(k in q_lower for k in ["category", "which category", "by category", "section", "by section", "which section", "group"])
    is_priority = any(k in q_lower for k in ["priority", "high priority", "urgent", "critical"])

    # Detect grouped aggregation / breakdown intent
    is_grouped_breakdown = any(k in q_lower for k in [
        "by region", "by product", "by category", "by section", "by department",
        "vary by", "varies by", "vary across", "variation", "breakdown",
        "per region", "per product", "per category", "each region", "each product",
        "each category", "distribution by", "percentage of revenue", "total revenue",
        "total sales", "total amount", "what is the total", "which region", "which product",
        "highest revenue", "highest sales", "lowest revenue", "lowest sales"
    ])

    # Detect period-over-period / change analysis intent
    is_period_comparison = any(k in q_lower for k in [
        "decline", "decrease", "drop", "fell", "fall", "increase", "growth", "grew",
        "change", "trend", "q1", "q2", "q3", "q4", "quarter", "month",
        "year over year", "yoy", "period", "compare", "versus", "vs",
        "why did", "what caused", "what drove", "explain the",
    ])

    # 1. Volume query
    if is_volume:
        return _analyze_dataset_volume(df, ctx)

    # 2. Missing values query
    if is_missing:
        return _analyze_missing_values(df, ctx)

    # 3. Period comparison (e.g., "Why did sales decline from Q2 to Q3?")
    if is_period_comparison and metric_col:
        return _analyze_period_comparison(
            df, ctx, metric_col, date_cols, cat_cols,
            region_col, segment_col, category_col, section_col,
        )

    # 4. Check for explicitly unmappable critical concepts requested in question
    if ctx.unmappable_concepts:
        critical_unmapped = [c for c in ctx.unmappable_concepts if c in ["revenue", "sales", "cost", "profit", "price", "region", "product", "segment"]]
        if critical_unmapped and not metric_col and not is_pending and not is_overdue:
            return _analyze_unmappable_question(df, ctx, critical_unmapped)

    # 5. Grouped aggregation (e.g. "What is the total revenue in the dataset, and how does it vary by region?")
    target_metric = metric_col or (qty_cols[0] if qty_cols else (num_cols[0] if num_cols else None))
    target_dim = region_col or category_col or section_col or segment_col or product_col or (cat_cols[0] if cat_cols else None)

    if is_grouped_breakdown and target_metric and target_dim:
        return _analyze_grouped_metric_by_dimension(df, ctx, target_metric, target_dim)

    # 6. Pending & gap items
    if is_pending or is_gap:
        return _analyze_pending_items(df, ctx, ordered_col, required_col, received_col,
                                       item_name_col, item_code_col, category_col, section_col,
                                       priority_col, date_cols)

    # 7. Overdue items
    if is_overdue:
        return _analyze_overdue_items(df, ctx, date_cols, item_name_col, item_code_col,
                                       ordered_col, required_col, priority_col)

    # 8. Top-N Ranking
    n_match = re.search(r"\btop\s+(\d+)\b|\b(\d+)\s+(?:items?|records?|rows?)\b", q_lower)
    n = int(n_match.group(1) or n_match.group(2)) if n_match else 10

    if is_top_n or is_bottom_n:
        return _analyze_top_n(df, ctx, n, is_top_n, qty_cols, ordered_col, required_col,
                               item_name_col, category_col, section_col)

    if is_priority and priority_col:
        return _analyze_by_dimension(df, ctx, priority_col, qty_cols, ordered_col, required_col)

    if is_category and (category_col or section_col):
        dim_col = section_col if "section" in q_lower and section_col else (category_col or section_col)
        return _analyze_by_dimension(df, ctx, dim_col, qty_cols, ordered_col, required_col)

    # 9. If target metric and dimension exist, default to grouped metric analysis
    if target_metric and target_dim:
        return _analyze_grouped_metric_by_dimension(df, ctx, target_metric, target_dim)

    # 10. General analysis
    return _analyze_general(df, ctx, qty_cols, ordered_col, required_col, item_name_col)


def _find_col(columns: List[str], keywords: List[str]) -> Optional[str]:
    """Find first column matching any keyword (case-insensitive substring match)."""
    for kw in keywords:
        for col in columns:
            if kw in col.lower():
                return col
    return None


def _analyze_grouped_metric_by_dimension(
    df: pd.DataFrame,
    ctx: DatasetContext,
    metric_col: str,
    dim_col: str,
) -> Dict[str, Any]:
    """
    Direct question-driven grouped aggregation: calculates total metric and breakdown per dimension group.
    All calculations are 100% computed from actual dataset rows.
    """
    df = df.copy()
    df[metric_col] = pd.to_numeric(df[metric_col], errors="coerce")
    valid_df = df.dropna(subset=[metric_col])
    total_records = len(df)
    valid_count = len(valid_df)
    null_count = total_records - valid_count
    grand_total = float(valid_df[metric_col].sum())
    grand_mean = float(valid_df[metric_col].mean()) if valid_count > 0 else 0.0

    df[dim_col] = df[dim_col].fillna("(Missing/Unknown)").astype(str)
    grouped = df.groupby(dim_col)[metric_col].agg(["sum", "count", "mean"]).reset_index()
    grouped.columns = [dim_col, "total", "record_count", "average"]
    if grand_total != 0:
        grouped["pct_of_total"] = (grouped["total"] / grand_total * 100).round(2)
    else:
        grouped["pct_of_total"] = 0.0

    grouped = grouped.sort_values("total", ascending=False).reset_index(drop=True)
    primary_table = grouped.to_dict(orient="records")

    top_row = grouped.iloc[0] if len(grouped) > 0 else None
    findings = [
        f"Total '{metric_col}' is {grand_total:,.2f} across {valid_count:,} valid records in '{ctx.dataset_name}' (average: {grand_mean:,.2f} per record)."
    ]
    if top_row is not None:
        findings.append(
            f"By '{dim_col}': '{top_row[dim_col]}' generated the highest '{metric_col}' "
            f"with {top_row['total']:,.2f} ({top_row['pct_of_total']:.1f}% of total across {int(top_row['record_count'])} records)."
        )
    for idx, row in grouped.iterrows():
        if idx > 0 and idx < 8:
            findings.append(
                f"• {row[dim_col]}: {row['total']:,.2f} ({row['pct_of_total']:.1f}%, {int(row['record_count'])} records, avg {row['average']:,.2f})"
            )

    dim_dict = {str(r[dim_col]): float(r["total"]) for _, r in grouped.iterrows()}

    return {
        "success": True,
        "analysis_type": "GROUPED_AGGREGATION",
        "analysis_description": (
            f"Calculated total '{metric_col}' ({grand_total:,.2f}) and grouped breakdown across "
            f"{len(grouped)} distinct '{dim_col}' cohorts in '{ctx.dataset_name}'."
        ),
        "columns_used": [metric_col, dim_col],
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": {
            "metric_column": metric_col,
            "dimension_column": dim_col,
            "grand_total": round(grand_total, 2),
            "grand_mean": round(grand_mean, 2),
            "valid_records": valid_count,
            "null_records": null_count,
            "total_records": total_records,
            "groups_count": len(grouped),
            "top_group": str(top_row[dim_col]) if top_row is not None else None,
            "top_group_total": float(top_row["total"]) if top_row is not None else 0.0,
            "top_group_pct": float(top_row["pct_of_total"]) if top_row is not None else 0.0,
            "dimensional_summary": {f"{metric_col}_by_{dim_col}": dim_dict},
        },
        "total_records": total_records,
        "data_sufficiency": {"temporal_analysis": False, "metric_available": True},
    }


def _analyze_missing_values(df: pd.DataFrame, ctx: DatasetContext) -> Dict[str, Any]:
    """Audit missing values per column across the dataset."""
    total_records = len(df)
    null_data = []
    total_nulls = 0
    for col in df.columns:
        null_cnt = int(df[col].isna().sum())
        total_nulls += null_cnt
        null_pct = round((null_cnt / total_records * 100), 2) if total_records > 0 else 0.0
        null_data.append({
            "column_name": col,
            "data_type": str(df[col].dtype),
            "missing_count": null_cnt,
            "missing_percentage": null_pct,
            "complete_count": total_records - null_cnt,
            "completeness_status": "100% Complete" if null_cnt == 0 else f"{100 - null_pct:.1f}% Complete"
        })
    null_df = pd.DataFrame(null_data).sort_values("missing_count", ascending=False)
    findings = [
        f"Dataset '{ctx.dataset_name}' contains {total_nulls} missing values across {total_records} records and {len(df.columns)} columns."
    ]
    missing_cols = [r["column_name"] for r in null_data if r["missing_count"] > 0]
    if missing_cols:
        findings.append(f"Columns with missing values: {', '.join(missing_cols)}.")
        for r in null_data:
            if r["missing_count"] > 0:
                findings.append(f"• '{r['column_name']}': {r['missing_count']} missing ({r['missing_percentage']}%)")
    else:
        findings.append("All columns in the dataset have 100% complete data (0 missing values).")

    return {
        "success": True,
        "analysis_type": "MISSING_VALUES_ANALYSIS",
        "analysis_description": f"Audited missing values across {len(df.columns)} columns in '{ctx.dataset_name}'.",
        "columns_used": list(df.columns),
        "findings": findings,
        "primary_table": null_df.to_dict(orient="records"),
        "aggregations": {
            "total_records": total_records,
            "total_columns": len(df.columns),
            "total_null_values": total_nulls,
            "columns_with_nulls": len(missing_cols),
        },
        "total_records": total_records,
    }


def _analyze_dataset_volume(df: pd.DataFrame, ctx: DatasetContext) -> Dict[str, Any]:
    """Calculate record count, column summary, and structural metrics."""
    total_records = len(df)
    total_columns = len(df.columns)
    summary_table = [
        {"property": "Total Records (Rows)", "value": f"{total_records:,}"},
        {"property": "Total Columns", "value": f"{total_columns}"},
        {"property": "Numeric Columns", "value": f"{len(ctx.numeric_columns)} ({', '.join(ctx.numeric_columns[:5])})"},
        {"property": "Categorical Columns", "value": f"{len(ctx.categorical_columns)} ({', '.join(ctx.categorical_columns[:5])})"},
        {"property": "Date Columns", "value": f"{len(ctx.date_columns)} ({', '.join(ctx.date_columns) or 'None'})"},
        {"property": "Total Missing Values", "value": f"{sum(ctx.null_counts.values()):,}"},
    ]
    findings = [
        f"Dataset '{ctx.dataset_name}' contains {total_records:,} records across {total_columns} columns.",
        f"Identified {len(ctx.numeric_columns)} numeric column(s) and {len(ctx.categorical_columns)} categorical column(s)."
    ]
    return {
        "success": True,
        "analysis_type": "DATASET_VOLUME_ANALYSIS",
        "analysis_description": f"Calculated volume and structure metrics for '{ctx.dataset_name}'.",
        "columns_used": list(df.columns),
        "findings": findings,
        "primary_table": summary_table,
        "aggregations": {
            "total_records": total_records,
            "total_columns": total_columns,
            "numeric_columns_count": len(ctx.numeric_columns),
            "categorical_columns_count": len(ctx.categorical_columns),
        },
        "total_records": total_records,
    }


def _analyze_unmappable_question(df: pd.DataFrame, ctx: DatasetContext, unmapped: List[str]) -> Dict[str, Any]:
    """Honest response when question references columns not present in dataset."""
    findings = [
        f"The requested concept(s) ({', '.join(unmapped)}) cannot be answered from '{ctx.dataset_name}' because no matching columns exist in the file.",
        f"Available numeric columns in this dataset: {', '.join(ctx.numeric_columns) or 'None'}.",
        f"Available categorical columns in this dataset: {', '.join(ctx.categorical_columns[:8]) or 'None'}."
    ]
    return {
        "success": True,
        "analysis_type": "UNMAPPABLE_QUESTION_CONCEPT",
        "analysis_description": (
            f"The question referenced concepts ({', '.join(unmapped)}) that do not exist in '{ctx.dataset_name}'. "
            f"Analysis cannot fabricate non-existent columns."
        ),
        "columns_used": [],
        "findings": findings,
        "primary_table": [],
        "aggregations": {
            "unmappable_concepts": unmapped,
            "available_columns": ctx.all_columns,
            "total_records": len(df),
        },
        "total_records": len(df),
        "data_sufficiency": {"temporal_analysis": False, "metric_available": False},
    }


def _build_display_cols(
    *cols: Optional[str],
    df_cols: List[str],
    extra_cols: Optional[List[str]] = None,
) -> List[str]:
    """Build deduplicated list of display columns that actually exist in df."""
    seen = set()
    result = []
    all_candidates = list(cols) + (extra_cols or [])
    for c in all_candidates:
        if c and c in df_cols and c not in seen:
            seen.add(c)
            result.append(c)
    return result


def _analyze_pending_items(
    df: pd.DataFrame,
    ctx: DatasetContext,
    ordered_col: Optional[str],
    required_col: Optional[str],
    received_col: Optional[str],
    item_name_col: Optional[str],
    item_code_col: Optional[str],
    category_col: Optional[str],
    section_col: Optional[str],
    priority_col: Optional[str],
    date_cols: List[str],
) -> Dict[str, Any]:
    """
    Analyze items pending to be ordered by computing actual quantity gaps.
    All values come from the actual dataset — no fabrication.
    """
    df = df.copy()
    findings = []
    total_records = len(df)

    # Determine pending calculation formula from actual columns
    if required_col and ordered_col:
        df[required_col] = pd.to_numeric(df[required_col], errors="coerce").fillna(0)
        df[ordered_col] = pd.to_numeric(df[ordered_col], errors="coerce").fillna(0)
        df["_pending_qty"] = df[required_col] - df[ordered_col]
        pending_df = df[df["_pending_qty"] > 0].copy()
        pending_formula = f"'{required_col}' - '{ordered_col}' > 0"
        columns_used = [required_col, ordered_col]

    elif ordered_col:
        df[ordered_col] = pd.to_numeric(df[ordered_col], errors="coerce").fillna(0)
        pending_df = df[df[ordered_col] == 0].copy()
        df["_pending_qty"] = 0
        pending_df["_pending_qty"] = 0
        pending_formula = f"'{ordered_col}' = 0 (nothing ordered yet)"
        columns_used = [ordered_col]

    elif required_col:
        df[required_col] = pd.to_numeric(df[required_col], errors="coerce").fillna(0)
        pending_df = df[df[required_col] > 0].copy()
        df["_pending_qty"] = df[required_col]
        pending_df["_pending_qty"] = pending_df[required_col]
        pending_formula = f"'{required_col}' > 0"
        columns_used = [required_col]

    else:
        # No quantity columns found — show all records with a note
        pending_df = df.copy()
        df["_pending_qty"] = 0
        pending_df["_pending_qty"] = 0
        pending_formula = "No quantity columns detected — all records shown"
        columns_used = ctx.question_relevant_columns[:3]

    total_pending = len(pending_df)
    pending_pct = round(total_pending / max(total_records, 1) * 100, 1)

    # Build display table
    first_date_col = date_cols[0] if date_cols else None
    display_cols = _build_display_cols(
        item_name_col, item_code_col,
        required_col, ordered_col, received_col,
        "_pending_qty" if (required_col and ordered_col) else None,
        priority_col, section_col, category_col, first_date_col,
        df_cols=list(pending_df.columns),
    )

    # Sort by pending qty descending if available
    if "_pending_qty" in pending_df.columns:
        pending_df = pending_df.sort_values("_pending_qty", ascending=False)

    table_data = pending_df[display_cols].head(100).rename(
        columns={"_pending_qty": "Pending Qty"}
    ).fillna("")
    primary_table = table_data.to_dict(orient="records")

    # Aggregations from real data
    total_pending_qty = float(pending_df["_pending_qty"].sum()) if "_pending_qty" in pending_df.columns else 0
    total_required_qty = float(df[required_col].sum()) if required_col else 0

    aggregations: Dict[str, Any] = {
        "total_records_in_dataset": total_records,
        "pending_items_count": total_pending,
        "pending_percentage": pending_pct,
        "formula_used": pending_formula,
    }
    if required_col and ordered_col:
        aggregations["total_required_qty"] = round(total_required_qty, 2)
        aggregations["total_pending_qty"] = round(total_pending_qty, 2)

    # Dimensional summaries from real data
    dim_summary: Dict[str, Any] = {}
    for dim_col_name, dim_label in [
        (category_col, "category"),
        (section_col, "section"),
        (priority_col, "priority"),
    ]:
        if dim_col_name and dim_col_name in pending_df.columns:
            if "_pending_qty" in pending_df.columns and required_col and ordered_col:
                grp = pending_df.groupby(dim_col_name)["_pending_qty"].sum().sort_values(ascending=False).head(10)
                dim_summary[f"pending_qty_by_{dim_label}"] = {str(k): round(float(v), 2) for k, v in grp.items()}
            else:
                grp = pending_df.groupby(dim_col_name).size().sort_values(ascending=False).head(10)
                dim_summary[f"count_by_{dim_label}"] = {str(k): int(v) for k, v in grp.items()}
    aggregations["dimensional_summary"] = dim_summary

    # Build findings strings from actual data
    findings.append(
        f"Out of {total_records} total records in '{ctx.dataset_name}', "
        f"{total_pending} items ({pending_pct}%) are pending to be ordered "
        f"(formula applied: {pending_formula})."
    )
    if required_col and ordered_col:
        findings.append(
            f"Total pending quantity: {total_pending_qty:,.0f} units "
            f"(out of {total_required_qty:,.0f} total required across all records)."
        )

    for dim_key, dim_data in dim_summary.items():
        dim_name = dim_key.replace("pending_qty_by_", "").replace("count_by_", "").replace("_", " ").title()
        if dim_data:
            top_val = list(dim_data.keys())[0]
            top_cnt = list(dim_data.values())[0]
            metric_word = "pending quantity" if "qty" in dim_key else "pending items"
            findings.append(
                f"By {dim_name}: '{top_val}' has the highest {metric_word} ({top_cnt:,.0f})."
            )

    cols_used_final = list(set(columns_used + [c for c in display_cols if c != "_pending_qty"]))

    return {
        "success": True,
        "analysis_type": "PENDING_ITEMS_ANALYSIS",
        "analysis_description": (
            f"Analyzed {total_records} records in '{ctx.dataset_name}' to identify items "
            f"pending to be ordered using formula: {pending_formula}. "
            f"Found {total_pending} items with outstanding/unfulfilled quantities."
        ),
        "pending_formula": pending_formula,
        "columns_used": cols_used_final,
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": aggregations,
        "pending_items_count": total_pending,
        "total_records": total_records,
    }


def _analyze_overdue_items(
    df: pd.DataFrame,
    ctx: DatasetContext,
    date_cols: List[str],
    item_name_col: Optional[str],
    item_code_col: Optional[str],
    ordered_col: Optional[str],
    required_col: Optional[str],
    priority_col: Optional[str],
) -> Dict[str, Any]:
    """Identify overdue items by comparing date column to today. Uses actual data only."""
    today = date.today()
    df = df.copy()

    if not date_cols:
        return {
            "success": False,
            "error": "No date/time columns found in dataset for overdue analysis.",
            "analysis_type": "OVERDUE_ANALYSIS",
            "findings": [],
            "primary_table": [],
            "aggregations": {},
            "columns_used": [],
        }

    date_col = date_cols[0]
    df["_parsed_date"] = pd.to_datetime(df[date_col], errors="coerce")
    overdue_df = df[df["_parsed_date"].notna() & (df["_parsed_date"].dt.date < today)].copy()

    total = len(df)
    overdue_count = len(overdue_df)
    overdue_pct = round(overdue_count / max(total, 1) * 100, 1)

    display_cols = _build_display_cols(
        item_name_col, item_code_col, date_col, priority_col,
        required_col, ordered_col,
        df_cols=list(overdue_df.columns),
    )

    overdue_df = overdue_df.sort_values("_parsed_date", ascending=True)
    primary_table = overdue_df[display_cols].head(100).fillna("").to_dict(orient="records")

    aggregations = {
        "total_records": total,
        "overdue_count": overdue_count,
        "overdue_percentage": overdue_pct,
        "date_column_used": date_col,
        "reference_date": str(today),
    }

    findings = [
        f"{overdue_count} items ({overdue_pct}%) are overdue based on "
        f"column '{date_col}' compared to today ({today})."
    ]

    return {
        "success": True,
        "analysis_type": "OVERDUE_ITEMS_ANALYSIS",
        "analysis_description": (
            f"Analyzed {total} records. Identified overdue items where '{date_col}' < {today}."
        ),
        "columns_used": display_cols,
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": aggregations,
        "overdue_count": overdue_count,
        "total_records": total,
    }


def _analyze_top_n(
    df: pd.DataFrame,
    ctx: DatasetContext,
    n: int,
    is_top: bool,
    qty_cols: List[str],
    ordered_col: Optional[str],
    required_col: Optional[str],
    item_name_col: Optional[str],
    category_col: Optional[str],
    section_col: Optional[str],
) -> Dict[str, Any]:
    """Return top/bottom N items ranked by a computed or existing quantity column."""
    df = df.copy()

    # Prefer computing a gap column if both required and ordered exist
    if required_col and ordered_col:
        df[required_col] = pd.to_numeric(df[required_col], errors="coerce").fillna(0)
        df[ordered_col] = pd.to_numeric(df[ordered_col], errors="coerce").fillna(0)
        df["_gap"] = df[required_col] - df[ordered_col]
        sort_col = "_gap"
        col_label = f"Gap ({required_col} - {ordered_col})"
    elif qty_cols:
        sort_col = qty_cols[0]
        df[sort_col] = pd.to_numeric(df[sort_col], errors="coerce").fillna(0)
        col_label = sort_col
    elif ctx.numeric_columns:
        sort_col = ctx.numeric_columns[0]
        df[sort_col] = pd.to_numeric(df[sort_col], errors="coerce").fillna(0)
        col_label = sort_col
    else:
        return {
            "success": False,
            "error": "No numeric column found for ranking analysis.",
            "analysis_type": "TOP_N_ANALYSIS",
            "findings": [],
            "primary_table": [],
            "aggregations": {},
            "columns_used": [],
        }

    sorted_df = df.sort_values(sort_col, ascending=not is_top).head(n)
    direction = "highest" if is_top else "lowest"

    display_cols = _build_display_cols(
        item_name_col, sort_col, required_col, ordered_col, "_gap" if "_gap" in df.columns else None,
        category_col, section_col,
        df_cols=list(sorted_df.columns),
    )
    rename_map = {"_gap": f"Gap ({required_col} - {ordered_col})"} if "_gap" in display_cols else {}
    primary_table = sorted_df[display_cols].rename(columns=rename_map).fillna("").to_dict(orient="records")

    findings = [
        f"Top {n} items with {direction} {col_label} identified from {len(df)} total records."
    ]
    if len(sorted_df) > 0 and item_name_col and item_name_col in sorted_df.columns:
        top_item = sorted_df.iloc[0][item_name_col]
        top_val = sorted_df.iloc[0][sort_col]
        findings.append(f"The item with {direction} {col_label} is '{top_item}' ({top_val:,.0f}).")

    return {
        "success": True,
        "analysis_type": "TOP_N_ANALYSIS",
        "analysis_description": f"Ranked {len(df)} records by {direction} '{col_label}' and returned top {n}.",
        "columns_used": display_cols,
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": {"n": n, "sort_column": col_label, "direction": direction, "total_records": len(df)},
        "total_records": len(df),
    }


def _analyze_by_dimension(
    df: pd.DataFrame,
    ctx: DatasetContext,
    dim_col: str,
    qty_cols: List[str],
    ordered_col: Optional[str],
    required_col: Optional[str],
) -> Dict[str, Any]:
    """Aggregate and analyze data by a categorical dimension using actual column values."""
    df = df.copy()

    if dim_col not in df.columns:
        return {
            "success": False,
            "error": f"Column '{dim_col}' not found in dataset.",
            "analysis_type": "DIMENSION_ANALYSIS",
            "findings": [],
            "primary_table": [],
            "aggregations": {},
            "columns_used": [dim_col],
        }

    agg_dict: Dict[str, Any] = {"count": df.groupby(dim_col).size()}

    if required_col and required_col in df.columns:
        df[required_col] = pd.to_numeric(df[required_col], errors="coerce").fillna(0)
        agg_dict[f"total_{required_col}"] = df.groupby(dim_col)[required_col].sum()

    if ordered_col and ordered_col in df.columns:
        df[ordered_col] = pd.to_numeric(df[ordered_col], errors="coerce").fillna(0)
        agg_dict[f"total_{ordered_col}"] = df.groupby(dim_col)[ordered_col].sum()

    summary = pd.DataFrame(agg_dict).reset_index().sort_values("count", ascending=False)

    req_total_col = f"total_{required_col}" if required_col else None
    ord_total_col = f"total_{ordered_col}" if ordered_col else None

    if req_total_col in summary.columns and ord_total_col in summary.columns:
        summary["pending_qty"] = summary[req_total_col] - summary[ord_total_col]

    primary_table = summary.fillna(0).to_dict(orient="records")

    findings = []
    if len(summary) > 0:
        top = summary.iloc[0]
        findings.append(
            f"'{top[dim_col]}' has the highest item count ({int(top['count'])}) "
            f"among all {len(summary)} '{dim_col}' groups."
        )
    if "pending_qty" in summary.columns and len(summary) > 0:
        top_pending = summary.sort_values("pending_qty", ascending=False).iloc[0]
        findings.append(
            f"'{top_pending[dim_col]}' has the highest pending quantity "
            f"({top_pending['pending_qty']:,.0f} units)."
        )

    cols_used = [dim_col] + ([required_col] if required_col else []) + ([ordered_col] if ordered_col else [])

    return {
        "success": True,
        "analysis_type": "DIMENSION_ANALYSIS",
        "analysis_description": f"Aggregated {len(df)} records by '{dim_col}' ({df[dim_col].nunique()} unique values).",
        "columns_used": cols_used,
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": {
            "dimension_column": dim_col,
            "unique_values": int(df[dim_col].nunique()),
            "total_records": len(df),
        },
        "total_records": len(df),
    }


def _analyze_general(
    df: pd.DataFrame,
    ctx: DatasetContext,
    qty_cols: List[str],
    ordered_col: Optional[str],
    required_col: Optional[str],
    item_name_col: Optional[str],
) -> Dict[str, Any]:
    """
    General analysis when no specific pattern is matched.
    Shows basic stats for numeric columns and a sample of actual data.
    """
    findings = []
    total_records = len(df)

    aggregations: Dict[str, Any] = {"total_records": total_records}

    if qty_cols:
        num_stats: Dict[str, Any] = {}
        for col in qty_cols[:6]:
            series = pd.to_numeric(df[col], errors="coerce")
            num_stats[col] = {
                "sum": round(float(series.sum()), 2),
                "mean": round(float(series.mean()), 2),
                "non_zero_count": int((series > 0).sum()),
                "null_count": int(series.isna().sum()),
            }
        aggregations["numeric_column_summary"] = num_stats
        findings.append(f"Dataset '{ctx.dataset_name}' contains {total_records} records across {len(df.columns)} columns.")
        for col, stats in num_stats.items():
            findings.append(
                f"Column '{col}': total={stats['sum']:,.2f}, average={stats['mean']:,.2f}, "
                f"{stats['non_zero_count']} non-zero values."
            )

    # Show a relevant sample of actual data
    display_cols = [c for c in (ctx.question_relevant_columns or list(df.columns)) if c in df.columns][:8]
    primary_table = df[display_cols].head(25).fillna("").to_dict(orient="records") if display_cols else []

    # Add unmappable concepts to general analysis
    if ctx.unmappable_concepts:
        findings.append(
            f"Note: The following concepts from the question could not be mapped to dataset columns: "
            f"{', '.join(ctx.unmappable_concepts)}. Analysis proceeded with available data."
        )

    return {
        "success": True,
        "analysis_type": "GENERAL_ANALYSIS",
        "analysis_description": f"General analysis of {total_records} records across {len(df.columns)} columns in '{ctx.dataset_name}'.",
        "columns_used": qty_cols[:5] + (ctx.question_relevant_columns[:5] if ctx.question_relevant_columns else []),
        "findings": findings,
        "primary_table": primary_table,
        "aggregations": aggregations,
        "total_records": total_records,
    }


# ── Question-to-Data Mapping ──────────────────────────────────────────────────

def _build_question_mapping(
    question: str,
    all_columns: List[str],
    sample_values: Dict[str, List],
    numeric_columns: List[str],
    categorical_columns: List[str],
    date_columns: List[str],
) -> tuple:
    """
    Map business concepts from the user's question to actual dataset columns.

    Returns:
        (mapping_dict, unmappable_concepts_list)
        mapping_dict: {concept: column_name_or_None}
        unmappable: list of concepts that have no matching column
    """
    q_lower = question.lower()
    concept_keywords = {
        "revenue": ["revenue", "sales", "income", "total_revenue", "amount", "value"],
        "region": ["region", "country", "state", "territory", "area", "geography", "location"],
        "segment": ["segment", "customer_segment", "customer_type", "tier", "cohort"],
        "product": ["product", "item", "sku", "material", "item_name", "product_name"],
        "period": ["quarter", "month", "year", "date", "period", "fiscal", "time"],
        "quantity": ["qty", "quantity", "count", "units", "volume", "number"],
        "cost": ["cost", "expense", "price", "unit_price", "unit_cost"],
        "profit": ["profit", "margin", "net", "gross"],
        "category": ["category", "type", "group", "class", "section", "department"],
        "channel": ["channel", "source", "medium", "platform"],
        "status": ["status", "state", "phase", "stage"],
    }

    mapping = {}
    unmappable = []
    cols_lower = {c.lower(): c for c in all_columns}

    for concept, keywords in concept_keywords.items():
        # Only map if the concept is mentioned in the question
        if not any(k in q_lower for k in [concept] + keywords[:2]):
            continue

        matched_col = None
        for kw in keywords:
            for col_lower, col_real in cols_lower.items():
                if kw in col_lower:
                    matched_col = col_real
                    break
            if matched_col:
                break

        mapping[concept] = matched_col
        if matched_col is None:
            unmappable.append(concept)

    return mapping, unmappable


# ── Period-over-Period Comparison Analysis ─────────────────────────────────────

def _analyze_period_comparison(
    df: pd.DataFrame,
    ctx: DatasetContext,
    metric_col: str,
    date_cols: List[str],
    cat_cols: List[str],
    region_col: Optional[str],
    segment_col: Optional[str],
    category_col: Optional[str],
    section_col: Optional[str],
) -> Dict[str, Any]:
    """
    Analyze metric changes across time periods.

    Detects temporal groupings (quarter, month, year) from date columns,
    computes actual period-over-period changes, and performs premise validation.

    NEVER fabricates period data. If no date column exists, reports that
    temporal analysis is unavailable.
    """
    findings = []
    q_lower = ctx.question.lower()
    total_records = len(df)

    # Ensure metric column is numeric
    df = df.copy()
    df[metric_col] = pd.to_numeric(df[metric_col], errors="coerce")

    # Find a period column (explicit quarter/month column or derive from date)
    period_col = None
    period_type = None

    # Check for explicit period categorical columns
    for col in cat_cols:
        col_lower = col.lower()
        if any(k in col_lower for k in ["quarter", "qtr"]):
            period_col = col
            period_type = "quarter"
            break
        elif "month" in col_lower:
            period_col = col
            period_type = "month"
            break
        elif "year" in col_lower and "month" not in col_lower:
            period_col = col
            period_type = "year"
            break

    # Derive period from date column if no explicit period column
    if not period_col and date_cols:
        date_col = date_cols[0]
        try:
            dt_series = pd.to_datetime(df[date_col], errors="coerce")
            valid_dates = dt_series.dropna()
            if len(valid_dates) > 0:
                date_range = (valid_dates.max() - valid_dates.min()).days
                if date_range > 90:
                    df["_derived_quarter"] = "Q" + dt_series.dt.quarter.astype(str)
                    period_col = "_derived_quarter"
                    period_type = "quarter"
                elif date_range > 28:
                    df["_derived_month"] = dt_series.dt.strftime("%Y-%m")
                    period_col = "_derived_month"
                    period_type = "month"
                else:
                    df["_derived_week"] = dt_series.dt.isocalendar().week.astype(str)
                    period_col = "_derived_week"
                    period_type = "week"
        except Exception as e:
            logger.warning(f"Period derivation failed: {e}")

    # If no period can be determined, report it honestly
    if not period_col:
        findings.append(
            f"Temporal analysis requested but no date or period column found in dataset '{ctx.dataset_name}'. "
            f"Available columns: {', '.join(ctx.all_columns[:10])}. "
            f"Cannot perform period-over-period comparison."
        )
        # Fall through to basic metric analysis
        metric_series = df[metric_col].dropna()
        if len(metric_series) > 0:
            findings.append(
                f"Overall '{metric_col}' statistics: "
                f"total={metric_series.sum():,.2f}, mean={metric_series.mean():,.2f}, "
                f"median={metric_series.median():,.2f}, count={len(metric_series):,}."
            )
        return {
            "success": True,
            "analysis_type": "PERIOD_ANALYSIS_UNAVAILABLE",
            "analysis_description": f"Period comparison not possible — no temporal column available in '{ctx.dataset_name}'.",
            "columns_used": [metric_col],
            "findings": findings,
            "primary_table": [],
            "aggregations": {"metric_column": metric_col, "period_column": None, "reason": "no_temporal_column"},
            "total_records": total_records,
            "data_sufficiency": {"temporal_analysis": False, "metric_available": True},
        }

    # Compute period-level aggregation
    period_summary = (
        df.groupby(period_col, dropna=True)[metric_col]
        .agg(["sum", "mean", "count"])
        .reset_index()
        .rename(columns={"sum": "total", "mean": "average", "count": "record_count"})
        .sort_values(period_col)
    )

    if len(period_summary) < 2:
        findings.append(
            f"Only {len(period_summary)} {period_type or 'period'}(s) found. "
            f"At least 2 periods are needed for comparison."
        )
        return {
            "success": True,
            "analysis_type": "INSUFFICIENT_PERIODS",
            "analysis_description": f"Only {len(period_summary)} period found — insufficient for comparison.",
            "columns_used": [metric_col, period_col],
            "findings": findings,
            "primary_table": period_summary.fillna("").to_dict(orient="records"),
            "aggregations": {"metric_column": metric_col, "period_column": period_col, "periods_found": len(period_summary)},
            "total_records": total_records,
            "data_sufficiency": {"temporal_analysis": False, "metric_available": True},
        }

    # Compute period-over-period changes
    period_summary["pct_change"] = period_summary["total"].pct_change() * 100
    period_summary["abs_change"] = period_summary["total"].diff()

    # Overall direction
    first_period_val = float(period_summary.iloc[0]["total"])
    last_period_val = float(period_summary.iloc[-1]["total"])
    overall_change_pct = ((last_period_val - first_period_val) / abs(first_period_val) * 100) if first_period_val != 0 else 0

    if overall_change_pct > 0:
        direction = "increased"
    elif overall_change_pct < 0:
        direction = "decreased"
    else:
        direction = "remained unchanged"

    findings.append(
        f"'{metric_col}' {direction} by {abs(overall_change_pct):.1f}% "
        f"from {period_summary.iloc[0][period_col]} ({first_period_val:,.2f}) "
        f"to {period_summary.iloc[-1][period_col]} ({last_period_val:,.2f})."
    )

    # Premise validation — check if user's assumption matches data
    premise_result = validate_premise(ctx.question, direction, overall_change_pct, metric_col)
    if premise_result:
        findings.append(premise_result)

    # Find largest period-over-period swing
    if len(period_summary) > 1:
        changes = period_summary.dropna(subset=["pct_change"])
        if len(changes) > 0:
            max_change_idx = changes["pct_change"].abs().idxmax()
            max_row = changes.loc[max_change_idx]
            change_dir = "increase" if max_row["pct_change"] > 0 else "decrease"
            findings.append(
                f"Largest period-over-period {change_dir}: {abs(max_row['pct_change']):.1f}% "
                f"in {max_row[period_col]} (Δ{max_row['abs_change']:+,.2f})."
            )

    # Dimensional breakdown if available
    breakdown_tables = {}
    breakdown_col = region_col or segment_col or category_col or section_col
    if breakdown_col and breakdown_col in df.columns:
        dim_period = (
            df.groupby([breakdown_col, period_col], dropna=True)[metric_col]
            .sum()
            .reset_index()
            .pivot_table(index=breakdown_col, columns=period_col, values=metric_col, fill_value=0)
        )
        if dim_period.shape[0] > 0 and dim_period.shape[1] >= 2:
            cols = list(dim_period.columns)
            dim_period["change"] = dim_period[cols[-1]] - dim_period[cols[0]]
            dim_period["pct_change"] = ((dim_period[cols[-1]] - dim_period[cols[0]]) / dim_period[cols[0]].replace(0, np.nan) * 100)
            dim_period = dim_period.sort_values("change")
            breakdown_tables[breakdown_col] = dim_period.reset_index().fillna("").to_dict(orient="records")

            top_decliner = dim_period.iloc[0]
            findings.append(
                f"By '{breakdown_col}': '{top_decliner.name}' had the largest absolute change "
                f"(Δ{top_decliner['change']:+,.2f}, {top_decliner['pct_change']:+.1f}% change)."
            )

    primary_table = period_summary.fillna("").to_dict(orient="records")

    return {
        "success": True,
        "analysis_type": "PERIOD_COMPARISON",
        "analysis_description": (
            f"Period-over-period analysis of '{metric_col}' across {len(period_summary)} "
            f"{period_type or 'period'}s in '{ctx.dataset_name}'."
        ),
        "columns_used": [metric_col, period_col] + ([breakdown_col] if breakdown_col else []),
        "findings": findings,
        "primary_table": primary_table,
        "breakdown_tables": breakdown_tables,
        "aggregations": {
            "metric_column": metric_col,
            "period_column": period_col,
            "period_type": period_type,
            "periods_found": len(period_summary),
            "overall_change_pct": round(overall_change_pct, 2),
            "overall_direction": direction,
            "first_period": str(period_summary.iloc[0][period_col]),
            "last_period": str(period_summary.iloc[-1][period_col]),
            "first_period_value": round(first_period_val, 2),
            "last_period_value": round(last_period_val, 2),
        },
        "total_records": total_records,
        "data_sufficiency": {"temporal_analysis": True, "metric_available": True},
    }


# ── Premise Validation ────────────────────────────────────────────────────────

def validate_premise(
    question: str,
    actual_direction: str,
    change_pct: float,
    metric_name: str,
) -> Optional[str]:
    """
    Challenge the user's premise when the data contradicts their assumption.

    If the user asks 'Why did revenue decline?' but revenue actually increased,
    this function returns an explicit correction.

    Returns:
        A premise validation string if the user's assumption is wrong, or None if consistent.
    """
    q_lower = question.lower()

    # Detect assumed direction
    user_assumes_decline = any(k in q_lower for k in [
        "decline", "decrease", "drop", "fell", "fall", "loss", "losing",
        "went down", "going down", "reduced", "shrink", "shrunk",
    ])
    user_assumes_increase = any(k in q_lower for k in [
        "increase", "growth", "grew", "rise", "rising", "went up", "going up",
        "surge", "spike", "jumped", "soar",
    ])

    if user_assumes_decline and actual_direction == "increased":
        return (
            f"⚠ PREMISE CHALLENGE: The question assumes '{metric_name}' declined, "
            f"but the data shows it actually INCREASED by {abs(change_pct):.1f}%. "
            f"The analysis below reflects the actual data direction."
        )
    elif user_assumes_increase and actual_direction == "decreased":
        return (
            f"⚠ PREMISE CHALLENGE: The question assumes '{metric_name}' increased, "
            f"but the data shows it actually DECREASED by {abs(change_pct):.1f}%. "
            f"The analysis below reflects the actual data direction."
        )
    elif (user_assumes_decline or user_assumes_increase) and actual_direction == "remained unchanged":
        assumed = "decline" if user_assumes_decline else "increase"
        return (
            f"⚠ PREMISE CHALLENGE: The question assumes a {assumed} in '{metric_name}', "
            f"but the data shows NO SIGNIFICANT CHANGE ({change_pct:+.1f}%). "
            f"The assumption is not supported by the dataset."
        )

    return None




def generate_grounded_hypotheses(
    ctx: DatasetContext,
    analysis_result: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Generate testable hypotheses based on actual dataset schema and analysis results.

    NEVER generates generic revenue/regional/cohort hypotheses.
    All hypothesis titles and variables reference actual column names from the dataset.
    """
    hypotheses = []
    cat_cols = ctx.categorical_columns
    num_cols = ctx.numeric_columns
    date_cols = ctx.date_columns
    agg = analysis_result.get("aggregations", {})
    dim_summary = agg.get("dimensional_summary", {})
    analysis_type = analysis_result.get("analysis_type", "")
    hyp_id = 0

    # H1: Categorical distribution hypothesis (for each relevant cat col)
    for cat_col in cat_cols[:3]:
        unique_vals = ctx.unique_counts.get(cat_col, 0)
        if 2 <= unique_vals <= 100:
            hyp_id += 1
            sample_vals = ctx.sample_values.get(cat_col, [])
            sample_str = ", ".join([repr(str(s)) for s in sample_vals[:2]])
            hypotheses.append({
                "id": f"hyp_{hyp_id}",
                "title": f"Unequal Distribution of Records Across '{cat_col}' Groups",
                "statement": (
                    f"The distribution of records is significantly unequal across the "
                    f"{unique_vals} distinct values of '{cat_col}' (e.g., {sample_str}), "
                    f"with certain groups having disproportionately higher counts or quantities."
                ),
                "why_generated": (
                    f"Column '{cat_col}' has {unique_vals} unique categorical values in the dataset. "
                    f"Chi-square test will verify if distribution deviates from uniform."
                ),
                "expected_mechanism": (
                    f"Structural concentration: most records belong to a small subset of '{cat_col}' values."
                ),
                "variables": [cat_col] + ([num_cols[0]] if num_cols else []),
                "confidence": 0.70,
                "causal_classification": "HYPOTHESIS_TO_TEST",
            })
            if len(hypotheses) >= 2:
                break

    # H2: Numeric column variation hypothesis
    for num_col in num_cols[:2]:
        hyp_id += 1
        hypotheses.append({
            "id": f"hyp_{hyp_id}",
            "title": f"Significant Skew or Outliers in '{num_col}'",
            "statement": (
                f"The distribution of '{num_col}' values is significantly non-uniform, "
                f"with a small number of records accounting for a disproportionate share of the total."
            ),
            "why_generated": (
                f"Numeric column '{num_col}' detected in dataset. "
                f"Testing for Pareto concentration and distributional skewness."
            ),
            "expected_mechanism": (
                f"A few records with unusually high or low '{num_col}' values drive the overall outcome."
            ),
            "variables": [num_col] + ([cat_cols[0]] if cat_cols else []),
            "confidence": 0.65,
            "causal_classification": "HYPOTHESIS_TO_TEST",
        })
        if len(hypotheses) >= 3:
            break

    # H3: Temporal hypothesis (if date columns exist)
    if date_cols and num_cols:
        hyp_id += 1
        hypotheses.append({
            "id": f"hyp_{hyp_id}",
            "title": f"Temporal Pattern Between '{date_cols[0]}' and '{num_cols[0]}'",
            "statement": (
                f"Records with earlier '{date_cols[0]}' dates may exhibit systematically "
                f"different '{num_cols[0]}' values compared to more recent records."
            ),
            "why_generated": (
                f"Dataset contains date column '{date_cols[0]}' and numeric column '{num_cols[0]}'. "
                f"Testing for time-based trends or seasonal patterns."
            ),
            "expected_mechanism": f"Time-driven variation in '{num_cols[0]}' linked to '{date_cols[0]}'.",
            "variables": [date_cols[0], num_cols[0]],
            "confidence": 0.60,
            "causal_classification": "HYPOTHESIS_TO_TEST",
        })

    # Fallback if no hypotheses generated
    if not hypotheses:
        hyp_id += 1
        relevant_cols = ctx.question_relevant_columns[:3] or (num_cols[:1] + cat_cols[:1])
        hypotheses.append({
            "id": f"hyp_{hyp_id}",
            "title": "Pareto Concentration in Dataset Records",
            "statement": (
                f"A small subset of records in '{ctx.dataset_name}' accounts for "
                f"the majority of the signal relevant to: \"{ctx.question}\""
            ),
            "why_generated": "General Pareto principle test applied to available dataset columns.",
            "expected_mechanism": "80/20 distribution pattern in the key metrics.",
            "variables": relevant_cols,
            "confidence": 0.55,
            "causal_classification": "HYPOTHESIS_TO_TEST",
        })

    return hypotheses[:4]


# ── Statistical Testing ────────────────────────────────────────────────────────

def test_hypothesis_on_real_data(
    ctx: DatasetContext,
    hypothesis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Perform a real statistical test for a hypothesis using actual dataset values.

    Returns a test result dict with actual values from real data.
    If test cannot be performed: returns INSUFFICIENT_DATA status.
    NEVER fabricates statistical values.
    """
    try:
        from scipy import stats as scipy_stats
        scipy_available = True
    except ImportError:
        scipy_available = False

    df = ctx.get_df()
    if df is None:
        return {
            "test_name": "DATASET_NOT_AVAILABLE",
            "status": "INSUFFICIENT_DATA",
            "error": "Dataset not available in memory for statistical testing.",
            "statistic": None,
            "p_value": None,
            "effect_size": None,
            "interpretation": "Statistical test could not be performed: dataset not loaded.",
            "data_rows_used": 0,
            "columns_used": [],
        }

    if not scipy_available:
        return {
            "test_name": "SCIPY_NOT_AVAILABLE",
            "status": "INSUFFICIENT_DATA",
            "error": "scipy library not available for statistical testing.",
            "statistic": None,
            "p_value": None,
            "effect_size": None,
            "interpretation": "Statistical test skipped: scipy not installed.",
            "data_rows_used": len(df),
            "columns_used": [],
        }

    variables = hypothesis.get("variables", [])
    df = df.copy()

    # Find numeric and categorical variables from hypothesis
    num_var = next((v for v in variables if v in ctx.numeric_columns and v in df.columns), None)
    cat_var = next((v for v in variables if v in ctx.categorical_columns and v in df.columns), None)
    date_var = next((v for v in variables if v in ctx.date_columns and v in df.columns), None)

    # ── Test A: Kruskal-Wallis — does numeric var differ across categorical groups? ──
    if cat_var and num_var:
        df[num_var] = pd.to_numeric(df[num_var], errors="coerce")
        groups = [
            grp[num_var].dropna().values
            for _, grp in df.groupby(cat_var)
            if len(grp[num_var].dropna()) >= 2
        ]
        if len(groups) >= 2:
            try:
                stat, p_val = scipy_stats.kruskal(*groups)
                rows_used = int(df[[cat_var, num_var]].dropna().shape[0])
                is_sig = bool(p_val < 0.05)
                return {
                    "test_name": "Kruskal-Wallis H-test",
                    "status": "SUPPORTED" if is_sig else "NOT_SUPPORTED",
                    "variables_tested": [cat_var, num_var],
                    "groups_tested": len(groups),
                    "rows_used": rows_used,
                    "statistic": round(float(stat), 4),
                    "p_value": round(float(p_val), 6),
                    "effect_size": None,
                    "interpretation": (
                        f"Kruskal-Wallis test on '{num_var}' across '{cat_var}' groups: "
                        f"H={stat:.2f}, p={p_val:.4f} (n={rows_used}). "
                        f"{'Statistically significant difference detected' if is_sig else 'No significant difference detected'} "
                        f"across {len(groups)} groups at alpha=0.05."
                    ),
                    "data_rows_used": rows_used,
                    "columns_used": [cat_var, num_var],
                }
            except Exception as e:
                logger.warning(f"Kruskal-Wallis test failed: {e}")

    # ── Test B: Chi-square goodness of fit on categorical column ──
    if cat_var:
        val_counts = df[cat_var].dropna().value_counts()
        n = int(val_counts.sum())
        k = len(val_counts)
        if k >= 2 and n >= 5:
            try:
                observed = val_counts.values
                expected = [n / k] * k
                stat, p_val = scipy_stats.chisquare(observed, expected)
                is_sig = bool(p_val < 0.05)
                return {
                    "test_name": "Chi-Square Goodness of Fit",
                    "status": "SUPPORTED" if is_sig else "NOT_SUPPORTED",
                    "variables_tested": [cat_var],
                    "categories_tested": k,
                    "rows_used": n,
                    "statistic": round(float(stat), 4),
                    "p_value": round(float(p_val), 6),
                    "effect_size": None,
                    "interpretation": (
                        f"Chi-square test on '{cat_var}' distribution (k={k} categories, n={n}): "
                        f"chi2={stat:.2f}, p={p_val:.4f}. "
                        f"{'Significant deviation from uniform distribution detected' if is_sig else 'Distribution does not significantly deviate from uniform'} at alpha=0.05."
                    ),
                    "data_rows_used": n,
                    "columns_used": [cat_var],
                }
            except Exception as e:
                logger.warning(f"Chi-square test failed: {e}")

    # ── Test C: Normality / skewness on numeric column ──
    if num_var:
        values = pd.to_numeric(df[num_var], errors="coerce").dropna().values
        if len(values) >= 3:
            try:
                skewness = float(pd.Series(values).skew())
                if len(values) <= 50:
                    stat, p_val = scipy_stats.shapiro(values)
                    test_name = "Shapiro-Wilk Normality Test"
                else:
                    # Normalize before KS test
                    norm_vals = (values - np.mean(values)) / np.std(values)
                    stat, p_val = scipy_stats.kstest(norm_vals, "norm")
                    test_name = "Kolmogorov-Smirnov Normality Test"
                is_sig = bool(p_val < 0.05)
                return {
                    "test_name": test_name,
                    "status": "SUPPORTED" if is_sig else "NOT_SUPPORTED",
                    "variables_tested": [num_var],
                    "rows_used": len(values),
                    "statistic": round(float(stat), 4),
                    "p_value": round(float(p_val), 6),
                    "skewness": round(skewness, 4),
                    "effect_size": None,
                    "interpretation": (
                        f"{test_name} on '{num_var}' (n={len(values)}): "
                        f"statistic={stat:.4f}, p={p_val:.4f}, skewness={skewness:.2f}. "
                        f"{'Non-normal distribution detected' if is_sig else 'Distribution appears approximately normal'} at alpha=0.05."
                    ),
                    "data_rows_used": len(values),
                    "columns_used": [num_var],
                }
            except Exception as e:
                logger.warning(f"Normality test failed: {e}")

    # No test could be run
    return {
        "test_name": "INSUFFICIENT_DATA",
        "status": "INSUFFICIENT_DATA",
        "error": (
            f"Could not find compatible column pair for testing. "
            f"Variables requested: {variables}. "
            f"Available numeric columns: {ctx.numeric_columns[:5]}. "
            f"Available categorical columns: {ctx.categorical_columns[:5]}."
        ),
        "statistic": None,
        "p_value": None,
        "effect_size": None,
        "interpretation": (
            "Statistical test could not be performed with the available dataset columns. "
            "Insufficient data or incompatible column types."
        ),
        "data_rows_used": 0,
        "columns_used": [],
    }
