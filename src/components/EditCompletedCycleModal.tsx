// ==============================================================================
// Nittoo Edit Completed Historical Cycle Modal (Stage 17)
// Allows non-destructive correction of opened and finished dates for completed cycles.
// Strictly prevents changing product, purchase, user, or status.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC } from '../lib/dateUtils';
import type { UsagePeriod } from '../types';

export interface EditCompletedCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  productName: string;
  cycle: UsagePeriod | null;
  cycleNumber?: number;
}

export const EditCompletedCycleModal: React.FC<EditCompletedCycleModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productName,
  cycle,
  cycleNumber,
}) => {
  const { user } = useAuth();
  const today = getTodayUTC();

  const [openedDate, setOpenedDate] = useState('');
  const [finishedDate, setFinishedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && cycle) {
      setOpenedDate(cycle.opened_date || '');
      setFinishedDate(cycle.finished_date || '');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, cycle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !cycle) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    // 1. Required fields
    if (!openedDate || !openedDate.trim()) {
      setError('Opened date is required.');
      return;
    }
    if (!finishedDate || !finishedDate.trim()) {
      setError('Finished date is required.');
      return;
    }

    // 2. Future date guards
    if (openedDate > today) {
      setError('Opened date cannot be in the future.');
      return;
    }
    if (finishedDate > today) {
      setError('Finished date cannot be in the future.');
      return;
    }

    // 3. Chronological validity
    if (finishedDate < openedDate) {
      setError('Finished date cannot be earlier than opened date.');
      return;
    }

    setSubmitting(true);
    try {
      await db.updateUsagePeriod(user.id, cycle.id, {
        opened_date: openedDate,
        finished_date: finishedDate,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update completed cycle';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-cycle-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
              {cycleNumber ? `Cycle #${cycleNumber}` : 'Historical Cycle'}
            </span>
            <h2 id="edit-cycle-title" className="text-lg font-bold text-neutral-900 tracking-tight">
              Edit Completed Cycle
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-neutral-400 hover:text-neutral-700 text-xl font-bold leading-none p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 animate-page-in">
            <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-opened-date" className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Opened Date
              </label>
              <input
                id="edit-opened-date"
                type="date"
                max={today}
                value={openedDate}
                onChange={(e) => setOpenedDate(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="edit-finished-date" className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Finished Date
              </label>
              <input
                id="edit-finished-date"
                type="date"
                min={openedDate || undefined}
                max={today}
                value={finishedDate}
                onChange={(e) => setFinishedDate(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all"
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed bg-neutral-50 border border-neutral-100 rounded-xl p-3">
            Correct the dates if you recorded this cycle incorrectly. Related insights will update automatically.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-press px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-press px-4 py-2 text-xs font-semibold text-white bg-[#2D6A4F] hover:bg-[#24563F] rounded-xl transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
