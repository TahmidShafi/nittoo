# Nittoo Forecast Lab — Data Quality Report

Generated at: `2026-11-15T11:16:26+00:00`  
Scale: `500 households x 24 months` | Seed: `42` | Git commit: `5efd3e9`  
Dataset: **SYNTHETIC** household consumption & pricing simulation.

## 1. Row Counts per Layer

| Layer | Table / View | Row Count |
| :--- | :--- | ---: |
| `raw` | `products` | 4,538 |
| `raw` | `purchases` | 62,835 |
| `raw` | `rejects` | 278 |
| `raw` | `restock_plans` | 973 |
| `raw` | `usage_periods` | 61,691 |
| `staging` | `stg_products` | 4,538 |
| `staging` | `stg_purchase_duplicates` | 286 |
| `staging` | `stg_purchases` | 62,549 |
| `staging` | `stg_restock_plans` | 973 |
| `staging` | `stg_usage_periods` | 61,691 |
| `intermediate` | `int_cycle_quality` | 61,691 |
| `intermediate` | `int_purchase_unit_prices` | 62,549 |
| `intermediate` | `int_usage_enriched` | 61,691 |
| `marts` | `dim_date` | 969 |
| `marts` | `dim_product` | 4,538 |
| `marts` | `dim_vendor` | 9 |
| `marts` | `fact_consumption_cycle` | 61,691 |
| `marts` | `fact_purchase` | 62,549 |
| `marts` | `mart_category_price_index` | 475 |
| `marts` | `mart_monthly_spend` | 49,364 |

## 2. Ingestion Rejects by Reason Code

Total quarantined records: **278**

| Reason Code | Count |
| :--- | ---: |
| `FINISHED_BEFORE_OPENED` | 278 |

## 3. Fault-Detection Recall (Ground Truth vs Detected)

| Fault Type | Injected | Rejected at Contract | Flagged in dbt | Recall (%) |
| :--- | ---: | ---: | ---: | ---: |
| `finished_before_opened` | 278 | 278 | 0 | 100.0% |
| `zero_day_cycle` | 322 | 0 | 322 | 100.0% |
| `outlier_1000_day` | 299 | 0 | 2,066 | 100.0% |
| `duplicate_purchase` | 286 | 0 | 286 | 100.0% |

## 4. dbt Test Summary

- **Total tests:** 41
- **Passed:** 38
- **Warned:** 3
- **Failed:** 0

| Test | Status | Failures | Time (s) |
| :--- | :---: | ---: | ---: |
| `accepted_values_dim_product_size_unit__ml__g__count` | pass | 0 | 0.069 |
| `assert_consumption_rate_plausible` | pass | 0 | 0.069 |
| `assert_finished_after_opened` | pass | 0 | 0.071 |
| `accepted_values_fact_consumption_cycle_status__completed__active` | pass | 0 | 0.072 |
| `assert_no_zero_day_cycles_in_marts` | pass | 0 | 0.04 |
| `not_null_dim_date_date_day` | pass | 0 | 0.04 |
| `not_null_dim_product_category` | pass | 0 | 0.04 |
| `not_null_dim_product_product_id` | pass | 0 | 0.035 |
| `not_null_dim_product_user_id` | pass | 0 | 0.043 |
| `not_null_dim_vendor_vendor_key` | pass | 0 | 0.043 |
| `not_null_dim_vendor_vendor_name` | pass | 0 | 0.038 |
| `not_null_fact_consumption_cycle_product_id` | pass | 0 | 0.038 |
| `not_null_fact_consumption_cycle_purchase_id` | pass | 0 | 0.04 |
| `not_null_fact_consumption_cycle_status` | pass | 0 | 0.041 |
| `not_null_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.042 |
| `not_null_fact_purchase_price` | pass | 0 | 0.042 |
| `not_null_fact_purchase_product_id` | pass | 0 | 0.042 |
| `not_null_fact_purchase_purchase_date` | pass | 0 | 0.043 |
| `not_null_fact_purchase_vendor_key` | pass | 0 | 0.033 |
| `not_null_fact_purchase_purchase_id` | pass | 0 | 0.043 |
| `not_null_mart_category_price_index_avg_unit_price` | pass | 0 | 0.042 |
| `not_null_mart_category_price_index_price_month` | pass | 0 | 0.041 |
| `not_null_mart_category_price_index_category` | pass | 0 | 0.042 |
| `not_null_mart_category_price_index_size_unit` | pass | 0 | 0.038 |
| `not_null_mart_monthly_spend_category` | pass | 0 | 0.044 |
| `not_null_mart_monthly_spend_spend_month` | pass | 0 | 0.044 |
| `not_null_mart_monthly_spend_user_id` | pass | 0 | 0.039 |
| `not_null_mart_monthly_spend_total_spend_bdt` | pass | 0 | 0.04 |
| `relationships_fact_consumption_cycle_product_id__product_id__ref_dim_product_` | pass | 0 | 0.066 |
| `relationships_fact_purchase_purchase_date__date_day__ref_dim_date_` | pass | 0 | 0.054 |
| `relationships_fact_purchase_product_id__product_id__ref_dim_product_` | pass | 0 | 0.067 |
| `relationships_fact_consumption_cycle_purchase_id__purchase_id__ref_fact_purchase_` | pass | 0 | 0.073 |
| `relationships_fact_purchase_vendor_key__vendor_key__ref_dim_vendor_` | pass | 0 | 0.059 |
| `unique_dim_date_date_day` | pass | 0 | 0.043 |
| `unique_dim_vendor_vendor_key` | pass | 0 | 0.042 |
| `unique_dim_product_product_id` | pass | 0 | 0.045 |
| `warn_duration_outliers_detected` | warn | 2066 | 0.023 |
| `unique_fact_consumption_cycle_usage_period_id` | pass | 0 | 0.057 |
| `unique_fact_purchase_purchase_id` | pass | 0 | 0.047 |
| `warn_duplicate_purchases_deduped` | warn | 286 | 0.048 |
| `warn_zero_day_cycles_detected` | warn | 322 | 0.022 |
