from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"


def _snapshot_reports() -> dict[str, bytes]:
    return {
        p.relative_to(REPORTS_DIR).as_posix(): p.read_bytes()
        for p in sorted(REPORTS_DIR.rglob("*"))
        if p.is_file()
    }


@pytest.fixture(scope="session", autouse=True)
def assert_committed_reports_unchanged() -> Iterator[None]:
    """Fail the suite if any test modifies committed files under analytics/reports/."""
    before = _snapshot_reports()
    yield
    after = _snapshot_reports()
    assert after.keys() == before.keys(), (
        f"analytics/reports/ file set changed during test run: "
        f"added={sorted(after.keys() - before.keys())}, "
        f"removed={sorted(before.keys() - after.keys())}"
    )
    changed = [name for name, content in before.items() if after[name] != content]
    assert not changed, f"analytics/reports/ files modified during test run: {changed}"
