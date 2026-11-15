"""Frozen threshold and evaluation constants for Nittoo Forecast Lab.

All detector thresholds were tuned exclusively on dev seed 7 (500 x 24) and frozen
before evaluating on seed 42. See analytics/reports/detector_tuning.md.
"""

from __future__ import annotations

# Minimum completed positive-duration cycles (<1000d) per (user_id, product_id) for MAD.
MIN_CYCLES_FOR_MAD: int = 4

# Robust MAD floor as a fraction of median rate to prevent zero-MAD false positives.
MAD_FLOOR_FRAC: float = 0.10

# Modified z-score cutoff tuned on dev seed 7 (500 x 24).
MAD_Z_THRESHOLD: float = 4.5

# Max relative error for clean per-cycle rate recovery vs true rate (simulator noise=0.08).
RATE_RECOVERY_REL_TOL: float = 0.10

# Recall floor for deterministic/extreme faults (seed-7 1.00 minus 0.05 margin).
DETECTOR_RECALL_FLOOR: float = 0.95

# Precision floor for deterministic/extreme faults (seed-7 1.00 minus 0.05 margin).
DETECTOR_PRECISION_FLOOR: float = 0.95

# Recall floor for subtle_duration_outlier (seed-7 0.683 minus ~0.08 margin).
SUBTLE_OUTLIER_RECALL_FLOOR: float = 0.60

# Precision floor for subtle_duration_outlier (seed-7 0.120 minus 0.02 margin).
SUBTLE_OUTLIER_PRECISION_FLOOR: float = 0.10

# Clean-cycle false-positive rate ceiling (seed-7 0.0279 plus ~0.007 margin).
CLEAN_FPR_CEILING: float = 0.035
