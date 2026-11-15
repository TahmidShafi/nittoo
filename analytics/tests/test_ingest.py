from pathlib import Path

import duckdb

from ingest.loader import ingest_exports
from simulate.generator import simulate_households


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

    # Idempotent re-run: counts in DuckDB must not increase
    s2 = ingest_exports(exports_dir=exports_dir, db_path=db_path)
    assert s2.products_loaded == s1.products_loaded
    assert s2.purchases_loaded == s1.purchases_loaded
    assert s2.usage_periods_loaded == s1.usage_periods_loaded

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        reject_total = con.execute("SELECT COUNT(*) FROM raw.rejects").fetchone()[0]
        assert reject_total == sum(s1.rejects_by_reason.values())
    finally:
        con.close()
