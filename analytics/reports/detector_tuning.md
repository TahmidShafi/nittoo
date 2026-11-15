# Outlier Detector Tuning Report (Dev Seed 7)

All tuning was performed exclusively on **dev seed `7`** (`500` households × `24` months, `57,658` clean completed cycles, `322` `subtle_duration_outlier` cycles) **before** running any evaluation on seed `42`.

## Parameter Grid (Seed 7)

Detector: per-`(user_id, product_id)` MAD modified z-score on `consumption_rate_per_day` when `cycle_count >= min_cycles_for_mad`, with MAD floor `max(mad_rate, mad_floor_frac * median_rate)`, falling back to `(category, size_unit)` physical plausibility bounds below `min_cycles_for_mad`.

| `mad_floor_frac` | `min_cycles_for_mad` | `mad_z_threshold` | Subtle TP | Subtle Recall | Subtle Precision | Subtle F1 | Clean FP | Clean FPR |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.08 | 3 | 3.5 | 256 / 322 | 79.5% | 7.4% | 13.5% | 3,216 | 5.58% |
| 0.08 | 3 | 4.0 | 246 / 322 | 76.4% | 8.8% | 15.7% | 2,561 | 4.44% |
| 0.08 | 3 | 4.5 | 236 / 322 | 73.3% | 10.7% | 18.7% | 1,963 | 3.40% |
| 0.08 | 3 | 5.0 | 218 / 322 | 67.7% | 12.0% | 20.4% | 1,598 | 2.77% |
| 0.08 | 4 | 3.5 | 252 / 322 | 78.3% | 7.3% | 13.3% | 3,205 | 5.56% |
| 0.08 | 4 | 4.0 | 242 / 322 | 75.2% | 8.7% | 15.5% | 2,553 | 4.43% |
| 0.08 | 4 | 4.5 | 232 / 322 | 72.0% | 10.6% | 18.5% | 1,959 | 3.40% |
| 0.08 | 4 | 5.0 | 214 / 322 | 66.5% | 11.8% | 20.1% | 1,596 | 2.77% |
| 0.10 | 3 | 3.5 | 252 / 322 | 78.3% | 8.8% | 15.8% | 2,616 | 4.54% |
| 0.10 | 3 | 4.0 | 240 / 322 | 74.5% | 10.8% | 18.9% | 1,974 | 3.42% |
| 0.10 | 3 | 4.5 | 224 / 322 | 69.6% | 12.2% | 20.8% | 1,612 | 2.80% |
| 0.10 | 3 | 5.0 | 201 / 322 | 62.4% | 13.3% | 22.0% | 1,306 | 2.27% |
| 0.10 | 4 | 3.5 | 248 / 322 | 77.0% | 8.7% | 15.6% | 2,609 | 4.52% |
| 0.10 | 4 | 4.0 | 236 / 322 | 73.3% | 10.7% | 18.7% | 1,970 | 3.42% |
| **0.10** | **4** | **4.5** | **220 / 322** | **68.3%** | **12.0%** | **20.5%** | **1,609** | **2.79%** |
| 0.10 | 4 | 5.0 | 197 / 322 | 61.2% | 13.1% | 21.6% | 1,306 | 2.27% |
| 0.12 | 3 | 3.5 | 244 / 322 | 75.8% | 10.3% | 18.1% | 2,130 | 3.69% |
| 0.12 | 3 | 4.0 | 224 / 322 | 69.6% | 12.0% | 20.5% | 1,636 | 2.84% |
| 0.12 | 3 | 4.5 | 172 / 322 | 53.4% | 11.7% | 19.3% | 1,292 | 2.24% |
| 0.12 | 3 | 5.0 | 130 / 322 | 40.4% | 11.1% | 17.4% | 1,038 | 1.80% |
| 0.12 | 4 | 3.5 | 240 / 322 | 74.5% | 10.2% | 17.9% | 2,124 | 3.68% |
| 0.12 | 4 | 4.0 | 220 / 322 | 68.3% | 11.9% | 20.2% | 1,633 | 2.83% |
| 0.12 | 4 | 4.5 | 168 / 322 | 52.2% | 11.5% | 18.9% | 1,291 | 2.24% |
| 0.12 | 4 | 5.0 | 126 / 322 | 39.1% | 10.8% | 16.9% | 1,040 | 1.80% |

## Chosen & Frozen Values

- `MIN_CYCLES_FOR_MAD = 4`
- `MAD_FLOOR_FRAC = 0.10`
- `MAD_Z_THRESHOLD = 4.5`

Why: `mad_floor_frac = 0.10`, `min_cycles_for_mad = 4`, `mad_z_threshold = 4.5` achieves `68.3%` recall and `20.5%` F1 on `subtle_duration_outlier` while keeping clean-cycle FPR at `2.79%` (at `0.12` floor, recall drops sharply to `52.2%` because slow outliers at `2.5x` duration fall below the `z > 4.5` cutoff).

## Frozen Evaluation Floors & Ceilings (Set Before Running Seed 42)

- `DETECTOR_RECALL_FLOOR = 0.95` (deterministic/extreme faults)
- `DETECTOR_PRECISION_FLOOR = 0.95` (deterministic/extreme faults)
- `SUBTLE_OUTLIER_RECALL_FLOOR = 0.60` (seed-7 `0.683` minus `~0.08` margin)
- `SUBTLE_OUTLIER_PRECISION_FLOOR = 0.10` (seed-7 `0.120` minus `0.02` margin)
- `CLEAN_FPR_CEILING = 0.035` (seed-7 `0.0279` plus `~0.007` margin)

---

## Iteration 2 (Dev Seed 7 After Fixing `product.size = tpl.sizes[0]` in Simulator)

### Root Cause of Iteration-1 False Positives (Diagnosed on Seed 7)
Diagnosing the `1,609` seed-7 false positives showed `1,588` came from the MAD path (`520` on `first` cycle, `987` in Dec–Feb when Cycle 1 opens). `generator.py` was writing `"size": current_size` (the product's final size after any pack-size switch) onto the `product` record instead of `"size": float(tpl.sizes[0])` (the initial default size). Every earlier cycle with `purchase.size_value = None` inherited the later pack size, inflating `consumption_rate_per_day` by ~2×.

### Iteration 2 Parameter Grid (Seed 7, `500 × 24`)

| `mad_floor_frac` | `min_cycles_for_mad` | `mad_z_threshold` | Subtle TP | Subtle Recall | Subtle Precision | Subtle F1 | Clean FP | Clean FPR |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.06 | 3 | 3.5 | 321 / 322 | 99.7% | 81.1% | 89.4% | 75 | 0.13% |
| 0.06 | 3 | 4.0 | 317 / 322 | 98.4% | 91.9% | 95.1% | 28 | 0.05% |
| 0.06 | 3 | 4.5 | 315 / 322 | 97.8% | 95.7% | 96.8% | 14 | 0.02% |
| 0.06 | 3 | 5.0 | 304 / 322 | 94.4% | 95.6% | 95.0% | 14 | 0.02% |
| 0.06 | 4 | 3.5 | 316 / 322 | 98.1% | 79.4% | 87.8% | 82 | 0.14% |
| 0.06 | 4 | 4.0 | 312 / 322 | 96.9% | 89.7% | 93.1% | 36 | 0.06% |
| 0.06 | 4 | 4.5 | 310 / 322 | 96.3% | 93.1% | 94.7% | 23 | 0.04% |
| 0.06 | 4 | 5.0 | 299 / 322 | 92.9% | 92.9% | 92.9% | 23 | 0.04% |
| 0.08 | 3 | 3.5 | 321 / 322 | 99.7% | 95.5% | 97.6% | 15 | 0.03% |
| 0.08 | 3 | 4.0 | 317 / 322 | 98.4% | 96.1% | 97.2% | 13 | 0.02% |
| 0.08 | 3 | 4.5 | 314 / 322 | 97.5% | 96.0% | 96.8% | 13 | 0.02% |
| 0.08 | 3 | 5.0 | 302 / 322 | 93.8% | 95.9% | 94.8% | 13 | 0.02% |
| 0.08 | 4 | 3.5 | 316 / 322 | 98.1% | 92.9% | 95.5% | 24 | 0.04% |
| 0.08 | 4 | 4.0 | 312 / 322 | 96.9% | 93.4% | 95.1% | 22 | 0.04% |
| 0.08 | 4 | 4.5 | 309 / 322 | 96.0% | 93.4% | 94.6% | 22 | 0.04% |
| 0.08 | 4 | 5.0 | 297 / 322 | 92.2% | 93.1% | 92.7% | 22 | 0.04% |
| **0.10** | **3** | **3.5** | **320 / 322** | **99.4%** | **96.1%** | **97.7%** | **13** | **0.02%** |
| 0.10 | 3 | 4.0 | 311 / 322 | 96.6% | 96.0% | 96.3% | 13 | 0.02% |
| 0.10 | 3 | 4.5 | 292 / 322 | 90.7% | 95.7% | 93.1% | 13 | 0.02% |
| 0.10 | 3 | 5.0 | 255 / 322 | 79.2% | 95.1% | 86.4% | 13 | 0.02% |
| 0.10 | 4 | 3.5 | 315 / 322 | 97.8% | 93.5% | 95.6% | 22 | 0.04% |
| 0.10 | 4 | 4.0 | 306 / 322 | 95.0% | 93.3% | 94.2% | 22 | 0.04% |
| 0.10 | 4 | 4.5 | 287 / 322 | 89.1% | 92.9% | 91.0% | 22 | 0.04% |
| 0.10 | 4 | 5.0 | 250 / 322 | 77.6% | 91.9% | 84.2% | 22 | 0.04% |

### Iteration 2 Chosen & Frozen Values (Before Running Holdout Seed `2027`)

- `MIN_CYCLES_FOR_MAD = 3`
- `MAD_FLOOR_FRAC = 0.10`
- `MAD_Z_THRESHOLD = 3.5`
- `DETECTOR_RECALL_FLOOR = 0.95`
- `DETECTOR_PRECISION_FLOOR = 0.95`
- `SUBTLE_OUTLIER_RECALL_FLOOR = 0.90`
- `SUBTLE_OUTLIER_PRECISION_FLOOR = 0.85`
- `CLEAN_FPR_CEILING = 0.005`
- `RATE_OUTLIER_MIN_PRECISION_TO_EXCLUDE = 0.50` (if holdout precision `< 50%`, `is_rate_outlier` becomes advisory only)
