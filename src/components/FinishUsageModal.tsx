// ==============================================================================
// Nittoo Finish Usage Modal
// Confirmation dialog with finished date selection for completing an active essential
// Linear-inspired compact modal with precise controls & subtle transitions
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-backdrop-in">
      <div className="w-full max-w-sm bg-white rounded-xl border border-[#E8ECE9] shadow-xl p-5 space-y-4 animate-modal-in">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5">
              Finish Bottle
            </span>
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-lg font-bold leading-none p-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start gap-1.5 shadow-xs animate-page-in">
            <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        <div className="bg-neutral-50 rounded-lg p-3 border border-[#F0F2F1] space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-neutral-500">
            <span>Opened date</span>
            <span className="font-medium text-neutral-800">
              {formatDisplayDate(activeUsage.opened_date)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-neutral-200/40">
            <span className="text-neutral-500">Cycle duration</span>
            <span className="font-bold text-[#2D6A4F] text-xs">
              {daysUsed} day{daysUsed === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-3.5">
          <div>
            <label
              htmlFor="finished-date-input"
              className="block text-xs font-semibold text-neutral-700 mb-1"
            >
              Finish Date
            </label>
            <input
              id="finished-date-input"
              type="date"
              required
              min={activeUsage.opened_date}
              value={finishedDate}
              onChange={(e) => setFinishedDate(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 text-neutral-900"
            />
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Completing this usage period stores its duration in your history and refines your average lifespan calculation for future bottles.
          </p>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-press px-3 py-1.5 rounded-lg border border-[#E8ECE9] hover:bg-neutral-50 text-neutral-600 text-xs font-medium transition-all disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-press px-3.5 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                'Finish Bottle'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
