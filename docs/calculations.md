# Nittoo Calculation & Prediction Engine

All consumption, pricing, and forecasting formulas live in [`src/lib/prediction.ts`](../src/lib/prediction.ts) and [`src/lib/analytics.ts`](../src/lib/analytics.ts), and are parity-tested against the Python lab in [`analytics/`](../analytics/).

## 1. Effective Pack Size

For any `Purchase`, `getEffectiveSize(purchase, product)` resolves:
- `purchase.size_value` and `purchase.size_unit` when a per-purchase override is recorded,
- otherwise the product's default `product.size_value` and `product.size_unit`.

## 2. Expected Lifespan (`rate_mean (rule_only)`)

`calculatePredictedLifespan({ usagePeriods, product, purchases, activePurchase })` estimates how long the active bottle will last:

1. **Rule-based cycle cleaning:** Only finished cycles (`finished_date !== null`) with duration `1 <= days < 1000` are valid (`0`-day accidental logs and `>= 1000`-day stale entries are excluded).
2. **Size-normalized daily rate:** For each valid finished cycle whose linked purchase has a known effective size (`> 0`) and matching `size_unit` with `activePurchase`:
   $$\text{rate}_i = \frac{\text{effective\_size}_i}{\text{duration}_i}$$
   The expected lifespan of the active bottle is:
   $$\text{expected\_days} = \frac{\text{active\_effective\_size}}{\frac{1}{m}\sum_{i=1}^{m} \text{rate}_i}$$
3. **Fallbacks:**
   - If no valid finished cycles exist -> `null` (UI displays *"First cycle • Learning"* / *"No history yet"* — no fabricated numbers).
   - If valid finished cycles exist, but none have a known effective size matching `activePurchase`'s unit -> fall back to the rule-cleaned arithmetic mean of valid cycle durations.
4. **Rounding parity:** Days and displayed integers use JavaScript `Math.round` half-up semantics, mirrored in Python via `round_half_up` and verified across 300+ deterministic cases in [`analytics/fixtures/forecast_parity.json`](../analytics/fixtures/forecast_parity.json).

## 3. Calibrated P10–P90 Run-Out Window

When a product has at least `2` valid finished cycles, Nittoo applies the frozen relative-residual quantiles from [`src/lib/forecast/calibration.json`](../src/lib/forecast/calibration.json) for the product's history bucket (`2`, `3-4`, or `5+` valid cycles):
- Low date = `opened_date + round(expected_days * (1 + q10))`
- High date = `opened_date + round(expected_days * (1 + q90))`

If today is past the point-estimate expected finish date but on or before the P90 high date, the card shows:
`Was expected <expected date> · may last until <high date>`. Once the high date passes, the product transitions to `Overdue`.

## 4. Active-Purchase Cost & Monthly Run Rate

All cost metrics use the **active purchase** (`active_purchase`, falling back to `latest_purchase` only when no active bottle exists), never unopened backup purchases:
- **Cost Per Day:** `activePurchase.price / expectedLifespanDays`
- **Price Per Unit:** `activePurchase.price / activeEffectiveSize`
- **Estimated Monthly Consumption:** `calculateEstimatedMonthlyConsumptionFromDetails` sums `(activePurchase.price / unroundedPredictedLifespan) * 30` across active products with a valid prediction, keeping Dashboard and Analytics identical.

## 5. Restock Reminders

- `mode = 'relative'`: `recalculatePlanReminderDate` recomputes `reminder_date` dynamically as `expectedFinishDate - days_before_finish` whenever displayed or evaluated.
- `mode = 'custom'`: keeps the user's fixed `reminder_date`.
