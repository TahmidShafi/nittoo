// ==============================================================================
// Nittoo Change Email Modal
// Focused, accessible dialog for requesting an account email change
// Follows strict validation, quiet tone, and clear confirmation messaging
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, updateEmail } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewEmail('');
      setConfirmEmail('');
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

  const currentEmail = user?.email || '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNew = newEmail.trim();
    const trimmedConfirm = confirmEmail.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedNew || !emailRegex.test(trimmedNew)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedNew.toLowerCase() === currentEmail.toLowerCase()) {
      setError('New email must be different from your current email.');
      return;
    }

    if (trimmedNew.toLowerCase() !== trimmedConfirm.toLowerCase()) {
      setError('Email addresses do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateEmail(trimmedNew);
      onSuccess(result.message || 'Check your new email to confirm the change.');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't update your email.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
            ACCOUNT SECURITY
          </span>
          <h2 id="change-email-title" className="text-xl font-bold tracking-tight text-neutral-900">
            Change Email
          </h2>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Update the email address associated with your personal Nittoo account.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Email Display */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">
              Current email
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-xs font-medium text-neutral-600 select-all">
              {currentEmail}
            </div>
          </div>

          {/* New Email Input */}
          <div>
            <label htmlFor="new-email" className="block text-xs font-semibold text-neutral-700 mb-1">
              New email
            </label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all disabled:bg-neutral-50 min-h-[44px]"
            />
          </div>

          {/* Confirm New Email Input */}
          <div>
            <label htmlFor="confirm-email" className="block text-xs font-semibold text-neutral-700 mb-1">
              Confirm new email
            </label>
            <input
              id="confirm-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all disabled:bg-neutral-50 min-h-[44px]"
            />
          </div>

          {/* Dialog Action Buttons */}
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
              type="submit"
              disabled={submitting}
              className="btn-press min-h-[44px] px-5 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? 'Updating...' : 'Change Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
