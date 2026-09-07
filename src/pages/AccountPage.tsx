// ==============================================================================
// Nittoo Account Settings Page
// Quiet, document-style settings for managing identity, security, data export,
// and account deletion in a calm, trustworthy surface (640-760px).
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChangeEmailModal } from '../components/ChangeEmailModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { SignOutAllSessionsModal } from '../components/SignOutAllSessionsModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { ExportDataModal } from '../components/ExportDataModal';
import { RestoreDataModal } from '../components/RestoreDataModal';
import { exportUserDataAs } from '../lib/export';
import { db } from '../lib/dataSource';

export const AccountPage: React.FC = () => {
  const { user } = useAuth();

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    if (!user) return;
    setIsDownloadingBackup(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { filename } = await exportUserDataAs('json', user.id, user.email, db);
      setSuccessMessage(`Backup ready. Downloaded ${filename}`);
    } catch (err: any) {
      console.error('Backup download failed:', err);
      setErrorMessage("Couldn't generate the JSON backup. Please try again.");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  return (
    <div className="w-full max-w-[700px] mx-auto py-4 sm:py-6 space-y-6 animate-page-in">
      {/* 1. Page Header */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
          ACCOUNT SETTINGS
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Account
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Manage your account, security, and Nittoo data.
        </p>
      </div>

      {/* Action Notification Alert Messages */}
      {successMessage && (
        <div
          className="p-4 rounded-xl bg-[#EBF4F0] border border-[#2D6A4F]/20 text-xs text-[#2D6A4F] font-medium flex items-center justify-between shadow-xs animate-page-in"
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">✓</span>
            <span className="leading-relaxed">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-sm font-bold ml-3 cursor-pointer p-1"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center justify-between shadow-xs animate-page-in"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none font-bold">!</span>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-sm font-bold ml-3 cursor-pointer p-1"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Settings Document Surface */}
      <div className="bg-white border border-[#E8ECE9] rounded-2xl divide-y divide-[#E8ECE9] shadow-xs">
        {/* 2. ACCOUNT IDENTITY */}
        <div className="p-6 sm:p-7 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
            ACCOUNT
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-0.5">
              <span className="text-base sm:text-lg font-bold text-neutral-900 break-all">
                {user?.email || '—'}
              </span>
              <p className="text-xs text-neutral-500">Personal Nittoo account</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer shrink-0"
            >
              Change email
            </button>
          </div>
        </div>

        {/* 4 & 5. SECURITY SECTION (Password & Active Sessions) */}
        <div className="p-6 sm:p-7 space-y-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
            SECURITY
          </span>

          {/* Password */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Password</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Keep your account secure with a strong password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer shrink-0"
            >
              Change password
            </button>
          </div>

          {/* Active Sessions */}
          <div className="pt-5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Active Sessions</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage where you're signed in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSessionsModalOpen(true)}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer shrink-0"
            >
              Sign out all sessions
            </button>
          </div>
        </div>

        {/* 6. DATA SECTION */}
        <div className="p-6 sm:p-7 space-y-6">
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              DATA
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Export your Nittoo data</h3>
                <p className="text-xs text-neutral-500 mt-0.5 max-w-md leading-relaxed">
                  Download your Nittoo data as a spreadsheet, report, or backup.
                </p>
                <span className="text-[11px] text-neutral-400 font-medium block mt-1.5">
                  Available formats: Excel · CSV · PDF · JSON
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                Export data
              </button>
            </div>
          </div>

          <div className="pt-5 border-t border-neutral-150 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              BACKUP & RESTORE
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Backup & Restore</h3>
                <p className="text-xs text-neutral-500 mt-0.5 max-w-md leading-relaxed">
                  Keep a copy of your Nittoo data and restore it when needed.
                </p>
                <span className="text-[11px] text-neutral-400 font-medium block mt-1.5">
                  Authoritative format: JSON Backup (.json)
                </span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isDownloadingBackup}
                  className="btn-press min-h-[44px] px-3.5 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isDownloadingBackup ? 'Preparing...' : 'Download Backup'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(true)}
                  className="btn-press min-h-[44px] px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  Restore Backup
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 7. DELETE ACCOUNT (DANGER ZONE) */}
        <div className="p-6 sm:p-7 space-y-3 bg-rose-50/20 rounded-b-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
            DELETE ACCOUNT
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Delete Account</h3>
              <p className="text-xs text-neutral-500 mt-0.5 max-w-md leading-relaxed">
                Permanently remove your account and associated Nittoo data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer shrink-0"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Dialog Modals */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <RestoreDataModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccess={() => setSuccessMessage('Backup restored successfully.')}
      />

      <ChangeEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSuccess={(msg) => setSuccessMessage(msg)}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={(msg) => setSuccessMessage(msg)}
      />

      <SignOutAllSessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
