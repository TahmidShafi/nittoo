// ==============================================================================
// Nittoo Plan Restock Modal (Stage 21)
// Restrained, accessible modal for scheduling restock reminders relative to
// predicted container lifespan or on a chosen custom date.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/dataSource';
import { getTodayUTC, formatDisplayDate } from '../lib/dateUtils';
import { calculateAverageLifespan } from '../lib/prediction';
import { calculateConfidence, getConfidenceBadgeStyles } from '../lib/confidence';
import {
  calculateExpectedFinishDate,
  calculateRelativeReminderDate,
  isValidISODate,
  RELATIVE_REMINDER_OPTIONS,
  type RelativeReminderDays,
} from '../lib/restock';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type NotificationPermissionState,
} from '../lib/notifications';
import type { ProductWithDetails, RestockPlan } from '../types';

interface PlanRestockModalProps {
  product: ProductWithDetails | null;
  existingPlan?: RestockPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (plan: RestockPlan) => void;
}

export const PlanRestockModal: React.FC<PlanRestockModalProps> = ({
  product,
  existingPlan,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const today = getTodayUTC();

  // Prediction calculations from canonical engine
  const activeUsage = product?.active_usage || null;
  const finishedPeriods = product?.finished_periods || [];
  const averageLifespan = calculateAverageLifespan(finishedPeriods);
  const hasPrediction = averageLifespan !== null && averageLifespan > 0 && !!activeUsage;
  const expectedFinishDate =
    hasPrediction && activeUsage
      ? calculateExpectedFinishDate(activeUsage.opened_date, averageLifespan)
      : null;

  const confidence = calculateConfidence(finishedPeriods.length);
  const badgeStyles = getConfidenceBadgeStyles(confidence.state);

  // Form State
  const [mode, setMode] = useState<'relative' | 'custom'>('relative');
  const [selectedDays, setSelectedDays] = useState<RelativeReminderDays>(14);
  const [customDate, setCustomDate] = useState<string>(today);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Browser Notification opt-in state
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>('unsupported');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNotifPermission(getBrowserNotificationPermission());

      if (existingPlan) {
        setMode(existingPlan.mode);
        if (existingPlan.mode === 'relative' && existingPlan.days_before_finish !== null) {
          setSelectedDays(existingPlan.days_before_finish as RelativeReminderDays);
        } else {
          setCustomDate(existingPlan.reminder_date);
        }
      } else {
        if (hasPrediction) {
          setMode('relative');
          setSelectedDays(14);
        } else {
          setMode('custom');
          setCustomDate(today);
        }
      }
    }
  }, [isOpen, existingPlan, hasPrediction, today]);

  if (!isOpen || !product || !activeUsage) return null;

  // Deterministic reminder date preview calculation
  let calculatedReminderDate = '';
  if (mode === 'relative' && expectedFinishDate) {
    calculatedReminderDate = calculateRelativeReminderDate(expectedFinishDate, selectedDays);
  } else {
    calculatedReminderDate = customDate;
  }

  const handleEnableNotifications = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifPermission(res);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (mode === 'relative') {
      if (!expectedFinishDate) {
        setError('Cannot schedule relative reminder without an estimated finish date.');
        return;
      }
      if (!calculatedReminderDate || !isValidISODate(calculatedReminderDate)) {
        setError('Calculated reminder date is invalid.');
        return;
      }
    } else {
      if (!customDate || !isValidISODate(customDate)) {
        setError('Please enter a valid calendar date (YYYY-MM-DD).');
        return;
      }
    }

    setSubmitting(true);
    try {
      let saved: RestockPlan;
      if (existingPlan) {
        saved = await db.updateRestockPlan(user.id, existingPlan.id, {
          mode,
          days_before_finish: mode === 'relative' ? selectedDays : null,
          reminder_date: calculatedReminderDate,
          status: 'planned',
        });
      } else {
        saved = await db.createRestockPlan(user.id, {
          product_id: product.id,
          usage_period_id: activeUsage.id,
          mode,
          days_before_finish: mode === 'relative' ? selectedDays : null,
          reminder_date: calculatedReminderDate,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save restock plan';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-restock-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
              {existingPlan ? 'Edit Restock Plan' : 'Plan Restock'}
            </span>
            <h3 id="plan-restock-title" className="text-lg font-bold text-neutral-900 tracking-tight">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl font-bold leading-none p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
            <span className="text-rose-600 font-bold leading-none mt-0.5">!</span>
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Prediction Context Card */}
        {hasPrediction && expectedFinishDate ? (
          <div className="bg-neutral-50/90 rounded-xl p-4 border border-neutral-200/70 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Estimated finish</span>
              <span className="font-bold text-neutral-900 text-sm">
                {formatDisplayDate(expectedFinishDate)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-neutral-200/50">
              <span className="text-neutral-500">
                {Math.round(averageLifespan)}d average · {finishedPeriods.length} cycle
                {finishedPeriods.length === 1 ? '' : 's'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeStyles.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badgeStyles.dotClass}`} />
                {confidence.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20 text-xs space-y-1">
            <p className="font-semibold text-neutral-800">
              Not enough history to estimate when this product will finish.
            </p>
            <p className="text-neutral-500 leading-relaxed">
              Restock planning relative to estimated finish will become available once Nittoo has completed usage cycles. You can still set a custom calendar reminder below.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Options */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Remind me:
            </label>

            <div className="space-y-2 text-xs">
              {hasPrediction &&
                RELATIVE_REMINDER_OPTIONS.map((days) => (
                  <label
                    key={days}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      mode === 'relative' && selectedDays === days
                        ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 text-neutral-900 font-semibold'
                        : 'border-neutral-200/80 hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="restock-option"
                        checked={mode === 'relative' && selectedDays === days}
                        onChange={() => {
                          setMode('relative');
                          setSelectedDays(days);
                        }}
                        className="text-[#2D6A4F] focus:ring-[#2D6A4F]"
                      />
                      <span>{days === 0 ? 'On expected finish' : `${days} days before`}</span>
                    </div>
                    {expectedFinishDate && (
                      <span className="text-[11px] font-normal text-neutral-500">
                        {formatDisplayDate(
                          calculateRelativeReminderDate(expectedFinishDate, days)
                        )}
                      </span>
                    )}
                  </label>
                ))}

              {/* Custom Date Option */}
              <label
                className={`flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                  mode === 'custom'
                    ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 text-neutral-900'
                    : 'border-neutral-200/80 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="restock-option"
                    checked={mode === 'custom'}
                    onChange={() => setMode('custom')}
                    className="text-[#2D6A4F] focus:ring-[#2D6A4F]"
                  />
                  <span className="font-semibold">Custom date</span>
                </div>

                {mode === 'custom' && (
                  <div className="mt-1 pl-6">
                    <input
                      type="date"
                      required
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      disabled={submitting}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:border-[#2D6A4F] bg-white text-neutral-900"
                    />
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Reminder Date Summary Callout */}
          {calculatedReminderDate && isValidISODate(calculatedReminderDate) && (
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex justify-between items-center text-xs">
              <span className="text-neutral-500 font-medium">Reminder date:</span>
              <span className="font-bold text-neutral-900 text-sm">
                {formatDisplayDate(calculatedReminderDate)}
              </span>
            </div>
          )}

          {/* Optional Browser Notification Permission Opt-In */}
          {isBrowserNotificationSupported() && notifPermission === 'default' && (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-center justify-between text-xs">
              <span className="text-neutral-600">Get browser reminders?</span>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="text-[#2D6A4F] hover:text-[#24563F] font-semibold text-xs underline cursor-pointer"
              >
                Enable browser reminders
              </button>
            </div>
          )}

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Restock reminders do not change your predicted finish date or automatically create purchases. Nittoo surfaces in-app alerts when your reminder arrives.
          </p>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-press px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-all disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-press px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-60 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : existingPlan ? (
                'Update Restock Plan'
              ) : (
                'Plan Restock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
