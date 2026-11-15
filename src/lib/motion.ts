import type React from 'react';

export const STAGGER_STEP_MS = 40;
export const STAGGER_MAX_ITEMS = 8;

/**
 * Returns inline CSS custom property `--stagger-delay` capped at (8 - 1) * 40ms = 280ms.
 * Items beyond index 7 appear together at 280ms so total stagger stays under 300ms.
 */
export function getStaggerStyle(index: number): React.CSSProperties {
  const cappedIndex = Math.min(Math.max(index, 0), STAGGER_MAX_ITEMS - 1);
  return {
    '--stagger-delay': `${cappedIndex * STAGGER_STEP_MS}ms`,
  } as React.CSSProperties;
}
