// ==============================================================================
// Nittoo Delete Account Modal
// High-friction destructive confirmation dialog for permanently purging account data
// Requires deliberate confirmation, accessible focus, and clear permanent warnings
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();

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

  if (!isOpen) return null;

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount();
      navigate('/login', {
        replace: true,
        state: { message: 'Your account and all associated data have been permanently deleted.' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't delete account. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in">
        <div className="space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-lg font-bold">
            ⚠️
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block pt-1">
            PERMANENT ACTION
          </span>
          <h2 id="delete-account-title" className="text-xl font-bold tracking-tight text-neutral-900">
            DELETE YOUR ACCOUNT?
          </h2>
          <p className="text-xs text-neutral-600 leading-relaxed pt-1">
            This permanently removes your account, products, purchases, inventory, and usage history. This cannot be undone.
          </p>
        </div>

        {error && (
          <div
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2"
            role="alert"
          >
            <span className="font-bold shrink-0">!</span>
            <span>{error}</span>
          </div>
        )}

        <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="btn-press min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting ? 'Deleting Account...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
