"""
DataPilot Semantic Question Parser & Schema Planner
====================================================
Parses natural-language analytical questions into structured, mathematically
traceable analytical plans without assuming any hardcoded business domain.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np


class AnalyticalIntent(str, Enum):
    COUNT = "COUNT"
    SUM = "SUM"
    AVERAGE = "AVERAGE"
    MIN = "MIN"
    MAX = "MAX"
    MEDIAN = "MEDIAN"
    PERCENTAGE = "PERCENTAGE"
    LIST = "LIST"
    TOP_N = "TOP_N"
    BOTTOM_N = "BOTTOM_N"
    GROUP_BY = "GROUP_BY"
    DISTRIBUTION = "DISTRIBUTION"
    CORRELATION = "CORRELATION"
    COMPARISON = "COMPARISON"
    VOLUME = "VOLUME"
    MISSING_VALUES = "MISSING_VALUES"
    SCHEMA_CHECK = "SCHEMA_CHECK"
    GENERAL = "GENERAL"


@dataclass
class FilterCondition:
    column_concept: str
    operator: str  # ">", "<", ">=", "<=", "==", "!=", "in", "contains"
    threshold: Any  # float, int, str
    raw_expression: str


@dataclass
class StructuredAnalysisPlan:
    raw_question: str
    intent: AnalyticalIntent
    target_entity: str  # "items", "records", "customers", "orders", etc.
    metric_concept: Optional[str] = None
    filter_condition: Optional[FilterCondition] = None
    dimension_concept: Optional[str] = None
    order_direction: Optional[str] = None  # "ASC", "DESC"
    limit: Optional[int] = None
    secondary_operations: List[str] = field(default_factory=list)


def parse_analytical_question(question: str) -> StructuredAnalysisPlan:
    """
    Parse a user query into a structured execution plan.
    Discovers:
    1. Analytical Intent (COUNT, SUM, AVERAGE, MIN, MAX, LIST, TOP_N, etc.)
    2. Target Metric Concept (e.g., 'required quantity', 'ordered quantity', 'unit price')
    3. Filter Conditions (e.g., operator '>' and threshold 100)
    4. Grouping Dimensions (e.g., 'by category', 'by region')
    5. Ranking & Limits (e.g., top 10)
    """
    q_clean = question.strip()
    q_lower = q_clean.lower()

    # 1. Volume queries (e.g., "How many records/rows/entries are in the dataset?")
    is_pure_volume = bool(re.search(
        r"\b(?:how many (?:total )?(?:records|rows|entries|lines)|number of (?:records|rows|entries)|total (?:records|rows)|dataset size)\b",
        q_lower
    )) and not any(k in q_lower for k in [">", "<", "=", "more than", "greater than", "less than", "where", "with", "which"])

    if is_pure_volume:
        return StructuredAnalysisPlan(
            raw_question=q_clean,
            intent=AnalyticalIntent.VOLUME,
            target_entity="records",
            metric_concept=None,
        )

    # 2. Missing values queries
    if any(k in q_lower for k in ["missing value", "missing values", "null count", "null values", "nulls", "empty cells", "nan values"]):
        return StructuredAnalysisPlan(
            raw_question=q_clean,
            intent=AnalyticalIntent.MISSING_VALUES,
            target_entity="columns",
        )

    # 3. Schema checks (e.g. "Does this dataset contain revenue?")
    if any(k in q_lower for k in ["does this dataset contain", "does the dataset contain", "is there a", "contain column", "has column"]):
        return StructuredAnalysisPlan(
            raw_question=q_clean,
            intent=AnalyticalIntent.SCHEMA_CHECK,
            target_entity="schema",
        )

    # 4. Extract Filter Condition (e.g., "more than 100", "> 100", "= 0", "zero")
    filter_cond: Optional[FilterCondition] = None

    # Regex patterns for comparison extraction:
    # Pattern A: "more than 100", "greater than 100", "above 100", "> 100", "exceeding 100", "over 100"
    gt_match = re.search(r"(?:more than|greater than|above|exceeding|over|higher than|>)\s*([0-9]+(?:\.[0-9]+)?)", q_lower)
    # Pattern B: "less than 100", "fewer than 100", "below 100", "under 100", "< 100", "lower than 100"
    lt_match = re.search(r"(?:less than|fewer than|below|under|lower than|<)\s*([0-9]+(?:\.[0-9]+)?)", q_lower)
    # Pattern C: "at least 100", "no less than 100", ">= 100", "100 or more"
    gte_match = re.search(r"(?:at least|no less than|>=)\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:or more|or greater|\+)", q_lower)
    # Pattern D: "at most 100", "no more than 100", "<= 100", "up to 100"
    lte_match = re.search(r"(?:at most|no more than|<=|up to)\s*([0-9]+(?:\.[0-9]+)?)", q_lower)
    # Pattern E: "equal to 100", "= 100", "is 0", "have zero", "with 0"
    eq_zero_match = re.search(r"\b(?:have|with|is|are|has)\s+(?:zero|0)\b|\b(?:equal to|equals|=)\s*([0-9]+(?:\.[0-9]+)?)", q_lower)

    # Pattern F: "between X and Y"
    between_match = re.search(r"\bbetween\s+([0-9]+(?:\.[0-9]+)?)\s+and\s+([0-9]+(?:\.[0-9]+)?)\b", q_lower)

    if gte_match:
        val = float(gte_match.group(1) or gte_match.group(2))
        filter_cond = FilterCondition(column_concept="", operator=">=", threshold=val, raw_expression=f">= {val}")
    elif lte_match:
        val = float(lte_match.group(1))
        filter_cond = FilterCondition(column_concept="", operator="<=", threshold=val, raw_expression=f"<= {val}")
    elif gt_match:
        val = float(gt_match.group(1))
        filter_cond = FilterCondition(column_concept="", operator=">", threshold=val, raw_expression=f"> {val}")
    elif lt_match:
        val = float(lt_match.group(1))
        filter_cond = FilterCondition(column_concept="", operator="<", threshold=val, raw_expression=f"< {val}")
    elif eq_zero_match:
        val = float(eq_zero_match.group(1)) if eq_zero_match.group(1) else 0.0
        filter_cond = FilterCondition(column_concept="", operator="==", threshold=val, raw_expression=f"== {val}")

    # 5. Extract Limit (e.g., "top 10", "10 items", "first 5")
    limit_match = re.search(r"\b(?:top|first|highest|largest|bottom|lowest|smallest)\s+(\d+)\b|\b(\d+)\s+(?:items?|records?|rows?|products?|parts?)\b", q_lower)
    limit_n = int(limit_match.group(1) or limit_match.group(2)) if limit_match else None

    # 6. Extract Group By Dimension Concept (e.g. "by category", "by region", "per department", "each plant")
    group_match = re.search(r"\b(?:by|per|across|for each)\s+([a-z0-9_\s]+?)(?:\s+(?:category|region|plant|department|section|status|dimension|group))?\b", q_lower)
    dim_concept = None
    if "by category" in q_lower or "which category" in q_lower:
        dim_concept = "category"
    elif "by section" in q_lower or "which section" in q_lower:
        dim_concept = "section"
    elif "by region" in q_lower or "which region" in q_lower:
        dim_concept = "region"
    elif "by plant" in q_lower or "which plant" in q_lower:
        dim_concept = "plant"
    elif "by department" in q_lower:
        dim_concept = "department"
    elif "by status" in q_lower:
        dim_concept = "status"
    elif "by priority" in q_lower:
        dim_concept = "priority"

    # 7. Extract Target Metric Concept
    metric_concept = None
    if "qty to be order" in q_lower or "quantity to be ordered" in q_lower or "to be order" in q_lower or "ordered quantity" in q_lower or "qty ordered" in q_lower or "po qty" in q_lower:
        metric_concept = "ordered_quantity"
    elif "required quantity" in q_lower or "qty required" in q_lower or "quantity required" in q_lower or "required" in q_lower or "demand" in q_lower or "needed" in q_lower:
        metric_concept = "required_quantity"
    elif "outstanding" in q_lower or "pending" in q_lower or "balance" in q_lower:
        metric_concept = "outstanding_quantity"
    elif "unit price" in q_lower or "price" in q_lower:
        metric_concept = "unit_price"
    elif "unit cost" in q_lower or "cost" in q_lower:
        metric_concept = "unit_cost"
    elif "lead time" in q_lower:
        metric_concept = "lead_time"
    elif "safety stock" in q_lower:
        metric_concept = "safety_stock"
    elif "revenue" in q_lower or "sales" in q_lower:
        metric_concept = "revenue"

    if filter_cond:
        filter_cond.column_concept = metric_concept or "metric"

    # 8. Classify Primary Analytical Intent
    # COUNT
    is_count = bool(re.search(
        r"\b(?:how many|count of|number of|count)\b",
        q_lower
    )) or ("how many" in q_lower)

    # SUM
    is_sum = bool(re.search(
        r"\b(?:what is (?:the )?total|total of|sum of|how much total|sum|aggregate|grand total|overall total)\b",
        q_lower
    )) and not is_count

    # AVERAGE / MEAN
    is_avg = bool(re.search(
        r"\b(?:what is the average|average of|average|mean of|mean|avg of|avg)\b",
        q_lower
    )) and not is_count

    # CAUSAL / PATTERN / EXPLANATORY QUESTION
    is_causal = bool(re.search(
        r"\b(?:why|explain|patterns?|drivers?|root cause|correlat(?:ion|e)|caus(?:ation|al)|analyz(?:e|is)|investigat(?:e|ion)|reasons?|influenc(?:e|ing))\b",
        q_lower
    ))

    # MIN / MAX
    is_max = (not is_causal) and bool(re.search(
        r"\b(?:what is the highest|highest|maximum|max|greatest|largest|peak)\b",
        q_lower
    )) and not (limit_n is not None and limit_n > 1) and not is_count

    is_min = (not is_causal) and bool(re.search(
        r"\b(?:what is the lowest|lowest|minimum|min|smallest|least)\b",
        q_lower
    )) and not (limit_n is not None and limit_n > 1) and not is_count

    # PERCENTAGE
    is_pct = bool(re.search(
        r"\b(?:what percentage|percentage of|percent of|share of|proportion of|ratio of)\b",
        q_lower
    ))

    # LIST / FILTER
    is_list = (not is_causal) and bool(re.search(
        r"\b(?:which items|which records|list all|list of|show items|show all|which parts|which products|give me the items|find all)\b",
        q_lower
    )) and not is_count and not (limit_n is not None and limit_n > 1)

    # TOP_N / BOTTOM_N
    is_top_n = (limit_n is not None and limit_n > 1 and any(k in q_lower for k in ["top", "highest", "largest", "most", "greatest", "earliest"])) or (
        bool(re.search(r"\bshow (?:the )?top\s+\d+\b", q_lower))
    )
    is_bottom_n = (limit_n is not None and limit_n > 1 and any(k in q_lower for k in ["bottom", "lowest", "smallest", "least"])) or (
        bool(re.search(r"\bshow (?:the )?bottom\s+\d+\b", q_lower))
    )

    # Decide Intent
    if is_count:
        intent = AnalyticalIntent.COUNT
    elif is_sum:
        intent = AnalyticalIntent.SUM
    elif is_avg:
        intent = AnalyticalIntent.AVERAGE
    elif is_pct:
        intent = AnalyticalIntent.PERCENTAGE
    elif is_top_n:
        intent = AnalyticalIntent.TOP_N
    elif is_bottom_n:
        intent = AnalyticalIntent.BOTTOM_N
    elif is_max:
        intent = AnalyticalIntent.MAX
    elif is_min:
        intent = AnalyticalIntent.MIN
    elif is_list:
        intent = AnalyticalIntent.LIST
    elif dim_concept is not None and not is_causal:
        intent = AnalyticalIntent.GROUP_BY
    else:
        intent = AnalyticalIntent.GENERAL

    # Extract target entity (e.g. "items", "parts", "records", "orders")
    entity_match = re.search(r"\b(items?|records?|rows?|parts?|products?|orders?|customers?|indents?|materials?)\b", q_lower)
    entity = entity_match.group(1) if entity_match else "records"

    return StructuredAnalysisPlan(
        raw_question=q_clean,
        intent=intent,
        target_entity=entity,
        metric_concept=metric_concept,
        filter_condition=filter_cond,
        dimension_concept=dim_concept,
        order_direction="DESC" if (is_top_n or is_max) else ("ASC" if (is_bottom_n or is_min) else None),
        limit=limit_n,
    )


def resolve_target_column(
    concept: Optional[str],
    all_columns: List[str],
    numeric_columns: List[str],
    question: str,
    prefer_numeric: bool = True,
) -> Optional[str]:
    """
    Match a semantic concept or question context to the most precise DataFrame column.
    Uses positive semantic weights and negative penalty disambiguation.
    """
    if not all_columns:
        return None

    q_lower = question.lower()
    candidate_pool = numeric_columns if (prefer_numeric and numeric_columns) else all_columns

    # Normalized column lookup table
    norm_map = {col: re.sub(r"[^a-z0-9]", "", col.lower()) for col in candidate_pool}

    # ── 0. Exact / Direct Concept Match ──
    if concept:
        concept_norm = re.sub(r"[^a-z0-9]", "", concept.lower())
        for col in candidate_pool:
            c_norm = norm_map[col]
            if concept_norm == c_norm or concept_norm in c_norm or c_norm in concept_norm:
                return col
        for col in candidate_pool:
            if concept.lower() in col.lower() or col.lower() in concept.lower():
                return col

    # ── 1. Specific Disambiguation Rules for Numeric Metrics ──
    if prefer_numeric:
        # Case A: "required quantity" / "required" / "demanded"
        if (concept == "required_quantity") or ("required" in q_lower and "order" not in q_lower):
            for col in candidate_pool:
                c_norm = norm_map[col]
                if "req" in c_norm or "demand" in c_norm or "need" in c_norm:
                    if "order" not in c_norm and "rec" not in c_norm:
                        return col
            for col in candidate_pool:
                c_lower = col.lower()
                if "required" in c_lower or "demand" in c_lower:
                    return col

        # Case B: "to be order" / "ordered quantity" / "order qty"
        if (concept == "ordered_quantity") or ("to be order" in q_lower or "qty to be order" in q_lower or "order quantity" in q_lower or "ordered" in q_lower):
            for col in candidate_pool:
                c_norm = norm_map[col]
                if "tobeorder" in c_norm or "orderqty" in c_norm or "ordered" in c_norm or "poqty" in c_norm:
                    return col
            for col in candidate_pool:
                c_lower = col.lower()
                if "order" in c_lower:
                    return col

        # Case C: "outstanding" / "pending"
        if concept == "outstanding_quantity" or "outstanding" in q_lower or "pending" in q_lower:
            for col in candidate_pool:
                c_norm = norm_map[col]
                if "outstanding" in c_norm or "pending" in c_norm or "balance" in c_norm:
                    return col

        # Case D: "price" / "cost" / "unit price"
        if concept in ("unit_price", "unit_cost") or "price" in q_lower or "cost" in q_lower:
            for col in candidate_pool:
                c_lower = col.lower()
                if "price" in c_lower or "cost" in c_lower or "rate" in c_lower:
                    return col

    # ── 2. General Scored Token & Substring Matcher ──
    q_words = set(re.findall(r"[a-z0-9]+", q_lower))
    best_col = None
    best_score = -100

    for col in candidate_pool:
        c_lower = col.lower()
        c_words = set(re.findall(r"[a-z0-9]+", c_lower))
        score = 0

        # Exact token overlap
        overlap = q_words & c_words
        score += len(overlap) * 5

        # Substring presence
        for qw in q_words:
            if len(qw) >= 3 and qw in c_lower:
                score += 3

        # Negative penalty disambiguation
        if "required" in q_words and "order" in c_words:
            score -= 10
        if "order" in q_words and "required" in c_words:
            score -= 10

        if score > best_score:
            best_score = score
            best_col = col

    if best_score > 0 and best_col:
        return best_col

    # Fallback to first candidate
    return candidate_pool[0] if candidate_pool else None
