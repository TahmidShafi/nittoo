import { describe, it, expect } from 'vitest';
import { getContrastRatio, SEMANTIC_COLORS } from './contrast';

describe('WCAG AA contrast for @theme semantic status & typography tokens', () => {
  it('meets >= 4.5:1 for all typography neutral tokens on white and canvas', () => {
    for (const bg of [SEMANTIC_COLORS.surface, SEMANTIC_COLORS.canvas]) {
      expect(getContrastRatio(SEMANTIC_COLORS.textPrimary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(SEMANTIC_COLORS.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(SEMANTIC_COLORS.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets >= 4.5:1 for semantic status text on its own tint, white, and canvas', () => {
    const statuses = [
      SEMANTIC_COLORS.healthy,
      SEMANTIC_COLORS.attention,
      SEMANTIC_COLORS.critical,
      SEMANTIC_COLORS.learning,
    ];

    for (const status of statuses) {
      expect(getContrastRatio(status.text, status.bg)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(status.text, SEMANTIC_COLORS.surface)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(status.text, SEMANTIC_COLORS.canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets >= 3.0:1 for progress bar status fills against the track background', () => {
    const fills = [
      SEMANTIC_COLORS.healthy.fill,
      SEMANTIC_COLORS.attention.fill,
      SEMANTIC_COLORS.critical.fill,
    ];

    for (const fill of fills) {
      expect(getContrastRatio(fill, SEMANTIC_COLORS.track)).toBeGreaterThanOrEqual(3.0);
    }
  });
});
