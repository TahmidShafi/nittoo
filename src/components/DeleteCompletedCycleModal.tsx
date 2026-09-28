// ==============================================================================
// Nittoo Delete Completed Historical Cycle Modal (Stage 17)
// Confirms removal of a historical finished usage cycle without deleting the purchase.
// Reassures the user that the purchase record remains preserved.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { formatDisplayDate } from '../lib/dateUtils';
import type { UsagePeriod } from '../types';

export interface DeleteCompletedCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  productName: string;
  cycle: UsagePeriod | null;
  cycleNumber?: number;
  durationDays?: number;
}

export const DeleteCompletedCycleModal: React.FC<DeleteCompletedCycleModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  productName,
  cycle,
  cycleNumber,
  durationDays,
}) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

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

  const handleDelete = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await db.deleteUsagePeriod(user.id, cycle.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete usage cycle';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-cycle-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in">
        <div className="space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center text-lg font-bold">
            ⚠️
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block pt-1">
            {cycleNumber ? `Cycle #${cycleNumber}` : 'Historical Cycle'}
          </span>
          <h2 id="delete-cycle-title" className="text-xl font-bold tracking-tight text-neutral-900">
            DELETE COMPLETED CYCLE?
          </h2>
          <p className="text-xs font-semibold text-neutral-700">{productName}</p>
        </div>

        <p className="text-xs text-neutral-600 leading-relaxed">
          This removes this historical usage record and its contribution to Nittoo's learning calculations.
        </p>

        {/* Cycle details recap */}
        <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100 space-y-1.5 text-xs text-neutral-600">
          <div className="flex justify-between">
            <span className="text-neutral-500">Recorded span</span>
            <span className="font-semibold text-neutral-800">
              {formatDisplayDate(cycle.opened_date)} → {formatDisplayDate(cycle.finished_date || '')}
            </span>
          </div>
          {durationDays !== undefined && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Duration</span>
              <span className="font-semibold text-neutral-800">{durationDays} days</span>
            </div>
          )}
          <div className="pt-1.5 mt-1.5 border-t border-neutral-200/60 text-[11px] text-neutral-500 italic">
            Note: The associated purchase record will remain preserved in your inventory.
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 animate-page-in">
            <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Actions */}
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
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="btn-press px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Deleting Cycle...' : 'Delete Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
};
