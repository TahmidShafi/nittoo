# Nittoo Forecast Lab — Data Quality Report

Generated at: `2026-11-15T13:01:44+00:00`  
Scale: `500 households x 24 months` | Seed: `42` | Git commit: `fe86edf`  
Dataset: **SYNTHETIC** household consumption & pricing simulation.

## 1. Row Counts per Layer

| Layer | Table / View | Row Count |
| :--- | :--- | ---: |
| `raw` | `products` | 4,464 |
| `raw` | `purchases` | 62,666 |
| `raw` | `rejects` | 310 |
| `raw` | `restock_plans` | 954 |
| `raw` | `usage_periods` | 61,491 |
| `staging` | `stg_products` | 4,464 |
| `staging` | `stg_purchase_duplicates` | 300 |
| `staging` | `stg_purchases` | 62,366 |
| `staging` | `stg_restock_plans` | 954 |
| `staging` | `stg_usage_periods` | 61,491 |
| `intermediate` | `int_cycle_quality` | 61,491 |
| `intermediate` | `int_purchase_unit_prices` | 62,366 |
| `intermediate` | `int_usage_enriched` | 61,491 |
| `marts` | `dim_date` | 985 |
| `marts` | `dim_product` | 4,464 |
| `marts` | `dim_vendor` | 9 |
| `marts` | `fact_consumption_cycle` | 61,491 |
| `marts` | `fact_purchase` | 62,366 |
| `marts` | `mart_category_price_index` | 475 |
| `marts` | `mart_monthly_spend` | 49,273 |

## 2. Ingestion Rejects by Reason Code

Total quarantined records: **310**

| Reason Code | Count |
| :--- | ---: |
| `FINISHED_BEFORE_OPENED` | 310 |

## 3. Fault-Detection Precision, Recall & F1 (Record-Level)

| Fault Type | Injected | TP | FP | FN | Precision (%) | Recall (%) | F1 (%) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `finished_before_opened` | 310 | 310 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `zero_day_cycle` | 282 | 282 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `outlier_1000_day` | 295 | 295 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `subtle_duration_outlier` | 271 | 194 | 1,770 | 77 | 9.9% | 71.6% | 17.4% |
| `duplicate_purchase` | 300 | 300 | 0 | 0 | 100.0% | 100.0% | 100.0% |

- **Clean-cycle false-positive rate (FPR):** 1,770 / 56,812 (3.12%)

## 4. dbt Test Summary

- **Total tests:** 41
- **Passed:** 38
- **Warned:** 3
- **Failed:** 0

| Test | Status | Failures | Time (s) |
| :--- | :---: | ---: | ---: |
| `accepted_values_dim_product_size_unit__ml__g__count` | pass | 0 | 0.075 |
| `accepted_values_fact_consumption_cycle_status__completed__active` | pass | 0 | 0.076 |
| `assert_finished_after_opened` | pass | 0 | 0.076 |
| `assert_consumption_rate_plausible` | pass | 0 | 0.077 |
| `not_null_dim_product_category` | pass | 0 | 0.043 |
| `assert_no_zero_day_cycles_in_marts` | pass | 0 | 0.045 |
| `not_null_dim_product_product_id` | pass | 0 | 0.043 |
| `not_null_dim_date_date_day` | pass | 0 | 0.046 |
| `not_null_dim_product_user_id` | pass | 0 | 0.043 |
| `not_null_dim_vendor_vendor_key` | pass | 0 | 0.044 |
| `not_null_dim_vendor_vendor_name` | pass | 0 | 0.04 |
| `not_null_fact_consumption_cycle_product_id` | pass | 0 | 0.041 |
| `not_null_fact_consumption_cycle_purchase_id` | pass | 0 | 0.051 |
| `not_null_fact_purchase_price` | pass | 0 | 0.04 |
| `not_null_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.042 |
| `not_null_fact_consumption_cycle_status` | pass | 0 | 0.043 |
| `not_null_fact_purchase_product_id` | pass | 0 | 0.047 |
| `not_null_fact_purchase_purchase_date` | pass | 0 | 0.048 |
| `not_null_fact_purchase_purchase_id` | pass | 0 | 0.049 |
| `not_null_fact_purchase_vendor_key` | pass | 0 | 0.051 |
| `not_null_mart_category_price_index_avg_unit_price` | pass | 0 | 0.049 |
| `not_null_mart_category_price_index_price_month` | pass | 0 | 0.044 |
| `not_null_mart_category_price_index_category` | pass | 0 | 0.052 |
| `not_null_mart_category_price_index_size_unit` | pass | 0 | 0.039 |
| `not_null_mart_monthly_spend_category` | pass | 0 | 0.05 |
| `not_null_mart_monthly_spend_user_id` | pass | 0 | 0.042 |
| `not_null_mart_monthly_spend_spend_month` | pass | 0 | 0.051 |
| `not_null_mart_monthly_spend_total_spend_bdt` | pass | 0 | 0.054 |
| `relationships_fact_consumption_cycle_product_id__product_id__ref_dim_product_` | pass | 0 | 0.077 |
| `relationships_fact_purchase_purchase_date__date_day__ref_dim_date_` | pass | 0 | 0.041 |
| `relationships_fact_purchase_product_id__product_id__ref_dim_product_` | pass | 0 | 0.054 |
| `relationships_fact_consumption_cycle_purchase_id__purchase_id__ref_fact_purchase_` | pass | 0 | 0.104 |
| `unique_dim_date_date_day` | pass | 0 | 0.056 |
| `relationships_fact_purchase_vendor_key__vendor_key__ref_dim_vendor_` | pass | 0 | 0.063 |
| `unique_dim_product_product_id` | pass | 0 | 0.049 |
| `unique_dim_vendor_vendor_key` | pass | 0 | 0.039 |
| `warn_duration_outliers_detected` | warn | 2259 | 0.024 |
| `unique_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.053 |
| `unique_fact_purchase_purchase_id` | pass | 0 | 0.058 |
| `warn_duplicate_purchases_deduped` | warn | 300 | 0.053 |
| `warn_zero_day_cycles_detected` | warn | 282 | 0.027 |
