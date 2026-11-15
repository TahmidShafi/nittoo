// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast, TOAST_DURATION_MS } from './Toast';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Toast', () => {
  const originalMatchMedia = window.matchMedia;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('renders role="status" aria-live="polite" and auto-dismisses after duration', () => {
    const onDismiss = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <Toast message="CeraVe Cleanser is finished. 45-day cycle recorded." onDismiss={onDismiss} />
      );
    });

    const status = container.querySelector('[role="status"][aria-live="polite"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('CeraVe Cleanser is finished. 45-day cycle recorded.');

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  it('pauses auto-dismiss while hovered and resumes on mouse leave', () => {
    const onDismiss = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <Toast message="Product is finished. 30-day cycle recorded." onDismiss={onDismiss} />
      );
    });

    const status = container.querySelector('[role="status"]') as HTMLElement;
    act(() => {
      status.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS + 1000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      status.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  it('skips check-draw animation class under prefers-reduced-motion: reduce', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const root = createRoot(container);
    act(() => {
      root.render(<Toast message="Finished." onDismiss={vi.fn()} />);
    });

    expect(container.querySelector('.animate-check-draw')).toBeNull();
    act(() => root.unmount());
  });
});
