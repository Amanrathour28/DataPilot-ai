import logging
import math
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import pandas as pd
from scipy import stats

from app.schemas.investigation_state import StatisticalMetric

logger = logging.getLogger("datapilot.statistical_service")


class StatisticalTestingService:
    """Deterministic, mathematically rigorous statistical testing engine.

    Computes exact p-values, effect sizes, and confidence intervals using SciPy/NumPy.
    """

    @staticmethod
    def independent_t_test(
        group_a: List[float] | np.ndarray,
        group_b: List[float] | np.ndarray,
        name_a: str = "Group A",
        name_b: str = "Group B",
        alpha: float = 0.05,
    ) -> StatisticalMetric:
        """Perform Welch's two-sample independent t-test (robust to unequal variances)."""
        a = np.array(group_a, dtype=float)
        b = np.array(group_b, dtype=float)
        a = a[~np.isnan(a)]
        b = b[~np.isnan(b)]

        if len(a) < 2 or len(b) < 2:
            return StatisticalMetric(
                test_name="Welch's Independent t-Test",
                statistic=0.0,
                p_value=1.0,
                effect_size=0.0,
                effect_size_type="Cohen's d",
                interpretation="Insufficient sample size for independent t-test (minimum 2 per group required).",
                sample_sizes={name_a: len(a), name_b: len(b)},
            )

        mean_a, mean_b = np.mean(a), np.mean(b)
        std_a, std_b = np.std(a, ddof=1), np.std(b, ddof=1)
        n_a, n_b = len(a), len(b)

        # Welch's t-test
        t_stat, p_val = stats.ttest_ind(a, b, equal_var=False)

        # Cohen's d (pooled standard deviation)
        pooled_std = math.sqrt(((n_a - 1) * (std_a ** 2) + (n_b - 1) * (std_b ** 2)) / (n_a + n_b - 2))
        cohens_d = (mean_a - mean_b) / (pooled_std if pooled_std > 0 else 1.0)

        # 95% Confidence Interval for difference in means
        diff = mean_a - mean_b
        se_diff = math.sqrt((std_a ** 2 / n_a) + (std_b ** 2 / n_b))
        df = ((std_a ** 2 / n_a + std_b ** 2 / n_b) ** 2) / (
            ((std_a ** 2 / n_a) ** 2) / (n_a - 1) + ((std_b ** 2 / n_b) ** 2) / (n_b - 1)
        )
        t_crit = stats.t.ppf(1 - alpha / 2, df=df) if df > 0 else 1.96
        ci = [float(diff - t_crit * se_diff), float(diff + t_crit * se_diff)]

        # Interpretation
        if p_val < alpha:
            direction = "significantly higher" if diff > 0 else "significantly lower"
            magnitude = "large" if abs(cohens_d) > 0.8 else ("medium" if abs(cohens_d) > 0.5 else "small")
            interp = (
                f"Statistically significant difference (p={p_val:.4f}). "
                f"{name_a} (mean={mean_a:.2f}) is {direction} than {name_b} (mean={mean_b:.2f}) "
                f"with a {magnitude} effect size (d={cohens_d:.2f})."
            )
        else:
            interp = (
                f"No statistically significant difference detected (p={p_val:.4f} >= {alpha}). "
                f"Observed difference ({diff:.2f}) is within random variance."
            )

        return StatisticalMetric(
            test_name="Welch's Independent t-Test",
            statistic=float(t_stat),
            p_value=float(p_val),
            effect_size=float(cohens_d),
            effect_size_type="Cohen's d",
            confidence_interval=ci,
            interpretation=interp,
            sample_sizes={name_a: n_a, name_b: n_b},
        )

    @staticmethod
    def mann_whitney_u_test(
        group_a: List[float] | np.ndarray,
        group_b: List[float] | np.ndarray,
        name_a: str = "Group A",
        name_b: str = "Group B",
        alpha: float = 0.05,
    ) -> StatisticalMetric:
        """Perform non-parametric Mann-Whitney U test."""
        a = np.array(group_a, dtype=float)
        b = np.array(group_b, dtype=float)
        a = a[~np.isnan(a)]
        b = b[~np.isnan(b)]

        if len(a) < 2 or len(b) < 2:
            return StatisticalMetric(
                test_name="Mann-Whitney U Test",
                statistic=0.0,
                p_value=1.0,
                effect_size=0.0,
                effect_size_type="Rank-Biserial Correlation",
                interpretation="Insufficient sample size for Mann-Whitney U test.",
                sample_sizes={name_a: len(a), name_b: len(b)},
            )

        res = stats.mannwhitneyu(a, b, alternative="two-sided")
        u_stat = res.statistic
        p_val = res.pvalue

        # Rank-biserial correlation effect size: r = 1 - (2*U / (n1*n2))
        n_a, n_b = len(a), len(b)
        r_biserial = 1.0 - (2.0 * u_stat / (n_a * n_b)) if (n_a * n_b) > 0 else 0.0

        if p_val < alpha:
            interp = f"Significant distributional shift detected between {name_a} and {name_b} (p={p_val:.4f}, r={r_biserial:.2f})."
        else:
            interp = f"No significant distributional difference between {name_a} and {name_b} (p={p_val:.4f})."

        return StatisticalMetric(
            test_name="Mann-Whitney U Test",
            statistic=float(u_stat),
            p_value=float(p_val),
            effect_size=float(r_biserial),
            effect_size_type="Rank-Biserial r",
            interpretation=interp,
            sample_sizes={name_a: n_a, name_b: n_b},
        )

    @staticmethod
    def chi_squared_test(
        contingency_table: List[List[int]] | np.ndarray,
        row_labels: Optional[List[str]] = None,
        col_labels: Optional[List[str]] = None,
        alpha: float = 0.05,
    ) -> StatisticalMetric:
        """Perform Chi-Square test of independence with Cramer's V effect size."""
        table = np.array(contingency_table)
        if table.size < 4 or np.sum(table) == 0:
            return StatisticalMetric(
                test_name="Chi-Square Test of Independence",
                statistic=0.0,
                p_value=1.0,
                effect_size=0.0,
                effect_size_type="Cramer's V",
                interpretation="Contingency table too small or empty for Chi-Square test.",
            )

        chi2, p_val, dof, expected = stats.chi2_contingency(table)

        # Cramer's V
        n = np.sum(table)
        min_dim = min(table.shape) - 1
        cramers_v = math.sqrt(chi2 / (n * min_dim)) if (n * min_dim) > 0 else 0.0

        if p_val < alpha:
            interp = f"Statistically significant association between categorical factors (Chi2={chi2:.2f}, p={p_val:.4f}, Cramer's V={cramers_v:.2f})."
        else:
            interp = f"Categorical factors appear statistically independent (Chi2={chi2:.2f}, p={p_val:.4f} >= {alpha})."

        return StatisticalMetric(
            test_name="Chi-Square Test of Independence",
            statistic=float(chi2),
            p_value=float(p_val),
            effect_size=float(cramers_v),
            effect_size_type="Cramer's V",
            interpretation=interp,
            sample_sizes={"total_observations": int(n)},
        )

    @staticmethod
    def correlation_analysis(
        x: List[float] | np.ndarray,
        y: List[float] | np.ndarray,
        name_x: str = "Variable X",
        name_y: str = "Variable Y",
        alpha: float = 0.05,
    ) -> StatisticalMetric:
        """Perform Pearson and Spearman correlation analysis with p-values."""
        arr_x = np.array(x, dtype=float)
        arr_y = np.array(y, dtype=float)
        mask = (~np.isnan(arr_x)) & (~np.isnan(arr_y))
        arr_x, arr_y = arr_x[mask], arr_y[mask]

        if len(arr_x) < 3:
            return StatisticalMetric(
                test_name="Pearson Correlation Analysis",
                statistic=0.0,
                p_value=1.0,
                effect_size=0.0,
                effect_size_type="Pearson r",
                interpretation="Insufficient paired data points for correlation analysis.",
                sample_sizes={"paired_points": len(arr_x)},
            )

        r_stat, p_val = stats.pearsonr(arr_x, arr_y)
        spearman_r, spearman_p = stats.spearmanr(arr_x, arr_y)

        # 95% CI for Pearson r using Fisher z-transform
        z = np.arctanh(np.clip(r_stat, -0.999, 0.999))
        se = 1.0 / math.sqrt(len(arr_x) - 3)
        z_crit = 1.96
        ci = [float(np.tanh(z - z_crit * se)), float(np.tanh(z + z_crit * se))]

        strength = "strong" if abs(r_stat) > 0.6 else ("moderate" if abs(r_stat) > 0.3 else "weak")
        direction = "positive" if r_stat > 0 else "negative"

        if p_val < alpha:
            interp = (
                f"Statistically significant {strength} {direction} correlation between {name_x} and {name_y} "
                f"(r={r_stat:.2f}, p={p_val:.4f}, Spearman rho={spearman_r:.2f})."
            )
        else:
            interp = f"No significant linear correlation observed between {name_x} and {name_y} (r={r_stat:.2f}, p={p_val:.4f})."

        return StatisticalMetric(
            test_name="Pearson Correlation Analysis",
            statistic=float(r_stat),
            p_value=float(p_val),
            effect_size=float(r_stat),
            effect_size_type="Pearson r",
            confidence_interval=ci,
            interpretation=interp,
            sample_sizes={"paired_points": len(arr_x)},
        )

    @staticmethod
    def percentage_difference(
        baseline_val: float,
        current_val: float,
        metric_name: str = "Metric",
        baseline_label: str = "Baseline",
        current_label: str = "Current",
    ) -> StatisticalMetric:
        """Compute relative percentage change and absolute delta."""
        if baseline_val == 0:
            pct_change = 0.0 if current_val == 0 else 100.0
        else:
            pct_change = ((current_val - baseline_val) / abs(baseline_val)) * 100.0

        abs_diff = current_val - baseline_val
        direction = "increase" if pct_change > 0 else ("decrease" if pct_change < 0 else "change")

        interp = (
            f"{metric_name} changed by {pct_change:+.1f}% ({direction} of {abs(abs_diff):.2f}) "
            f"from {baseline_label} ({baseline_val:.2f}) to {current_label} ({current_val:.2f})."
        )

        return StatisticalMetric(
            test_name="Percentage Difference Analysis",
            statistic=float(pct_change),
            effect_size=float(pct_change / 100.0),
            effect_size_type="Relative Change",
            interpretation=interp,
        )


statistical_service = StatisticalTestingService()
