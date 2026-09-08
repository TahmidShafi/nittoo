// ==============================================================================
// Nittoo Add Inventory Page (/add-inventory)
// Dedicated entry experience for recording physical purchases of tracked essentials
// Defaults to "Keep unopened" (personal consumption inventory model)
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC } from '../lib/dateUtils';
import { getPredictionMetrics } from '../hooks/usePrediction';
import type {
  Product,
  ProductWithDetails,
  UserInventory,
} from '../types';

export const AddInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const today = getTodayUTC();

  const preselectedId =
    (location.state as { preselectedProductId?: string })?.preselectedProductId ||
    new URLSearchParams(location.search).get('productId');

  // Products & Inventory Data
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [userInventory, setUserInventory] = useState<UserInventory>({ active: [], unopened: [] });
  const [loading, setLoading] = useState(true);

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form Fields
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [storeVendor, setStoreVendor] = useState('');
  const [usageOption, setUsageOption] = useState<'keep_unopened' | 'start_today'>('keep_unopened');

  // Status & Error
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user essentials and inventory
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        const [products, inv] = await Promise.all([
          db.getAllUserProducts(user!.id),
          db.getUserInventory(user!.id),
        ]);

        if (!mounted) return;
        setAllProducts(products);
        setUserInventory(inv);

        // Handle preselection if coming from Product Detail
        if (preselectedId) {
          const match = products.find((p) => p.id === preselectedId);
          if (match) {
            setSelectedProduct(match);
          }
        }
      } catch (err) {
        console.error('Failed to load essentials for add inventory:', err);
        if (mounted) setError('Failed to load essentials list');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [user, preselectedId]);

  // Active status and unopened counts map
  const activeProductMap = useMemo(() => {
    const map = new Map<string, ProductWithDetails>();
    userInventory.active.forEach((p) => map.set(p.id, p));
    return map;
  }, [userInventory.active]);

  const unopenedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    userInventory.unopened.forEach((item) => {
      map.set(item.product.id, (map.get(item.product.id) || 0) + 1);
    });
    return map;
  }, [userInventory.unopened]);

  // Filtered search suggestions
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    );
  }, [allProducts, searchQuery]);

  // Selected product active state
  const selectedActiveDetails = selectedProduct ? activeProductMap.get(selectedProduct.id) : null;
  const hasActiveBottle = Boolean(selectedActiveDetails);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedProduct) {
      setError('Please select an essential to add inventory for.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be a valid number greater than 0.');
      return;
    }

    if (!purchaseDate) {
      setError('Purchase date is required.');
      return;
    }

    if (purchaseDate > today) {
      setError('Purchase date cannot be in the future.');
      return;
    }

    if (usageOption === 'start_today' && hasActiveBottle) {
      setError(
        `A bottle of ${selectedProduct.name} is currently in use. Please select "Keep unopened" or finish the active bottle first.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create Purchase
      const purchase = await db.createPurchase(user.id, {
        product_id: selectedProduct.id,
        purchase_date: purchaseDate,
        price: numPrice,
        currency: currency.trim() || 'BDT',
        store_vendor: storeVendor.trim() ? storeVendor.trim() : null,
      });

      // 2. Start usage if requested and permitted
      if (usageOption === 'start_today') {
        await db.startUsagePeriod(user.id, {
          product_id: selectedProduct.id,
          purchase_id: purchase.id,
          opened_date: today,
        });
      }

      navigate('/inventory');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record inventory purchase';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-page-in">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/inventory"
          className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors py-1"
        >
          <span>←</span>
          <span>Back to Inventory</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-neutral-200/80 pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] mb-1 block">
          INVENTORY ENTRY
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Add Inventory
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Record something you already purchased for a tracked essential.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center justify-between gap-3 animate-page-in">
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

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-neutral-500">Loading your essentials...</p>
        </div>
      ) : allProducts.length === 0 ? (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-neutral-800">No essentials tracked yet</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Before adding inventory, create a tracked essential product definition first.
          </p>
          <Link
            to="/add-product"
            className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold"
          >
            + Add Essential
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: SELECT ESSENTIAL */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                1. Select Tracked Essential *
              </h2>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
                >
                  Change Essential
                </button>
              )}
            </div>

            {selectedProduct ? (
              <div className="p-3.5 rounded-xl bg-[#EBF4F0]/60 border border-[#2D6A4F]/20 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                    Selected Essential
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-neutral-900">
                      {selectedProduct.name}
                    </span>
                    {selectedProduct.brand && (
                      <span className="text-xs text-neutral-600 font-medium">
                        ({selectedProduct.brand})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                    <span>{selectedProduct.category}</span>
                    {selectedProduct.size_value && (
                      <>
                        <span>•</span>
                        <span>{selectedProduct.size_value} {selectedProduct.size_unit}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-[#2D6A4F] font-semibold">
                      {hasActiveBottle ? 'Active bottle in use' : 'No active bottle'}
                    </span>
                    {Boolean(unopenedCountMap.get(selectedProduct.id)) && (
                      <>
                        <span>•</span>
                        <span>{unopenedCountMap.get(selectedProduct.id)} unopened</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search existing essentials..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40"
                />

                <div className="max-h-52 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200/60 rounded-xl">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-neutral-400">
                      No matching essentials found.
                    </div>
                  ) : (
                    searchResults.map((prod) => {
                      const activeDetails = activeProductMap.get(prod.id);
                      const unopenedCount = unopenedCountMap.get(prod.id) || 0;
                      let statusText = 'No active bottle';
                      if (activeDetails) {
                        const m = getPredictionMetrics(activeDetails);
                        if (m.urgencyState === 'overdue') {
                          statusText = `Active bottle: ${m.overdueDays}d overdue`;
                        } else if (m.predictedRemainingDays !== null) {
                          statusText = `Active bottle: ${m.predictedRemainingDays} days remaining`;
                        } else {
                          statusText = 'Active bottle: learning';
                        }
                      }

                      return (
                        <div
                          key={prod.id}
                          className="p-3 hover:bg-neutral-50 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="space-y-0.5">
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
                            <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                              <span className="text-[#2D6A4F] font-medium">Existing essential</span>
                              <span>•</span>
                              <span>{statusText}</span>
                              {unopenedCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Unopened: {unopenedCount}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(prod)}
                            className="btn-press px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-white hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-all cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: PURCHASE DETAILS */}
          {selectedProduct && (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                2. Purchase Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="purchase-date">
                    Purchase Date *
                  </label>
                  <input
                    id="purchase-date"
                    type="date"
                    required
                    max={today}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="price">
                      Price *
                    </label>
                    <input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      disabled={submitting}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="currency">
                      Currency
                    </label>
                    <input
                      id="currency"
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      disabled={submitting}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 text-center font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="store-vendor">
                  Store / Vendor
                </label>
                <input
                  id="store-vendor"
                  type="text"
                  value={storeVendor}
                  onChange={(e) => setStoreVendor(e.target.value)}
                  placeholder="e.g. Shajgoj, Daraz, local pharmacy"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 placeholder:text-neutral-400"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Optional — where you bought this purchase.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: WHEN WILL YOU START USING IT? */}
          {selectedProduct && (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                3. When will you start using it?
              </h2>

              <div className="space-y-3">
                {/* Option 1: Keep unopened (DEFAULT) */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    usageOption === 'keep_unopened'
                      ? 'border-[#2D6A4F] bg-[#EBF4F0]/40 ring-2 ring-[#2D6A4F]/10'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="usage_option"
                    value="keep_unopened"
                    checked={usageOption === 'keep_unopened'}
                    onChange={() => setUsageOption('keep_unopened')}
                    disabled={submitting}
                    className="mt-1 text-[#2D6A4F] focus:ring-[#2D6A4F]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-neutral-900 block">
                      Keep unopened (Recommended for inventory)
                    </span>
                    <span className="text-xs text-neutral-500">
                      Store in inventory as a backup. No usage period is started until you click "Start Using".
                    </span>
                  </div>
                </label>

                {/* Option 2: Start using today */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    usageOption === 'start_today'
                      ? 'border-[#2D6A4F] bg-[#EBF4F0]/40 ring-2 ring-[#2D6A4F]/10'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="usage_option"
                    value="start_today"
                    checked={usageOption === 'start_today'}
                    onChange={() => setUsageOption('start_today')}
                    disabled={submitting}
                    className="mt-1 text-[#2D6A4F] focus:ring-[#2D6A4F]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-neutral-900 block">
                      Start using today
                    </span>
                    <span className="text-xs text-neutral-500">
                      Begin consumption tracking immediately.
                      {hasActiveBottle && (
                        <span className="text-amber-700 block mt-0.5 font-medium">
                          ⚠️ Note: An active bottle is already in use for this essential. Only one bottle can be active at a time.
                        </span>
                      )}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Form Actions */}
          {selectedProduct && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/inventory"
                className="btn-press px-4 py-2.5 rounded-xl border border-neutral-200 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="btn-press inline-flex items-center justify-center min-h-[42px] px-6 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Add to Inventory'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
