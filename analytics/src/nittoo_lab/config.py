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
