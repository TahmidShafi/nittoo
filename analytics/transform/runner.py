from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

ANALYTICS_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DBT_DIR = ANALYTICS_ROOT / "dbt"
DEFAULT_DB_PATH = ANALYTICS_ROOT / "data" / "nittoo.duckdb"


@dataclass(frozen=True)
class DbtResult:
    models_passed: int
    models_failed: int
    tests_total: int
    tests_passed: int
    tests_failed: int
    test_details: list[dict[str, object]]
    docs_generated: bool
    elapsed_seconds: float


def _run_dbt_cmd(
    args: list[str],
    dbt_dir: Path,
    db_path: Path,
) -> subprocess.CompletedProcess[str]:
    dbt_exe = Path(sys.executable).parent / ("dbt.exe" if os.name == "nt" else "dbt")
    cmd = [
        str(dbt_exe) if dbt_exe.exists() else "dbt",
        *args,
        "--project-dir",
        str(dbt_dir),
        "--profiles-dir",
        str(dbt_dir),
    ]
    env = os.environ.copy()
    env["NITTOO_DUCKDB_PATH"] = str(db_path.resolve())
    return subprocess.run(cmd, env=env, capture_output=True, text=True, check=False)


def _parse_run_results(target_dir: Path) -> list[dict[str, object]]:
    rr_path = target_dir / "run_results.json"
    if not rr_path.exists():
        return []
    data = json.loads(rr_path.read_text(encoding="utf-8"))
    return [
        {
            "unique_id": r.get("unique_id", ""),
            "status": r.get("status", ""),
            "execution_time": r.get("execution_time", 0.0),
            "failures": r.get("failures"),
        }
        for r in data.get("results", [])
    ]


def run_dbt_pipeline(
    dbt_dir: Path = DEFAULT_DBT_DIR,
    db_path: Path = DEFAULT_DB_PATH,
    generate_docs: bool = True,
) -> DbtResult:
    t0 = time.perf_counter()
    target_dir = dbt_dir / "target"

    run_proc = _run_dbt_cmd(["run"], dbt_dir, db_path)
    if run_proc.returncode != 0:
        raise RuntimeError(f"dbt run failed:\n{run_proc.stdout}\n{run_proc.stderr}")
    run_results = _parse_run_results(target_dir)
    models_passed = sum(1 for r in run_results if r["status"] == "success")
    models_failed = sum(1 for r in run_results if r["status"] != "success")

    test_proc = _run_dbt_cmd(["test"], dbt_dir, db_path)
    test_results = _parse_run_results(target_dir)
    tests_total = len(test_results)
    tests_passed = sum(1 for r in test_results if r["status"] == "pass")
    tests_failed = tests_total - tests_passed
    if test_proc.returncode != 0:
        raise RuntimeError(f"dbt test failed:\n{test_proc.stdout}\n{test_proc.stderr}")

    docs_ok = False
    if generate_docs:
        docs_proc = _run_dbt_cmd(["docs", "generate"], dbt_dir, db_path)
        if docs_proc.returncode != 0:
            raise RuntimeError(f"dbt docs generate failed:\n{docs_proc.stdout}\n{docs_proc.stderr}")
        docs_ok = (target_dir / "catalog.json").exists() and (target_dir / "manifest.json").exists()

    elapsed = round(time.perf_counter() - t0, 3)
    return DbtResult(
        models_passed=models_passed,
        models_failed=models_failed,
        tests_total=tests_total,
        tests_passed=tests_passed,
        tests_failed=tests_failed,
        test_details=test_results,
        docs_generated=docs_ok,
        elapsed_seconds=elapsed,
    )
