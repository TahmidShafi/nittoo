# Nittoo Forecast Lab — Data Quality Report

Generated at: `2026-11-15T17:20:33+00:00`  
Scale: `5 households x 6 months` | Seed: `11` | Git commit: `18f9c2d`  
Dataset: **SYNTHETIC** household consumption & pricing simulation.

## 1. Row Counts per Layer

| Layer | Table / View | Row Count |
| :--- | :--- | ---: |
| `raw` | `products` | 50 |
| `raw` | `purchases` | 244 |
| `raw` | `rejects` | 2 |
| `raw` | `restock_plans` | 16 |
| `raw` | `usage_periods` | 228 |
| `staging` | `stg_products` | 50 |
| `staging` | `stg_purchase_duplicates` | 1 |
| `staging` | `stg_purchases` | 243 |
| `staging` | `stg_restock_plans` | 16 |
| `staging` | `stg_usage_periods` | 228 |
| `intermediate` | `int_cycle_quality` | 228 |
| `intermediate` | `int_purchase_unit_prices` | 243 |
| `intermediate` | `int_usage_enriched` | 228 |
| `marts` | `dim_date` | 169 |
| `marts` | `dim_product` | 50 |
| `marts` | `dim_vendor` | 9 |
| `marts` | `fact_consumption_cycle` | 228 |
| `marts` | `fact_purchase` | 243 |
| `marts` | `mart_category_price_index` | 87 |
| `marts` | `mart_monthly_spend` | 175 |

## 2. Ingestion Rejects by Reason Code

Total quarantined records: **2**

| Reason Code | Count |
| :--- | ---: |
| `FINISHED_BEFORE_OPENED` | 2 |

## 3. Fault-Detection Precision, Recall & F1 (Record-Level)

> **Note:** The four rule-based fault types (`finished_before_opened`, `zero_day_cycle`, `outlier_1000_day`, `duplicate_purchase`) are detected by deterministic rules matching their injection definitions, so 100% is expected. The **`subtle_duration_outlier`** detector is the real statistical test.

| Fault Type | Injected | TP | FP | FN | Precision (%) | Recall (%) | F1 (%) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `finished_before_opened` | 2 | 2 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `zero_day_cycle` | 1 | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `outlier_1000_day` | 1 | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `subtle_duration_outlier` | 1 | 0 | 0 | 1 | 100.0% | 0.0% | 0.0% |
| `duplicate_purchase` | 1 | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |

- **Clean-cycle false-positive rate (FPR):** 0 / 181 (0.00%)

### 3.1 Subtle-Outlier Evaluation Summary (Dev vs Seen vs Fresh Holdout)

| Dataset (`500 × 24`) | Role | Precision | Recall | F1 | Clean-Cycle FPR |
| :--- | :--- | ---: | ---: | ---: | ---: |
| Seed `7` | Dev (Iteration 2, tuned here) | 96.1% | 99.4% | 97.7% | 0.02% (13 / 57,658) |
| Seed `42` | Iteration 1 (pre-fix simulator, not comparable) | 9.9% | 71.6% | 17.4% | 3.12% (1,770 / 56,812) |
| Seed `2027` | Fresh Holdout (Iteration 2, frozen) | 96.0% | 99.3% | 97.6% | 0.02% (12 / 56,527) |

- **Exclusion decision (`RATE_OUTLIER_MIN_PRECISION_TO_EXCLUDE = 50.0%`):** Holdout precision (`96.0%`) >= `50.0%`, so `is_rate_outlier` **excludes** flagged cycles from `is_valid_for_forecasting` (not advisory-only).

## 4. dbt Test Summary

- **Total tests:** 41
- **Passed:** 38
- **Warned:** 3
- **Failed:** 0

| Test | Status | Failures | Time (s) |
| :--- | :---: | ---: | ---: |
| `accepted_values_dim_product_size_unit__ml__g__count` | pass | 0 | 0.069 |
| `accepted_values_fact_consumption_cycle_status__completed__active` | pass | 0 | 0.069 |
| `assert_consumption_rate_plausible` | pass | 0 | 0.069 |
| `assert_finished_after_opened` | pass | 0 | 0.069 |
| `assert_no_zero_day_cycles_in_marts` | pass | 0 | 0.046 |
| `not_null_dim_date_date_day` | pass | 0 | 0.04 |
| `not_null_dim_product_category` | pass | 0 | 0.048 |
| `not_null_dim_product_product_id` | pass | 0 | 0.05 |
| `not_null_dim_product_user_id` | pass | 0 | 0.058 |
| `not_null_dim_vendor_vendor_key` | pass | 0 | 0.056 |
| `not_null_dim_vendor_vendor_name` | pass | 0 | 0.052 |
| `not_null_fact_consumption_cycle_product_id` | pass | 0 | 0.042 |
| `not_null_fact_consumption_cycle_purchase_id` | pass | 0 | 0.047 |
| `not_null_fact_consumption_cycle_status` | pass | 0 | 0.042 |
| `not_null_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.045 |
| `not_null_fact_purchase_price` | pass | 0 | 0.038 |
| `not_null_fact_purchase_product_id` | pass | 0 | 0.048 |
| `not_null_fact_purchase_purchase_date` | pass | 0 | 0.048 |
| `not_null_fact_purchase_purchase_id` | pass | 0 | 0.038 |
| `not_null_fact_purchase_vendor_key` | pass | 0 | 0.04 |
| `not_null_mart_category_price_index_avg_unit_price` | pass | 0 | 0.045 |
| `not_null_mart_category_price_index_category` | pass | 0 | 0.041 |
| `not_null_mart_category_price_index_price_month` | pass | 0 | 0.048 |
| `not_null_mart_category_price_index_size_unit` | pass | 0 | 0.048 |
| `not_null_mart_monthly_spend_category` | pass | 0 | 0.048 |
| `not_null_mart_monthly_spend_spend_month` | pass | 0 | 0.059 |
| `not_null_mart_monthly_spend_total_spend_bdt` | pass | 0 | 0.057 |
| `not_null_mart_monthly_spend_user_id` | pass | 0 | 0.051 |
| `relationships_fact_consumption_cycle_product_id__product_id__ref_dim_product_` | pass | 0 | 0.086 |
| `relationships_fact_consumption_cycle_purchase_id__purchase_id__ref_fact_purchase_` | pass | 0 | 0.072 |
| `relationships_fact_purchase_product_id__product_id__ref_dim_product_` | pass | 0 | 0.087 |
| `relationships_fact_purchase_purchase_date__date_day__ref_dim_date_` | pass | 0 | 0.074 |
| `relationships_fact_purchase_vendor_key__vendor_key__ref_dim_vendor_` | pass | 0 | 0.067 |
| `unique_dim_date_date_day` | pass | 0 | 0.059 |
| `unique_dim_product_product_id` | pass | 0 | 0.054 |
| `unique_dim_vendor_vendor_key` | pass | 0 | 0.054 |
| `unique_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.048 |
| `unique_fact_purchase_purchase_id` | pass | 0 | 0.039 |
| `warn_duplicate_purchases_deduped` | warn | 1 | 0.038 |
| `warn_duration_outliers_detected` | warn | 1 | 0.028 |
| `warn_zero_day_cycles_detected` | warn | 1 | 0.02 |
