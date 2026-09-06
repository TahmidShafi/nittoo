// ==============================================================================
// Nittoo Shared Application Layout
// Sticky top header with brand logo, desktop pill navigation, mobile app bottom bar
// Optimized for 375px mobile responsiveness & high-resolution desktop clarity
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      ),
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="5" x="2" y="3" rx="1" />
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M10 12h4" />
        </svg>
      ),
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
    },
    {
      to: '/account',
      label: 'Account',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      ),
    },
  ];

  const checkIsActive = (linkTo: string) => {
    if (location.pathname === linkTo) return true;
    if (linkTo === '/dashboard' && location.pathname.startsWith('/product/')) return true;
    if (linkTo === '/inventory' && location.pathname === '/add-inventory') return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFB] text-[#111827]">
      {/* Desktop & Mobile Top Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/90 backdrop-blur-md transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <NittooLogo variant="horizontal" size="md" clickable />

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Desktop primary">
              {navLinks.map((link) => {
                const isActive = checkIsActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`btn-press inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#EBF4F0] text-[#2D6A4F] font-semibold shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
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

          {/* User Account / Identity Bar */}
          <div className="flex items-center gap-3">
            {user && (
              <div
                className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-600 bg-neutral-100/80 px-2.5 py-1.5 rounded-full border border-neutral-200/60"
                title={user.email}
              >
                <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse" />
                <span className="max-w-[170px] truncate">{user.email}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="btn-press min-h-[36px] px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 border border-transparent hover:border-neutral-200/80"
              aria-label="Sign out of your account"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 mb-20 md:mb-8">
        {children}
      </main>

      {/* Mobile Deliberate Bottom Navigation Bar (Fixed, 375px+ compliant) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-neutral-200/80 px-2 py-1.5 shadow-lg grid grid-cols-4 gap-1"
        aria-label="Mobile primary bottom navigation"
      >
        {navLinks.map((link) => {
          const isActive = checkIsActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`btn-press min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
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

      {/* Desktop Minimal Footer */}
      <footer className="hidden md:block border-t border-neutral-200/50 py-6 text-center text-xs text-neutral-400">
        <p className="flex items-center justify-center gap-1.5">
          <span>Nittoo</span>
          <span>•</span>
          <span className="italic">Know What Lasts</span>
        </p>
      </footer>
    </div>
  );
};
