// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import type { ProductWithDetails } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ProductCard', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('displays the active bottle price rather than a newer backup purchase price', () => {
    const product: ProductWithDetails = {
      id: 'prod-1',
      user_id: 'user-1',
      name: 'Hydrating Facial Cleanser',
      brand: 'CeraVe',
      category: 'Skincare',
      size_value: 236,
      size_unit: 'ml',
      created_at: '2026-01-01T00:00:00.000Z',
      active_purchase: {
        id: 'pur-active',
        product_id: 'prod-1',
        purchase_date: '2026-09-01',
        price: 1690,
        currency: 'BDT',
        size_value: 236,
        size_unit: 'ml',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      latest_purchase: {
        id: 'pur-backup',
        product_id: 'prod-1',
        purchase_date: '2026-10-15',
        price: 1750,
        currency: 'BDT',
        size_value: 236,
        size_unit: 'ml',
        created_at: '2026-10-15T00:00:00.000Z',
      },
      active_usage: {
        id: 'use-1',
        product_id: 'prod-1',
        purchase_id: 'pur-active',
        opened_date: '2026-09-20',
        finished_date: null,
        status: 'active',
        created_at: '2026-09-20T00:00:00.000Z',
      },
      finished_periods: [],
      finished_count: 0,
      unopened_count: 1,
    };

    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter>
          <ProductCard product={product} onMarkFinished={() => {}} />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('৳1690');
    expect(container.textContent).not.toContain('৳1750');

    act(() => {
      root.unmount();
    });
  });
});
