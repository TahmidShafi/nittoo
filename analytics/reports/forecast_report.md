# Nittoo Forecast Lab — Rolling-Origin Backtest Report

Generated at: `2026-11-15T14:07:52+00:00`  
Scale: `500 households x 24 months` | Seed: `4001 (holdout) / 7 (dev) / 4002 (2.5x noise) / 4003 (eps=0.3) / 4004 (eps=0.6)` | Git commit: `0728b1e`  
Config: `MIN_TRAIN_CYCLES=2`, `EWMA_DURATION_ALPHA=0.85`, `EWMA_RATE_ALPHA=0.25`, `BONFERRONI_CI=99.58%` (`m=12`).

## 1. Selection Rule & Primary Comparison (Rule-Clean Next Cycles)

Selection metric: MAE on rule-clean next cycles (`n=48,169`, excluding only target `is_zero_day` and `duration_days >= 1000`). Winner requires lowest MAE AND household-clustered 99.58% Bonferroni CI of `(baseline(none) MAE - candidate MAE)` strictly `> 0`.

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 17.42 | 8.00 | 39.6% | -0.99 | 80.3% | 46.8 |
| `baseline` | `rule_only` | 12.71 | 7.00 | 25.1% | -6.08 | 81.2% | 39.6 |
| `baseline` | `rule_plus_rate_outlier` | 12.57 | 7.00 | 24.7% | -6.35 | 81.1% | 39.1 |
| `median_duration` | `rule_only` | 12.88 | 5.00 | 23.9% | -7.94 | 81.4% | 44.0 |
| `median_duration` | `rule_plus_rate_outlier` | 12.87 | 5.00 | 23.9% | -7.96 | 81.4% | 44.0 |
| `ewma_duration` | `rule_only` | 9.78 | 4.00 | 20.4% | -1.95 | 80.7% | 26.0 |
| `ewma_duration` | `rule_plus_rate_outlier` | 9.42 | 4.00 | 19.5% | -2.26 | 81.0% | 25.4 |
| `rate_mean` | `rule_only` | 4.53 | 3.00 | 9.4% | -0.93 | 83.7% | 12.8 |
| `rate_mean` | `rule_plus_rate_outlier` | 4.37 | 3.00 | 9.0% | -0.84 | 83.9% | 12.4 |
| `rate_median` | `rule_only` | 4.46 | 3.00 | 9.2% | -0.76 | 83.8% | 12.7 |
| `rate_median` | `rule_plus_rate_outlier` | 4.45 | 3.00 | 9.2% | -0.76 | 83.8% | 12.7 |
| `rate_ewma` | `rule_only` | 4.63 | 3.00 | 9.6% | -0.81 | 83.9% | 13.1 |
| `rate_ewma` | `rule_plus_rate_outlier` | 4.46 | 3.00 | 9.2% | -0.74 | 83.8% | 12.7 |

**Mechanical Selection Outcome:** **`rate_mean (rule_plus_rate_outlier)`**

### 1.1 Household-Clustered Bonferroni Bootstrap CIs vs `baseline (none)`

| Candidate Method | Variant | MAE Improvement (d) | 99.58% CI | Qualifies? |
| :--- | :--- | ---: | :---: | :---: |
| `baseline` | `rule_only` | +4.704 | `[+3.641, +6.030]` | YES |
| `baseline` | `rule_plus_rate_outlier` | +4.847 | `[+3.796, +6.182]` | YES |
| `median_duration` | `rule_only` | +4.538 | `[+3.516, +5.888]` | YES |
| `median_duration` | `rule_plus_rate_outlier` | +4.544 | `[+3.529, +5.897]` | YES |
| `ewma_duration` | `rule_only` | +7.639 | `[+6.553, +8.910]` | YES |
| `ewma_duration` | `rule_plus_rate_outlier` | +7.997 | `[+6.946, +9.279]` | YES |
| `rate_mean` | `rule_only` | +12.882 | `[+11.750, +14.159]` | YES |
| `rate_mean` | `rule_plus_rate_outlier` | +13.046 | `[+11.905, +14.319]` | YES |
| `rate_median` | `rule_only` | +12.958 | `[+11.817, +14.229]` | YES |
| `rate_median` | `rule_plus_rate_outlier` | +12.963 | `[+11.823, +14.234]` | YES |
| `rate_ewma` | `rule_only` | +12.790 | `[+11.668, +14.083]` | YES |
| `rate_ewma` | `rule_plus_rate_outlier` | +12.960 | `[+11.824, +14.242]` | YES |

## 2. Secondary Views (All Next Cycles & Oracle-Clean)

### 2.1 All Next Cycles (`n=48,641`)

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 22.00 | 8.00 | 39.8% | -5.26 | 79.5% | 46.8 |
| `baseline` | `rule_only` | 17.35 | 7.00 | 25.4% | -10.37 | 80.4% | 39.6 |
| `baseline` | `rule_plus_rate_outlier` | 17.21 | 7.00 | 25.0% | -10.64 | 80.3% | 39.1 |
| `median_duration` | `rule_only` | 17.52 | 5.00 | 24.2% | -12.23 | 80.6% | 44.0 |
| `median_duration` | `rule_plus_rate_outlier` | 17.51 | 5.00 | 24.2% | -12.25 | 80.6% | 44.0 |
| `ewma_duration` | `rule_only` | 14.44 | 4.00 | 20.7% | -6.24 | 80.0% | 26.0 |
| `ewma_duration` | `rule_plus_rate_outlier` | 14.09 | 4.00 | 19.9% | -6.55 | 80.3% | 25.4 |
| `rate_mean` | `rule_only` | 9.26 | 3.00 | 9.8% | -5.23 | 82.8% | 12.8 |
| `rate_mean` | `rule_plus_rate_outlier` | 9.10 | 3.00 | 9.4% | -5.14 | 83.0% | 12.4 |
| `rate_median` | `rule_only` | 9.19 | 3.00 | 9.6% | -5.06 | 83.0% | 12.7 |
| `rate_median` | `rule_plus_rate_outlier` | 9.18 | 3.00 | 9.6% | -5.06 | 83.0% | 12.7 |
| `rate_ewma` | `rule_only` | 9.35 | 3.00 | 10.0% | -5.11 | 83.1% | 13.1 |
| `rate_ewma` | `rule_plus_rate_outlier` | 9.18 | 3.00 | 9.6% | -5.04 | 83.0% | 12.7 |

### 2.2 Oracle-Clean View (`n=47,921`, manifest faults removed — reporting only, never used for selection)

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 17.00 | 8.00 | 38.9% | -0.64 | 80.7% | 46.8 |
| `baseline` | `rule_only` | 12.27 | 7.00 | 24.4% | -5.73 | 81.6% | 39.6 |
| `baseline` | `rule_plus_rate_outlier` | 12.12 | 7.00 | 24.0% | -6.00 | 81.5% | 39.1 |
| `median_duration` | `rule_only` | 12.43 | 5.00 | 23.2% | -7.59 | 81.8% | 44.0 |
| `median_duration` | `rule_plus_rate_outlier` | 12.43 | 5.00 | 23.2% | -7.61 | 81.8% | 44.0 |
| `ewma_duration` | `rule_only` | 9.32 | 4.00 | 19.6% | -1.60 | 81.1% | 26.0 |
| `ewma_duration` | `rule_plus_rate_outlier` | 8.96 | 4.00 | 18.8% | -1.91 | 81.5% | 25.4 |
| `rate_mean` | `rule_only` | 4.05 | 3.00 | 8.6% | -0.58 | 84.1% | 12.8 |
| `rate_mean` | `rule_plus_rate_outlier` | 3.88 | 3.00 | 8.2% | -0.49 | 84.3% | 12.4 |
| `rate_median` | `rule_only` | 3.97 | 3.00 | 8.4% | -0.41 | 84.2% | 12.7 |
| `rate_median` | `rule_plus_rate_outlier` | 3.97 | 3.00 | 8.4% | -0.42 | 84.2% | 12.7 |
| `rate_ewma` | `rule_only` | 4.14 | 3.00 | 8.8% | -0.46 | 84.3% | 13.1 |
| `rate_ewma` | `rule_plus_rate_outlier` | 3.97 | 3.00 | 8.4% | -0.40 | 84.3% | 12.7 |

## 3. Breakdowns (Rule-Clean Next Cycles)

### 3.1 By History Length `k` (with Calibrated P10-P90 Coverage & Width)

| History `k` | Method | Variant | `n` | MAE (d) | Cov (%) | Width (d) |
| :---: | :--- | :--- | ---: | ---: | ---: | ---: |
| `2` | `baseline` | `none` | 4,136 | 19.36 | 79.6% | 45.1 |
| `2` | `baseline` | `rule_only` | 4,136 | 12.54 | 80.2% | 37.3 |
| `2` | `rate_mean` | `rule_plus_rate_outlier` | 4,136 | 6.13 | 82.7% | 16.3 |
| `3-4` | `baseline` | `none` | 8,011 | 19.13 | 80.1% | 46.5 |
| `3-4` | `baseline` | `rule_only` | 8,011 | 13.38 | 80.9% | 40.3 |
| `3-4` | `rate_mean` | `rule_plus_rate_outlier` | 8,011 | 5.30 | 84.3% | 15.6 |
| `5+` | `baseline` | `none` | 36,022 | 16.81 | 80.4% | 47.1 |
| `5+` | `baseline` | `rule_only` | 36,022 | 12.58 | 81.4% | 39.7 |
| `5+` | `rate_mean` | `rule_plus_rate_outlier` | 36,022 | 3.96 | 83.9% | 11.2 |

### 3.2 By Pack-Size Switch (`size_changed_from_previous`)

| Size Changed? | Method | Variant | `n` | MAE (d) | Bias (d) |
| :---: | :--- | :--- | ---: | ---: | ---: |
| `False` | `baseline` | `none` | 40,855 | 15.08 | +0.60 |
| `False` | `baseline` | `rule_only` | 40,855 | 10.29 | -4.43 |
| `False` | `rate_mean` | `rule_plus_rate_outlier` | 40,855 | 4.22 | -0.83 |
| `True` | `baseline` | `none` | 7,314 | 30.46 | -9.85 |
| `True` | `baseline` | `rule_only` | 7,314 | 26.22 | -15.29 |
| `True` | `rate_mean` | `rule_plus_rate_outlier` | 7,314 | 5.20 | -0.90 |

### 3.3 By Category

| Category | `baseline (none)` MAE | `baseline (rule_only)` MAE | `rate_mean (rule_plus_rate_outlier)` MAE |
| :--- | ---: | ---: | ---: |
| Baby Care | 7.67 | 3.17 | 1.10 |
| Body Care | 18.01 | 13.01 | 4.96 |
| Fitness | 19.02 | 14.92 | 3.58 |
| Food & Beverage | 17.51 | 13.71 | 4.75 |
| Haircare | 19.42 | 16.14 | 5.02 |
| Home Essentials | 12.80 | 10.13 | 3.36 |
| Household Cleaning | 20.45 | 12.45 | 4.92 |
| Laundry | 18.61 | 13.77 | 3.65 |
| Oral Care | 14.88 | 10.08 | 3.50 |
| Personal Hygiene | 18.10 | 12.94 | 4.57 |
| Shaving & Grooming | 21.70 | 15.80 | 5.82 |
| Skincare | 20.61 | 16.19 | 5.89 |
| Supplements | 17.72 | 15.13 | 6.97 |

## 4. Dev vs Holdout vs High-Noise (`2.5x`) Comparison (Rule-Clean MAE)

| Method | Variant | Dev (seed=7) | Holdout (seed=4001, eps=0.0) | High-Noise 2.5x (seed=4002) |
| :--- | :--- | ---: | ---: | ---: |
| `baseline` | `none` | 16.70 | 17.42 | 19.62 |
| `baseline` | `rule_only` | 12.42 | 12.71 | 15.16 |
| `baseline` | `rule_plus_rate_outlier` | 12.26 | 12.57 | 15.10 |
| `median_duration` | `rule_only` | 12.59 | 12.88 | 15.60 |
| `median_duration` | `rule_plus_rate_outlier` | 12.58 | 12.87 | 15.60 |
| `ewma_duration` | `rule_only` | 9.52 | 9.78 | 14.74 |
| `ewma_duration` | `rule_plus_rate_outlier` | 9.17 | 9.42 | 14.55 |
| `rate_mean` | `rule_only` | 4.46 | 4.53 | 9.28 |
| `rate_mean` | `rule_plus_rate_outlier` | 4.28 | 4.37 | 9.22 |
| `rate_median` | `rule_only` | 4.38 | 4.46 | 9.36 |
| `rate_median` | `rule_plus_rate_outlier` | 4.37 | 4.45 | 9.37 |
| `rate_ewma` | `rule_only` | 4.55 | 4.63 | 9.50 |
| `rate_ewma` | `rule_plus_rate_outlier` | 4.37 | 4.46 | 9.43 |

## 5. Size-History Decomposition (Primary Rule-Clean Targets)

- **Group (a) `constant_size`** (no switch in `1..k` and `k+1` equals history size): `16,613` targets (`34.5%`)
- **Group (b) `any_size_change`** (at least one switch in `1..k` or `k+1`): `31,556` targets (`65.5%`)
- **Purchase size overrides (`raw.purchases.size_value IS NOT NULL`):** `23,622 / 62,533` (`37.8%`)
- **Products with >= 1 size switch:** `3,728 / 4,483` (`83.2%`)

| Method | Variant | (a) Constant Size MAE (d) | (b) Any Size Change MAE (d) |
| :--- | :--- | ---: | ---: |
| `baseline` | `none` | 9.48 | 21.59 |
| `baseline` | `rule_only` | 4.02 | 17.29 |
| `baseline` | `rule_plus_rate_outlier` | 3.81 | 17.18 |
| `median_duration` | `rule_only` | 3.86 | 17.62 |
| `median_duration` | `rule_plus_rate_outlier` | 3.86 | 17.62 |
| `ewma_duration` | `rule_only` | 4.46 | 12.58 |
| `ewma_duration` | `rule_plus_rate_outlier` | 4.17 | 12.18 |
| `rate_mean` | `rule_only` | 3.88 | 4.88 |
| `rate_mean` | `rule_plus_rate_outlier` | 3.76 | 4.69 |
| `rate_median` | `rule_only` | 3.84 | 4.78 |
| `rate_median` | `rule_plus_rate_outlier` | 3.83 | 4.78 |
| `rate_ewma` | `rule_only` | 3.94 | 4.98 |
| `rate_ewma` | `rule_plus_rate_outlier` | 3.83 | 4.78 |

## 6. Pack-Size Elasticity Robustness (`rate proportional to size^eps`, 500 x 24)

Evaluation-only stress test with frozen config (no re-selection).

| Method | Variant | Holdout (seed=4001, eps=0.0) | Elasticity eps=0.3 (seed=4003) | Elasticity eps=0.6 (seed=4004) |
| :--- | :--- | ---: | ---: | ---: |
| `baseline` | `none` | 17.42 | 13.20 | 10.96 |
| `baseline` | `rule_only` | 12.71 | 8.83 | 5.62 |
| `baseline` | `rule_plus_rate_outlier` | 12.57 | 8.72 | 5.55 |
| `median_duration` | `rule_only` | 12.88 | 8.96 | 5.65 |
| `median_duration` | `rule_plus_rate_outlier` | 12.87 | 8.96 | 5.67 |
| `ewma_duration` | `rule_only` | 9.78 | 7.39 | 5.34 |
| `ewma_duration` | `rule_plus_rate_outlier` | 9.42 | 7.11 | 5.34 |
| `rate_mean` | `rule_only` | 4.53 | 5.84 | 7.91 |
| `rate_mean` | `rule_plus_rate_outlier` | 4.37 | 5.76 | 8.36 |
| `rate_median` | `rule_only` | 4.46 | 6.01 | 8.61 |
| `rate_median` | `rule_plus_rate_outlier` | 4.45 | 6.01 | 8.73 |
| `rate_ewma` | `rule_only` | 4.63 | 5.70 | 7.26 |
| `rate_ewma` | `rule_plus_rate_outlier` | 4.46 | 5.60 | 7.92 |

## 7. Why `EWMA_DURATION_ALPHA = 0.85` Is High

Comparison of `ewma_duration (rule_only)` at `alpha=0.25` vs `alpha=0.85` against `baseline (rule_only)` on rule-clean targets:

| History Group | `baseline (rule_only)` MAE | `ewma (alpha=0.25)` MAE | `ewma (alpha=0.85)` MAE |
| :--- | ---: | ---: | ---: |
| `constant_size` | 4.02 | 4.09 | 4.46 |
| `any_size_change` | 17.29 | 16.14 | 12.58 |

## 8. Plain-English Summary

- **Data cleaning vs method choice:** `baseline (none)` vs `baseline (rule_only)` separates outlier removal from forecasting (`17.42` d vs `12.71` d).
- **Winner (`rate_mean (rule_plus_rate_outlier)`):** achieves `4.37` d MAE (vs `17.42` d for the current app baseline).
- **Where the baseline wins / matches:** when pack size does **not** change (`size_changed_from_previous=False`), `baseline (none)` (`15.08` d) is close to `rate_mean` (`4.22` d); on pack-size switches (`size_changed_from_previous=True`), `baseline (none)` degrades to `30.46` d while size-normalized `rate_mean` stays at `5.20` d.

## 9. Limitations

- **Synthetic data assumption:** These results come from a synthetic generator whose baseline (`eps=0.0`) assumes a stable per-household daily consumption rate independent of pack size — the exact property that rate-based methods exploit. The magnitude of the improvement on real Nittoo user histories is therefore unknown.
- **Sensitivity to pack-size elasticity:** When consumption scales with pack size (`eps=0.3` and `eps=0.6` in Section 6), rate-based MAE degrades substantially because a constant daily rate no longer transfers across pack sizes.
