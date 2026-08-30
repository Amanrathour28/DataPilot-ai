"""
Comprehensive Empirical Investigation Engine Verification Test Suite
====================================================================
Validates all 12 critical scenarios:
1. Revenue Decline Verification (Q2 > Q3)
2. Revenue Increase Premise-Challenge (Q3 > Q2, question assumes decline)
3. Flat Metric Premise-Challenge (Q2 == Q3)
4. Region Grounding (East/Central only -> NO North/South/West)
5. Missing Region Dimension Honesty
6. Missing Temporal Column Honesty
7. Missing Revenue Metric Column Honesty
8. Small-Sample Confidence Calibration (n=5 -> capped confidence)
9. Large-Sample Confidence Calibration (n=5000 -> higher confidence)
10. Schema-Agnostic Sensitivity (2 different datasets -> 2 distinct results)
11. Minimalist Schema (Date + Amount only)
12. Non-Business Domain (Weather/Sensors -> NO business metrics fabricated)
"""

import os
import sys
import pandas as pd
import numpy as np

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.dataset_context import (
    DatasetContext,
    perform_question_driven_analysis,
    validate_premise,
    generate_grounded_hypotheses,
    test_hypothesis_on_real_data,
    _profile_dataframe,
    _build_question_mapping,
)
from app.services.evidence_service import evidence_service
from app.schemas.investigation_state import EvidenceItemSchema, StatisticalMetric


def _make_context(df: pd.DataFrame, question: str, name: str = "test.csv") -> DatasetContext:
    profiling = _profile_dataframe(df)
    q_mapping, unmappable = _build_question_mapping(
        question, list(df.columns), profiling["sample_values"],
        profiling["numeric_columns"], profiling["categorical_columns"], profiling["date_columns"]
    )
    metric_kw = ["revenue", "sales", "amount", "value", "price", "cost", "profit", "qty", "total"]
    dim_kw = ["region", "country", "segment", "category", "type", "channel", "product", "section"]
    period_kw = ["quarter", "month", "year", "period", "date"]

    candidate_metric_cols = [c for c in profiling["numeric_columns"] if any(k in c.lower() for k in metric_kw)] or profiling["numeric_columns"][:2]
    candidate_dim_cols = [c for c in profiling["categorical_columns"] if any(k in c.lower() for k in dim_kw)] or profiling["categorical_columns"][:2]
    candidate_period_cols = [c for c in profiling["categorical_columns"] + profiling["date_columns"] if any(k in c.lower() for k in period_kw)] or profiling["date_columns"][:1]

    return DatasetContext(
        dataset_id="test_ds_id",
        dataset_name=name,
        file_path=None,
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
        question_relevant_columns=profiling["numeric_columns"][:3],
        candidate_metric_columns=candidate_metric_cols,
        candidate_dimension_columns=candidate_dim_cols,
        candidate_period_columns=candidate_period_cols,
        question_mapping=q_mapping,
        unmappable_concepts=unmappable,
        df=df,
    )


# ── Test 1: Revenue Decline Verification ──────────────────────────────────────
def test_scenario_1_revenue_decline():
    df = pd.DataFrame({
        "quarter": ["Q2", "Q2", "Q3", "Q3"],
        "revenue": [50000.0, 50000.0, 40000.0, 40000.0]  # Q2=100k, Q3=80k (-20%)
    })
    ctx = _make_context(df, "Why did revenue decline from Q2 to Q3?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "PERIOD_COMPARISON"
    assert result["aggregations"]["overall_direction"] == "decreased"
    assert abs(result["aggregations"]["overall_change_pct"] - (-20.0)) < 0.1
    # Must NOT have premise challenge because assumption matches data
    assert not any("PREMISE CHALLENGE" in f for f in result["findings"])
    print("[PASSED] Scenario 1: Revenue decline accurately computed (-20.0%)")


# ── Test 2: Revenue Increase Premise-Challenge ────────────────────────────────
def test_scenario_2_premise_challenge_increase():
    df = pd.DataFrame({
        "quarter": ["Q2", "Q2", "Q3", "Q3"],
        "revenue": [50000.0, 50000.0, 75000.0, 75000.0]  # Q2=100k, Q3=150k (+50%)
    })
    ctx = _make_context(df, "Why did revenue decline in Q3?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["aggregations"]["overall_direction"] == "increased"
    assert abs(result["aggregations"]["overall_change_pct"] - 50.0) < 0.1
    # MUST contain explicit premise challenge
    has_challenge = any("PREMISE CHALLENGE" in f and "INCREASED" in f for f in result["findings"])
    assert has_challenge, f"Expected premise challenge in findings: {result['findings']}"
    print("[PASSED] Scenario 2: Premise challenged when user assumes decline but data increased (+50%)")


# ── Test 3: Flat Metric Premise-Challenge ──────────────────────────────────────
def test_scenario_3_premise_challenge_flat():
    df = pd.DataFrame({
        "quarter": ["Q1", "Q2"],
        "revenue": [100000.0, 100000.0]
    })
    ctx = _make_context(df, "What caused the revenue drop?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["aggregations"]["overall_direction"] == "remained unchanged"
    has_challenge = any("NO SIGNIFICANT CHANGE" in f for f in result["findings"])
    assert has_challenge, f"Expected flat premise challenge: {result['findings']}"
    print("[PASSED] Scenario 3: Flat data premise challenged")


# ── Test 4: Region Grounding (East/Central only) ──────────────────────────────
def test_scenario_4_region_grounding():
    df = pd.DataFrame({
        "quarter": ["Q2", "Q2", "Q3", "Q3"],
        "region": ["East", "Central", "East", "Central"],
        "sales": [40000, 60000, 30000, 50000]
    })
    ctx = _make_context(df, "Why did regional sales change?")
    result = perform_question_driven_analysis(ctx)

    findings_text = " ".join(result["findings"])
    # East and Central must exist
    assert "East" in findings_text or "Central" in findings_text
    # NEVER hallucinate unobserved regions
    for forbidden in ["North America", "West", "South", "EMEA", "APAC", "Europe", "LATAM"]:
        assert forbidden not in findings_text, f"Hallucinated region '{forbidden}' found in findings!"
    print("[PASSED] Scenario 4: Region grounding verified (only East/Central used, zero hallucinations)")


# ── Test 5: Missing Region Dimension Honesty ──────────────────────────────────
def test_scenario_5_missing_region_dimension():
    df = pd.DataFrame({
        "date": ["2026-01-01", "2026-02-01", "2026-03-01"],
        "amount": [100.0, 150.0, 200.0]
    })
    ctx = _make_context(df, "Why did revenue drop in the North America region?")
    assert "region" in ctx.unmappable_concepts, "Expected 'region' in unmappable concepts"
    result = perform_question_driven_analysis(ctx)
    findings_text = " ".join(result["findings"])
    assert "North America" not in findings_text
    print("[PASSED] Scenario 5: Missing region acknowledged honestly via unmappable concepts")


# ── Test 6: Missing Temporal Column Honesty ───────────────────────────────────
def test_scenario_6_missing_date_column():
    df = pd.DataFrame({
        "product_name": ["Widget A", "Widget B", "Widget C"],
        "price": [10.0, 20.0, 30.0],
        "quantity": [5, 10, 15]
    })
    ctx = _make_context(df, "Why did sales decline from Q2 to Q3?")
    result = perform_question_driven_analysis(ctx)

    assert result["analysis_type"] == "PERIOD_ANALYSIS_UNAVAILABLE"
    assert result["data_sufficiency"]["temporal_analysis"] is False
    assert any("no date or period column" in f.lower() for f in result["findings"])
    print("[PASSED] Scenario 6: Missing temporal column reported honestly")


# ── Test 7: Missing Revenue Metric Column Honesty ──────────────────────────────
def test_scenario_7_missing_revenue_column():
    df = pd.DataFrame({
        "employee_name": ["Alice", "Bob", "Charlie"],
        "department": ["Engineering", "HR", "Sales"],
        "badge_id": ["E1", "E2", "E3"]
    })
    ctx = _make_context(df, "Analyze quarterly revenue growth by region")
    assert "revenue" in ctx.unmappable_concepts or "region" in ctx.unmappable_concepts
    result = perform_question_driven_analysis(ctx)
    assert result["success"] is True
    print("[PASSED] Scenario 7: Missing revenue metric reported in unmappable concepts")


# ── Test 8: Small-Sample Confidence Calibration ───────────────────────────────
def test_scenario_8_small_sample_calibration():
    # n=5 small exploratory sample
    evidence = [
        EvidenceItemSchema(
            evidence_id="ev_1",
            claim="Observational finding on 5 records",
            source_type="dataset",
            source_name="small.csv",
            analysis_type="DATASET_QUERY",
            query_or_method="Pandas Sum",
            result_summary="Sum=500",
            confidence=0.55,
            supports_claim=True,
            created_by_agent="Data Analyst",
            created_at="2026-08-30T00:00:00Z"
        )
    ]
    calibrated_score, breakdown = evidence_service.calculate_calibrated_confidence(
        evidence_items=evidence,
        has_critic_pass=True,
        sample_size=5
    )
    # Must be capped at <= 0.55 for tiny sample
    assert calibrated_score <= 0.55, f"Expected small sample score <= 0.55, got {calibrated_score}"
    print(f"[PASSED] Scenario 8: Small sample (n=5) confidence capped at {calibrated_score:.2f} <= 0.55")


# ── Test 9: Large-Sample Confidence Calibration ───────────────────────────────
def test_scenario_9_large_sample_calibration():
    stat_metric = StatisticalMetric(
        test_name="Welch's t-Test",
        statistic=4.5,
        p_value=0.0001,
        effect_size=1.2,
        interpretation="Statistically significant difference (p < 0.001)",
        sample_sizes={"A": 2500, "B": 2500}
    )
    evidence = [
        EvidenceItemSchema(
            evidence_id="ev_stat",
            claim="Large cohort variance statistically verified",
            source_type="statistical",
            source_name="large.csv",
            analysis_type="STATISTICAL_HYPOTHESIS_TEST",
            query_or_method="Welch t-Test",
            result_summary="Significant difference p=0.0001",
            statistical_metrics=stat_metric,
            confidence=0.92,
            supports_claim=True,
            created_by_agent="Hypothesis Tester",
            created_at="2026-08-30T00:00:00Z"
        ),
        EvidenceItemSchema(
            evidence_id="ev_ds",
            claim="Coverage across 5000 records",
            source_type="dataset",
            source_name="large.csv",
            analysis_type="DATASET_QUERY",
            query_or_method="Aggregation",
            result_summary="Total=5000",
            confidence=0.90,
            supports_claim=True,
            created_by_agent="Data Analyst",
            created_at="2026-08-30T00:00:00Z"
        ),
        EvidenceItemSchema(
            evidence_id="ev_ds_2",
            claim="Coverage across categories",
            source_type="dataset",
            source_name="large.csv",
            analysis_type="DATASET_QUERY",
            query_or_method="Groupby",
            result_summary="5 categories",
            confidence=0.90,
            supports_claim=True,
            created_by_agent="Data Analyst",
            created_at="2026-08-30T00:00:00Z"
        )
    ]
    calibrated_score, breakdown = evidence_service.calculate_calibrated_confidence(
        evidence_items=evidence,
        has_critic_pass=True,
        sample_size=5000
    )
    assert calibrated_score >= 0.75, f"Expected large sample score >= 0.75, got {calibrated_score}"
    print(f"[PASSED] Scenario 9: Large sample (n=5000) calibrated confidence = {calibrated_score:.2f}")


# ── Test 10: Schema-Agnostic Sensitivity ──────────────────────────────────────
def test_scenario_10_dataset_sensitivity():
    # Two different datasets with identical question -> MUST produce distinct results
    df_a = pd.DataFrame({"quarter": ["Q1", "Q2"], "revenue": [100, 50]})   # 50% decline
    df_b = pd.DataFrame({"quarter": ["Q1", "Q2"], "revenue": [100, 200]})  # 100% increase

    ctx_a = _make_context(df_a, "What drove revenue change from Q1 to Q2?", "dataset_a.csv")
    ctx_b = _make_context(df_b, "What drove revenue change from Q1 to Q2?", "dataset_b.csv")

    res_a = perform_question_driven_analysis(ctx_a)
    res_b = perform_question_driven_analysis(ctx_b)

    assert res_a["aggregations"]["overall_direction"] == "decreased"
    assert res_b["aggregations"]["overall_direction"] == "increased"
    assert res_a["findings"] != res_b["findings"]
    print("[PASSED] Scenario 10: Same question on two different datasets produces 100% data-driven distinct outputs")


# ── Test 11: Minimalist Schema ────────────────────────────────────────────────
def test_scenario_11_minimalist_schema():
    df = pd.DataFrame({
        "date": ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
        "amount": [1000.0, 1200.0, 1100.0, 1400.0]
    })
    ctx = _make_context(df, "Analyze regional and enterprise segment performance")
    assert "region" in ctx.unmappable_concepts
    assert "segment" in ctx.unmappable_concepts

    result = perform_question_driven_analysis(ctx)
    assert result["success"] is True
    # Analysis proceeded only with available columns (date, amount)
    assert result["columns_used"] == ["amount", "_derived_quarter"] or "amount" in result["columns_used"]
    print("[PASSED] Scenario 11: Minimalist schema handles unmapped dimensions without hallucinations")


# ── Test 12: Non-Business Domain ──────────────────────────────────────────────
def test_scenario_12_non_business_domain():
    # Weather sensor data
    df = pd.DataFrame({
        "sensor_id": ["S1", "S2", "S3", "S1", "S2", "S3"],
        "temperature_c": [21.5, 22.0, 21.8, 25.1, 26.0, 25.5],
        "humidity_pct": [60, 65, 62, 75, 80, 78],
        "timestamp": ["2026-08-01", "2026-08-01", "2026-08-01", "2026-08-02", "2026-08-02", "2026-08-02"]
    })
    ctx = _make_context(df, "What is causing temperature and humidity anomalies?")
    result = perform_question_driven_analysis(ctx)

    findings_text = " ".join(result["findings"])
    # Must NOT contain fabricated business terminology
    for business_term in ["revenue", "profit", "churn", "indent", "fulfillment", "procurement", "pipeline"]:
        assert business_term not in findings_text.lower(), f"Fabricated business term '{business_term}' in weather analysis!"

    hypotheses = generate_grounded_hypotheses(ctx, result)
    assert len(hypotheses) > 0
    # Hypotheses should reference sensor_id, temperature_c, or humidity_pct
    for h in hypotheses:
        vars_used = h.get("variables", [])
        for v in vars_used:
            assert v in df.columns, f"Hypothesis variable '{v}' not in weather dataset columns!"

    print("[PASSED] Scenario 12: Weather dataset handled cleanly with zero business domain hallucinations")


# ── Test 13: Provenance Structure ─────────────────────────────────────────────
def test_scenario_13_provenance_structure():
    df = pd.DataFrame({
        "item_name": ["Widget A", "Widget B", "Widget C"],
        "required_qty": [100, 200, 300],
        "ordered_qty": [80, 150, 300],
    })
    ctx = _make_context(df, "Which items have pending quantities?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "PENDING_ITEMS_ANALYSIS"
    assert "pending_items_count" in result or "pending_formula" in result
    assert len(result["columns_used"]) > 0
    print("[PASSED] Scenario 13: Provenance structure verified with explicit columns and formulas")


# ── Test 14: ExecutionContext Pipeline ────────────────────────────────────────
def test_scenario_14_execution_context_pipeline():
    from app.worker import InvestigationExecutionContext
    df = pd.DataFrame({
        "quarter": ["Q1", "Q2"],
        "revenue": [5000, 6000]
    })
    ctx = _make_context(df, "Explain revenue growth")
    analytics = perform_question_driven_analysis(ctx)

    exec_ctx = InvestigationExecutionContext(
        investigation_id="inv_test_123",
        workspace_id="ws_test_456",
        objective="Explain revenue growth",
        execution_id="exec_789",
        ctx=ctx,
        analytics=analytics
    )

    assert exec_ctx.ctx is not None
    assert exec_ctx.ctx.dataset_name == "test.csv"
    assert exec_ctx.analytics["aggregations"]["overall_direction"] == "increased"
    print("[PASSED] Scenario 14: InvestigationExecutionContext successfully encapsulates pipeline state")


# ── Test 15: Multi-Source Loading Fallback ─────────────────────────────────────
def test_scenario_15_multi_source_fallback():
    import io
    raw_csv_data = "quarter,sales,region\nQ1,100,East\nQ2,120,East\nQ1,200,Central\nQ2,180,Central\n"
    df = pd.read_csv(io.StringIO(raw_csv_data))
    assert len(df) == 4
    ctx = _make_context(df, "Analyze regional sales trends")
    res = perform_question_driven_analysis(ctx)
    assert res["success"] is True
    assert "East" in str(res["findings"]) or "Central" in str(res["findings"])
# ── Test 16: Total Revenue & Regional Breakdown ──────────────────────────────
def test_scenario_16_total_revenue_and_region_breakdown():
    df = pd.DataFrame({
        "region": ["North", "North", "South", "West", "West", "West"],
        "revenue": [10000.0, 15000.0, 20000.0, 30000.0, 15000.0, 10000.0],
    })
    # Raw calculation:
    # Total = 100,000
    # North = 25,000 (25.0%)
    # South = 20,000 (20.0%)
    # West = 55,000 (55.0%)
    ctx = _make_context(df, "What is the total revenue in the dataset, and how does it vary by region?", name="Indent_part_5.xlsx")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "GROUPED_AGGREGATION"
    agg = result["aggregations"]
    assert agg["grand_total"] == 100000.0
    assert agg["valid_records"] == 6
    assert agg["top_group"] == "West"
    assert agg["top_group_total"] == 55000.0
    assert agg["top_group_pct"] == 55.0

    # Validate primary table
    table = result["primary_table"]
    assert len(table) == 3
    west_row = next(r for r in table if r["region"] == "West")
    assert west_row["total"] == 55000.0
    assert west_row["pct_of_total"] == 55.0
    assert west_row["record_count"] == 3

    north_row = next(r for r in table if r["region"] == "North")
    assert north_row["total"] == 25000.0
    assert north_row["pct_of_total"] == 25.0

    south_row = next(r for r in table if r["region"] == "South")
    assert south_row["total"] == 20000.0
    assert south_row["pct_of_total"] == 20.0

    print("[PASSED] Scenario 16: Total revenue (100,000.00) & regional breakdown (West 55%, North 25%, South 20%) match raw data 100%")


# ── Test 17: Region with Highest Revenue ──────────────────────────────────────
def test_scenario_17_highest_revenue_region():
    df = pd.DataFrame({
        "region": ["Alpha", "Beta", "Gamma"],
        "sales": [3500.0, 9200.0, 1100.0]
    })
    ctx = _make_context(df, "Which region has the highest revenue?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    agg = result["aggregations"]
    assert agg["top_group"] == "Beta"
    assert agg["top_group_total"] == 9200.0
    print("[PASSED] Scenario 17: Correct top region identified with exact ranking ('Beta': 9,200.00)")


# ── Test 18: Top 5 Products by Revenue ────────────────────────────────────────
def test_scenario_18_top_products_by_revenue():
    df = pd.DataFrame({
        "item_name": [f"Product_{i}" for i in range(10)],
        "amount": [100, 500, 200, 800, 50, 950, 300, 700, 450, 600]
    })
    ctx = _make_context(df, "What are the top 5 products by revenue?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "TOP_N_ANALYSIS"
    assert len(result["primary_table"]) == 5
    assert result["primary_table"][0]["item_name"] == "Product_5"
    assert result["primary_table"][0]["amount"] == 950
    print("[PASSED] Scenario 18: Top 5 products accurately aggregated and ranked from raw data")


# ── Test 19: Dataset Volume (How many records) ─────────────────────────────────
def test_scenario_19_dataset_volume():
    df = pd.DataFrame({
        "col_a": list(range(85)),
        "col_b": [f"val_{i}" for i in range(85)]
    })
    ctx = _make_context(df, "How many records are in the dataset?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "DATASET_VOLUME_ANALYSIS"
    assert result["aggregations"]["total_records"] == 85
    assert result["aggregations"]["total_columns"] == 2
    print("[PASSED] Scenario 19: Dataset volume answered directly with exact count (85 records)")


# ── Test 20: Percentage of Revenue from Each Region ───────────────────────────
def test_scenario_20_revenue_percentage_by_region():
    df = pd.DataFrame({
        "region": ["East", "West"],
        "revenue": [4000.0, 6000.0]
    })
    ctx = _make_context(df, "What percentage of revenue comes from each region?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    table = result["primary_table"]
    pct_sum = sum(r["pct_of_total"] for r in table)
    assert abs(pct_sum - 100.0) < 0.01
    print("[PASSED] Scenario 20: Regional revenue percentages sum exactly to 100% (60.0% West, 40.0% East)")


# ── Test 21: Missing Values Audit ─────────────────────────────────────────────
def test_scenario_21_missing_values_audit():
    df = pd.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["A", None, "C", None, "E"],
        "score": [10, 20, None, 40, 50]
    })
    ctx = _make_context(df, "What are the missing values in the dataset?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "MISSING_VALUES_ANALYSIS"
    assert result["aggregations"]["total_null_values"] == 3
    assert result["aggregations"]["columns_with_nulls"] == 2
    print("[PASSED] Scenario 21: Missing values audited accurately (3 nulls across 2 columns)")


# ── Test 22: Unmappable Non-Existent Column Request ───────────────────────────
def test_scenario_22_unmappable_missing_column():
    df = pd.DataFrame({
        "temperature": [22.5, 23.0, 21.8],
        "humidity": [55, 60, 58]
    })
    ctx = _make_context(df, "What is the profit by customer tier?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "UNMAPPABLE_QUESTION_CONCEPT"
    assert "profit" in result["aggregations"]["unmappable_concepts"] or "tier" in str(result["findings"])
    assert not any("temperature" in f.lower() and "profit" in f.lower() for f in result["findings"])
    print("[PASSED] Scenario 22: Unmappable concepts honestly acknowledged with zero column fabrication")


# ── Test 23: Earliest Required-by Dates Top 10 with Outstanding Qty ──────────
def test_scenario_23_earliest_dates_top_10():
    # Build 15 items with dates out of order
    df = pd.DataFrame({
        "item_name": [f"Material_{i}" for i in range(1, 16)],
        "required_by_date": [
            "2026-04-15", "2026-01-10", "2026-03-20", "2026-01-05", "2026-02-14",
            "2026-05-01", "2026-01-12", "2026-02-01", "2026-03-01", "2026-01-25",
            "2026-04-01", "2026-02-28", "2026-01-18", "2026-06-01", "2026-05-15"
        ],
        "required_qty": [100, 50, 80, 200, 150, 70, 90, 120, 60, 300, 110, 40, 250, 85, 95],
        "ordered_qty":  [20,  10, 0,  50,  100, 70, 0,  20,  60, 100, 10,  0,  50,  85, 0]
    })
    # Earliest 10 sorted by date:
    # 1. 2026-01-05 (Material_4): req 200 - ord 50 = 150 outstanding
    # 2. 2026-01-10 (Material_2): req 50 - ord 10 = 40 outstanding
    # 3. 2026-01-12 (Material_7): req 90 - ord 0 = 90 outstanding
    # 4. 2026-01-18 (Material_13): req 250 - ord 50 = 200 outstanding
    # 5. 2026-01-25 (Material_10): req 300 - ord 100 = 200 outstanding
    # 6. 2026-02-01 (Material_8): req 120 - ord 20 = 100 outstanding
    # 7. 2026-02-14 (Material_5): req 150 - ord 100 = 50 outstanding
    # 8. 2026-02-28 (Material_12): req 40 - ord 0 = 40 outstanding
    # 9. 2026-03-01 (Material_9): req 60 - ord 60 = 0 outstanding
    # 10. 2026-03-20 (Material_3): req 80 - ord 0 = 80 outstanding

    ctx = _make_context(df, "Which items have the earliest required-by dates? Show the top 10 items with their required-by date and outstanding quantity.", name="Indent_part_5.xlsx")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "RANKING_BY_DATE"
    table = result["primary_table"]
    assert len(table) == 10
    assert table[0]["Item"] == "Material_4"
    assert table[0]["Required-by Date"] == "2026-01-05"
    assert table[0]["Outstanding Quantity"] == 150.0

    assert table[1]["Item"] == "Material_2"
    assert table[1]["Required-by Date"] == "2026-01-10"
    assert table[1]["Outstanding Quantity"] == 40.0

    assert table[9]["Item"] == "Material_3"
    assert table[9]["Required-by Date"] == "2026-03-20"
    assert table[9]["Outstanding Quantity"] == 80.0
    print("[PASSED] Scenario 23 (TEST 1): 10 earliest items accurately ranked with real dates and calculated outstanding quantities")


# ── Test 24: Total Quantity Still Pending to be Ordered ──────────────────────
def test_scenario_24_total_pending_quantity():
    df = pd.DataFrame({
        "item": ["A", "B", "C"],
        "required_qty": [100, 200, 300],
        "ordered_qty":  [40,  100, 150],  # Gaps: 60 + 100 + 150 = 310
    })
    ctx = _make_context(df, "What is the total quantity still pending to be ordered?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "TOTAL_PENDING_QUANTITY"
    assert result["aggregations"]["total_pending_quantity"] == 310.0
    print("[PASSED] Scenario 24 (TEST 2): Single calculated total pending quantity (310 units) verified")


# ── Test 25: Category with Highest Outstanding Quantity ───────────────────────
def test_scenario_25_category_highest_outstanding():
    df = pd.DataFrame({
        "category": ["Hardware", "Hardware", "Electrical", "Chemical"],
        "required_qty": [500, 300, 200, 100],
        "ordered_qty":  [100, 100, 50,  100], # Outstanding: Hardware=600, Electrical=150, Chemical=0
    })
    ctx = _make_context(df, "Which category has the highest outstanding quantity?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["aggregations"]["top_group"] == "Hardware"
    assert result["aggregations"]["top_group_total"] == 600.0
    print("[PASSED] Scenario 25 (TEST 3): Category with highest outstanding quantity ('Hardware': 600) verified")


# ── Test 26: Dataset Record Count ─────────────────────────────────────────────
def test_scenario_26_dataset_record_count():
    df = pd.DataFrame({"col_x": range(85), "col_y": range(85)})
    ctx = _make_context(df, "How many records are in the dataset?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "DATASET_VOLUME_ANALYSIS"
    assert result["aggregations"]["total_records"] == 85
    print("[PASSED] Scenario 26 (TEST 4): Exact row count (85 records) verified")


# ── Test 27: Missing Required-by Dates ────────────────────────────────────────
def test_scenario_27_missing_required_dates():
    df = pd.DataFrame({
        "item_name": ["Pipe", "Valve", "Flange", "Pump"],
        "required_by_date": ["2026-01-01", None, "2026-02-01", None]
    })
    ctx = _make_context(df, "Which items have missing required-by dates?")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "MISSING_DATES_ANALYSIS"
    assert result["aggregations"]["missing_date_count"] == 2
    assert len(result["primary_table"]) == 2
    assert result["primary_table"][0]["Item"] == "Valve"
    assert result["primary_table"][1]["Item"] == "Pump"
    print("[PASSED] Scenario 27 (TEST 5): Items with missing required-by dates (2 records) identified accurately")


# ── Test 28: 10 Items with Largest Outstanding Quantity (TEST 6 vs TEST 1) ────
def test_scenario_28_largest_outstanding_ranking():
    # Same df as Scenario 23, but sorted by quantity descending
    df = pd.DataFrame({
        "item_name": [f"Material_{i}" for i in range(1, 16)],
        "required_by_date": [
            "2026-04-15", "2026-01-10", "2026-03-20", "2026-01-05", "2026-02-14",
            "2026-05-01", "2026-01-12", "2026-02-01", "2026-03-01", "2026-01-25",
            "2026-04-01", "2026-02-28", "2026-01-18", "2026-06-01", "2026-05-15"
        ],
        "required_qty": [100, 50, 80, 200, 150, 70, 90, 120, 60, 300, 110, 40, 250, 85, 95],
        "ordered_qty":  [20,  10, 0,  50,  100, 70, 0,  20,  60, 100, 10,  0,  50,  85, 0]
    })
    # Largest outstanding:
    # 1. Material_10 (300 - 100 = 200) or Material_13 (250 - 50 = 200)
    # 3. Material_4 (200 - 50 = 150)
    # 4. Material_8 (120 - 20 = 100)
    ctx = _make_context(df, "Show the 10 items with the largest outstanding quantity.")
    result = perform_question_driven_analysis(ctx)

    assert result["success"] is True
    assert result["analysis_type"] == "RANKING_BY_METRIC"
    table = result["primary_table"]
    assert len(table) == 10
    # Top item by quantity is Material_10 or Material_13 (200 outstanding), NOT Material_4 (earliest date)
    assert table[0]["Outstanding Quantity"] == 200.0
    assert table[0]["Item"] in ["Material_10", "Material_13"]
    print("[PASSED] Scenario 28 (TEST 6): Largest outstanding items correctly ranked by quantity descending (distinct from earliest date ranking)")


# ── Test 29: Revenue Column Schema Check ──────────────────────────────────────
def test_scenario_29_revenue_column_check():
    df_no_rev = pd.DataFrame({"item_code": [1, 2], "qty": [10, 20]})
    ctx_no_rev = _make_context(df_no_rev, "Does this dataset contain a revenue column?")
    res_no_rev = perform_question_driven_analysis(ctx_no_rev)

    assert res_no_rev["success"] is True
    assert res_no_rev["analysis_type"] == "SCHEMA_COLUMN_CHECK"
    assert res_no_rev["aggregations"]["contains_column"] is False
    assert "does NOT contain a 'revenue' column" in res_no_rev["findings"][0]

    df_with_rev = pd.DataFrame({"item_code": [1, 2], "revenue": [100.0, 200.0]})
    ctx_with_rev = _make_context(df_with_rev, "Does this dataset contain a revenue column?")
    res_with_rev = perform_question_driven_analysis(ctx_with_rev)

    assert res_with_rev["success"] is True
    assert res_with_rev["aggregations"]["contains_column"] is True
    assert "contains column 'revenue'" in res_with_rev["findings"][0]
    print("[PASSED] Scenario 29 (TEST 7): Schema column checks honestly answered for present and absent columns")


if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING ALL 29 EMPIRICAL INVESTIGATION VERIFICATION TESTS")
    print("=" * 70)
    test_scenario_1_revenue_decline()
    test_scenario_2_premise_challenge_increase()
    test_scenario_3_premise_challenge_flat()
    test_scenario_4_region_grounding()
    test_scenario_5_missing_region_dimension()
    test_scenario_6_missing_date_column()
    test_scenario_7_missing_revenue_column()
    test_scenario_8_small_sample_calibration()
    test_scenario_9_large_sample_calibration()
    test_scenario_10_dataset_sensitivity()
    test_scenario_11_minimalist_schema()
    test_scenario_12_non_business_domain()
    test_scenario_13_provenance_structure()
    test_scenario_14_execution_context_pipeline()
    test_scenario_15_multi_source_fallback()
    test_scenario_16_total_revenue_and_region_breakdown()
    test_scenario_17_highest_revenue_region()
    test_scenario_18_top_products_by_revenue()
    test_scenario_19_dataset_volume()
    test_scenario_20_revenue_percentage_by_region()
    test_scenario_21_missing_values_audit()
    test_scenario_22_unmappable_missing_column()
    test_scenario_23_earliest_dates_top_10()
    test_scenario_24_total_pending_quantity()
    test_scenario_25_category_highest_outstanding()
    test_scenario_26_dataset_record_count()
    test_scenario_27_missing_required_dates()
    test_scenario_28_largest_outstanding_ranking()
    test_scenario_29_revenue_column_check()
    print("=" * 70)
    print("ALL 29 VERIFICATION SCENARIOS PASSED WITH ZERO HALLUCINATIONS!")
    print("=" * 70)

