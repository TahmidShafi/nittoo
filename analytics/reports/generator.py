from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb

ANALYTICS_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ANALYTICS_ROOT / "data" / "nittoo.duckdb"
DEFAULT_FAULTS_MANIFEST_PATH = ANALYTICS_ROOT / "data" / "ground_truth" / "injected_faults.json"
DEFAULT_RUN_RESULTS_PATH = ANALYTICS_ROOT / "dbt" / "target" / "run_results.json"
DEFAULT_REPORT_PATH = ANALYTICS_ROOT / "reports" / "data_quality.md"


@dataclass(frozen=True)
class FaultRecallRow:
    fault_type: str
    injected: int
    rejected_at_contract: int
    flagged_in_dbt: int
    recall_pct: float


@dataclass(frozen=True)
class ReportResult:
    report_path: Path
    layer_counts: dict[str, dict[str, int]]
    rejects_by_reason: dict[str, int]
    fault_recall: list[FaultRecallRow]
    dbt_tests_total: int
    dbt_tests_passed: int
    dbt_tests_warned: int
    dbt_tests_failed: int
    elapsed_seconds: float


def _collect_layer_counts(con: duckdb.DuckDBPyConnection) -> dict[str, dict[str, int]]:
    tables = con.execute(
        """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('raw', 'main_staging', 'main_intermediate', 'main_marts')
        ORDER BY table_schema, table_name
        """
    ).fetchall()

    grouped: dict[str, dict[str, int]] = {
        "raw": {},
        "staging": {},
        "intermediate": {},
        "marts": {},
    }
    schema_map = {
        "raw": "raw",
        "main_staging": "staging",
        "main_intermediate": "intermediate",
        "main_marts": "marts",
    }
    for schema_name, table_name in tables:
        layer = schema_map[schema_name]
        cnt = con.execute(f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"').fetchone()[0]
        grouped[layer][table_name] = int(cnt)
    return grouped


def _collect_rejects(con: duckdb.DuckDBPyConnection) -> dict[str, int]:
    rows = con.execute(
        """
        SELECT reason_code, COUNT(*) AS cnt
        FROM raw.rejects
        GROUP BY reason_code
        ORDER BY cnt DESC, reason_code ASC
        """
    ).fetchall()
    return {str(r[0]): int(r[1]) for r in rows}


def _collect_dbt_tests(run_results_path: Path) -> list[dict[str, object]]:
    if not run_results_path.exists():
        return []
    data = json.loads(run_results_path.read_text(encoding="utf-8"))
    tests: list[dict[str, object]] = []
    for r in data.get("results", []):
        uid = str(r.get("unique_id", ""))
        if not uid.startswith("test."):
            continue
        parts = uid.split(".")
        tests.append(
            {
                "name": parts[2] if len(parts) >= 3 else uid,
                "status": str(r.get("status", "unknown")),
                "failures": r.get("failures") or 0,
                "execution_time": round(float(r.get("execution_time", 0.0)), 3),
            }
        )
    return tests


def _collect_dbt_flag_counts(con: duckdb.DuckDBPyConnection) -> dict[str, int]:
    zero_day = 0
    outlier = 0
    dup_purchases = 0
    tables = {
        (r[0], r[1])
        for r in con.execute(
            "SELECT table_schema, table_name FROM information_schema.tables"
        ).fetchall()
    }
    if ("main_marts", "fact_consumption_cycle") in tables:
        row = con.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN is_zero_day THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN is_duration_outlier THEN 1 ELSE 0 END), 0)
            FROM main_marts.fact_consumption_cycle
            """
        ).fetchone()
        zero_day = int(row[0])
        outlier = int(row[1])
    if ("main_staging", "stg_purchase_duplicates") in tables:
        dup_purchases = int(
            con.execute("SELECT COUNT(*) FROM main_staging.stg_purchase_duplicates").fetchone()[0]
        )
    return {
        "zero_day_cycle": zero_day,
        "outlier_1000_day": outlier,
        "duplicate_purchase": dup_purchases,
    }


def _compute_fault_recall(
    faults_manifest_path: Path,
    rejects_by_reason: dict[str, int],
    dbt_flags: dict[str, int],
) -> list[FaultRecallRow]:
    if not faults_manifest_path.exists():
        return []
    manifest = json.loads(faults_manifest_path.read_text(encoding="utf-8"))
    counts: dict[str, int] = {str(k): int(v) for k, v in manifest.get("counts", {}).items()}

    mapping: list[tuple[str, str | None, str | None]] = [
        ("finished_before_opened", "FINISHED_BEFORE_OPENED", None),
        ("zero_day_cycle", None, "zero_day_cycle"),
        ("outlier_1000_day", None, "outlier_1000_day"),
        ("duplicate_purchase", None, "duplicate_purchase"),
    ]
    rows: list[FaultRecallRow] = []
    for fault_type, reject_code, dbt_key in mapping:
        injected = counts.get(fault_type, 0)
        rejected = rejects_by_reason.get(reject_code, 0) if reject_code else 0
        flagged = dbt_flags.get(dbt_key, 0) if dbt_key else 0
        detected = rejected + flagged
        recall = round(100.0 * min(detected, injected) / injected, 1) if injected > 0 else 100.0
        rows.append(
            FaultRecallRow(
                fault_type=fault_type,
                injected=injected,
                rejected_at_contract=rejected,
                flagged_in_dbt=flagged,
                recall_pct=recall,
            )
        )
    return rows


def generate_data_quality_report(
    db_path: Path = DEFAULT_DB_PATH,
    run_results_path: Path = DEFAULT_RUN_RESULTS_PATH,
    report_path: Path = DEFAULT_REPORT_PATH,
    faults_manifest_path: Path | None = None,
) -> ReportResult:
    t0 = time.perf_counter()
    if faults_manifest_path is None:
        candidate = db_path.parent / "ground_truth" / "injected_faults.json"
        faults_manifest_path = candidate if candidate.exists() else DEFAULT_FAULTS_MANIFEST_PATH
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        layer_counts = _collect_layer_counts(con)
        rejects_by_reason = _collect_rejects(con)
        dbt_flags = _collect_dbt_flag_counts(con)
    finally:
        con.close()

    fault_recall = _compute_fault_recall(faults_manifest_path, rejects_by_reason, dbt_flags)

    dbt_tests = _collect_dbt_tests(run_results_path)
    tests_total = len(dbt_tests)
    tests_passed = sum(1 for t in dbt_tests if t["status"] in ("pass", "success"))
    tests_warned = sum(1 for t in dbt_tests if t["status"] == "warn")
    tests_failed = tests_total - tests_passed - tests_warned

    seed_label = "unknown"
    scale_label = "unknown"
    if faults_manifest_path.exists():
        meta = json.loads(faults_manifest_path.read_text(encoding="utf-8"))
        seed_label = str(meta.get("seed", "unknown"))
        if "households" in meta and "months" in meta:
            scale_label = f"{meta['households']} households x {meta['months']} months"

    git_sha = "unknown"
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ANALYTICS_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            git_sha = proc.stdout.strip()
    except OSError:
        pass

    lines: list[str] = [
        "# Nittoo Forecast Lab — Data Quality Report",
        "",
        f"Generated at: `{datetime.now(UTC).isoformat(timespec='seconds')}`  ",
        f"Scale: `{scale_label}` | Seed: `{seed_label}` | Git commit: `{git_sha}`  ",
        "Dataset: **SYNTHETIC** household consumption & pricing simulation.",
        "",
        "## 1. Row Counts per Layer",
        "",
        "| Layer | Table / View | Row Count |",
        "| :--- | :--- | ---: |",
    ]
    for layer in ("raw", "staging", "intermediate", "marts"):
        for tbl, cnt in layer_counts[layer].items():
            lines.append(f"| `{layer}` | `{tbl}` | {cnt:,} |")

    lines.extend(
        [
            "",
            "## 2. Ingestion Rejects by Reason Code",
            "",
            f"Total quarantined records: **{sum(rejects_by_reason.values()):,}**",
            "",
            "| Reason Code | Count |",
            "| :--- | ---: |",
        ]
    )
    if rejects_by_reason:
        for reason, cnt in rejects_by_reason.items():
            lines.append(f"| `{reason}` | {cnt:,} |")
    else:
        lines.append("| _(none)_ | 0 |")

    lines.extend(
        [
            "",
            "## 3. Fault-Detection Recall (Ground Truth vs Detected)",
            "",
        ]
    )
    if fault_recall:
        lines.extend(
            [
                "| Fault Type | Injected | Rejected at Contract | Flagged in dbt | Recall (%) |",
                "| :--- | ---: | ---: | ---: | ---: |",
            ]
        )
        for row in fault_recall:
            lines.append(
                f"| `{row.fault_type}` | {row.injected:,} | {row.rejected_at_contract:,} "
                f"| {row.flagged_in_dbt:,} | {row.recall_pct:.1f}% |"
            )
    else:
        lines.append("_No injected-faults manifest found._")

    lines.extend(
        [
            "",
            "## 4. dbt Test Summary",
            "",
            f"- **Total tests:** {tests_total}",
            f"- **Passed:** {tests_passed}",
            f"- **Warned:** {tests_warned}",
            f"- **Failed:** {tests_failed}",
            "",
        ]
    )
    if dbt_tests:
        lines.extend(
            [
                "| Test | Status | Failures | Time (s) |",
                "| :--- | :---: | ---: | ---: |",
            ]
        )
        for t in dbt_tests:
            lines.append(
                f"| `{t['name']}` | {t['status']} | {t['failures']} | {t['execution_time']} |"
            )

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    elapsed = round(time.perf_counter() - t0, 3)
    return ReportResult(
        report_path=report_path,
        layer_counts=layer_counts,
        rejects_by_reason=rejects_by_reason,
        fault_recall=fault_recall,
        dbt_tests_total=tests_total,
        dbt_tests_passed=tests_passed,
        dbt_tests_warned=tests_warned,
        dbt_tests_failed=tests_failed,
        elapsed_seconds=elapsed,
    )
