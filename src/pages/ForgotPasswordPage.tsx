// ==============================================================================
// Nittoo Forgot Password Page
// Dispatches recovery link via requestPasswordReset
// ==============================================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-neutral-200/80 rounded-2xl p-8 shadow-xs">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#2D6A4F] text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 shadow-xs">
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Reset your password</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Enter your email address and we'll send you a recovery link.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="p-5 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-sm font-bold">
              ✓
            </div>
            <p className="text-sm font-medium text-[#2D6A4F]">Check your inbox</p>
            <p className="text-xs text-neutral-600">
              If an account exists for <strong>{email}</strong>, a recovery link has been dispatched.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs text-[#2D6A4F] font-semibold hover:underline">
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="recovery-email">
                Email address
              </label>
              <input
                id="recovery-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-neutral-100 text-center text-xs text-neutral-500">
          Remember your password?{' '}
          <Link to="/login" className="text-[#2D6A4F] font-semibold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
