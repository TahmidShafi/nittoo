import json
from pathlib import Path
from statistics import median

import duckdb

from nittoo_lab.config import (
    CLEAN_FPR_CEILING,
    DETECTOR_PRECISION_FLOOR,
    DETECTOR_RECALL_FLOOR,
    RATE_RECOVERY_REL_TOL,
    SUBTLE_OUTLIER_PRECISION_FLOOR,
    SUBTLE_OUTLIER_RECALL_FLOOR,
)
from nittoo_lab.ingest.loader import ingest_exports
from nittoo_lab.reporting.generator import generate_data_quality_report
from nittoo_lab.simulate.generator import simulate_households
from nittoo_lab.transform.runner import run_dbt_pipeline


def test_dbt_run_test_and_docs_end_to_end(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    db_path = tmp_path / "nittoo.duckdb"

    simulate_households(
        households=15,
        months=12,
        seed=99,
        exports_dir=exports_dir,
        ground_truth_path=gt_path,
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)

    res = run_dbt_pipeline(db_path=db_path, generate_docs=True)
    assert res.models_passed == 15  # 5 staging + 3 intermediate + 7 marts
    assert res.models_failed == 0
    assert res.tests_total > 0
    assert res.tests_warned == 3
    assert res.tests_failed == 0
    assert res.docs_generated is True


def test_detector_precision_recall_and_clean_fpr_meet_frozen_floors(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    fm_path = tmp_path / "injected_faults.json"
    db_path = tmp_path / "nittoo.duckdb"
    report_path = tmp_path / "data_quality.md"

    simulate_households(
        households=100,
        months=24,
        seed=42,
        exports_dir=exports_dir,
        ground_truth_path=gt_path,
        faults_manifest_path=fm_path,
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    rr_path = Path(__file__).resolve().parent.parent / "dbt" / "target" / "run_results.json"
    rep = generate_data_quality_report(
        db_path=db_path,
        run_results_path=rr_path,
        report_path=report_path,
        faults_manifest_path=fm_path,
    )
    by_type = {r.fault_type: r for r in rep.fault_recall}

    for ftype in ("finished_before_opened", "zero_day_cycle", "duplicate_purchase"):
        row = by_type[ftype]
        assert row.recall_pct >= DETECTOR_RECALL_FLOOR * 100.0, f"{ftype}: {row}"
        assert row.precision_pct >= DETECTOR_PRECISION_FLOOR * 100.0, f"{ftype}: {row}"

    extreme_row = by_type["outlier_1000_day"]
    assert extreme_row.recall_pct >= DETECTOR_RECALL_FLOOR * 100.0, extreme_row
    assert extreme_row.precision_pct >= DETECTOR_PRECISION_FLOOR * 100.0, extreme_row

    subtle_row = by_type["subtle_duration_outlier"]
    assert subtle_row.recall_pct >= SUBTLE_OUTLIER_RECALL_FLOOR * 100.0, subtle_row
    assert subtle_row.precision_pct >= SUBTLE_OUTLIER_PRECISION_FLOOR * 100.0, subtle_row

    assert rep.clean_cycle_fpr_pct <= CLEAN_FPR_CEILING * 100.0, (
        f"clean FPR {rep.clean_cycle_fpr_pct}% > {CLEAN_FPR_CEILING * 100.0}%"
    )


def test_recovered_consumption_rate_matches_ground_truth_across_all_clean_cycles(
    tmp_path: Path,
) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    fm_path = tmp_path / "injected_faults.json"
    db_path = tmp_path / "nittoo.duckdb"

    simulate_households(
        households=80,
        months=24,
        seed=42,
        exports_dir=exports_dir,
        ground_truth_path=gt_path,
        faults_manifest_path=fm_path,
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    gt = json.loads(gt_path.read_text(encoding="utf-8"))
    true_rates = {
        rec["product_id"]: float(rec["true_consumption_rate_per_day"])
        for rec in gt["records"]
    }
    fault_ids = {
        f["record_id"]
        for f in json.loads(fm_path.read_text(encoding="utf-8"))["faults"]
        if f.get("entity_type") == "usage_period"
    }

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        rows = con.execute(
            """
            SELECT
                usage_period_id,
                product_id,
                consumption_rate_per_day,
                size_changed_from_previous
            FROM main_marts.fact_consumption_cycle
            WHERE is_valid_for_forecasting = true
              AND status = 'completed'
              AND consumption_rate_per_day IS NOT NULL
              AND duration_days > 0
            """
        ).fetchall()
    finally:
        con.close()

    by_prod: dict[str, list[float]] = {}
    switched_prods: set[str] = set()
    for uid, pid, rate, size_changed in rows:
        if str(uid) in fault_ids:
            continue
        by_prod.setdefault(str(pid), []).append(float(rate))
        if size_changed:
            switched_prods.add(str(pid))

    rel_errors: list[float] = []
    switched_rel_errors: list[float] = []
    for pid, rates in by_prod.items():
        if len(rates) < 3:
            continue
        err = abs(median(rates) - true_rates[pid]) / true_rates[pid]
        rel_errors.append(err)
        if pid in switched_prods:
            switched_rel_errors.append(err)

    assert len(rel_errors) >= 100
    assert len(switched_rel_errors) >= 10
    assert median(rel_errors) <= RATE_RECOVERY_REL_TOL
    assert median(switched_rel_errors) <= RATE_RECOVERY_REL_TOL


def test_size_switch_propagation_and_size_changed_from_previous(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    db_path = tmp_path / "nittoo.duckdb"

    payload = {
        "version": "1.1.0",
        "exported_at": "2026-11-15T10:00:00.000Z",
        "user": {"id": "u-size", "email": "u-size@example.com"},
        "summary": {
            "total_products": 1,
            "total_purchases": 3,
            "active_essentials": 0,
            "unopened_purchases": 0,
            "completed_usage_cycles": 3,
            "estimated_monthly_consumption": None,
            "categories": ["Skincare"],
            "category_breakdown": [],
        },
        "products": [
            {
                "id": "p-1",
                "name": "Cleanser",
                "brand": "CeraVe",
                "category": "Skincare",
                "size": 236,
                "unit": "ml",
                "created_at": "2026-01-01T00:00:00.000Z",
            }
        ],
        "purchases": [
            {
                "id": "pu-1",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "brand": "CeraVe",
                "category": "Skincare",
                "purchase_date": "2026-01-01",
                "price": 1000,
                "currency": "BDT",
                "store_vendor": "Shajgoj",
                "size_value": None,
                "size_unit": None,
            },
            {
                "id": "pu-2",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "brand": "CeraVe",
                "category": "Skincare",
                "purchase_date": "2026-03-01",
                "price": 1800,
                "currency": "BDT",
                "store_vendor": "Shajgoj",
                "size_value": 473,
                "size_unit": "ml",
            },
            {
                "id": "pu-3",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "brand": "CeraVe",
                "category": "Skincare",
                "purchase_date": "2026-07-01",
                "price": 1800,
                "currency": "BDT",
                "store_vendor": "Shajgoj",
                "size_value": 473,
                "size_unit": "ml",
            },
        ],
        "usage_periods": [
            {
                "id": "up-1",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "purchase_id": "pu-1",
                "opened_date": "2026-01-02",
                "finished_date": "2026-02-28",
                "status": "completed",
                "days_used": 57,
                "purchase_price": 1000,
                "currency": "BDT",
                "cost_per_day": 17.54,
            },
            {
                "id": "up-2",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "purchase_id": "pu-2",
                "opened_date": "2026-03-02",
                "finished_date": "2026-06-28",
                "status": "completed",
                "days_used": 118,
                "purchase_price": 1800,
                "currency": "BDT",
                "cost_per_day": 15.25,
            },
            {
                "id": "up-3",
                "product_id": "p-1",
                "product_name": "Cleanser",
                "purchase_id": "pu-3",
                "opened_date": "2026-07-02",
                "finished_date": "2026-10-28",
                "status": "completed",
                "days_used": 118,
                "purchase_price": 1800,
                "currency": "BDT",
                "cost_per_day": 15.25,
            },
        ],
        "inventory": [],
        "analytics": [],
        "insights": [],
        "restock_plans": [],
    }
    (exports_dir / "u_size.json").write_text(json.dumps(payload), encoding="utf-8")

    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        raw_sizes = con.execute(
            "SELECT id, size_value, size_unit FROM raw.purchases ORDER BY id"
        ).fetchall()
        cycles = con.execute(
            """
            SELECT
                usage_period_id,
                effective_size_value,
                effective_size_unit,
                size_changed_from_previous
            FROM main_marts.fact_consumption_cycle
            ORDER BY opened_date
            """
        ).fetchall()
    finally:
        con.close()

    assert raw_sizes == [
        ("pu-1", None, None),
        ("pu-2", 473.0, "ml"),
        ("pu-3", 473.0, "ml"),
    ]
    assert cycles == [
        ("up-1", 236.0, "ml", False),
        ("up-2", 473.0, "ml", True),
        ("up-3", 473.0, "ml", False),
    ]
