// ==============================================================================
// Nittoo Signup Page
// User Registration, Validation, Error Handling, and Session Creation
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
      // Supabase may require email confirmation
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
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-neutral-200/80 rounded-2xl p-8 shadow-xs">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#2D6A4F] text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 shadow-xs">
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Create your Nittoo Account</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Start tracking how long your essentials last and plan future spending.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {emailSentNotice ? (
          <div className="p-4 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3">
            <p className="text-sm font-medium text-[#2D6A4F]">Confirmation Email Dispatched</p>
            <p className="text-xs text-neutral-600">
              Please check your inbox at <strong>{email}</strong> to verify your account before logging in.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-semibold text-[#2D6A4F] hover:underline">
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="signup-email">
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="signup-password">
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="confirm-password">
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating account...' : 'Create Account'}
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
  );
};
