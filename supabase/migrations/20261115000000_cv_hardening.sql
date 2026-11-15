-- ==============================================================================
-- Nittoo CV Hardening Migration
-- Adds data integrity constraints, updated_at audit triggers, and tightened RLS
-- ==============================================================================

-- 1. Enforce valid size units on products
ALTER TABLE public.products
    ADD CONSTRAINT chk_products_size_unit
    CHECK (size_unit IS NULL OR size_unit IN ('ml', 'g', 'count'));

-- 2. Enforce 1-to-1 relationship between a purchase and its usage period
ALTER TABLE public.usage_periods
    ADD CONSTRAINT uq_usage_periods_purchase_id
    UNIQUE (purchase_id);

-- 3. Add updated_at columns to all 4 core tables
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.usage_periods
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.restock_plans
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 4. Shared updated_at trigger function and per-table triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON public.products;
CREATE TRIGGER trg_products_set_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purchases_set_updated_at ON public.purchases;
CREATE TRIGGER trg_purchases_set_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_usage_periods_set_updated_at ON public.usage_periods;
CREATE TRIGGER trg_usage_periods_set_updated_at
    BEFORE UPDATE ON public.usage_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_restock_plans_set_updated_at ON public.restock_plans;
CREATE TRIGGER trg_restock_plans_set_updated_at
    BEFORE UPDATE ON public.restock_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 5. Tighten usage_periods UPDATE RLS policy so purchase_id must belong to the same product
DROP POLICY IF EXISTS "Users can update usage periods of own products" ON public.usage_periods;

CREATE POLICY "Users can update usage periods of own products"
    ON public.usage_periods
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = usage_periods.product_id
            AND products.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.purchases pu ON pu.product_id = p.id
            WHERE p.id = usage_periods.product_id
            AND pu.id = usage_periods.purchase_id
            AND p.user_id = auth.uid()
        )
    );
