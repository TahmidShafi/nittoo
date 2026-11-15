import json
from pathlib import Path
from statistics import median

import duckdb

from nittoo_lab.ingest.loader import ingest_exports
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


def test_dbt_flags_catch_at_least_95_percent_of_injected_faults(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    db_path = tmp_path / "nittoo.duckdb"

    sim = simulate_households(
        households=80, months=24, seed=42, exports_dir=exports_dir, ground_truth_path=gt_path
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        zero_day_flagged, outlier_flagged = con.execute(
            """
            SELECT
                SUM(CASE WHEN is_zero_day THEN 1 ELSE 0 END),
                SUM(CASE WHEN is_duration_outlier THEN 1 ELSE 0 END)
            FROM main_marts.fact_consumption_cycle
            """
        ).fetchone()
        dup_flagged = con.execute(
            "SELECT COUNT(*) FROM main_staging.stg_purchase_duplicates"
        ).fetchone()[0]
    finally:
        con.close()

    assert zero_day_flagged >= 0.95 * sim.injected_faults["zero_day_cycle"]
    assert outlier_flagged >= 0.95 * sim.injected_faults["outlier_1000_day"]
    assert dup_flagged >= 0.95 * sim.injected_faults["duplicate_purchase"]


def test_recovered_mean_consumption_rate_matches_ground_truth(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    db_path = tmp_path / "nittoo.duckdb"

    simulate_households(
        households=80, months=24, seed=42, exports_dir=exports_dir, ground_truth_path=gt_path
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    gt = json.loads(gt_path.read_text(encoding="utf-8"))
    prod_info = {
        rec["product_id"]: (rec["archetype_slug"], float(rec["true_consumption_rate_per_day"]))
        for rec in gt["records"]
    }

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        rows = con.execute(
            """
            WITH stable_products AS (
                SELECT product_id
                FROM main_staging.stg_purchases
                GROUP BY product_id
                HAVING MAX(price) * 1.0 / NULLIF(MIN(price), 0) <= 1.35
            )
            SELECT
                f.product_id,
                AVG(f.consumption_rate_per_day) AS prod_mean_rate,
                COUNT(*) AS cnt
            FROM main_marts.fact_consumption_cycle AS f
            INNER JOIN stable_products AS sp ON f.product_id = sp.product_id
            WHERE f.is_valid_for_forecasting = true
              AND f.status = 'completed'
              AND f.consumption_rate_per_day IS NOT NULL
              AND f.duration_days > 0
            GROUP BY f.product_id
            HAVING COUNT(*) >= 2
            """
        ).fetchall()
    finally:
        con.close()

    by_arch_rec: dict[str, list[float]] = {}
    by_arch_true: dict[str, list[float]] = {}
    for prod_id, prod_mean_rate, _cnt in rows:
        arch, true_rate = prod_info[str(prod_id)]
        by_arch_rec.setdefault(arch, []).append(float(prod_mean_rate))
        by_arch_true.setdefault(arch, []).append(true_rate)

    checked = 0
    for arch, rec_vals in by_arch_rec.items():
        if len(rec_vals) < 3:
            continue
        checked += 1
        rec_med = median(rec_vals)
        true_med = median(by_arch_true[arch])
        rel_err = abs(rec_med - true_med) / true_med
        assert rel_err <= 0.25, f"{arch}: recovered={rec_med:.3f} vs true={true_med:.3f}"
    assert checked >= 5
