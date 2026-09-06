// ==============================================================================
// Nittoo Signup Page
// User Registration, Validation, Error Handling, and Session Creation
// Clean, confident onboarding layout with official brand logo
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { NittooLogo } from '../components/NittooLogo';

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(email, password);
      if (result?.requiresEmailConfirmation) {
        setEmailSentNotice(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('check your email')) {
        setEmailSentNotice(true);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-8 sm:py-12 bg-[#FBFBFB]">
      <div className="w-full max-w-md my-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <NittooLogo variant="horizontal" size="xl" showTagline={true} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-4">
            Create your account
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xs">
            Start tracking how long your essentials last and plan future spending.
          </p>
        </div>

        {/* Card Container */}
        <div className="w-full bg-white border border-neutral-200/80 rounded-2xl p-7 sm:p-8 shadow-xs">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-page-in">
              <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {emailSentNotice ? (
            <div className="p-6 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3 animate-page-in">
              <div className="w-9 h-9 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-sm font-bold shadow-xs">
                ✓
              </div>
              <p className="text-sm font-semibold text-[#2D6A4F]">Confirmation email dispatched</p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Please check your inbox at <strong>{email}</strong> to verify your account before logging in.
              </p>
              <div className="pt-2">
                <Link to="/login" className="btn-press inline-block text-xs font-semibold text-[#2D6A4F] hover:underline">
                  Return to Sign In →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="signup-email">
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="signup-password">
                  Password (min. 6 characters)
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-press w-full py-2.5 px-4 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-neutral-100 text-center text-xs text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="text-[#2D6A4F] font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-neutral-400">
        Nittoo — Know What Lasts
      </footer>
    </div>
  );
};
