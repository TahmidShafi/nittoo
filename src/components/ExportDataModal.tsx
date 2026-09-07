// ==============================================================================
// Nittoo Export Data Modal Component
// Allows user to choose between 4 distinct data export formats:
// 1. Excel (.xlsx) — Primary / Recommended
// 2. CSV Archive (.zip) — Portable universal spreadsheet tables
// 3. PDF Report (.pdf) — Human-readable personal consumption report
// 4. JSON Backup (.json) — Machine-readable technical backup
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { exportUserDataAs, type ExportFormat } from '../lib/export';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setActiveFormat(null);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Handle keyboard Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const handleExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { filename } = await exportUserDataAs(format, user.id, user.email, db);
      const formatNames: Record<ExportFormat, string> = {
        excel: 'Excel workbook',
        csv: 'CSV archive',
        pdf: 'PDF report',
        json: 'JSON backup',
      };
      setSuccessMessage(`${formatNames[format]} ready. Downloaded ${filename}`);
    } catch (err: unknown) {
      console.error(`Export error for ${format}:`, err);
      const formatNames: Record<ExportFormat, string> = {
        excel: 'Excel export',
        csv: 'CSV export',
        pdf: 'PDF report',
        json: 'JSON backup',
      };
      setErrorMessage(`Couldn't generate the ${formatNames[format]}. Please try again.`);
    } finally {
      setActiveFormat(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-neutral-200/80 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D6A4F] block mb-1">
              EXPORT YOUR DATA
            </span>
            <h2 id="export-dialog-title" className="text-xl font-bold tracking-tight text-neutral-900">
              Choose a format
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Select how you would like to inspect, share, or preserve your Nittoo data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-lg font-bold leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Feedback notices */}
        {successMessage && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
            <span className="text-rose-600 font-bold">✕</span>
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Format Options */}
        <div className="p-5 sm:p-6 space-y-3.5 max-h-[60vh] overflow-y-auto">
          {/* 1. EXCEL (.xlsx) — PRIMARY / RECOMMENDED */}
          <div className="p-4 rounded-xl border-2 border-[#2D6A4F] bg-[#EBF4F0]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-900">Excel (.xlsx)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2D6A4F] text-white">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-neutral-600">
                Best for analyzing your data in a spreadsheet. Includes Summary, Products, Purchases, Usage History, Inventory, and Analytics sheets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={activeFormat !== null}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-xs"
            >
              {activeFormat === 'excel' ? 'Generating Excel...' : 'Export Excel'}
            </button>
          </div>

          {/* 2. CSV (.csv zip) — UNIVERSAL SPREADSHEET */}
          <div className="p-4 rounded-xl border border-neutral-200/80 hover:border-neutral-300 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-sm font-bold text-neutral-900">CSV Archive (.zip)</span>
              <p className="text-xs text-neutral-500">
                Simple, portable spreadsheet tables. Exports products, purchases, history, inventory, and analytics as separate UTF-8 CSV files.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={activeFormat !== null}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {activeFormat === 'csv' ? 'Generating CSV...' : 'Export CSV'}
            </button>
          </div>

          {/* 3. PDF REPORT (.pdf) — HUMAN-READABLE */}
          <div className="p-4 rounded-xl border border-neutral-200/80 hover:border-neutral-300 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-sm font-bold text-neutral-900">PDF Report (.pdf)</span>
              <p className="text-xs text-neutral-500">
                Readable summary for viewing or printing. Editorial personal report showing category consumption, observed lifespans, and restock horizons.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={activeFormat !== null}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {activeFormat === 'pdf' ? 'Generating PDF...' : 'Export PDF'}
            </button>
          </div>

          {/* 4. JSON BACKUP (.json) — MACHINE-READABLE BACKUP */}
          <div className="p-4 rounded-xl border border-dashed border-neutral-200 hover:border-neutral-300 bg-neutral-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-neutral-700">JSON Backup (.json)</span>
              <p className="text-xs text-neutral-400">
                Complete machine-readable copy of your Nittoo data for technical backup, migration, or future import.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={activeFormat !== null}
              className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-all shrink-0 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {activeFormat === 'json' ? 'Generating JSON...' : 'Export JSON'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-medium">
            Exporting is read-only and never modifies your data.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-press min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200/80 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
