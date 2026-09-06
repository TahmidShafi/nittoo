-- ==============================================================================
-- Nittoo Supabase Database Schema
-- Personal Essentials Tracker: Products, Purchases, Usage Periods & RLS Policies
-- ==============================================================================

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    size_value NUMERIC CHECK (size_value IS NULL OR size_value > 0),
    size_unit TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying products by user
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

-- 2. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    price NUMERIC NOT NULL CHECK (price >= 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for linked product purchases
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);

-- 3. USAGE PERIODS TABLE
CREATE TABLE IF NOT EXISTS public.usage_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    opened_date DATE NOT NULL,
    finished_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_finished_date_valid CHECK (finished_date IS NULL OR finished_date >= opened_date)
);

-- Relational indexes
CREATE INDEX IF NOT EXISTS idx_usage_periods_product_id ON public.usage_periods(product_id);
CREATE INDEX IF NOT EXISTS idx_usage_periods_purchase_id ON public.usage_periods(purchase_id);
CREATE INDEX IF NOT EXISTS idx_usage_periods_status ON public.usage_periods(status);

-- Enforce exactly one active usage period per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_periods_single_active 
ON public.usage_periods (product_id) 
WHERE status = 'active';

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PRODUCTS POLICIES (Direct User Ownership)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read own products"
    ON public.products
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
    ON public.products
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
    ON public.products
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
    ON public.products
    FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- PURCHASES POLICIES (Indirect Ownership via Linked Product)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read purchases of own products"
    ON public.purchases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchases.product_id
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert purchases for own products"
    ON public.purchases
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchases.product_id
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update purchases of own products"
    ON public.purchases
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchases.product_id
            AND products.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchases.product_id
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete purchases of own products"
    ON public.purchases
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchases.product_id
            AND products.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- USAGE PERIODS POLICIES (Indirect Ownership + Product/Purchase Integrity)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read usage periods of own products"
    ON public.usage_periods
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = usage_periods.product_id
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert usage periods for own products and purchases"
    ON public.usage_periods
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.purchases pu ON pu.product_id = p.id
            WHERE p.id = usage_periods.product_id
            AND pu.id = usage_periods.purchase_id
            AND p.user_id = auth.uid()
        )
    );

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
            SELECT 1 FROM public.products
            WHERE products.id = usage_periods.product_id
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete usage periods of own products"
    ON public.usage_periods
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = usage_periods.product_id
            AND products.user_id = auth.uid()
        )
    );
