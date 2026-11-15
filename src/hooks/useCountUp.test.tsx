// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCountUp } from './useCountUp';
import { CountUpValue } from '../components/CountUpValue';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function HookProbe({
  target,
  decimals = 0,
  onValue,
}: {
  target: number | null;
  decimals?: number;
  onValue: (v: number | null) => void;
}) {
  const val = useCountUp(target, { durationMs: 500, decimals });
  onValue(val);
  return <span>{val ?? 'null'}</span>;
}

describe('useCountUp & CountUpValue', () => {
  const originalMatchMedia = window.matchMedia;
  let container: HTMLDivElement;
  let rafQueue: Array<(time: number) => void> = [];
  let now = 0;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    rafQueue = [];
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    container.remove();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  const flushRaf = (nextTime: number) => {
    now = nextTime;
    const pending = [...rafQueue];
    rafQueue = [];
    pending.forEach((cb) => cb(nextTime));
  };

  it('returns null while target is null and starts counting when first real value arrives', () => {
    let latest: number | null = -1;
    const root = createRoot(container);

    act(() => {
      root.render(<HookProbe target={null} onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBeNull();
    expect(rafQueue).toHaveLength(0);

    // First real value arrives
    act(() => {
      root.render(<HookProbe target={1000} onValue={(v) => (latest = v)} />);
    });
    expect(rafQueue.length).toBeGreaterThan(0);

    act(() => flushRaf(250));
    expect(latest).toBeGreaterThan(0);
    expect(latest).toBeLessThan(1000);

    act(() => flushRaf(500));
    expect(latest).toBe(1000);

    act(() => root.unmount());
  });

  it('does not replay animation on subsequent value updates (background refresh)', () => {
    let latest: number | null = -1;
    const root = createRoot(container);

    act(() => {
      root.render(<HookProbe target={500} onValue={(v) => (latest = v)} />);
    });
    act(() => flushRaf(500));
    expect(latest).toBe(500);

    rafQueue = [];
    act(() => {
      root.render(<HookProbe target={650} onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBe(650);
    expect(rafQueue).toHaveLength(0);

    act(() => root.unmount());
  });

  it('supports decimal precision', () => {
    let latest: number | null = -1;
    const root = createRoot(container);

    act(() => {
      root.render(<HookProbe target={24.75} decimals={2} onValue={(v) => (latest = v)} />);
    });

    act(() => flushRaf(250));
    expect(latest).toBeGreaterThan(0);
    expect(Number.isInteger((latest ?? 0) * 100)).toBe(true);

    act(() => flushRaf(500));
    expect(latest).toBe(24.75);

    act(() => root.unmount());
  });

  it('exposes the final formatted currency value via aria-label and hides animating digits from AT', () => {
    const root = createRoot(container);
    act(() => {
      root.render(<CountUpValue value={1250} prefix="৳" />);
    });

    const outer = container.querySelector('[aria-label="৳1,250"]');
    expect(outer).not.toBeNull();
    expect(outer?.className).toContain('tabular-nums');
    const inner = outer?.querySelector('[aria-hidden="true"]');
    expect(inner?.textContent).toBe('৳0');

    act(() => flushRaf(500));
    expect(inner?.textContent).toBe('৳1,250');

    act(() => root.unmount());
  });

  it('returns target immediately when prefers-reduced-motion is enabled', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    let latest: number | null = -1;
    const root = createRoot(container);
    act(() => {
      root.render(<HookProbe target={1250} onValue={(v) => (latest = v)} />);
    });
    expect(latest).toBe(1250);
    expect(rafQueue).toHaveLength(0);

    act(() => root.unmount());
  });
});
