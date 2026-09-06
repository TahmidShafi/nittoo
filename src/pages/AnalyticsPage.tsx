// ==============================================================================
// Nittoo Consumption Analytics Page (Stage 6)
// Cross-product consumption insights, run rates, and upcoming depletion alerts
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { formatDisplayDate } from '../lib/dateUtils';
import {
  getUpcomingPurchases,
  calculateEstimatedMonthlyConsumption,
  getCostEfficiencyRankings,
  getCostComparisonChartData,
  type UpcomingPurchaseItem,
  type ProductCostEfficiency,
  type CostComparisonChartPoint,
} from '../lib/analytics';
import type { ProductWithHistory } from '../types';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [upcomingPurchases, setUpcomingPurchases] = useState<UpcomingPurchaseItem[]>([]);
  const [monthlyConsumption, setMonthlyConsumption] = useState<number | null>(null);
  const [costRankings, setCostRankings] = useState<{
    mostEfficient: ProductCostEfficiency[];
    leastEfficient: ProductCostEfficiency[];
  }>({ mostEfficient: [], leastEfficient: [] });
  const [chartData, setChartData] = useState<CostComparisonChartPoint[]>([]);
  const [hasProducts, setHasProducts] = useState(true);

  useEffect(() => {
    async function loadAnalyticsData() {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        const products = await db.getAllUserProducts(user.id);
        if (products.length === 0) {
          setHasProducts(false);
          setUpcomingPurchases([]);
          setMonthlyConsumption(null);
          setCostRankings({ mostEfficient: [], leastEfficient: [] });
          setChartData([]);
          setLoading(false);
          return;
        }

        setHasProducts(true);

        const historyPromises = products.map((p) => db.getProductHistory(p.id, user.id));
        const histories = await Promise.all(historyPromises);
        const validHistories = histories.filter((h): h is ProductWithHistory => h !== null);

        // Compute pure analytics metrics
        const upcoming = getUpcomingPurchases(validHistories);
        const monthly = calculateEstimatedMonthlyConsumption(validHistories);
        const rankings = getCostEfficiencyRankings(validHistories);
        const chartPoints = getCostComparisonChartData(validHistories);

        setUpcomingPurchases(upcoming);
        setMonthlyConsumption(monthly);
        setCostRankings(rankings);
        setChartData(chartPoints);
      } catch (err: unknown) {
        console.error('Failed to load analytics data:', err);
        setError('Unable to load analytics data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    loadAnalyticsData();
  }, [user]);

  // ----------------------------------------------------------------------------
  // Loading Skeleton State
  // ----------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
        <div>
          <div className="h-8 bg-neutral-200 rounded w-64 mb-2" />
          <div className="h-4 bg-neutral-100 rounded w-96" />
        </div>

        {/* Skeleton: Upcoming Purchases */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 bg-neutral-200 rounded w-44" />
            <div className="h-5 bg-neutral-100 rounded-full w-20" />
          </div>
          <div className="h-20 bg-neutral-50 rounded-lg border border-neutral-100" />
        </div>

        {/* Skeleton: Hero Metric */}
        <div className="bg-[#EBF4F0]/60 border border-[#2D6A4F]/20 rounded-xl p-6 shadow-xs flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-4 bg-[#2D6A4F]/20 rounded w-24" />
            <div className="h-6 bg-neutral-300 rounded w-64" />
            <div className="h-3 bg-neutral-200 rounded w-80" />
          </div>
          <div className="h-10 bg-[#2D6A4F]/20 rounded w-32" />
        </div>

        {/* Skeleton: Cost Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-neutral-200/80 rounded-xl p-6 h-40" />
          <div className="bg-white border border-neutral-200/80 rounded-xl p-6 h-40" />
        </div>

        {/* Skeleton: Chart */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 h-64" />
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // Error State
  // ----------------------------------------------------------------------------
  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Error Loading Analytics</h2>
        <p className="text-xs text-neutral-600 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-colors shadow-xs"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // Empty Account State
  // ----------------------------------------------------------------------------
  if (!hasProducts) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 sm:py-16 bg-white border border-neutral-200/80 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">No Essentials Tracked Yet</h2>
        <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
          You have not added any products yet. Add your daily essentials and complete usage cycles to calculate true cost per day and baseline consumption run rates.
        </p>
        <Link
          to="/add-product"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-colors shadow-xs"
        >
          + Add Your First Essential
        </Link>
      </div>
    );
  }

  const eligibleCount = costRankings.mostEfficient.length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Consumption Analytics
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          True cost-per-day insights, baseline monthly consumption, and upcoming purchases.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. UPCOMING PURCHASES (Layout Priority 1)                                */}
      {/* ========================================================================= */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Upcoming Purchases</h2>
            <p className="text-xs text-neutral-500">
              Products predicted to run out within the next 30 days based on completed lifespans.
            </p>
          </div>
          {upcomingPurchases.length > 0 ? (
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
              {upcomingPurchases.length} Upcoming
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full">
              None
            </span>
          )}
        </div>

        {upcomingPurchases.length > 0 ? (
          <div className="border border-neutral-100 rounded-lg divide-y divide-neutral-100">
            {upcomingPurchases.map((item) => (
              <div
                key={item.product.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm hover:bg-neutral-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-semibold text-neutral-900 hover:text-[#2D6A4F] transition-colors"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                      {item.product.category}
                    </span>
                    {item.isOverdue ? (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Overdue by {Math.abs(item.predictedRemainingDays)} day{Math.abs(item.predictedRemainingDays) === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {item.predictedRemainingDays} day{item.predictedRemainingDays === 1 ? '' : 's'} left
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {item.isOverdue ? (
                      <>Predicted finish: <span className="font-medium text-neutral-700">{formatDisplayDate(item.predictedFinishDate)}</span> (depleted)</>
                    ) : (
                      <>Predicted finish: <span className="font-medium text-neutral-700">{formatDisplayDate(item.predictedFinishDate)}</span></>
                    )}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-xs text-neutral-500 block">Estimated next purchase:</span>
                  <div className="font-semibold text-neutral-900 text-base">
                    ৳{Math.round(item.estimatedNextPrice).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-neutral-400 block">(from purchase history)</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-lg">
            <p className="text-xs text-neutral-600 font-medium">
              No products are expected to run out within the next 30 days.
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              All active essentials have sufficient supply or are in their first cycle.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. PRIMARY METRIC: ESTIMATED MONTHLY CONSUMPTION COST                    */}
      {/* ========================================================================= */}
      <div className="bg-[#EBF4F0]/70 border border-[#2D6A4F]/25 rounded-xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] block">
            Primary Metric
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
            Estimated Monthly Consumption Cost
          </h2>
          <p className="text-xs text-neutral-600 max-w-xl leading-relaxed">
            Normalizes your essentials consumption into an estimated monthly run rate based on completed usage cycles. Reflects sustained household usage rather than lumpy shopping trips.
          </p>
          {monthlyConsumption !== null && (
            <p className="text-[11px] text-[#2D6A4F] font-medium pt-1">
              Calculated across {eligibleCount} product{eligibleCount === 1 ? '' : 's'} with completed lifespans.
            </p>
          )}
        </div>

        <div className="text-left sm:text-right shrink-0">
          {monthlyConsumption !== null ? (
            <>
              <div className="text-3xl sm:text-4xl font-black text-[#2D6A4F] tracking-tight">
                ৳{Math.round(monthlyConsumption).toLocaleString()}
              </div>
              <span className="text-xs text-neutral-500 font-medium">per month (est.)</span>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-neutral-600">Not enough data</div>
              <span className="text-xs text-neutral-400">Complete a cycle to calculate</span>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COST EFFICIENCY RANKINGS (Layout Priority 3)                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Most Cost-Efficient */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              Most Cost-Efficient Products
            </h3>
            <p className="text-xs text-neutral-500">Lowest daily cost of ownership</p>
          </div>

          {costRankings.mostEfficient.length > 0 ? (
            <div className="space-y-2 pt-2 divide-y divide-neutral-100">
              {costRankings.mostEfficient.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-xs py-2.5 first:pt-1"
                >
                  <div className="pr-2">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-medium text-neutral-800 hover:text-[#2D6A4F] transition-colors block"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-[11px] text-neutral-400">
                      Lifespan: {Math.round(item.averageLifespan)}d · ~৳{Math.round(item.monthlyCost)}/mo
                    </span>
                  </div>
                  <span className="font-semibold text-[#2D6A4F] shrink-0 text-sm">
                    ৳{item.costPerDay.toFixed(2)} / day
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-lg">
              <p className="text-xs text-neutral-500">
                Complete product usage cycles to view cost efficiency rankings.
              </p>
            </div>
          )}
        </div>

        {/* Least Cost-Efficient */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Least Cost-Efficient Products
            </h3>
            <p className="text-xs text-neutral-500">Highest daily cost of ownership</p>
          </div>

          {costRankings.leastEfficient.length > 0 ? (
            <div className="space-y-2 pt-2 divide-y divide-neutral-100">
              {costRankings.leastEfficient.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-xs py-2.5 first:pt-1"
                >
                  <div className="pr-2">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-medium text-neutral-800 hover:text-[#2D6A4F] transition-colors block"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-[11px] text-neutral-400">
                      Lifespan: {Math.round(item.averageLifespan)}d · ~৳{Math.round(item.monthlyCost)}/mo
                    </span>
                  </div>
                  <span className="font-semibold text-amber-800 shrink-0 text-sm">
                    ৳{item.costPerDay.toFixed(2)} / day
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-lg">
              <p className="text-xs text-neutral-500">
                Complete product usage cycles to view cost efficiency rankings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. COST PER DAY COMPARISON CHART (Layout Priority 4)                     */}
      {/* ========================================================================= */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Cost Per Day Comparison</h3>
          <p className="text-xs text-neutral-500">
            Comparing products with completed lifespans (৳/day).
          </p>
        </div>

        {chartData.length > 0 ? (
          <div className="w-full pt-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(val) => `৳${val}`}
                />
                <Tooltip
                  formatter={(value) => [`৳${Number(value || 0).toFixed(2)} / day`, 'Cost / Day']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="costPerDay"
                  fill="#2D6A4F"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 w-full bg-neutral-50 border border-dashed border-neutral-200 rounded-lg flex items-center justify-center text-xs text-neutral-500 text-center px-4">
            Complete a usage cycle on your products to view the cost comparison chart.
          </div>
        )}
      </div>
    </div>
  );
};
