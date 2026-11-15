# Nittoo Domain Model

Nittoo models personal consumables around **individual container lifecycles** rather than aggregate warehouse stock counts.

## Core Entities

| Entity | Key Fields | Purpose |
| :--- | :--- | :--- |
| **`Product`** | `id`, `user_id`, `name`, `brand`, `category`, `size_value`, `size_unit` | Canonical essential item with default pack size (`ml`, `g`, `oz`, `count`, `fl oz`, `units`). |
| **`Purchase`** | `id`, `product_id`, `purchase_date`, `price`, `currency`, `vendor`, `size_value?`, `size_unit?` | Individual container purchase. Supports per-purchase pack-size overrides when buying a different bottle size. |
| **`UsagePeriod`** | `id`, `product_id`, `purchase_id`, `opened_date`, `finished_date?`, `status` | Lifecycle of a single opened container (`active` or `finished`). |
| **`RestockPlan`** | `id`, `product_id`, `usage_period_id`, `mode`, `days_before_finish`, `reminder_date`, `status` | Reorder reminder (`relative` to expected finish or `custom` date; `planned`, `completed`, or `dismissed`). |

## Container Lifecycle

1. **Unopened Backup:** A `Purchase` with no linked `UsagePeriod` is tracked in backup inventory (`InventoryPage`) and counted in the product's `unopened_count` badge without affecting active consumption metrics.
2. **Active Use:** Opening a container creates a `UsagePeriod` (`status = 'active'`, `finished_date = null`). The purchase referenced by `active_usage.purchase_id` is the **active purchase** (`active_purchase`), which governs the card's displayed price, effective pack size, cost per day, and unit rate.
3. **Finished Cycle:** Marking an active container finished sets `finished_date` and `status = 'finished'`. Completed `UsagePeriod` rows form the historical record used for lifespan and cost forecasting.

## Tenant Isolation

- **Authenticated Mode (Supabase):** Every table enforces Row-Level Security (`auth.uid() = user_id`), verified automatically in CI against a local Supabase instance (`scripts/integration/verify-supabase-rls.ts`).
- **Demo Mode:** Uses a deterministic 12-product seed (`src/lib/demo/seed.ts`) stored exclusively in browser `localStorage` with zero network calls to Supabase.
