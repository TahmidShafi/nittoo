// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DEMO_PRODUCT_COUNT } from '../lib/demo/seed';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    sendMagicLink: vi.fn(),
    enterDemoMode: vi.fn(),
    user: null,
    loading: false,
    isDemoMode: false,
    exitDemoMode: vi.fn(),
  }),
}));

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('derives the sample product count copy from DEMO_PRODUCT_COUNT', () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain(`${DEMO_PRODUCT_COUNT} sample products`);

    act(() => {
      root.unmount();
    });
  });
});
