import { expect, test } from '@playwright/test';

test.describe('Motion & reduced-motion behaviour', () => {
  test('under reducedMotion: reduce, animations do not run, KPIs show final values immediately, and modal unmounts immediately', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto('/login');
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();

    // No running Web/CSS animations after load
    const runningCount = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length
    );
    expect(runningCount).toBe(0);

    // Navigate to Analytics and verify KPI shows final value immediately
    await page.goto('/analytics');
    await expect(page.getByText(/Estimated Monthly Consumption/i)).toBeVisible();
    const kpiLocator = page.locator('[aria-label^="৳"]').first();
    await expect(kpiLocator).toBeVisible();
    const expectedLabel = await kpiLocator.getAttribute('aria-label');
    expect(expectedLabel).toBeTruthy();
    await expect(kpiLocator).toHaveText(expectedLabel!);

    // Back to Dashboard: open modal and verify immediate unmount on close
    await page.goto('/dashboard');
    await expect(page.getByText(/CeraVe/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Mark Finished/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: /Close dialog/i }).click();
    await expect(dialog).toHaveCount(0);

    await context.close();
  });

  test('with motion enabled, dashboard cards end visible/clickable and modal exits cleanly', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await context.newPage();

    await page.goto('/login');
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const firstCardLink = page.locator('a[href^="/product/"]').first();
    await expect(firstCardLink).toBeVisible();
    await expect(firstCardLink).toBeEnabled();

    // Open modal and close it; verify it unmounts within expected exit window
    await page.getByRole('button', { name: /Mark Finished/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: /Close dialog/i }).click();
    await expect(dialog).toHaveCount(0, { timeout: 1000 });

    // Confirm dashboard card link remains clickable after modal exit
    await firstCardLink.click();
    await expect(page).toHaveURL(/\/product\//);

    await context.close();
  });
});
