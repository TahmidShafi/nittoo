from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from nittoo_lab.config import (
    DEFAULT_CYCLE_NOISE_STD,
    DEFAULT_PACK_SIZE_ELASTICITY,
    DEFAULT_SUBTLE_FAST_RANGE,
    DEFAULT_SUBTLE_SLOW_RANGE,
)
from nittoo_lab.contracts.models import ProductCategory, SizeUnit
from nittoo_lab.simulate.archetypes import ARCHETYPES, ProductArchetype

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_EXPORTS_DIR = ANALYTICS_ROOT / "data" / "raw" / "exports"
DEFAULT_GROUND_TRUTH_PATH = ANALYTICS_ROOT / "data" / "ground_truth" / "true_rates.json"
DEFAULT_FAULTS_MANIFEST_PATH = ANALYTICS_ROOT / "data" / "ground_truth" / "injected_faults.json"

VENDOR_PRICE_FACTOR: dict[str, float] = {
    "Shwapno": 0.99,
    "Chaldal": 0.98,
    "Agora": 1.00,
    "Meena Bazar": 1.01,
    "Unimart": 1.03,
    "Shajgoj": 1.02,
    "Daraz": 0.96,
    "Aarong": 1.04,
    "Local Pharmacy": 1.00,
}


@dataclass(frozen=True)
class SimulationStats:
    households: int
    months: int
    seed: int
    products: int
    purchases: int
    usage_periods: int
    restock_plans: int
    injected_faults: dict[str, int]
    elapsed_seconds: float
    exports_dir: Path
    ground_truth_path: Path
    faults_manifest_path: Path


def _seasonality_multiplier(seasonality: str, month: int) -> float:
    if seasonality == "summer" and month in (3, 4, 5, 6):
        return 1.15
    if seasonality == "winter" and month in (11, 12, 1, 2):
        return 1.15
    if seasonality == "festive" and month in (3, 4, 6):
        return 1.12
    return 1.0


def _pick_size(
    rng: np.random.Generator,
    tpl: ProductArchetype,
    current_size: float,
) -> float:
    if len(tpl.sizes) > 1 and rng.random() < 0.15:
        alternatives = [s for s in tpl.sizes if s != current_size]
        return float(rng.choice(alternatives))
    return current_size


def _compute_price(
    rng: np.random.Generator,
    tpl: ProductArchetype,
    size: float,
    days_since_start: int,
    vendor: str,
) -> float:
    base_size = tpl.sizes[0]
    # Bulk pack discount: larger packs cost slightly less per unit (exponent 0.92)
    size_scale = (size / base_size) ** 0.92
    inflation = (1.0 + tpl.annual_inflation) ** (max(0, days_since_start) / 365.0)
    vendor_factor = VENDOR_PRICE_FACTOR.get(vendor, 1.0)
    noise = float(rng.normal(1.0, 0.025))
    price = tpl.base_price_bdt * size_scale * inflation * vendor_factor * max(0.85, noise)
    return round(max(10.0, price), 2)


def simulate_households(
    households: int = 500,
    months: int = 24,
    seed: int = 42,
    exports_dir: Path = DEFAULT_EXPORTS_DIR,
    ground_truth_path: Path = DEFAULT_GROUND_TRUTH_PATH,
    faults_manifest_path: Path | None = None,
    reference_date: date = date(2026, 11, 15),
    cycle_noise_std: float = DEFAULT_CYCLE_NOISE_STD,
    subtle_slow_range: tuple[float, float] = DEFAULT_SUBTLE_SLOW_RANGE,
    subtle_fast_range: tuple[float, float] = DEFAULT_SUBTLE_FAST_RANGE,
    pack_size_elasticity: float = DEFAULT_PACK_SIZE_ELASTICITY,
) -> SimulationStats:
    t0 = time.perf_counter()
    rng = np.random.default_rng(seed)

    if faults_manifest_path is None:
        faults_manifest_path = ground_truth_path.parent / "injected_faults.json"

    exports_dir.mkdir(parents=True, exist_ok=True)
    for old_file in exports_dir.glob("hh_*.json"):
        old_file.unlink()
    ground_truth_path.parent.mkdir(parents=True, exist_ok=True)
    faults_manifest_path.parent.mkdir(parents=True, exist_ok=True)

    window_days = months * 30
    start_date = reference_date - timedelta(days=window_days)

    total_products = 0
    total_purchases = 0
    total_usage = 0
    total_restock = 0
    fault_counts: dict[str, int] = {
        "zero_day_cycle": 0,
        "duplicate_purchase": 0,
        "outlier_1000_day": 0,
        "finished_before_opened": 0,
        "subtle_duration_outlier": 0,
    }
    ground_truth_records: list[dict[str, object]] = []
    fault_records: list[dict[str, object]] = []

    for h_idx in range(1, households + 1):
        hh_id = f"hh_{h_idx:04d}"
        hh_email = f"{hh_id}@synthetic.nittoo.local"
        n_products = int(rng.integers(6, 13))
        chosen_indices = rng.choice(len(ARCHETYPES), size=n_products, replace=False)

        products: list[dict[str, object]] = []
        purchases: list[dict[str, object]] = []
        usage_periods: list[dict[str, object]] = []
        inventory: list[dict[str, object]] = []
        analytics_items: list[dict[str, object]] = []
        restock_plans: list[dict[str, object]] = []
        categories_seen: set[ProductCategory] = set()
        completed_count = 0
        active_count = 0
        unopened_count = 0

        for idx in chosen_indices:
            tpl = ARCHETYPES[int(idx)]
            categories_seen.add(tpl.category)
            prod_id = f"{hh_id}-prod-{tpl.slug}"

            # Household-specific true consumption rate (ml/g/count per day)
            hh_mult = float(np.clip(rng.lognormal(0.0, 0.22), 0.55, 1.85))
            true_rate = round(tpl.base_daily_rate * hh_mult, 4)

            is_abandoned = bool(rng.random() < 0.10)
            max_cycles = int(rng.integers(1, 4)) if is_abandoned else 999

            current_size = float(tpl.sizes[0])
            primary_vendor = str(rng.choice(tpl.vendors))
            offset_days = int(rng.integers(0, min(45, max(1, window_days // 4))))
            cursor_date = start_date + timedelta(days=offset_days)
            first_created = cursor_date

            cycle_num = 0
            completed_durations: list[int] = []
            last_vendor = primary_vendor

            while cursor_date < reference_date and cycle_num < max_cycles:
                cycle_num += 1
                if cycle_num > 1:
                    current_size = _pick_size(rng, tpl, current_size)
                vendor = primary_vendor if rng.random() < 0.78 else str(rng.choice(tpl.vendors))
                last_vendor = vendor

                purchase_date = max(
                    start_date, cursor_date - timedelta(days=int(rng.integers(1, 4)))
                )
                days_since_start = (purchase_date - start_date).days
                price = _compute_price(rng, tpl, current_size, days_since_start, vendor)

                default_size = float(tpl.sizes[0])
                size_override = current_size if current_size != default_size else None
                unit_override = tpl.unit if size_override is not None else None

                pur_id = f"{hh_id}-pur-{tpl.slug}-{cycle_num:02d}"
                pur_row: dict[str, object] = {
                    "id": pur_id,
                    "product_id": prod_id,
                    "product_name": tpl.name,
                    "brand": tpl.brand,
                    "category": tpl.category,
                    "purchase_date": purchase_date.isoformat(),
                    "price": price,
                    "currency": "BDT",
                    "store_vendor": vendor,
                    "size_value": size_override,
                    "size_unit": unit_override,
                }
                purchases.append(pur_row)

                # ~0.5% fault: duplicate purchase row
                if rng.random() < 0.005:
                    purchases.append(dict(pur_row))
                    fault_counts["duplicate_purchase"] += 1
                    fault_records.append(
                        {
                            "fault_type": "duplicate_purchase",
                            "entity_type": "purchase",
                            "record_id": pur_id,
                            "source_file": f"{hh_id}.json",
                            "household_id": hh_id,
                        }
                    )

                opened_date = cursor_date
                season_mult = _seasonality_multiplier(tpl.seasonality, opened_date.month)
                low_clip = 0.75 if cycle_noise_std == DEFAULT_CYCLE_NOISE_STD else 0.25
                high_clip = 1.30 if cycle_noise_std == DEFAULT_CYCLE_NOISE_STD else 2.50
                noise_mult = float(
                    np.clip(rng.normal(1.0, cycle_noise_std), low_clip, high_clip)
                )
                elasticity_mult = (
                    (current_size / float(tpl.sizes[0])) ** pack_size_elasticity
                    if pack_size_elasticity != 0.0
                    else 1.0
                )
                effective_rate = true_rate * season_mult * noise_mult * elasticity_mult
                true_duration = max(7, round(current_size / effective_rate))
                expected_finish = opened_date + timedelta(days=true_duration)

                use_id = f"{hh_id}-use-{tpl.slug}-{cycle_num:02d}"
                if expected_finish <= reference_date:
                    finished_date = expected_finish
                    days_used = (finished_date - opened_date).days

                    # ~2.0% fault injection across finished cycles
                    fault_roll = rng.random()
                    if fault_roll < 0.005:
                        finished_date = opened_date
                        days_used = 0
                        fault_counts["zero_day_cycle"] += 1
                        fault_records.append(
                            {
                                "fault_type": "zero_day_cycle",
                                "entity_type": "usage_period",
                                "record_id": use_id,
                                "source_file": f"{hh_id}.json",
                                "household_id": hh_id,
                            }
                        )
                    elif fault_roll < 0.010:
                        finished_date = opened_date + timedelta(days=1050)
                        days_used = 1050
                        fault_counts["outlier_1000_day"] += 1
                        fault_records.append(
                            {
                                "fault_type": "outlier_1000_day",
                                "entity_type": "usage_period",
                                "record_id": use_id,
                                "source_file": f"{hh_id}.json",
                                "household_id": hh_id,
                            }
                        )
                    elif fault_roll < 0.015:
                        finished_date = opened_date - timedelta(days=5)
                        days_used = 0
                        fault_counts["finished_before_opened"] += 1
                        fault_records.append(
                            {
                                "fault_type": "finished_before_opened",
                                "entity_type": "usage_period",
                                "record_id": use_id,
                                "source_file": f"{hh_id}.json",
                                "household_id": hh_id,
                            }
                        )
                    elif fault_roll < 0.020:
                        factor = (
                            float(rng.uniform(*subtle_slow_range))
                            if rng.random() < 0.5
                            else float(rng.uniform(*subtle_fast_range))
                        )
                        days_used = max(1, round(true_duration * factor))
                        finished_date = opened_date + timedelta(days=days_used)
                        fault_counts["subtle_duration_outlier"] += 1
                        fault_records.append(
                            {
                                "fault_type": "subtle_duration_outlier",
                                "entity_type": "usage_period",
                                "record_id": use_id,
                                "source_file": f"{hh_id}.json",
                                "household_id": hh_id,
                            }
                        )
                    else:
                        completed_durations.append(days_used)

                    cost_per_day = round(price / days_used, 2) if days_used > 0 else None
                    usage_periods.append(
                        {
                            "id": use_id,
                            "product_id": prod_id,
                            "product_name": tpl.name,
                            "purchase_id": pur_id,
                            "opened_date": opened_date.isoformat(),
                            "finished_date": finished_date.isoformat(),
                            "status": "completed",
                            "days_used": days_used,
                            "purchase_price": price,
                            "currency": "BDT",
                            "cost_per_day": cost_per_day,
                        }
                    )
                    completed_count += 1
                    gap_days = int(rng.integers(0, 4))
                    cursor_date = expected_finish + timedelta(days=gap_days)
                else:
                    # Active cycle extending past reference_date (only if not abandoned)
                    if is_abandoned:
                        break
                    days_used = max(0, (reference_date - opened_date).days)
                    avg_life = (
                        round(sum(completed_durations) / len(completed_durations), 1)
                        if completed_durations
                        else None
                    )
                    cost_per_day = round(price / avg_life, 2) if avg_life and avg_life > 0 else None
                    pred_rem = round(avg_life) - days_used if avg_life is not None else None
                    usage_periods.append(
                        {
                            "id": use_id,
                            "product_id": prod_id,
                            "product_name": tpl.name,
                            "purchase_id": pur_id,
                            "opened_date": opened_date.isoformat(),
                            "finished_date": None,
                            "status": "active",
                            "days_used": days_used,
                            "purchase_price": price,
                            "currency": "BDT",
                            "cost_per_day": cost_per_day,
                        }
                    )
                    active_count += 1

                    has_backup = bool(rng.random() < 0.15)
                    if has_backup:
                        backup_date = reference_date - timedelta(days=int(rng.integers(1, 6)))
                        backup_price = _compute_price(
                            rng,
                            tpl,
                            current_size,
                            (backup_date - start_date).days,
                            last_vendor,
                        )
                        purchases.append(
                            {
                                "id": f"{hh_id}-pur-{tpl.slug}-backup",
                                "product_id": prod_id,
                                "product_name": tpl.name,
                                "brand": tpl.brand,
                                "category": tpl.category,
                                "purchase_date": backup_date.isoformat(),
                                "price": backup_price,
                                "currency": "BDT",
                                "store_vendor": last_vendor,
                                "size_value": size_override,
                                "size_unit": unit_override,
                            }
                        )
                        unopened_count += 1

                    inventory.append(
                        {
                            "product_id": prod_id,
                            "product_name": tpl.name,
                            "brand": tpl.brand,
                            "category": tpl.category,
                            "inventory_status": "Active",
                            "purchase_date": purchase_date.isoformat(),
                            "price": price,
                            "currency": "BDT",
                            "opened_date": opened_date.isoformat(),
                            "days_used": days_used,
                            "predicted_remaining_days": pred_rem,
                            "backup_count": 1 if has_backup else 0,
                        }
                    )

                    if rng.random() < 0.25 and avg_life is not None:
                        rem_date = opened_date + timedelta(days=max(1, round(avg_life) - 7))
                        restock_plans.append(
                            {
                                "id": f"{hh_id}-rp-{tpl.slug}",
                                "product_id": prod_id,
                                "product_name": tpl.name,
                                "usage_period_id": use_id,
                                "mode": "relative",
                                "days_before_finish": 7,
                                "reminder_date": rem_date.isoformat(),
                                "status": "planned",
                                "created_at": f"{opened_date.isoformat()}T10:00:00.000Z",
                            }
                        )
                    break

            avg_life_final = (
                round(sum(completed_durations) / len(completed_durations), 1)
                if completed_durations
                else None
            )
            products.append(
                {
                    "id": prod_id,
                    "name": tpl.name,
                    "brand": tpl.brand,
                    "category": tpl.category,
                    "size": float(tpl.sizes[0]),
                    "unit": tpl.unit,
                    "created_at": f"{first_created.isoformat()}T09:00:00.000Z",
                }
            )
            analytics_items.append(
                {
                    "product_id": prod_id,
                    "product_name": tpl.name,
                    "brand": tpl.brand,
                    "category": tpl.category,
                    "observed_average_lifespan": avg_life_final,
                    "completed_cycles": len(completed_durations),
                    "observed_cost_per_day": None,
                    "estimated_monthly_consumption": None,
                    "predicted_finish_date": None,
                    "predicted_remaining_days": None,
                    "confidence_state": "reliable" if len(completed_durations) >= 4 else "early",
                    "confidence_label": "Reliable"
                    if len(completed_durations) >= 4
                    else "Early data",
                }
            )
            ground_truth_records.append(
                {
                    "household_id": hh_id,
                    "product_id": prod_id,
                    "archetype_slug": tpl.slug,
                    "category": tpl.category,
                    "true_consumption_rate_per_day": true_rate,
                    "unit": tpl.unit,
                    "abandoned": is_abandoned,
                }
            )

        export_payload = {
            "version": "1.1.0",
            "exported_at": f"{reference_date.isoformat()}T10:00:00.000Z",
            "user": {"id": hh_id, "email": hh_email},
            "summary": {
                "total_products": len(products),
                "total_purchases": len(purchases),
                "active_essentials": active_count,
                "unopened_purchases": unopened_count,
                "completed_usage_cycles": completed_count,
                "estimated_monthly_consumption": None,
                "categories": sorted(categories_seen),
                "category_breakdown": [],
            },
            "products": products,
            "purchases": purchases,
            "usage_periods": usage_periods,
            "inventory": inventory,
            "analytics": analytics_items,
            "insights": [],
            "restock_plans": restock_plans,
        }

        out_path = exports_dir / f"{hh_id}.json"
        out_path.write_text(json.dumps(export_payload, separators=(",", ":")), encoding="utf-8")

        total_products += len(products)
        total_purchases += len(purchases)
        total_usage += len(usage_periods)
        total_restock += len(restock_plans)

    ground_truth_path.write_text(
        json.dumps(
            {
                "seed": seed,
                "households": households,
                "months": months,
                "reference_date": reference_date.isoformat(),
                "records": ground_truth_records,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    faults_manifest_path.write_text(
        json.dumps(
            {
                "seed": seed,
                "households": households,
                "months": months,
                "reference_date": reference_date.isoformat(),
                "counts": fault_counts,
                "faults": fault_records,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    elapsed = round(time.perf_counter() - t0, 3)
    return SimulationStats(
        households=households,
        months=months,
        seed=seed,
        products=total_products,
        purchases=total_purchases,
        usage_periods=total_usage,
        restock_plans=total_restock,
        injected_faults=fault_counts,
        elapsed_seconds=elapsed,
        exports_dir=exports_dir,
        ground_truth_path=ground_truth_path,
        faults_manifest_path=faults_manifest_path,
    )


def get_archetype_units() -> dict[str, SizeUnit]:
    return {a.slug: a.unit for a in ARCHETYPES}
