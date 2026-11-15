from pathlib import Path

from ingest.loader import ingest_exports
from simulate.generator import simulate_households
from transform.runner import run_dbt_pipeline


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
