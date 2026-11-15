import copy
import json
from pathlib import Path

import jsonschema
import pytest
from pydantic import ValidationError

from nittoo_lab.contracts.models import NittooExportBackup

ANALYTICS_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_PATH = ANALYTICS_ROOT / "fixtures" / "demo_export.json"
SCHEMA_PATH = ANALYTICS_ROOT / "src" / "nittoo_lab" / "contracts" / "nittoo_export.schema.json"


def test_demo_export_fixture_matches_pydantic_contract() -> None:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    parsed = NittooExportBackup.model_validate(raw)

    assert parsed.version == "1.1.0"
    assert len(parsed.products) == 12
    assert len(parsed.purchases) == 61
    assert len(parsed.usage_periods) == 60
    assert len(parsed.restock_plans) == 1


def test_demo_export_fixture_matches_json_schema() -> None:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    jsonschema.validate(instance=raw, schema=schema)
    assert schema == NittooExportBackup.model_json_schema()


def test_v1_0_0_export_without_purchase_size_fields_still_validates() -> None:
    raw = copy.deepcopy(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    raw["version"] = "1.0.0"
    for purchase in raw["purchases"]:
        purchase.pop("size_value", None)
        purchase.pop("size_unit", None)

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(instance=raw, schema=schema)
    parsed = NittooExportBackup.model_validate(raw)
    assert parsed.version == "1.0.0"
    assert all(p.size_value is None and p.size_unit is None for p in parsed.purchases)


def test_v1_1_0_export_with_purchase_size_override_validates() -> None:
    raw = copy.deepcopy(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    raw["version"] = "1.1.0"
    raw["purchases"][0]["size_value"] = 473
    raw["purchases"][0]["size_unit"] = "ml"

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(instance=raw, schema=schema)
    parsed = NittooExportBackup.model_validate(raw)
    assert parsed.purchases[0].size_value == 473
    assert parsed.purchases[0].size_unit == "ml"


@pytest.mark.parametrize("bad_size_value", [0, -10])
def test_rejects_non_positive_purchase_size_value(bad_size_value: float) -> None:
    raw = copy.deepcopy(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    raw["purchases"][0]["size_value"] = bad_size_value
    raw["purchases"][0]["size_unit"] = "ml"

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=raw, schema=schema)
    with pytest.raises(ValidationError):
        NittooExportBackup.model_validate(raw)


def test_rejects_invalid_purchase_size_unit() -> None:
    raw = copy.deepcopy(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    raw["purchases"][0]["size_value"] = 250
    raw["purchases"][0]["size_unit"] = "oz"

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=raw, schema=schema)
    with pytest.raises(ValidationError):
        NittooExportBackup.model_validate(raw)
