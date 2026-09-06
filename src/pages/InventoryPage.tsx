// ==============================================================================
// Nittoo Inventory Management Page (/inventory)
// Surfaces Active (currently in-use) vs Unopened (backup purchases) inventory
// Follows Linear-inspired personal consumption architecture
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC, formatDisplayDate } from '../lib/dateUtils';
import { getPredictionMetrics } from '../hooks/usePrediction';
import { EditInventoryModal } from '../components/EditInventoryModal';
import type {
  Product,
  Purchase,
  ProductWithDetails,
  UnopenedInventoryItem,
  UserInventory,
} from '../types';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<UserInventory>({ active: [], unopened: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editMode, setEditMode] = useState<'active_bottle' | 'unopened'>('unopened');

  const loadInventory = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await db.getUserInventory(user.id);
      setInventory(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load inventory';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [user]);

  // Handle Edit Active Bottle
  const handleEditActive = (product: ProductWithDetails) => {
    const purchaseToEdit = product.active_purchase || product.latest_purchase;
    if (!purchaseToEdit) return;

    setEditProduct(product);
    setEditPurchase(purchaseToEdit);
    setEditMode('active_bottle');
    setIsEditModalOpen(true);
  };

  // Handle Edit Unopened Purchase
  const handleEditUnopened = (item: UnopenedInventoryItem) => {
    setEditProduct(item.product);
    setEditPurchase(item.purchase);
    setEditMode('unopened');
    setIsEditModalOpen(true);
  };

  // Handle Start Using Unopened Purchase
  const handleStartUsing = async (item: UnopenedInventoryItem) => {
    if (!user) return;
    setError(null);
    setActionSuccess(null);

    // Check if an active bottle already exists for this product
    const existingActive = inventory.active.find((a) => a.id === item.product.id);
    if (existingActive) {
      setError(
        `A bottle of ${item.product.name} is currently in use. You must finish your active bottle before starting an unopened purchase.`
      );
      return;
    }

    setActivatingId(item.purchase.id);
    try {
      const today = getTodayUTC();
      await db.startUsagePeriod(user.id, {
        product_id: item.product.id,
        purchase_id: item.purchase.id,
        opened_date: today,
      });

      setActionSuccess(`Started using ${item.product.name} (purchased ${formatDisplayDate(item.purchase.purchase_date)}).`);
      await loadInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start using purchase';
      setError(msg);
    } finally {
      setActivatingId(null);
    }
  };

  // Group unopened purchases by product
  const unopenedByProduct = useMemo(() => {
    const map = new Map<string, { product: Product; items: UnopenedInventoryItem[] }>();
    for (const item of inventory.unopened) {
      const existing = map.get(item.product.id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.product.id, {
          product: item.product,
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [inventory.unopened]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-page-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200/80">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] mb-1 block">
            CURRENT INVENTORY
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Inventory
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            See what you're currently using and what you have waiting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Link
            to="/add-inventory"
            className="btn-press inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Add Inventory</span>
          </Link>
          <Link
            to="/add-product"
            className="btn-press inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Add Essential</span>
          </Link>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-xs sm:text-sm text-rose-800 flex items-center justify-between gap-3 animate-page-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-xs sm:text-sm text-[#2D6A4F] flex items-center justify-between gap-3 animate-page-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F] shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-[#2D6A4F] hover:text-[#1e4634] font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-neutral-500">Loading your inventory...</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ========================================================================= */}
          {/* SECTION 1: ACTIVE INVENTORY                                               */}
          {/* ========================================================================= */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  ACTIVE
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF4F0] text-[#2D6A4F]">
                  {inventory.active.length}
                </span>
              </div>
              <span className="text-xs text-neutral-400">Currently in use</span>
            </div>

            {inventory.active.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 text-center space-y-2">
                <p className="text-sm font-semibold text-neutral-700">No active essentials</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Start using an unopened purchase or add an essential.
                </p>
                <div className="pt-2">
                  <Link
                    to="/add-product"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline"
                  >
                    + Add Essential →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {inventory.active.map((prod) => {
                  const metrics = getPredictionMetrics(prod);
                  const backups = prod.unopened_count || 0;

                  return (
                    <div
                      key={prod.id}
                      className="bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-5 shadow-xs card-interactive flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-neutral-900 group-hover:text-[#2D6A4F] transition-colors">
                            {prod.name}
                          </h3>
                          {prod.brand && (
                            <span className="text-xs text-neutral-500 font-medium">
                              {prod.brand}
                            </span>
                          )}
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                            {prod.category}
                          </span>
                        </div>

                        {/* Status, Lifespan, Cost & Backup Count */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-500 pt-0.5">
                          {metrics.urgencyState === 'overdue' ? (
                            <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>{metrics.overdueDays} days overdue</span>
                            </span>
                          ) : metrics.urgencyState === 'running_soon' ? (
                            <span className="font-semibold text-[#2D6A4F] bg-[#EBF4F0] border border-[#2D6A4F]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                              <span>{metrics.predictedRemainingDays} days remaining</span>
                            </span>
                          ) : (
                            <span className="font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                              First cycle • Learning baseline
                            </span>
                          )}

                          {metrics.averageLifespan !== null && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>{metrics.averageLifespan}-day avg</span>
                            </>
                          )}

                          {metrics.costPerDay !== null && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>৳{metrics.costPerDay.toFixed(2)}/day</span>
                            </>
                          )}

                          {backups > 0 && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold text-[11px]">
                                {backups} backup{backups > 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link
                          to={`/compare?base=${prod.id}`}
                          className="btn-press inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                          title="Compare with another essential"
                        >
                          Compare
                        </Link>
                        <Link
                          to={`/product/${prod.id}`}
                          className="btn-press inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleEditActive(prod)}
                          className="btn-press inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* SECTION 2: UNOPENED INVENTORY                                             */}
          {/* ========================================================================= */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  UNOPENED
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                  {inventory.unopened.length}
                </span>
              </div>
              <span className="text-xs text-neutral-400">Waiting purchases</span>
            </div>

            {inventory.unopened.length === 0 ? (
              <div className="py-4 px-3 text-xs text-neutral-400 italic">
                No unopened purchases.
              </div>
            ) : (
              <div className="space-y-4">
                {unopenedByProduct.map((group) => (
                  <div
                    key={group.product.id}
                    className="bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
                  >
                    {/* Compact Product Group Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-neutral-900">
                          {group.product.name}
                        </span>
                        {group.product.brand && (
                          <span className="text-xs text-neutral-500">
                            {group.product.brand}
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                          {group.product.category}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400 font-medium">
                        {group.items.length} unopened
                      </span>
                    </div>

                    {/* Unopened Purchases List (Each individually actionable) */}
                    <div className="space-y-2 divide-y divide-neutral-100/60">
                      {group.items.map((item) => (
                        <div
                          key={item.purchase.id}
                          className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            {/* Product image placeholder / future image slot */}
                            <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-neutral-400 shrink-0">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="5" x="2" y="3" rx="1" />
                                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                <path d="M10 12h4" />
                              </svg>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-neutral-800">
                                  Purchased {formatDisplayDate(item.purchase.purchase_date)}
                                </span>
                                <span className="text-neutral-300">•</span>
                                <span className="text-xs font-medium text-neutral-700">
                                  ৳{item.purchase.price.toLocaleString()} {item.purchase.currency || 'BDT'}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/40">
                                  Unopened
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleEditUnopened(item)}
                              className="btn-press inline-flex items-center justify-center min-h-[34px] px-3 py-1 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartUsing(item)}
                              disabled={activatingId === item.purchase.id}
                              className="btn-press inline-flex items-center justify-center min-h-[34px] px-3.5 py-1 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] disabled:opacity-60 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                            >
                              {activatingId === item.purchase.id ? 'Starting...' : 'Start Using'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Reusable Stage 9 Edit Inventory Modal */}
      {editProduct && editPurchase && (
        <EditInventoryModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditProduct(null);
            setEditPurchase(null);
          }}
          onSaved={async () => {
            await loadInventory();
            setActionSuccess(
              editMode === 'active_bottle'
                ? 'Active bottle details updated successfully.'
                : 'Unopened purchase updated successfully.'
            );
          }}
          product={editProduct}
          purchase={editPurchase}
          usagePeriod={editMode === 'active_bottle' ? (editProduct as ProductWithDetails).active_usage : null}
          mode={editMode}
        />
      )}
    </div>
  );
};
