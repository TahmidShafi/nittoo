import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export const COUNT_UP_DURATION_MS = 500;

export interface UseCountUpOptions {
  /** Animation duration in milliseconds (defaults to 500ms). */
  durationMs?: number;
  /** Number of decimal places to preserve during animation. */
  decimals?: number;
}

/**
 * Animates a KPI number from 0 to its first non-null finite value once.
 * - While `target` is null/undefined/NaN, returns null (does not animate placeholder).
 * - Once the first real value arrives, counts up over `durationMs`.
 * - Subsequent value changes (e.g. background SWR refreshes) update immediately without replaying.
 * - Under `prefers-reduced-motion: reduce`, returns `target` immediately.
 */
export function useCountUp(
  target: number | null | undefined,
  options: UseCountUpOptions = {}
): number | null {
  const { durationMs = COUNT_UP_DURATION_MS, decimals = 0 } = options;
  const prefersReducedMotion = useReducedMotion();

  const isValidTarget = typeof target === 'number' && Number.isFinite(target);
  const hasStartedRef = useRef(false);
  const hasFinishedInitialRef = useRef(false);

  const [displayValue, setDisplayValue] = useState<number | null>(() => {
    if (!isValidTarget) return null;
    if (prefersReducedMotion) {
      hasStartedRef.current = true;
      hasFinishedInitialRef.current = true;
      return target;
    }
    return 0;
  });

  useEffect(() => {
    if (!isValidTarget) {
      return;
    }

    if (prefersReducedMotion || hasFinishedInitialRef.current) {
      hasStartedRef.current = true;
      hasFinishedInitialRef.current = true;
      setDisplayValue(target);
      return;
    }

    // First real value arrived: run the one-shot count-up
    hasStartedRef.current = true;
    const factor = 10 ** decimals;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased * factor) / factor;

      setDisplayValue(progress >= 1 ? target : current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        hasFinishedInitialRef.current = true;
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isValidTarget, target, durationMs, decimals, prefersReducedMotion]);

  if (!isValidTarget) {
    return null;
  }

  if (prefersReducedMotion || hasFinishedInitialRef.current) {
    return target;
  }

  return displayValue ?? 0;
}
