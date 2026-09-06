// ==============================================================================
// Nittoo Prediction Confidence Engine (Stage 12)
// Pure, deterministic calculation of prediction evidence maturity.
// Based strictly on completed usage cycle counts. Never fabricates certainty.
// ==============================================================================

export type ConfidenceState =
  | 'no_data'
  | 'early'
  | 'developing'
  | 'reliable'
  | 'strong_history';

export interface ConfidenceReport {
  state: ConfidenceState;
  label: string;
  supportingText: string;
  semanticMeaning: string;
  completedCycles: number;
}

/**
 * Deterministically evaluates prediction confidence strictly based on
 * the count of completed usage cycles (finished periods).
 *
 * Evidence Maturity Meanings:
 * - 0 cycles: NO_DATA ("Not enough data", "Complete a cycle to start learning.", "No completed evidence")
 * - 1 cycle: EARLY ("Early data", "Based on 1 completed cycle", "Very limited personal history")
 * - 2-3 cycles: DEVELOPING ("Developing", "Based on X completed cycles", "Some repeated personal history")
 * - 4-5 cycles: RELIABLE ("Reliable", "Based on X completed cycles", "Multiple completed observations")
 * - 6+ cycles: STRONG_HISTORY ("Strong history", "Based on X completed cycles", "Substantial repeated personal history")
 */
export function calculateConfidence(completedCycles: number): ConfidenceReport {
  const count = Math.max(0, Math.floor(completedCycles || 0));

  if (count === 0) {
    return {
      state: 'no_data',
      label: 'Not enough data',
      supportingText: 'Complete a cycle to start learning.',
      semanticMeaning: 'No completed evidence',
      completedCycles: 0,
    };
  }

  if (count === 1) {
    return {
      state: 'early',
      label: 'Early data',
      supportingText: 'Based on 1 completed cycle',
      semanticMeaning: 'Very limited personal history',
      completedCycles: 1,
    };
  }

  if (count >= 2 && count <= 3) {
    return {
      state: 'developing',
      label: 'Developing',
      supportingText: `Based on ${count} completed cycles`,
      semanticMeaning: 'Some repeated personal history',
      completedCycles: count,
    };
  }

  if (count >= 4 && count <= 5) {
    return {
      state: 'reliable',
      label: 'Reliable',
      supportingText: `Based on ${count} completed cycles`,
      semanticMeaning: 'Multiple completed observations',
      completedCycles: count,
    };
  }

  // 6+ cycles
  return {
    state: 'strong_history',
    label: 'Strong history',
    supportingText: `Based on ${count} completed cycles`,
    semanticMeaning: 'Substantial repeated personal history',
    completedCycles: count,
  };
}

/**
 * Returns calm, semantic visual classes for confidence badges.
 * Follows Nittoo design language: subtle, quiet, accessible (never relies on color alone).
 */
export function getConfidenceBadgeStyles(state: ConfidenceState): {
  badgeClass: string;
  dotClass: string;
} {
  switch (state) {
    case 'no_data':
      return {
        badgeClass: 'bg-neutral-100 text-neutral-600 border border-neutral-200/60',
        dotClass: 'bg-neutral-400',
      };
    case 'early':
      return {
        badgeClass: 'bg-amber-50/90 text-amber-800 border border-amber-200/70',
        dotClass: 'bg-amber-500',
      };
    case 'developing':
      return {
        badgeClass: 'bg-neutral-100 text-neutral-700 border border-neutral-200/80',
        dotClass: 'bg-neutral-500',
      };
    case 'reliable':
      return {
        badgeClass: 'bg-[#EBF4F0] text-[#2D6A4F] border border-[#2D6A4F]/20',
        dotClass: 'bg-[#2D6A4F]',
      };
    case 'strong_history':
      return {
        badgeClass: 'bg-[#EBF4F0] text-[#24563F] border border-[#2D6A4F]/30 font-semibold',
        dotClass: 'bg-[#24563F]',
      };
  }
}
