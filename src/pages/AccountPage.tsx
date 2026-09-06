// ==============================================================================
// Nittoo Account Page
// User profile information, storage mode indicator, and data reset action
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, isMockMode } from '../lib/dataSource';

export const AccountPage: React.FC = () => {
  const { user } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleResetData = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      'Are you sure you want to reset your data? All your tracked products, purchase logs, and usage lifespans will be removed from your current storage.'
    );

    if (!confirmed) return;

    setResetting(true);
    setStatusMessage(null);
    try {
      await db.resetUserData(user.id);
      setStatusMessage('Your data has been successfully reset.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset data';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-2 space-y-6 animate-page-in">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block mb-1">
          Preferences & Storage
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Manage your account profile, storage engine, and tracked data.
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-xs text-[#2D6A4F] font-semibold flex items-center justify-between shadow-xs animate-page-in">
          <span>✓ {statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-base font-bold ml-2 p-1"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-7">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4 pb-2 border-b border-neutral-100">
            Profile Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
            <div>
              <span className="text-xs font-semibold text-neutral-500 block mb-1">Email Address</span>
              <span className="font-semibold text-neutral-900">{user?.email || '—'}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-500 block mb-1">Default Currency</span>
              <span className="font-semibold text-neutral-900">BDT (৳)</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-500 block mb-1">Active Storage Engine</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF4F0] text-[#2D6A4F] border border-[#2D6A4F]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-pulse" />
                {isMockMode ? 'Mock LocalStorage (Offline)' : 'Supabase Cloud (PostgreSQL)'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-neutral-900">Reset Tracker Data</p>
            <p className="text-xs text-neutral-500 mt-0.5 max-w-sm leading-relaxed">
              Permanently purges all your products, purchases, and usage periods in your current storage mode.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetData}
            disabled={resetting}
            className="btn-press px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all self-start sm:self-auto disabled:opacity-60 cursor-pointer"
          >
            {resetting ? 'Resetting...' : 'Reset Tracker Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
