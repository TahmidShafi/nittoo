from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb

ANALYTICS_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ANALYTICS_ROOT / "data" / "nittoo.duckdb"
DEFAULT_RUN_RESULTS_PATH = ANALYTICS_ROOT / "dbt" / "target" / "run_results.json"
DEFAULT_REPORT_PATH = ANALYTICS_ROOT / "reports" / "data_quality.md"


@dataclass(frozen=True)
class ReportResult:
    report_path: Path
    layer_counts: dict[str, dict[str, int]]
    rejects_by_reason: dict[str, int]
    dbt_tests_total: int
    dbt_tests_passed: int
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


def generate_data_quality_report(
    db_path: Path = DEFAULT_DB_PATH,
    run_results_path: Path = DEFAULT_RUN_RESULTS_PATH,
    report_path: Path = DEFAULT_REPORT_PATH,
) -> ReportResult:
    t0 = time.perf_counter()
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        layer_counts = _collect_layer_counts(con)
        rejects_by_reason = _collect_rejects(con)
    finally:
        con.close()

    dbt_tests = _collect_dbt_tests(run_results_path)
    tests_total = len(dbt_tests)
    tests_passed = sum(1 for t in dbt_tests if t["status"] in ("pass", "success"))
    tests_failed = tests_total - tests_passed

    lines: list[str] = [
        "# Nittoo Forecast Lab — Data Quality Report",
        "",
        f"Generated at: `{datetime.now(UTC).isoformat(timespec='seconds')}`  ",
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
            "## 3. dbt Test Summary",
            "",
            f"- **Total tests:** {tests_total}",
            f"- **Passed:** {tests_passed}",
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
        dbt_tests_total=tests_total,
        dbt_tests_passed=tests_passed,
        dbt_tests_failed=tests_failed,
        elapsed_seconds=elapsed,
    )
