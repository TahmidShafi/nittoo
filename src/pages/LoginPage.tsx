// ==============================================================================
// Nittoo Login Page
// Email/Password, Magic Link, Demo Account Helper, and Deep-Link Redirection
// Premium, calm authentication composition with official brand logo
// ==============================================================================

import React, { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePageMeta } from '../hooks/usePageMeta';
import { isMockMode } from '../lib/dataSource';
import { NittooLogo } from '../components/NittooLogo';

const DemoProductPreview = lazy(() => import('../components/DemoProductPreview'));

export const LoginPage: React.FC = () => {
  usePageMeta({
    title: 'Sign In',
    description: 'Sign in to Nittoo to track your personal essentials, lifespans, and true daily costs.',
    noindex: false,
    canonicalPath: '/login',
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, sendMagicLink, enterDemoMode } = useAuth();
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

  const handleTryDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await enterDemoMode();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start demo mode';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-6 sm:py-10 bg-[#FBFBFB]">
      {/* Main Content: Mobile-first single column, 2-column split on desktop */}
      <div className="w-full max-w-md lg:max-w-5xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Hero & Value Proposition */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
          <NittooLogo variant="horizontal" size="xl" showTagline={true} />

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-tight">
              Track what you use. Know what it costs.
            </h1>
            <p className="text-sm text-neutral-600 max-w-lg leading-relaxed">
              Follow everyday essentials from purchase to finish to see how long each container lasts, what it costs per day, and when to restock.
            </p>
          </div>

          {/* Primary Action: Try the Demo */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={submitting}
              className="btn-press w-full sm:w-auto px-6 py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-semibold transition-colors shadow-xs disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Try the demo</span>
              <span aria-hidden="true">→</span>
            </button>
            <span className="text-xs font-medium text-neutral-600">
              No sign-up needed · 12 sample products
            </span>
          </div>

          {/* 3 Short Feature Highlights */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs space-y-1">
              <p className="text-sm font-semibold text-neutral-900">Run-out forecasts</p>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                Estimates remaining days and a run-out window from completed cycles.
              </p>
            </div>
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs space-y-1">
              <p className="text-sm font-semibold text-neutral-900">True daily cost</p>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                Turns purchase prices into a clear cost per day and monthly run rate.
              </p>
            </div>
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs space-y-1">
              <p className="text-sm font-semibold text-neutral-900">Backup inventory</p>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                Tracks unopened stock separately from what you are using right now.
              </p>
            </div>
          </div>

          {/* Lazy-loaded non-interactive ProductCard preview using real DEMO_SEED data */}
          <div className="w-full pt-1 text-left">
            <Suspense
              fallback={
                <div className="h-56 skeleton-shimmer rounded-2xl border border-neutral-200/80" />
              }
            >
              <DemoProductPreview />
            </Suspense>
          </div>
        </div>

        {/* Sign-In Card Container */}
        <div className="lg:col-span-5 w-full bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="mb-4">
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Access your personal essentials across devices.
            </p>
          </div>
          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-status-critical-bg border border-status-critical-border text-status-critical-text text-xs font-medium flex items-start gap-2.5 animate-page-in">
              <span className="text-status-critical-text font-bold leading-none mt-0.5">!</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Magic Link Sent Alert */}
          {magicLinkSent ? (
            <div className="p-6 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-center space-y-3 animate-page-in">
              <div className="w-9 h-9 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center mx-auto text-sm font-bold shadow-xs">
                ✓
              </div>
              <p className="text-sm font-semibold text-[#2D6A4F]">Magic link dispatched</p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                We sent a secure login link to <strong>{email}</strong>. Check your inbox to sign in instantly.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMagicLinkSent(false);
                  setIsMagicLink(false);
                }}
                className="btn-press mt-2 text-xs font-semibold text-[#2D6A4F] hover:underline"
              >
                Back to email & password
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mode Selector Pill (Password vs Magic Link) */}
              <div className="flex p-0.5 bg-neutral-100/90 rounded-xl mb-4 text-xs font-medium text-neutral-600">
                <button
                  type="button"
                  onClick={() => setIsMagicLink(false)}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
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
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    isMagicLink
                      ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                      : 'hover:text-neutral-900'
                  }`}
                >
                  Magic Link
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="login-email">
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 disabled:opacity-60 placeholder:text-neutral-400"
                />
              </div>

              {!isMagicLink && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-neutral-700" htmlFor="login-password">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-[#2D6A4F] hover:underline font-medium"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-4 focus:ring-[#2D6A4F]/10 transition-all bg-neutral-50/40 disabled:opacity-60 placeholder:text-neutral-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-press w-full py-2.5 px-4 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </span>
                ) : isMagicLink ? (
                  <span>Send Magic Link</span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Mock Mode Demo User Helper */}
          {!magicLinkSent && isMockMode && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={submitting}
                className="btn-press w-full py-2 px-3.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <span>⚡</span>
                <span>Sign in as Demo User (demo-user@nittoo.local)</span>
              </button>
            </div>
          )}

          {/* Signup Switch Link */}
          <div className="mt-6 pt-5 border-t border-neutral-100 text-center text-xs text-neutral-500">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#2D6A4F] font-semibold hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Auth Footer Note */}
      <footer className="py-4 text-center text-xs text-neutral-500">
        Nittoo — Know What Lasts
      </footer>
    </div>
  );
};
