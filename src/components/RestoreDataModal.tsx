// ==============================================================================
// Nittoo Restore Data Modal Component
// Multi-step, secure, user-confirmed backup restoration workflow.
// Enforces schema validation, conflict preview, zero-secret policy, and safe merge.
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import {
  validateBackupFile,
  buildImportPlan,
  executeRestore,
  type ImportPlan,
  type ImportExecutionResult,
} from '../lib/restore';
import { formatDate } from '../lib/dateUtils';

interface RestoreDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type RestoreStep = 'select' | 'preview' | 'confirm' | 'restoring' | 'complete';

export const RestoreDataModal: React.FC<RestoreDataModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<RestoreStep>('select');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setErrorMessage(null);
      setErrorDetails(null);
      setIsDragging(false);
      setIsValidating(false);
      setImportPlan(null);
      setExecutionResult(null);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || step === 'restoring') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  if (!isOpen || !user) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setErrorDetails(null);

    // Basic extension/type check
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setErrorMessage("That file isn't a valid Nittoo backup.");
      setErrorDetails('Only Nittoo JSON backups (.json) can be restored.');
      return;
    }

    setIsValidating(true);

    try {
      const text = await file.text();
      const validation = validateBackupFile(text);

      if (!validation.valid) {
        setErrorMessage(validation.error);
        setErrorDetails(validation.details || null);
        setIsValidating(false);
        return;
      }

      // Build pure Import Plan against current user database
      const plan = await buildImportPlan(validation.backupData, user.id, db);
      setImportPlan(plan);
      setStep('preview');
    } catch (err: any) {
      setErrorMessage("That file isn't a valid Nittoo backup.");
      setErrorDetails(err?.message || 'Failed to inspect backup file.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // reset input value so re-selecting the same file triggers change
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleConfirmRestore = async () => {
    if (!importPlan) return;
    setStep('restoring');
    setErrorMessage(null);

    try {
      const result = await executeRestore(importPlan, user.id, db);
      if (!result.success) {
        setErrorMessage("Couldn't restore this backup.");
        setErrorDetails(result.error || 'No changes were made.');
        setStep('preview');
        return;
      }
      setExecutionResult(result);
      setStep('complete');
    } catch (err: any) {
      setErrorMessage("Couldn't restore this backup.");
      setErrorDetails(err?.message || 'No changes were made.');
      setStep('preview');
    }
  };

  const handleDone = () => {
    onClose();
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'restoring') {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-neutral-200/80 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block">
              RESTORE NITTOO DATA
            </span>
            <h2 id="restore-dialog-title" className="text-lg font-bold text-neutral-900 mt-0.5">
              {step === 'select' && 'Choose Backup File'}
              {step === 'preview' && 'Restore Preview'}
              {step === 'confirm' && 'Confirm Data Restore'}
              {step === 'restoring' && 'Restoring Data...'}
              {step === 'complete' && 'Restore Complete'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {step === 'select' && 'Restore data from a Nittoo JSON backup.'}
              {step === 'preview' && 'Review what will be added to your account.'}
              {step === 'confirm' && 'Existing data will not be automatically deleted.'}
              {step === 'restoring' && 'Safely linking records to your account...'}
              {step === 'complete' && 'Your personal consumption history has been recovered.'}
            </p>
          </div>
          {step !== 'restoring' && (
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-2"
              aria-label="Close restore modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-semibold block">{errorMessage}</span>
                {errorDetails && <span className="text-rose-700/90 text-[11px] mt-0.5 block">{errorDetails}</span>}
              </div>
            </div>
          )}

          {/* STEP 1: SELECT FILE */}
          {step === 'select' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
                id="nittoo-backup-input"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-[#2D6A4F] bg-[#EBF4F0]/40'
                    : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#2D6A4F] shadow-2xs">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-semibold text-neutral-900 block">
                    Choose a Nittoo JSON backup to restore
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">
                    Drag and drop your file here, or click to browse
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isValidating}
                  className="btn-press min-h-[44px] px-4 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                >
                  {isValidating ? 'Validating backup...' : 'Choose Backup File'}
                </button>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-150 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-neutral-600 text-xs font-medium">
                  <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Only Nittoo JSON backups can be restored.</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed pl-5">
                  Excel, CSV, and PDF exports are for analysis and reporting only. Nittoo JSON backups contain the authoritative relational history of your essentials.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && importPlan && (
            <div className="space-y-4">
              {/* Validation Status & Metadata */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Valid Nittoo Backup (Version {importPlan.backupMeta.version})</span>
                </div>
                <div className="text-[11px] text-neutral-600 grid grid-cols-2 gap-y-1 gap-x-4 pt-1 border-t border-emerald-200/60">
                  <div>
                    <span className="text-neutral-400 block">Exported:</span>
                    <span className="font-medium text-neutral-800">
                      {formatDate(importPlan.backupMeta.exported_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Original account:</span>
                    <span className="font-medium text-neutral-800 truncate block">
                      {importPlan.backupMeta.original_email}
                    </span>
                  </div>
                </div>
                <div className="pt-1 text-[11px] text-neutral-500">
                  Import target: <span className="font-medium text-neutral-700">{user.email}</span> (records will be assigned to your account).
                </div>
              </div>

              {/* Ready to restore summary cards */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  DATA TO RESTORE
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-neutral-900 block">
                      {importPlan.summary.newProductsCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      New Essentials
                    </span>
                    {importPlan.summary.existingProductsCount > 0 && (
                      <span className="text-[10px] text-neutral-400 mt-0.5 block">
                        ({importPlan.summary.existingProductsCount} existing kept)
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-neutral-900 block">
                      {importPlan.summary.newPurchasesCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      New Purchases
                    </span>
                    {importPlan.summary.existingPurchasesCount > 0 && (
                      <span className="text-[10px] text-neutral-400 mt-0.5 block">
                        ({importPlan.summary.existingPurchasesCount} existing kept)
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-neutral-900 block">
                      {importPlan.summary.historicalCyclesCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      Usage Cycles
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Historical data
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-neutral-900 block">
                      {importPlan.summary.unopenedPurchasesCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      Unopened Inventory
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Preserved unopened
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-neutral-900 block">
                      {importPlan.summary.activeUsageCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      Active Essentials
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      To activate
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl">
                    <span className="text-base font-bold text-emerald-700 block">
                      0
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium block">
                      Invalid Records
                    </span>
                    <span className="text-[10px] text-emerald-600 mt-0.5 block">
                      100% Validated
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Bottle Conflicts Warning */}
              {importPlan.activeConflicts.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>ACTIVE CONFLICT: {importPlan.activeConflicts.length} item(s)</span>
                  </div>
                  {importPlan.activeConflicts.map((c, idx) => (
                    <div key={idx} className="text-[11px] text-amber-900/90 pl-5 leading-relaxed">
                      <span className="font-semibold">{c.productName}</span> has an active bottle in both your current data and the backup.
                      <span className="block text-amber-800 font-medium mt-0.5">
                        Action: Keep current active bottle. (Conflicting backup bottle will be preserved as unopened inventory).
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Possible Product Name Matches */}
              {importPlan.possibleProductMatches.length > 0 && (
                <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-neutral-700 block">
                    POSSIBLE MATCHES ({importPlan.possibleProductMatches.length})
                  </span>
                  {importPlan.possibleProductMatches.map((m, idx) => (
                    <p key={idx} className="text-[11px] text-neutral-600">
                      • <span className="font-medium">{m.productName}</span> exists in your current data. It will be restored as a separate record to protect historical tracking.
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === 'confirm' && importPlan && (
            <div className="space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-[#EBF4F0] border border-[#2D6A4F]/20 flex items-center justify-center text-[#2D6A4F] mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  Restore this Nittoo backup?
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  This will add missing data from this backup to your Nittoo account. Existing data will not be automatically deleted.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl text-xs space-y-1.5 text-neutral-700">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Target Account:</span>
                  <span className="font-medium text-neutral-900">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">New Essentials to Add:</span>
                  <span className="font-medium text-neutral-900">{importPlan.summary.newProductsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">New Purchases to Add:</span>
                  <span className="font-medium text-neutral-900">{importPlan.summary.newPurchasesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Historical Cycles to Add:</span>
                  <span className="font-medium text-neutral-900">{importPlan.summary.historicalCyclesCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RESTORING IN PROGRESS */}
          {step === 'restoring' && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 border-3 border-[#EBF4F0] border-t-[#2D6A4F] rounded-full animate-spin" />
              <div>
                <span className="text-sm font-bold text-neutral-900 block">
                  Restoring Nittoo Data...
                </span>
                <span className="text-xs text-neutral-500 mt-1 block">
                  Please wait while records are validated and saved.
                </span>
              </div>
            </div>
          )}

          {/* STEP 5: RESTORE COMPLETE */}
          {step === 'complete' && executionResult && (
            <div className="space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  Data Successfully Restored
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Your backup has been safely merged into your Nittoo account.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                  SUCCESSFULLY RESTORED
                </span>
                <div className="grid grid-cols-2 gap-2 text-neutral-700">
                  <div>• {executionResult.restoredProducts} Essentials</div>
                  <div>• {executionResult.restoredPurchases} Purchases</div>
                  <div>• {executionResult.restoredCycles} Usage Cycles</div>
                  <div>• {executionResult.restoredUnopened} Unopened Purchases</div>
                </div>
                {executionResult.skippedConflicts > 0 && (
                  <div className="pt-2 border-t border-neutral-200 text-amber-700 text-[11px]">
                    Skipped {executionResult.skippedConflicts} conflicting active bottle (kept your current active container; purchase preserved as unopened).
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2.5">
          {step === 'select' && (
            <button
              type="button"
              onClick={onClose}
              className="btn-press min-h-[44px] px-4 py-2 text-neutral-600 hover:text-neutral-900 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="btn-press min-h-[44px] px-4 py-2 border border-neutral-200/80 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="btn-press min-h-[44px] px-5 py-2 bg-[#2D6A4F] hover:bg-[#24563F] text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Review Restore
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="btn-press min-h-[44px] px-4 py-2 border border-neutral-200/80 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="btn-press min-h-[44px] px-5 py-2 bg-[#2D6A4F] hover:bg-[#24563F] text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                Restore Data
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              type="button"
              onClick={handleDone}
              className="btn-press min-h-[44px] px-6 py-2 bg-[#2D6A4F] hover:bg-[#24563F] text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
