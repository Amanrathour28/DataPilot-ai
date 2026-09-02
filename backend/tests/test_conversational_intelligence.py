"""
Comprehensive Verification Suite: Conversational Intelligence & Expansive Answering
=====================================================================================
Validates all 12 Acceptance Test categories defined in the upgrade specification:
- TEST 1: Fact ("What is total revenue?")
- TEST 2: Entity ("Which product has the highest revenue?")
- TEST 3: Explanation ("Why is this product performing well?")
- TEST 4: Ideas ("How can I grow this product?")
- TEST 5: Follow-up ("Which regions should we target?" with Entity Memory)
- TEST 6: Brainstorm ("Give me 10 ideas for expanding this business.")
- TEST 7: Data-Grounded Strategy ("Based on this dataset, what are the biggest growth opportunities?")
- TEST 8: Exploration ("Tell me anything interesting about this dataset.")
- TEST 9: Challenge Premise ("Why is revenue falling?")
- TEST 10: Unsupported Claim ("Which customers are unhappy?")
- TEST 11: Multi-Step ("Which category is strongest, why is it strong, and how could we expand it?")
- TEST 12: Unseen Question (Arbitrary strategic question)
"""

import asyncio
import os
import sys
import uuid
import pandas as pd
import pytest

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.conversational_analyst_service import ConversationalAnalystService, ResponseMode
from app.services.dataset_context import DatasetContext, perform_question_driven_analysis, _profile_dataframe, _build_question_mapping


def _build_test_context(df: pd.DataFrame, question: str, ds_name: str = "Test_Dataset.csv") -> DatasetContext:
    profiling = _profile_dataframe(df)
    q_mapping, unmappable = _build_question_mapping(
        question, list(df.columns), profiling["sample_values"],
        profiling["numeric_columns"], profiling["categorical_columns"], profiling["date_columns"]
    )
    metric_kw = ["revenue", "sales", "amount", "value", "price", "cost", "profit", "qty", "total", "units"]
    dim_kw = ["region", "country", "segment", "category", "type", "channel", "product", "customer"]
    period_kw = ["quarter", "month", "year", "period", "date"]

    candidate_metric_cols = [c for c in profiling["numeric_columns"] if any(k in c.lower() for k in metric_kw)] or profiling["numeric_columns"][:2]
    candidate_dim_cols = [c for c in profiling["categorical_columns"] if any(k in c.lower() for k in dim_kw)] or profiling["categorical_columns"][:2]
    candidate_period_cols = [c for c in profiling["categorical_columns"] + profiling["date_columns"] if any(k in c.lower() for k in period_kw)] or profiling["date_columns"][:1]

    ctx = DatasetContext(
        dataset_id=f"ds_{uuid.uuid4().hex[:8]}",
        dataset_name=ds_name,
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
    return ctx


@pytest.fixture
def enterprise_sales_df():
    """Builds a realistic test dataset containing products, categories, revenue, units, and regions."""
    return pd.DataFrame({
        "product": ["Product X", "Product X", "Product Y", "Product Z", "Product W", "Product V"] * 10,
        "category": ["Fasteners", "Fasteners", "Electrical", "Hardware", "Tools", "Safety"] * 10,
        "region": ["North", "West", "North", "South", "East", "West"] * 10,
        "customer": ["Cust_Alpha", "Cust_Beta", "Cust_Gamma", "Cust_Delta", "Cust_Epsilon", "Cust_Zeta"] * 10,
        "revenue": [360000, 360000, 150000, 120000, 80000, 50000] * 10,  # Product X = 720,000 per pair * 10 = 7.2M
        "units": [1000, 1200, 500, 400, 200, 150] * 10,
        "unit_price": [360, 300, 300, 300, 400, 333] * 10,
    })


def test_01_fact(enterprise_sales_df):
    """TEST 1: Fact ("What is total revenue?") -> Must answer actual value."""
    q = "What is total revenue?"
    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    # 360k + 360k + 150k + 120k + 80k + 50k = 1,120,000 * 10 = 11,200,000
    grand_total = res["aggregations"].get("result") or res["aggregations"].get("grand_total")
    assert grand_total == 11200000.0
    print(f"\n[TEST 1 PASSED] Direct Fact Total: {grand_total:,.2f}")


def test_02_entity(enterprise_sales_df):
    """TEST 2: Entity ("Which product has the highest revenue?")
    Must return actual product name ('Product X') + value (7,200,000) + share."""
    q = "Which product has the highest revenue?"
    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    top_entity = res["aggregations"].get("top_group")
    top_val = res["aggregations"].get("top_group_total")
    top_pct = res["aggregations"].get("top_group_pct")

    assert top_entity == "Product X"
    assert top_val == 7200000.0  # 7.2M
    # Product X = 7.2M out of 11.2M = 64.29%
    assert 60.0 < top_pct < 70.0

    # Expansive answer check
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=True, schema_cols=ctx.all_columns)
    synth = ConversationalAnalystService.synthesize_expansive_response(q, mode_info, res, ctx)
    assert "Product X" in synth["direct_answer"]
    assert "₹7,200,000" in synth["direct_answer"] or "7,200,000" in synth["direct_answer"]
    assert len(synth["suggested_follow_ups"]) >= 3
    print(f"\n[TEST 2 PASSED] Top Entity: {top_entity} at {top_val:,.2f} ({top_pct:.1f}% share)")


def test_03_explanation(enterprise_sales_df):
    """TEST 3: Explanation ("Why is this product performing well?")
    Must investigate actual supporting dimensions before making claims."""
    q = "Why is Product X performing well?"
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=True)
    assert mode_info["is_diagnostic"] is True

    ideas = ConversationalAnalystService.generate_actionable_ideas(
        {"aggregations": {"top_group": "Product X", "dimension_column": "product"}},
        ctx=_build_test_context(enterprise_sales_df, q),
        query=q,
    )
    # Must propose driver decomposition (volume vs price, regional, customer)
    assert any("Price vs Volume" in i["direction"] or "Volume" in i["direction"] for i in ideas)
    print(f"\n[TEST 3 PASSED] Explanation driver proposals generated: {len(ideas)} areas")


def test_04_ideas(enterprise_sales_df):
    """TEST 4: Ideas ("How can I grow this product?")
    Must combine dataset observations with clearly labeled strategic ideas."""
    q = "How can I grow Product X?"
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=True)
    assert mode_info["is_strategic"] is True

    ctx = _build_test_context(enterprise_sales_df, q)
    synth = ConversationalAnalystService.synthesize_strategic_or_hybrid_response(
        query=q,
        analytics={"aggregations": {"top_group": "Product X", "metric_column": "revenue", "dimension_column": "product", "top_group_total": 7200000.0}},
        ctx=ctx,
        mode=mode_info["mode"],
    )
    assert "Tier C" in synth["report_markdown"] or "Strategic" in synth["report_markdown"]
    assert "Product X" in synth["direct_answer"]
    print("\n[TEST 4 PASSED] Actionable growth directions grounded in dataset columns verified")


def test_05_follow_up_with_entity_memory():
    """TEST 5: Follow-up ("Which regions should we target?")
    Must resolve 'this product' from conversation parent context."""
    parent_ctx = {
        "objective": "Which product has the highest revenue?",
        "structured_analysis": {
            "top_group": "Product X",
            "metric_column": "revenue",
            "dimension_column": "product",
        }
    }
    follow_up_q = "Which regions should we target?"
    resolved, entity_ctx = ConversationalAnalystService.resolve_entity_memory(follow_up_q, parent_ctx)

    assert "Product X" in resolved
    assert entity_ctx["entity"] == "Product X"
    print(f"\n[TEST 5 PASSED] Entity Memory Resolved: '{follow_up_q}' -> '{resolved}'")


def test_06_brainstorm():
    """TEST 6: Brainstorm ("Give me 10 ideas for expanding this business.")
    Should provide general strategic ideas without pretending they are dataset findings."""
    q = "Give me 10 ideas for expanding this business."
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=False)
    assert mode_info["mode"] == ResponseMode.BRAINSTORMING
    assert mode_info["requires_data"] is False

    synth = ConversationalAnalystService.synthesize_expansive_response(q, mode_info, {})
    assert "10 strategic growth" in synth["direct_answer"] or "10" in synth["report_markdown"]
    assert len(synth["suggested_follow_ups"]) >= 2
    print("\n[TEST 6 PASSED] Pure brainstorming handled without requiring dataset")


def test_07_data_grounded_strategy(enterprise_sales_df):
    """TEST 7: Data-Grounded Strategy ("Based on this dataset, what are the biggest growth opportunities?")
    Must analyze dataset first and propose grounded initiatives."""
    q = "Based on this dataset, what are the biggest growth opportunities?"
    ctx = _build_test_context(enterprise_sales_df, q)
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=True)
    assert mode_info["requires_data"] is True

    ideas = ConversationalAnalystService.generate_actionable_ideas(
        {"aggregations": {"top_group": "Fasteners", "metric_column": "revenue", "dimension_column": "category"}},
        ctx=ctx,
        query=q,
    )
    assert len(ideas) >= 3
    # Check that proposals reflect dataset columns (e.g. customer cross-sell, regional expansion)
    assert any("Geographic" in i["direction"] for i in ideas)
    assert any("Customer" in i["direction"] for i in ideas)
    print(f"\n[TEST 7 PASSED] Strategy grounded in real columns: {[i['direction'] for i in ideas]}")


def test_08_exploration(enterprise_sales_df):
    """TEST 8: Exploration ("Tell me anything interesting about this dataset.")
    Must autonomously discover meaningful findings."""
    q = "Tell me anything interesting about this dataset."
    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    assert res["analysis_type"] == "DATASET_EXPLORATION"
    assert "Product X" in res["direct_answer"]
    assert len(res["findings"]) >= 2
    print(f"\n[TEST 8 PASSED] Autonomous Exploration: {res['direct_answer']}")


def test_09_challenge_premise(enterprise_sales_df):
    """TEST 9: Challenge Premise ("Why is revenue falling?")
    If revenue isn't falling, say so politely with verified data."""
    q = "Why is revenue falling?"
    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    assert res["analysis_type"] == "PREMISE_CHALLENGE"
    assert "not falling" in res["direct_answer"].lower()
    print(f"\n[TEST 9 PASSED] Premise Challenged: {res['direct_answer']}")


def test_10_unsupported_claim(enterprise_sales_df):
    """TEST 10: Unsupported Claim ("Which customers are unhappy?")
    If dataset contains no satisfaction/sentiment indicator, honestly refuse and suggest data."""
    q = "Which customers are unhappy?"
    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    assert res["analysis_type"] == "UNMAPPABLE_QUESTION_CONCEPT"
    assert "cannot directly determine" in res["direct_answer"].lower()
    assert "satisfaction" in res["direct_answer"].lower() or "sentiment" in res["direct_answer"].lower()
    print(f"\n[TEST 10 PASSED] Unsupported Claim Refused: {res['direct_answer']}")


def test_11_multi_step(enterprise_sales_df):
    """TEST 11: Multi-Step ("Which category is strongest, why is it strong, and how could we expand it?")
    Must identify category, investigate drivers, and propose strategies."""
    q = "Which category is strongest, why is it strong, and how could we expand it?"
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=True)
    assert mode_info["is_hybrid"] is True

    ctx = _build_test_context(enterprise_sales_df, q)
    res = perform_question_driven_analysis(ctx)

    assert res["success"] is True
    assert res["aggregations"]["top_group"] == "Fasteners"

    synth = ConversationalAnalystService.synthesize_strategic_or_hybrid_response(
        query=q,
        analytics=res,
        ctx=ctx,
        mode=mode_info["mode"],
    )
    assert "Fasteners" in synth["direct_answer"]
    assert "Tier A" in synth["report_markdown"] or "Verified" in synth["report_markdown"]
    assert "Tier C" in synth["report_markdown"] or "Strategic" in synth["report_markdown"]
    safe_out = synth['direct_answer'].encode('ascii', 'replace').decode('ascii')
    print(f"\n[TEST 11 PASSED] Multi-step hybrid answered: {safe_out}")


def test_12_unseen_conceptual_question():
    """TEST 12: Unseen / General Conceptual Question
    ("What is customer segmentation?") -> Must answer naturally without dataset."""
    q = "What is customer segmentation?"
    mode_info = ConversationalAnalystService.classify_response_mode(q, has_dataset=False)
    assert mode_info["mode"] == ResponseMode.EXPLANATION
    assert mode_info["requires_data"] is False

    synth = ConversationalAnalystService.synthesize_expansive_response(q, mode_info, {})
    assert "customer segmentation" in synth["direct_answer"].lower()
    assert "behavioral" in synth["report_markdown"].lower() or "rfm" in synth["report_markdown"].lower()
    print(f"\n[TEST 12 PASSED] Conceptual Question Answered: {synth['direct_answer']}")


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
