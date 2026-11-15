from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class MetricSummary:
    n: int
    mae: float
    median_ae: float
    mape_pct: float
    bias: float
    coverage_pct: float | None
    mean_width: float | None


@dataclass(frozen=True)
class BootstrapCI:
    mae_improvement: float
    ci_low: float
    ci_high: float
    ci_level: float


def history_bucket(k: int) -> str:
    if k <= 2:
        return "2"
    if k <= 4:
        return "3-4"
    return "5+"


def compute_metrics(
    actuals: Sequence[float],
    preds: Sequence[float],
    lows: Sequence[float] | None = None,
    highs: Sequence[float] | None = None,
) -> MetricSummary:
    if not actuals:
        return MetricSummary(
            n=0,
            mae=0.0,
            median_ae=0.0,
            mape_pct=0.0,
            bias=0.0,
            coverage_pct=None,
            mean_width=None,
        )
    a = np.asarray(actuals, dtype=float)
    p = np.asarray(preds, dtype=float)
    abs_err = np.abs(p - a)
    mae = float(np.mean(abs_err))
    med_ae = float(np.median(abs_err))
    bias = float(np.mean(p - a))

    pos_mask = a > 0
    mape_pct = (
        float(np.mean(abs_err[pos_mask] / a[pos_mask]) * 100.0) if np.any(pos_mask) else 0.0
    )

    coverage_pct: float | None = None
    mean_width: float | None = None
    if lows is not None and highs is not None and len(lows) == len(actuals):
        lo = np.asarray(lows, dtype=float)
        hi = np.asarray(highs, dtype=float)
        covered = (a >= lo) & (a <= hi)
        coverage_pct = float(np.mean(covered) * 100.0)
        mean_width = float(np.mean(hi - lo))

    return MetricSummary(
        n=len(actuals),
        mae=round(mae, 3),
        median_ae=round(med_ae, 3),
        mape_pct=round(mape_pct, 2),
        bias=round(bias, 3),
        coverage_pct=round(coverage_pct, 2) if coverage_pct is not None else None,
        mean_width=round(mean_width, 2) if mean_width is not None else None,
    )


def apply_interval(pred: float, q10: float, q90: float) -> tuple[float, float]:
    lo = max(1.0, round(pred * (1.0 + q10)))
    hi = max(lo, round(pred * (1.0 + q90)))
    return float(lo), float(hi)


def household_bootstrap_ci(
    user_ids: Sequence[str],
    baseline_abs_errors: Sequence[float],
    candidate_abs_errors: Sequence[float],
    n_boot: int,
    ci_level: float,
    seed: int,
) -> BootstrapCI:
    """Clustered bootstrap over households for MAE improvement (baseline - candidate)."""
    hh_map: dict[str, int] = {}
    hh_base: list[float] = []
    hh_cand: list[float] = []
    hh_cnt: list[int] = []

    for uid, be, ce in zip(user_ids, baseline_abs_errors, candidate_abs_errors, strict=True):
        idx = hh_map.get(uid)
        if idx is None:
            idx = len(hh_base)
            hh_map[uid] = idx
            hh_base.append(0.0)
            hh_cand.append(0.0)
            hh_cnt.append(0)
        hh_base[idx] += float(be)
        hh_cand[idx] += float(ce)
        hh_cnt[idx] += 1

    base_arr = np.asarray(hh_base, dtype=float)
    cand_arr = np.asarray(hh_cand, dtype=float)
    cnt_arr = np.asarray(hh_cnt, dtype=float)
    n_hh = len(hh_base)

    point_diff = float((np.sum(base_arr) - np.sum(cand_arr)) / max(1.0, np.sum(cnt_arr)))

    rng = np.random.default_rng(seed)
    idx_mat = rng.integers(0, n_hh, size=(n_boot, n_hh))
    boot_base = np.sum(base_arr[idx_mat], axis=1)
    boot_cand = np.sum(cand_arr[idx_mat], axis=1)
    boot_cnt = np.sum(cnt_arr[idx_mat], axis=1)
    boot_diffs = (boot_base - boot_cand) / np.maximum(1.0, boot_cnt)

    alpha = 1.0 - ci_level
    ci_low = float(np.quantile(boot_diffs, alpha / 2.0))
    ci_high = float(np.quantile(boot_diffs, 1.0 - alpha / 2.0))

    return BootstrapCI(
        mae_improvement=round(point_diff, 4),
        ci_low=round(ci_low, 4),
        ci_high=round(ci_high, 4),
        ci_level=ci_level,
    )


def select_winner(
    candidate_maes: dict[tuple[str, str], float],
    candidate_cis: dict[tuple[str, str], BootstrapCI],
    baseline_key: tuple[str, str] = ("baseline", "none"),
) -> tuple[str, str]:
    """Return lowest-MAE candidate whose Bonferroni CI excludes 0 (else baseline)."""
    qualifying = [
        (mae, key)
        for key, mae in candidate_maes.items()
        if key != baseline_key and candidate_cis[key].ci_low > 0.0
    ]
    if not qualifying:
        return baseline_key
    qualifying.sort(key=lambda x: x[0])
    return qualifying[0][1]
