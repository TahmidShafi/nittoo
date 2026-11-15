import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export const MODAL_EXIT_FALLBACK_MS = 140;
export const MODAL_EXIT_BUFFER_MS = 50;

export function getModalExitDurationMs(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return MODAL_EXIT_FALLBACK_MS;
  }
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--duration-modal-out')
    .trim();
  if (!raw) return MODAL_EXIT_FALLBACK_MS;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MODAL_EXIT_FALLBACK_MS;
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? parsed * 1000 : parsed;
}

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
  ariaLabelledBy?: string;
  ariaLabel?: string;
}

/**
 * Shared modal backdrop + panel wrapper with enter and faster exit animations,
 * a fallback unmount timer if `animationend` does not fire, Escape-key closing,
 * and immediate unmount when `prefers-reduced-motion: reduce` is enabled.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  backdropClassName = 'bg-black/40 backdrop-blur-sm',
  panelClassName = 'w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl p-6 sm:p-7 space-y-5',
  ariaLabelledBy,
  ariaLabel,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) {
      return;
    }

    if (prefersReducedMotion) {
      setShouldRender(false);
      setIsClosing(false);
      return;
    }

    setIsClosing(true);
    const fallbackTimer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, getModalExitDurationMs() + MODAL_EXIT_BUFFER_MS);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [isOpen, shouldRender, prefersReducedMotion]);

  // Restore focus on unmount
  useEffect(() => {
    if (!shouldRender && previousFocusRef.current) {
      const target = previousFocusRef.current;
      previousFocusRef.current = null;
      if (target.isConnected) {
        target.focus();
      }
    }
  }, [shouldRender]);

  // Escape key handler while open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!shouldRender) {
    return null;
  }

  const handlePanelAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target === panelRef.current && isClosing) {
      setShouldRender(false);
      setIsClosing(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClassName} ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        onAnimationEnd={handlePanelAnimationEnd}
        className={`${panelClassName} ${isClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
      >
        {children}
      </div>
    </div>
  );
};
