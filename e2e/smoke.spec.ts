import { expect, test } from '@playwright/test';

test.describe('Nittoo E2E (demo/mock mode)', () => {
  test('a. Smoke: Try the demo -> dashboard -> open product -> add purchase -> see in history', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Try the demo/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();
    await expect(page.getByText(/Runs out between /).first()).toBeVisible();

    await page.locator('a[href^="/product/"]').first().click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByText(/Runs out between /).first()).toBeVisible();
    const productUrl = page.url();

    await page.getByRole('button', { name: /Add Inventory/i }).click();
    await expect(page).toHaveURL(/\/add-inventory/);

    await page.locator('#price').fill('999');
    await page.locator('#store-vendor').fill('Playwright Test Mart');
    await page.locator('#purchase-size-value').fill('473');
    await page.getByRole('button', { name: /Add to Inventory/i }).click();

    await expect(page).toHaveURL(/\/inventory/);
    await page.goto(productUrl);
    await expect(page.getByText('Playwright Test Mart')).toBeVisible();
    await expect(page.getByText(/999/)).toBeVisible();
    await expect(page.getByText(/473 ml/)).toBeVisible();
  });

  test('b. Resilience: blocked Supabase host renders login <3s and Try the demo works', async ({
    page,
  }) => {
    await page.route('**/*.supabase.co/**', (route) => route.abort('failed'));

    const start = Date.now();
    await page.goto('/login');
    const demoBtn = page.getByRole('button', { name: /Try the demo/i });
    await expect(demoBtn).toBeVisible({ timeout: 3000 });
    expect(Date.now() - start).toBeLessThan(3000);

    await demoBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();
  });

  test('c. Auth flash: signed-in demo user stays on /dashboard on reload and /login redirects without interactable form', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __loginFormInteractable?: boolean }).__loginFormInteractable = false;
      const check = () => {
        if (!window.location.pathname.startsWith('/login')) return;
        const emailInput = document.querySelector<HTMLInputElement>('#login-email');
        if (emailInput && !emailInput.disabled) {
          (window as unknown as { __loginFormInteractable?: boolean }).__loginFormInteractable =
            true;
        }
      };
      const observer = new MutationObserver(check);
      if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
      document.addEventListener('DOMContentLoaded', check);
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
    const becameInteractable = await page.evaluate(
      () => (window as unknown as { __loginFormInteractable?: boolean }).__loginFormInteractable
    );
    expect(becameInteractable).toBe(false);
  });

  test('d. Analytics, Inventory, and non-active product details render without crashing in demo mode', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 1. Analytics renders KPI + charts without hitting ErrorBoundary
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByText(/Something went wrong on this page/i)).not.toBeVisible();
    await expect(page.getByText(/Estimated Monthly Consumption/i)).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();

    // 2. Inventory renders cleanly with unopened-only and active products
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/inventory/);
    await expect(page.getByText(/Something went wrong on this page/i)).not.toBeVisible();
    await expect(page.getByText(/Original Liquid Handwash Refill/i).first()).toBeVisible();

    // 3. Open detail page of both new non-active products (all-finished + unopened-only)
    await page.goto('/product/demo-prod-vaseline-lotion');
    await expect(page.getByText(/Something went wrong on this page/i)).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Intensive Care Cocoa Glow Lotion/i })
    ).toBeVisible();

    await page.goto('/product/demo-prod-dettol-handwash');
    await expect(page.getByText(/Something went wrong on this page/i)).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Original Liquid Handwash Refill/i })
    ).toBeVisible();
  });
});
