# Nittoo Supabase Migrations & Hardening Guide

All migrations in `supabase/migrations/` are idempotent and safe to run on both fresh and existing databases.

## Applying Migrations to a Hosted Project

> [!IMPORTANT]
> **Deploy order for `20261116000000_purchase_size.sql`:** This migration is purely additive (`NULL`-able `size_value` and `size_unit` on `public.purchases`) and safe for the currently deployed app code. **Apply it to the live Supabase project (`supabase db push --remote`) BEFORE deploying the updated app code** so purchase writes/reads referencing the new columns never hit a missing-column error.

Because the Supabase CLI's default target may be the local stack, pass `--remote` when pushing to your hosted project:

1. **Run the pre-check queries** (for existing projects) in [`supabase/precheck.sql`](./precheck.sql) in the Supabase SQL Editor to verify no existing rows violate the hardening constraints (`products.size_unit`, `usage_periods.purchase_id` uniqueness, or `usage_periods.product_id` consistency). Fix any flagged rows first.
2. **Link and push migrations** (no `migration repair` needed):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push --remote
   ```

## Applying Migrations to a Local Stack

```bash
supabase db push --local
```
