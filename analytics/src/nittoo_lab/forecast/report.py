from __future__ import annotations

import json
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from nittoo_lab.config import (
    EWMA_DURATION_ALPHA,
    EWMA_RATE_ALPHA,
    FORECAST_BONFERRONI_CI_LEVEL,
    FORECAST_BOOTSTRAP_REPLICATES,
    FORECAST_BOOTSTRAP_SEED,
    FORECAST_INTERVAL_QUANTILES,
    FORECAST_NUM_CANDIDATES,
    MIN_TRAIN_CYCLES,
)
from nittoo_lab.forecast.backtest import (
    ALL_METHOD_VARIANTS,
    CANDIDATE_VARIANTS,
    BacktestTarget,
    run_rolling_backtest,
)
from nittoo_lab.forecast.metrics import (
    BootstrapCI,
    MetricSummary,
    apply_interval,
    compute_metrics,
    history_bucket,
    household_bootstrap_ci,
    select_winner,
)

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = ANALYTICS_ROOT / "data" / "nittoo.duckdb"
DEFAULT_FAULTS_MANIFEST_PATH = ANALYTICS_ROOT / "data" / "ground_truth" / "injected_faults.json"
DEFAULT_FORECAST_REPORT_PATH = ANALYTICS_ROOT / "reports" / "forecast_report.md"


@dataclass(frozen=True)
class DatasetEval:
    label: str
    total_targets: int
    rule_clean_targets: int
    oracle_clean_targets: int
    rule_clean_metrics: dict[tuple[str, str], MetricSummary]
    all_metrics: dict[tuple[str, str], MetricSummary]
    oracle_clean_metrics: dict[tuple[str, str], MetricSummary]
    bootstrap_cis: dict[tuple[str, str], BootstrapCI]
    winner: tuple[str, str]
    by_k_bucket: dict[tuple[str, str, str], MetricSummary]
    by_size_changed: dict[tuple[str, str, bool], MetricSummary]
    by_category: dict[tuple[str, str, str], MetricSummary]


@dataclass(frozen=True)
class ForecastReportResult:
    report_path: Path
    winner: tuple[str, str]
    rule_clean_targets: int
    elapsed_seconds: float


def _git_sha() -> str:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ANALYTICS_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except OSError:
        pass
    return "unknown"


def _eval_subset(
    rows: Sequence[BacktestTarget],
    quantiles: dict[tuple[str, str, str], tuple[float, float]],
) -> dict[tuple[str, str], MetricSummary]:
    actuals = [r.actual_days for r in rows]
    out: dict[tuple[str, str], MetricSummary] = {}
    for mv in ALL_METHOD_VARIANTS:
        preds: list[float] = []
        lows: list[float] = []
        highs: list[float] = []
        for r in rows:
            p = r.preds[mv]
            preds.append(p)
            q10, q90 = quantiles[(mv[0], mv[1], history_bucket(r.k))]
            lo, hi = apply_interval(p, q10, q90)
            lows.append(lo)
            highs.append(hi)
        out[mv] = compute_metrics(actuals, preds, lows, highs)
    return out


def evaluate_targets(
    label: str,
    targets: Sequence[BacktestTarget],
    quantiles: dict[tuple[str, str, str], tuple[float, float]] = FORECAST_INTERVAL_QUANTILES,
) -> DatasetEval:
    rc_rows = [r for r in targets if r.is_rule_clean]
    oc_rows = [r for r in targets if r.is_oracle_clean]

    rule_clean_metrics = _eval_subset(rc_rows, quantiles)
    all_metrics = _eval_subset(targets, quantiles)
    oracle_clean_metrics = _eval_subset(oc_rows, quantiles) if oc_rows else {}

    base_key = ("baseline", "none")
    user_ids = [r.user_id for r in rc_rows]
    base_errs = [abs(r.preds[base_key] - r.actual_days) for r in rc_rows]

    cis: dict[tuple[str, str], BootstrapCI] = {}
    cand_maes: dict[tuple[str, str], float] = {base_key: rule_clean_metrics[base_key].mae}
    for mv in CANDIDATE_VARIANTS:
        cand_errs = [abs(r.preds[mv] - r.actual_days) for r in rc_rows]
        cis[mv] = household_bootstrap_ci(
            user_ids=user_ids,
            baseline_abs_errors=base_errs,
            candidate_abs_errors=cand_errs,
            n_boot=FORECAST_BOOTSTRAP_REPLICATES,
            ci_level=FORECAST_BONFERRONI_CI_LEVEL,
            seed=FORECAST_BOOTSTRAP_SEED,
        )
        cand_maes[mv] = rule_clean_metrics[mv].mae

    winner = select_winner(cand_maes, cis, baseline_key=base_key)

    by_k_bucket: dict[tuple[str, str, str], MetricSummary] = {}
    for bucket in ("2", "3-4", "5+"):
        b_rows = [r for r in rc_rows if history_bucket(r.k) == bucket]
        if b_rows:
            sub = _eval_subset(b_rows, quantiles)
            for mv, m in sub.items():
                by_k_bucket[(mv[0], mv[1], bucket)] = m

    by_size_changed: dict[tuple[str, str, bool], MetricSummary] = {}
    for changed in (False, True):
        s_rows = [r for r in rc_rows if r.size_changed_from_previous is changed]
        if s_rows:
            sub = _eval_subset(s_rows, quantiles)
            for mv, m in sub.items():
                by_size_changed[(mv[0], mv[1], changed)] = m

    by_category: dict[tuple[str, str, str], MetricSummary] = {}
    categories = sorted({r.category for r in rc_rows})
    focus_mvs = list(dict.fromkeys([("baseline", "none"), ("baseline", "rule_only"), winner]))
    for cat in categories:
        c_rows = [r for r in rc_rows if r.category == cat]
        actuals = [r.actual_days for r in c_rows]
        for mv in focus_mvs:
            preds = [r.preds[mv] for r in c_rows]
            by_category[(mv[0], mv[1], cat)] = compute_metrics(actuals, preds)

    return DatasetEval(
        label=label,
        total_targets=len(targets),
        rule_clean_targets=len(rc_rows),
        oracle_clean_targets=len(oc_rows),
        rule_clean_metrics=rule_clean_metrics,
        all_metrics=all_metrics,
        oracle_clean_metrics=oracle_clean_metrics,
        bootstrap_cis=cis,
        winner=winner,
        by_k_bucket=by_k_bucket,
        by_size_changed=by_size_changed,
        by_category=by_category,
    )


def _format_eval_table(ev: DatasetEval, view: str = "rule_clean") -> list[str]:
    metrics = (
        ev.rule_clean_metrics
        if view == "rule_clean"
        else ev.all_metrics
        if view == "all"
        else ev.oracle_clean_metrics
    )
    lines = [
        "| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) "
        "| P10-P90 Cov (%) | Mean Width (d) |",
        "| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for mv in ALL_METHOD_VARIANTS:
        m = metrics[mv]
        cov = f"{m.coverage_pct:.1f}%" if m.coverage_pct is not None else "n/a"
        wid = f"{m.mean_width:.1f}" if m.mean_width is not None else "n/a"
        lines.append(
            f"| `{mv[0]}` | `{mv[1]}` | {m.mae:.2f} | {m.median_ae:.2f} | {m.mape_pct:.1f}% "
            f"| {m.bias:+.2f} | {cov} | {wid} |"
        )
    return lines


def render_forecast_report(
    primary_eval: DatasetEval,
    seed_label: str,
    scale_label: str,
    extra_evals: Sequence[DatasetEval] = (),
) -> str:
    ci_pct = FORECAST_BONFERRONI_CI_LEVEL * 100.0
    lines: list[str] = [
        "# Nittoo Forecast Lab — Rolling-Origin Backtest Report",
        "",
        f"Generated at: `{datetime.now(UTC).isoformat(timespec='seconds')}`  ",
        f"Scale: `{scale_label}` | Seed: `{seed_label}` | Git commit: `{_git_sha()}`  ",
        (
            f"Config: `MIN_TRAIN_CYCLES={MIN_TRAIN_CYCLES}`, "
            f"`EWMA_DURATION_ALPHA={EWMA_DURATION_ALPHA}`, "
            f"`EWMA_RATE_ALPHA={EWMA_RATE_ALPHA}`, "
            f"`BONFERRONI_CI={ci_pct:.2f}%` (`m={FORECAST_NUM_CANDIDATES}`)."
        ),
        "",
        "## 1. Selection Rule & Primary Comparison (Rule-Clean Next Cycles)",
        "",
        (
            "Selection metric: MAE on rule-clean next cycles "
            f"(`n={primary_eval.rule_clean_targets:,}`, "
            "excluding only target `is_zero_day` and `duration_days >= 1000`). "
            f"Winner requires lowest MAE AND household-clustered {ci_pct:.2f}% Bonferroni CI "
            "of `(baseline(none) MAE - candidate MAE)` strictly `> 0`."
        ),
        "",
        *_format_eval_table(primary_eval, view="rule_clean"),
        "",
        (
            "**Mechanical Selection Outcome:** "
            f"**`{primary_eval.winner[0]} ({primary_eval.winner[1]})`**"
        ),
        "",
        "### 1.1 Household-Clustered Bonferroni Bootstrap CIs vs `baseline (none)`",
        "",
        f"| Candidate Method | Variant | MAE Improvement (d) | {ci_pct:.2f}% CI | Qualifies? |",
        "| :--- | :--- | ---: | :---: | :---: |",
    ]
    for mv in CANDIDATE_VARIANTS:
        ci = primary_eval.bootstrap_cis[mv]
        qual = "YES" if ci.ci_low > 0 else "no"
        lines.append(
            f"| `{mv[0]}` | `{mv[1]}` | {ci.mae_improvement:+.3f} "
            f"| `[{ci.ci_low:+.3f}, {ci.ci_high:+.3f}]` | {qual} |"
        )

    lines.extend(
        [
            "",
            "## 2. Secondary Views (All Next Cycles & Oracle-Clean)",
            "",
            f"### 2.1 All Next Cycles (`n={primary_eval.total_targets:,}`)",
            "",
            *_format_eval_table(primary_eval, view="all"),
        ]
    )
    if primary_eval.oracle_clean_metrics:
        lines.extend(
            [
                "",
                (
                    f"### 2.2 Oracle-Clean View (`n={primary_eval.oracle_clean_targets:,}`, "
                    "manifest faults removed — reporting only, never used for selection)"
                ),
                "",
                *_format_eval_table(primary_eval, view="oracle_clean"),
            ]
        )

    w = primary_eval.winner
    focus = list(dict.fromkeys([("baseline", "none"), ("baseline", "rule_only"), w]))
    lines.extend(
        [
            "",
            "## 3. Breakdowns (Rule-Clean Next Cycles)",
            "",
            "### 3.1 By History Length `k` (with Calibrated P10-P90 Coverage & Width)",
            "",
            "| History `k` | Method | Variant | `n` | MAE (d) | Cov (%) | Width (d) |",
            "| :---: | :--- | :--- | ---: | ---: | ---: | ---: |",
        ]
    )
    for bucket in ("2", "3-4", "5+"):
        for mv in focus:
            m = primary_eval.by_k_bucket.get((mv[0], mv[1], bucket))
            if m is None:
                continue
            cov = f"{m.coverage_pct:.1f}%" if m.coverage_pct is not None else "n/a"
            wid = f"{m.mean_width:.1f}" if m.mean_width is not None else "n/a"
            lines.append(
                f"| `{bucket}` | `{mv[0]}` | `{mv[1]}` | {m.n:,} | {m.mae:.2f} | {cov} | {wid} |"
            )

    lines.extend(
        [
            "",
            "### 3.2 By Pack-Size Switch (`size_changed_from_previous`)",
            "",
            "| Size Changed? | Method | Variant | `n` | MAE (d) | Bias (d) |",
            "| :---: | :--- | :--- | ---: | ---: | ---: |",
        ]
    )
    for changed in (False, True):
        for mv in focus:
            m = primary_eval.by_size_changed.get((mv[0], mv[1], changed))
            if m is None:
                continue
            lines.append(
                f"| `{changed}` | `{mv[0]}` | `{mv[1]}` | {m.n:,} | {m.mae:.2f} | {m.bias:+.2f} |"
            )

    lines.extend(
        [
            "",
            "### 3.3 By Category",
            "",
            f"| Category | `baseline (none)` MAE | `baseline (rule_only)` MAE "
            f"| `{w[0]} ({w[1]})` MAE |",
            "| :--- | ---: | ---: | ---: |",
        ]
    )
    cats = sorted({k[2] for k in primary_eval.by_category})
    for cat in cats:
        b_none = primary_eval.by_category[("baseline", "none", cat)].mae
        b_ro = primary_eval.by_category[("baseline", "rule_only", cat)].mae
        w_mae = primary_eval.by_category[(w[0], w[1], cat)].mae
        lines.append(f"| {cat} | {b_none:.2f} | {b_ro:.2f} | {w_mae:.2f} |")

    if extra_evals:
        lines.extend(
            [
                "",
                "## 4. Dev vs Holdout vs High-Noise (`2.5x`) Comparison (Rule-Clean MAE)",
                "",
                "| Method | Variant | "
                + " | ".join(ev.label for ev in extra_evals)
                + " |",
                "| :--- | :--- | " + " | ".join("---:" for _ in extra_evals) + " |",
            ]
        )
        for mv in ALL_METHOD_VARIANTS:
            vals = " | ".join(f"{ev.rule_clean_metrics[mv].mae:.2f}" for ev in extra_evals)
            lines.append(f"| `{mv[0]}` | `{mv[1]}` | {vals} |")

    b_no_switch = primary_eval.by_size_changed.get(("baseline", "none", False))
    w_no_switch = primary_eval.by_size_changed.get((w[0], w[1], False))
    w_switch = primary_eval.by_size_changed.get((w[0], w[1], True))
    b_switch = primary_eval.by_size_changed.get(("baseline", "none", True))

    lines.extend(
        [
            "",
            "## 5. Plain-English Summary",
            "",
            (
                "- **Data cleaning vs method choice:** "
                "`baseline (none)` vs `baseline (rule_only)` separates outlier removal from "
                "forecasting "
                f"(`{primary_eval.rule_clean_metrics[('baseline', 'none')].mae:.2f}` d "
                f"vs `{primary_eval.rule_clean_metrics[('baseline', 'rule_only')].mae:.2f}` d)."
            ),
            (
                f"- **Winner (`{w[0]} ({w[1]})`):** achieves "
                f"`{primary_eval.rule_clean_metrics[w].mae:.2f}` d MAE "
                f"(vs `{primary_eval.rule_clean_metrics[('baseline', 'none')].mae:.2f}` d "
                "for the current app baseline)."
            ),
            (
                "- **Where the baseline wins / matches:** "
                + (
                    "when pack size does **not** change (`size_changed_from_previous=False`), "
                    f"`baseline (none)` (`{b_no_switch.mae:.2f}` d) is close to "
                    f"`{w[0]}` (`{w_no_switch.mae:.2f}` d); "
                    if b_no_switch and w_no_switch
                    else ""
                )
                + (
                    f"on pack-size switches (`size_changed_from_previous=True`), "
                    f"`baseline (none)` degrades to `{b_switch.mae:.2f}` d while size-normalized "
                    f"`{w[0]}` stays at `{w_switch.mae:.2f}` d."
                    if b_switch and w_switch
                    else "duration-only methods cannot adapt when pack size changes."
                )
            ),
        ]
    )
    return "\n".join(lines) + "\n"


def run_forecast_evaluation(
    db_path: Path = DEFAULT_DB_PATH,
    faults_manifest_path: Path | None = None,
    report_path: Path = DEFAULT_FORECAST_REPORT_PATH,
) -> ForecastReportResult:
    t0 = time.perf_counter()
    if faults_manifest_path is None:
        candidate = db_path.parent / "ground_truth" / "injected_faults.json"
        faults_manifest_path = candidate if candidate.exists() else DEFAULT_FAULTS_MANIFEST_PATH

    seed_label = "unknown"
    scale_label = "unknown"
    if faults_manifest_path.exists():
        meta = json.loads(faults_manifest_path.read_text(encoding="utf-8"))
        seed_label = str(meta.get("seed", "unknown"))
        if "households" in meta and "months" in meta:
            scale_label = f"{meta['households']} households x {meta['months']} months"

    targets = run_rolling_backtest(
        db_path=db_path,
        ewma_duration_alpha=EWMA_DURATION_ALPHA,
        ewma_rate_alpha=EWMA_RATE_ALPHA,
        faults_manifest_path=faults_manifest_path,
    )
    ev = evaluate_targets(label=f"Seed {seed_label}", targets=targets)
    md = render_forecast_report(ev, seed_label=seed_label, scale_label=scale_label)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(md, encoding="utf-8")

    return ForecastReportResult(
        report_path=report_path,
        winner=ev.winner,
        rule_clean_targets=ev.rule_clean_targets,
        elapsed_seconds=round(time.perf_counter() - t0, 3),
    )
