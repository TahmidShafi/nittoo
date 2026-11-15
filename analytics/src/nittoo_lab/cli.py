from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Annotated

import typer

ANALYTICS_ROOT = Path(__file__).resolve().parents[2]
if str(ANALYTICS_ROOT) not in sys.path:
    sys.path.insert(0, str(ANALYTICS_ROOT))

from ingest.loader import DEFAULT_DB_PATH, ingest_exports  # noqa: E402
from reports.generator import generate_data_quality_report  # noqa: E402
from simulate.generator import simulate_households  # noqa: E402
from transform.runner import run_dbt_pipeline  # noqa: E402

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
) -> None:
    """Write analytics/reports/data_quality.md from DuckDB + dbt run_results."""
    res = generate_data_quality_report(db_path=db_path)
    typer.echo(
        f"Wrote {res.report_path} in {res.elapsed_seconds:.2f}s "
        f"(tests {res.dbt_tests_passed}/{res.dbt_tests_total} passed)"
    )


@app.command("all")
def run_all(
    households: Annotated[int, typer.Option(min=1, help="Number of synthetic households")] = 500,
    months: Annotated[int, typer.Option(min=1, help="Simulation horizon in months")] = 24,
    seed: Annotated[int, typer.Option(help="Random seed")] = 42,
    db_path: Annotated[Path, typer.Option(help="Target DuckDB database file")] = DEFAULT_DB_PATH,
    docs: Annotated[bool, typer.Option("--docs/--no-docs", help="Run dbt docs generate")] = True,
) -> None:
    """Run simulate -> ingest -> transform -> report end-to-end and print timing summary."""
    t_total = time.perf_counter()

    # Reset DuckDB file for a clean full-pipeline run at the requested scale
    if db_path.exists():
        db_path.unlink()

    sim_stats = simulate_households(households=households, months=months, seed=seed)
    ing_stats = ingest_exports(db_path=db_path)
    dbt_res = run_dbt_pipeline(db_path=db_path, generate_docs=docs)
    rep_res = generate_data_quality_report(db_path=db_path)

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
    typer.echo(f"  total    : {total_s:6.2f}s")
