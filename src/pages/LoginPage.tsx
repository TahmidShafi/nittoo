// ==============================================================================
// Nittoo Login Page
// Email/Password, Magic Link, Demo Account Helper, and Deep-Link Redirection
// Linear-inspired calm authentication workspace with official brand logo
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isMockMode } from '../lib/dataSource';
import { NittooLogo } from '../components/NittooLogo';

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
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-8 sm:py-12 bg-[#FBFBFB]">
      <div className="w-full max-w-sm my-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <NittooLogo variant="horizontal" size="lg" showTagline={false} />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 mt-4">
            Sign in to Nittoo
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Know what lasts.
          </p>
        </div>

        {/* Card Container */}
        <div className="w-full bg-white border border-[#E8ECE9] rounded-xl p-6 sm:p-7 shadow-xs">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start gap-2 shadow-xs animate-page-in">
              <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Magic Link Sent Alert */}
          {magicLinkSent ? (
            <div className="p-5 rounded-lg bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-2.5 animate-page-in">
              <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-xs font-bold shadow-xs">
                ✓
              </div>
              <p className="text-xs font-semibold text-[#2D6A4F]">Magic link sent</p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Check your inbox at <strong>{email}</strong> for your secure login link.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMagicLinkSent(false);
                  setIsMagicLink(false);
                }}
                className="btn-press mt-1 text-xs font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
              >
                Back to password sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Mode Selector */}
              <div className="flex p-0.5 bg-neutral-100 rounded-lg text-xs font-medium text-neutral-600 mb-3">
                <button
                  type="button"
                  onClick={() => setIsMagicLink(false)}
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                    !isMagicLink
                      ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                      : 'hover:text-neutral-900'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setIsMagicLink(true)}
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                    isMagicLink
                      ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                      : 'hover:text-neutral-900'
                  }`}
                >
                  Magic Link
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              {!isMagicLink && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-neutral-700" htmlFor="login-password">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] text-[#2D6A4F] hover:underline font-medium"
                    >
                      Forgot?
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
                    className="w-full px-3 py-2 rounded-lg border border-[#E8ECE9] text-xs focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all bg-white disabled:opacity-60 placeholder:text-neutral-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-press w-full py-2 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : isMagicLink ? (
                  <span>Send Magic Link</span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Demo Sign In Button (Mock Mode) */}
          {isMockMode && !magicLinkSent && (
            <div className="mt-4 pt-3.5 border-t border-[#F0F2F1]">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={submitting}
                className="btn-press w-full py-1.5 px-3 rounded-lg border border-[#2D6A4F]/20 bg-[#EBF4F0]/60 hover:bg-[#EBF4F0] text-[#2D6A4F] text-xs font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>⚡ Demo Sign In</span>
              </button>
            </div>
          )}

          {/* Signup Switch */}
          <div className="mt-4 pt-3.5 border-t border-[#F0F2F1] text-center text-xs text-neutral-500">
            <p>
              New to Nittoo?{' '}
              <Link to="/signup" className="text-[#2D6A4F] font-semibold hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-neutral-400">
        Nittoo · Know What Lasts
      </footer>
    </div>
  );
};
