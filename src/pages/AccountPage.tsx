// ==============================================================================
// Nittoo Account Page
// User profile information, storage mode indicator, and data reset action
// Linear-inspired restrained settings workspace
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
    <div className="max-w-2xl mx-auto space-y-6 animate-page-in">
      {/* Header System (Section 5) */}
      <div className="pb-4 border-b border-[#F0F2F1]">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-[#2D6A4F] block mb-1">
          Account Settings
        </span>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Account
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Manage your profile, storage engine, and tracked essentials.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-[#EBF4F0] border border-[#2D6A4F]/20 text-xs text-[#2D6A4F] font-semibold flex items-center justify-between shadow-xs animate-page-in">
          <span>✓ {statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-sm font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
        <div>
          <div className="pb-1 border-b border-[#F0F2F1] mb-4">
            <h2 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
              Profile & Storage
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-neutral-500 block mb-0.5">Email Address</span>
              <span className="font-medium text-neutral-900">{user?.email || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-neutral-500 block mb-0.5">Default Currency</span>
              <span className="font-medium text-neutral-900">BDT (৳)</span>
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold text-neutral-500 block mb-1">Storage Engine</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                {isMockMode ? 'Mock LocalStorage (Offline)' : 'Supabase Cloud (PostgreSQL)'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-[#F0F2F1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-neutral-900">Reset Tracker Data</p>
            <p className="text-[11px] text-neutral-500 mt-0.5 max-w-sm leading-relaxed">
              Permanently clears all tracked products, purchases, and cycle history in this storage mode.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetData}
            disabled={resetting}
            className="btn-press px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium transition-all self-start sm:self-auto disabled:opacity-60 cursor-pointer shrink-0"
          >
            {resetting ? 'Resetting...' : 'Reset Tracker Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
