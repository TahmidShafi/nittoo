// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ModalShell,
  MODAL_EXIT_BUFFER_MS,
  getModalExitDurationMs,
} from './ModalShell';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModalShell', () => {
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

  it('unmounts via fallback timer when animationend does not fire', () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModalShell isOpen={true} onClose={onClose} ariaLabel="Test Dialog">
          <p>Dialog body</p>
        </ModalShell>
      );
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Start closing
    act(() => {
      root.render(
        <ModalShell isOpen={false} onClose={onClose} ariaLabel="Test Dialog">
          <p>Dialog body</p>
        </ModalShell>
      );
    });
    // Still mounted while exit animation runs
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Advance past --duration-modal-out + buffer without dispatching animationend
    act(() => {
      vi.advanceTimersByTime(getModalExitDurationMs() + MODAL_EXIT_BUFFER_MS + 10);
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => root.unmount());
  });

  it('closes and unmounts immediately under prefers-reduced-motion: reduce', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const onClose = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModalShell isOpen={true} onClose={onClose} ariaLabel="Test Dialog">
          <p>Dialog body</p>
        </ModalShell>
      );
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      root.render(
        <ModalShell isOpen={false} onClose={onClose} ariaLabel="Test Dialog">
          <p>Dialog body</p>
        </ModalShell>
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => root.unmount());
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModalShell isOpen={true} onClose={onClose} ariaLabel="Test Dialog">
          <p>Dialog body</p>
        </ModalShell>
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });
});
