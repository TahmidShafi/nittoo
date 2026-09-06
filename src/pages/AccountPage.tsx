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
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Account Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage your account profile and tracking storage.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-xs text-[#2D6A4F] font-medium flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-sm font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
            Profile Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
            <div>
              <span className="text-xs text-neutral-500 block mb-1">Email Address</span>
              <span className="font-medium text-neutral-900">{user?.email || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 block mb-1">Currency</span>
              <span className="font-medium text-neutral-900">BDT (৳)</span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 block mb-1">Storage Mode</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF4F0] text-[#2D6A4F] border border-[#2D6A4F]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                {isMockMode ? 'Mock LocalStorage' : 'Supabase Cloud'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Reset Tracker Data</p>
            <p className="text-xs text-neutral-500 mt-0.5 max-w-sm">
              Clears your products, purchases, and usage periods in the current storage mode.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetData}
            disabled={resetting}
            className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors self-start sm:self-auto disabled:opacity-60"
          >
            {resetting ? 'Resetting...' : 'Reset Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
