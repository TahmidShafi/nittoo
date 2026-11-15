from __future__ import annotations

import json
import math
import random
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from nittoo_lab.config import (
    FORECAST_INTERVAL_QUANTILES,
    MAX_VALID_DURATION_DAYS,
    MIN_TRAIN_CYCLES,
    MIN_VALID_DURATION_DAYS,
)
from nittoo_lab.forecast.backtest import load_completed_cycles
from nittoo_lab.forecast.methods import js_round
from nittoo_lab.forecast.metrics import history_bucket
from nittoo_lab.ingest.loader import ingest_exports
from nittoo_lab.simulate.generator import simulate_households
from nittoo_lab.transform.runner import run_dbt_pipeline

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
    all_cases = raw_cases + _sample_simulator_parity_cases()
    for case in all_cases:
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


def _sample_simulator_parity_cases(
    sample_size: int = 300,
    sim_seed: int = 7,
    sampling_seed: int = 20261115,
) -> list[dict[str, Any]]:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        exports_dir = tmp_dir / "exports"
        gt_path = tmp_dir / "gt.json"
        faults_path = tmp_dir / "faults.json"
        db_path = tmp_dir / "lab.duckdb"
        simulate_households(
            households=100,
            months=24,
            seed=sim_seed,
            exports_dir=exports_dir,
            ground_truth_path=gt_path,
            faults_manifest_path=faults_path,
        )
        ingest_exports(exports_dir=exports_dir, db_path=db_path)
        run_dbt_pipeline(db_path=db_path, generate_docs=False)
        grouped, _ = load_completed_cycles(db_path)

    pool_by_stratum: dict[str, list[dict[str, Any]]] = {
        "rule_excl": [],
        "k1": [],
        "k2": [],
        "k3_4": [],
        "k5_plus": [],
        "switch": [],
    }
    for key in sorted(grouped):
        cycles = grouped[key]
        if len(cycles) < 2:
            continue
        for k in range(1, len(cycles)):
            prefix = cycles[:k]
            nxt = cycles[k]
            case = {
                "name": f"sim_{key[0]}_{key[1]}_k{k}",
                "active_size_value": nxt.effective_size_value,
                "active_size_unit": nxt.effective_size_unit,
                "current_days_used": max(0, nxt.duration_days // 2),
                "cycles": [
                    {
                        "duration_days": c.duration_days,
                        "effective_size_value": c.effective_size_value,
                        "effective_size_unit": c.effective_size_unit,
                    }
                    for c in prefix
                ],
            }
            has_excl = any(
                c.duration_days < MIN_VALID_DURATION_DAYS
                or c.duration_days >= MAX_VALID_DURATION_DAYS
                for c in prefix
            )
            has_switch = nxt.size_changed_from_previous or any(
                c.size_changed_from_previous for c in prefix
            )
            if has_excl:
                pool_by_stratum["rule_excl"].append(case)
            elif has_switch:
                pool_by_stratum["switch"].append(case)
            elif k == 1:
                pool_by_stratum["k1"].append(case)
            elif k == 2:
                pool_by_stratum["k2"].append(case)
            elif k <= 4:
                pool_by_stratum["k3_4"].append(case)
            else:
                pool_by_stratum["k5_plus"].append(case)

    rng = random.Random(sampling_seed)
    sampled: list[dict[str, Any]] = []
    quotas = {
        "rule_excl": 30,
        "switch": 90,
        "k1": 30,
        "k2": 50,
        "k3_4": 50,
        "k5_plus": 50,
    }
    for stratum, quota in quotas.items():
        items = pool_by_stratum[stratum]
        take = min(quota, len(items))
        sampled.extend(rng.sample(items, take))

    # Top up deterministically if any stratum was smaller than quota
    if len(sampled) < sample_size:
        seen = {c["name"] for c in sampled}
        remaining = [
            c
            for items in pool_by_stratum.values()
            for c in items
            if c["name"] not in seen
        ]
        need = min(sample_size - len(sampled), len(remaining))
        sampled.extend(rng.sample(remaining, need))

    return sampled


def export_forecast_parity(out_path: Path = DEFAULT_FORECAST_PARITY_PATH) -> Path:
    payload = build_forecast_parity_payload()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return out_path
