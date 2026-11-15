from __future__ import annotations

import difflib
import json
from dataclasses import dataclass
from pathlib import Path

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = ANALYTICS_ROOT.parent
DEFAULT_RESULTS_JSON_PATH = ANALYTICS_ROOT / "reports" / "forecast_results.json"
DEFAULT_README_PATH = REPO_ROOT / "README.md"

START_MARKER = "<!-- results:start -->"
END_MARKER = "<!-- results:end -->"


@dataclass(frozen=True)
class ReadmeResultsOutcome:
    ok: bool
    diff_text: str = ""


def render_readme_results_block(results_json_path: Path = DEFAULT_RESULTS_JSON_PATH) -> str:
    """Render the README results block strictly from forecast_results.json."""
    data = json.loads(results_json_path.read_text(encoding="utf-8"))
    prov = data["provenance"]
    holdout = data["holdout"]
    const_m = holdout["constant_size_history"]
    change_m = holdout["size_change_history"]
    overall_m = holdout["overall"]
    switch_stats = data.get("size_switch_stats") or {}
    nominal_cov = float(data["nominal_interval_coverage_pct"])

    base_none_c = const_m["baseline:none"]
    base_ro_c = const_m["baseline:rule_only"]
    rate_ro_c = const_m["rate_mean:rule_only"]

    base_none_s = change_m["baseline:none"]
    base_ro_s = change_m["baseline:rule_only"]
    rate_ro_s = change_m["rate_mean:rule_only"]

    base_none_o = overall_m["baseline:none"]
    base_ro_o = overall_m["baseline:rule_only"]
    rate_ro_o = overall_m["rate_mean:rule_only"]

    elasticity = data.get("elasticity", [])
    eps03 = next((e for e in elasticity if "0.3" in str(e.get("label", ""))), None)
    eps06 = next((e for e in elasticity if "0.6" in str(e.get("label", ""))), None)

    switch_note = ""
    if switch_stats:
        switch_note = (
            f" ({switch_stats['product_switch_pct']:.1f}% of products switch sizes; "
            f"{switch_stats['purchase_override_pct']:.1f}% of purchases override)"
        )

    lines: list[str] = [
        START_MARKER,
        (
            f"> **SYNTHETIC DATA NOTICE:** All metrics below come from the synthetic "
            f"simulator (`{prov['scale']}`, rule-clean holdout "
            f"`n={holdout['rule_clean_targets']:,}`"
            f" — constant-size `n={rate_ro_c['n']:,}`, size-change `n={rate_ro_s['n']:,}`). "
            f"The blended gain depends on the simulator's synthetic switch frequency{switch_note}."
        ),
        "",
        "| Method | Constant-Size MAE (d) | Size-Change MAE (d) | Overall Holdout MAE (d) |",
        "| :--- | ---: | ---: | ---: |",
        (
            f"| `baseline (none)` (original app) | {base_none_c['mae']:.2f} "
            f"| {base_none_s['mae']:.2f} | {base_none_o['mae']:.2f} |"
        ),
        (
            f"| `baseline (rule_only)` (cleaned) | {base_ro_c['mae']:.2f} "
            f"| {base_ro_s['mae']:.2f} | {base_ro_o['mae']:.2f} |"
        ),
        (
            f"| **`rate_mean (rule_only)` (shipped)** | **{rate_ro_c['mae']:.2f}** "
            f"| **{rate_ro_s['mae']:.2f}** | **{rate_ro_o['mae']:.2f}** |"
        ),
        "",
        (
            f"- **Calibrated P10–P90 interval coverage (holdout):** "
            f"`{rate_ro_o['coverage_pct']:.1f}%` observed for `rate_mean (rule_only)` "
            f"(mean width `{rate_ro_o['mean_width']:.1f}` days) vs nominal `{nominal_cov:.0f}%`."
        ),
    ]

    if eps03 and eps06:
        r03 = eps03["methods"]["rate_mean:rule_only"]["mae"]
        e03 = eps03["methods"]["ewma_duration:rule_only"]["mae"]
        r06 = eps06["methods"]["rate_mean:rule_only"]["mae"]
        e06 = eps06["methods"]["ewma_duration:rule_only"]["mae"]
        lines.append(
            f"- **Pack-size elasticity caveat:** Rate normalization assumes consumption pace "
            f"is independent of pack size (`eps=0.0`). When usage scales with pack size, "
            f"`rate_mean (rule_only)` degrades from `{r03:.2f}` d (`eps=0.3`, vs "
            f"`ewma_duration` `{e03:.2f}` d) to `{r06:.2f}` d (`eps=0.6`, where "
            f"`ewma_duration` crosses over at `{e06:.2f}` d). Real user data is needed to "
            f"measure true elasticity."
        )

    lines.extend(
        [
            (
                "- **Full reports:** "
                "[Forecast Backtest](analytics/reports/forecast_report.md) · "
                "[Data Quality](analytics/reports/data_quality.md) · "
                "[Detector Robustness](analytics/reports/detector_robustness.md) · "
                "[Machine-Readable Results](analytics/reports/forecast_results.json)"
            ),
            END_MARKER,
        ]
    )
    return "\n".join(lines)


def update_readme_results(
    readme_path: Path = DEFAULT_README_PATH,
    results_json_path: Path = DEFAULT_RESULTS_JSON_PATH,
    check: bool = False,
) -> ReadmeResultsOutcome:
    """Update or check the <!-- results:start --> ... <!-- results:end --> block in README.md."""
    text = readme_path.read_text(encoding="utf-8")
    if START_MARKER not in text or END_MARKER not in text:
        raise ValueError(f"Missing {START_MARKER} / {END_MARKER} markers in {readme_path}")

    start_idx = text.index(START_MARKER)
    end_idx = text.index(END_MARKER) + len(END_MARKER)
    existing_block = text[start_idx:end_idx]
    generated_block = render_readme_results_block(results_json_path)

    if check:
        if existing_block.splitlines() == generated_block.splitlines():
            return ReadmeResultsOutcome(ok=True)
        diff = "\n".join(
            difflib.unified_diff(
                existing_block.splitlines(),
                generated_block.splitlines(),
                fromfile="committed/README-results",
                tofile="generated/README-results",
                lineterm="",
            )
        )
        return ReadmeResultsOutcome(ok=False, diff_text=diff)

    updated = text[:start_idx] + generated_block + text[end_idx:]
    readme_path.write_text(updated, encoding="utf-8")
    return ReadmeResultsOutcome(ok=True)
