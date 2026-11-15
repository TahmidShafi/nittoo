import json
from pathlib import Path

from nittoo_lab.contracts.models import NittooExportBackup
from nittoo_lab.simulate.archetypes import ARCHETYPES
from nittoo_lab.simulate.generator import simulate_households


def test_archetype_catalog_has_40_unique_entries() -> None:
    assert len(ARCHETYPES) == 40
    assert len({a.slug for a in ARCHETYPES}) == 40


def test_simulator_is_reproducible_and_separates_ground_truth(tmp_path: Path) -> None:
    exp1 = tmp_path / "run1" / "exports"
    gt1 = tmp_path / "run1" / "true_rates.json"
    exp2 = tmp_path / "run2" / "exports"
    gt2 = tmp_path / "run2" / "true_rates.json"

    s1 = simulate_households(
        households=10, months=12, seed=123, exports_dir=exp1, ground_truth_path=gt1
    )
    s2 = simulate_households(
        households=10, months=12, seed=123, exports_dir=exp2, ground_truth_path=gt2
    )

    assert s1.products == s2.products
    assert s1.purchases == s2.purchases
    assert s1.usage_periods == s2.usage_periods
    assert (exp1 / "hh_0001.json").read_text(encoding="utf-8") == (exp2 / "hh_0001.json").read_text(
        encoding="utf-8"
    )

    # Ground truth never leaks into export files
    sample_export = json.loads((exp1 / "hh_0001.json").read_text(encoding="utf-8"))
    NittooExportBackup.model_validate(sample_export)
    assert "true_consumption_rate_per_day" not in json.dumps(sample_export)

    gt = json.loads(gt1.read_text(encoding="utf-8"))
    assert len(gt["records"]) == s1.products


def test_simulator_injects_data_quality_faults_at_scale(tmp_path: Path) -> None:
    exp = tmp_path / "exports"
    gt = tmp_path / "true_rates.json"
    stats = simulate_households(
        households=40, months=24, seed=42, exports_dir=exp, ground_truth_path=gt
    )

    total_faults = sum(stats.injected_faults.values())
    assert total_faults > 0
    assert stats.usage_periods > 200


def test_different_seeds_produce_different_outputs(tmp_path: Path) -> None:
    exp1 = tmp_path / "seed1" / "exports"
    gt1 = tmp_path / "seed1" / "true_rates.json"
    exp2 = tmp_path / "seed2" / "exports"
    gt2 = tmp_path / "seed2" / "true_rates.json"

    simulate_households(households=5, months=6, seed=1, exports_dir=exp1, ground_truth_path=gt1)
    simulate_households(households=5, months=6, seed=2, exports_dir=exp2, ground_truth_path=gt2)

    assert (exp1 / "hh_0001.json").read_text(encoding="utf-8") != (exp2 / "hh_0001.json").read_text(
        encoding="utf-8"
    )


def test_fault_rate_near_2_percent_with_all_types_present(tmp_path: Path) -> None:
    exp = tmp_path / "exports"
    gt = tmp_path / "true_rates.json"
    stats = simulate_households(
        households=100, months=24, seed=42, exports_dir=exp, ground_truth_path=gt
    )

    expected_types = {
        "zero_day_cycle",
        "duplicate_purchase",
        "outlier_1000_day",
        "finished_before_opened",
        "subtle_duration_outlier",
    }
    assert set(stats.injected_faults.keys()) == expected_types
    for fault_type in expected_types:
        assert stats.injected_faults[fault_type] > 0

    total_faults = sum(stats.injected_faults.values())
    fault_rate = total_faults / max(1, stats.usage_periods)
    assert 0.01 <= fault_rate <= 0.035

    manifest = json.loads(stats.faults_manifest_path.read_text(encoding="utf-8"))
    assert manifest["counts"] == stats.injected_faults
    assert len(manifest["faults"]) == total_faults
