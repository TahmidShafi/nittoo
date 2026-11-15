from pathlib import Path

from typer.testing import CliRunner

from nittoo_lab.cli import app

runner = CliRunner()


def test_cli_help_lists_all_subcommands() -> None:
    res = runner.invoke(app, ["--help"])
    assert res.exit_code == 0
    for cmd in ("simulate", "ingest", "transform", "report", "all"):
        assert cmd in res.stdout


def test_cli_all_runs_end_to_end_at_tiny_scale(tmp_path: Path) -> None:
    db_path = tmp_path / "tiny.duckdb"
    reports_dir = tmp_path / "reports"
    res = runner.invoke(
        app,
        [
            "all",
            "--households",
            "5",
            "--months",
            "6",
            "--seed",
            "11",
            "--db-path",
            str(db_path),
            "--reports-dir",
            str(reports_dir),
            "--no-docs",
        ],
    )
    assert res.exit_code == 0
    assert "Nittoo Forecast Lab Timing Summary" in res.stdout
    assert db_path.exists()
    assert (reports_dir / "data_quality.md").exists()
    assert (reports_dir / "forecast_report.md").exists()
