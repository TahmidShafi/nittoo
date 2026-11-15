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
