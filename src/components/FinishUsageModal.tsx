// ==============================================================================
// Nittoo Finish Usage Modal
// Confirmation dialog with finished date selection for completing an active essential
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC, formatDisplayDate } from '../lib/dateUtils';
import { calculateCurrentDaysUsed } from '../lib/prediction';
import type { ProductWithDetails } from '../types';

interface FinishUsageModalProps {
  product: ProductWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onFinished: () => void;
}

export const FinishUsageModal: React.FC<FinishUsageModalProps> = ({
  product,
  isOpen,
  onClose,
  onFinished,
}) => {
  const { user } = useAuth();
  const today = getTodayUTC();

  const [finishedDate, setFinishedDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFinishedDate(today);
      setError(null);
    }
  }, [isOpen, today]);

  if (!isOpen || !product || !product.active_usage) return null;

  const activeUsage = product.active_usage;
  const daysUsed = calculateCurrentDaysUsed(activeUsage.opened_date, finishedDate);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (finishedDate < activeUsage.opened_date) {
      setError('Finished date cannot be earlier than the opened date.');
      return;
    }

    setSubmitting(true);
    try {
      await db.finishUsagePeriod(user.id, activeUsage.id, finishedDate);
      onFinished();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to finish usage period';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-lg p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              Mark Essential As Finished
            </span>
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl font-bold leading-none p-1"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Opened Date:</span>
            <span className="font-semibold text-neutral-800">
              {formatDisplayDate(activeUsage.opened_date)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Total Duration:</span>
            <span className="font-semibold text-[#2D6A4F]">
              {daysUsed} day{daysUsed === 1 ? '' : 's'} of use
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label
              htmlFor="finished-date-input"
              className="block text-xs font-medium text-neutral-700 mb-1.5"
            >
              Finish Date (Date when bottle was depleted)
            </label>
            <input
              id="finished-date-input"
              type="date"
              required
              min={activeUsage.opened_date}
              value={finishedDate}
              onChange={(e) => setFinishedDate(e.target.value)}
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-white disabled:opacity-60"
            />
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Completing this usage period will store its final duration in your product history and update your average lifespan prediction for future bottles.
          </p>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? 'Finishing...' : 'Confirm & Finish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
