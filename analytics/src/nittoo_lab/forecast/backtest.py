from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import duckdb
import numpy as np

from nittoo_lab.config import (
    MAD_FLOOR_FRAC,
    MAD_Z_THRESHOLD,
    MIN_CYCLES_FOR_MAD,
    MIN_TRAIN_CYCLES,
)
from nittoo_lab.forecast.methods import (
    baseline_predict,
    ewma_duration_predict,
    median_duration_predict,
    rate_ewma_predict,
    rate_mean_predict,
    rate_median_predict,
)

ALL_METHODS: tuple[str, ...] = (
    "baseline",
    "median_duration",
    "ewma_duration",
    "rate_mean",
    "rate_median",
    "rate_ewma",
)

CANDIDATE_VARIANTS: tuple[tuple[str, str], ...] = (
    ("baseline", "rule_only"),
    ("baseline", "rule_plus_rate_outlier"),
    ("median_duration", "rule_only"),
    ("median_duration", "rule_plus_rate_outlier"),
    ("ewma_duration", "rule_only"),
    ("ewma_duration", "rule_plus_rate_outlier"),
    ("rate_mean", "rule_only"),
    ("rate_mean", "rule_plus_rate_outlier"),
    ("rate_median", "rule_only"),
    ("rate_median", "rule_plus_rate_outlier"),
    ("rate_ewma", "rule_only"),
    ("rate_ewma", "rule_plus_rate_outlier"),
)

ALL_METHOD_VARIANTS: tuple[tuple[str, str], ...] = (
    ("baseline", "none"),
    *CANDIDATE_VARIANTS,
)


@dataclass(frozen=True)
class CycleObs:
    usage_period_id: str
    user_id: str
    product_id: str
    category: str
    opened_date: str
    duration_days: int
    effective_size_value: float | None
    effective_size_unit: str | None
    size_changed_from_previous: bool
    is_zero_day: bool
    is_extreme_duration_1000d: bool


@dataclass(frozen=True)
class BacktestTarget:
    usage_period_id: str
    user_id: str
    product_id: str
    category: str
    k: int
    actual_days: float
    size_changed_from_previous: bool
    has_constant_size_history: bool
    is_rule_clean: bool
    is_oracle_clean: bool
    preds: dict[tuple[str, str], float]


@dataclass(frozen=True)
class SizeSwitchStats:
    total_purchases: int
    override_purchases: int
    purchase_override_pct: float
    total_products: int
    switched_products: int
    product_switch_pct: float


def _load_bounds(con: duckdb.DuckDBPyConnection) -> dict[tuple[str, str], tuple[float, float]]:
    tables = {
        (r[0], r[1])
        for r in con.execute(
            "SELECT table_schema, table_name FROM information_schema.tables"
        ).fetchall()
    }
    bounds: dict[tuple[str, str], tuple[float, float]] = {}
    for schema, tbl in tables:
        if tbl == "category_rate_bounds":
            rows = con.execute(
                f'SELECT category, size_unit, min_plausible_rate, max_plausible_rate '
                f'FROM "{schema}"."{tbl}"'
            ).fetchall()
            for cat, unit, lo, hi in rows:
                bounds[(str(cat), str(unit))] = (float(lo), float(hi))
            break
    return bounds


def load_completed_cycles(
    db_path: Path,
) -> tuple[dict[tuple[str, str], list[CycleObs]], dict[tuple[str, str], tuple[float, float]]]:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        rows = con.execute(
            """
            SELECT
                f.usage_period_id,
                f.user_id,
                f.product_id,
                p.category,
                CAST(f.opened_date AS VARCHAR) AS opened_date,
                f.duration_days,
                f.effective_size_value,
                f.effective_size_unit,
                f.size_changed_from_previous,
                f.is_zero_day,
                f.is_extreme_duration_1000d
            FROM main_marts.fact_consumption_cycle AS f
            INNER JOIN main_marts.dim_product AS p
                ON f.product_id = p.product_id
            WHERE f.status = 'completed'
              AND f.finished_date IS NOT NULL
              AND f.duration_days IS NOT NULL
            ORDER BY f.user_id ASC, f.product_id ASC, f.opened_date ASC, f.usage_period_id ASC
            """
        ).fetchall()
        bounds = _load_bounds(con)
    finally:
        con.close()

    if not rows:
        raise ValueError(
            "Backtest dataset is empty: no completed cycles found in fact_consumption_cycle."
        )

    grouped: dict[tuple[str, str], list[CycleObs]] = {}
    for (
        uid,
        user_id,
        product_id,
        category,
        opened_date,
        dur,
        eff_size,
        eff_unit,
        size_changed,
        is_zero,
        is_1000d,
    ) in rows:
        key = (str(user_id), str(product_id))
        grouped.setdefault(key, []).append(
            CycleObs(
                usage_period_id=str(uid),
                user_id=str(user_id),
                product_id=str(product_id),
                category=str(category),
                opened_date=str(opened_date),
                duration_days=int(dur),
                effective_size_value=float(eff_size) if eff_size is not None else None,
                effective_size_unit=str(eff_unit) if eff_unit is not None else None,
                size_changed_from_previous=bool(size_changed),
                is_zero_day=bool(is_zero),
                is_extreme_duration_1000d=bool(is_1000d),
            )
        )
    return grouped, bounds


def _filter_prefix_point_in_time(
    prefix: Sequence[CycleObs],
    variant: str,
    bounds: dict[tuple[str, str], tuple[float, float]],
) -> list[CycleObs]:
    if variant == "none":
        return list(prefix)

    rule_clean = [
        c
        for c in prefix
        if not c.is_zero_day and not c.is_extreme_duration_1000d and c.duration_days > 0
    ]
    if variant == "rule_only":
        return rule_clean if rule_clean else list(prefix)

    # rule_plus_rate_outlier: strictly computed on rule_clean prefix cycles 1..k
    rate_pairs = [
        (c, c.effective_size_value / c.duration_days)
        for c in rule_clean
        if c.effective_size_value is not None and c.effective_size_value > 0
    ]
    if not rate_pairs:
        return rule_clean if rule_clean else list(prefix)

    rates = np.asarray([r for _, r in rate_pairs], dtype=float)
    if len(rates) >= MIN_CYCLES_FOR_MAD:
        med = float(np.median(rates))
        mad = max(float(np.median(np.abs(rates - med))), MAD_FLOOR_FRAC * med)
        if mad > 0:
            kept = [
                c
                for c, r in rate_pairs
                if (0.6745 * abs(r - med) / mad) <= MAD_Z_THRESHOLD
            ]
        else:
            kept = [c for c, _ in rate_pairs]
    else:
        kept = []
        for c, r in rate_pairs:
            b = bounds.get((c.category, c.effective_size_unit or ""))
            if b is None or (b[0] <= r <= b[1]):
                kept.append(c)

    if kept:
        return kept
    return rule_clean if rule_clean else list(prefix)


def predict_from_prefix(
    prefix: Sequence[CycleObs],
    next_cycle: CycleObs,
    variant: str,
    bounds: dict[tuple[str, str], tuple[float, float]],
    ewma_duration_alpha: float,
    ewma_rate_alpha: float,
) -> dict[str, float]:
    train = _filter_prefix_point_in_time(prefix, variant, bounds)
    durations = [float(c.duration_days) for c in train]
    rates = [
        float(c.effective_size_value) / float(c.duration_days)
        for c in train
        if c.duration_days > 0 and c.effective_size_value is not None and c.effective_size_value > 0
    ]
    next_size = next_cycle.effective_size_value

    base_p = baseline_predict(durations)
    if base_p is None:
        base_p = float(max(1, round(sum(durations) / len(durations)))) if durations else 1.0

    if variant == "none":
        return {"baseline": base_p}

    med_p = median_duration_predict(durations) or base_p
    ewma_d_p = ewma_duration_predict(durations, ewma_duration_alpha) or base_p
    rate_mean_p = rate_mean_predict(rates, next_size) or base_p
    rate_med_p = rate_median_predict(rates, next_size) or base_p
    rate_ewma_p = rate_ewma_predict(rates, next_size, ewma_rate_alpha) or base_p

    return {
        "baseline": base_p,
        "median_duration": med_p,
        "ewma_duration": ewma_d_p,
        "rate_mean": rate_mean_p,
        "rate_median": rate_med_p,
        "rate_ewma": rate_ewma_p,
    }


def run_rolling_backtest(
    db_path: Path,
    ewma_duration_alpha: float,
    ewma_rate_alpha: float,
    faults_manifest_path: Path | None = None,
    min_train_cycles: int = MIN_TRAIN_CYCLES,
) -> list[BacktestTarget]:
    grouped, bounds = load_completed_cycles(db_path)

    oracle_fault_ids: set[str] = set()
    if faults_manifest_path is not None and faults_manifest_path.exists():
        manifest = json.loads(faults_manifest_path.read_text(encoding="utf-8"))
        oracle_fault_ids = {
            str(f["record_id"])
            for f in manifest.get("faults", [])
            if f.get("entity_type") == "usage_period"
        }

    targets: list[BacktestTarget] = []
    for (_user_id, _prod_id), cycles in grouped.items():
        if len(cycles) <= min_train_cycles:
            continue
        for k in range(min_train_cycles, len(cycles)):
            prefix = cycles[:k]
            nxt = cycles[k]
            preds: dict[tuple[str, str], float] = {}
            for variant in ("none", "rule_only", "rule_plus_rate_outlier"):
                v_preds = predict_from_prefix(
                    prefix=prefix,
                    next_cycle=nxt,
                    variant=variant,
                    bounds=bounds,
                    ewma_duration_alpha=ewma_duration_alpha,
                    ewma_rate_alpha=ewma_rate_alpha,
                )
                for m_name, p_val in v_preds.items():
                    preds[(m_name, variant)] = p_val

            is_rule_clean = (not nxt.is_zero_day) and (not nxt.is_extreme_duration_1000d)
            is_oracle_clean = is_rule_clean and (nxt.usage_period_id not in oracle_fault_ids)
            has_constant_size_history = (
                len({(c.effective_size_value, c.effective_size_unit) for c in [*prefix, nxt]}) == 1
            )
            targets.append(
                BacktestTarget(
                    usage_period_id=nxt.usage_period_id,
                    user_id=nxt.user_id,
                    product_id=nxt.product_id,
                    category=nxt.category,
                    k=k,
                    actual_days=float(nxt.duration_days),
                    size_changed_from_previous=nxt.size_changed_from_previous,
                    has_constant_size_history=has_constant_size_history,
                    is_rule_clean=is_rule_clean,
                    is_oracle_clean=is_oracle_clean,
                    preds=preds,
                )
            )

    if not targets:
        raise ValueError("No rolling-origin backtest targets produced (history too short).")
    return targets


def load_size_switch_stats(db_path: Path) -> SizeSwitchStats:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        pur_row = con.execute(
            """
            SELECT
                COUNT(*),
                COALESCE(SUM(CASE WHEN size_value IS NOT NULL THEN 1 ELSE 0 END), 0)
            FROM raw.purchases
            """
        ).fetchone()
        prod_row = con.execute(
            """
            SELECT
                COUNT(*),
                COALESCE(SUM(has_switch), 0)
            FROM (
                SELECT
                    user_id,
                    product_id,
                    MAX(CASE WHEN size_changed_from_previous THEN 1 ELSE 0 END) AS has_switch
                FROM main_marts.fact_consumption_cycle
                WHERE status = 'completed'
                GROUP BY 1, 2
            ) t
            """
        ).fetchone()
    finally:
        con.close()

    total_pur = int(pur_row[0]) if pur_row else 0
    over_pur = int(pur_row[1]) if pur_row else 0
    total_prod = int(prod_row[0]) if prod_row else 0
    sw_prod = int(prod_row[1]) if prod_row else 0
    return SizeSwitchStats(
        total_purchases=total_pur,
        override_purchases=over_pur,
        purchase_override_pct=(100.0 * over_pur / total_pur) if total_pur else 0.0,
        total_products=total_prod,
        switched_products=sw_prod,
        product_switch_pct=(100.0 * sw_prod / total_prod) if total_prod else 0.0,
    )
