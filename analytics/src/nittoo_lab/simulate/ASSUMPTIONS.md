# Simulator Assumptions

All parameters below are **synthetic modeling assumptions** chosen to approximate urban Bangladeshi household consumption of FMCG and personal-care essentials. **None of these numbers come from real Nittoo users.**

## Population & Horizon
- **Default scale (assumption):** `500` households × `24` months (`720` days ending on `2026-11-15`).
- **Tracked products per household (assumption):** Uniform integer in `[6, 12]` sampled without replacement from `40` product archetypes.

## Consumption Rate & Pack-Size Switching
- **Baseline archetype rates (assumption):** Hand-estimated daily consumption rates in `analytics/simulate/archetypes.py` (e.g., `2.2 g/day` toothpaste, `5.5 ml/day` shampoo, `22.0 ml/day` liquid detergent).
- **Household heterogeneity (assumption):** Each household-product pair draws a multiplier `clip(lognormal(mean=0, sigma=0.22), 0.55, 1.85)` around the archetype baseline.
- **Cycle-to-cycle noise (assumption):** Per-cycle usage rate varies by `clip(normal(1.0, 0.08), 0.75, 1.30)`.
- **Pack-size switching (assumption):** `15%` probability on each repurchase (`cycle > 1`) of switching to an alternate pack size from `tpl.sizes` (e.g., `200ml → 400ml`). Larger packs are priced with a `0.92` bulk-discount elasticity `(size / base_size) ** 0.92`. Whenever `current_size != tpl.sizes[0]` (the product default), the purchase emits `size_value` and `size_unit` in the `1.1.0` export (otherwise `null`).

## Pricing, Inflation & Vendors
- **Annualized inflation (assumption):** Category-level drift between `6%` (`0.06`) and `11%` (`0.11`) per year, compounded continuously over `days_since_start / 365`, plus `normal(1.0, 0.025)` purchase-level noise.
- **Bangladesh retail vendors (assumption):** `Shwapno`, `Chaldal`, `Agora`, `Meena Bazar`, `Unimart`, `Shajgoj`, `Daraz`, `Aarong`, and `Local Pharmacy` with fixed relative vendor price factors (`0.96`–`1.04`). Households stick to a primary vendor `78%` of the time.

## Seasonality & Abandonment
- **Mild seasonality (assumption):**
  - `summer` (Mar–Jun): `+15%` faster consumption (sunscreen, facewash, body wash, deodorant, insect spray).
  - `winter` (Nov–Feb): `+15%` faster consumption (moisturizing lotion, lip balm, hair oil, tea/coffee, facial tissue).
  - `festive` (Mar–Apr, Jun): `+12%` faster consumption around Eid/Ramadan periods (dishwash, detergent, ghee, handwash).
- **Abandoned products (assumption):** `10%` of tracked household products stop being repurchased after `1–3` cycles and never enter an active cycle at `reference_date`.

## Injected Data-Quality Faults (~2.5% total)
To exercise ingestion validation and dbt data-quality tests:
- `duplicate_purchase` (`0.5%` per purchase): exact duplicate purchase row with the same `id`.
- `zero_day_cycle` (`0.5%` per finished cycle): `finished_date == opened_date` and `days_used == 0`.
- `outlier_1000_day` (`0.5%` per finished cycle): `finished_date = opened_date + 1050 days`.
- `finished_before_opened` (`0.5%` per finished cycle): `finished_date = opened_date - 5 days`.
- `subtle_duration_outlier` (`0.5%` per finished cycle): `days_used = max(1, round(true_duration * factor))` with `factor` drawn uniformly from `[2.5, 6.0]` (slow outlier) or `[0.2, 0.4]` (fast outlier).

## Ground-Truth Separation
- True household-product consumption rates (`true_consumption_rate_per_day`) are written exclusively to `analytics/data/ground_truth/true_rates.json` and are **never** embedded inside the JSON export files under `analytics/data/raw/exports/`.
