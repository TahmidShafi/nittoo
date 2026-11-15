from pathlib import Path

from ingest.loader import ingest_exports
from reports.generator import generate_data_quality_report
from simulate.generator import simulate_households
from transform.runner import run_dbt_pipeline


def test_data_quality_report_contains_layers_rejects_and_dbt_tests(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports"
    gt_path = tmp_path / "true_rates.json"
    db_path = tmp_path / "nittoo.duckdb"
    report_path = tmp_path / "data_quality.md"

    simulate_households(
        households=20,
        months=12,
        seed=7,
        exports_dir=exports_dir,
        ground_truth_path=gt_path,
    )
    ingest_exports(exports_dir=exports_dir, db_path=db_path)
    dbt_res = run_dbt_pipeline(db_path=db_path, generate_docs=False)

    rr_path = Path(__file__).resolve().parent.parent / "dbt" / "target" / "run_results.json"
    rep = generate_data_quality_report(
        db_path=db_path,
        run_results_path=rr_path,
        report_path=report_path,
    )

    assert rep.dbt_tests_total == dbt_res.tests_total
    assert rep.dbt_tests_failed == 0
    assert "raw" in rep.layer_counts
    assert "marts" in rep.layer_counts
    md = report_path.read_text(encoding="utf-8")
    assert "Row Counts per Layer" in md
    assert "Ingestion Rejects by Reason Code" in md
    assert "dbt Test Summary" in md
