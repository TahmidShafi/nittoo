// ==============================================================================
// Nittoo Add Product Page
// Focused Creation Workspace with Intelligent Suggestions & Repeat Purchases
// High-density Linear-style sections: Product, Size, Purchase, and Usage
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC } from '../lib/dateUtils';
import type { Product, ProductCategory, SizeUnit } from '../types';

export const AddProductPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const today = getTodayUTC();

  const preselectedId =
    (location.state as { preselectedProductId?: string })?.preselectedProductId ||
    new URLSearchParams(location.search).get('productId');

  // Form Fields State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Skincare');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('ml');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [openedDate, setOpenedDate] = useState(today);

  // Duplicate / Existing Product Suggestion State
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Status & Error States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBottleWarning, setActiveBottleWarning] = useState<string | null>(null);

  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load current user's existing products for client-side search & auto-select preselected product
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadProducts() {
      try {
        const products = await db.getAllUserProducts(user!.id);
        if (mounted) {
          setExistingProducts(products);
          if (preselectedId) {
            const match = products.find((p) => p.id === preselectedId);
            if (match) {
              setSelectedProduct(match);
              setName(match.name);
              setCategory(match.category);
              setBrand(match.brand || '');
              setSizeValue(match.size_value ? String(match.size_value) : '');
              setSizeUnit(match.size_unit || 'ml');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load existing products for suggestion lookup:', err);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, [user, preselectedId]);

  // Handle outside click to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter existing products based on user query
  const trimmedName = name.trim().toLowerCase();
  const suggestions = existingProducts.filter((p) => {
    if (!trimmedName) return false;
    if (selectedProduct && selectedProduct.id === p.id) return false;
    const matchName = p.name.toLowerCase().includes(trimmedName);
    const matchBrand = p.brand ? p.brand.toLowerCase().includes(trimmedName) : false;
    return matchName || matchBrand;
  });

  // When user selects an existing product
  const handleSelectExisting = (product: Product) => {
    setSelectedProduct(product);
    setName(product.name);
    setCategory(product.category);
    setBrand(product.brand || '');
    setSizeValue(product.size_value ? String(product.size_value) : '');
    setSizeUnit(product.size_unit || 'ml');
    setShowSuggestions(false);
    setError(null);
  };

  // Revert back to New Product Mode
  const handleDeselectExisting = () => {
    setSelectedProduct(null);
    setError(null);
  };

  // Validation
  const validateForm = (): string | null => {
    const cleanName = name.trim();
    if (!cleanName) {
      return 'Product name is required';
    }

    if (!category) {
      return 'Category is required';
    }

    const numPrice = Number(price);
    if (price.trim() === '' || isNaN(numPrice) || numPrice < 0) {
      return 'Please enter a valid purchase price (cannot be negative)';
    }

    if (sizeValue.trim() !== '') {
      const numSize = Number(sizeValue);
      if (isNaN(numSize) || numSize <= 0) {
        return 'Size value must be greater than zero when provided';
      }
    }

    if (!purchaseDate) {
      return 'Purchase date is required';
    }

    if (!openedDate) {
      return 'Opened date is required';
    }

    if (openedDate < purchaseDate) {
      return 'Opened date cannot be before purchase date';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setActiveBottleWarning(null);

    const validationErr = validateForm();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setSubmitting(true);

    try {
      let productId = selectedProduct?.id;

      // Step 1: If brand new product, create it
      if (!productId) {
        const createdProduct = await db.createProduct(user.id, {
          name: name.trim(),
          category,
          brand: brand.trim() || undefined,
          size_value: sizeValue.trim() ? Number(sizeValue) : undefined,
          size_unit: sizeValue.trim() ? sizeUnit : undefined,
        });
        productId = createdProduct.id;
      }

      // Step 2: Record the purchase
      const purchase = await db.createPurchase(user.id, {
        product_id: productId,
        price: Number(price),
        purchase_date: purchaseDate,
        currency: 'BDT',
      });

      // Step 3: Check if product already has an active usage period
      const existingHistory = await db.getProductHistory(productId, user.id);
      const hasActive = Boolean(existingHistory?.active_usage);

      if (hasActive) {
        // Safe: log purchase only, do not open duplicate active bottle
        navigate('/dashboard', {
          state: {
            infoNotice: `Purchase of ৳${price} for "${name.trim()}" logged. The active bottle is still in use, so this new bottle will be ready when you finish it.`,
          },
        });
        return;
      }

      // Step 4: No active bottle exists, so open one
      await db.startUsagePeriod(user.id, {
        product_id: productId,
        purchase_id: purchase.id,
        opened_date: openedDate,
      });

      navigate('/dashboard', {
        state: {
          infoNotice: `Started tracking "${name.trim()}". We'll calculate its daily cost and lifespan as you use it.`,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-page-in">
      {/* 1. Predictable Header System (Section 5 & 11) */}
      <div className="pb-4 border-b border-[#F0F2F1]">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-[#2D6A4F] block mb-1">
          Product Tracking
        </span>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Add Essential
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Log a purchase and start tracking its usage lifecycle.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-2">
            <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
            <span className="leading-relaxed">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700 text-sm font-bold ml-2 leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Bottle Notice */}
      {activeBottleWarning && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-medium shadow-xs">
          {activeBottleWarning}
        </div>
      )}

      {/* Form Workspace */}
      <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 sm:p-6 shadow-xs">
        {/* Repeat Purchase Badge */}
        {selectedProduct && (
          <div className="mb-5 p-3 rounded-lg bg-[#EBF4F0] border border-[#2D6A4F]/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              <span className="font-semibold text-[#2D6A4F]">
                Repeat Purchase Mode (Existing essential)
              </span>
            </div>
            <button
              type="button"
              onClick={handleDeselectExisting}
              className="btn-press text-neutral-500 hover:text-neutral-900 font-medium hover:underline text-xs cursor-pointer"
            >
              Deselect
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SECTION: PRODUCT (Visual Focus) */}
          <div className="space-y-3.5">
            <div className="pb-1 border-b border-[#F0F2F1]">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                Product
              </h3>
            </div>

            {/* Product Name (Visual Focus) */}
            <div className="relative" ref={suggestionsRef}>
              <label
                className="block text-xs font-semibold text-neutral-800 mb-1"
                htmlFor="product-name"
              >
                Product Name *
              </label>
              <input
                id="product-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                  if (selectedProduct && e.target.value !== selectedProduct.name) {
                    setSelectedProduct(null);
                  }
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setShowSuggestions(true);
                }}
                placeholder="e.g. CeraVe Hydrating Facial Cleanser"
                disabled={submitting}
                autoComplete="off"
                className="w-full px-3.5 py-2 rounded-lg border border-[#E8ECE9] text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
              />

              {/* Suggestions Popover */}
              {showSuggestions && isSearchFocused && suggestions.length > 0 && !selectedProduct && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E8ECE9] rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-[#F0F2F1]">
                  <div className="px-3 py-1.5 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Existing Tracked Essentials
                  </div>
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectExisting(p)}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#EBF4F0]/60 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-semibold text-neutral-900 group-hover:text-[#2D6A4F]">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-neutral-400 block">
                          {[p.brand, p.category, p.size_value ? `${p.size_value} ${p.size_unit}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[#2D6A4F] opacity-0 group-hover:opacity-100 transition-opacity">
                        Select →
                      </span>
                    </button>
                  ))}
                  <div className="px-3 py-2 bg-neutral-50 text-xs text-neutral-500 flex items-center justify-between">
                    <span>Not in the list?</span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-[#2D6A4F] font-semibold hover:underline cursor-pointer"
                    >
                      + Add as new product
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="category"
                >
                  Category *
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 text-neutral-900"
                >
                  <option value="Skincare">Skincare</option>
                  <option value="Haircare">Haircare</option>
                  <option value="Oral Care">Oral Care</option>
                  <option value="Household">Household</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="brand"
                >
                  Brand (Optional)
                </label>
                <input
                  id="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. CeraVe, Oral-B"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>
            </div>
          </div>

          {/* SECTION: SIZE */}
          <div className="space-y-3.5 pt-2">
            <div className="pb-1 border-b border-[#F0F2F1]">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                Size
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="size"
                >
                  Size / Volume (Optional)
                </label>
                <input
                  id="size"
                  type="number"
                  min="0.01"
                  step="any"
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  placeholder="e.g. 236"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="unit"
                >
                  Unit
                </label>
                <select
                  id="unit"
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value as SizeUnit)}
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 text-neutral-900"
                >
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="count">count</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: PURCHASE */}
          <div className="space-y-3.5 pt-2">
            <div className="pb-1 border-b border-[#F0F2F1]">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                Purchase
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="price"
                >
                  Price (BDT ৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-neutral-400 text-xs font-semibold">
                    ৳
                  </span>
                  <input
                    id="price"
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1250"
                    disabled={submitting}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                  htmlFor="purchase-date"
                >
                  Purchase Date *
                </label>
                <input
                  id="purchase-date"
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 text-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* SECTION: USAGE */}
          <div className="space-y-3.5 pt-2">
            <div className="pb-1 border-b border-[#F0F2F1]">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                Usage
              </h3>
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-neutral-700 mb-1"
                htmlFor="opened-date"
              >
                Opened / Start Using *
              </label>
              <input
                id="opened-date"
                type="date"
                required
                value={openedDate}
                onChange={(e) => setOpenedDate(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 text-neutral-900"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-[#F0F2F1] flex items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="btn-press text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="btn-press px-5 py-2.5 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : selectedProduct ? (
                <span>Log Repeat Purchase</span>
              ) : (
                <span>Start Tracking Essential</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
