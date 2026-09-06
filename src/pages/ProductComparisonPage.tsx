// ==============================================================================
// Nittoo Product Comparison & Value Intelligence Page (/compare)
// Personal value & consumption comparison between two tracked essentials
// Strictly separates observed completed-cycle data from active estimates
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { buildComparisonReport, type ComparisonReport } from '../lib/comparison';
import { getConfidenceBadgeStyles } from '../lib/confidence';
import type { Product, ProductWithHistory } from '../types';

export const ProductComparisonPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const baseId = searchParams.get('base') || '';
  const targetId = searchParams.get('target') || '';

  // Data State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [historyA, setHistoryA] = useState<ProductWithHistory | null>(null);
  const [historyB, setHistoryB] = useState<ProductWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter for comparison product selector
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Load User Tracked Products
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadProducts() {
      try {
        const prods = await db.getAllUserProducts(user!.id);
        if (mounted) setAllProducts(prods);
      } catch (err) {
        console.error('Failed to load user products:', err);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, [user]);

  // 2. Load Histories for Base and Target Products (Batched)
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadHistories() {
      try {
        setLoading(true);
        setError(null);

        const promises: [
          Promise<ProductWithHistory | null>,
          Promise<ProductWithHistory | null>
        ] = [
          baseId ? db.getProductHistory(baseId, user!.id) : Promise.resolve(null),
          targetId ? db.getProductHistory(targetId, user!.id) : Promise.resolve(null),
        ];

        const [resA, resB] = await Promise.all(promises);

        if (!mounted) return;
        setHistoryA(resA);
        setHistoryB(resB);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load comparison data';
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadHistories();
    return () => {
      mounted = false;
    };
  }, [user, baseId, targetId]);

  // Build comparison report
  const report: ComparisonReport | null = useMemo(() => {
    if (!historyA || !historyB) return null;
    return buildComparisonReport(historyA, historyB);
  }, [historyA, historyB]);

  // Filter products for target selection
  const selectableProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (baseId && p.id === baseId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [allProducts, baseId, searchQuery]);

  const handleSelectBase = (product: Product) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('base', product.id);
    setSearchParams(newParams);
  };

  const handleSelectTarget = (product: Product) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('target', product.id);
    setSearchParams(newParams);
  };

  const handleClearTarget = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('target');
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-page-in">
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          to={baseId ? `/product/${baseId}` : '/dashboard'}
          className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors py-1"
        >
          <span>←</span>
          <span>{baseId ? 'Back to Product Detail' : 'Back to Dashboard'}</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="border-b border-neutral-200/80 pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] mb-1 block">
          VALUE INTELLIGENCE
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Product Comparison
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Compare personal value, unit economics, and observed consumption history between your tracked essentials.
        </p>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-press text-xs font-semibold px-2.5 py-1 bg-white border border-rose-300 rounded-lg hover:bg-rose-100/50"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-neutral-500">Loading product comparison data...</p>
        </div>
      ) : !baseId ? (
        /* STATE 0: SELECT BASE PRODUCT */
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
            Select Base Product to Compare
          </h2>
          <p className="text-xs text-neutral-500">
            Choose an essential from your portfolio as the reference product.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {allProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectBase(p)}
                className="btn-press text-left p-4 rounded-xl border border-neutral-200 hover:border-[#2D6A4F] hover:bg-[#EBF4F0]/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-sm font-bold text-neutral-900 group-hover:text-[#2D6A4F]">
                    {p.name}
                  </span>
                  <span className="text-xs text-neutral-500 block">
                    {[p.brand, p.category, p.size_value ? `${p.size_value} ${p.size_unit}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#2D6A4F] opacity-0 group-hover:opacity-100 transition-opacity">
                  Select →
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : !targetId || !historyB ? (
        /* STATE 1: BASE SELECTED, CHOOSE COMPARISON TARGET */
        <div className="space-y-6">
          {/* Base Product Card */}
          {historyA && (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Reference Essential
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900">
                    {historyA.product.name}
                  </h2>
                  {historyA.product.brand && (
                    <span className="text-xs font-medium text-neutral-500">
                      ({historyA.product.brand})
                    </span>
                  )}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                    {historyA.product.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('base');
                  setSearchParams(newParams);
                }}
                className="btn-press text-xs font-semibold text-[#2D6A4F] hover:underline self-start sm:self-auto cursor-pointer"
              >
                Change Reference Product
              </button>
            </div>
          )}

          {/* Target Selection Picker */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block">
                COMPARE PRODUCT
              </span>
              <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                Choose a product from your history to compare with {historyA?.product.name}
              </h3>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your tracked essentials by name, brand, or category..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 placeholder:text-neutral-400"
            />

            {/* Selectable Results */}
            <div className="divide-y divide-neutral-100 border border-neutral-200/60 rounded-xl max-h-80 overflow-y-auto">
              {selectableProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  No other essentials match your query.
                </div>
              ) : (
                selectableProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3.5 hover:bg-[#EBF4F0]/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {prod.name}
                        </span>
                        {prod.brand && (
                          <span className="text-xs text-neutral-500">
                            {prod.brand}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                          {prod.category}
                        </span>
                        {prod.size_value && (
                          <>
                            <span className="text-neutral-300">•</span>
                            <span>{prod.size_value} {prod.size_unit}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTarget(prod)}
                      className="btn-press px-3.5 py-1.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Compare →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : report ? (
        /* STATE 2: BOTH PRODUCTS LOADED -> COMPARISON VIEW */
        <div className="space-y-6">
          {/* Header Product Pair Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product A Card */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Reference Essential
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {report.productA.confidenceLabel}
                </span>
              </div>
              <h2 className="text-lg font-bold text-neutral-900">
                {report.productA.product.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                {report.productA.product.brand && (
                  <span className="font-medium text-neutral-700">
                    {report.productA.product.brand}
                  </span>
                )}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                  {report.productA.product.category}
                </span>
                {report.productA.sizeValue && (
                  <span>
                    {report.productA.sizeValue} {report.productA.sizeUnit}
                  </span>
                )}
              </div>
            </div>

            {/* Product B Card */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">
                  Comparison Essential
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF4F0] text-[#2D6A4F]">
                    {report.productB.confidenceLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearTarget}
                    className="text-xs font-semibold text-neutral-400 hover:text-neutral-700 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-neutral-900">
                {report.productB.product.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                {report.productB.product.brand && (
                  <span className="font-medium text-neutral-700">
                    {report.productB.product.brand}
                  </span>
                )}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                  {report.productB.product.category}
                </span>
                {report.productB.sizeValue && (
                  <span>
                    {report.productB.sizeValue} {report.productB.sizeUnit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cross-Category Advisory Notice */}
          {!report.isSameCategory && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-center gap-2 animate-page-in">
              <span>⚠️</span>
              <span>
                These products are from different categories ({report.productA.product.category} vs {report.productB.product.category}). Compare value metrics carefully.
              </span>
            </div>
          )}

          {/* NITTOO VALUE INSIGHT CALLOUT */}
          <div className="bg-white border-2 border-[#2D6A4F]/30 rounded-2xl p-5 sm:p-6 shadow-xs space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F]">
                  NITTOO VALUE INSIGHT
                </span>
              </div>
              {report.isEarlyData && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Early / Limited Data
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
              "{report.insightSummary}"
            </p>
            {report.confidenceNotice && (
              <p className="text-xs text-neutral-500 italic">
                {report.confidenceNotice}
              </p>
            )}
          </div>

          {/* COMPARISON METRICS GRID */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl divide-y divide-neutral-100 shadow-xs overflow-hidden">
            {/* 1. PURCHASE PRICE */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Purchase Price
                </span>
                <span className="text-xs text-neutral-500">Latest acquisition cost</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    ৳{report.productA.latestPurchasePrice?.toLocaleString() ?? '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Reference</span>
                </div>

                <div className="text-center">
                  {report.priceComparison && (
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border inline-block ${
                        report.priceComparison.absolute === 0
                          ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                          : report.priceComparison.absolute < 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {report.priceComparison.formattedDiff}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    ৳{report.productB.latestPurchasePrice?.toLocaleString() ?? '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Comparison</span>
                </div>
              </div>
            </div>

            {/* 2. VOLUME / SIZE */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Package Size
                </span>
                <span className="text-xs text-neutral-500">Container net quantity</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    {report.productA.sizeValue ? `${report.productA.sizeValue} ${report.productA.sizeUnit}` : '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Reference</span>
                </div>

                <div className="text-center">
                  <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full border border-neutral-200/60 inline-block">
                    {report.sizeComparison.formattedDiff}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    {report.productB.sizeValue ? `${report.productB.sizeValue} ${report.productB.sizeUnit}` : '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Comparison</span>
                </div>
              </div>
            </div>

            {/* 3. PRICE PER UNIT */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Price Per Unit
                </span>
                <span className="text-xs text-neutral-500">Bulk buying density</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    {report.productA.unitPriceLabel ?? '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Reference</span>
                </div>

                <div className="text-center">
                  {report.unitPriceComparison ? (
                    <span className="text-xs font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-full border border-neutral-200/60 inline-block">
                      {report.unitPriceComparison.formattedDiff}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Unavailable</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-sm sm:text-base font-bold text-neutral-900">
                    {report.productB.unitPriceLabel ?? '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Comparison</span>
                </div>
              </div>
            </div>

            {/* 4. OBSERVED LIFESPAN */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Observed Lifespan
                </span>
                <span className="text-xs text-neutral-500">Actual days lasted in completed cycles</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  {report.productA.observedAverageLifespan !== null ? (
                    <div>
                      <span className="text-sm sm:text-base font-bold text-neutral-900 block">
                        {report.productA.observedAverageLifespan} days
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-block mt-0.5 ${getConfidenceBadgeStyles(report.productA.confidenceState).badgeClass}`}
                        title={report.productA.confidenceSupporting}
                      >
                        {report.productA.confidenceLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Reference</span>
                </div>

                <div className="text-center">
                  {report.lifespanComparison ? (
                    <span className="text-xs font-semibold text-[#2D6A4F] bg-[#EBF4F0] px-2.5 py-1 rounded-full border border-[#2D6A4F]/20 inline-block">
                      {report.lifespanComparison.formattedDiff}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Requires completed cycles</span>
                  )}
                </div>

                <div className="text-right">
                  {report.productB.observedAverageLifespan !== null ? (
                    <div>
                      <span className="text-sm sm:text-base font-bold text-neutral-900 block">
                        {report.productB.observedAverageLifespan} days
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-block mt-0.5 ${getConfidenceBadgeStyles(report.productB.confidenceState).badgeClass}`}
                        title={report.productB.confidenceSupporting}
                      >
                        {report.productB.confidenceLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Comparison</span>
                </div>
              </div>
            </div>

            {/* 5. YOUR OBSERVED COST / DAY */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/40">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] block mb-0.5">
                  Your Cost / Day
                </span>
                <span className="text-xs text-neutral-500">True value for your actual usage</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  {report.productA.observedCostPerDay !== null ? (
                    <span className="text-base sm:text-lg font-bold text-neutral-900">
                      ৳{report.productA.observedCostPerDay.toFixed(2)}/day
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block">Reference</span>
                </div>

                <div className="text-center">
                  {report.costPerDayComparison ? (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-block ${
                        report.costPerDayComparison.absolute < 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : report.costPerDayComparison.absolute > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {report.costPerDayComparison.formattedDiff}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Requires completed cycles</span>
                  )}
                </div>

                <div className="text-right">
                  {report.productB.observedCostPerDay !== null ? (
                    <span className="text-base sm:text-lg font-bold text-neutral-900">
                      ৳{report.productB.observedCostPerDay.toFixed(2)}/day
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block">Comparison</span>
                </div>
              </div>
            </div>

            {/* 6. NORMALIZED MONTHLY CONSUMPTION */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Est. Monthly Consumption
                </span>
                <span className="text-xs text-neutral-500">Standardized 30-day run rate</span>
              </div>

              <div className="w-full sm:w-2/3 grid grid-cols-3 items-center gap-2">
                <div>
                  {report.productA.observedMonthlyConsumption !== null ? (
                    <span className="text-sm sm:text-base font-bold text-neutral-900">
                      ~৳{report.productA.observedMonthlyConsumption.toLocaleString()}/mo
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block">Reference</span>
                </div>

                <div className="text-center">
                  {report.monthlyConsumptionComparison ? (
                    <span className="text-xs font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-full border border-neutral-200 inline-block">
                      {report.monthlyConsumptionComparison.formattedDiff}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Requires completed cycles</span>
                  )}
                </div>

                <div className="text-right">
                  {report.productB.observedMonthlyConsumption !== null ? (
                    <span className="text-sm sm:text-base font-bold text-neutral-900">
                      ~৳{report.productB.observedMonthlyConsumption.toLocaleString()}/mo
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Learning</span>
                  )}
                  <span className="text-[10px] text-neutral-400 block">Comparison</span>
                </div>
              </div>
            </div>
          </div>

          {/* CURRENT / PREDICTED CONTEXT (Strictly separated from observed metrics) */}
          <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-neutral-200/60 pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Current Active Bottle Context (Non-Historical)
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-200/80 text-neutral-700">
                  Context Only — Never Substituted Into Historical Metrics
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Active container progress and predictions reflect in-flight status. Historical comparisons above are strictly grounded in completed cycles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product A Active Context */}
              <div className="bg-white border border-neutral-200/70 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  {report.productA.product.name}
                </span>
                {report.productA.activeUsageContext ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>Status:</span>
                      <span className="font-semibold text-emerald-700">Active container</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Opened on:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productA.activeUsageContext.openedDate}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Elapsed usage:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productA.activeUsageContext.elapsedDays} days
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Predicted remaining:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productA.activeUsageContext.predictedRemainingDays !== null
                          ? `~${report.productA.activeUsageContext.predictedRemainingDays} days`
                          : 'Learning (Requires completed cycle)'}
                      </span>
                    </div>
                    {report.productA.activeUsageContext.predictedFinishDate && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Predicted finish:</span>
                        <span className="font-medium text-neutral-900">
                          {report.productA.activeUsageContext.predictedFinishDate}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 italic py-2">
                    No active bottle currently in use.
                  </div>
                )}
              </div>

              {/* Product B Active Context */}
              <div className="bg-white border border-neutral-200/70 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F] block">
                  {report.productB.product.name}
                </span>
                {report.productB.activeUsageContext ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>Status:</span>
                      <span className="font-semibold text-emerald-700">Active container</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Opened on:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productB.activeUsageContext.openedDate}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Elapsed usage:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productB.activeUsageContext.elapsedDays} days
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Predicted remaining:</span>
                      <span className="font-medium text-neutral-900">
                        {report.productB.activeUsageContext.predictedRemainingDays !== null
                          ? `~${report.productB.activeUsageContext.predictedRemainingDays} days`
                          : 'Learning (Requires completed cycle)'}
                      </span>
                    </div>
                    {report.productB.activeUsageContext.predictedFinishDate && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Predicted finish:</span>
                        <span className="font-medium text-neutral-900">
                          {report.productB.activeUsageContext.predictedFinishDate}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 italic py-2">
                    No active bottle currently in use.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
