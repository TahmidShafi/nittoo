import { useMemo } from 'react';
import { buildDemoSeedData } from '../lib/demo/seed';
import { ProductCard } from './ProductCard';
import type { ProductWithDetails } from '../types';

/**
 * Lazy-loaded, non-interactive ProductCard preview for the landing page,
 * populated exclusively from real DEMO_SEED data (never invented metrics).
 */
export function DemoProductPreview() {
  const sampleProduct = useMemo<ProductWithDetails | null>(() => {
    const bundle = buildDemoSeedData('demo-preview');
    const product = bundle.products[0];
    if (!product) return null;

    const purchases = bundle.purchases.filter((p) => p.product_id === product.id);
    const periods = bundle.usage_periods.filter((u) => u.product_id === product.id);
    const activeUsage = periods.find((u) => u.status === 'active' || !u.finished_date) ?? null;
    const finishedPeriods = periods.filter((u) => u.status === 'finished' && Boolean(u.finished_date));
    const activePurchase = activeUsage
      ? purchases.find((p) => p.id === activeUsage.purchase_id) ?? null
      : null;
    const latestPurchase = purchases[purchases.length - 1] ?? null;
    const restockPlan =
      bundle.restock_plans.find((r) => r.product_id === product.id) ?? null;

    // Count unopened purchases (purchases with no usage period referencing them)
    const usedPurchaseIds = new Set(periods.map((u) => u.purchase_id));
    const unopenedCount = purchases.filter((p) => !usedPurchaseIds.has(p.id)).length;

    return {
      ...product,
      purchases,
      active_usage: activeUsage,
      active_purchase: activePurchase,
      latest_purchase: latestPurchase,
      finished_periods: finishedPeriods,
      finished_count: finishedPeriods.length,
      unopened_count: unopenedCount,
      restock_plan: restockPlan,
    };
  }, []);

  if (!sampleProduct) return null;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-neutral-500">
          Example from the demo
        </span>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
      >
        <ProductCard
          product={sampleProduct}
          onMarkFinished={() => {}}
        />
      </div>
    </div>
  );
}

export default DemoProductPreview;
