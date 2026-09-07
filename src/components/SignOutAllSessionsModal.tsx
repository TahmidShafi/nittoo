// ==============================================================================
// Nittoo Sign Out All Sessions Modal
// Confirmation dialog for signing out globally across all devices
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface SignOutAllSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignOutAllSessionsModal: React.FC<SignOutAllSessionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { signOutAllSessions } = useAuth();
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

  const handleSignOutAll = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signOutAllSessions();
      navigate('/login', {
        replace: true,
        state: { message: 'You have been signed out of all active sessions.' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't sign out of sessions. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-out-all-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
            SESSION SECURITY
          </span>
          <h2 id="sign-out-all-title" className="text-xl font-bold tracking-tight text-neutral-900">
            Sign out of all sessions?
          </h2>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            This will sign out your account across all browsers and devices. You will need to sign back in with your credentials to access your tracker.
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
            onClick={handleSignOutAll}
            disabled={submitting}
            className="btn-press min-h-[44px] px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting ? 'Signing out...' : 'Sign out all sessions'}
          </button>
        </div>
      </div>
    </div>
  );
};
