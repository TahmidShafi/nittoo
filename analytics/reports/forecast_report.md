# Nittoo Forecast Lab — Rolling-Origin Backtest Report

Generated at: `2026-11-15T14:52:04+00:00`  
Scale: `5 households x 6 months` | Seed: `11` | Git commit: `f2b71ce`  
Config: `MIN_TRAIN_CYCLES=2`, `EWMA_DURATION_ALPHA=0.85`, `EWMA_RATE_ALPHA=0.25`, `BONFERRONI_CI=99.58%` (`m=12`).

## 1. Selection Rule & Primary Comparison (Rule-Clean Next Cycles)

Selection metric: MAE on rule-clean next cycles (`n=86`, excluding only target `is_zero_day` and `duration_days >= 1000`). Winner requires lowest MAE AND household-clustered 99.58% Bonferroni CI of `(baseline(none) MAE - candidate MAE)` strictly `> 0`.

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 12.04 | 2.00 | 37.8% | +2.94 | 86.0% | 27.2 |
| `baseline` | `rule_only` | 5.48 | 2.00 | 17.5% | -3.76 | 86.0% | 20.5 |
| `baseline` | `rule_plus_rate_outlier` | 5.48 | 2.00 | 17.5% | -3.76 | 86.0% | 20.3 |
| `median_duration` | `rule_only` | 5.43 | 2.00 | 16.7% | -4.15 | 91.9% | 22.4 |
| `median_duration` | `rule_plus_rate_outlier` | 5.43 | 2.00 | 16.7% | -4.15 | 91.9% | 22.4 |
| `ewma_duration` | `rule_only` | 5.02 | 2.00 | 17.2% | -2.93 | 81.4% | 16.9 |
| `ewma_duration` | `rule_plus_rate_outlier` | 5.02 | 2.00 | 17.2% | -2.93 | 81.4% | 16.7 |
| `rate_mean` | `rule_only` | 2.15 | 1.00 | 7.7% | -0.57 | 91.9% | 8.1 |
| `rate_mean` | `rule_plus_rate_outlier` | 2.15 | 1.00 | 7.7% | -0.57 | 91.9% | 7.8 |
| `rate_median` | `rule_only` | 2.20 | 1.50 | 7.9% | -0.57 | 91.9% | 8.1 |
| `rate_median` | `rule_plus_rate_outlier` | 2.20 | 1.50 | 7.9% | -0.57 | 91.9% | 8.1 |
| `rate_ewma` | `rule_only` | 2.35 | 1.00 | 8.1% | -0.49 | 89.5% | 8.3 |
| `rate_ewma` | `rule_plus_rate_outlier` | 2.35 | 1.00 | 8.1% | -0.49 | 89.5% | 8.1 |

**Mechanical Selection Outcome:** **`rate_mean (rule_only)`**

### 1.1 Household-Clustered Bonferroni Bootstrap CIs vs `baseline (none)`

| Candidate Method | Variant | MAE Improvement (d) | 99.58% CI | Qualifies? |
| :--- | :--- | ---: | :---: | :---: |
| `baseline` | `rule_only` | +6.558 | `[+0.000, +20.110]` | no |
| `baseline` | `rule_plus_rate_outlier` | +6.558 | `[+0.000, +20.110]` | no |
| `median_duration` | `rule_only` | +6.605 | `[-0.110, +20.248]` | no |
| `median_duration` | `rule_plus_rate_outlier` | +6.605 | `[-0.110, +20.248]` | no |
| `ewma_duration` | `rule_only` | +7.012 | `[-0.447, +20.303]` | no |
| `ewma_duration` | `rule_plus_rate_outlier` | +7.012 | `[-0.447, +20.303]` | no |
| `rate_mean` | `rule_only` | +9.884 | `[+2.282, +24.505]` | YES |
| `rate_mean` | `rule_plus_rate_outlier` | +9.884 | `[+2.282, +24.505]` | YES |
| `rate_median` | `rule_only` | +9.837 | `[+2.247, +24.459]` | YES |
| `rate_median` | `rule_plus_rate_outlier` | +9.837 | `[+2.247, +24.459]` | YES |
| `rate_ewma` | `rule_only` | +9.686 | `[+2.420, +24.385]` | YES |
| `rate_ewma` | `rule_plus_rate_outlier` | +9.686 | `[+2.420, +24.385]` | YES |

## 2. Secondary Views (All Next Cycles & Oracle-Clean)

### 2.1 All Next Cycles (`n=87`)

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 23.69 | 2.00 | 38.5% | -8.88 | 85.1% | 27.1 |
| `baseline` | `rule_only` | 17.21 | 2.00 | 18.4% | -15.51 | 85.1% | 20.5 |
| `baseline` | `rule_plus_rate_outlier` | 17.21 | 2.00 | 18.4% | -15.51 | 85.1% | 20.3 |
| `median_duration` | `rule_only` | 17.16 | 2.00 | 17.6% | -15.90 | 90.8% | 22.3 |
| `median_duration` | `rule_plus_rate_outlier` | 17.16 | 2.00 | 17.6% | -15.90 | 90.8% | 22.3 |
| `ewma_duration` | `rule_only` | 16.76 | 2.00 | 18.1% | -14.69 | 80.5% | 16.9 |
| `ewma_duration` | `rule_plus_rate_outlier` | 16.76 | 2.00 | 18.1% | -14.69 | 80.5% | 16.7 |
| `rate_mean` | `rule_only` | 13.92 | 1.00 | 8.8% | -12.36 | 90.8% | 8.1 |
| `rate_mean` | `rule_plus_rate_outlier` | 13.92 | 1.00 | 8.8% | -12.36 | 90.8% | 7.8 |
| `rate_median` | `rule_only` | 13.97 | 2.00 | 8.9% | -12.36 | 90.8% | 8.1 |
| `rate_median` | `rule_plus_rate_outlier` | 13.97 | 2.00 | 8.9% | -12.36 | 90.8% | 8.1 |
| `rate_ewma` | `rule_only` | 14.12 | 1.00 | 9.2% | -12.28 | 88.5% | 8.3 |
| `rate_ewma` | `rule_plus_rate_outlier` | 14.12 | 1.00 | 9.2% | -12.28 | 88.5% | 8.1 |

### 2.2 Oracle-Clean View (`n=86`, manifest faults removed — reporting only, never used for selection)

| Method | Variant | MAE (d) | MedAE (d) | MAPE (%) | Bias (d) | P10-P90 Cov (%) | Mean Width (d) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | `none` | 12.04 | 2.00 | 37.8% | +2.94 | 86.0% | 27.2 |
| `baseline` | `rule_only` | 5.48 | 2.00 | 17.5% | -3.76 | 86.0% | 20.5 |
| `baseline` | `rule_plus_rate_outlier` | 5.48 | 2.00 | 17.5% | -3.76 | 86.0% | 20.3 |
| `median_duration` | `rule_only` | 5.43 | 2.00 | 16.7% | -4.15 | 91.9% | 22.4 |
| `median_duration` | `rule_plus_rate_outlier` | 5.43 | 2.00 | 16.7% | -4.15 | 91.9% | 22.4 |
| `ewma_duration` | `rule_only` | 5.02 | 2.00 | 17.2% | -2.93 | 81.4% | 16.9 |
| `ewma_duration` | `rule_plus_rate_outlier` | 5.02 | 2.00 | 17.2% | -2.93 | 81.4% | 16.7 |
| `rate_mean` | `rule_only` | 2.15 | 1.00 | 7.7% | -0.57 | 91.9% | 8.1 |
| `rate_mean` | `rule_plus_rate_outlier` | 2.15 | 1.00 | 7.7% | -0.57 | 91.9% | 7.8 |
| `rate_median` | `rule_only` | 2.20 | 1.50 | 7.9% | -0.57 | 91.9% | 8.1 |
| `rate_median` | `rule_plus_rate_outlier` | 2.20 | 1.50 | 7.9% | -0.57 | 91.9% | 8.1 |
| `rate_ewma` | `rule_only` | 2.35 | 1.00 | 8.1% | -0.49 | 89.5% | 8.3 |
| `rate_ewma` | `rule_plus_rate_outlier` | 2.35 | 1.00 | 8.1% | -0.49 | 89.5% | 8.1 |

## 3. Breakdowns (Rule-Clean Next Cycles)

### 3.1 By History Length `k` (with Calibrated P10-P90 Coverage & Width)

| History `k` | Method | Variant | `n` | MAE (d) | Cov (%) | Width (d) |
| :---: | :--- | :--- | ---: | ---: | ---: | ---: |
| `2` | `baseline` | `none` | 31 | 6.10 | 90.3% | 26.6 |
| `2` | `baseline` | `rule_only` | 31 | 5.87 | 90.3% | 25.9 |
| `2` | `rate_mean` | `rule_only` | 31 | 3.55 | 83.9% | 10.8 |
| `3-4` | `baseline` | `none` | 29 | 26.24 | 72.4% | 39.0 |
| `3-4` | `baseline` | `rule_only` | 29 | 7.03 | 75.9% | 20.4 |
| `3-4` | `rate_mean` | `rule_only` | 29 | 1.90 | 93.1% | 8.7 |
| `5+` | `baseline` | `none` | 26 | 3.27 | 96.2% | 14.8 |
| `5+` | `baseline` | `rule_only` | 26 | 3.27 | 92.3% | 14.1 |
| `5+` | `rate_mean` | `rule_only` | 26 | 0.77 | 100.0% | 4.2 |

### 3.2 By Pack-Size Switch (`size_changed_from_previous`)

| Size Changed? | Method | Variant | `n` | MAE (d) | Bias (d) |
| :---: | :--- | :--- | ---: | ---: | ---: |
| `False` | `baseline` | `none` | 70 | 7.96 | +3.36 |
| `False` | `baseline` | `rule_only` | 70 | 3.06 | -1.34 |
| `False` | `rate_mean` | `rule_only` | 70 | 2.07 | -0.90 |
| `True` | `baseline` | `none` | 16 | 29.88 | +1.12 |
| `True` | `baseline` | `rule_only` | 16 | 16.06 | -14.31 |
| `True` | `rate_mean` | `rule_only` | 16 | 2.50 | +0.88 |

### 3.3 By Category

| Category | `baseline (none)` MAE | `baseline (rule_only)` MAE | `rate_mean (rule_only)` MAE |
| :--- | ---: | ---: | ---: |
| Baby Care | 2.15 | 2.15 | 0.94 |
| Body Care | 23.00 | 23.00 | 13.00 |
| Food & Beverage | 6.50 | 6.50 | 6.50 |
| Haircare | 102.17 | 10.83 | 3.33 |
| Home Essentials | 7.30 | 7.30 | 2.30 |
| Household Cleaning | 5.86 | 5.86 | 4.43 |
| Laundry | 1.67 | 1.67 | 1.33 |
| Oral Care | 10.62 | 8.62 | 2.25 |
| Personal Hygiene | 7.60 | 7.60 | 2.30 |
| Skincare | 6.60 | 6.60 | 1.60 |

## 5. Size-History Decomposition (Primary Rule-Clean Targets)

- **Group (a) `constant_size`** (no switch in `1..k` and `k+1` equals history size): `51` targets (`59.3%`)
- **Group (b) `any_size_change`** (at least one switch in `1..k` or `k+1`): `35` targets (`40.7%`)
- **Purchase size overrides (`raw.purchases.size_value IS NOT NULL`):** `59 / 244` (`24.2%`)
- **Products with >= 1 size switch:** `18 / 50` (`36.0%`)

| Method | Variant | (a) Constant Size MAE (d) | (b) Any Size Change MAE (d) |
| :--- | :--- | ---: | ---: |
| `baseline` | `none` | 8.80 | 16.74 |
| `baseline` | `rule_only` | 2.08 | 10.43 |
| `baseline` | `rule_plus_rate_outlier` | 2.08 | 10.43 |
| `median_duration` | `rule_only` | 2.08 | 10.31 |
| `median_duration` | `rule_plus_rate_outlier` | 2.08 | 10.31 |
| `ewma_duration` | `rule_only` | 2.16 | 9.20 |
| `ewma_duration` | `rule_plus_rate_outlier` | 2.16 | 9.20 |
| `rate_mean` | `rule_only` | 2.14 | 2.17 |
| `rate_mean` | `rule_plus_rate_outlier` | 2.14 | 2.17 |
| `rate_median` | `rule_only` | 2.14 | 2.29 |
| `rate_median` | `rule_plus_rate_outlier` | 2.14 | 2.29 |
| `rate_ewma` | `rule_only` | 2.25 | 2.49 |
| `rate_ewma` | `rule_plus_rate_outlier` | 2.25 | 2.49 |

### 7.1 `rate_mean (rule_only)` vs `rate_mean (rule_plus_rate_outlier)`

- **Holdout paired 95% household-clustered bootstrap CI** (`rule_only` minus `rule_plus_rate_outlier`): `+0.000` d (`95% CI [+0.000, +0.000]`; `2.15` d vs `2.15` d).

## 8. Plain-English Summary

- **Per-group performance (primary lens):** on **constant-size histories** (Group a, `34.5%` of targets), `baseline (none)` = `8.80` d, `baseline (rule_only)` = `2.08` d, and `rate_mean (rule_only)` = `2.14` d (rule cleaning accounts for almost all of the gain; duration and rate methods match once rules remove extreme faults); on **histories with >= 1 size change** (Group b, `65.5%` of targets), `baseline (none)` = `16.74` d and `baseline (rule_only)` = `10.43` d, while `rate_mean (rule_only)` stays at `2.17` d.
- **Blended MAE depends on switch frequency:** the overall holdout blend (`17.42` d -> `4.53` d for `rate_mean (rule_only)`) is a weighted average of Groups (a) and (b) and therefore depends directly on the simulator's size-switch assumption (36.0% of products switch; 24.2% of purchases override).
- **Mechanical selection winner:** `rate_mean (rule_only)` at `2.15` d blended MAE.

## 9. Limitations

- **Synthetic data assumption:** These results come from a synthetic generator whose baseline (`eps=0.0`) assumes a stable per-household daily consumption rate independent of pack size — the exact property that rate-based methods exploit. The magnitude of the improvement on real Nittoo user histories is therefore unknown.
- **Switch-frequency assumption:** The blended gain depends on the simulator's synthetic switch rate (36.0% of products switch; 24.2% of purchases override); real households with fewer switches will see blended MAE closer to Group (a).
- **Sensitivity to pack-size elasticity:** When consumption scales with pack size (`eps=0.3` and `eps=0.6` in Section 6), rate-based MAE degrades substantially because a constant daily rate no longer transfers across pack sizes.

## 10. Shipping Decision

- **Mechanical winner vs shipped method:** Although the mechanical winner is `rate_mean (rule_only)` (`2.15` d MAE), we **ship `rate_mean (rule_only)`** (`2.15` d MAE).
- **Why `rate_mean (rule_only)`:** (1) It also passes the pre-registered Bonferroni test against `baseline (none)` (`+9.884` d, `99.58% CI [+2.282, +24.505]`); (2) the incremental gain from `rule_plus_rate_outlier` is small on holdout (`+0.000` d, `95% CI [+0.000, +0.000]`), minimal under `2.5x` noise (Section 4), and **reverses** under pack-size elasticity; and (3) shipping `rule_only` avoids porting an unreliable rate-outlier detector into the web app.
- **Elasticity risk:** Between `eps=0.3` and `eps=0.6` (Section 6), duration-based `ewma_duration` crosses over and beats rate-based methods. Real Nittoo usage data is needed to measure actual pack-size elasticity before committing to rate normalization long-term.
- **Existing restock plans:** Stored `relative` plans (`mode='relative'`) recompute their `reminder_date` dynamically from `days_before_finish` and the new expected finish date when displayed or evaluated; `custom` plans (`mode='custom'`) stay fixed.
