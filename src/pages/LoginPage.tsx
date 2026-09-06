// ==============================================================================
// Nittoo Login Page
// Email/Password, Magic Link, Demo Account Helper, and Deep-Link Redirection
// Premium, calm authentication composition with official brand logo
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
      {/* Background Decorative Ambient Tone */}
      <div className="w-full max-w-md my-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <NittooLogo variant="horizontal" size="xl" showTagline={true} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-4">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xs">
            Sign in to track your personal essentials, lifespans, and true costs.
          </p>
        </div>

        {/* Card Container */}
        <div className="w-full bg-white border border-neutral-200/80 rounded-2xl p-7 sm:p-8 shadow-xs">
          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-page-in">
              <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
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

          {/* Demo Quick Sign-in Button (Shown in Mock Mode) */}
          {isMockMode && !magicLinkSent && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={submitting}
                className="btn-press w-full py-2 px-3.5 rounded-xl border border-[#2D6A4F]/25 bg-[#EBF4F0]/60 hover:bg-[#EBF4F0] text-[#2D6A4F] text-xs font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
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
      <footer className="py-4 text-center text-xs text-neutral-400">
        Nittoo — Know What Lasts
      </footer>
    </div>
  );
};
