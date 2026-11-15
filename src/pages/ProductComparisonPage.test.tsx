// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProductComparisonPage } from './ProductComparisonPage';
import { dataCache } from '../lib/dataCache';
import type { Product } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let currentUser: { id: string; email: string } | null = null;
const mockGetAllUserProducts = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('../lib/dataSource', () => ({
  db: {
    getAllUserProducts: (...args: unknown[]) => mockGetAllUserProducts(...args),
    getProductHistory: vi.fn().mockResolvedValue(null),
  },
}));

const makeProduct = (id: string, userId: string, name: string): Product => ({
  id,
  user_id: userId,
  name,
  category: 'Skincare',
  brand: 'Brand',
  size_value: 100,
  size_unit: 'ml',
  created_at: '2026-01-01T00:00:00Z',
});

describe('ProductComparisonPage account-switch cache isolation', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dataCache.clearAll();
    mockGetAllUserProducts.mockReset();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('clears Account A products and loads Account B products when user switches accounts', async () => {
    const prodA = makeProduct('p-a', 'user-a', 'Account A Serum');
    const prodB = makeProduct('p-b', 'user-b', 'Account B Cleanser');

    dataCache.set('user-a', 'all-products', [prodA]);
    dataCache.set('user-b', 'all-products', [prodB]);

    currentUser = { id: 'user-a', email: 'a@nittoo.local' };
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ProductComparisonPage />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Account A Serum');
    expect(container.textContent).not.toContain('Account B Cleanser');

    // Switch to Account B while page stays mounted
    currentUser = { id: 'user-b', email: 'b@nittoo.local' };
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ProductComparisonPage />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Account B Cleanser');
    expect(container.textContent).not.toContain('Account A Serum');

    await act(async () => {
      root.unmount();
    });
  });
});
