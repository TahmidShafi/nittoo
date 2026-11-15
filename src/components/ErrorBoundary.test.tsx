// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Simulated page crash');
  }
  return <div>Healthy page content</div>;
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('catches render errors, logs to console, and recovers via Retry', () => {
    let shouldThrow = true;
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <ErrorBoundary resetKey="/analytics">
            <ThrowingChild shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Something went wrong on this page');
    expect(container.textContent).toContain('Back to dashboard');
    expect(console.error).toHaveBeenCalled();

    shouldThrow = false;
    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Retry'
    );
    expect(retryBtn).toBeTruthy();

    act(() => {
      root.render(
        <MemoryRouter>
          <ErrorBoundary resetKey="/analytics">
            <ThrowingChild shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </MemoryRouter>
      );
      retryBtn?.click();
    });

    expect(container.textContent).toContain('Healthy page content');

    act(() => {
      root.unmount();
    });
  });

  it('resets automatically when resetKey (route) changes', () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <ErrorBoundary resetKey="/analytics">
            <ThrowingChild shouldThrow={true} />
          </ErrorBoundary>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Something went wrong on this page');

    act(() => {
      root.render(
        <MemoryRouter>
          <ErrorBoundary resetKey="/dashboard">
            <ThrowingChild shouldThrow={false} />
          </ErrorBoundary>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Healthy page content');

    act(() => {
      root.unmount();
    });
  });
});
