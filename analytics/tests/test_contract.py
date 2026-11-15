import json
from pathlib import Path

import jsonschema

from nittoo_lab.contracts.models import NittooExportBackup

ANALYTICS_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_PATH = ANALYTICS_ROOT / "fixtures" / "demo_export.json"
SCHEMA_PATH = ANALYTICS_ROOT / "src" / "nittoo_lab" / "contracts" / "nittoo_export.schema.json"


def test_demo_export_fixture_matches_pydantic_contract() -> None:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    parsed = NittooExportBackup.model_validate(raw)

    assert parsed.version == "1.0.0"
    assert len(parsed.products) == 12
    assert len(parsed.purchases) == 61
    assert len(parsed.usage_periods) == 60
    assert len(parsed.restock_plans) == 1


def test_demo_export_fixture_matches_json_schema() -> None:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    jsonschema.validate(instance=raw, schema=schema)
    assert schema == NittooExportBackup.model_json_schema()
