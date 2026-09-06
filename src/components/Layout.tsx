// ==============================================================================
// Nittoo Shared Application Shell
// Linear-inspired Quiet Chrome: High information density, quiet navigation,
// precise vertical rhythm, and deliberate mobile toolbar
// ==============================================================================

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { NittooLogo } from './NittooLogo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const navLinks = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      ),
    },
    {
      to: '/add-product',
      label: 'Add Product',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      ),
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
    },
    {
      to: '/account',
      label: 'Account',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFB] text-[#111827]">
      {/* Quiet Chrome Header (Desktop & Mobile Top) */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/90 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-13 flex items-center justify-between">
          {/* Left: Brand Logo & Desktop Navigation */}
          <div className="flex items-center gap-6 sm:gap-8">
            <NittooLogo variant="horizontal" size="sm" clickable />

            {/* Desktop Navigation Links — Quiet, High-density */}
            <nav className="hidden md:flex items-center gap-0.5" aria-label="Desktop primary">
              {navLinks.map((link) => {
                const isActive =
                  location.pathname === link.to ||
                  (link.to === '/dashboard' && location.pathname.startsWith('/product/'));
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 font-normal'
                    }`}
                  >
                    <span className={isActive ? 'text-[#2D6A4F]' : 'text-neutral-400'}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: User Identity & Actions */}
          <div className="flex items-center gap-2.5">
            {user && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60"
                title={user.email}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                <span className="max-w-[160px] truncate font-mono text-[11px] text-neutral-600">
                  {user.email}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="btn-press min-h-[32px] px-2.5 py-1 text-xs font-medium text-neutral-400 hover:text-neutral-800 rounded-md hover:bg-neutral-100/70 border border-transparent hover:border-neutral-200/60 transition-colors"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area — High Density, Expanded Viewport Utilization */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 animate-page-in pb-20 md:pb-10">
        {children}
      </main>

      {/* Mobile Deliberate Bottom Toolbar (375px+ compliant, >=44px touch targets) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-neutral-200/80 px-2 py-1 shadow-xs grid grid-cols-4 gap-1"
        aria-label="Mobile primary bottom navigation"
      >
        {navLinks.map((link) => {
          const isActive =
            location.pathname === link.to ||
            (link.to === '/dashboard' && location.pathname.startsWith('/product/'));
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`btn-press min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${
                isActive
                  ? 'text-[#2D6A4F] bg-[#EBF4F0]/80 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <span className={isActive ? 'text-[#2D6A4F]' : 'text-neutral-400'}>
                {link.icon}
              </span>
              <span className="text-[10px] leading-none tracking-tight">
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Understated Footer */}
      <footer className="hidden md:block border-t border-neutral-200/40 py-4 text-center text-[11px] text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-neutral-500">Nittoo</span>
            <span>—</span>
            <span className="text-neutral-400">Personal Consumption Intelligence</span>
          </p>
          <p className="text-neutral-400 font-mono text-[10px]">Know What Lasts</p>
        </div>
      </footer>
    </div>
  );
};
