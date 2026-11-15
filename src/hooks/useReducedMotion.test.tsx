// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReducedMotion } from './useReducedMotion';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
  const val = useReducedMotion();
  onValue(val);
  return <span data-testid="val">{String(val)}</span>;
}

describe('useReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('returns false when prefers-reduced-motion does not match', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    let latest = true;
    const root = createRoot(container);
    act(() => {
      root.render(<Probe onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBe(false);
    act(() => root.unmount());
  });

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    let latest = false;
    const root = createRoot(container);
    act(() => {
      root.render(<Probe onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBe(true);
    act(() => root.unmount());
  });

  it('updates when the media query changes', () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
        listener = cb;
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    let latest = true;
    const root = createRoot(container);
    act(() => {
      root.render(<Probe onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBe(false);

    act(() => {
      listener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(latest).toBe(true);
    act(() => root.unmount());
  });
});
