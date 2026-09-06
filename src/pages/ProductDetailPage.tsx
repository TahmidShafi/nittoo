// ==============================================================================
// Nittoo Product Detail & Personal Report Page
// Personal Analytics Report, Weighted Cost/Day, Active Bottle, and Recharts Duration Trends
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
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-4 w-32 bg-neutral-200 rounded" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
          <div className="space-y-2 w-full max-w-md">
            <div className="h-4 w-36 bg-neutral-100 rounded" />
            <div className="h-8 w-64 bg-neutral-200 rounded" />
          </div>
          <div className="h-10 w-44 bg-neutral-200 rounded-xl shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col justify-between" />
          ))}
        </div>
        <div className="h-44 bg-white border border-neutral-200 rounded-2xl p-5" />
        <div className="h-64 bg-white border border-neutral-200 rounded-2xl p-5" />
      </div>
    );
  }

  // Error / Not Found State
  if (error || !history) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Unable to load essential</h2>
        <p className="text-xs text-neutral-500">{error || 'This product could not be found or you do not have permission to view it.'}</p>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="btn-press inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#24563F] transition-colors shadow-xs"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { product } = history;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-page-in">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/dashboard"
          className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors py-1"
        >
          <span>←</span>
          <span>Back to Essentials</span>
        </Link>
      </div>

      {/* Product Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-neutral-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-neutral-100/90 text-neutral-700">
              {product.category}
            </span>
            {product.brand && (
              <span className="text-xs text-neutral-500 font-medium">{product.brand}</span>
            )}
            {product.size_value && (
              <>
                <span className="text-neutral-300">•</span>
                <span className="text-xs text-neutral-500 font-medium">
                  {product.size_value} {product.size_unit}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            {product.name}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={handleLogNewBottle}
            className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Log Repeat Purchase</span>
          </button>
        </div>
      </div>

      {/* Active Bottle Hero Card OR No Active Bottle Banner */}
      {activeUsageData ? (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] animate-pulse" />
                <h2 className="text-base font-bold text-neutral-900">Current In-Use Bottle</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Opened on {formatDisplayDate(activeUsageData.active.opened_date)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeUsageData.urgencyState === 'overdue' ? (
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Overdue by {activeUsageData.overdueDays} day{activeUsageData.overdueDays === 1 ? '' : 's'}</span>
                </span>
              ) : activeUsageData.urgencyState === 'running_soon' ? (
                <span className="text-xs font-semibold text-[#2D6A4F] bg-[#EBF4F0] border border-[#2D6A4F]/20 px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                  <span>{activeUsageData.predictedRemaining} day{activeUsageData.predictedRemaining === 1 ? '' : 's'} left</span>
                </span>
              ) : (
                <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
                  First Cycle • Learning baseline
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="btn-press px-3.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
              >
                Mark Finished
              </button>
            </div>
          </div>

          {/* Progress Bar & Status */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <div className="flex justify-between items-center text-xs text-neutral-600">
              <span>
                Day <strong className="font-semibold text-neutral-900">{activeUsageData.daysUsed}</strong> in use
              </span>
              {activeUsageData.avgDuration !== null ? (
                <span className="font-medium text-neutral-700">
                  Target: ~{activeUsageData.avgDuration} days
                </span>
              ) : (
                <span className="italic text-neutral-400 text-[11px]">Collecting first cycle duration</span>
              )}
            </div>
            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
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
                <div className="h-full w-full bg-neutral-200/50 rounded-full" />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* No Active Bottle State */
        <div className="bg-[#EBF4F0]/50 border border-[#2D6A4F]/20 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">No bottle is currently in use</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Open a new bottle or log a repeat purchase to continue tracking this essential.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogNewBottle}
            className="btn-press px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs self-start sm:self-auto cursor-pointer"
          >
            + Start New Bottle
          </button>
        </div>
      )}

      {/* Summary Statistics Cards (Editorial Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* 1. Average Duration */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
            Average Lifespan
          </span>
          {summaryStats?.averageDuration !== null ? (
            <div className="mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                {summaryStats?.averageDuration}
              </span>
              <span className="text-xs text-neutral-500 ml-1">days</span>
            </div>
          ) : (
            <div className="text-xs font-semibold italic text-neutral-400 mt-2">
              Not enough data
            </div>
          )}
          <span className="text-[11px] text-neutral-400 mt-2 block">
            {history.finished_periods.length} finished cycle{history.finished_periods.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* 2. Weighted Average Cost Per Day */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
            Cost Per Day
          </span>
          {summaryStats?.weightedCostPerDay !== null ? (
            <div className="mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-[#2D6A4F] tracking-tight">
                ৳{summaryStats?.weightedCostPerDay}
              </span>
              <span className="text-xs text-neutral-500 ml-1">/ day</span>
            </div>
          ) : (
            <div className="text-xs font-semibold italic text-neutral-400 mt-2">
              Not enough data
            </div>
          )}
          <span className="text-[11px] text-neutral-400 mt-2 block">
            Weighted across completed cycles
          </span>
        </div>

        {/* 3. Total Spent */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
            Total Spent
          </span>
          <div className="mt-1">
            <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              ৳{summaryStats?.totalSpent.toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-2 block">
            {summaryStats?.purchaseCount} purchase{summaryStats?.purchaseCount === 1 ? '' : 's'} recorded
          </span>
        </div>

        {/* 4. Unit Rate */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
            Unit Rate
          </span>
          {summaryStats?.unitRate !== null && product.size_unit ? (
            <div className="mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                ৳{summaryStats?.unitRate}
              </span>
              <span className="text-xs text-neutral-500 ml-1">/ {product.size_unit}</span>
            </div>
          ) : (
            <div className="text-xs font-semibold italic text-neutral-400 mt-2">
              —
            </div>
          )}
          <span className="text-[11px] text-neutral-400 mt-2 block">
            Purchase price ÷ size
          </span>
        </div>
      </div>

      {/* Duration Trend Chart (Recharts) */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Duration Trends</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Historical lifespan across completed cycles (days).
          </p>
        </div>

        {chartData.length === 0 ? (
          <div className="h-44 w-full bg-neutral-50/80 border border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center p-6 text-center">
            <span className="text-2xl mb-1.5">📊</span>
            <p className="text-xs font-semibold text-neutral-700">
              Complete a cycle to view duration trends
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Historical trends appear automatically after marking a bottle as finished.
            </p>
          </div>
        ) : (
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F1" />
                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.15))]}
                  unit="d"
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0} days`, 'Lifespan Duration']}
                  labelFormatter={(label, items) => {
                    const item = items?.[0]?.payload as { finishedDate?: string } | undefined;
                    return `${label} • Finished ${item?.finishedDate ?? ''}`;
                  }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8ECE9',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar dataKey="duration" fill="#2D6A4F" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Completed Lifespans Timeline */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Completed Lifespans Timeline</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Chronological log of completed bottles and daily cost efficiency.
          </p>
        </div>

        {timelineData.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-6 text-center">
            No completed lifespans recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl overflow-hidden">
            {timelineData.map((cycle) => (
              <div
                key={cycle.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-neutral-900">Cycle #{cycle.cycleNumber}</span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-neutral-600 font-medium">
                      {cycle.openedDate} → {cycle.finishedDate}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Purchased on {cycle.purchaseDate}
                    {cycle.price !== null ? ` for ৳${cycle.price}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-6 sm:text-right">
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold tracking-wider">Duration</span>
                    <span className="font-bold text-neutral-900 text-sm">
                      {cycle.duration} days
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold tracking-wider">Cycle Cost/Day</span>
                    {cycle.cycleCostPerDay !== null ? (
                      <span className="font-bold text-[#2D6A4F] text-sm">
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
