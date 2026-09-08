// ==============================================================================
// Nittoo Export Normalizer
// Single source of truth transforming raw database records into a pure,
// unified NittooExportData model consumed identically by Excel, CSV, PDF, and JSON.
// Strictly distinguishes Observed vs Predicted vs Estimated metrics.
// ==============================================================================

import type { IDataSource, Product, Purchase, UsagePeriod } from '../../types';
import type {
  NittooExportData,
  ExportSummary,
  ExportProductItem,
  ExportPurchaseItem,
  ExportUsageItem,
  ExportInventoryItem,
  ExportAnalyticsItem,
  ExportCategoryBreakdown,
} from './types';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculateCurrentDaysUsed,
  calculatePredictedRemainingDays,
} from '../prediction';
import { addDays } from '../dateUtils';
import { calculateConfidence } from '../confidence';

export async function buildExportData(
  userId: string,
  userEmail: string,
  dataSource: IDataSource
): Promise<NittooExportData> {
  // 1. Batched read-only retrieval of user data and inventory
  const [rawExport, inventoryData] = await Promise.all([
    dataSource.exportUserData(userId),
    dataSource.getUserInventory(userId),
  ]);

  const products: Product[] = rawExport.products || [];
  const purchases: Purchase[] = rawExport.purchases || [];
  const usagePeriods: UsagePeriod[] = rawExport.usage_periods || [];

  // Lookup maps for relational associations
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.id, p);
  }

  const purchaseMap = new Map<string, Purchase>();
  for (const pu of purchases) {
    purchaseMap.set(pu.id, pu);
  }

  // Group purchases and usage periods by product_id
  const purchasesByProduct = new Map<string, Purchase[]>();
  for (const pu of purchases) {
    const list = purchasesByProduct.get(pu.product_id) || [];
    list.push(pu);
    purchasesByProduct.set(pu.product_id, list);
  }

  const usageByProduct = new Map<string, UsagePeriod[]>();
  for (const u of usagePeriods) {
    const list = usageByProduct.get(u.product_id) || [];
    list.push(u);
    usageByProduct.set(u.product_id, list);
  }

  // 2. Normalize Products
  const exportProducts: ExportProductItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand || '',
    category: p.category,
    size: p.size_value ?? null,
    unit: p.size_unit ?? null,
    created_at: p.created_at,
  }));

  // 3. Normalize Purchases
  const exportPurchases: ExportPurchaseItem[] = purchases.map((pu) => {
    const prod = productMap.get(pu.product_id);
    return {
      id: pu.id,
      product_id: pu.product_id,
      product_name: prod?.name || 'Unknown Product',
      brand: prod?.brand || '',
      category: prod?.category || '',
      purchase_date: pu.purchase_date,
      price: pu.price,
      currency: 'BDT',
      store_vendor: pu.store_vendor ?? null,
    };
  });

  // 4. Normalize Usage History (Strict distinction between completed cycles and active containers)
  const exportUsage: ExportUsageItem[] = usagePeriods.map((u) => {
    const prod = productMap.get(u.product_id);
    const pu = purchaseMap.get(u.purchase_id);
    const isCompleted = u.status === 'finished' && Boolean(u.finished_date);
    const duration = isCompleted ? calculateUsageDuration(u) : calculateCurrentDaysUsed(u.opened_date);
    const price = pu?.price || 0;
    const costPerDay =
      isCompleted && duration && duration > 0 ? Math.round((price / duration) * 100) / 100 : null;

    return {
      id: u.id,
      product_id: u.product_id,
      product_name: prod?.name || 'Unknown Product',
      purchase_id: u.purchase_id,
      opened_date: u.opened_date,
      finished_date: u.finished_date || null,
      status: isCompleted ? 'completed' : 'active',
      days_used: duration ?? 0,
      purchase_price: price,
      currency: 'BDT',
      cost_per_day: costPerDay,
    };
  });

  // Sort usage history: active first, then completed by finished_date descending
  exportUsage.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return (b.finished_date || b.opened_date).localeCompare(a.finished_date || a.opened_date);
  });

  // 5. Normalize Current Owned Inventory (Active vs Unopened)
  const exportInventory: ExportInventoryItem[] = [];

  // Active containers
  for (const activeItem of inventoryData.active) {
    const daysUsed = activeItem.active_usage
      ? calculateCurrentDaysUsed(activeItem.active_usage.opened_date)
      : null;
    const finishedPeriods = (usageByProduct.get(activeItem.id) || []).filter(
      (u) => u.status === 'finished' && u.finished_date
    );
    const avgLifespan = calculateAverageLifespan(finishedPeriods);
    const predictedRemaining =
      daysUsed !== null && avgLifespan !== null
        ? calculatePredictedRemainingDays(avgLifespan, daysUsed)
        : null;

    exportInventory.push({
      product_id: activeItem.id,
      product_name: activeItem.name,
      brand: activeItem.brand || '',
      category: activeItem.category,
      inventory_status: 'Active',
      purchase_date: activeItem.active_purchase?.purchase_date || activeItem.created_at.split('T')[0],
      price: activeItem.active_purchase?.price || 0,
      currency: 'BDT',
      opened_date: activeItem.active_usage?.opened_date || null,
      days_used: daysUsed,
      predicted_remaining_days: predictedRemaining,
      backup_count: activeItem.unopened_count || 0,
    });
  }

  // Unopened backup purchases
  for (const unopenedItem of inventoryData.unopened) {
    exportInventory.push({
      product_id: unopenedItem.product.id,
      product_name: unopenedItem.product.name,
      brand: unopenedItem.product.brand || '',
      category: unopenedItem.product.category,
      inventory_status: 'Unopened',
      purchase_date: unopenedItem.purchase.purchase_date,
      price: unopenedItem.purchase.price,
      currency: 'BDT',
      opened_date: null,
      days_used: null,
      predicted_remaining_days: null,
      backup_count: 0,
    });
  }

  // 6. Normalize Analytics (Observed vs Predicted vs Estimated)
  let totalEstimatedMonthlyConsumption = 0;
  const categoryMonthlySums = new Map<string, { count: number; monthlyCost: number }>();
  const allCategoriesSet = new Set<string>();

  for (const p of products) {
    allCategoriesSet.add(p.category);
  }

  const exportAnalytics: ExportAnalyticsItem[] = products.map((p) => {
    const pUsage = usageByProduct.get(p.id) || [];
    const pPurchases = purchasesByProduct.get(p.id) || [];
    const finishedPeriods = pUsage.filter((u) => u.status === 'finished' && u.finished_date);
    const activePeriod = pUsage.find((u) => u.status === 'active' || !u.finished_date);

    // Observed historical metrics (strictly completed cycles)
    const observedLifespan = calculateAverageLifespan(finishedPeriods);
    const confidence = calculateConfidence(finishedPeriods.length);

    let observedCostPerDay: number | null = null;
    if (finishedPeriods.length > 0) {
      let totalCompletedPrice = 0;
      let totalCompletedDays = 0;
      for (const fp of finishedPeriods) {
        const dur = calculateUsageDuration(fp);
        if (dur !== null && dur > 0) {
          const pu = purchaseMap.get(fp.purchase_id);
          if (pu) {
            totalCompletedPrice += pu.price;
            totalCompletedDays += dur;
          }
        }
      }
      if (totalCompletedDays > 0) {
        observedCostPerDay = Math.round((totalCompletedPrice / totalCompletedDays) * 100) / 100;
      }
    }

    // Estimated Monthly Run Rate for active product
    let monthlyConsumption: number | null = null;
    const latestPurchase = pPurchases[0];
    if (observedLifespan !== null && observedLifespan > 0 && latestPurchase) {
      monthlyConsumption = Math.round(((latestPurchase.price / observedLifespan) * 30) * 100) / 100;
      if (activePeriod) {
        totalEstimatedMonthlyConsumption += monthlyConsumption;
        const currentCat = categoryMonthlySums.get(p.category) || { count: 0, monthlyCost: 0 };
        currentCat.count += 1;
        currentCat.monthlyCost += monthlyConsumption;
        categoryMonthlySums.set(p.category, currentCat);
      }
    }

    // In-flight Prediction for active container
    let predictedRemaining: number | null = null;
    let predictedFinishDate: string | null = null;
    if (activePeriod && observedLifespan !== null) {
      const daysUsed = calculateCurrentDaysUsed(activePeriod.opened_date);
      predictedRemaining = calculatePredictedRemainingDays(observedLifespan, daysUsed);
      predictedFinishDate = addDays(activePeriod.opened_date, Math.round(observedLifespan));
    }

    return {
      product_id: p.id,
      product_name: p.name,
      brand: p.brand || '',
      category: p.category,
      observed_average_lifespan: observedLifespan,
      completed_cycles: finishedPeriods.length,
      observed_cost_per_day: observedCostPerDay,
      estimated_monthly_consumption: monthlyConsumption,
      predicted_finish_date: predictedFinishDate,
      predicted_remaining_days: predictedRemaining,
      confidence_state: confidence.state,
      confidence_label: confidence.label,
    };
  });

  // Category breakdown
  const categoryBreakdown: ExportCategoryBreakdown[] = Array.from(allCategoriesSet).map((cat) => {
    const data = categoryMonthlySums.get(cat) || { count: 0, monthlyCost: 0 };
    const percentage =
      totalEstimatedMonthlyConsumption > 0
        ? Math.round((data.monthlyCost / totalEstimatedMonthlyConsumption) * 100)
        : 0;
    return {
      category: cat,
      activeCount: data.count,
      estimatedMonthlyCost: Math.round(data.monthlyCost),
      percentage,
    };
  });

  categoryBreakdown.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);

  // 7. Structured Evidence-Backed Insights
  const insights: string[] = [];
  for (const item of exportAnalytics) {
    if (item.completed_cycles >= 2 && item.observed_average_lifespan !== null) {
      insights.push(
        `${item.product_name} averages ${item.observed_average_lifespan} days per container (${item.confidence_label}, ${item.completed_cycles} completed cycles).`
      );
    }
  }

  // 8. Construct Unified Summary
  const summary: ExportSummary = {
    total_products: products.length,
    total_purchases: purchases.length,
    active_essentials: inventoryData.active.length,
    unopened_purchases: inventoryData.unopened.length,
    completed_usage_cycles: exportUsage.filter((u) => u.status === 'completed').length,
    estimated_monthly_consumption:
      totalEstimatedMonthlyConsumption > 0 ? Math.round(totalEstimatedMonthlyConsumption) : null,
    categories: Array.from(allCategoriesSet),
    category_breakdown: categoryBreakdown,
  };

  return {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email: userEmail,
    },
    summary,
    products: exportProducts,
    purchases: exportPurchases,
    usage_history: exportUsage,
    inventory: exportInventory,
    analytics: exportAnalytics,
    insights,
  };
}
