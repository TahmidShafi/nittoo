import { expect, test } from '@playwright/test';

test.describe('SEO & PWA production preview checks', () => {
  test('landing page has expected title, meta description, and Open Graph tags', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Nittoo/i);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(20);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');

    expect(ogTitle).toMatch(/Nittoo/i);
    expect(ogDescription).toBeTruthy();
    expect(ogType).toBeTruthy();
  });

  test('/robots.txt and /sitemap.xml return 200 with expected content', async ({ request }) => {
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    expect(await robotsRes.text()).toMatch(/User-agent:/i);

    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
  });

  test('web manifest is linked, valid JSON with name & icons, and service worker registers', async ({
    page,
    request,
  }) => {
    await page.goto('/login');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestRes = await request.get(manifestHref!);
    expect(manifestRes.status()).toBe(200);
    const manifest = (await manifestRes.json()) as {
      name?: string;
      icons?: { src: string; sizes?: string }[];
    };
    expect(manifest.name).toMatch(/Nittoo/i);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons!.length).toBeGreaterThan(0);

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg && reg.active);
    });
    expect(swRegistered).toBe(true);
  });
});
