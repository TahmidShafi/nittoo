-- ==============================================================================
-- Nittoo Per-Purchase Pack Size Migration (Additive & Idempotent)
--
-- Adds optional per-purchase size overrides (`size_value`, `size_unit`) to
-- `public.purchases`. A NULL value means "same as product".
-- Effective pack size is defined as:
--   effective_size_value = COALESCE(purchases.size_value, products.size_value)
--   effective_size_unit  = COALESCE(purchases.size_unit, products.size_unit)
-- ==============================================================================

ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS size_value NUMERIC NULL,
    ADD COLUMN IF NOT EXISTS size_unit TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_purchases_size_value_positive'
          AND conrelid = 'public.purchases'::regclass
    ) THEN
        ALTER TABLE public.purchases
            ADD CONSTRAINT chk_purchases_size_value_positive
            CHECK (size_value IS NULL OR size_value > 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_purchases_size_unit'
          AND conrelid = 'public.purchases'::regclass
    ) THEN
        ALTER TABLE public.purchases
            ADD CONSTRAINT chk_purchases_size_unit
            CHECK (size_unit IS NULL OR size_unit IN ('ml', 'g', 'count'));
    END IF;
END $$;
