import React, { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export const TOAST_DURATION_MS = 4500;

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Calm, non-focus-stealing status toast (`role="status"`, `aria-live="polite"`).
 * Auto-dismisses after `durationMs`, pauses while hovered or focused, and
 * draws an SVG check-mark on mount (skipped under reduced motion).
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  onDismiss,
  durationMs = TOAST_DURATION_MS,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!message || paused) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message, paused, durationMs, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-50 bg-white border border-status-healthy-border rounded-2xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 animate-page-in"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 h-6 rounded-full bg-status-healthy-bg text-status-healthy-text flex items-center justify-center shrink-0">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d="M5 13l4 4L19 7"
              className={prefersReducedMotion ? undefined : 'animate-check-draw'}
            />
          </svg>
        </span>
        <p className="text-xs font-medium text-neutral-900 leading-snug">{message}</p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="btn-press shrink-0 px-2 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        Dismiss
      </button>
    </div>
  );
};
