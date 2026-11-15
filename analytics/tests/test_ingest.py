import json
from pathlib import Path

import duckdb

from nittoo_lab.ingest.loader import ingest_exports
from nittoo_lab.simulate.generator import simulate_households


def test_ingest_loads_valid_rows_quarantines_faults_and_is_idempotent(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    db_path = tmp_path / "nittoo.duckdb"

    sim_stats = simulate_households(
        households=30,
        months=24,
        seed=42,
        exports_dir=exports_dir,
        ground_truth_path=gt_path,
    )
    # Also drop a malformed JSON file to verify INVALID_EXPORT_SCHEMA reject
    (exports_dir / "broken.json").write_text('{"version": "bad"}', encoding="utf-8")

    s1 = ingest_exports(exports_dir=exports_dir, db_path=db_path)
    assert s1.files_processed == 31
    assert s1.files_failed_schema == 1
    assert s1.products_loaded == sim_stats.products
    assert s1.rejects_by_reason.get("INVALID_EXPORT_SCHEMA") == 1
    for dbt_handled in ("ZERO_DAY_CYCLE", "OUTLIER_1000_DAY", "DUPLICATE_PURCHASE"):
        assert dbt_handled not in s1.rejects_by_reason

    # Idempotent re-run: counts in DuckDB must not increase
    s2 = ingest_exports(exports_dir=exports_dir, db_path=db_path)
    assert s2.products_loaded == s1.products_loaded
    assert s2.purchases_loaded == s1.purchases_loaded
    assert s2.usage_periods_loaded == s1.usage_periods_loaded

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        reject_total = con.execute("SELECT COUNT(*) FROM raw.rejects").fetchone()[0]
        assert reject_total == sum(s1.rejects_by_reason.values())
        assert con.execute("SELECT COUNT(*) FROM raw.products").fetchone()[0] == s1.products_loaded
        assert (
            con.execute("SELECT COUNT(*) FROM raw.purchases").fetchone()[0] == s1.purchases_loaded
        )
        assert (
            con.execute("SELECT COUNT(*) FROM raw.usage_periods").fetchone()[0]
            == s1.usage_periods_loaded
        )
    finally:
        con.close()


def test_contract_rejects_all_violation_types(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    exports_dir.mkdir(parents=True)
    db_path = tmp_path / "nittoo.duckdb"

    # 1. INVALID_EXPORT_SCHEMA
    (exports_dir / "bad_schema.json").write_text('{"version": 999}', encoding="utf-8")

    # 2. Valid baseline export with one each of:
    #    MISSING_PRODUCT_REF, MISSING_PURCHASE_REF, FINISHED_BEFORE_OPENED
    payload = {
        "version": "1.0.0",
        "exported_at": "2026-11-15T00:00:00Z",
        "user": {"id": "u1", "email": "u1@example.com"},
        "summary": {
            "total_products": 1,
            "total_purchases": 2,
            "active_essentials": 0,
            "unopened_purchases": 0,
            "completed_usage_cycles": 3,
            "estimated_monthly_consumption": None,
            "categories": ["Body Care"],
            "category_breakdown": [],
        },
        "products": [
            {
                "id": "p1",
                "name": "Soap",
                "brand": "Lux",
                "category": "Body Care",
                "size": 100,
                "unit": "g",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ],
        "purchases": [
            {
                "id": "pur1",
                "product_id": "p1",
                "product_name": "Soap",
                "brand": "Lux",
                "category": "Body Care",
                "purchase_date": "2026-01-01",
                "price": 50.0,
                "currency": "BDT",
                "store_vendor": "Shwapno",
            },
            {
                "id": "pur_bad_prod",
                "product_id": "missing_prod",
                "product_name": "Ghost",
                "brand": "Unknown",
                "category": "Other",
                "purchase_date": "2026-01-02",
                "price": 10.0,
                "currency": "BDT",
                "store_vendor": None,
            },
        ],
        "usage_periods": [
            {
                "id": "u_bad_prod",
                "product_id": "missing_prod",
                "product_name": "Ghost",
                "purchase_id": "pur1",
                "opened_date": "2026-01-02",
                "finished_date": "2026-01-10",
                "status": "completed",
                "days_used": 8,
                "purchase_price": 50.0,
                "currency": "BDT",
                "cost_per_day": 6.25,
            },
            {
                "id": "u_bad_pur",
                "product_id": "p1",
                "product_name": "Soap",
                "purchase_id": "missing_pur",
                "opened_date": "2026-01-02",
                "finished_date": "2026-01-10",
                "status": "completed",
                "days_used": 8,
                "purchase_price": 50.0,
                "currency": "BDT",
                "cost_per_day": 6.25,
            },
            {
                "id": "u_fin_before",
                "product_id": "p1",
                "product_name": "Soap",
                "purchase_id": "pur1",
                "opened_date": "2026-01-10",
                "finished_date": "2026-01-05",
                "status": "completed",
                "days_used": 0,
                "purchase_price": 50.0,
                "currency": "BDT",
                "cost_per_day": None,
            },
        ],
        "inventory": [],
        "analytics": [],
        "insights": [],
        "restock_plans": [],
    }
    (exports_dir / "refs_and_dates.json").write_text(json.dumps(payload), encoding="utf-8")

    stats = ingest_exports(exports_dir=exports_dir, db_path=db_path)
    assert stats.rejects_by_reason["INVALID_EXPORT_SCHEMA"] == 1
    assert stats.rejects_by_reason["MISSING_PRODUCT_REF"] == 2
    assert stats.rejects_by_reason["MISSING_PURCHASE_REF"] == 1
    assert stats.rejects_by_reason["FINISHED_BEFORE_OPENED"] == 1
    assert stats.usage_periods_loaded == 0
    assert stats.purchases_loaded == 1
