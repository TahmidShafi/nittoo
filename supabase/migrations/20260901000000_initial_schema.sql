-- ==============================================================================
-- Nittoo Supabase Database Schema
-- Personal Essentials Tracker: Products, Purchases, Usage Periods & RLS Policies
--
-- LIFECYCLE ARCHITECTURE:
-- 1. Acquisition: A record is inserted into `purchases`.
--    If kept unopened / stored as backup, NO `usage_periods` record is created.
-- 2. Activation: When the user starts using the product, a row is inserted into
--    `usage_periods` linking `purchase_id`, with `opened_date` set to start date
--    and `status = 'active'`.
-- 3. Consumption: `idx_usage_periods_single_active` guarantees at most 1 active
--    usage period per product.
-- 4. Completion: When finished, `status` is set to 'finished' with `finished_date`.
--    Only completed usage periods contribute to historical lifespan predictions.
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
    store_vendor TEXT,
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

-- Composite query optimization indexes (Stage 16.8)
CREATE INDEX IF NOT EXISTS idx_purchases_product_date ON public.purchases(product_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_periods_product_opened ON public.usage_periods(product_id, opened_date DESC);

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

-- ==============================================================================
-- 4. RESTOCK PLANS TABLE (Stage 21)
-- User-controlled restock intent and reminders tied to specific active usage periods
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.restock_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    usage_period_id UUID NOT NULL REFERENCES public.usage_periods(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('relative', 'custom')),
    days_before_finish INTEGER CHECK (days_before_finish IS NULL OR days_before_finish >= 0),
    reminder_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT chk_relative_days CHECK (
        (mode = 'relative' AND days_before_finish IS NOT NULL) OR
        (mode = 'custom')
    )
);

-- Relational & Query Indexes
CREATE INDEX IF NOT EXISTS idx_restock_plans_user_id ON public.restock_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_restock_plans_product_id ON public.restock_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_restock_plans_usage_period_id ON public.restock_plans(usage_period_id);
CREATE INDEX IF NOT EXISTS idx_restock_plans_status ON public.restock_plans(status);
CREATE INDEX IF NOT EXISTS idx_restock_plans_reminder_date ON public.restock_plans(reminder_date);

-- Guarantee at most one 'planned' restock plan per active usage period
CREATE UNIQUE INDEX IF NOT EXISTS idx_restock_plans_single_planned
ON public.restock_plans (usage_period_id)
WHERE status = 'planned';

-- ------------------------------------------------------------------------------
-- RESTOCK PLANS POLICIES (User Ownership & Cross-Entity Integrity)
-- ------------------------------------------------------------------------------
ALTER TABLE public.restock_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own restock plans"
    ON public.restock_plans
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own restock plans"
    ON public.restock_plans
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.usage_periods u ON u.product_id = p.id
            WHERE p.id = restock_plans.product_id
            AND u.id = restock_plans.usage_period_id
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own restock plans"
    ON public.restock_plans
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own restock plans"
    ON public.restock_plans
    FOR DELETE
    USING (auth.uid() = user_id);

