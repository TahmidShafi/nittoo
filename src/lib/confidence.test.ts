import { describe, it, expect } from 'vitest';
import { calculateConfidence, getConfidenceBadgeStyles, type ConfidenceState } from './confidence';

describe('confidence', () => {
  it.each([
    [-3, 'no_data', 0, 'Not enough data'],
    [0, 'no_data', 0, 'Not enough data'],
    [1, 'early', 1, 'Early data'],
    [2, 'developing', 2, 'Developing'],
    [3, 'developing', 3, 'Developing'],
    [4, 'reliable', 4, 'Reliable'],
    [5, 'reliable', 5, 'Reliable'],
    [6, 'strong_history', 6, 'Strong history'],
    [10, 'strong_history', 10, 'Strong history'],
  ] as [number, ConfidenceState, number, string][])(
    'calculateConfidence(%i) -> state=%s, cycles=%i, label=%s',
    (input, expectedState, expectedCycles, expectedLabel) => {
      const report = calculateConfidence(input);
      expect(report.state).toBe(expectedState);
      expect(report.completedCycles).toBe(expectedCycles);
      expect(report.label).toBe(expectedLabel);
      expect(report.supportingText.length).toBeGreaterThan(0);
    }
  );

  it.each(['no_data', 'early', 'developing', 'reliable', 'strong_history'] as const)(
    'getConfidenceBadgeStyles(%s) returns Tailwind badge classes',
    (state) => {
      const styles = getConfidenceBadgeStyles(state);
      expect(styles.badgeClass.length).toBeGreaterThan(0);
      expect(styles.dotClass.length).toBeGreaterThan(0);
    }
  );
});
