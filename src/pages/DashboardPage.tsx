// ==============================================================================
// Nittoo Dashboard Page
// Linear-inspired High-Density Personal Consumption Workspace
// Predictable Header System, Compact Summary Strip, Filter Tabs, and Product Grid
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

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Notice banner passed from navigation
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
    let overdueCount = 0;
    let monthlyConsumptionTotal = 0;

    for (const p of products) {
      const metrics = getPredictionMetrics(p);
      if (metrics.isOverdue) {
        overdueCount++;
      } else if (
        metrics.predictedRemainingDays !== null &&
        metrics.predictedRemainingDays >= 0 &&
        metrics.predictedRemainingDays < 14
      ) {
        runningSoonCount++;
      }

      // Estimated Monthly Consumption: price / averageLifespan * 30
      if (metrics.averageLifespan !== null && metrics.averageLifespan > 0 && p.latest_purchase) {
        monthlyConsumptionTotal += (p.latest_purchase.price / metrics.averageLifespan) * 30;
      }
    }

    return {
      activeCount: products.length,
      runningSoonCount,
      overdueCount,
      estimatedMonthlyCost: Math.round(monthlyConsumptionTotal),
    };
  }, [products]);

  // Category Tabs List
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered Products based on search and category
  const filteredProducts = useMemo(() => {
    return sortedProducts.filter((p) => {
      const matchesCategory =
        selectedCategory === 'All' || p.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [sortedProducts, selectedCategory, searchQuery]);

  const handleOpenFinishModal = (product: ProductWithDetails) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseFinishModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* Notice Banner */}
      {infoNotice && (
        <div className="p-3.5 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs font-medium flex items-start justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span className="leading-relaxed">{infoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInfoNotice(null)}
            className="text-amber-600 hover:text-amber-900 text-sm font-bold ml-3 cursor-pointer"
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      {/* Predictable Header System (Section 5) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#2D6A4F] block mb-1">
            Personal Dashboard
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Your Essentials
          </h1>
          <p className="text-xs text-neutral-500 mt-1 max-w-xl">
            See what's running low, what it costs, and what you've learned.
          </p>
        </div>
        <div>
          <Link
            to="/add-product"
            className="btn-press inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer w-full sm:w-auto"
          >
            <span className="text-sm leading-none font-bold">+</span>
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl text-center max-w-md mx-auto space-y-2.5">
          <p className="text-xs font-semibold text-rose-900">Unable to load active essentials</p>
          <p className="text-[11px] text-rose-600">A connection issue occurred. Please try again.</p>
          <button
            type="button"
            onClick={loadActiveProducts}
            className="btn-press min-h-[36px] px-4 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#24563F] transition-colors shadow-xs cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Compact Summary Strip (Section 8) */}
      {!loading && !error && products.length > 0 && (
        <div className="bg-white border border-[#E8ECE9] rounded-xl p-4 sm:p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F0F2F1]">
          {/* Card 1: Active Essentials */}
          <div className="px-0 sm:px-5 first:pl-0 pb-3 sm:pb-0 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
              Active Essentials
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                {summaryMetrics.activeCount}
              </span>
              <span className="text-xs text-neutral-500 font-normal">
                in daily use
              </span>
            </div>
          </div>

          {/* Card 2: Attention */}
          <div className="px-0 sm:px-5 py-3 sm:py-0 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
              Attention
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  summaryMetrics.overdueCount > 0
                    ? 'text-rose-600'
                    : summaryMetrics.runningSoonCount > 0
                    ? 'text-amber-600'
                    : 'text-neutral-900'
                }`}
              >
                {summaryMetrics.overdueCount + summaryMetrics.runningSoonCount}
              </span>
              <span className="text-xs text-neutral-500 font-normal">
                {summaryMetrics.overdueCount > 0
                  ? `${summaryMetrics.overdueCount} overdue`
                  : summaryMetrics.runningSoonCount > 0
                  ? `${summaryMetrics.runningSoonCount} running out soon`
                  : 'all healthy'}
              </span>
            </div>
          </div>

          {/* Card 3: Estimated Monthly Consumption */}
          <div className="px-0 sm:px-5 last:pr-0 pt-3 sm:pt-0 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
              Est. Monthly Consumption
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                ৳{summaryMetrics.estimatedMonthlyCost}
              </span>
              <span className="text-xs text-neutral-500 font-normal">
                / month run rate
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {!loading && !error && products.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`btn-press px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#2D6A4F] text-white font-semibold shadow-xs'
                    : 'bg-white border border-[#E8ECE9] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[180px] sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search essentials..."
              className="w-full px-3 py-1.5 pl-8 rounded-lg border border-[#E8ECE9] text-xs bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10 transition-all placeholder:text-neutral-400"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8ECE9] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-neutral-100/80 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 bg-neutral-100/70 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State: Intentional, Calm Onboarding (Section 18) */}
      {!loading && !error && products.length === 0 && (
        <div className="bg-white border border-[#E8ECE9] rounded-xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-xs my-8">
          <div className="w-11 h-11 rounded-lg bg-[#EBF4F0] text-[#2D6A4F] flex items-center justify-center mx-auto text-lg shadow-xs">
            🧴
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">
              No active essentials
            </h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              Start tracking a product to learn how long it lasts.
            </p>
          </div>
          <div className="pt-1">
            <Link
              to="/add-product"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <span>+ Add Product</span>
            </Link>
          </div>
        </div>
      )}

      {/* No Search Results */}
      {!loading && !error && products.length > 0 && filteredProducts.length === 0 && (
        <div className="bg-white border border-[#E8ECE9] rounded-xl p-8 text-center max-w-sm mx-auto space-y-2">
          <p className="text-xs font-semibold text-neutral-800">No matching essentials found</p>
          <p className="text-[11px] text-neutral-500">
            No products match "{searchQuery}" in category "{selectedCategory}".
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="btn-press text-xs font-semibold text-[#2D6A4F] hover:underline pt-1 cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Active Essentials Product Grid (Responsive: grid-cols-1 on mobile) */}
      {!loading && !error && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onMarkFinished={handleOpenFinishModal}
            />
          ))}
        </div>
      )}

      {/* Finish Usage Modal Dialog */}
      <FinishUsageModal
        product={modalProduct}
        isOpen={isModalOpen}
        onClose={handleCloseFinishModal}
        onFinished={loadActiveProducts}
      />
    </div>
  );
};
