"""Tests for the rolling-origin forecasting backtest."""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pytest

from nittoo_lab.config import EWMA_DURATION_ALPHA, EWMA_RATE_ALPHA
from nittoo_lab.forecast.backtest import (
    ALL_METHOD_VARIANTS,
    run_rolling_backtest,
)
from nittoo_lab.forecast.methods import (
    baseline_lifespan,
    baseline_predict,
    ewma_duration_predict,
    median_duration_predict,
    rate_ewma_predict,
    rate_mean_predict,
    rate_median_predict,
)
from nittoo_lab.forecast.metrics import (
    BootstrapCI,
    apply_interval,
    compute_metrics,
    history_bucket,
    select_winner,
)
from nittoo_lab.forecast.report import ANALYTICS_ROOT, run_forecast_evaluation
from nittoo_lab.ingest.loader import ingest_exports
from nittoo_lab.simulate.generator import simulate_households
from nittoo_lab.transform.runner import run_dbt_pipeline

PARITY_FIXTURE_PATH = ANALYTICS_ROOT / "fixtures" / "baseline_parity.json"


def test_baseline_parity_with_typescript_fixture() -> None:
    payload = json.loads(PARITY_FIXTURE_PATH.read_text(encoding="utf-8"))
    cases = payload["cases"]
    assert len(cases) > 0
    for case in cases:
        history = case["history_durations"]
        assert baseline_lifespan(history) == case["average_lifespan"]
        assert baseline_predict(history) == case["predicted_duration"]


def test_method_helpers_edge_and_basic_cases() -> None:
    assert baseline_lifespan([]) is None
    assert baseline_predict([]) is None
    assert median_duration_predict([10, 20, 40]) == pytest.approx(20.0)
    assert ewma_duration_predict([10, 20], alpha=0.5) == pytest.approx(15.0)
    assert rate_mean_predict([2.0, 4.0], next_size=30.0) == pytest.approx(10.0)
    assert rate_median_predict([2.0, 4.0, 10.0], next_size=40.0) == pytest.approx(10.0)
    assert rate_ewma_predict([2.0, 4.0], next_size=30.0, alpha=0.5) == pytest.approx(10.0)


def test_compute_metrics_and_intervals() -> None:
    actuals = [10, 20, 0]
    preds = [12.0, 18.0, 5.0]
    lows, highs = zip(*(apply_interval(p, -0.2, 0.2) for p in preds), strict=True)
    summary = compute_metrics(actuals, preds, lows=lows, highs=highs)

    assert summary.n == 3
    assert summary.mae == pytest.approx((2.0 + 2.0 + 5.0) / 3.0, abs=1e-2)
    assert summary.median_ae == pytest.approx(2.0, abs=1e-2)
    # MAPE skips zero actuals: |10-12|/10 = 0.20, |20-18|/20 = 0.10 -> 15.0%
    assert summary.mape_pct == pytest.approx(15.0, abs=1e-2)
    # Bias = mean(pred - actual) = (2 - 2 + 5) / 3
    assert summary.bias == pytest.approx(5.0 / 3.0, abs=1e-2)
    # Intervals: [9.6, 14.4] covers 10; [14.4, 21.6] covers 20; [4.0, 6.0] misses 0 -> 2/3
    assert summary.coverage_pct == pytest.approx(200.0 / 3.0, abs=0.1)
    assert summary.mean_width is not None and summary.mean_width > 0.0


def test_history_bucket_and_select_winner() -> None:
    assert history_bucket(2) == "2"
    assert history_bucket(3) == "3-4"
    assert history_bucket(4) == "3-4"
    assert history_bucket(5) == "5+"

    baseline_key = ("baseline", "none")
    cand_a = ("rate_median", "rule_only")
    cand_b = ("rate_mean", "rule_only")
    maes = {baseline_key: 10.0, cand_a: 6.0, cand_b: 7.0}
    cis_win = {
        cand_a: BootstrapCI(mae_improvement=4.0, ci_low=1.5, ci_high=6.5, ci_level=0.99583),
        cand_b: BootstrapCI(mae_improvement=3.0, ci_low=-0.2, ci_high=6.2, ci_level=0.99583),
    }
    assert select_winner(maes, cis_win, baseline_key=baseline_key) == cand_a

    cis_tie = {
        cand_a: BootstrapCI(mae_improvement=4.0, ci_low=-0.1, ci_high=8.1, ci_level=0.99583),
        cand_b: BootstrapCI(mae_improvement=3.0, ci_low=-0.5, ci_high=6.5, ci_level=0.99583),
    }
    assert select_winner(maes, cis_tie, baseline_key=baseline_key) == baseline_key


def test_point_in_time_no_future_leakage(tmp_path: Path) -> None:
    raw_dir = tmp_path / "raw"
    db_path = tmp_path / "lab.duckdb"
    report_path = tmp_path / "forecast_report.md"

    simulate_households(households=12, months=24, seed=105, exports_dir=raw_dir)
    ingest_exports(exports_dir=raw_dir, db_path=db_path)
    run_dbt_pipeline(db_path=db_path, generate_docs=False)

    targets_before = run_rolling_backtest(
        db_path=db_path,
        ewma_duration_alpha=EWMA_DURATION_ALPHA,
        ewma_rate_alpha=EWMA_RATE_ALPHA,
    )
    assert len(targets_before) > 0

    # Pick a product with at least 4 completed cycles so we can mutate cycle k+1 (and later)
    # and verify predictions for cycle k+1 (which depend only on 1..k) are bit-for-bit identical.
    with duckdb.connect(str(db_path)) as conn:
        row = conn.execute(
            """
            SELECT user_id, product_id
            FROM main_marts.fact_consumption_cycle
            WHERE status = 'completed'
              AND finished_date IS NOT NULL
              AND duration_days IS NOT NULL
            GROUP BY 1, 2
            HAVING COUNT(*) >= 4
            ORDER BY 1, 2
            LIMIT 1
            """
        ).fetchone()
        assert row is not None
        uid, pid = row

        cycles = conn.execute(
            """
            SELECT usage_period_id
            FROM main_marts.fact_consumption_cycle
            WHERE user_id = ? AND product_id = ?
              AND status = 'completed'
              AND finished_date IS NOT NULL
              AND duration_days IS NOT NULL
            ORDER BY opened_date ASC, usage_period_id ASC
            """,
            [uid, pid],
        ).fetchall()
        k_plus_1_id = cycles[2][0]  # 0-indexed: cycles[0], cycles[1] are prefix k=2; [2] is k+1

        before_map = {
            t.usage_period_id: t.preds
            for t in targets_before
            if t.user_id == uid and t.product_id == pid
        }
        assert k_plus_1_id in before_map

        # Mutate target duration of cycle k+1 (keep effective_size_value unchanged since it is
        # known at prediction time as the active purchase).
        conn.execute(
            """
            UPDATE main_marts.fact_consumption_cycle
            SET duration_days = duration_days + 999
            WHERE usage_period_id = ?
            """,
            [k_plus_1_id],
        )

    targets_after = run_rolling_backtest(
        db_path=db_path,
        ewma_duration_alpha=EWMA_DURATION_ALPHA,
        ewma_rate_alpha=EWMA_RATE_ALPHA,
    )
    after_map = {
        t.usage_period_id: t.preds
        for t in targets_after
        if t.user_id == uid and t.product_id == pid
    }
    for mv in ALL_METHOD_VARIANTS:
        assert after_map[k_plus_1_id][mv] == before_map[k_plus_1_id][mv]

    # Also verify end-to-end report generation on this small DB.
    result = run_forecast_evaluation(
        db_path=db_path,
        faults_manifest_path=None,
        report_path=report_path,
    )
    assert report_path.exists()
    assert result.rule_clean_targets > 0


def test_pack_size_elasticity_runs(tmp_path: Path) -> None:
    stats = simulate_households(
        households=5,
        months=12,
        seed=106,
        exports_dir=tmp_path / "exports",
        ground_truth_path=tmp_path / "gt.json",
        pack_size_elasticity=0.5,
    )
    assert stats.products > 0
    assert stats.usage_periods > 0
