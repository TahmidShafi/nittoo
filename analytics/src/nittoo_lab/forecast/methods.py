from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np


def js_round(value: float) -> int:
    """Replicate JavaScript Math.round(x) half-up behavior for non-negative values."""
    return int(math.floor(value + 0.5))


def baseline_lifespan(durations: Sequence[float]) -> float | None:
    """Exact replica of calculateAverageLifespan in src/lib/prediction.ts."""
    if not durations:
        return None
    total = sum(durations)
    avg = math.floor((total / len(durations)) * 10.0 + 0.5) / 10.0
    return avg if avg > 0 else None


def baseline_predict(durations: Sequence[float]) -> float | None:
    """Exact replica of calculatePredictedRemainingDays(avg, 0) in src/lib/prediction.ts."""
    avg = baseline_lifespan(durations)
    if avg is None:
        return None
    return float(js_round(avg))


def median_duration_predict(durations: Sequence[float]) -> float | None:
    if not durations:
        return None
    med = float(np.median(durations))
    return float(js_round(med)) if med > 0 else None


def _ewma(values: Sequence[float], alpha: float) -> float:
    state = float(values[0])
    for v in values[1:]:
        state = alpha * float(v) + (1.0 - alpha) * state
    return state


def ewma_duration_predict(durations: Sequence[float], alpha: float) -> float | None:
    if not durations:
        return None
    est = _ewma(durations, alpha)
    return float(js_round(est)) if est > 0 else None


def rate_mean_predict(rates: Sequence[float], next_size: float | None) -> float | None:
    if not rates or next_size is None or next_size <= 0:
        return None
    mean_rate = sum(rates) / len(rates)
    if mean_rate <= 0:
        return None
    return float(max(1, js_round(next_size / mean_rate)))


def rate_median_predict(rates: Sequence[float], next_size: float | None) -> float | None:
    if not rates or next_size is None or next_size <= 0:
        return None
    med_rate = float(np.median(rates))
    if med_rate <= 0:
        return None
    return float(max(1, js_round(next_size / med_rate)))


def rate_ewma_predict(
    rates: Sequence[float], next_size: float | None, alpha: float
) -> float | None:
    if not rates or next_size is None or next_size <= 0:
        return None
    ewma_rate = _ewma(rates, alpha)
    if ewma_rate <= 0:
        return None
    return float(max(1, js_round(next_size / ewma_rate)))
