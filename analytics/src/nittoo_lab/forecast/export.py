from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from nittoo_lab.config import (
    FORECAST_INTERVAL_QUANTILES,
    MAX_VALID_DURATION_DAYS,
    MIN_TRAIN_CYCLES,
    MIN_VALID_DURATION_DAYS,
)
from nittoo_lab.forecast.methods import js_round
from nittoo_lab.forecast.metrics import history_bucket

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = ANALYTICS_ROOT.parent
DEFAULT_CALIBRATION_PATH = REPO_ROOT / "src" / "lib" / "forecast" / "calibration.json"
DEFAULT_FORECAST_PARITY_PATH = ANALYTICS_ROOT / "fixtures" / "forecast_parity.json"


@dataclass(frozen=True)
class AppForecastOutput:
    valid_cycle_count: int
    predicted_lifespan: float | None
    predicted_remaining_days: int | None
    range_low_days: int | None
    range_high_days: int | None
    history_bucket: str | None


def build_calibration_payload() -> dict[str, Any]:
    buckets: dict[str, dict[str, float]] = {}
    for bucket in ("2", "3-4", "5+"):
        q10, q90 = FORECAST_INTERVAL_QUANTILES[("rate_mean", "rule_only", bucket)]
        buckets[bucket] = {"q10": q10, "q90": q90}

    return {
        "provenance": {
            "source_seed": 7,
            "method": "rate_mean",
            "variant": "rule_only",
            "min_train_cycles": MIN_TRAIN_CYCLES,
            "source": "analytics/src/nittoo_lab/config.py:FORECAST_INTERVAL_QUANTILES",
        },
        "buckets": buckets,
    }


def export_calibration(out_path: Path = DEFAULT_CALIBRATION_PATH) -> Path:
    payload = build_calibration_payload()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return out_path


def predict_app_rate_mean(
    cycles: list[dict[str, Any]],
    active_size_value: float | None,
    active_size_unit: str | None,
    current_days_used: int = 0,
) -> AppForecastOutput:
    valid = [
        c
        for c in cycles
        if MIN_VALID_DURATION_DAYS <= int(c["duration_days"]) < MAX_VALID_DURATION_DAYS
    ]
    if not valid:
        return AppForecastOutput(
            valid_cycle_count=0,
            predicted_lifespan=None,
            predicted_remaining_days=None,
            range_low_days=None,
            range_high_days=None,
            history_bucket=None,
        )

    rate_cycles = [
        c
        for c in valid
        if c.get("effective_size_value") is not None
        and float(c["effective_size_value"]) > 0
        and (
            active_size_unit is None
            or c.get("effective_size_unit") == active_size_unit
        )
    ]

    if active_size_value is not None and active_size_value > 0 and rate_cycles:
        rates = [float(c["effective_size_value"]) / float(c["duration_days"]) for c in rate_cycles]
        mean_rate = sum(rates) / len(rates)
        if mean_rate <= 0:
            return AppForecastOutput(len(valid), None, None, None, None, None)
        raw_lifespan = float(active_size_value) / mean_rate
    else:
        raw_lifespan = sum(float(c["duration_days"]) for c in valid) / len(valid)

    lifespan = math.floor(raw_lifespan * 10.0 + 0.5) / 10.0
    if lifespan <= 0:
        return AppForecastOutput(len(valid), None, None, None, None, None)

    remaining_days = js_round(lifespan - current_days_used)

    if len(valid) >= MIN_TRAIN_CYCLES:
        bucket = history_bucket(len(valid))
        q10, q90 = FORECAST_INTERVAL_QUANTILES[("rate_mean", "rule_only", bucket)]
        low_days = max(1, js_round(lifespan * (1.0 + q10)))
        high_days = max(low_days, js_round(lifespan * (1.0 + q90)))
    else:
        bucket = None
        low_days = None
        high_days = None

    return AppForecastOutput(
        valid_cycle_count=len(valid),
        predicted_lifespan=lifespan,
        predicted_remaining_days=remaining_days,
        range_low_days=low_days,
        range_high_days=high_days,
        history_bucket=bucket,
    )


def build_forecast_parity_payload() -> dict[str, Any]:
    raw_cases: list[dict[str, Any]] = [
        {
            "name": "constant_size_k2",
            "active_size_value": 200.0,
            "active_size_unit": "ml",
            "current_days_used": 10,
            "cycles": [
                {"duration_days": 30, "effective_size_value": 200.0, "effective_size_unit": "ml"},
                {"duration_days": 34, "effective_size_value": 200.0, "effective_size_unit": "ml"},
            ],
        },
        {
            "name": "size_switch_k3",
            "active_size_value": 473.0,
            "active_size_unit": "ml",
            "current_days_used": 20,
            "cycles": [
                {"duration_days": 40, "effective_size_value": 236.0, "effective_size_unit": "ml"},
                {"duration_days": 42, "effective_size_value": 236.0, "effective_size_unit": "ml"},
                {"duration_days": 38, "effective_size_value": 236.0, "effective_size_unit": "ml"},
            ],
        },
        {
            "name": "rule_exclusions_k5",
            "active_size_value": 500.0,
            "active_size_unit": "ml",
            "current_days_used": 5,
            "cycles": [
                {"duration_days": 0, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 1000, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 25, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 28, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 30, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 26, "effective_size_value": 500.0, "effective_size_unit": "ml"},
                {"duration_days": 29, "effective_size_value": 500.0, "effective_size_unit": "ml"},
            ],
        },
        {
            "name": "mixed_known_unknown_sizes",
            "active_size_value": 400.0,
            "active_size_unit": "ml",
            "current_days_used": 0,
            "cycles": [
                {"duration_days": 90, "effective_size_value": None, "effective_size_unit": None},
                {"duration_days": 20, "effective_size_value": 200.0, "effective_size_unit": "ml"},
                {"duration_days": 25, "effective_size_value": 200.0, "effective_size_unit": "ml"},
            ],
        },
        {
            "name": "unit_mismatch_exclusion",
            "active_size_value": 300.0,
            "active_size_unit": "ml",
            "current_days_used": 12,
            "cycles": [
                {"duration_days": 10, "effective_size_value": 100.0, "effective_size_unit": "g"},
                {"duration_days": 30, "effective_size_value": 150.0, "effective_size_unit": "ml"},
                {"duration_days": 30, "effective_size_value": 150.0, "effective_size_unit": "ml"},
            ],
        },
        {
            "name": "no_known_size_fallback_half_up",
            "active_size_value": None,
            "active_size_unit": None,
            "current_days_used": 0,
            "cycles": [
                {"duration_days": 10, "effective_size_value": None, "effective_size_unit": None},
                {"duration_days": 11, "effective_size_value": None, "effective_size_unit": None},
            ],
        },
        {
            "name": "no_valid_cycles",
            "active_size_value": 200.0,
            "active_size_unit": "ml",
            "current_days_used": 3,
            "cycles": [
                {"duration_days": 0, "effective_size_value": 200.0, "effective_size_unit": "ml"},
                {"duration_days": 1050, "effective_size_value": 200.0, "effective_size_unit": "ml"},
            ],
        },
    ]

    cases_out: list[dict[str, Any]] = []
    for case in raw_cases:
        out = predict_app_rate_mean(
            cycles=case["cycles"],
            active_size_value=case["active_size_value"],
            active_size_unit=case["active_size_unit"],
            current_days_used=case["current_days_used"],
        )
        cases_out.append(
            {
                **case,
                "expected": {
                    "valid_cycle_count": out.valid_cycle_count,
                    "predicted_lifespan": out.predicted_lifespan,
                    "predicted_remaining_days": out.predicted_remaining_days,
                    "range_low_days": out.range_low_days,
                    "range_high_days": out.range_high_days,
                    "history_bucket": out.history_bucket,
                },
            }
        )

    return {"cases": cases_out}


def export_forecast_parity(out_path: Path = DEFAULT_FORECAST_PARITY_PATH) -> Path:
    payload = build_forecast_parity_payload()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return out_path
