# Outlier Detector Robustness Analysis

Evaluated with frozen Iteration-2 thresholds (`MIN_CYCLES_FOR_MAD=3`, `MAD_FLOOR_FRAC=0.1`, `MAD_Z_THRESHOLD=3.5`) at `200 households x 24 months` on fresh seeds `3001-3006` (evaluation only; no re-tuning). Note: each cell uses a single seed with relatively small fault counts, so individual cell values are approximate.

| Cycle Noise (`std`) | Subtle-Outlier Ranges | Seed | TP / FP / FN | Precision | Recall | F1 | Clean-Cycle FPR |
| :---: | :--- | :---: | :---: | ---: | ---: | ---: | ---: |
| `0.08` | Baseline [2.5-6.0] / [0.2-0.4] | `3001` | 111 / 4 / 5 | 96.5% | 95.7% | 96.1% | 0.02% |
| `0.08` | Harder [1.5-2.5] / [0.4-0.67] | `3002` | 76 / 2 / 58 | 97.4% | 56.7% | 71.7% | 0.01% |
| `0.20` | Baseline [2.5-6.0] / [0.2-0.4] | `3003` | 94 / 93 / 29 | 50.3% | 76.4% | 60.6% | 0.40% |
| `0.20` | Harder [1.5-2.5] / [0.4-0.67] | `3004` | 30 / 86 / 67 | 25.9% | 30.9% | 28.2% | 0.38% |
| `0.32` | Baseline [2.5-6.0] / [0.2-0.4] | `3005` | 50 / 223 / 51 | 18.3% | 49.5% | 26.7% | 1.13% |
| `0.32` | Harder [1.5-2.5] / [0.4-0.67] | `3006` | 20 / 252 / 87 | 7.4% | 18.7% | 10.6% | 1.23% |

## Plain-English Interpretation

- **At baseline noise (`0.08`):** The detector maintains high precision and low clean-cycle false-positive rate (`<0.1%`), catching almost all `2.5-6.0x` / `0.2-0.4x` outliers and a solid share of harder `1.5-2.5x` / `0.4-0.67x` shifts.
- **As cycle-to-cycle noise rises (`0.20` -> `0.32`, 2.5x-4x baseline):** Natural household variability widens the MAD scale and produces more tail draws above `z > 3.5`, raising clean-cycle FPR and reducing precision — especially when outlier magnitudes (`1.5-2.5x`) overlap with noisy normal cycles.
- **Takeaway:** On low-noise, regular-usage histories the frozen MAD detector is reliable enough to exclude flagged cycles automatically; under high cycle-to-cycle volatility, `is_rate_outlier` should be treated cautiously because clean tail variance overlaps moderate anomalies.
