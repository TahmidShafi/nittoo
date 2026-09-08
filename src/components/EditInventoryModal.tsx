// ==============================================================================
// Nittoo Edit Current Inventory Modal
// Edits currently active bottle or unopened purchases without altering history
// Follows Linear-inspired design system: restrained surfaces, compact typography
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC } from '../lib/dateUtils';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type Purchase,
  type UsagePeriod,
  type ProductCategory,
  type SizeUnit,
} from '../types';

export interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
  purchase: Purchase | null;
  usagePeriod?: UsagePeriod | null;
  mode: 'active_bottle' | 'unopened';
}

const CATEGORIES = PRODUCT_CATEGORIES;

const SIZE_UNITS: SizeUnit[] = ['ml', 'g', 'count'];

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  product,
  purchase,
  usagePeriod,
  mode,
}) => {
  const { user } = useAuth();
  const today = getTodayUTC();

  // Product Details
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Skincare');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState<string>('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('ml');

  // Purchase Details
  const [purchaseDate, setPurchaseDate] = useState('');
  const [price, setPrice] = useState<string>('');
  const [currency, setCurrency] = useState('BDT');
  const [storeVendor, setStoreVendor] = useState('');

  // Usage Details (only active bottle)
  const [openedDate, setOpenedDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product && purchase) {
      setName(product.name || '');
      setCategory(product.category || 'Skincare');
      setBrand(product.brand || '');
      setSizeValue(product.size_value !== null && product.size_value !== undefined ? String(product.size_value) : '');
      setSizeUnit(product.size_unit || 'ml');

      setPurchaseDate(purchase.purchase_date || '');
      setPrice(String(purchase.price ?? ''));
      setCurrency(purchase.currency || 'BDT');
      setStoreVendor(purchase.store_vendor || '');

      if (mode === 'active_bottle' && usagePeriod) {
        setOpenedDate(usagePeriod.opened_date || '');
      } else {
        setOpenedDate('');
      }
      setError(null);
    }
  }, [isOpen, product, purchase, usagePeriod, mode]);

  if (!isOpen || !product || !purchase) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    // Validations
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!category) {
      setError('Product category is required.');
      return;
    }
    if (sizeValue && (isNaN(Number(sizeValue)) || Number(sizeValue) <= 0)) {
      setError('Size value must be greater than zero.');
      return;
    }
    if (!purchaseDate) {
      setError('Purchase date is required.');
      return;
    }
    if (price === '' || isNaN(Number(price)) || Number(price) < 0) {
      setError('Purchase price cannot be negative.');
      return;
    }
    if (!currency.trim()) {
      setError('Currency is required.');
      return;
    }

    if (mode === 'active_bottle') {
      if (!openedDate) {
        setError('Opened date is required.');
        return;
      }
      if (openedDate > today) {
        setError('Opened date cannot be in the future.');
        return;
      }
      if (openedDate < purchaseDate) {
        setError('Opened date cannot be earlier than purchase date.');
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Update Product
      await db.updateProduct(user.id, product.id, {
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        size_value: sizeValue ? Number(sizeValue) : null,
        size_unit: sizeValue ? sizeUnit : null,
      });

      // 2. Update Purchase
      await db.updatePurchase(user.id, purchase.id, {
        purchase_date: purchaseDate,
        price: Number(price),
        currency: currency.trim() || 'BDT',
        store_vendor: storeVendor.trim() ? storeVendor.trim() : null,
      });

      // 3. Update Usage Period if active bottle
      if (mode === 'active_bottle' && usagePeriod) {
        await db.updateUsagePeriod(user.id, usagePeriod.id, {
          opened_date: openedDate,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'active_bottle' ? 'Edit Current Bottle' : 'Edit Unopened Purchase';
  const subtitle =
    mode === 'active_bottle'
      ? 'Update product identity, acquisition, or opened date for this active bottle.'
      : 'Update product identity or acquisition details for this stored purchase.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-backdrop-in">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F] block mb-0.5">
              Inventory Management
            </span>
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">{title}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-lg font-bold p-1 cursor-pointer transition-colors"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          {/* Section: Product Details */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block border-b border-neutral-100 pb-1">
              Product Details
            </span>

            <div className="space-y-1">
              <label htmlFor="edit-product-name" className="font-medium text-neutral-700 block">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-product-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CeraVe Hydrating Cleanser"
                required
                className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="edit-brand" className="font-medium text-neutral-700 block">
                  Brand <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  id="edit-brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. CeraVe"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-category" className="font-medium text-neutral-700 block">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="edit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="edit-size-val" className="font-medium text-neutral-700 block">
                  Size Value
                </label>
                <input
                  id="edit-size-val"
                  type="number"
                  step="any"
                  min="0.1"
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  placeholder="e.g. 236"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-size-unit" className="font-medium text-neutral-700 block">
                  Unit
                </label>
                <select
                  id="edit-size-unit"
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value as SizeUnit)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all cursor-pointer"
                >
                  {SIZE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Purchase Details */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block border-b border-neutral-100 pb-1">
              Purchase Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="edit-purchase-date" className="font-medium text-neutral-700 block">
                  Purchase Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-purchase-date"
                  type="date"
                  value={purchaseDate}
                  max={today}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="edit-price" className="font-medium text-neutral-700 block">
                  Price (৳) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-price"
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="edit-currency" className="font-medium text-neutral-700 block">
                  Currency
                </label>
                <input
                  id="edit-currency"
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-store-vendor" className="font-medium text-neutral-700 block">
                Store / Vendor
              </label>
              <input
                id="edit-store-vendor"
                type="text"
                value={storeVendor}
                onChange={(e) => setStoreVendor(e.target.value)}
                placeholder="e.g. Shajgoj, Daraz, local pharmacy"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-400">
                Optional — where you bought this purchase.
              </p>
            </div>
          </div>

          {/* Section: Usage Details (Active Bottle Only) */}
          {mode === 'active_bottle' && (
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block border-b border-neutral-100 pb-1">
                Usage Details
              </span>

              <div className="space-y-1">
                <label htmlFor="edit-opened-date" className="font-medium text-neutral-700 block">
                  Opened Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-opened-date"
                  type="date"
                  value={openedDate}
                  min={purchaseDate || undefined}
                  max={today}
                  onChange={(e) => setOpenedDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200/80 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all cursor-pointer"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Must be on or after purchase date ({purchaseDate || 'N/A'}) and cannot be in the future.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-press px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-press px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white font-semibold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
