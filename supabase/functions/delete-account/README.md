# `delete-account` Supabase Edge Function

Permanently deletes the authenticated user's `auth.users` record (and cascades to `public.products`, `purchases`, `usage_periods`, and `restock_plans`).

## Deployment Steps

1. Install and link the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
2. Deploy the function (JWT verification is also handled in-function via `auth.getUser()`):
   ```bash
   npx supabase functions deploy delete-account
   ```
3. Verify environment secrets in Supabase Dashboard → **Edge Functions → Secrets**:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase Edge Runtime. Never expose `SUPABASE_SERVICE_ROLE_KEY` in `.env` or any `VITE_*` variable.
