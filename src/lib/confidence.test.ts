import { describe, it, expect } from 'vitest';
import { calculateConfidence, getConfidenceBadgeStyles } from './confidence';

describe('confidence', () => {
  it('maps 0..6+ completed cycles to the 5 deterministic confidence states', () => {
    expect(calculateConfidence(0).state).toBe('no_data');
    expect(calculateConfidence(1).state).toBe('early');
    expect(calculateConfidence(2).state).toBe('developing');
    expect(calculateConfidence(3).state).toBe('developing');
    expect(calculateConfidence(4).state).toBe('reliable');
    expect(calculateConfidence(6).state).toBe('strong_history');
  });

  it('never leaks NaN or negative counts and returns valid badge styles', () => {
    const neg = calculateConfidence(-3);
    expect(neg.state).toBe('no_data');
    expect(neg.completedCycles).toBe(0);

    for (const count of [0, 1, 2, 4, 6]) {
      const report = calculateConfidence(count);
      const styles = getConfidenceBadgeStyles(report.state);
      expect(report.label.length).toBeGreaterThan(0);
      expect(report.supportingText.length).toBeGreaterThan(0);
      expect(Object.keys(styles).length).toBeGreaterThan(0);
    }
  });
});
