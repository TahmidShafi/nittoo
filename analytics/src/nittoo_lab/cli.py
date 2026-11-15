from __future__ import annotations

import time
from pathlib import Path
from typing import Annotated

import typer

from nittoo_lab.forecast.export import export_calibration, export_forecast_parity
from nittoo_lab.forecast.report import run_forecast_evaluation, run_full_forecast_suite
from nittoo_lab.ingest.loader import DEFAULT_DB_PATH, ingest_exports
from nittoo_lab.reporting.generator import generate_data_quality_report
from nittoo_lab.reporting.readme_results import update_readme_results
from nittoo_lab.reporting.reproduce import reproduce_all_reports
from nittoo_lab.reporting.robustness import run_robustness_sweep
from nittoo_lab.simulate.generator import simulate_households
from nittoo_lab.transform.runner import run_dbt_pipeline

app = typer.Typer(help="Nittoo Forecast Lab CLI (simulate -> ingest -> transform -> report)")


@app.command()
def simulate(
    households: Annotated[int, typer.Option(min=1, help="Number of synthetic households")] = 500,
    months: Annotated[int, typer.Option(min=1, help="Simulation horizon in months")] = 24,
    seed: Annotated[int, typer.Option(help="Random seed")] = 42,
) -> None:
    """Generate synthetic household JSON exports and separate ground truth."""
    stats = simulate_households(households=households, months=months, seed=seed)
    typer.echo(
        f"Simulated {stats.households} households ({stats.months} mo, seed={stats.seed}) "
        f"in {stats.elapsed_seconds:.2f}s -> {stats.products} products, "
        f"{stats.purchases} purchases, {stats.usage_periods} usage_periods, "
        f"faults={stats.injected_faults}"
    )


@app.command()
def ingest(
    db_path: Annotated[Path, typer.Option(help="Target DuckDB database file")] = DEFAULT_DB_PATH,
) -> None:
    """Validate JSON exports with Pydantic and load into DuckDB raw + rejects."""
    stats = ingest_exports(db_path=db_path)
    typer.echo(
        f"Ingested {stats.files_processed} files in {stats.elapsed_seconds:.2f}s -> "
        f"products={stats.products_loaded}, purchases={stats.purchases_loaded}, "
        f"usage_periods={stats.usage_periods_loaded}, rejects={stats.rejects_by_reason}"
    )


@app.command()
def transform(
    db_path: Annotated[Path, typer.Option(help="Target DuckDB database file")] = DEFAULT_DB_PATH,
    docs: Annotated[bool, typer.Option("--docs/--no-docs", help="Run dbt docs generate")] = True,
) -> None:
    """Run dbt models, dbt tests, and optionally dbt docs generate."""
    res = run_dbt_pipeline(db_path=db_path, generate_docs=docs)
    typer.echo(
        f"dbt transform finished in {res.elapsed_seconds:.2f}s -> "
        f"models={res.models_passed} passed, tests={res.tests_passed}/{res.tests_total} passed, "
        f"docs={res.docs_generated}"
    )


@app.command()
def report(
    db_path: Annotated[Path, typer.Option(help="Source DuckDB database file")] = DEFAULT_DB_PATH,
    reports_dir: Annotated[
        Path | None,
        typer.Option(help="Directory for generated reports (defaults to analytics/reports)"),
    ] = None,
) -> None:
    """Write analytics/reports/data_quality.md from DuckDB + dbt run_results."""
    kwargs = {"report_path": reports_dir / "data_quality.md"} if reports_dir is not None else {}
    res = generate_data_quality_report(db_path=db_path, **kwargs)
    typer.echo(
        f"Wrote {res.report_path} in {res.elapsed_seconds:.2f}s "
        f"(tests {res.dbt_tests_passed}/{res.dbt_tests_total} passed)"
    )


@app.command()
def forecast(
    db_path: Annotated[Path, typer.Option(help="Source DuckDB database file")] = DEFAULT_DB_PATH,
    full: Annotated[
        bool,
        typer.Option(
            "--full",
            help="Run full 5-dataset suite (500 x 24) and write forecast_results.json",
        ),
    ] = False,
    reports_dir: Annotated[
        Path | None,
        typer.Option(help="Directory for generated reports (defaults to analytics/reports)"),
    ] = None,
) -> None:
    """Run rolling-origin forecasting backtest and write analytics/reports/forecast_report.md."""
    kwargs = {"report_path": reports_dir / "forecast_report.md"} if reports_dir is not None else {}
    res = (
        run_full_forecast_suite(**kwargs)
        if full
        else run_forecast_evaluation(db_path=db_path, **kwargs)
    )
    typer.echo(
        f"Wrote {res.report_path} in {res.elapsed_seconds:.2f}s "
        f"(n={res.rule_clean_targets}, winner={res.winner[0]} ({res.winner[1]}))"
    )


@app.command()
def robustness(
    households: Annotated[int, typer.Option(min=1, help="Number of synthetic households")] = 200,
    months: Annotated[int, typer.Option(min=1, help="Simulation horizon in months")] = 24,
) -> None:
    """Run frozen-threshold MAD outlier sweep (seeds 3001-3006) and write detector_robustness.md."""
    res = run_robustness_sweep(households=households, months=months)
    typer.echo(
        f"Wrote {res.report_path} ({len(res.rows)} cells) in {res.elapsed_seconds:.2f}s"
    )


@app.command("reproduce-reports")
def reproduce_reports_cmd(
    check: Annotated[
        bool,
        typer.Option("--check", help="Fail if regenerated reports differ from committed files"),
    ] = False,
) -> None:
    """Regenerate all committed reports (and forecast_results.json) at documented scales."""
    res = reproduce_all_reports(check=check)
    if check:
        if not res.ok:
            for name, diff_text in res.diffs.items():
                typer.echo(f"DIFF in {name}:\n{diff_text}", err=True)
            raise typer.Exit(code=1)
        typer.echo(f"All committed reports match regenerated output ({res.elapsed_seconds:.2f}s).")
    else:
        typer.echo(f"Regenerated all committed reports in {res.elapsed_seconds:.2f}s.")


@app.command("readme-results")
def readme_results_cmd(
    check: Annotated[
        bool,
        typer.Option(
            "--check",
            help="Fail if README results block is stale vs forecast_results.json",
        ),
    ] = False,
) -> None:
    """Update or check the auto-generated forecasting results block in README.md."""
    res = update_readme_results(check=check)
    if check:
        if not res.ok:
            typer.echo(f"README results block is stale:\n{res.diff_text}", err=True)
            raise typer.Exit(code=1)
        typer.echo("README results block matches analytics/reports/forecast_results.json.")
    else:
        typer.echo("Updated README.md results block from analytics/reports/forecast_results.json.")


@app.command("export-calibration")
def export_calibration_cmd() -> None:
    """Export frozen P10/P90 interval quantiles to src/lib/forecast/calibration.json."""
    out = export_calibration()
    typer.echo(f"Wrote {out}")


@app.command("export-parity")
def export_parity_cmd() -> None:
    """Export app forecast parity fixture to analytics/fixtures/forecast_parity.json."""
    out = export_forecast_parity()
    typer.echo(f"Wrote {out}")


@app.command("all")
def run_all(
    households: Annotated[int, typer.Option(min=1, help="Number of synthetic households")] = 500,
    months: Annotated[int, typer.Option(min=1, help="Simulation horizon in months")] = 24,
    seed: Annotated[int, typer.Option(help="Random seed")] = 42,
    db_path: Annotated[Path, typer.Option(help="Target DuckDB database file")] = DEFAULT_DB_PATH,
    docs: Annotated[bool, typer.Option("--docs/--no-docs", help="Run dbt docs generate")] = True,
    reports_dir: Annotated[
        Path | None,
        typer.Option(help="Directory for generated reports (defaults to analytics/reports)"),
    ] = None,
) -> None:
    """Run simulate -> ingest -> transform -> report end-to-end and print timing summary."""
    t_total = time.perf_counter()

    # Reset DuckDB file for a clean full-pipeline run at the requested scale
    if db_path.exists():
        db_path.unlink()

    sim_stats = simulate_households(households=households, months=months, seed=seed)
    ing_stats = ingest_exports(db_path=db_path)
    dbt_res = run_dbt_pipeline(db_path=db_path, generate_docs=docs)
    dq_kwargs = {"report_path": reports_dir / "data_quality.md"} if reports_dir is not None else {}
    fc_kwargs = (
        {"report_path": reports_dir / "forecast_report.md"} if reports_dir is not None else {}
    )
    rep_res = generate_data_quality_report(db_path=db_path, **dq_kwargs)
    fc_res = run_forecast_evaluation(db_path=db_path, **fc_kwargs)

    total_s = round(time.perf_counter() - t_total, 3)

    typer.echo("\n=== Nittoo Forecast Lab Timing Summary ===")
    typer.echo(
        f"  simulate : {sim_stats.elapsed_seconds:6.2f}s ({sim_stats.households} households)"
    )
    typer.echo(
        f"  ingest   : {ing_stats.elapsed_seconds:6.2f}s ({ing_stats.files_processed} files)"
    )
    typer.echo(
        f"  transform: {dbt_res.elapsed_seconds:6.2f}s "
        f"({dbt_res.models_passed} models, {dbt_res.tests_passed}/{dbt_res.tests_total} tests)"
    )
    typer.echo(f"  report   : {rep_res.elapsed_seconds:6.2f}s -> {rep_res.report_path}")
    typer.echo(f"  forecast : {fc_res.elapsed_seconds:6.2f}s -> {fc_res.report_path}")
    typer.echo(f"  total    : {total_s:6.2f}s")
