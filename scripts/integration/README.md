# Integration Verification Scripts

These scripts run against live external environments (a hosted or local Supabase instance, or a live Chrome DevTools session) and are intentionally separated from the Vitest unit suite (`npm test`).

## Prerequisites

For Supabase integration scripts (`verify-supabase-live.ts`, `verify-supabase-rls.ts`, `verify-live-audit.ts`), ensure `.env` (or your shell environment) defines:

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

For local Supabase testing, run `supabase start && supabase db reset` and use the local URL and anon key printed by `supabase status`.

## Running Manually

| Script | Purpose | Command |
| :--- | :--- | :--- |
| `verify-supabase-live.ts` | End-to-end CRUD against live Supabase Auth + Postgres | `npm run integration:supabase` |
| `verify-supabase-rls.ts` | Cross-user RLS tenant isolation checks against live Supabase | `npm run integration:rls` |
| `verify-live-audit.ts` | Live Supabase schema/data audit | `npm run integration:audit` |
| `verify-chrome-live.ts` | Live Chrome DevTools (`--remote-debugging-port=9222`) smoke test | `npm run integration:chrome` |
