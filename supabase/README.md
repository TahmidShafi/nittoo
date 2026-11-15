# Nittoo Supabase Migrations & Hardening Guide

## Applying Migrations to a Fresh Database

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Applying Migrations to an Existing Database

`supabase/migrations/20260901000000_initial_schema.sql` contains non-idempotent `CREATE POLICY` statements and is intended only for fresh databases. If your Supabase project already has the initial schema applied, mark the baseline migration as applied **before** pushing:

1. **Run the pre-check queries** in [`supabase/precheck.sql`](./precheck.sql) in the Supabase SQL Editor to verify no existing rows violate the new constraints (`products.size_unit`, `usage_periods.purchase_id` uniqueness, or `usage_periods.product_id` consistency). Fix any flagged rows first.
2. **Repair migration history** so Supabase CLI skips `20260901000000`:
   ```bash
   supabase migration repair --status applied 20260901000000
   ```
3. **Push the hardening migration** (`20261115000000_cv_hardening.sql`):
   ```bash
   supabase db push
   ```
