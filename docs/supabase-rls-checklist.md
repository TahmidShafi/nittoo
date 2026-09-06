# Supabase Row-Level Security (RLS) Verification Protocol & Checklist

> [!WARNING]
> **Status**: RLS has not yet been verified against a live Supabase instance because the remote project has not yet been provisioned. Nittoo is currently running in full local-first mock mode with simulated user isolation and schema enforcement.

This document defines the strict, reproducible 11-step verification procedure to execute immediately once a live Supabase project is connected and the schema in [`supabase/schema.sql`](file:///d:/nittoo/supabase/schema.sql) is applied in the Supabase SQL Editor.

---

## 1. Prerequisites for Live Testing

1. Configure `.env` with real credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   ```
2. Apply the complete schema in [`supabase/schema.sql`](file:///d:/nittoo/supabase/schema.sql).
3. Ensure RLS is enabled on all tables:
   - `public.products` (`ALTER TABLE products ENABLE ROW LEVEL SECURITY;`)
   - `public.purchases` (`ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;`)
   - `public.usage_periods` (`ALTER TABLE usage_periods ENABLE ROW LEVEL SECURITY;`)

---

## 2. Step-by-Step Verification Checklist

- [ ] **Step 1: Create Account A**
  - Sign up via `/signup` using `user-a@example.com` with a secure password.
  - Record Account A's `user_id` from Supabase Auth (`auth.users`).

- [ ] **Step 2: Create Account B**
  - Sign up via `/signup` using `user-b@example.com` with a secure password.
  - Record Account B's `user_id` from Supabase Auth (`auth.users`).

- [ ] **Step 3: Sign in as Account A**
  - Sign in via `/login` with `user-a@example.com`.

- [ ] **Step 4: Create Products, Purchases, and Usage Periods as Account A**
  - Navigate to `/add-product`.
  - Create Product: *"Bioderma Sensibio H2O Micellar Water"*, 500 ml, Price ৳1,650, opened today.
  - Confirm product appears in Account A's Dashboard.
  - Record the generated database IDs:
    - Product ID: `prod_a_id`
    - Purchase ID: `pur_a_id`
    - Usage Period ID: `use_a_id`

- [ ] **Step 5: Sign out of Account A**
  - Click "Sign Out" in the top navigation bar.
  - Confirm redirection to `/login` and clearance of session tokens.

- [ ] **Step 6: Sign in as Account B**
  - Sign in via `/login` with `user-b@example.com`.

- [ ] **Step 7: Confirm Account B Cannot SELECT Account A's Data**
  - Verify Account B's Dashboard shows zero products ("No active products in use").
  - Verify Account B's Analytics shows clean empty state ("No Essentials Tracked Yet").

- [ ] **Step 8: Attempt Direct Access to Account A's Known Row IDs**
  - Using the Supabase JS client in browser console or curl with Account B's JWT:
    ```ts
    const { data: directProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', '<prod_a_id>');
    ```
  - Verify `data` is empty (`[]`) or `null`.

- [ ] **Step 9: Confirm RLS Blocks Unauthorized Mutates**
  - Attempt to update or delete Account A's row using Account B's session:
    ```ts
    const { error: updateError } = await supabase
      .from('products')
      .update({ name: 'Tampered' })
      .eq('id', '<prod_a_id>');
    ```
  - Attempt to insert a purchase for Account A's product:
    ```ts
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({ product_id: '<prod_a_id>', user_id: '<account_b_id>', price: 100, purchase_date: '2026-09-06' });
    ```
  - Verify foreign key / RLS ownership policy triggers an error or affects 0 rows.

- [ ] **Step 10: Create Account B's Own Records**
  - Navigate to `/add-product`.
  - Create Product: *"Neutrogena Hydro Boost Water Gel"*, 50 g, Price ৳1,200.
  - Confirm it appears on Account B's Dashboard.

- [ ] **Step 11: Confirm Account A Cannot Access Account B's Records**
  - Sign out of Account B.
  - Sign back into Account A.
  - Confirm Account A only sees *"Bioderma Sensibio H2O Micellar Water"*.
  - Confirm Account A cannot see *"Neutrogena Hydro Boost Water Gel"*.

---

## 3. RLS Policies Applied in Schema

The corresponding SQL policies in [`supabase/schema.sql`](file:///d:/nittoo/supabase/schema.sql) guarantee isolation:
- `products`:
  - `CREATE POLICY "Users can only manage their own products" ON products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
- `purchases`:
  - `CREATE POLICY "Users can only manage their own purchases" ON purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
- `usage_periods`:
  - `CREATE POLICY "Users can only manage their own usage periods" ON usage_periods FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
