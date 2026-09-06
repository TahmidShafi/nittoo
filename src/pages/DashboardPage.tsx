// ==============================================================================
// Nittoo Dashboard Page
// Urgency-Sorted Essentials Grid, Summary Metrics, Loading Skeleton & Finish Modal
// ==============================================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getPredictionMetrics } from '../hooks/usePrediction';
import { ProductCard } from '../components/ProductCard';
import { FinishUsageModal } from '../components/FinishUsageModal';
import type { ProductWithDetails } from '../types';

function getSortPriority(predictedRemaining: number | null): number {
  if (predictedRemaining === null) return 3;
  if (predictedRemaining < 0) return 1;
  return 2;
}

export function sortActiveProducts(
  products: ProductWithDetails[],
  referenceDate?: string
): ProductWithDetails[] {
  return [...products].sort((a, b) => {
    const metricsA = getPredictionMetrics(a, referenceDate);
    const metricsB = getPredictionMetrics(b, referenceDate);

    const prioA = getSortPriority(metricsA.predictedRemainingDays);
    const prioB = getSortPriority(metricsB.predictedRemainingDays);

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    if (prioA === 1) {
      // Priority 1: Most overdue first (-10 before -2)
      return (metricsA.predictedRemainingDays ?? 0) - (metricsB.predictedRemainingDays ?? 0);
    }

    if (prioA === 2) {
      // Priority 2: Soonest future run-out first (2 before 55)
      return (metricsA.predictedRemainingDays ?? 0) - (metricsB.predictedRemainingDays ?? 0);
    }

    // Priority 3: No prediction. Sort by opened date, then name
    const dateA = a.active_usage?.opened_date || '';
    const dateB = b.active_usage?.opened_date || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return a.name.localeCompare(b.name);
  });
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notice banner passed from navigation (e.g. repeat purchase active bottle notice)
  const [infoNotice, setInfoNotice] = useState<string | null>(
    (location.state as { infoNotice?: string })?.infoNotice || null
  );

  // Modal State for Finishing a Usage Period
  const [modalProduct, setModalProduct] = useState<ProductWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadActiveProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const active = await db.getActiveProducts(user.id);
      setProducts(active);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load active products';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadActiveProducts();
  }, [loadActiveProducts]);

  // Urgency-sorted product list
  const sortedProducts = useMemo(() => {
    return sortActiveProducts(products);
  }, [products]);

  // Summary Metrics Computation
  const summaryMetrics = useMemo(() => {
    let runningSoonCount = 0;
    let monthlyConsumptionTotal = 0;

    for (const p of products) {
      const metrics = getPredictionMetrics(p);
      // Running Soon: 0 <= predictedRemainingDays < 14 (excluding overdue)
      if (
        metrics.predictedRemainingDays !== null &&
        metrics.predictedRemainingDays >= 0 &&
        metrics.predictedRemainingDays < 14
      ) {
        runningSoonCount++;
      }

      // Estimated Monthly Consumption Cost: price / averageLifespan * 30
      if (metrics.averageLifespan !== null && metrics.averageLifespan > 0 && p.latest_purchase) {
        monthlyConsumptionTotal += (p.latest_purchase.price / metrics.averageLifespan) * 30;
      }
    }

    return {
      activeCount: products.length,
      runningSoonCount,
      estimatedMonthlyCost: Math.round(monthlyConsumptionTotal),
    };
  }, [products]);

  const handleOpenFinishModal = (product: ProductWithDetails) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseFinishModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  return (
    <div className="space-y-8">
      {/* Notice Banner */}
      {infoNotice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">ℹ️</span>
            <span>{infoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInfoNotice(null)}
            className="text-amber-500 hover:text-amber-800 text-sm font-bold ml-3"
          >
            ×
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Active Essentials
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitor ongoing product lifespans, daily costs, and upcoming run-outs.
          </p>
        </div>
        <div>
          <Link
            to="/add-product"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-medium transition-colors shadow-xs"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center max-w-lg mx-auto space-y-3">
          <p className="text-sm font-semibold text-rose-800">Unable to load active essentials</p>
          <p className="text-xs text-rose-600">A connection issue occurred. Please try again.</p>
          <button
            type="button"
            onClick={loadActiveProducts}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#24563F] transition-colors shadow-xs"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Active Essentials
            </span>
            <div className="text-2xl font-bold text-neutral-900">
              {summaryMetrics.activeCount} item{summaryMetrics.activeCount === 1 ? '' : 's'}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">Currently in routine</span>
          </div>

          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Running Out Soon (&lt; 14 days)
            </span>
            <div
              className={`text-2xl font-bold ${
                summaryMetrics.runningSoonCount > 0 ? 'text-amber-600' : 'text-neutral-900'
              }`}
            >
              {summaryMetrics.runningSoonCount} item{summaryMetrics.runningSoonCount === 1 ? '' : 's'}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">Due for replenishment</span>
          </div>

          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Estimated Monthly Consumption
            </span>
            <div className="text-2xl font-bold text-[#2D6A4F]">
              ৳ {summaryMetrics.estimatedMonthlyCost.toLocaleString()}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">
              Estimated usage rate / month
            </span>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 h-24 flex flex-col justify-between">
                <div className="h-3 w-28 bg-neutral-200 rounded" />
                <div className="h-7 w-16 bg-neutral-200 rounded" />
                <div className="h-2.5 w-24 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 h-64 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-16 bg-neutral-100 rounded" />
                  <div className="h-4 w-24 bg-neutral-200 rounded-full" />
                </div>
                <div className="space-y-2 my-auto">
                  <div className="h-5 w-3/4 bg-neutral-200 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-neutral-100 rounded" />
                  <div className="h-8 w-full bg-neutral-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-md mx-auto my-8 sm:my-12 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#EBF4F0] text-[#2D6A4F] flex items-center justify-center mx-auto mb-4 text-xl">
            📦
          </div>
          <h2 className="text-lg font-bold text-neutral-900">No active products in use</h2>
          <p className="text-xs text-neutral-500 mt-2 mb-6 leading-relaxed">
            You don't have any essential products currently being tracked. Add a new purchase or open an essential to start measuring how long it lasts and what it truly costs per day.
          </p>
          <Link
            to="/add-product"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-semibold transition-colors shadow-xs"
          >
            + Add First Essential
          </Link>
        </div>
      )}

      {/* Product Cards Grid */}
      {!loading && !error && sortedProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onMarkFinished={handleOpenFinishModal}
            />
          ))}
        </div>
      )}

      {/* Finish Usage Modal */}
      <FinishUsageModal
        product={modalProduct}
        isOpen={isModalOpen}
        onClose={handleCloseFinishModal}
        onFinished={loadActiveProducts}
      />
    </div>
  );
};
