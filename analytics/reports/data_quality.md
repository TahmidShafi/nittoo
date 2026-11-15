# Nittoo Forecast Lab — Data Quality Report

Generated at: `2026-11-15T13:17:16+00:00`  
Scale: `500 households x 24 months` | Seed: `2027` | Git commit: `7f6d76e`  
Dataset: **SYNTHETIC** household consumption & pricing simulation.

## 1. Row Counts per Layer

| Layer | Table / View | Row Count |
| :--- | :--- | ---: |
| `raw` | `products` | 4,492 |
| `raw` | `purchases` | 62,338 |
| `raw` | `rejects` | 258 |
| `raw` | `restock_plans` | 913 |
| `raw` | `usage_periods` | 61,175 |
| `staging` | `stg_products` | 4,492 |
| `staging` | `stg_purchase_duplicates` | 326 |
| `staging` | `stg_purchases` | 62,012 |
| `staging` | `stg_restock_plans` | 913 |
| `staging` | `stg_usage_periods` | 61,175 |
| `intermediate` | `int_cycle_quality` | 61,175 |
| `intermediate` | `int_purchase_unit_prices` | 62,012 |
| `intermediate` | `int_usage_enriched` | 61,175 |
| `marts` | `dim_date` | 978 |
| `marts` | `dim_product` | 4,492 |
| `marts` | `dim_vendor` | 9 |
| `marts` | `fact_consumption_cycle` | 61,175 |
| `marts` | `fact_purchase` | 62,012 |
| `marts` | `mart_category_price_index` | 475 |
| `marts` | `mart_monthly_spend` | 48,884 |

## 2. Ingestion Rejects by Reason Code

Total quarantined records: **258**

| Reason Code | Count |
| :--- | ---: |
| `FINISHED_BEFORE_OPENED` | 258 |

## 3. Fault-Detection Precision, Recall & F1 (Record-Level)

> **Note:** The four rule-based fault types (`finished_before_opened`, `zero_day_cycle`, `outlier_1000_day`, `duplicate_purchase`) are detected by deterministic rules matching their injection definitions, so 100% is expected. The **`subtle_duration_outlier`** detector is the real statistical test.

| Fault Type | Injected | TP | FP | FN | Precision (%) | Recall (%) | F1 (%) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `finished_before_opened` | 258 | 258 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `zero_day_cycle` | 265 | 265 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `outlier_1000_day` | 274 | 274 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `subtle_duration_outlier` | 287 | 285 | 12 | 2 | 96.0% | 99.3% | 97.6% |
| `duplicate_purchase` | 326 | 326 | 0 | 0 | 100.0% | 100.0% | 100.0% |

- **Clean-cycle false-positive rate (FPR):** 12 / 56,527 (0.02%)

### 3.1 Subtle-Outlier Evaluation Summary (Dev vs Seen vs Fresh Holdout)

| Dataset (`500 × 24`) | Role | Precision | Recall | F1 | Clean-Cycle FPR |
| :--- | :--- | ---: | ---: | ---: | ---: |
| Seed `7` | Dev (Iteration 2, tuned here) | 96.1% | 99.4% | 97.7% | 0.02% (13 / 57,658) |
| Seed `42` | Iteration 1 (already seen, pre-`product.size` fix) | 9.9% | 71.6% | 17.4% | 3.12% (1,770 / 56,812) |
| Seed `2027` | Fresh Holdout (Iteration 2, frozen) | 96.0% | 99.3% | 97.6% | 0.02% (12 / 56,527) |

- **Exclusion decision (`RATE_OUTLIER_MIN_PRECISION_TO_EXCLUDE = 50.0%`):** Holdout precision (`96.0%`) >= `50.0%`, so `is_rate_outlier` **excludes** flagged cycles from `is_valid_for_forecasting` (not advisory-only).

## 4. dbt Test Summary

- **Total tests:** 41
- **Passed:** 38
- **Warned:** 3
- **Failed:** 0

| Test | Status | Failures | Time (s) |
| :--- | :---: | ---: | ---: |
| `assert_consumption_rate_plausible` | pass | 0 | 0.091 |
| `assert_finished_after_opened` | pass | 0 | 0.093 |
| `accepted_values_dim_product_size_unit__ml__g__count` | pass | 0 | 0.095 |
| `accepted_values_fact_consumption_cycle_status__completed__active` | pass | 0 | 0.095 |
| `not_null_dim_date_date_day` | pass | 0 | 0.048 |
| `assert_no_zero_day_cycles_in_marts` | pass | 0 | 0.053 |
| `not_null_dim_product_category` | pass | 0 | 0.047 |
| `not_null_dim_product_product_id` | pass | 0 | 0.048 |
| `not_null_dim_vendor_vendor_key` | pass | 0 | 0.05 |
| `not_null_dim_product_user_id` | pass | 0 | 0.052 |
| `not_null_fact_consumption_cycle_product_id` | pass | 0 | 0.047 |
| `not_null_dim_vendor_vendor_name` | pass | 0 | 0.048 |
| `not_null_fact_consumption_cycle_purchase_id` | pass | 0 | 0.055 |
| `not_null_fact_consumption_cycle_status` | pass | 0 | 0.061 |
| `not_null_fact_purchase_price` | pass | 0 | 0.062 |
| `not_null_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.065 |
| `not_null_fact_purchase_product_id` | pass | 0 | 0.057 |
| `not_null_fact_purchase_purchase_date` | pass | 0 | 0.059 |
| `not_null_fact_purchase_purchase_id` | pass | 0 | 0.05 |
| `not_null_fact_purchase_vendor_key` | pass | 0 | 0.052 |
| `not_null_mart_category_price_index_avg_unit_price` | pass | 0 | 0.056 |
| `not_null_mart_category_price_index_category` | pass | 0 | 0.055 |
| `not_null_mart_category_price_index_price_month` | pass | 0 | 0.056 |
| `not_null_mart_category_price_index_size_unit` | pass | 0 | 0.051 |
| `not_null_mart_monthly_spend_category` | pass | 0 | 0.057 |
| `not_null_mart_monthly_spend_spend_month` | pass | 0 | 0.061 |
| `not_null_mart_monthly_spend_total_spend_bdt` | pass | 0 | 0.061 |
| `not_null_mart_monthly_spend_user_id` | pass | 0 | 0.062 |
| `relationships_fact_consumption_cycle_product_id__product_id__ref_dim_product_` | pass | 0 | 0.086 |
| `relationships_fact_purchase_purchase_date__date_day__ref_dim_date_` | pass | 0 | 0.068 |
| `relationships_fact_purchase_product_id__product_id__ref_dim_product_` | pass | 0 | 0.069 |
| `relationships_fact_consumption_cycle_purchase_id__purchase_id__ref_fact_purchase_` | pass | 0 | 0.087 |
| `relationships_fact_purchase_vendor_key__vendor_key__ref_dim_vendor_` | pass | 0 | 0.064 |
| `unique_dim_date_date_day` | pass | 0 | 0.055 |
| `unique_dim_vendor_vendor_key` | pass | 0 | 0.051 |
| `unique_dim_product_product_id` | pass | 0 | 0.068 |
| `unique_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.06 |
| `unique_fact_purchase_purchase_id` | pass | 0 | 0.054 |
| `warn_duration_outliers_detected` | warn | 571 | 0.046 |
| `warn_duplicate_purchases_deduped` | warn | 326 | 0.056 |
| `warn_zero_day_cycles_detected` | warn | 265 | 0.032 |
