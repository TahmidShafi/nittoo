/**
 * Semantic status & neutral color pairs used in src/index.css @theme.
 * Kept in sync with @theme tokens and verified by contrast.test.ts.
 */
export const SEMANTIC_COLORS = {
  canvas: '#FBFBFB',
  surface: '#FFFFFF',
  track: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  healthy: {
    text: '#2D6A4F',
    bg: '#EBF4F0',
    border: '#C6DFD3',
    fill: '#2D6A4F',
  },
  attention: {
    text: '#B45309',
    bg: '#FFF7E6',
    border: '#FDE68A',
    fill: '#CC7008',
  },
  critical: {
    text: '#BE123C',
    bg: '#FFF1F2',
    border: '#FECDD3',
    fill: '#C0395B',
  },
  learning: {
    text: '#4B5563',
    bg: '#F3F4F6',
    border: '#E5E7EB',
  },
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex color, got "${hex}"`);
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
