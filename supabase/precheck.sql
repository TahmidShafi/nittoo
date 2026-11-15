-- ==============================================================================
-- Nittoo Pre-Migration Constraint Check (run before 20261115000000_cv_hardening)
-- Every query below should return 0 rows before applying the hardening migration.
-- ==============================================================================

-- 1. Detect products with size_unit values outside ('ml', 'g', 'count')
SELECT id, user_id, name, size_unit
FROM public.products
WHERE size_unit IS NOT NULL
  AND size_unit NOT IN ('ml', 'g', 'count');

-- 2. Detect duplicate purchase_id references in usage_periods
SELECT purchase_id, COUNT(*) AS usage_count, ARRAY_AGG(id ORDER BY created_at) AS usage_period_ids
FROM public.usage_periods
GROUP BY purchase_id
HAVING COUNT(*) > 1;

-- 3. Detect usage_periods whose purchase belongs to a different product
SELECT u.id AS usage_period_id,
       u.product_id AS usage_product_id,
       u.purchase_id,
       pu.product_id AS purchase_product_id
FROM public.usage_periods u
JOIN public.purchases pu ON pu.id = u.purchase_id
WHERE u.product_id <> pu.product_id;
