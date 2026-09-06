// ==============================================================================
// Nittoo Shared Application Layout
// Sticky navigation bar, user identity badge, and authenticated logout action
// Optimized for 375px mobile responsiveness & desktop clarity
// ==============================================================================

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
    { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard' },
    { to: '/add-product', label: 'Add Product', shortLabel: '+ Add' },
    { to: '/analytics', label: 'Analytics', shortLabel: 'Analytics' },
    { to: '/account', label: 'Account', shortLabel: 'Account' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFB] text-[#111827]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 font-semibold text-lg tracking-tight text-[#111827] hover:opacity-95"
              aria-label="Nittoo Home"
            >
              <span className="w-8 h-8 rounded-lg bg-[#2D6A4F] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                N
              </span>
              <span className="font-bold">Nittoo</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1" aria-label="Desktop primary">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#EBF4F0] text-[#2D6A4F]'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Badge & Actions */}
          <div className="flex items-center gap-3">
            {user && (
              <div
                className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-full border border-neutral-200/50"
                title={user.email}
              >
                <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                <span className="max-w-[180px] truncate">{user.email}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors duration-150"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Navigation (375px Non-Scrolling 4-Column Bar) */}
        <nav
          className="sm:hidden border-t border-neutral-100 px-2 py-1 bg-white/95 grid grid-cols-4 gap-1"
          aria-label="Mobile primary"
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`min-h-[44px] flex items-center justify-center text-xs text-center rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#EBF4F0] text-[#2D6A4F] font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {link.shortLabel}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-page-in">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/60 py-6 text-center text-xs text-neutral-400">
        <p>Nittoo — Personal Essentials & Consumption Tracker</p>
      </footer>
    </div>
  );
};
