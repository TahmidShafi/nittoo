from __future__ import annotations

import difflib
import json
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from nittoo_lab.forecast.report import (
    DEFAULT_FORECAST_REPORT_PATH,
    DEFAULT_FORECAST_RESULTS_PATH,
    run_full_forecast_suite,
)
from nittoo_lab.ingest.loader import ingest_exports
from nittoo_lab.reporting.generator import DEFAULT_REPORT_PATH, generate_data_quality_report
from nittoo_lab.reporting.robustness import DEFAULT_ROBUSTNESS_REPORT_PATH, run_robustness_sweep
from nittoo_lab.simulate.generator import simulate_households
from nittoo_lab.transform.runner import run_dbt_pipeline

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
REPORTS_DIR = ANALYTICS_ROOT / "reports"

_GENERATED_AT_RE = re.compile(r"^Generated at: `[^`]+`\s*$")
_GIT_COMMIT_RE = re.compile(r"\| Git commit: `[^`]+`\s*$")
_DBT_TIME_ROW_RE = re.compile(r"^(\| `[^`]+` \| [^|]+ \| \d+ \| )([0-9.]+)( \|)$")


@dataclass(frozen=True)
class ReproduceResult:
    ok: bool
    diffs: dict[str, str]
    elapsed_seconds: float


def normalize_markdown_for_check(text: str, strip_dbt_timing: bool = False) -> list[str]:
    """Normalize a report for reproducibility comparison, ignoring only provenance & dbt timings."""
    out: list[str] = []
    for line in text.splitlines():
        if _GENERATED_AT_RE.match(line):
            out.append("Generated at: `<PROVENANCE>`")
            continue
        line = _GIT_COMMIT_RE.sub("| Git commit: `<PROVENANCE>`", line)
        if strip_dbt_timing:
            line = _DBT_TIME_ROW_RE.sub(r"\1<TIME>\3", line)
        out.append(line.rstrip())
    return out


def normalize_json_for_check(text: str) -> list[str]:
    """Normalize forecast_results.json by masking provenance timestamps and commit SHA."""
    data = json.loads(text)
    if isinstance(data, dict) and isinstance(data.get("provenance"), dict):
        data["provenance"]["generated_at"] = "<PROVENANCE>"
        data["provenance"]["git_commit"] = "<PROVENANCE>"
    return json.dumps(data, indent=2, sort_keys=False).splitlines()


def reproduce_all_reports(check: bool = False) -> ReproduceResult:
    """Regenerate all committed reports (and forecast_results.json) at documented scales."""
    t0 = time.perf_counter()
    diffs: dict[str, str] = {}

    with tempfile.TemporaryDirectory(prefix="nittoo_repro_") as tmp_str:
        tmp = Path(tmp_str)

        # 1. data_quality.md (seed 2027, 500 x 24)
        dq_sub = tmp / "dq_2027"
        dq_exp = dq_sub / "exports"
        dq_gt = dq_sub / "true_rates.json"
        dq_fm = dq_sub / "injected_faults.json"
        dq_db = dq_sub / "nittoo.duckdb"
        dq_out = tmp / "data_quality.md"

        simulate_households(
            households=500,
            months=24,
            seed=2027,
            exports_dir=dq_exp,
            ground_truth_path=dq_gt,
            faults_manifest_path=dq_fm,
        )
        ingest_exports(exports_dir=dq_exp, db_path=dq_db)
        run_dbt_pipeline(db_path=dq_db, generate_docs=False)
        generate_data_quality_report(
            db_path=dq_db,
            report_path=dq_out,
            faults_manifest_path=dq_fm,
        )

        # 2. forecast_report.md + forecast_results.json (seeds 7, 4001, 4002, 4003, 4004, 500 x 24)
        fc_out = tmp / "forecast_report.md"
        fc_json_out = tmp / "forecast_results.json"
        run_full_forecast_suite(
            households=500,
            months=24,
            report_path=fc_out,
            results_json_path=fc_json_out,
        )

        # 3. detector_robustness.md (seeds 3001-3006, 200 x 24)
        rob_out = tmp / "detector_robustness.md"
        run_robustness_sweep(
            households=200,
            months=24,
            report_path=rob_out,
        )

        pairs: list[tuple[Path, Path, str]] = [
            (dq_out, DEFAULT_REPORT_PATH, "dq_md"),
            (fc_out, DEFAULT_FORECAST_REPORT_PATH, "md"),
            (fc_json_out, DEFAULT_FORECAST_RESULTS_PATH, "json"),
            (rob_out, DEFAULT_ROBUSTNESS_REPORT_PATH, "md"),
        ]

        if check:
            for gen_path, committed_path, kind in pairs:
                gen_text = gen_path.read_text(encoding="utf-8")
                if not committed_path.exists():
                    diffs[committed_path.name] = f"Committed file missing: {committed_path}"
                    continue
                comm_text = committed_path.read_text(encoding="utf-8")
                if kind == "json":
                    gen_lines = normalize_json_for_check(gen_text)
                    comm_lines = normalize_json_for_check(comm_text)
                else:
                    gen_lines = normalize_markdown_for_check(
                        gen_text, strip_dbt_timing=(kind == "dq_md")
                    )
                    comm_lines = normalize_markdown_for_check(
                        comm_text, strip_dbt_timing=(kind == "dq_md")
                    )
                if gen_lines != comm_lines:
                    diff_text = "\n".join(
                        difflib.unified_diff(
                            comm_lines,
                            gen_lines,
                            fromfile=f"committed/{committed_path.name}",
                            tofile=f"regenerated/{committed_path.name}",
                            lineterm="",
                        )
                    )
                    diffs[committed_path.name] = diff_text
        else:
            for gen_path, committed_path, _ in pairs:
                committed_path.parent.mkdir(parents=True, exist_ok=True)
                committed_path.write_text(gen_path.read_text(encoding="utf-8"), encoding="utf-8")

    return ReproduceResult(
        ok=len(diffs) == 0,
        diffs=diffs,
        elapsed_seconds=round(time.perf_counter() - t0, 3),
    )
