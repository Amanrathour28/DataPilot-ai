import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.statistical_service import statistical_service
from app.services.evidence_service import evidence_service
from app.tools.python_executor import PythonExecutor


def test_independent_t_test():
    group_a = [25.0, 26.5, 24.8, 27.2, 26.0, 25.8]
    group_b = [12.0, 13.5, 11.8, 14.2, 13.0, 12.8]

    metric = statistical_service.independent_t_test(group_a, group_b, "Group A", "Group B")
    assert metric.p_value is not None
    assert metric.p_value < 0.001
    assert metric.effect_size > 2.0
    print("[PASSED] independent_t_test")


def test_chi_squared_test():
    # 2x2 contingency table: Region (EU/US) vs Churned (Yes/No)
    table = [[45, 15], [20, 80]]
    metric = statistical_service.chi_squared_test(table)
    assert metric.p_value is not None
    assert metric.p_value < 0.001
    assert metric.effect_size > 0.4
    print("[PASSED] chi_squared_test")


def test_correlation_analysis():
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    y = [2.1, 3.9, 6.2, 8.0, 10.1, 12.2]
    metric = statistical_service.correlation_analysis(x, y, "Spend", "Conversions")
    assert metric.p_value is not None
    assert metric.p_value < 0.001
    assert metric.statistic > 0.95
    print("[PASSED] correlation_analysis")


def test_calibrated_confidence():
    stat_metric = statistical_service.independent_t_test([10, 12, 11], [5, 6, 7])
    ev_stat = evidence_service.create_statistical_evidence("Test claim", "Dataset A", stat_metric)
    ev_ds = evidence_service.create_dataset_evidence("Claim 2", "ds-1", "sales.csv", "SELECT", "Result")

    score, breakdown = evidence_service.calculate_calibrated_confidence([ev_stat, ev_ds], has_critic_pass=True)
    assert 0.0 <= score <= 1.0
    assert breakdown.statistical_evidence_score > 0
    assert breakdown.critic_validation_score > 0
    print("[PASSED] calibrated_confidence")


def test_python_executor_ast_safety():
    unsafe_code = """
import os
os.system("rm -rf /")
"""
    is_safe, msg = PythonExecutor.validate_code_safety(unsafe_code)
    assert not is_safe
    assert "Forbidden" in msg or "destructive" in msg

    safe_code = """
import pandas as pd
import numpy as np
df = pd.DataFrame({'a': [1, 2, 3]})
print(df.sum().to_json())
"""
    is_safe_2, msg_2 = PythonExecutor.validate_code_safety(safe_code)
    assert is_safe_2
    print("[PASSED] python_executor_ast_safety")


if __name__ == "__main__":
    test_independent_t_test()
    test_chi_squared_test()
    test_correlation_analysis()
    test_calibrated_confidence()
    test_python_executor_ast_safety()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
