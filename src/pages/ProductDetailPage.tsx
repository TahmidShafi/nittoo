// ==============================================================================
// Nittoo Product Detail & Personal Report Page
// Personal Analytics Report, Weighted Cost/Day, Active Bottle, and Recharts Duration Trends
// ==============================================================================

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { usePageMeta } from '../hooks/usePageMeta';
import { db } from '../lib/dataSource';
import { formatDisplayDate } from '../lib/dateUtils';
import {
  calculateCurrentDaysUsed,
  calculatePredictedLifespan,
  calculatePricePerUnit,
  calculateProgressPercent,
  calculateRunOutRange,
  calculateUsageDuration,
  formatRunOutRange,
  getEffectiveSize,
  getValidFinishedPeriods,
} from '../lib/prediction';
import { calculateConfidence, getConfidenceBadgeStyles } from '../lib/confidence';
import {
  calculateExpectedFinishDate,
  getRestockDisplayStatus,
  getRestockStatusInfo,
  getRelativeOptionLabel,
  recalculatePlanReminderDate,
} from '../lib/restock';
import { FinishUsageModal, type FinishUsageSummary } from '../components/FinishUsageModal';
import { Toast } from '../components/Toast';
import { LifespanBar } from '../components/LifespanBar';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { EditInventoryModal } from '../components/EditInventoryModal';
import { EditCompletedCycleModal } from '../components/EditCompletedCycleModal';
import { DeleteCompletedCycleModal } from '../components/DeleteCompletedCycleModal';
import { PlanRestockModal } from '../components/PlanRestockModal';
import { dataCache, areValuesEqual } from '../lib/dataCache';
import type { ProductWithHistory, ProductWithDetails, Purchase, UsagePeriod, RestockPlan } from '../types';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Instant SWR state initialization from in-memory cache
  const cachedEntry = user?.id && id ? dataCache.get<ProductWithHistory>(user.id, `product:${id}`) : null;

  const [history, setHistory] = useState<ProductWithHistory | null>(() => cachedEntry?.data ?? null);

  usePageMeta({
    title: history?.product ? history.product.name : 'Essential Details',
    noindex: true,
  });

  const [loading, setLoading] = useState<boolean>(() => !cachedEntry);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Stale-while-revalidate refs
  const isInitialLoad = useRef(!cachedEntry);
  const lastRefetchTimeRef = useRef(Date.now());

  // Unopened Purchase Action State
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal State for Finishing the Active Bottle
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [finishToast, setFinishToast] = useState<string | null>(null);

  // Modal State for Editing Current Inventory
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<'active_bottle' | 'unopened'>('active_bottle');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingUsagePeriod, setEditingUsagePeriod] = useState<UsagePeriod | null>(null);

  // Modal State for Editing / Deleting Completed Historical Cycles (Stage 17)
  const [isEditCycleModalOpen, setIsEditCycleModalOpen] = useState(false);
  const [isDeleteCycleModalOpen, setIsDeleteCycleModalOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<UsagePeriod | null>(null);
  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number | undefined>(undefined);
  const [selectedCycleDuration, setSelectedCycleDuration] = useState<number | undefined>(undefined);

  // Modal & Restock Plan State (Stage 21)
  const [restockPlan, setRestockPlan] = useState<RestockPlan | null>(null);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!user?.id || !id) return;
      const currentCached = dataCache.get<ProductWithHistory>(user.id, `product:${id}`);
      const hasCachedData = !!currentCached;

      if (!hasCachedData && !isSilent) {
        setLoading(true);
      }

      try {
        const data = await db.getProductHistory(id, user.id);
        if (!data) {
          if (!hasCachedData) {
            setError('Product not found or you do not have permission to view it.');
          }
        } else {
          dataCache.set(user.id, `product:${id}`, data);
          setHistory((prev) => (areValuesEqual(prev, data) ? prev : data));
          setError(null);

          // Fetch restock plan if an active bottle exists
          if (data.active_usage) {
            const plan = await db.getRestockPlanForUsagePeriod(user.id, data.active_usage.id);
            setRestockPlan(plan);
          } else {
            setRestockPlan(null);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load product history';
        console.error('Failed to load product history:', err);
        if (!hasCachedData) {
          setError(msg);
        }
      } finally {
        isInitialLoad.current = false;
        setLoading(false);
      }
    },
    [user?.id, id]
  );

  // Parameter change / Initial load / SWR revalidation
  useEffect(() => {
    if (!user?.id || !id) return;
    const entry = dataCache.get<ProductWithHistory>(user.id, `product:${id}`);
    if (entry) {
      setHistory(entry.data);
      setLoading(false);
      isInitialLoad.current = false;
      if (dataCache.isStale(entry)) {
        loadData(true);
      }
    } else {
      setHistory(null);
      setLoading(true);
      isInitialLoad.current = true;
      loadData(false);
    }
  }, [user?.id, id, loadData]);

  // Silent background revalidation on window focus / tab return
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefetchTimeRef.current >= 3000) {
          lastRefetchTimeRef.current = now;
          loadData(true);
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [loadData]);

  // Calculations: Summary Statistics strictly using valid finished data
  const summaryStats = useMemo(() => {
    if (!history) return null;

    const { product, purchases, finished_periods } = history;

    // 1. Predicted Lifespan (valid finished periods, rate-normalized when sized)
    const activePurchase = history.active_usage
      ? purchases.find((p) => p.id === history.active_usage!.purchase_id) || null
      : null;
    const latestPurchase = purchases[0] || null;
    const currentPurchase = activePurchase || latestPurchase;
    const averageDuration = calculatePredictedLifespan({
      usagePeriods: finished_periods,
      product,
      purchases,
      activePurchase: currentPurchase,
    });
    const validCompletedCycles = getValidFinishedPeriods(finished_periods).length;

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

    // 5. Unit Rate: active purchase's price ÷ effective size (falling back to latest purchase)
    const effectiveSize = getEffectiveSize(currentPurchase, product);
    const unitRate =
      currentPurchase && effectiveSize.size_value
        ? calculatePricePerUnit(currentPurchase.price, effectiveSize.size_value)
        : null;

    return {
      averageDuration,
      validCompletedCycles,
      weightedCostPerDay,
      totalSpent,
      purchaseCount,
      unitRate,
      effectiveSizeUnit: effectiveSize.size_unit,
      latestPurchase,
    };
  }, [history]);

  // Evidence Confidence Calculation strictly from valid finished periods
  const completedCycles = summaryStats ? summaryStats.validCompletedCycles : 0;
  const confidence = useMemo(() => calculateConfidence(completedCycles), [completedCycles]);
  const confidenceBadgeStyles = useMemo(() => getConfidenceBadgeStyles(confidence.state), [confidence.state]);

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
    const runOutRange = calculateRunOutRange(active.opened_date, avgDuration, completedCycles);

    return {
      active,
      daysUsed,
      predictedRemaining,
      avgDuration,
      runOutRange,
      progress,
      isOverdue,
      overdueDays,
      urgencyLabel,
      urgencyState,
    };
  }, [history, summaryStats, completedCycles]);

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
          rawPeriod: fp,
          cycleNumber: arr.length - idx,
          openedDate: formatDisplayDate(fp.opened_date),
          finishedDate: formatDisplayDate(fp.finished_date || ''),
          duration,
          purchaseDate: linkedPurchase ? formatDisplayDate(linkedPurchase.purchase_date) : '—',
          price: linkedPurchase ? linkedPurchase.price : null,
          storeVendor: linkedPurchase?.store_vendor || null,
          effectiveSize: linkedPurchase ? getEffectiveSize(linkedPurchase, history.product) : null,
          hasSizeOverride:
            Boolean(linkedPurchase?.size_value != null) &&
            linkedPurchase?.size_value !== history.product.size_value,
          cycleCostPerDay,
        };
      });
  }, [history]);

  // Action: Navigate to Add Inventory with preselected context
  const handleAddInventory = () => {
    if (!history) return;
    navigate(`/add-inventory?productId=${history.product.id}`, {
      state: { preselectedProductId: history.product.id },
    });
  };

  // Action: Start using an unopened purchase
  const handleStartUsing = async (purchase: Purchase) => {
    if (!user || !history) return;
    setActionError(null);
    setActionSuccess(null);

    // If active usage already exists, explain that current bottle is still active
    if (history.active_usage) {
      setActionError(
        'A bottle is currently in use for this product. You must finish your active bottle before starting an unopened purchase.'
      );
      return;
    }

    setActivatingId(purchase.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      await db.startUsagePeriod(user.id, {
        product_id: history.product.id,
        purchase_id: purchase.id,
        opened_date: today,
      });

      setActionSuccess(`Started using bottle purchased on ${formatDisplayDate(purchase.purchase_date)}.`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start using purchase';
      setActionError(msg);
    } finally {
      setActivatingId(null);
    }
  };

  // Active Purchase linked to current in-use bottle
  const activePurchase = useMemo(() => {
    if (!history || !activeUsageData?.active) return null;
    return (
      history.purchases.find((p) => p.id === activeUsageData.active.purchase_id) || null
    );
  }, [history, activeUsageData]);

  // Expected finish date derived from active bottle & average lifespan
  const expectedFinishDate = useMemo(() => {
    if (!activeUsageData?.active || !summaryStats?.averageDuration || summaryStats.averageDuration <= 0) {
      return null;
    }
    return calculateExpectedFinishDate(activeUsageData.active.opened_date, summaryStats.averageDuration);
  }, [activeUsageData, summaryStats]);

  const effectiveRestockPlan = useMemo(() => {
    if (!restockPlan) return null;
    return recalculatePlanReminderDate(restockPlan, expectedFinishDate);
  }, [restockPlan, expectedFinishDate]);

  const handleDismissRestock = async () => {
    if (!user || !restockPlan) return;
    try {
      const updated = await db.dismissRestockPlan(user.id, restockPlan.id);
      setRestockPlan(updated);
    } catch (err) {
      console.error('Failed to dismiss restock plan:', err);
    }
  };

  const handleCompleteRestock = async () => {
    if (!user || !restockPlan) return;
    try {
      const updated = await db.completeRestockPlan(user.id, restockPlan.id);
      setRestockPlan(updated);
    } catch (err) {
      console.error('Failed to complete restock plan:', err);
    }
  };

  // Edit Handlers for Current Inventory
  const handleOpenEditActive = () => {
    if (!history || !activeUsageData?.active || !activePurchase) return;
    setEditingPurchase(activePurchase);
    setEditingUsagePeriod(activeUsageData.active);
    setEditMode('active_bottle');
    setIsEditModalOpen(true);
  };

  const handleOpenEditUnopened = (purchase: Purchase) => {
    if (!history) return;
    setEditingPurchase(purchase);
    setEditingUsagePeriod(null);
    setEditMode('unopened');
    setIsEditModalOpen(true);
  };

  const handleInventorySaved = async () => {
    setActionSuccess('Inventory updated.');
    await loadData();
  };

  // Stage 17: Edit & Delete Handlers for Completed Historical Cycles
  const handleOpenEditCycle = (cycle: UsagePeriod, cycleNumber?: number) => {
    setSelectedCycle(cycle);
    setSelectedCycleNumber(cycleNumber);
    setIsEditCycleModalOpen(true);
  };

  const handleOpenDeleteCycle = (cycle: UsagePeriod, cycleNumber?: number, duration?: number) => {
    setSelectedCycle(cycle);
    setSelectedCycleNumber(cycleNumber);
    setSelectedCycleDuration(duration);
    setIsDeleteCycleModalOpen(true);
  };

  const handleCycleSaved = async () => {
    setActionSuccess('Historical cycle updated. Insights recalculated.');
    await loadData();
  };

  const handleCycleDeleted = async () => {
    setActionSuccess('Historical cycle removed. Historical insights recalculated.');
    await loadData();
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
      <div className="space-y-6">
        <div className="h-4 w-32 skeleton-shimmer rounded" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
          <div className="space-y-2 w-full max-w-md">
            <div className="h-4 w-36 skeleton-shimmer rounded" />
            <div className="h-8 w-64 skeleton-shimmer rounded" />
          </div>
          <div className="h-10 w-44 skeleton-shimmer rounded-xl shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton-shimmer border border-neutral-200 rounded-2xl p-4" />
          ))}
        </div>
        <div className="h-44 skeleton-shimmer border border-neutral-200 rounded-2xl p-5" />
        <div className="h-64 skeleton-shimmer border border-neutral-200 rounded-2xl p-5" />
      </div>
    );
  }

  // Error / Not Found State
  if (error || !history) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-status-critical-bg text-status-critical-text flex items-center justify-center mx-auto text-xl font-bold">
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
    <div className="space-y-8">
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

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
          <Link
            to={`/compare?base=${product.id}`}
            className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2.5 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 3 4 4-4 4" />
              <path d="M20 7H4" />
              <path d="m8 21-4-4 4-4" />
              <path d="M4 17h16" />
            </svg>
            <span>Compare</span>
          </Link>
          <button
            type="button"
            onClick={handleAddInventory}
            className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Add Inventory</span>
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
                Opened {formatDisplayDate(activeUsageData.active.opened_date)}
                {activePurchase && (
                  <>
                    <span className="text-neutral-300 mx-1.5">•</span>
                    <span>Purchased {formatDisplayDate(activePurchase.purchase_date)}</span>
                    <span className="text-neutral-300 mx-1.5">•</span>
                    <span>
                      ৳{activePurchase.price.toLocaleString()} {activePurchase.currency || 'BDT'}
                    </span>
                    {(() => {
                      const eff = getEffectiveSize(activePurchase, product);
                      return eff.size_value ? (
                        <>
                          <span className="text-neutral-300 mx-1.5">•</span>
                          <span>
                            {eff.size_value} {eff.size_unit}
                          </span>
                        </>
                      ) : null;
                    })()}
                    {activePurchase.store_vendor && (
                      <>
                        <span className="text-neutral-300 mx-1.5">•</span>
                        <span>Store / Vendor: {activePurchase.store_vendor}</span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              {activeUsageData.urgencyState === 'overdue' ? (
                <span className="text-xs font-semibold text-status-critical-text bg-status-critical-bg border border-status-critical-border px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-critical-fill animate-pulse" />
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
                onClick={handleOpenEditActive}
                className="btn-press px-3.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
              >
                Edit
              </button>
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
            <div className="flex justify-between items-center text-xs text-neutral-600 flex-wrap gap-1">
              <span>
                Day <strong className="font-semibold text-neutral-900">{activeUsageData.daysUsed}</strong> in use
              </span>
              {activeUsageData.urgencyState === 'overdue' ? (
                <span className="text-xs font-semibold text-status-critical-text flex items-center gap-1">
                  <span>Overdue by {activeUsageData.overdueDays}d</span>
                </span>
              ) : activeUsageData.predictedRemaining !== null ? (
                <span className="text-xs font-semibold text-[#2D6A4F]">
                  {activeUsageData.predictedRemaining}d left
                </span>
              ) : null}
            </div>
            <LifespanBar
              daysUsed={activeUsageData.daysUsed}
              expectedLifespan={activeUsageData.avgDuration}
              runOutRange={activeUsageData.runOutRange}
              isOverdue={activeUsageData.isOverdue}
              predictedRemainingDays={activeUsageData.predictedRemaining}
              heightClass="h-2"
            />

            {/* EXPECTED LIFESPAN PREDICTION */}
            <div className="pt-3 border-t border-neutral-100/80">
              <span className="text-xs font-medium text-neutral-500 block mb-1">
                Expected lifespan
              </span>
              {activeUsageData.avgDuration !== null ? (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                      ~{activeUsageData.avgDuration} days
                    </span>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadgeStyles.badgeClass}`}>
                      {confidence.label}
                    </span>
                  </div>
                  {activeUsageData.runOutRange && (
                    <p className="text-xs font-medium text-neutral-600">
                      {formatRunOutRange(activeUsageData.runOutRange, {
                        expectedFinishDate,
                        isOverdue: activeUsageData.isOverdue,
                      })}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
                    <span>{confidence.supportingText}</span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-neutral-400 italic">{confidence.semanticMeaning}</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-base sm:text-lg font-bold text-neutral-500">
                      Not enough data
                    </span>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadgeStyles.badgeClass}`}>
                      {confidence.label}
                    </span>
                  </div>
                  {activeUsageData.runOutRange && (
                    <p className="text-xs font-medium text-neutral-600">
                      {formatRunOutRange(activeUsageData.runOutRange, {
                        expectedFinishDate,
                        isOverdue: activeUsageData.isOverdue,
                      })}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 italic">
                    Complete a cycle to start learning.
                  </p>
                </div>
              )}
            </div>

            {/* RESTOCK PLANNING SECTION (Stage 21) */}
            <div className="pt-3 border-t border-neutral-100/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">
                  Restock
                </span>
                {effectiveRestockPlan && effectiveRestockPlan.status === 'planned' && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      getRestockStatusInfo(
                        getRestockDisplayStatus(effectiveRestockPlan, activeUsageData.active.status),
                        effectiveRestockPlan.reminder_date,
                        effectiveRestockPlan.days_before_finish,
                        effectiveRestockPlan.mode
                      ).badgeClass
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        getRestockStatusInfo(
                          getRestockDisplayStatus(effectiveRestockPlan, activeUsageData.active.status),
                          effectiveRestockPlan.reminder_date,
                          effectiveRestockPlan.days_before_finish,
                          effectiveRestockPlan.mode
                        ).dotClass
                      }`}
                    />
                    {getRestockStatusInfo(
                      getRestockDisplayStatus(effectiveRestockPlan, activeUsageData.active.status),
                      effectiveRestockPlan.reminder_date,
                      effectiveRestockPlan.days_before_finish,
                      effectiveRestockPlan.mode
                    ).label}
                  </span>
                )}
              </div>

              {/* State 1: No Plan or Finished/Dismissed */}
              {(!restockPlan || restockPlan.status === 'dismissed' || restockPlan.status === 'completed') && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/70 rounded-xl p-3.5 border border-neutral-200/60">
                  <div>
                    {activeUsageData.avgDuration !== null && expectedFinishDate ? (
                      <div>
                        <span className="text-xs text-neutral-500 font-medium">Estimated finish</span>
                        <p className="text-sm font-bold text-neutral-900">
                          {formatDisplayDate(expectedFinishDate)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-semibold text-neutral-700">Restock planning</span>
                        <p className="text-[11px] text-neutral-500">
                          Not enough history to estimate when this product will finish.
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRestockModalOpen(true)}
                    className="btn-press px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    {restockPlan ? 'Plan Again' : 'Plan Restock'}
                  </button>
                </div>
              )}

              {/* State 2: Planned (Future) */}
              {effectiveRestockPlan &&
                effectiveRestockPlan.status === 'planned' &&
                getRestockDisplayStatus(effectiveRestockPlan, activeUsageData.active.status) === 'planned' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-500/5 rounded-xl p-3.5 border border-emerald-500/20">
                    <div>
                      <span className="text-xs text-neutral-500 font-medium">Reminder</span>
                      <p className="text-sm font-bold text-neutral-900">
                        {formatDisplayDate(effectiveRestockPlan.reminder_date)}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {effectiveRestockPlan.mode === 'relative' && effectiveRestockPlan.days_before_finish !== null
                          ? `${getRelativeOptionLabel(effectiveRestockPlan.days_before_finish)} estimated finish`
                          : 'Custom reminder date'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setIsRestockModalOpen(true)}
                        className="btn-press px-3 py-1.5 rounded-lg bg-white border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissRestock}
                        className="btn-press px-3 py-1.5 rounded-lg bg-white border border-neutral-200/80 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

              {/* State 3: Due */}
              {effectiveRestockPlan &&
                effectiveRestockPlan.status === 'planned' &&
                getRestockDisplayStatus(effectiveRestockPlan, activeUsageData.active.status) === 'due' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl p-3.5 border border-surface-border border-l-4 border-l-status-attention-fill">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-attention-fill animate-pulse" />
                        <span className="text-xs font-bold text-status-attention-text">
                          Restock reminder due
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        Reminder was scheduled for {formatDisplayDate(effectiveRestockPlan.reminder_date)}
                        {expectedFinishDate && ` · Estimated finish: ${formatDisplayDate(expectedFinishDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddInventory}
                        className="btn-press px-3.5 py-1.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Log Purchase
                      </button>
                      <button
                        type="button"
                        onClick={handleCompleteRestock}
                        className="btn-press px-3 py-1.5 rounded-xl bg-white border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissRestock}
                        className="btn-press px-3 py-1.5 rounded-xl bg-white border border-neutral-200/80 hover:bg-neutral-50 text-neutral-500 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      ) : (
        /* No Active Bottle State */
        <div className="bg-[#EBF4F0]/50 border border-[#2D6A4F]/20 rounded-2xl p-6 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">No bottle is currently in use</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {history.unopened_purchases && history.unopened_purchases.length > 0
                  ? 'You have unopened backup purchases available below, or you can record a new purchase.'
                  : 'Open a new bottle or log a repeat purchase to continue tracking this essential.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddInventory}
              className="btn-press px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs self-start sm:self-auto cursor-pointer"
            >
              + Record Purchase
            </button>
          </div>

          {/* Expected Lifespan Section when no bottle is in use */}
          <div className="pt-3 border-t border-[#2D6A4F]/15">
            <span className="text-xs font-medium text-neutral-500 block mb-1">
              Expected lifespan
            </span>
            {summaryStats?.averageDuration !== null ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                    ~{summaryStats?.averageDuration} days
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadgeStyles.badgeClass}`}>
                    {confidence.label}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 flex items-center gap-1.5 flex-wrap">
                  <span>{confidence.supportingText}</span>
                  <span className="text-neutral-300">•</span>
                  <span className="text-neutral-500 italic">{confidence.semanticMeaning}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-base sm:text-lg font-bold text-neutral-500">
                    Not enough data
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadgeStyles.badgeClass}`}>
                    {confidence.label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 italic">
                  Complete a cycle to start learning.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Notification Alert Messages */}
      {actionError && (
        <div className="p-4 rounded-xl bg-status-attention-bg border border-status-attention-border text-status-attention-text text-xs font-medium flex items-start justify-between animate-page-in shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span className="leading-relaxed">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-status-attention-text hover:text-status-attention-text font-bold ml-3 text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-[#2D6A4F] text-xs font-medium flex items-start justify-between animate-page-in shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">✓</span>
            <span className="leading-relaxed font-semibold">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-[#2D6A4F] hover:text-[#24563F] font-bold ml-3 text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* UNOPENED PURCHASES SECTION */}
      {history.unopened_purchases && history.unopened_purchases.length > 0 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div>
              <span className="text-xs font-semibold text-neutral-700 block mb-0.5">
                Unopened purchases
              </span>
              <p className="text-xs text-neutral-500">
                {history.unopened_purchases.length} backup bottle{history.unopened_purchases.length === 1 ? '' : 's'} stored and waiting to be opened
              </p>
            </div>
          </div>

          <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl overflow-hidden">
            {history.unopened_purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-neutral-900">
                      {formatDisplayDate(purchase.purchase_date)}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span className="font-bold text-neutral-900">
                      ৳{purchase.price.toLocaleString()} {purchase.currency || 'BDT'}
                    </span>
                    {(() => {
                      const eff = getEffectiveSize(purchase, product);
                      const isOverride =
                        purchase.size_value !== undefined &&
                        purchase.size_value !== null &&
                        purchase.size_value !== product.size_value;
                      return eff.size_value ? (
                        <>
                          <span className="text-neutral-300">•</span>
                          <span className="font-medium text-neutral-700">
                            {eff.size_value} {eff.size_unit}
                            {isOverride ? ' (pack override)' : ''}
                          </span>
                        </>
                      ) : null;
                    })()}
                    <span className="text-neutral-300">•</span>
                    <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-200/60">
                      Unopened
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    {product.name}
                    {purchase.store_vendor ? ` • Store / Vendor: ${purchase.store_vendor}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditUnopened(purchase)}
                    className="btn-press min-h-[36px] px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartUsing(purchase)}
                    disabled={activatingId === purchase.id}
                    className="btn-press min-h-[36px] px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                  >
                    {activatingId === purchase.id ? (
                      <span>Activating...</span>
                    ) : (
                      <span>Start Using</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Statistics Cards (Editorial Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* 1. Average Duration (Observed Historical Metric) */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
              Average Lifespan
            </span>
          </div>
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
            {completedCycles > 0
              ? `Based on ${completedCycles} completed ${completedCycles === 1 ? 'cycle' : 'cycles'}`
              : 'No completed cycles yet'}
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
          {summaryStats?.unitRate !== null && summaryStats?.effectiveSizeUnit ? (
            <div className="mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                ৳{summaryStats?.unitRate}
              </span>
              <span className="text-xs text-neutral-500 ml-1">/ {summaryStats.effectiveSizeUnit}</span>
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
                <Bar
                  dataKey="duration"
                  fill="#2D6A4F"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={300}
                  animationEasing="ease-out"
                />
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
                    {cycle.effectiveSize?.size_value
                      ? ` • ${cycle.effectiveSize.size_value} ${cycle.effectiveSize.size_unit}${cycle.hasSizeOverride ? ' (pack override)' : ''}`
                      : ''}
                    {cycle.storeVendor ? ` • Store / Vendor: ${cycle.storeVendor}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 sm:text-right">
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-medium">Duration</span>
                    <span className="font-bold text-neutral-900 text-sm">
                      {cycle.duration} days
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-medium">Cycle cost/day</span>
                    {cycle.cycleCostPerDay !== null ? (
                      <span className="font-bold text-[#2D6A4F] text-sm">
                        ৳{cycle.cycleCostPerDay}/day
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic">—</span>
                    )}
                  </div>

                  {/* Stage 17: Restrained Historical Edit and Delete Actions */}
                  <div className="flex items-center gap-1.5 sm:pl-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCycle(cycle.rawPeriod, cycle.cycleNumber)}
                      className="btn-press min-h-[30px] px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                      title="Edit this completed cycle's dates"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteCycle(cycle.rawPeriod, cycle.cycleNumber, cycle.duration)}
                      className="btn-press min-h-[30px] px-2.5 py-1 rounded-lg text-neutral-400 hover:text-status-critical-text hover:bg-status-critical-bg text-xs font-medium transition-colors cursor-pointer"
                      title="Delete this completed cycle"
                    >
                      Delete
                    </button>
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
        onFinished={(summary: FinishUsageSummary) => {
          setFinishToast(`${summary.productName} is finished. ${summary.daysUsed}-day cycle recorded.`);
          loadData();
        }}
      />

      <Toast message={finishToast} onDismiss={() => setFinishToast(null)} />

      {/* Reusable Edit Current Inventory Modal */}
      <EditInventoryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPurchase(null);
          setEditingUsagePeriod(null);
        }}
        onSaved={handleInventorySaved}
        product={history.product}
        purchase={editingPurchase}
        usagePeriod={editingUsagePeriod}
        mode={editMode}
      />

      {/* Stage 17: Edit Completed Historical Cycle Modal */}
      <EditCompletedCycleModal
        isOpen={isEditCycleModalOpen}
        onClose={() => {
          setIsEditCycleModalOpen(false);
          setSelectedCycle(null);
          setSelectedCycleNumber(undefined);
        }}
        onSaved={handleCycleSaved}
        productName={history.product.name}
        cycle={selectedCycle}
        cycleNumber={selectedCycleNumber}
      />

      {/* Stage 17: Delete Completed Historical Cycle Confirmation Modal */}
      <DeleteCompletedCycleModal
        isOpen={isDeleteCycleModalOpen}
        onClose={() => {
          setIsDeleteCycleModalOpen(false);
          setSelectedCycle(null);
          setSelectedCycleNumber(undefined);
          setSelectedCycleDuration(undefined);
        }}
        onDeleted={handleCycleDeleted}
        productName={history.product.name}
        cycle={selectedCycle}
        cycleNumber={selectedCycleNumber}
        durationDays={selectedCycleDuration}
      />

      {/* Stage 21: Plan Restock Modal */}
      {history.active_usage && (
        <PlanRestockModal
          isOpen={isRestockModalOpen}
          onClose={() => setIsRestockModalOpen(false)}
          product={{
            ...history.product,
            active_usage: history.active_usage,
            finished_periods: history.finished_periods,
            latest_purchase: activePurchase || history.purchases[0] || null,
          }}
          existingPlan={restockPlan}
          onSaved={(saved) => {
            setRestockPlan(saved);
            loadData(true);
          }}
        />
      )}
    </div>
  );
};
