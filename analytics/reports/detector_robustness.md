# Outlier Detector Robustness Analysis

Generated at: `2026-11-15T17:07:17+00:00`  
Scale: `200 households x 24 months` | Seeds: `3001-3006` | Git commit: `18f9c2d`  
Thresholds: frozen Iteration-2 (`MIN_CYCLES_FOR_MAD=3`, `MAD_FLOOR_FRAC=0.1`, `MAD_Z_THRESHOLD=3.5`; evaluation only, no re-tuning).

> **Single-seed caveat:** Each cell uses a single synthetic seed with relatively small fault counts, so individual cell values are approximate.

| Cycle Noise (`std`) | Subtle-Outlier Ranges | Seed | TP / FP / FN | Precision | Recall | F1 | Clean-Cycle FPR |
| :---: | :--- | :---: | :---: | ---: | ---: | ---: | ---: |
| `0.08` | Baseline [2.5-6.0] / [0.2-0.4] | `3001` | 113 / 4 / 3 | 96.6% | 97.4% | 97.0% | 0.02% |
| `0.08` | Harder [1.5-2.5] / [0.4-0.67] | `3002` | 87 / 2 / 47 | 97.8% | 64.9% | 78.0% | 0.01% |
| `0.20` | Baseline [2.5-6.0] / [0.2-0.4] | `3003` | 82 / 93 / 41 | 46.9% | 66.7% | 55.0% | 0.40% |
| `0.20` | Harder [1.5-2.5] / [0.4-0.67] | `3004` | 36 / 84 / 61 | 30.0% | 37.1% | 33.2% | 0.37% |
| `0.32` | Baseline [2.5-6.0] / [0.2-0.4] | `3005` | 48 / 225 / 53 | 17.6% | 47.5% | 25.7% | 1.14% |
| `0.32` | Harder [1.5-2.5] / [0.4-0.67] | `3006` | 19 / 254 / 88 | 7.0% | 17.8% | 10.0% | 1.24% |

## Plain-English Interpretation

- **At baseline noise (`0.08`):** The detector maintains high precision and low clean-cycle false-positive rate (`<0.1%`), catching most `2.5-6.0x` / `0.2-0.4x` outliers and a moderate share of harder `1.5-2.5x` / `0.4-0.67x` shifts.
- **As cycle-to-cycle noise rises (`0.20` -> `0.32`, 2.5x-4x baseline):** Natural household variability widens the MAD scale and produces more tail draws above `z > 3.5`, raising clean-cycle FPR and reducing precision — especially when outlier magnitudes (`1.5-2.5x`) overlap with noisy normal cycles.
- **Takeaway:** On low-noise, regular-usage histories the frozen MAD detector is reliable enough to flag anomalies; under high cycle-to-cycle volatility, `is_rate_outlier` should be treated cautiously because clean tail variance overlaps moderate anomalies (which is why the shipped app forecast uses `rate_mean (rule_only)`).
