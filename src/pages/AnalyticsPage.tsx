// ==============================================================================
// Nittoo Consumption Analytics Page
// Cross-product consumption insights, run rates, and upcoming depletion alerts
// ==============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { calculateConfidence, getConfidenceBadgeStyles } from '../lib/confidence';
import type { ProductWithHistory } from '../types';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stale-while-revalidate refs
  const isInitialLoad = useRef(true);
  const lastRefetchTimeRef = useRef(Date.now());

  const [upcomingPurchases, setUpcomingPurchases] = useState<UpcomingPurchaseItem[]>([]);
  const [monthlyConsumption, setMonthlyConsumption] = useState<number | null>(null);
  const [costRankings, setCostRankings] = useState<{
    mostEfficient: ProductCostEfficiency[];
    leastEfficient: ProductCostEfficiency[];
  }>({ mostEfficient: [], leastEfficient: [] });
  const [chartData, setChartData] = useState<CostComparisonChartPoint[]>([]);
  const [hasProducts, setHasProducts] = useState(true);

  const loadAnalyticsData = useCallback(
    async (isSilent = false) => {
      if (!user?.id) return;

      if (isInitialLoad.current && !isSilent) {
        setLoading(true);
      }

      try {
        const products = await db.getAllUserProducts(user.id);
        if (products.length === 0) {
          setHasProducts(false);
          setUpcomingPurchases([]);
          setMonthlyConsumption(null);
          setCostRankings({ mostEfficient: [], leastEfficient: [] });
          setChartData([]);
          setError(null);
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
        setError(null);
      } catch (err: unknown) {
        console.error('Failed to load analytics data:', err);
        if (isInitialLoad.current) {
          setError('Unable to load analytics data. Please try again later.');
        }
      } finally {
        isInitialLoad.current = false;
        setLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Silent background revalidation on window focus / tab return
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefetchTimeRef.current >= 3000) {
          lastRefetchTimeRef.current = now;
          loadAnalyticsData(true);
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [loadAnalyticsData]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
        <div className="space-y-2">
          <div className="h-8 bg-neutral-200/60 rounded-xl w-64" />
          <div className="h-4 bg-neutral-100 rounded-lg w-96" />
        </div>
        <div className="h-48 bg-white border border-neutral-200/80 rounded-2xl p-6" />
        <div className="h-32 bg-white border border-neutral-200/80 rounded-2xl p-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 h-48" />
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 h-48" />
        </div>
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 h-64" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Error Loading Analytics</h2>
        <p className="text-xs text-neutral-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-press min-h-[42px] px-6 py-2.5 text-xs font-semibold rounded-xl bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-colors shadow-xs cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty Account State
  if (!hasProducts) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 sm:py-16 bg-white border border-neutral-200/80 rounded-3xl p-8 sm:p-12 shadow-xs my-8 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#EBF4F0] text-[#2D6A4F] flex items-center justify-center mx-auto text-2xl shadow-xs">
          📊
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Nothing to analyze yet
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
            Complete your first product usage cycles and Nittoo will start computing your true daily costs, restock forecasts, and consumption patterns.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/add-product"
            className="btn-press inline-flex items-center justify-center min-h-[42px] px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-all shadow-xs cursor-pointer"
          >
            + Add Your First Essential
          </Link>
        </div>
      </div>
    );
  }

  const eligibleCount = costRankings.mostEfficient.length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-page-in">
      {/* Page Header */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block mb-1">
          Consumption Intelligence
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Analytics & Forecasting
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Daily cost-of-ownership, baseline monthly run rate, and smart re-order timelines.
        </p>
      </div>

      {/* Priority 1: UPCOMING PURCHASES */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Upcoming Depletions (Next 30 Days)</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Products predicted to run out soon based on completed historical lifespans.
            </p>
          </div>
          {upcomingPurchases.length > 0 ? (
            <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
              {upcomingPurchases.length} Needs Attention
            </span>
          ) : (
            <span className="self-start sm:self-auto text-xs font-medium px-3 py-1 bg-[#EBF4F0] text-[#2D6A4F] rounded-full border border-[#2D6A4F]/20">
              Supply Healthy
            </span>
          )}
        </div>

        {upcomingPurchases.length > 0 ? (
          <div className="border border-neutral-100 rounded-xl divide-y divide-neutral-100 overflow-hidden">
            {upcomingPurchases.map((item) => (
              <div
                key={item.product.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-bold text-neutral-900 hover:text-[#2D6A4F] text-sm transition-colors"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-medium">
                      {item.product.category}
                    </span>
                    {item.isOverdue ? (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        <span>Overdue by {Math.abs(item.predictedRemainingDays)} day{Math.abs(item.predictedRemainingDays) === 1 ? '' : 's'}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{item.predictedRemainingDays} day{item.predictedRemainingDays === 1 ? '' : 's'} left</span>
                      </span>
                    )}
                  </div>
                  <div className="text-neutral-500 text-[11px] flex items-center gap-1.5 flex-wrap">
                    <span>
                      {item.isOverdue ? (
                        <>Predicted finish was <strong className="font-semibold text-neutral-800">{formatDisplayDate(item.predictedFinishDate)}</strong></>
                      ) : (
                        <>Predicted finish: <strong className="font-semibold text-neutral-800">{formatDisplayDate(item.predictedFinishDate)}</strong></>
                      )}
                    </span>
                    {(() => {
                      const conf = calculateConfidence(item.completedCycles);
                      const badgeStyles = getConfidenceBadgeStyles(conf.state);
                      return (
                        <>
                          <span className="text-neutral-300">•</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeStyles.badgeClass}`}
                            title={conf.semanticMeaning}
                          >
                            {conf.label}
                          </span>
                          <span className="text-neutral-400 text-[10px]">
                            ({conf.supportingText})
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block tracking-wider">Estimated next rebuy</span>
                  <div className="font-bold text-neutral-900 text-base">
                    ৳{Math.round(item.estimatedNextPrice).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-neutral-400 block">(from purchase history)</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-neutral-50/70 border border-dashed border-neutral-200/80 rounded-xl">
            <p className="text-xs text-neutral-700 font-semibold">
              No products are expected to run out within the next 30 days.
            </p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto">
              All active essentials have sufficient supply or are building their baseline lifespan.
            </p>
          </div>
        )}
      </div>

      {/* Priority 2: PRIMARY METRIC: ESTIMATED MONTHLY CONSUMPTION COST */}
      <div className="bg-[#EBF4F0]/60 border border-[#2D6A4F]/25 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block">
            Baseline Run Rate
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Estimated Monthly Consumption
          </h2>
          <p className="text-xs text-neutral-600 max-w-xl leading-relaxed">
            Standardizes your essential consumption into a steady 30-day run rate based on completed bottle lifespans. Reflects ongoing daily usage rather than lump-sum shopping totals.
          </p>
          {monthlyConsumption !== null && (
            <p className="text-[11px] text-[#2D6A4F] font-semibold pt-1">
              ✓ Calculated across {eligibleCount} product{eligibleCount === 1 ? '' : 's'} with completed lifespans.
            </p>
          )}
        </div>

        <div className="text-left sm:text-right shrink-0">
          {monthlyConsumption !== null ? (
            <>
              <div className="text-3xl sm:text-4xl font-black text-[#2D6A4F] tracking-tight">
                ৳{Math.round(monthlyConsumption).toLocaleString()}
              </div>
              <span className="text-xs text-neutral-500 font-medium">/ month normalized</span>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-neutral-500">Not enough data</div>
              <span className="text-xs text-neutral-400">Complete a cycle to calculate</span>
            </>
          )}
        </div>
      </div>

      {/* Priority 3: COST EFFICIENCY RANKINGS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Most Cost-Efficient */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              <h3 className="text-sm font-bold text-neutral-900">
                Most Cost-Efficient Essentials
              </h3>
            </div>
            <p className="text-xs text-neutral-500">Lowest daily cost of ownership</p>
          </div>

          {costRankings.mostEfficient.length > 0 ? (
            <div className="space-y-2 divide-y divide-neutral-100">
              {costRankings.mostEfficient.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-xs py-2.5 first:pt-0"
                >
                  <div className="pr-2">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-semibold text-neutral-900 hover:text-[#2D6A4F] transition-colors block"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-[11px] text-neutral-400">
                      Avg: {Math.round(item.averageLifespan)}d · ~৳{Math.round(item.monthlyCost)}/mo
                    </span>
                  </div>
                  <span className="font-bold text-[#2D6A4F] shrink-0 text-sm">
                    ৳{item.costPerDay.toFixed(2)}/day
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-xl">
              <p className="text-xs text-neutral-400">
                Complete usage cycles to view cost efficiency rankings.
              </p>
            </div>
          )}
        </div>

        {/* Least Cost-Efficient */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-sm font-bold text-neutral-900">
                Highest Daily Cost Essentials
              </h3>
            </div>
            <p className="text-xs text-neutral-500">Highest daily cost of ownership</p>
          </div>

          {costRankings.leastEfficient.length > 0 ? (
            <div className="space-y-2 divide-y divide-neutral-100">
              {costRankings.leastEfficient.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-xs py-2.5 first:pt-0"
                >
                  <div className="pr-2">
                    <Link
                      to={`/product/${item.product.id}`}
                      className="font-semibold text-neutral-900 hover:text-[#2D6A4F] transition-colors block"
                    >
                      {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                        ? `${item.product.brand} `
                        : ''}
                      {item.product.name}
                    </Link>
                    <span className="text-[11px] text-neutral-400">
                      Avg: {Math.round(item.averageLifespan)}d · ~৳{Math.round(item.monthlyCost)}/mo
                    </span>
                  </div>
                  <span className="font-bold text-amber-800 shrink-0 text-sm">
                    ৳{item.costPerDay.toFixed(2)}/day
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-xl">
              <p className="text-xs text-neutral-400">
                Complete usage cycles to view cost efficiency rankings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Priority 4: COST PER DAY COMPARISON CHART */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-900">Cost Per Day Comparison</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Normalized cost per day across essentials with completed lifespans (৳/day).
          </p>
        </div>

        {chartData.length > 0 ? (
          <div className="w-full pt-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F1" />
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
                  formatter={(value) => [`৳${Number(value || 0).toFixed(2)} / day`, 'Cost Per Day']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E8ECE9',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="costPerDay"
                  fill="#2D6A4F"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 w-full bg-neutral-50/80 border border-dashed border-neutral-200 rounded-xl flex items-center justify-center text-xs text-neutral-400 text-center px-4">
            Complete a usage cycle on your products to view the cost comparison chart.
          </div>
        )}
      </div>
    </div>
  );
};
