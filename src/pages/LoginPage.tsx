// ==============================================================================
// Nittoo Login Page
// Email/Password, Magic Link, Demo Account Helper, and Deep-Link Redirection
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isMockMode } from '../lib/dataSource';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, sendMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine post-login redirect path
  const fromLocation = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const redirectPath = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}`
    : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isMagicLink) {
        await sendMagicLink(email);
        setMagicLinkSent(true);
      } else {
        await signIn(email, password);
        navigate(redirectPath, { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Email not confirmed. Please check your inbox and verify your email before logging in.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn('demo-user@nittoo.local', 'demo1234');
      navigate(redirectPath, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo sign in failed';
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Welcome to Nittoo</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track everyday essentials, lifespans, and true costs.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {/* Magic Link Sent Alert */}
        {magicLinkSent ? (
          <div className="p-4 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-sm font-bold">
              ✓
            </div>
            <p className="text-sm font-medium text-[#2D6A4F]">Magic link dispatched</p>
            <p className="text-xs text-neutral-600">
              We have sent an authentication link to <strong>{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setMagicLinkSent(false);
                setIsMagicLink(false);
              }}
              className="text-xs font-medium text-[#2D6A4F] hover:underline"
            >
              Sign in with password instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
              />
            </div>

            {!isMagicLink && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-neutral-700" htmlFor="login-password">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#2D6A4F] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-all bg-neutral-50/40 disabled:opacity-60"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Authenticating...</span>
              ) : isMagicLink ? (
                <span>Send Magic Link</span>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        {/* Demo Quick Sign-in Button (Shown in Mock Mode) */}
        {isMockMode && !magicLinkSent && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={submitting}
              className="w-full py-2 px-4 rounded-lg border border-[#2D6A4F]/30 bg-[#EBF4F0]/60 hover:bg-[#EBF4F0] text-[#2D6A4F] text-xs font-semibold transition-colors disabled:opacity-60"
            >
              ⚡ Sign in as Demo User (demo-user@nittoo.local)
            </button>
          </div>
        )}

        {/* Toggles and Secondary Links */}
        <div className="mt-6 pt-5 border-t border-neutral-100 flex flex-col gap-3 text-center text-xs text-neutral-500">
          {!magicLinkSent && (
            <button
              type="button"
              onClick={() => setIsMagicLink(!isMagicLink)}
              className="text-neutral-600 hover:text-neutral-900 font-medium"
            >
              {isMagicLink ? '← Back to password sign-in' : 'Sign in with Magic Link instead'}
            </button>
          )}

          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#2D6A4F] font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
