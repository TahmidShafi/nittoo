"""Frozen threshold and evaluation constants for Nittoo Forecast Lab.

Iteration 2 thresholds were tuned exclusively on dev seed 7 (500 x 24) and frozen
before evaluating on holdout seed 2027. See analytics/reports/detector_tuning.md.
"""

from __future__ import annotations

# Minimum completed positive-duration cycles (<1000d) per (user_id, product_id) for MAD.
MIN_CYCLES_FOR_MAD: int = 3

# Robust MAD floor as a fraction of median rate to prevent zero-MAD false positives.
MAD_FLOOR_FRAC: float = 0.10

# Modified z-score cutoff tuned on dev seed 7 (500 x 24, iteration 2).
MAD_Z_THRESHOLD: float = 3.5

# Max relative error for clean per-cycle rate recovery vs true rate (simulator noise=0.08).
RATE_RECOVERY_REL_TOL: float = 0.10

# Recall floor for deterministic/extreme faults (seed-7 1.00 minus 0.05 margin).
DETECTOR_RECALL_FLOOR: float = 0.95

# Precision floor for deterministic/extreme faults (seed-7 1.00 minus 0.05 margin).
DETECTOR_PRECISION_FLOOR: float = 0.95

# Recall floor for subtle_duration_outlier (seed-7 0.994 minus ~0.09 margin).
SUBTLE_OUTLIER_RECALL_FLOOR: float = 0.90

# Precision floor for subtle_duration_outlier (seed-7 0.961 minus ~0.11 margin).
SUBTLE_OUTLIER_PRECISION_FLOOR: float = 0.85

# Clean-cycle false-positive rate ceiling (seed-7 0.0002 plus ~0.0048 margin).
CLEAN_FPR_CEILING: float = 0.005

# Min holdout precision to exclude is_rate_outlier from is_valid_for_forecasting (else advisory).
RATE_OUTLIER_MIN_PRECISION_TO_EXCLUDE: float = 0.50

# Baseline simulator cycle-to-cycle noise std dev.
DEFAULT_CYCLE_NOISE_STD: float = 0.08

# Pack-size elasticity of consumption (rate proportional to (size / base_size) ** epsilon).
DEFAULT_PACK_SIZE_ELASTICITY: float = 0.0
ELASTICITY_SWEEP_LEVELS: tuple[float, ...] = (0.3, 0.6)
ELASTICITY_SWEEP_SEEDS: tuple[int, ...] = (4003, 4004)

# Robustness sweep noise levels (baseline, ~2.5x, ~4x).
ROBUSTNESS_NOISE_LEVELS: tuple[float, ...] = (0.08, 0.20, 0.32)

# Baseline subtle_duration_outlier slow/fast multiplier ranges.
DEFAULT_SUBTLE_SLOW_RANGE: tuple[float, float] = (2.5, 6.0)
DEFAULT_SUBTLE_FAST_RANGE: tuple[float, float] = (0.2, 0.4)

# Harder subtle_duration_outlier slow/fast multiplier ranges for robustness sweep.
HARDER_SUBTLE_SLOW_RANGE: tuple[float, float] = (1.5, 2.5)
HARDER_SUBTLE_FAST_RANGE: tuple[float, float] = (0.4, 0.67)

# Fresh seeds (never used in dev/holdout) for the 6-cell robustness matrix (200 HH x 24 mo).
ROBUSTNESS_SEEDS: tuple[int, ...] = (3001, 3002, 3003, 3004, 3005, 3006)
ROBUSTNESS_HOUSEHOLDS: int = 200
ROBUSTNESS_MONTHS: int = 24

# Rule-based duration validity bounds (matches src/lib/prediction.ts).
MIN_VALID_DURATION_DAYS: int = 1
MAX_VALID_DURATION_DAYS: int = 1000

# Minimum completed prefix cycles required before rolling-origin forecasting.
MIN_TRAIN_CYCLES: int = 2

# Number of candidate method-variants compared against baseline (none) in backtest.
FORECAST_NUM_CANDIDATES: int = 12

# Family-wise error rate and Bonferroni-adjusted CI level for multiple comparisons.
FORECAST_FAMILY_ALPHA: float = 0.05
FORECAST_BONFERRONI_CI_LEVEL: float = 1.0 - (FORECAST_FAMILY_ALPHA / FORECAST_NUM_CANDIDATES)

# Clustered bootstrap replicates and RNG seed for MAE improvement CIs.
FORECAST_BOOTSTRAP_REPLICATES: int = 1000
FORECAST_BOOTSTRAP_SEED: int = 20261115

# Tuned on dev seed 7 (500 x 24) and frozen before holdout seed 4001.
EWMA_DURATION_ALPHA: float = 0.85
EWMA_RATE_ALPHA: float = 0.25

# Empirical P10/P90 relative-residual quantiles per (method, variant, k_bucket) from dev seed 7.
FORECAST_INTERVAL_QUANTILES: dict[tuple[str, str, str], tuple[float, float]] = {
    ("baseline", "none", "2"): (-0.1739, 0.7329),
    ("baseline", "none", "3-4"): (-0.1892, 0.7113),
    ("baseline", "none", "5+"): (-0.3623, 0.7037),
    ("baseline", "rule_only", "2"): (-0.1667, 0.7),
    ("baseline", "rule_only", "3-4"): (-0.1724, 0.7073),
    ("baseline", "rule_only", "5+"): (-0.2927, 0.7143),
    ("baseline", "rule_plus_rate_outlier", "2"): (-0.1667, 0.7),
    ("baseline", "rule_plus_rate_outlier", "3-4"): (-0.1667, 0.7016),
    ("baseline", "rule_plus_rate_outlier", "5+"): (-0.2826, 0.7188),
    ("median_duration", "rule_only", "2"): (-0.1667, 0.7),
    ("median_duration", "rule_only", "3-4"): (-0.1429, 0.9474),
    ("median_duration", "rule_only", "5+"): (-0.1765, 1.0),
    ("median_duration", "rule_plus_rate_outlier", "2"): (-0.1667, 0.7),
    ("median_duration", "rule_plus_rate_outlier", "3-4"): (-0.1429, 0.9467),
    ("median_duration", "rule_plus_rate_outlier", "5+"): (-0.1765, 1.0),
    ("ewma_duration", "rule_only", "2"): (-0.1765, 0.6591),
    ("ewma_duration", "rule_only", "3-4"): (-0.1698, 0.484),
    ("ewma_duration", "rule_only", "5+"): (-0.2, 0.3287),
    ("ewma_duration", "rule_plus_rate_outlier", "2"): (-0.175, 0.6589),
    ("ewma_duration", "rule_plus_rate_outlier", "3-4"): (-0.1667, 0.4706),
    ("ewma_duration", "rule_plus_rate_outlier", "5+"): (-0.2, 0.32),
    ("rate_mean", "rule_only", "2"): (-0.1598, 0.1667),
    ("rate_mean", "rule_only", "3-4"): (-0.1364, 0.1675),
    ("rate_mean", "rule_only", "5+"): (-0.1111, 0.1549),
    ("rate_mean", "rule_plus_rate_outlier", "2"): (-0.1591, 0.1667),
    ("rate_mean", "rule_plus_rate_outlier", "3-4"): (-0.1333, 0.1618),
    ("rate_mean", "rule_plus_rate_outlier", "5+"): (-0.1111, 0.1429),
    ("rate_median", "rule_only", "2"): (-0.1598, 0.1667),
    ("rate_median", "rule_only", "3-4"): (-0.1389, 0.1667),
    ("rate_median", "rule_only", "5+"): (-0.1143, 0.146),
    ("rate_median", "rule_plus_rate_outlier", "2"): (-0.1591, 0.1667),
    ("rate_median", "rule_plus_rate_outlier", "3-4"): (-0.1389, 0.1667),
    ("rate_median", "rule_plus_rate_outlier", "5+"): (-0.1143, 0.1463),
    ("rate_ewma", "rule_only", "2"): (-0.1633, 0.1724),
    ("rate_ewma", "rule_only", "3-4"): (-0.1395, 0.1739),
    ("rate_ewma", "rule_only", "5+"): (-0.1154, 0.1538),
    ("rate_ewma", "rule_plus_rate_outlier", "2"): (-0.1633, 0.1724),
    ("rate_ewma", "rule_plus_rate_outlier", "3-4"): (-0.1379, 0.1667),
    ("rate_ewma", "rule_plus_rate_outlier", "5+"): (-0.112, 0.1463),
}
