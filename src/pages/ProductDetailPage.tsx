// ==============================================================================
// Nittoo Product Detail & Personal Report Page
// Personal Consumption Intelligence Report
// Predictable Header, Dominant Active State, Key Metrics Row, Recharts Trend & Timeline
// ==============================================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { formatDisplayDate } from '../lib/dateUtils';
import {
  calculateAverageLifespan,
  calculateCurrentDaysUsed,
  calculateUsageDuration,
  calculatePricePerUnit,
  calculateProgressPercent,
} from '../lib/prediction';
import { FinishUsageModal } from '../components/FinishUsageModal';
import type { ProductWithHistory, ProductWithDetails } from '../types';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState<ProductWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Finishing the Active Bottle
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await db.getProductHistory(id, user.id);
      if (!data) {
        setError('Product not found or you do not have permission to view it.');
      } else {
        setHistory(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load product history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations: Summary Statistics strictly using valid finished data
  const summaryStats = useMemo(() => {
    if (!history) return null;

    const { product, purchases, finished_periods } = history;

    // 1. Average Duration (strictly from finished periods)
    const averageDuration = calculateAverageLifespan(finished_periods);

    // 2. Weighted Average Cost Per Day:
    // total price of completed purchase cycles ÷ total completed usage days
    let totalCompletedPrice = 0;
    let totalCompletedDays = 0;

    for (const fp of finished_periods) {
      const duration = calculateUsageDuration(fp);
      if (duration !== null && duration > 0) {
        const linkedPurchase = purchases.find((pu) => pu.id === fp.purchase_id);
        if (linkedPurchase) {
          totalCompletedPrice += linkedPurchase.price;
          totalCompletedDays += duration;
        }
      }
    }

    const weightedCostPerDay =
      totalCompletedDays > 0
        ? Math.round((totalCompletedPrice / totalCompletedDays) * 100) / 100
        : null;

    // 3. Total Spent: sum of all purchases for this product
    const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);

    // 4. Number of Purchases
    const purchaseCount = purchases.length;

    // 5. Unit Rate: latest purchase price ÷ size_value (if size exists)
    const latestPurchase = purchases[0] || null;
    const unitRate =
      latestPurchase && product.size_value
        ? calculatePricePerUnit(latestPurchase.price, product.size_value)
        : null;

    return {
      averageDuration,
      weightedCostPerDay,
      totalSpent,
      purchaseCount,
      unitRate,
      latestPurchase,
    };
  }, [history]);

  // Active Usage Card Calculations
  const activeUsageData = useMemo(() => {
    if (!history?.active_usage) return null;

    const active = history.active_usage;
    const daysUsed = calculateCurrentDaysUsed(active.opened_date);
    const avgDuration = summaryStats?.averageDuration ?? null;

    let urgencyLabel = 'First Cycle';
    let urgencyState: 'overdue' | 'running_soon' | 'no_prediction' = 'no_prediction';
    let predictedRemaining: number | null = null;
    let isOverdue = false;
    let overdueDays = 0;

    if (avgDuration !== null && avgDuration > 0) {
      predictedRemaining = Math.round(avgDuration - daysUsed);
      if (predictedRemaining < 0) {
        isOverdue = true;
        overdueDays = Math.abs(predictedRemaining);
        urgencyState = 'overdue';
        urgencyLabel = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
      } else {
        urgencyState = 'running_soon';
        urgencyLabel = `${predictedRemaining} day${predictedRemaining === 1 ? '' : 's'} left`;
      }
    }

    const progress = avgDuration !== null ? calculateProgressPercent(daysUsed, avgDuration) : null;

    return {
      active,
      daysUsed,
      predictedRemaining,
      avgDuration,
      progress,
      isOverdue,
      overdueDays,
      urgencyLabel,
      urgencyState,
    };
  }, [history, summaryStats]);

  // Prepare Chart Data: Finished Periods sorted chronologically
  const chartData = useMemo(() => {
    if (!history || history.finished_periods.length === 0) return [];

    return [...history.finished_periods]
      .sort((a, b) => (a.finished_date || '').localeCompare(b.finished_date || ''))
      .map((fp, index) => {
        const duration = calculateUsageDuration(fp) ?? 0;
        return {
          cycle: `Cycle ${index + 1}`,
          finishedDate: formatDisplayDate(fp.finished_date || ''),
          duration,
        };
      });
  }, [history]);

  // Timeline Data: Detailed finished cycles sorted newest first
  const timelineData = useMemo(() => {
    if (!history || history.finished_periods.length === 0) return [];

    return [...history.finished_periods]
      .sort((a, b) => (b.finished_date || '').localeCompare(a.finished_date || ''))
      .map((fp, idx, arr) => {
        const duration = calculateUsageDuration(fp) ?? 0;
        const linkedPurchase = history.purchases.find((pu) => pu.id === fp.purchase_id);
        const cycleCostPerDay =
          duration > 0 && linkedPurchase
            ? Math.round((linkedPurchase.price / duration) * 100) / 100
            : null;

        return {
          id: fp.id,
          cycleNumber: arr.length - idx,
          openedDate: formatDisplayDate(fp.opened_date),
          finishedDate: formatDisplayDate(fp.finished_date || ''),
          duration,
          purchaseDate: linkedPurchase ? formatDisplayDate(linkedPurchase.purchase_date) : '—',
          price: linkedPurchase ? linkedPurchase.price : null,
          cycleCostPerDay,
        };
      });
  }, [history]);

  // Action: Navigate to Add Product with preselected context
  const handleLogNewBottle = () => {
    if (!history) return;
    navigate('/add-product', {
      state: { preselectedProductId: history.product.id },
    });
  };

  // Adapter for FinishUsageModal
  const modalProduct: ProductWithDetails | null = history
    ? {
        ...history.product,
        active_usage: history.active_usage,
        latest_purchase: history.purchases[0] || null,
        finished_periods: history.finished_periods,
      }
    : null;

  // Loading State Skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-28 bg-neutral-100 rounded" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/60">
          <div className="space-y-2 w-full max-w-sm">
            <div className="h-3 w-24 bg-neutral-100 rounded" />
            <div className="h-7 w-48 bg-neutral-200/70 rounded-lg" />
          </div>
          <div className="h-9 w-36 bg-neutral-200/60 rounded-lg shrink-0" />
        </div>
        <div className="h-28 bg-white border border-[#E8ECE9] rounded-xl p-4" />
        <div className="h-20 bg-white border border-[#E8ECE9] rounded-xl p-4" />
        <div className="h-56 bg-white border border-[#E8ECE9] rounded-xl p-4" />
      </div>
    );
  }

  // Error / Not Found State
  if (error || !history) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-base font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-neutral-900">Unable to load essential</h2>
        <p className="text-xs text-neutral-500">{error || 'This product could not be found or you do not have permission to view it.'}</p>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#24563F] transition-colors shadow-xs"
          >
            ← Back to Essentials
          </Link>
        </div>
      </div>
    );
  }

  const { product } = history;

  return (
    <div className="space-y-6 animate-page-in">
      {/* 1. PRODUCT HEADER & BREADCRUMB */}
      <div className="space-y-2">
        <div>
          <Link
            to="/dashboard"
            className="btn-press inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <span>←</span>
            <span>Essentials</span>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-[#F0F2F1]">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-neutral-400 mb-1">
              <span>{product.category}</span>
              {product.brand && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span>{product.brand}</span>
                </>
              )}
              {product.size_value && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span>{product.size_value} {product.size_unit}</span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              {product.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLogNewBottle}
              className="btn-press inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer w-full sm:w-auto"
            >
              <span className="text-sm leading-none font-bold">+</span>
              <span>Log Repeat Purchase</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. CURRENT BOTTLE / ACTIVE STATE (DOMINANT) */}
      {activeUsageData ? (
        <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
                Currently Using
              </span>
              <div className="flex items-baseline gap-3 flex-wrap">
                {activeUsageData.urgencyState === 'overdue' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                    <span className="text-xl sm:text-2xl font-bold text-rose-600 tracking-tight">
                      Overdue by {activeUsageData.overdueDays} day{activeUsageData.overdueDays === 1 ? '' : 's'}
                    </span>
                  </div>
                ) : activeUsageData.urgencyState === 'running_soon' && activeUsageData.predictedRemaining !== null ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        activeUsageData.predictedRemaining < 14 ? 'bg-amber-500' : 'bg-[#2D6A4F]'
                      }`}
                    />
                    <span className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                      {activeUsageData.predictedRemaining} days remaining
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-neutral-300 shrink-0" />
                    <span className="text-base font-semibold text-neutral-600">
                      First Cycle · Learning baseline
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {activeUsageData.avgDuration !== null ? (
                  <span>
                    <strong className="font-semibold text-neutral-800">{activeUsageData.avgDuration}-day</strong> average lifespan
                    <span className="text-neutral-300 mx-1.5">·</span>
                    Day {activeUsageData.daysUsed} in use (opened {formatDisplayDate(activeUsageData.active.opened_date)})
                  </span>
                ) : (
                  <span>Opened on {formatDisplayDate(activeUsageData.active.opened_date)} · Day {activeUsageData.daysUsed} in use</span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-press px-3 py-1.5 rounded-md bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium transition-colors self-start cursor-pointer"
            >
              Finish Bottle
            </button>
          </div>

          {/* Thin Progress Track */}
          <div className="h-[3px] w-full bg-neutral-100 rounded-full overflow-hidden">
            {activeUsageData.progress !== null ? (
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  activeUsageData.isOverdue
                    ? 'bg-rose-500 w-full'
                    : activeUsageData.predictedRemaining !== null && activeUsageData.predictedRemaining < 14
                    ? 'bg-amber-500'
                    : 'bg-[#2D6A4F]'
                }`}
                style={{ width: `${activeUsageData.progress}%` }}
              />
            ) : (
              <div className="h-full w-full bg-neutral-200/40 rounded-full" />
            )}
          </div>
        </div>
      ) : (
        /* No Active Bottle State */
        <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">No active bottle</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Open a new bottle or record a repeat purchase to start tracking this cycle.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogNewBottle}
            className="btn-press px-3.5 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs self-start sm:self-auto cursor-pointer"
          >
            + Start New Bottle
          </button>
        </div>
      )}

      {/* 3. KEY METRICS (High-density strip with clear typographic weight) */}
      <div className="bg-white border border-[#E8ECE9] rounded-xl p-4 sm:p-5 shadow-xs grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F0F2F1]">
        {/* Metric 1: Average Lifespan */}
        <div className="px-0 sm:px-4 first:pl-0 pb-3 sm:pb-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
            Average Lifespan
          </span>
          {summaryStats?.averageDuration !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                {summaryStats?.averageDuration}
              </span>
              <span className="text-xs text-neutral-500 font-normal">days</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-neutral-400 italic">Not enough data</span>
          )}
          <span className="text-[10px] text-neutral-400 mt-1">
            {history.finished_periods.length} cycle{history.finished_periods.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Metric 2: Cost Per Day */}
        <div className="px-0 sm:px-4 pt-3 sm:pt-0 pb-3 sm:pb-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
            Cost / Day
          </span>
          {summaryStats?.weightedCostPerDay !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                ৳{summaryStats?.weightedCostPerDay}
              </span>
              <span className="text-xs text-neutral-500 font-normal">/day</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-neutral-400 italic">Not enough data</span>
          )}
          <span className="text-[10px] text-neutral-400 mt-1">Weighted average</span>
        </div>

        {/* Metric 3: Total Spent */}
        <div className="px-0 sm:px-4 pt-3 sm:pt-0 pb-3 sm:pb-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
            Total Spent
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              ৳{summaryStats?.totalSpent.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1">All recorded purchases</span>
        </div>

        {/* Metric 4: Purchases */}
        <div className="px-0 sm:px-4 last:pr-0 pt-3 sm:pt-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block mb-1">
            Purchases
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              {summaryStats?.purchaseCount}
            </span>
            <span className="text-xs text-neutral-500 font-normal">bottles</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1">
            {summaryStats?.unitRate && product.size_unit
              ? `৳${summaryStats.unitRate}/${product.size_unit}`
              : 'Purchase history'}
          </span>
        </div>
      </div>

      {/* 4. LIFESPAN TREND (Recharts) */}
      <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Lifespan Trend</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Historical cycle duration (days)</p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-8 bg-neutral-50/60 border border-dashed border-[#E8ECE9] rounded-lg text-center">
            <p className="text-xs font-semibold text-neutral-600">
              Complete a cycle to view duration trends
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Historical trends will appear automatically after marking your first bottle as finished.
            </p>
          </div>
        ) : (
          <div className="h-48 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#F0F2F1" />
                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 10, fill: '#888888' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8ECE9' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888888' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8ECE9' }}
                  domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.15))]}
                  unit="d"
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0} days`, 'Duration']}
                  labelFormatter={(label, items) => {
                    const item = items?.[0]?.payload as { finishedDate?: string } | undefined;
                    return `${label} · Finished ${item?.finishedDate ?? ''}`;
                  }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8ECE9',
                    borderRadius: '8px',
                    fontSize: '11px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar dataKey="duration" fill="#2D6A4F" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. HISTORY (Clean timeline list with separators rather than chunky boxes) */}
      <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs space-y-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Completed Lifespans</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Chronological log of completed usage cycles</p>
        </div>

        {timelineData.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-4 text-center">
            No completed lifespans recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-[#F0F2F1] border-t border-[#F0F2F1]">
            {timelineData.map((cycle) => (
              <div
                key={cycle.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-neutral-50/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">Cycle #{cycle.cycleNumber}</span>
                    <span className="text-neutral-300">·</span>
                    <span className="text-neutral-600">
                      {cycle.openedDate} → {cycle.finishedDate}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Purchased on {cycle.purchaseDate}
                    {cycle.price !== null ? ` for ৳${cycle.price}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-5 sm:text-right">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Duration</span>
                    <span className="font-semibold text-neutral-900 text-xs">
                      {cycle.duration} days
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Cost / Day</span>
                    {cycle.cycleCostPerDay !== null ? (
                      <span className="font-semibold text-[#2D6A4F] text-xs">
                        ৳{cycle.cycleCostPerDay}/day
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reusable Finish Modal */}
      <FinishUsageModal
        product={modalProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFinished={loadData}
      />
    </div>
  );
};
