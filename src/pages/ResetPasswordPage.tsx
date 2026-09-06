// ==============================================================================
// Nittoo Reset Password Page
// Sets new password for recovery session
// Linear-inspired restrained auth workspace with official brand logo
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { NittooLogo } from '../components/NittooLogo';

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
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-8 sm:py-12 bg-[#FBFBFB]">
      <div className="w-full max-w-sm my-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <NittooLogo variant="horizontal" size="lg" showTagline={false} />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 mt-4">
            Set new password
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Minimum 6 characters.
          </p>
        </div>

        {/* Card Container */}
        <div className="w-full bg-white border border-[#E8ECE9] rounded-xl p-6 sm:p-7 shadow-xs">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start gap-2 shadow-xs animate-page-in">
              <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-5 rounded-lg bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-2.5 animate-page-in">
              <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-xs font-bold shadow-xs">
                ✓
              </div>
              <p className="text-xs font-semibold text-[#2D6A4F]">Password updated</p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Redirecting you to sign in...
              </p>
              <div className="pt-1">
                <Link to="/login" className="btn-press inline-block text-xs font-semibold text-[#2D6A4F] hover:underline">
                  Go to Sign In now →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1" htmlFor="reset-new-password">
                  New Password
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
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1" htmlFor="reset-confirm-password">
                  Confirm Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-press w-full py-2 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating password...</span>
                  </span>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-4 pt-3.5 border-t border-[#F0F2F1] text-center text-xs text-neutral-500">
            <Link to="/login" className="text-[#2D6A4F] font-semibold hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-neutral-400">
        Nittoo · Know What Lasts
      </footer>
    </div>
  );
};
