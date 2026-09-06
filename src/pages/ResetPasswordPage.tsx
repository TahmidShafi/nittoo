// ==============================================================================
// Nittoo Reset Password Page
// Sets new password for recovery session
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Set new password</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Choose a strong password for your Nittoo account.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-5 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-sm font-bold">
              ✓
            </div>
            <p className="text-sm font-medium text-[#2D6A4F]">Password updated successfully</p>
            <p className="text-xs text-neutral-600">
              Redirecting you to the sign-in page...
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-semibold text-[#2D6A4F] hover:underline">
                Go to Sign In now
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="reset-new-password">
                New Password (min. 6 characters)
              </label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="reset-confirm-password">
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
