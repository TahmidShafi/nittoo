// ==============================================================================
// Nittoo Consumption Analytics Page
// Linear-inspired Insight-driven Consumption Workspace
// Predictable Header, Upcoming Depletions, Consumption Run Rate, Efficiency & Comparison
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

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-neutral-100 rounded" />
          <div className="h-7 w-48 bg-neutral-200/70 rounded-lg" />
          <div className="h-3 w-80 bg-neutral-100 rounded" />
        </div>
        <div className="space-y-4 pt-4">
          <div className="h-28 bg-white border border-[#E8ECE9] rounded-xl p-4" />
          <div className="h-24 bg-white border border-[#E8ECE9] rounded-xl p-4" />
          <div className="h-44 bg-white border border-[#E8ECE9] rounded-xl p-4" />
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-3">
        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-base font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-neutral-900">Error Loading Analytics</h2>
        <p className="text-xs text-neutral-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-press px-4 py-2 text-xs font-semibold rounded-lg bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-colors shadow-xs cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty Account State (Section 18)
  if (!hasProducts) {
    return (
      <div className="bg-white border border-[#E8ECE9] rounded-xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-xs my-8">
        <div className="w-11 h-11 rounded-lg bg-[#EBF4F0] text-[#2D6A4F] flex items-center justify-center mx-auto text-lg shadow-xs">
          📊
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-neutral-900 tracking-tight">
            Nothing to analyze yet
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            Complete a usage cycle and Nittoo will start learning your consumption patterns.
          </p>
        </div>
        <div className="pt-1">
          <Link
            to="/add-product"
            className="btn-press inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-[#2D6A4F] text-white hover:bg-[#24543F] transition-all shadow-xs cursor-pointer"
          >
            + Add Product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-page-in">
      {/* Header System (Section 5) */}
      <div className="pb-4 border-b border-[#F0F2F1]">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-[#2D6A4F] block mb-1">
          Consumption Intelligence
        </span>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Analytics
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5 max-w-xl">
          Understand your consumption patterns and what you'll likely need next.
        </p>
      </div>

      {/* SECTION 1: UPCOMING (Section 10) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-[#E8ECE9]">
          <h2 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
            Upcoming
          </h2>
          {upcomingPurchases.length > 0 ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              {upcomingPurchases.length} attention needed
            </span>
          ) : (
            <span className="text-[10px] font-medium text-neutral-400">
              Supply healthy
            </span>
          )}
        </div>

        {upcomingPurchases.length > 0 ? (
          <div className="divide-y divide-[#F0F2F1] bg-white border border-[#E8ECE9] rounded-xl px-4 py-1 shadow-xs">
            {upcomingPurchases.map((item) => (
              <div
                key={item.product.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
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
                    <span className="text-[10px] uppercase text-neutral-400 font-medium">
                      · {item.product.category}
                    </span>
                    {item.isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Overdue by {Math.abs(item.predictedRemainingDays)} days
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {item.predictedRemainingDays} days left
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Finish expected around {formatDisplayDate(item.predictedFinishDate)}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-sm font-bold text-neutral-900">
                    ৳{Math.round(item.estimatedNextPrice).toLocaleString()} est.
                  </span>
                  <span className="text-[10px] text-neutral-400 block">based on purchase history</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-white border border-[#E8ECE9] rounded-xl text-xs text-neutral-400 shadow-xs">
            No products are predicted to run out within the next 30 days.
          </div>
        )}
      </section>

      {/* SECTION 2: CONSUMPTION (Section 10) */}
      <section className="space-y-2.5">
        <div className="pb-1 border-b border-[#E8ECE9]">
          <h2 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
            Consumption
          </h2>
        </div>

        <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
                {monthlyConsumption !== null
                  ? `৳${Math.round(monthlyConsumption).toLocaleString()}`
                  : 'Not enough data'}
              </span>
              <span className="text-xs text-neutral-500 font-normal">/ month</span>
            </div>
            <span className="text-xs font-medium text-neutral-500 block mt-0.5">
              estimated run rate
            </span>
          </div>

          <p className="text-xs text-neutral-400 max-w-sm sm:text-right">
            Standardizes daily essential consumption into a steady 30-day run rate across products with completed lifespans.
          </p>
        </div>
      </section>

      {/* SECTION 3: EFFICIENCY (Section 10) */}
      <section className="space-y-2.5">
        <div className="pb-1 border-b border-[#E8ECE9]">
          <h2 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
            Efficiency
          </h2>
        </div>

        {costRankings.mostEfficient.length > 0 ? (
          <div className="bg-white border border-[#E8ECE9] rounded-xl px-4 py-1 shadow-xs divide-y divide-[#F0F2F1]">
            {costRankings.mostEfficient.map((item) => (
              <div
                key={item.product.id}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Link
                    to={`/product/${item.product.id}`}
                    className="font-medium text-neutral-900 hover:text-[#2D6A4F] transition-colors"
                  >
                    {item.product.brand && !item.product.name.toLowerCase().startsWith(item.product.brand.toLowerCase())
                      ? `${item.product.brand} `
                      : ''}
                    {item.product.name}
                  </Link>
                  <span className="text-[10px] text-neutral-400">
                    ({Math.round(item.averageLifespan)}d avg)
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-neutral-900">
                    ৳{item.costPerDay.toFixed(2)}/day
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-white border border-[#E8ECE9] rounded-xl text-xs text-neutral-400 shadow-xs">
            Complete usage cycles to view cost efficiency rankings.
          </div>
        )}
      </section>

      {/* SECTION 4: COST / DAY CHART (Section 10) */}
      <section className="space-y-2.5">
        <div className="pb-1 border-b border-[#E8ECE9]">
          <h2 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
            Cost / Day
          </h2>
        </div>

        <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs">
          {chartData.length > 0 ? (
            <div className="w-full pt-1">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#F0F2F1" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#888888' }}
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: '#E8ECE9' }}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fontSize: 10, fill: '#888888' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E8ECE9' }}
                    tickFormatter={(val) => `৳${val}`}
                  />
                  <Tooltip
                    formatter={(value) => [`৳${Number(value || 0).toFixed(2)} / day`, 'Cost Per Day']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E8ECE9',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      fontSize: '11px',
                    }}
                  />
                  <Bar
                    dataKey="costPerDay"
                    fill="#2D6A4F"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-400">
              Complete a usage cycle on your products to view the cost comparison chart.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
